import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['node_modules', '.next', '.data']);
const exts = new Set(['.md', '.tsx', '.ts', '.css', '.csv', '.mjs', '.svg', '.sql', '.example']);
const banned = [
  ['\u2014', 'tiret long'],
  ['\u2013', 'tiret demi-cadratin'],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = path.join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else if (exts.has(path.extname(name)) || name.startsWith('.env')) out.push(full);
  }
  return out;
}

let failed = false;
for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [char, label] of banned) {
      if (line.includes(char)) {
        console.error(`${path.relative(root, file)}:${index + 1} contient un ${label}`);
        failed = true;
      }
    }
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(line)) {
      console.error(`${path.relative(root, file)}:${index + 1} contient un emoji`);
      failed = true;
    }
  });
}

if (failed) process.exit(1);
console.log('copy ok');
