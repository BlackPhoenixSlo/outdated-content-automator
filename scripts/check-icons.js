/* check-icons.js — sanity-check that every declared icon PNG exists and has the
 * exact pixel dimensions the manifest claims. Reads PNG width/height straight
 * from the IHDR header (bytes 16-23) so it needs no image libraries.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

function pngSize(file) {
  const buf = fs.readFileSync(file);
  const sig = buf.slice(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

let failed = false;
for (const [size, rel] of Object.entries(manifest.icons)) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.error(`MISSING  ${rel}`);
    failed = true;
    continue;
  }
  const { width, height } = pngSize(file);
  const want = Number(size);
  if (width !== want || height !== want) {
    console.error(`BAD SIZE ${rel}: ${width}x${height}, expected ${want}x${want}`);
    failed = true;
  } else {
    console.log(`ok       ${rel} (${width}x${height})`);
  }
}

if (failed) process.exit(1);
console.log('All icons valid.');
