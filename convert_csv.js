const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, 'Final Student Results - Results.csv');
const outputPath = process.argv[3] || path.join(__dirname, 'results_upload_all.csv');

const raw = fs.readFileSync(inputPath, 'utf-8').replace(/\r/g, '');
const lines = raw.split('\n').filter(l => l.trim());

const dataLines = lines.slice(1);

const courses = ['Foundations of Pathology', 'Foundations of Infections & Infestations', 'Foundations of Pharmacology', 'Foundations of Immunology'];

let output = 'student_id,name,course,grade,gpa\n';
let count = 0;

for (const line of dataLines) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  cols.push(current.trim());

  const id = cols[0];
  const name = cols[1];
  const gpa = cols[9] || '';
  if (!id || !name) continue;

  for (let i = 0; i < courses.length; i++) {
    const grade = cols[2 + i];
    if (!grade) continue;
    output += `"${id}","${name.replace(/"/g, '""')}","${courses[i]}",${grade},${gpa}\n`;
    count++;
  }
}

fs.writeFileSync(outputPath, output, 'utf-8');
console.log(`Done! ${count} results written to ${outputPath}`);
