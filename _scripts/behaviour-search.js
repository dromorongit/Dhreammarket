const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/Dromor Narh/Desktop/GithubRepos/Dhreamarket';
const keywords = ['isWishlistEnabled', 'isComparisonsEnabled', 'isVendorMessagingEnabled', 'areDigitalProductsEnabled', 'isGuestCheckoutAllowed', 'isAutoApproveVendors', 'areProductReviewsEnabled'];

function walk(d) {
  const entries = fs.readdirSync(d, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(d, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
      walk(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const kw of keywords) {
          if (content.includes(kw)) {
            console.log(fullPath + ': ' + kw);
            break;
          }
        }
      } catch (e) {}
    }
  }
}

walk(dir);