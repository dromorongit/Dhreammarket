const fs = require('fs');
const content = fs.readFileSync('app/vendor/[id]/vendor-client.tsx', 'utf8');
const lines = content.split('\n');

// Check for unmatched < that might be causing issues
// Look for template literals or strings containing <
let inTemplate = false;
let templateDepth = 0;
let issues = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check for unclosed tags in JSX-like patterns
  const openTags = (line.match(/<(div|section|Card)\b/g) || []).length;
  const closeTags = (line.match(/<\/(div|section|Card)>/g) || []).length;
  
  if (openTags > closeTags && line.includes('service-card')) {
    // not relevant
  }
}

// Let's just look for any lines that contain '<' followed by non-tag patterns
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<') && !line.includes('</') && !line.includes('<div') && !line.includes('<section') && !line.includes('<Card') && !line.includes('<Image') && !line.includes('<Badge') && !line.includes('<Button') && !line.includes('<Link') && !line.includes('<EmptyState') && !line.includes('<Skeleton') && !line.includes('<svg') && !line.includes('<path') && !line.includes('<MdVerified') && !line.includes('<h1') && !line.includes('<h2') && !line.includes('<h3') && !line.includes('<p>') && !line.includes('<span') && !line.includes('<a ') && !line.includes('<textarea')) {
    if (!line.includes('//') && !line.includes('*') && line.trim().length > 0) {
      console.log(`Suspicious line ${i+1}: ${line.trim().substring(0, 100)}`);
    }
  }
}

console.log('Done checking');
