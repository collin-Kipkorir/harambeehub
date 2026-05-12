const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

async function generate() {
  const src = path.join(__dirname, '..', 'public', 'harambee_logo.png');
  const outDir = path.join(__dirname, '..', 'public', 'icons');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 192, 512];
  const pngPaths = [];

  for (const s of sizes) {
    const outPath = path.join(outDir, `icon-${s}.png`);
    await sharp(src).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(outPath);
    pngPaths.push(outPath);
    console.log('Wrote', outPath);
  }

  // Create favicon.ico from 16/32/48/64
  const icoSrc = pngPaths.filter(p => {
    const n = path.basename(p).match(/icon-(\d+)\.png$/);
    return n && [16, 32, 48, 64].includes(Number(n[1]));
  });

  const icoOut = path.join(__dirname, '..', 'public', 'favicon.ico');
  const buf = await pngToIco(icoSrc);
  fs.writeFileSync(icoOut, buf);
  console.log('Wrote', icoOut);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
