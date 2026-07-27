const fs = require('fs');
const content = fs.readFileSync('app/vendor/[id]/vendor-client.tsx', 'utf8');
const lines = content.split('\n');

// Find the main return and write just the JSX part
let start = -1;
let depth = 0;
let inMainReturn = false;
let jsxParts = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('export default function VendorProfilePage()')) {
    inMainReturn = false;
    continue;
  }
  
  if (line.includes('return (') && !line.includes('=>')) {
    start = i;
    inMainReturn = true;
    depth = 0;
    continue;
  }
  
  if (inMainReturn && start >= 0) {
    // Count parens
    for (const ch of line) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
    }
    jsxParts.push((i+1).toString().padStart(4) + ': ' + line);
    
    if (depth <= 0 && line.trim() === '}') {
      break;
    }
  }
}

console.log(jsxParts.slice(0, 50).join('\n'));
console.log('...');
console.log(jsxParts.slice(-20).join('\n'));
