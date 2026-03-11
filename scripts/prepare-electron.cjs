const fs = require('fs');
const path = require('path');

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');
const staticDir = path.join(root, '.next', 'static');
const publicDir = path.join(root, 'public');
const envLocal = path.join(root, '.env.local');

const appBundleDir = path.join(root, 'electron', '.app');
const targetStaticDir = path.join(appBundleDir, '.next', 'static');
const targetPublicDir = path.join(appBundleDir, 'public');
const targetEnv = path.join(appBundleDir, '.env.local');

if (!fs.existsSync(standaloneDir)) {
  console.error('Missing .next/standalone. Run `npm run build` first.');
  process.exit(1);
}

fs.rmSync(appBundleDir, { recursive: true, force: true });
fs.mkdirSync(appBundleDir, { recursive: true });

fs.cpSync(standaloneDir, appBundleDir, { recursive: true });

if (fs.existsSync(staticDir)) {
  fs.mkdirSync(path.dirname(targetStaticDir), { recursive: true });
  fs.cpSync(staticDir, targetStaticDir, { recursive: true });
}

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, targetPublicDir, { recursive: true });
}

if (fs.existsSync(envLocal)) {
  fs.copyFileSync(envLocal, targetEnv);
}

console.log('Electron app payload prepared at electron/.app');

