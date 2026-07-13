const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character (!@#$%^&*)';
  return null;
}

// Student login
router.post('/login', async (req, res) => {
  try {
    const { id, password } = req.body;
    if (!id || !password) {
      return res.status(400).json({ error: 'Student ID and password required' });
    }

    const result = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const student = result.rows[0];
    const valid = await bcrypt.compare(password, student.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: student.id, name: student.name, role: 'student', firstLogin: student.first_login },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, student: { id: student.id, name: student.name, firstLogin: student.first_login } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accountant/Control login
router.post('/account-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await pool.query('SELECT * FROM accounts WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const account = result.rows[0];
    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { username: account.username, role: account.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, role: account.role, username: account.username, displayName: account.display_name || account.username });
  } catch (err) {
    console.error('Account login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password (student)
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const decoded = req.user;
    const { newPassword } = req.body;

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const studentResult = await pool.query('SELECT id FROM students WHERE id = $1', [decoded.id]);
    const studentId = studentResult.rows[0].id.replace('-', '');
    if (newPassword === studentResult.rows[0].id || newPassword === studentId) {
      return res.status(400).json({ error: 'New password cannot be your student ID' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE students SET password_hash = $1, first_login = false WHERE id = $2', [hash, decoded.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password (account - admin/control/accountant)
router.put('/account-change-password', authenticateToken, async (req, res) => {
  try {
    const decoded = req.user;
    const { newPassword } = req.body;

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE accounts SET password_hash = $1 WHERE username = $2', [hash, decoded.username]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Account change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
