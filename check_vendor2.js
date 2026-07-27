const fs = require('fs');
const content = fs.readFileSync('app/vendor/[id]/vendor-client.tsx', 'utf8');
const lines = content.split('\n');

// Find main return and extract just that part
let mainReturnStart = -1;
let braceDepth = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export default function VendorProfilePage()')) {
    braceDepth = 0;
    continue;
  }
  if (mainReturnStart === -1 && lines[i].includes('return (') && !lines[i].includes('=>')) {
    mainReturnStart = i;
    continue;
  }
  if (mainReturnStart > 0) {
    // Track braces and brackets
  }
}

// Simpler: just look for the div imbalance around the return
let inMainReturn = false;
let divStack = [];
let errors = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect start of main return
  if (line.includes('export default function VendorProfilePage()')) {
    inMainReturn = false;
    continue;
  }
  
  if (line.includes('return (') && !line.includes('=>')) {
    inMainReturn = true;
    continue;
  }
  
  if (!inMainReturn) continue;
  
  const trimmed = line.trim();
  
  // Count div opens and closes
  const divOpenMatches = trimmed.match(/<div\b/g) || [];
  const divCloseMatches = trimmed.match(/<\/div>/g) || [];
  
  for (let j = 0; j < divOpenMatches.length; j++) {
    divStack.push({ tag: 'div', line: i + 1 });
  }
  for (let j = 0; j < divCloseMatches.length; j++) {
    if (divStack.length === 0) {
      errors.push(`Extra </div> at line ${i + 1}`);
    } else {
      divStack.pop();
    }
  }
}

if (divStack.length > 0) {
  console.log('Unclosed divs:');
  divStack.forEach(d => console.log(`  <div> at line ${d.line}`));
} else {
  console.log('All divs properly closed');
}

if (errors.length > 0) {
  console.log('Errors:');
  errors.forEach(e => console.log(`  ${e}`));
} else {
  console.log('No extra closing tags');
}
