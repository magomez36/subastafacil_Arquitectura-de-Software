
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

function createToken(user) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('Falta configurar JWT_SECRET.');
  }

  return jwt.sign(
    { role: user.role },
    secret,
    {
      subject: String(user.id),
      expiresIn: '8h',
    }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const fullName =
    typeof req.body.full_name === 'string'
      ? req.body.full_name.trim()
      : '';

  const email =
    typeof req.body.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';

  const password =
    typeof req.body.password === 'string'
      ? req.body.password
      : '';

  if (!fullName || fullName.length > 120) {
    return res.status(400).json({
      status: 'error',
      message: 'Ingresa un nombre de hasta 120 caracteres.',
    });
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 255
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'Ingresa un correo electrónico válido.',
    });
  }

  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({
      status: 'error',
      message: 'La contraseña debe tener entre 8 y 72 caracteres.',
    });
  }

  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe una cuenta con ese correo.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, role`,
      [fullName, email, passwordHash]
    );

    const user = result.rows[0];
    const token = createToken(user);

    return res.status(201).json({
      status: 'ok',
      message: 'Cuenta creada correctamente.',
      token,
      user,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe una cuenta con ese correo.',
      });
    }

    console.error('Error al registrar usuario:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'No se pudo completar el registro.',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const email =
    typeof req.body.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';

  const password =
    typeof req.body.password === 'string'
      ? req.body.password
      : '';

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Ingresa tu correo y contraseña.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role, is_active
       FROM users
       WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (
      !user ||
      !user.is_active ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        status: 'error',
        message: 'Correo o contraseña incorrectos.',
      });
    }

    const token = createToken(user);

    return res.json({
      status: 'ok',
      message: 'Inicio de sesión correcto.',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'No se pudo iniciar sesión.',
    });
  }
});

module.exports = router;
