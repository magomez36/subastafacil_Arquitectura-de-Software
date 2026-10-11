
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

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
