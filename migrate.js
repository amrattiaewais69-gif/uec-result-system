const pool = require('./config/database');

async function migrate() {
  try {
    await pool.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS gpa NUMERIC(4,2)");
    console.log('Added gpa column to students table');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
