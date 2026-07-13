const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const router = express.Router();

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

    res.json({ token, role: account.role, username: account.username });
  } catch (err) {
    console.error('Account login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password (student)
router.put('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
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
router.put('/account-change-password', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
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
