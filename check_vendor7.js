const fs = require('fs');
const content = fs.readFileSync('app/vendor/[id]/vendor-client.tsx', 'utf8');
const lines = content.split('\n');

// Check for non-ASCII characters in JSX areas
for (let i = 350; i < 400 && i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const code = line.charCodeAt(j);
    if (code > 127) {
      console.log(`Non-ASCII at line ${i+1}, col ${j}: char ${line[j]}, code ${code}`);
    }
  }
}

// Also check for weird whitespace
for (let i = 350; i < 400 && i < lines.length; i++) {
  const line = lines[i];
  if (line !== line.trimEnd()) {
    const trailing = line.length - line.trimEnd().length;
    const whitespace = line.slice(-trailing);
    const codes = Array.from(whitespace).map(c => c.charCodeAt(0));
    if (codes.some(c => c !== 9 && c !== 10 && c !== 13 && c !== 32)) {
      console.log(`Weird trailing whitespace at line ${i+1}: codes ${codes.join(',')}`);
    }
  }
}

console.log('Check complete');
