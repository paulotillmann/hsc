import fs from 'fs';
const content = fs.readFileSync('c:/Talysson/Projetos/Antigravity/HSC/src/pages/Internato/Secretaria.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('activeTab') || line.includes('\'presenca\'') || line.includes('\'atestados\'') || line.includes('\'professores\'')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
