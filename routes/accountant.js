const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get student by ID (for accountant)
router.get('/student/:id', authenticateToken, requireRole('accountant'), async (req, res) => {
  try {
    const { id } = req.params;

    const studentResult = await pool.query('SELECT id, name FROM students WHERE id = $1', [id]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const coursesResult = await pool.query(
      `SELECT r.course, r.grade FROM results r
       WHERE r.student_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM payments p
         WHERE p.student_id = $1 AND p.course = r.course
       )
       ORDER BY r.course`,
      [id]
    );

    const courses = {};
    coursesResult.rows.forEach(row => {
      courses[row.course] = row.grade;
    });

    res.json({
      id: studentResult.rows[0].id,
      name: studentResult.rows[0].name,
      courses
    });
  } catch (err) {
    console.error('Get student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save payment
router.post('/payment', authenticateToken, requireRole('accountant'), async (req, res) => {
  try {
    const { studentId, course, amount } = req.body;

    if (!studentId || !course || !amount) {
      return res.status(400).json({ error: 'Student ID, course, and amount required' });
    }

    const existing = await pool.query(
      'SELECT id FROM payments WHERE student_id = $1 AND course = $2',
      [studentId, course]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'This course has already been paid' });
    }

    const studentResult = await pool.query('SELECT name FROM students WHERE id = $1', [studentId]);
    const studentName = studentResult.rows.length > 0 ? studentResult.rows[0].name : '';
    const recordedBy = req.user.username;

    await pool.query(
      'INSERT INTO payments (student_id, student_name, course, amount, recorded_by) VALUES ($1, $2, $3, $4, $5)',
      [studentId, studentName, course, amount, recordedBy]
    );

    res.json({ message: 'Payment saved successfully' });
  } catch (err) {
    console.error('Save payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export payments as CSV
router.get('/payments/export', authenticateToken, requireRole('accountant'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT student_id, student_name, course, amount, COALESCE(recorded_by, 'Unknown') as recorded_by, TO_CHAR(date, 'YYYY-MM-DD HH24:MI:SS') as date FROM payments ORDER BY date DESC"
    );

    let csv = 'Student ID,Student Name,Course,Amount,Recorded By,Date\n';
    result.rows.forEach(row => {
      csv += `${row.student_id},"${row.student_name}",${row.course},${row.amount},${row.recorded_by},${row.date}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=UEC_Payments.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Export payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
