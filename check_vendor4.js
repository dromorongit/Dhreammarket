const fs = require('fs');
const content = fs.readFileSync('app/vendor/[id]/vendor-client.tsx', 'utf8');
const lines = content.split('\n');

// Find all return ( that are not inside => functions
let mainReturnStart = -1;
let braceDepth = 0;

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  
  if (line.includes('return (') && !line.includes('=>')) {
    if (mainReturnStart === -1) {
      mainReturnStart = i;
      braceDepth = 0;
      continue;
    }
  }
}

// Now trace from mainReturnStart
if (mainReturnStart >= 0) {
  let depth = 0;
  let issues = [];
  
  for (let i = mainReturnStart; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('return (') && !line.includes('=>') && i !== mainReturnStart) {
      issues.push(`Nested return at line ${i+1}`);
      continue;
    }
    
    for (const ch of line) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
    }
    
    if (i > mainReturnStart && depth <= 0 && line.trim() === '}') {
      console.log(`Main return ends at line ${i+1}`);
      console.log(`Lines ${mainReturnStart+1} to ${i+1}`);
      
      // Find unclosed tags
      let stack = [];
      for (let j = mainReturnStart; j <= i; j++) {
        const l = lines[j];
        const trimmed = l.trim();
        
        // Simple tag tracking
        const openMatch = trimmed.match(/<(div|section|Card|CardContent)\b[^>]*>/g);
        const closeMatch = trimmed.match(/<\/(div|section|Card|CardContent)>/g);
        
        if (openMatch) {
          for (const m of openMatch) {
            const tag = m.match(/<(div|section|Card|CardContent)\b/)[1];
            stack.push({ tag, line: j+1 });
          }
        }
        if (closeMatch) {
          for (const m of closeMatch) {
            const tag = m.match(/<\/(div|section|Card|CardContent)>/)[1];
            if (stack.length > 0 && stack[stack.length-1].tag === tag) {
              stack.pop();
            }
          }
        }
      }
      
      if (stack.length > 0) {
        console.log('Unclosed tags:');
        stack.forEach(s => console.log(`  <${s.tag}> at line ${s.line}`));
      } else {
        console.log('All tags balanced');
      }
      
      console.log('Issues:', issues);
      break;
    }
  }
}
