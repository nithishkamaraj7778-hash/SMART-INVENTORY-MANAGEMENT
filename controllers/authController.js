const db = require('../database/db');
const {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword
} = require('../middleware/authMiddleware');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  try {
    const users = await db.query('SELECT * FROM admin WHERE username = ?', [username.trim()]);
    const user = users[0];

    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (!user.password.startsWith('scrypt$')) {
      await db.query('UPDATE admin SET password = ? WHERE id = ?', [await hashPassword(password), user.id]);
    }

    const token = await createSession({ id: user.id, username: user.username });
    return res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.register = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({ success: false, message: 'Username must be at least 3 characters long' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
  }

  try {
    const existingUsers = await db.query('SELECT id FROM admin WHERE username = ?', [trimmedUsername]);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    await db.query('INSERT INTO admin (username, password) VALUES (?, ?)', [trimmedUsername, await hashPassword(password)]);

    return res.status(201).json({ success: true, message: 'Account created successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Unable to create account' });
  }
};

exports.me = (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.logout = async (req, res) => {
  try {
    await destroySession(req.sessionToken);
    return res.json({ success: true, message: 'Signed out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, message: 'Unable to sign out.' });
  }
};
