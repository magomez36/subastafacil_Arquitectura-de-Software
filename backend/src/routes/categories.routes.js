
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Obtener todas las categorías disponibles
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description FROM categories ORDER BY name ASC'
    );

    res.json({
      status: 'ok',
      categories: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener las categorías:', error.message);

    res.status(500).json({
      status: 'error',
      message: 'No se pudieron obtener las categorías.',
    });
  }
});

module.exports = router;
