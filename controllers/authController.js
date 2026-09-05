const db = require('../database/db');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  try {
    const users = await db.query(
      'SELECT * FROM admin WHERE username = ? AND password = ?',
      [username.trim(), password]
    );

    if (users && users.length > 0) {
      return res.json({ success: true, message: 'Authentication successful' });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid Username or Password' });
    }
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

  if (password.length < 4) {
    return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long' });
  }

  try {
    const existingUsers = await db.query('SELECT id FROM admin WHERE username = ?', [trimmedUsername]);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    await db.query('INSERT INTO admin (username, password) VALUES (?, ?)', [trimmedUsername, password]);

    return res.status(201).json({ success: true, message: 'Account created successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Unable to create account' });
  }
};
