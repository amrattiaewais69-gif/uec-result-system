const express = require('express');
const bcrypt = require('bcrypt');
const csv = require('csv-parse/sync');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require 'admin' role
router.use(authenticateToken, requireRole('admin'));

// Bulk upload results via CSV
router.post('/upload-results', async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData) {
      return res.status(400).json({ error: 'CSV data required' });
    }

    const records = csv.parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let uploaded = 0;
    let skipped = 0;
    let errors = [];

    for (const row of records) {
      const studentId = row.student_id || row.id || row.Student_ID;
      const course = row.course || row.Course;
      const grade = row.grade || row.Grade;
      const name = row.name || row.Name || row.student_name || '';

      if (!studentId || !course || !grade) {
        skipped++;
        continue;
      }

      try {
        // Insert/update student if name provided
        if (name) {
          const existing = await pool.query('SELECT id FROM students WHERE id = $1', [studentId]);
          if (existing.rows.length === 0) {
            const hash = await bcrypt.hash(studentId.replace('-', ''), 10);
            await pool.query(
              'INSERT INTO students (id, name, password_hash, first_login) VALUES ($1, $2, $3, true) ON CONFLICT (id) DO UPDATE SET name = $2',
              [studentId, name, hash]
            );
          }
        }

        // Insert/update result
        await pool.query(
          'INSERT INTO results (student_id, course, grade) VALUES ($1, $2, $3) ON CONFLICT (student_id, course) DO UPDATE SET grade = $3',
          [studentId, course, grade]
        );
        uploaded++;
      } catch (e) {
        errors.push(`Row for ${studentId}: ${e.message}`);
      }
    }

    res.json({ message: `Uploaded ${uploaded} results, skipped ${skipped}`, errors: errors.slice(0, 10) });
  } catch (err) {
    console.error('Upload results error:', err);
    res.status(500).json({ error: 'Failed to parse CSV: ' + err.message });
  }
});

// Get all accounts
router.get('/accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT username, role, created_at FROM accounts ORDER BY role, username');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new account
router.post('/accounts', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role required' });
    }

    const validRoles = ['accountant', 'control', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be: accountant, control, or admin' });
    }

    const existing = await pool.query('SELECT username FROM accounts WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO accounts (username, password_hash, role) VALUES ($1, $2, $3)', [username, hash, role]);
    res.json({ message: 'Account created successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete account
router.delete('/accounts/:username', async (req, res) => {
  try {
    const { username } = req.params;
    if (username === 'amr' || username === 'mohamed') {
      return res.status(400).json({ error: 'Cannot delete default accounts' });
    }
    await pool.query('DELETE FROM accounts WHERE username = $1', [username]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset account password
router.put('/accounts/:username/reset-password', async (req, res) => {
  try {
    const { username } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query('UPDATE accounts SET password_hash = $1 WHERE username = $2', [hash, username]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ message: `Password reset for ${username}` });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset student password
router.put('/students/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query('UPDATE students SET password_hash = $1, first_login = true WHERE id = $2', [hash, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: `Password reset for student ${id}` });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset all student passwords
router.put('/students/reset-all', async (req, res) => {
  try {
    const students = await pool.query('SELECT id FROM students');
    let count = 0;
    for (const row of students.rows) {
      const defaultPass = row.id.replace('-', '');
      const hash = await bcrypt.hash(defaultPass, 10);
      await pool.query('UPDATE students SET password_hash = $1, first_login = true WHERE id = $2', [hash, row.id]);
      count++;
    }
    res.json({ message: `Reset ${count} student passwords` });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all students
router.get('/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, first_login FROM students ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
