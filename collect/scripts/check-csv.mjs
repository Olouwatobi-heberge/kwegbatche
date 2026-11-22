import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../script/phrases.csv');
const lines = readFileSync(file, 'utf8')
  .replace(/^\uFEFF/, '')
  .trim()
  .split(/\r?\n/);

if (lines[0] !== 'id,intent,fr,fon,yo') {
  console.error('En-tête CSV invalide');
  process.exit(1);
}

const need = new Set([
  'consulter_solde',
  'comprendre_frais',
  'consulter_budget',
  'preparer_transfert',
  'confirmation',
  'hors_sujet',
]);

if (lines.length < 61) {
  console.error(`Pas assez de phrases : ${lines.length - 1}`);
  process.exit(1);
}

for (const line of lines.slice(1)) {
  const intent = line.split(',')[1]?.replaceAll('"', '');
  need.delete(intent);
}

if (need.size > 0) {
  console.error(`Intentions manquantes : ${[...need].join(', ')}`);
  process.exit(1);
}

console.log(`csv ok (${lines.length - 1} phrases)`);
