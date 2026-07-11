const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// Public QR verification
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const studentResult = await pool.query('SELECT id, name FROM students WHERE id = $1', [id]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const coursesResult = await pool.query(
      'SELECT course, grade FROM results WHERE student_id = $1 ORDER BY course',
      [id]
    );

    const courses = {};
    let totalPoints = 0;
    let totalCredits = 0;

    const gradePoints = {
      'A+': 4.0, 'A': 4.0, 'B+': 3.5, 'B': 3.0, 'C+': 2.5,
      'C': 2.0, 'D+': 1.5, 'D': 1.0, 'F': 0.0
    };

    coursesResult.rows.forEach(row => {
      courses[row.course] = row.grade;
      if (row.grade && row.grade !== 'F' && gradePoints[row.grade] !== undefined) {
        totalPoints += gradePoints[row.grade];
        totalCredits += 1;
      }
    });

    const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

    res.json({
      id,
      name: studentResult.rows[0].name,
      courses,
      gpa
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
