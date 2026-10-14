
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

const authenticateToken = require('../middleware/auth.middleware');

// GET /api/auctions
// Obtener las subastas activas
router.get('/', async (req, res) => {
  try {
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
      GROUP BY a.id, c.name, u.full_name
      ORDER BY a.ends_at ASC;
    `;

    const result = await pool.query(query);

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

module.exports = router;


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
        COALESCE(MAX(b.amount), a.starting_price) AS current_price,
        COUNT(b.id)::INTEGER AS bids_count
      FROM auctions a
      INNER JOIN categories c
        ON c.id = a.category_id
      INNER JOIN users u
        ON u.id = a.seller_id
      LEFT JOIN bids b
        ON b.auction_id = a.id
      WHERE a.id = $1
      GROUP BY a.id, c.id, c.name, u.id, u.full_name;
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
 * POST /api/auctions
 * Publicar una subasta para el usuario autenticado.
 */
router.post('/', authenticateToken, async (req, res) => {
  const {
    title,
    description,
    image_url,
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

  const cleanImageUrl =
    typeof image_url === 'string'
      ? image_url.trim()
      : '';

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

  if (
    cleanImageUrl &&
    (
      cleanImageUrl.length > 2048 ||
      !/^https?:\/\/\S+$/i.test(cleanImageUrl)
    )
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'La imagen debe tener una URL HTTP o HTTPS válida.',
    });
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
    endsAt <= startsAt
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'La fecha de finalización debe ser posterior al inicio.',
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

    const result = await pool.query(
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
        cleanImageUrl || null,
        startingPrice,
        minIncrement,
        startsAt,
        endsAt,
        status,
      ]
    );

    return res.status(201).json({
      status: 'ok',
      message: 'Subasta publicada correctamente.',
      auction: result.rows[0],
    });
  } catch (error) {
    console.error('Error al publicar subasta:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'No se pudo publicar la subasta.',
    });
  }
});

