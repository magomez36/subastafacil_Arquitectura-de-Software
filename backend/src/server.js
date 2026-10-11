
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/db');
const auctionRoutes = require('./routes/auctions.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API de SubastaFácil funcionando',
  });
});

app.get('/api/db-health', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS usuarios,
        (SELECT COUNT(*) FROM categories) AS categorias,
        (SELECT COUNT(*) FROM auctions) AS subastas,
        (SELECT COUNT(*) FROM bids) AS ofertas
    `);

    res.json({
      status: 'ok',
      message: 'Conexión con PostgreSQL funcionando',
      datos: result.rows[0],
    });
  } catch (error) {
    console.error('Error al consultar PostgreSQL:', error.message);

    res.status(500).json({
      status: 'error',
      message: 'No se pudo consultar la base de datos',
    });
  }
});

app.use('/api/auctions', auctionRoutes);

app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
