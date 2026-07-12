require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./config/database');

async function seed() {
  try {
    console.log('Creating tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        first_login BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS results (
        student_id TEXT REFERENCES students(id),
        course TEXT NOT NULL,
        grade TEXT,
        PRIMARY KEY (student_id, course)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS appeals (
        id SERIAL PRIMARY KEY,
        student_id TEXT REFERENCES students(id),
        student_name TEXT,
        course TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'Pending',
        date TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        student_id TEXT,
        student_name TEXT,
        course TEXT NOT NULL,
        amount DECIMAL(10,2),
        date TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, course)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        student_id TEXT,
        course TEXT,
        old_status TEXT,
        new_status TEXT,
        actor TEXT,
        date TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Tables created successfully');

    // Seed accounts
    console.log('Seeding accounts...');
    const accountantHash = await bcrypt.hash('Mohamed1', 10);
    const controlHash = await bcrypt.hash('Abdelrahman1', 10);

    await pool.query(`
      INSERT INTO accounts (username, password_hash, role) VALUES
      ('mohamed', $1, 'accountant'),
      ('amr', $2, 'control')
      ON CONFLICT (username) DO NOTHING
    `, [accountantHash, controlHash]);

    // Seed settings
    console.log('Seeding settings...');
    await pool.query(`
      INSERT INTO settings (key, value) VALUES
      ('appeal_start', '2026-07-01'),
      ('appeal_deadline', '2026-07-31'),
      ('appeal_fee', '300')
      ON CONFLICT (key) DO NOTHING
    `);

    // Seed students with demo data
    console.log('Seeding students...');
    const courses = ['Mathematics I', 'Physics I', 'English I', 'Computer Science I', 'Statistics', 'Economics', 'Management'];
    const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'];

    const students = [
      { id: '25-100001', name: 'Ahmed Mohamed Ali' },
      { id: '25-100002', name: 'Sara Hassan Ibrahim' },
      { id: '25-100003', name: 'Mohamed Ahmed Khalil' },
      { id: '25-100004', name: 'Fatma Ali Hassan' },
      { id: '25-100005', name: 'Omar Hassan Mostafa' },
      { id: '25-100006', name: 'Nour Ahmed Said' },
      { id: '25-100007', name: 'Youssef Mohamed Farouk' },
      { id: '25-100008', name: 'Mona Ali Abdullah' },
      { id: '25-100009', name: 'Khaled Mahmoud Samir' },
      { id: '25-100010', name: 'Hana Ibrahim Abdelrahman' }
    ];

    for (const student of students) {
      const hash = await bcrypt.hash(student.id.replace('-', ''), 10);

      await pool.query(`
        INSERT INTO students (id, name, password_hash, first_login)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (id) DO UPDATE SET password_hash = $3, first_login = true
      `, [student.id, student.name, hash]);

      const studentGrades = courses.map((course, i) => {
        const idx = (students.indexOf(student) + i) % grades.length;
        return grades[idx];
      });

      for (let i = 0; i < courses.length; i++) {
        await pool.query(`
          INSERT INTO results (student_id, course, grade)
          VALUES ($1, $2, $3)
          ON CONFLICT (student_id, course) DO UPDATE SET grade = $3
        `, [student.id, courses[i], studentGrades[i]]);
      }
    }

    console.log('Seed completed successfully!');
    console.log('Demo credentials:');
    console.log('  Student: 25-100001 / 25100001');
    console.log('  Accountant: mohamed / Mohamed1');
    console.log('  Control: amr / Abdelrahman1');

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
