const fs = require('fs');
const path = require('path');

const keywords = ['invoice', 'receipt', 'print', 'branding', 'logo', 'favicon', 'companyAddress', 'supportEmail', 'supportPhone', 'primaryColor', 'secondaryColor', 'emailBackgroundColor', 'emailHeaderColor'];
const baseDir = 'C:/Users/Dromor Narh/Desktop/GithubRepos/Dhreamarket';
const skipDirs = ['node_modules', '.next', '.git'];

const results = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
      walk(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const kw of keywords) {
          if (content.includes(kw)) {
            results.push(fullPath);
            break;
          }
        }
      } catch (e) {}
    }
  }
}

walk(baseDir);
console.log(JSON.stringify(results, null, 2));