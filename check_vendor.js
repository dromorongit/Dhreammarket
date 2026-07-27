const fs = require('fs');
const path = 'app/vendor/[id]/vendor-client.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

function countTag(html, tag) {
  const regex = new RegExp(`<${tag}[\\s>]`, 'gi');
  const closeRegex = new RegExp(`</${tag}>`, 'gi');
  return {
    open: (html.match(regex) || []).length,
    close: (html.match(closeRegex) || []).length
  };
}

console.log('div:', countTag(content, 'div'));
console.log('section:', countTag(content, 'section'));
console.log('Card:', countTag(content, 'Card'));

// Find lines with specific patterns
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('activeTab ===')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
  }
  if (line.includes('return (') && !line.includes('=>')) {
    console.log(`Return at line ${i+1}: ${line.trim()}`);
  }
}
