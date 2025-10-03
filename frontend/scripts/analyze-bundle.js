const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure the build directory exists
const buildDir = path.join(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  console.log('Building the application...');
  execSync('npm run build', { stdio: 'inherit' });
}

console.log('Analyzing bundle...');
// Run source-map-explorer
const result = execSync('npx source-map-explorer build/static/js/*.js', { encoding: 'utf-8' });
console.log(result);

// Generate a report of large dependencies
console.log('\nLarge Dependencies:');
const stats = execSync('npx webpack-bundle-analyzer -m static build/stats.json', { encoding: 'utf-8' });
console.log(stats);
