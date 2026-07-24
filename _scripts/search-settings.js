const fs = require('fs');
const path = require('path');

const patterns = [
  { name: 'SuperAdminSettings', regex: /superAdminSetting|SuperAdminSetting|super_admin_setting/ },
  { name: 'brandingPreferences', regex: /brandingPreferences|branding_preferences/ },
  { name: 'defaultCurrency', regex: /defaultCurrency|default_currency/ },
  { name: 'auditLogRetention', regex: /auditLogRetention|audit_log_retention/ },
  { name: 'sessionTimeout', regex: /sessionTimeout|session_timeout/ },
  { name: 'allowedAdminIps', regex: /allowedAdminIps|allowed_admin_ips/ },
  { name: 'monitoringPreferences', regex: /monitoringPreferences|monitoring_preferences/ },
  { name: 'platformBehaviour', regex: /platformBehaviourPreferences|platform_behaviour/ },
  { name: 'hardcodedGHS', regex: /['"]GHS['"]/ },
  { name: 'hardcodedDhreamarket', regex: /Dhreamarket/ },
  { name: 'hardcodedColor', regex: /#[0-9a-fA-F]{3,8}/ },
  { name: 'formatCurrency', regex: /formatCurrency|formatPrice/ },
  { name: 'createSuperAdmin', regex: /superAdminSettings\.create/ },
  { name: 'findFirstSuperAdmin', regex: /superAdminSettings\.findFirst/ },
  { name: 'updateSuperAdmin', regex: /superAdminSettings\.update/ },
];

const baseDir = process.argv[2] || 'C:/Users/Dromor Narh/Desktop/GithubRepos/Dhreamarket';
const skipDirs = ['node_modules', '.next', '.git', '.prisma'];

function searchInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      patterns.forEach(p => {
        if (p.regex.test(line)) {
          console.log(JSON.stringify({ file: filePath, line: i + 1, content: line.trim(), pattern: p.name }));
        }
      });
    });
  } catch (e) {}
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
      walk(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      searchInFile(fullPath);
    }
  }
}

walk(baseDir);