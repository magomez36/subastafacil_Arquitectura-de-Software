
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

const authenticateToken = require('../middleware/auth.middleware');
const { closeExpiredAuctions } = require('../services/auctions.service');

// GET /api/auctions
// Obtener las subastas activas
router.get('/', async (req, res) => {
  try {
    await closeExpiredAuctions();
    const { q, category_id, min_price, max_price, ending_soon, sort } = req.query;
    const bad = (message) => res.status(400).json({ status: 'error', message });
    const isStr = (v) => v === undefined || typeof v === 'string';

    if (![q, category_id, min_price, max_price, ending_soon, sort].every(isStr)) {
      return bad('Parámetros de búsqueda inválidos');
    }

    const params = [];
    const where = [];
    const having = [];

    const term = (q || '').trim();
    if (term) {
      if (term.length > 100) return bad('La búsqueda no puede superar 100 caracteres');
      params.push(`%${term.replace(/[\\%_]/g, '\\$&')}%`);
      where.push(`(a.title ILIKE $${params.length} OR a.description ILIKE $${params.length})`);
    }

    if (category_id !== undefined && category_id !== '') {
      if (!/^\d{1,15}$/.test(category_id) || Number(category_id) < 1) {
        return bad('category_id debe ser un entero positivo');
      }
      params.push(category_id);
      where.push(`a.category_id = $${params.length}`);
    }

    const parsePrice = (value, name) => {
      if (value === undefined || value === '') return null;
      const n = Number(value);
      if (!/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(n) || n > 1e12) {
        bad(`${name} debe ser un número válido mayor o igual a 0`);
        return false;
      }
      return n;
    };
    const min = parsePrice(min_price, 'min_price');
    if (min === false) return;
    const max = parsePrice(max_price, 'max_price');
    if (max === false) return;
    if (min !== null && max !== null && min > max) {
      return bad('min_price no puede ser mayor que max_price');
    }
    const priceExpr = 'COALESCE(MAX(b.amount), a.starting_price)';
    if (min !== null) {
      params.push(min);
      having.push(`${priceExpr} >= $${params.length}`);
    }
    if (max !== null) {
      params.push(max);
      having.push(`${priceExpr} <= $${params.length}`);
    }

    if (ending_soon !== undefined && ending_soon !== '') {
      if (!['1', '0', 'true', 'false'].includes(ending_soon)) {
        return bad('ending_soon debe ser 1 o 0');
      }
      if (ending_soon === '1' || ending_soon === 'true') {
        where.push(`a.ends_at <= NOW() + INTERVAL '24 hours'`);
      }
    }

    const sorts = {
      ends_asc: 'a.ends_at ASC',
      ends_desc: 'a.ends_at DESC',
      price_asc: `${priceExpr} ASC, a.ends_at ASC`,
      price_desc: `${priceExpr} DESC, a.ends_at ASC`,
      bids_desc: 'COUNT(b.id) DESC, a.ends_at ASC',
      newest: 'a.starts_at DESC, a.id DESC',
    };
    const sortKey = sort || 'ends_asc';
    if (!Object.prototype.hasOwnProperty.call(sorts, sortKey)) {
      return bad('sort inválido. Valores permitidos: ' + Object.keys(sorts).join(', '));
    }

    const query = `
      SELECT
        a.id,
        a.title,
        a.description,
        a.image_url,
        a.starting_price,
        a.min_increment,
        a.starts_at,
        a.ends_at,
        c.name AS category,
        u.full_name AS seller,
        COALESCE(MAX(b.amount), a.starting_price) AS current_price,
        COUNT(b.id)::INTEGER AS bids_count
      FROM auctions a
      INNER JOIN categories c
        ON c.id = a.category_id
      INNER JOIN users u
        ON u.id = a.seller_id
      LEFT JOIN bids b
        ON b.auction_id = a.id
      WHERE a.status = 'active'
        AND a.starts_at <= NOW()
        AND a.ends_at > NOW()
        ${where.length ? 'AND ' + where.join(' AND ') : ''}
      GROUP BY a.id, c.name, u.full_name
      ${having.length ? 'HAVING ' + having.join(' AND ') : ''}
      ORDER BY ${sorts[sortKey]};
    `;

    const result = await pool.query(query, params);

    res.json({
      status: 'ok',
      total: result.rows.length,
      auctions: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener subastas:', error.message);

    res.status(500).json({
      status: 'error',
      message: 'No se pudieron obtener las subastas',
    });
  }
});

/**
 * GET /api/auctions/:id
 * Consultar el detalle de una subasta por su identificador.
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'El identificador de la subasta no es válido',
    });
  }

  try {
    await closeExpiredAuctions();
    const query = `
      SELECT
        a.id,
        a.title,
        a.description,
        a.image_url,
        a.starting_price,
        a.min_increment,
        a.starts_at,
        a.ends_at,
        a.status,
        a.created_at,
        c.id AS category_id,
        c.name AS category,
        u.id AS seller_id,
        u.full_name AS seller,
        a.winner_id,
        winner.full_name AS winner,
        a.closed_at,
        COALESCE(
          (SELECT ARRAY_AGG(ai.image_url ORDER BY ai.position, ai.id)
           FROM auction_images ai WHERE ai.auction_id = a.id),
          ARRAY[a.image_url]
        ) AS image_urls,
        COALESCE(MAX(b.amount), a.starting_price) AS current_price,
        COUNT(b.id)::INTEGER AS bids_count
      FROM auctions a
      INNER JOIN categories c
        ON c.id = a.category_id
      INNER JOIN users u
        ON u.id = a.seller_id
      LEFT JOIN users winner
        ON winner.id = a.winner_id
      LEFT JOIN bids b
        ON b.auction_id = a.id
      WHERE a.id = $1
      GROUP BY a.id, c.id, c.name, u.id, u.full_name, winner.full_name;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontró la subasta solicitada',
      });
    }

    return res.json({
      status: 'ok',
      auction: result.rows[0],
    });
  } catch (error) {
    console.error('Error al consultar el detalle de la subasta:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'No se pudo obtener el detalle de la subasta',
    });
  }
});

/**
 * POST /api/auctions/:id/close
 * Permite al vendedor cerrar su subasta activa y fija al mejor postor.
 */
router.post('/:id/close', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({ status: 'error', message: 'El identificador de la subasta no es válido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, seller_id, status FROM auctions WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const auction = result.rows[0];

    if (!auction) {
      await client.query('ROLLBACK');
      return res.status(404).json({ status: 'error', message: 'La subasta no existe.' });
    }
    if (String(auction.seller_id) !== String(req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ status: 'error', message: 'Solo el vendedor puede cerrar esta subasta.' });
    }
    if (auction.status === 'closed') {
      await client.query('COMMIT');
      return res.json({ status: 'ok', message: 'La subasta ya estaba cerrada.' });
    }
    if (auction.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({ status: 'error', message: 'Solo puedes cerrar una subasta activa.' });
    }

    const winner = await client.query(
      `SELECT bidder_id, amount FROM bids
       WHERE auction_id = $1
       ORDER BY amount DESC, created_at ASC, id ASC
       LIMIT 1`,
      [id]
    );
    const closed = await client.query(
      `UPDATE auctions
       SET status = 'closed', winner_id = $2, closed_at = NOW()
       WHERE id = $1
       RETURNING id, title, status, winner_id, closed_at`,
      [id, winner.rows[0]?.bidder_id || null]
    );
    await client.query('COMMIT');

    return res.json({
      status: 'ok',
      message: winner.rows[0] ? 'Subasta cerrada y ganador determinado.' : 'Subasta cerrada sin ofertas.',
      auction: closed.rows[0],
      winning_amount: winner.rows[0]?.amount || null,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al cerrar subasta:', error.message);
    return res.status(500).json({ status: 'error', message: 'No se pudo cerrar la subasta.' });
  } finally {
    client.release();
  }
});



/**
 * POST /api/auctions
 * Publicar una subasta para el usuario autenticado.
 */
router.post('/', authenticateToken, async (req, res) => {
  const {
    title,
    description,
    image_url,
    image_urls,
    category_id,
    starting_price,
    min_increment,
    starts_at,
    ends_at,
  } = req.body;

  const cleanTitle =
    typeof title === 'string' ? title.trim() : '';

  const cleanDescription =
    typeof description === 'string'
      ? description.trim()
      : '';

  const rawImages = Array.isArray(image_urls) ? image_urls : [image_url];

  const categoryId = Number(category_id);
  const startingPrice = Number(starting_price);
  const minIncrement = Number(min_increment);

  if (!cleanTitle || cleanTitle.length > 160) {
    return res.status(400).json({
      status: 'error',
      message: 'El título es obligatorio y admite hasta 160 caracteres.',
    });
  }

  if (!cleanDescription) {
    return res.status(400).json({
      status: 'error',
      message: 'La descripción es obligatoria.',
    });
  }

  if (rawImages.length < 1 || rawImages.length > 5) {
    return res.status(400).json({ status: 'error', message: 'Agrega entre 1 y 5 imágenes del producto.' });
  }
  const cleanImages = [];
  let totalImageBytes = 0;
  for (const rawImage of rawImages) {
    const value = typeof rawImage === 'string' ? rawImage.trim() : '';
    const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
    const bytes = match ? Buffer.from(match[2], 'base64') : null;
    const valid = match && bytes && (
      (match[1].toLowerCase() === 'png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (match[1].toLowerCase() === 'jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
      (match[1].toLowerCase() === 'webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    );
    if (!valid || bytes.length > 2 * 1024 * 1024) {
      return res.status(400).json({ status: 'error', message: 'Cada foto debe ser PNG, JPG o WebP válida y pesar hasta 2 MB.' });
    }
    totalImageBytes += bytes.length;
    if (totalImageBytes > 10 * 1024 * 1024) {
      return res.status(400).json({ status: 'error', message: 'El total de las imágenes no puede superar 10 MB.' });
    }
    cleanImages.push(value);
  }

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Selecciona una categoría válida.',
    });
  }

  if (
    !Number.isFinite(startingPrice) ||
    startingPrice <= 0 ||
    startingPrice > 9999999999.99
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'El precio inicial debe ser mayor que cero.',
    });
  }

  if (
    !Number.isFinite(minIncrement) ||
    minIncrement <= 0 ||
    minIncrement > 9999999999.99
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'El incremento mínimo debe ser mayor que cero.',
    });
  }

  const startsAt = starts_at ? new Date(starts_at) : new Date();
  const endsAt = ends_at ? new Date(ends_at) : null;

  if (
    Number.isNaN(startsAt.getTime()) ||
    !endsAt ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt ||
    endsAt <= new Date()
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'La fecha de finalización debe ser futura y posterior al inicio.',
    });
  }

  try {
    const category = await pool.query(
      'SELECT id FROM categories WHERE id = $1',
      [categoryId]
    );

    if (category.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'La categoría seleccionada no existe.',
      });
    }

    const status =
      startsAt > new Date() ? 'scheduled' : 'active';

    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      result = await client.query(
      `INSERT INTO auctions (
         seller_id,
         category_id,
         title,
         description,
         image_url,
         starting_price,
         min_increment,
         starts_at,
         ends_at,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING
         id,
         seller_id,
         category_id,
         title,
         description,
         image_url,
         starting_price,
         min_increment,
         starts_at,
         ends_at,
         status,
         created_at`,
      [
        req.user.id,
        categoryId,
        cleanTitle,
        cleanDescription,
        cleanImages[0],
        startingPrice,
        minIncrement,
        startsAt,
        endsAt,
        status,
      ]
      );
      for (const [index, imageUrl] of cleanImages.entries()) {
        await client.query(
          'INSERT INTO auction_images (auction_id, image_url, position) VALUES ($1, $2, $3)',
          [result.rows[0].id, imageUrl, index + 1]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    return res.status(201).json({
      status: 'ok',
      message: 'Subasta publicada correctamente.',
      auction: { ...result.rows[0], image_urls: cleanImages },
    });
  } catch (error) {
    console.error('Error al publicar subasta:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'No se pudo publicar la subasta.',
    });
  }
});

module.exports = router;

