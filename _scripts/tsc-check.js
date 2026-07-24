try {
  var exec = require('child_process').execSync;
  var result = exec('npx tsc --noEmit', {cwd: 'C:/Users/Dromor Narh/Desktop/GithubRepos/Dhreamarket', encoding: 'utf8', stdio: 'pipe'});
  console.log('SUCCESS: No errors');
} catch (e) {
  var out = (e.stdout || '') + (e.stderr || '');
  if (out.length > 3000) out = out.substring(0, 3000) + '...';
  console.log('ERRORS FOUND:');
  console.log(out);
}