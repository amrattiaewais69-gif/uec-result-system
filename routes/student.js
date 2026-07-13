const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get student results
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;

    const studentResult = await pool.query('SELECT id, name, gpa FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const coursesResult = await pool.query(
      'SELECT course, grade FROM results WHERE student_id = $1 ORDER BY course',
      [studentId]
    );

    const courses = {};

    coursesResult.rows.forEach(row => {
      courses[row.course] = row.grade;
    });

    const storedGpa = studentResult.rows[0].gpa;
    const gpa = storedGpa !== null ? parseFloat(storedGpa).toFixed(2) : '0.00';

    res.json({
      id: studentId,
      name: studentResult.rows[0].name,
      courses,
      gpa
    });
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available courses for appeal (only paid courses without existing appeal)
router.get('/appeal-courses', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;

    const settings = await pool.query("SELECT value FROM settings WHERE key = 'appeal_deadline'");
    if (settings.rows.length > 0 && settings.rows[0].value) {
      const deadline = new Date(settings.rows[0].value);
      if (new Date() > deadline) {
        return res.json({ status: 'closed', message: 'Appeal deadline has passed' });
      }
    }

    const result = await pool.query(
      `SELECT p.course FROM payments p
       WHERE p.student_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM appeals a
         WHERE a.student_id = $1 AND a.course = p.course
         AND a.status NOT IN ('Revised without change')
       )
       ORDER BY p.course`,
      [studentId]
    );

    const courses = result.rows.map(r => r.course);
    res.json({ status: 'open', courses });
  } catch (err) {
    console.error('Get appeal courses error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get student appeal history
router.get('/appeals', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      'SELECT course, reason, status, date FROM appeals WHERE student_id = $1 ORDER BY date DESC',
      [studentId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get appeals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit appeal
router.post('/appeal', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentName = req.user.name;
    const { course, reason } = req.body;

    if (!course || !reason) {
      return res.status(400).json({ error: 'Course and reason required' });
    }

    const settings = await pool.query("SELECT value FROM settings WHERE key = 'appeal_deadline'");
    if (settings.rows.length > 0 && settings.rows[0].value) {
      const deadline = new Date(settings.rows[0].value);
      if (new Date() > deadline) {
        return res.status(400).json({ error: 'Appeal deadline has passed' });
      }
    }

    const existing = await pool.query(
      "SELECT id FROM appeals WHERE student_id = $1 AND course = $2 AND status NOT IN ('Revised without change')",
      [studentId, course]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already have an active appeal for this course' });
    }

    await pool.query(
      'INSERT INTO appeals (student_id, student_name, course, reason) VALUES ($1, $2, $3, $4)',
      [studentId, studentName, course, reason]
    );

    res.json({ message: 'Appeal submitted successfully' });
  } catch (err) {
    console.error('Submit appeal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
