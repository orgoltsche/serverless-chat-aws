const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const handlers = ['connect', 'disconnect', 'sendMessage', 'getMessages'];

async function build() {
  const distDir = path.join(__dirname, 'dist');

  // Clean dist directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(distDir);

  // Build each handler
  for (const handler of handlers) {
    await esbuild.build({
      entryPoints: [`src/handlers/${handler}.ts`],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: `dist/${handler}.js`,
      external: ['@aws-sdk/*'],
      minify: true,
      sourcemap: true,
    });
    console.log(`Built ${handler}.js`);
  }

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
