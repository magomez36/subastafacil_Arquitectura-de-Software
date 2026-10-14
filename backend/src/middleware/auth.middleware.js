
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Debes iniciar sesión para realizar esta acción.',
    });
  }

  const token = authorization.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('Falta configurar JWT_SECRET en el entorno.');
    return res.status(500).json({
      status: 'error',
      message: 'La autenticación no está configurada.',
    });
  }

  try {
    const payload = jwt.verify(token, secret);

    if (!payload.sub) {
      return res.status(401).json({
        status: 'error',
        message: 'El token no es válido.',
      });
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    return next();
  } catch {
    return res.status(401).json({
      status: 'error',
      message: 'La sesión ha expirado o el token no es válido.',
    });
  }
}

module.exports = authenticateToken;
