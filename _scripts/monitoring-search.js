const fs = require('fs');
const files = ['lib/notifications.ts', 'lib/notification-preferences.ts', 'lib/platform-preferences.ts', 'middleware.ts'];
const baseDir = 'C:/Users/Dromor Narh/Desktop/GithubRepos/Dhreamarket';

const keywords = ['monitoring', 'alertsEnabled', 'systemOutage', 'emailAlerts', 'featureAnnouncement', 'policyUpdate', 'securityAlert', 'infrastructureAlert', 'financeAlert'];

files.forEach(f => {
  try {
    const content = fs.readFileSync(baseDir + '/' + f, 'utf8');
    const lines = content.split('\n');
    console.log('=== ' + f + ' ===');
    lines.forEach((l, i) => {
      for (const kw of keywords) {
        if (l.includes(kw)) {
          console.log((i + 1) + ': ' + l.trim());
          break;
        }
      }
    });
  } catch (e) {}
});