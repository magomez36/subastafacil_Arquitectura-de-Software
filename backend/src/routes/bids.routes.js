const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();

function parseId(value) {
  return /^\d+$/.test(String(value)) ? Number(value) : null;
}

function sendError(res, code, message) {
  return res.status(code).json({ status: 'error', message });
}

/**
 * GET /api/auctions/:id/bids
 * Lista pública de las ofertas (más alta primero, máximo 20).
 */
router.get('/:id/bids', async (req, res) => {
  const auctionId = parseId(req.params.id);

  if (!auctionId) {
    return sendError(res, 400, 'El identificador de la subasta no es válido.');
  }

  try {
    const exists = await pool.query('SELECT 1 FROM auctions WHERE id = $1', [auctionId]);

    if (exists.rows.length === 0) {
      return sendError(res, 404, 'La subasta no existe.');
    }

    const result = await pool.query(
      `SELECT b.id, b.amount, b.created_at, u.full_name AS bidder
       FROM bids b
       INNER JOIN users u ON u.id = b.bidder_id
       WHERE b.auction_id = $1
       ORDER BY b.amount DESC, b.created_at ASC
       LIMIT 20`,
      [auctionId]
    );

    res.json({ status: 'ok', total: result.rows.length, bids: result.rows });
  } catch (error) {
    console.error('Error al obtener ofertas:', error.message);
    sendError(res, 500, 'No se pudieron obtener las ofertas');
  }
});

/**
 * POST /api/auctions/:id/bids
 * Registra una oferta. Body: { amount }
 */
router.post('/:id/bids', authenticateToken, async (req, res) => {
  const auctionId = parseId(req.params.id);

  if (!auctionId) {
    return sendError(res, 400, 'El identificador de la subasta no es válido.');
  }

  const rawAmount = req.body && req.body.amount;
  const amount =
    typeof rawAmount === 'number' || (typeof rawAmount === 'string' && rawAmount.trim() !== '')
      ? Number(rawAmount)
      : NaN;

  if (!Number.isFinite(amount) || amount <= 0 || amount >= 10000000000) {
    return sendError(res, 400, 'El monto de la oferta debe ser un número válido mayor a cero.');
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Bloquea la fila de la subasta para evitar ofertas simultáneas.
    const auctionResult = await client.query(
      `SELECT id, seller_id, status, starting_price, min_increment,
              (starts_at <= NOW() AND ends_at > NOW()) AS in_progress
       FROM auctions
       WHERE id = $1
       FOR UPDATE`,
      [auctionId]
    );

    if (auctionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'La subasta no existe.');
    }

    const auction = auctionResult.rows[0];

    if (String(auction.seller_id) === String(req.user.id)) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'No puedes ofertar en tu propia subasta.');
    }

    if (auction.status !== 'active' || !auction.in_progress) {
      await client.query('ROLLBACK');
      return sendError(res, 409, 'La subasta no está activa en este momento.');
    }

    const maxResult = await client.query(
      'SELECT MAX(amount) AS max_amount FROM bids WHERE auction_id = $1',
      [auctionId]
    );

    const maxAmount = maxResult.rows[0].max_amount;
    const minimum =
      maxAmount === null
        ? Number(auction.starting_price)
        : Number(maxAmount) + Number(auction.min_increment);

    if (roundedAmount < minimum) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        message: `La oferta mínima es de $${minimum.toFixed(2)}.`,
        min_amount: minimum,
      });
    }

    const insertResult = await client.query(
      `INSERT INTO bids (auction_id, bidder_id, amount)
       VALUES ($1, $2, $3)
       RETURNING id, auction_id, bidder_id, amount, created_at`,
      [auctionId, req.user.id, roundedAmount]
    );

    await client.query('COMMIT');

    res.status(201).json({
      status: 'ok',
      message: 'Oferta registrada correctamente.',
      bid: insertResult.rows[0],
      current_price: insertResult.rows[0].amount,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al registrar oferta:', error.message);
    sendError(res, 500, 'No se pudo registrar la oferta');
  } finally {
    client.release();
  }
});

module.exports = router;
