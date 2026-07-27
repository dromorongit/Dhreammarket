const fs = require('fs');
const content = fs.readFileSync('app/vendor/[id]/vendor-client.tsx', 'utf8');
const lines = content.split('\n');

// From line 554 onwards (0-indexed: 553), track parens and divs
let divStack = [];
let parenDepth = 0;
let issues = [];

for (let i = 552; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Track parens carefully - only count significant ones
  // We need to track whether we're in a string or not
  let inStr = false;
  let strChar = '';
  let j = 0;
  
  while (j < line.length) {
    const ch = line[j];
    
    if (inStr) {
      if (ch === '\\') {
        j += 2;
        continue;
      }
      if (ch === strChar) {
        inStr = false;
      }
      j++;
      continue;
    }
    
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = true;
      strChar = ch;
      j++;
      continue;
    }
    
    if (ch === '(') {
      parenDepth++;
    } else if (ch === ')') {
      parenDepth--;
      if (parenDepth < 0) {
        issues.push(`Extra ) at line ${i+1}, depth became ${parenDepth}`);
        parenDepth = 0;
      }
    }
    
    j++;
  }
  
  // Track div tags (simple - count open/close)
  const divOpen = (trimmed.match(/<div\b/g) || []).length;
  const divClose = (trimmed.match(/<\/div>/g) || []).length;
  
  for (let d = 0; d < divOpen; d++) divStack.push(i+1);
  for (let d = 0; d < divClose; d++) divStack.pop();
  
  // Show paren depth at key lines
  if (trimmed.includes('activeTab') || trimmed.includes('</div>') || i >= lines.length - 10) {
    console.log(`Line ${i+1}: depth=${parenDepth}, divStack=${divStack.length}, content: ${trimmed.substring(0, 60)}`);
  }
}

console.log('\nRemaining div stack:', divStack);
console.log('Issues:', issues);
