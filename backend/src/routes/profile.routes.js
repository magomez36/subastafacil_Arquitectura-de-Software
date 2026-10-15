const express = require('express');
const pool = require('../config/db');

const router = express.Router();

const authenticateToken = require('../middleware/auth.middleware');
const { closeExpiredAuctions } = require('../services/auctions.service');

// Expresión SQL: la subasta se considera terminada si está cerrada o venció
const ENDED_SQL = `(a.status = 'closed' OR a.ends_at <= NOW())`;

// Subconsulta: oferta más alta de cada subasta (desempate: la más antigua)
const TOP_BID_SQL = `
  SELECT DISTINCT ON (auction_id) auction_id, id, bidder_id, amount
  FROM bids
  ORDER BY auction_id, amount DESC, created_at ASC, id ASC
`;

function handleError(res, error, message) {
  console.error(`${message}:`, error.message);
  res.status(500).json({ status: 'error', message });
}

// GET /api/profile
// Datos del usuario autenticado y sus estadísticas
router.get('/', authenticateToken, async (req, res) => {
  try {
    await closeExpiredAuctions();
    const userResult = await pool.query(
      `SELECT id, full_name, email, role, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado',
      });
    }

    const statsResult = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM auctions WHERE seller_id = $1)::INTEGER AS auctions_published,
        (SELECT COUNT(*) FROM bids WHERE bidder_id = $1)::INTEGER AS bids_made,
        (
          SELECT COUNT(*)
          FROM auctions a
          WHERE a.winner_id = $1
            AND a.status <> 'cancelled'
            AND ${ENDED_SQL}
        )::INTEGER AS auctions_won
      `,
      [req.user.id]
    );

    res.json({
      status: 'ok',
      user: userResult.rows[0],
      stats: statsResult.rows[0],
    });
  } catch (error) {
    handleError(res, error, 'No se pudo obtener el perfil');
  }
});

// GET /api/profile/bids
// Historial de ofertas del usuario, la más reciente primero
router.get('/bids', authenticateToken, async (req, res) => {
  try {
    await closeExpiredAuctions();
    const result = await pool.query(
      `
      SELECT
        b.id,
        a.id AS auction_id,
        a.title,
        a.image_url,
        b.amount AS my_amount,
        t.amount AS current_price,
        (t.id = b.id) AS is_winning,
        CASE
          WHEN a.status = 'cancelled' THEN 'cancelled'
          WHEN ${ENDED_SQL} THEN 'closed'
          ELSE 'active'
        END AS auction_status,
        a.ends_at,
        b.created_at
      FROM bids b
      INNER JOIN auctions a ON a.id = b.auction_id
      INNER JOIN (${TOP_BID_SQL}) t ON t.auction_id = a.id
      WHERE b.bidder_id = $1
      ORDER BY b.created_at DESC, b.id DESC
      `,
      [req.user.id]
    );

    res.json({ status: 'ok', total: result.rows.length, bids: result.rows });
  } catch (error) {
    handleError(res, error, 'No se pudo obtener el historial de ofertas');
  }
});

// GET /api/profile/auctions
// Subastas publicadas por el usuario
router.get('/auctions', authenticateToken, async (req, res) => {
  try {
    await closeExpiredAuctions();
    const result = await pool.query(
      `
      SELECT
        a.id,
        a.title,
        a.image_url,
        a.starting_price,
        COALESCE(MAX(b.amount), a.starting_price) AS current_price,
        COUNT(b.id)::INTEGER AS bids_count,
        a.winner_id,
        winner.full_name AS winner,
        winner_bid.amount AS winning_amount,
        CASE
          WHEN a.status = 'cancelled' THEN 'cancelled'
          WHEN ${ENDED_SQL} THEN 'closed'
          WHEN a.starts_at > NOW() THEN 'scheduled'
          ELSE 'active'
        END AS status,
        a.starts_at,
        a.ends_at,
        a.created_at,
        a.closed_at
      FROM auctions a
      LEFT JOIN bids b ON b.auction_id = a.id
      LEFT JOIN users winner ON winner.id = a.winner_id
      LEFT JOIN LATERAL (
        SELECT amount FROM bids
        WHERE auction_id = a.id AND bidder_id = a.winner_id
        ORDER BY amount DESC, created_at ASC, id ASC LIMIT 1
      ) winner_bid ON TRUE
      WHERE a.seller_id = $1
      GROUP BY a.id, winner.full_name, winner_bid.amount
      ORDER BY a.created_at DESC, a.id DESC
      `,
      [req.user.id]
    );

    res.json({ status: 'ok', total: result.rows.length, auctions: result.rows });
  } catch (error) {
    handleError(res, error, 'No se pudieron obtener tus subastas');
  }
});

// GET /api/profile/won
// Subastas terminadas donde la oferta del usuario fue la más alta
router.get('/won', authenticateToken, async (req, res) => {
  try {
    await closeExpiredAuctions();
    const result = await pool.query(
      `
      SELECT
        a.id,
        a.title,
        a.image_url,
        t.amount AS winning_amount,
        a.ends_at,
        u.full_name AS seller
      FROM auctions a
      INNER JOIN (${TOP_BID_SQL}) t ON t.auction_id = a.id
      INNER JOIN users u ON u.id = a.seller_id
      WHERE a.winner_id = $1
        AND a.status <> 'cancelled'
        AND ${ENDED_SQL}
      ORDER BY a.ends_at DESC, a.id DESC
      `,
      [req.user.id]
    );

    res.json({ status: 'ok', total: result.rows.length, auctions: result.rows });
  } catch (error) {
    handleError(res, error, 'No se pudieron obtener las subastas ganadas');
  }
});

module.exports = router;
