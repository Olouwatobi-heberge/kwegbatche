import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../script/phrases.csv');
const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''));
}

const rows = parseCsv(text);
const header = rows[0]?.map((value) => value.trim()) ?? [];
if (header.join(',') !== 'id,intent,fr,fon,yo') {
  console.error('En-tête CSV invalide');
  process.exit(1);
}

const joined = text;
for (const mark of ['ɛ', 'ɔ', 'ɖ', 'ẹ', 'ọ', 'ṣ']) {
  if (!joined.includes(mark)) {
    console.error(`Caractère manquant dans les traductions : ${mark}`);
    process.exit(1);
  }
}

const need = new Set([
  'consulter_solde',
  'comprendre_frais',
  'consulter_budget',
  'preparer_transfert',
  'confirmation',
  'hors_sujet',
]);

const data = rows.slice(1);
if (data.length < 60) {
  console.error(`Pas assez de phrases : ${data.length}`);
  process.exit(1);
}

for (const cells of data) {
  const [id = '', intent = '', fr = '', fon = '', yo = ''] = cells.map((value) => value.trim());
  need.delete(intent);
  if (!fr || !fon || !yo) {
    console.error(`Traduction vide : ${id}`);
    process.exit(1);
  }
}

if (need.size > 0) {
  console.error(`Intentions manquantes : ${[...need].join(', ')}`);
  process.exit(1);
}

console.log(`csv ok (${data.length} phrases)`);
