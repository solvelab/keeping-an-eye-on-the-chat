const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(process.cwd(), 'node_modules');
const hasNodeModules = fs.existsSync(nodeModulesPath);

let hasCrossEnv = false;
try {
  require.resolve('cross-env');
  hasCrossEnv = true;
} catch {
  hasCrossEnv = false;
}

if (!hasNodeModules || !hasCrossEnv) {
  console.error('Run npm install first.');
  process.exit(1);
}
