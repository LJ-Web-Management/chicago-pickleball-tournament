const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { HttpError } = require('./http');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signUserToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: 'user' }, SECRET, { expiresIn: '30d' });
}

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, SECRET, { expiresIn: '12h' });
}

function getTokenFromReq(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function requireUser(req) {
  const token = getTokenFromReq(req);
  if (!token) throw new HttpError(401, 'Missing or invalid Authorization header');
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.role !== 'user') throw new Error('wrong role');
    return payload; // { sub, email, role }
  } catch (err) {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

function requireAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) throw new HttpError(401, 'Missing or invalid Authorization header');
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.role !== 'admin') throw new Error('wrong role');
    return payload;
  } catch (err) {
    throw new HttpError(401, 'Invalid or expired admin token');
  }
}

// Allows either a logged-in user or an admin; returns { isAdmin, userId }
function requireUserOrAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) throw new HttpError(401, 'Missing or invalid Authorization header');
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.role === 'admin') return { isAdmin: true, userId: null };
    if (payload.role === 'user') return { isAdmin: false, userId: payload.sub };
    throw new Error('bad role');
  } catch (err) {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  signUserToken,
  signAdminToken,
  requireUser,
  requireAdmin,
  requireUserOrAdmin,
};
