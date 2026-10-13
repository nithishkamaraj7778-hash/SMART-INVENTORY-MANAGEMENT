const crypto = require('crypto');
const db = require('../database/db');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

async function verifyPassword(password, storedPassword) {
  if (!storedPassword || !storedPassword.startsWith('scrypt$')) {
    const actual = Buffer.from(password);
    const expected = Buffer.from(storedPassword || '');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  const [, salt, expectedHash] = storedPassword.split('$');
  const actualHash = await hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(actualHash.split('$')[2], 'hex'), Buffer.from(expectedHash, 'hex'));
}

async function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    'INSERT INTO auth_sessions (token_hash, user_id, username, expires_at) VALUES (?, ?, ?, ?)',
    [tokenHash, user.id, user.username, Date.now() + SESSION_TTL_MS]
  );
  return token;
}

async function requireAuth(req, res, next) {
  // The API is mounted at both / and /api for compatibility, so public auth
  // requests can pass through the first mount and reach their real route.
  if (req.path.endsWith('/login') || req.path.endsWith('/register')) return next();

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessions = await db.query(
      'SELECT user_id, username FROM auth_sessions WHERE token_hash = ? AND expires_at > ?',
      [tokenHash, Date.now()]
    );
    const session = sessions[0];
    if (!session) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    req.user = { id: session.user_id, username: session.username };
    req.sessionToken = token;
    return next();
  } catch (err) {
    console.error('Session verification error:', err);
    return res.status(500).json({ success: false, message: 'Unable to verify the session.' });
  }
}

async function destroySession(token) {
  if (!token) return;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query('DELETE FROM auth_sessions WHERE token_hash = ?', [tokenHash]);
}

module.exports = { createSession, destroySession, hashPassword, requireAuth, verifyPassword };