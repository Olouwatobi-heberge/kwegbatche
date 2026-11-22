import { unzipSync } from 'fflate';

const base = (process.argv[2] || 'http://127.0.0.1:3456').replace(/\/$/, '');
const burstOnly = process.argv.includes('--burst');
const CLIENT = { 'X-Kwegbatche-Client': 'web' };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wav(seconds = 0.6, frequency = 440) {
  const sampleRate = 16000;
  const count = Math.floor(sampleRate * seconds);
  const data = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i += 1) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.2;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sample * 32767))), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function cookieHeader(response) {
  const list = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  return list.map((item) => item.split(';')[0]).join('; ');
}

async function upload({ phraseId, language, speakerCode, extra = {}, file, type = 'audio/wav', name = 'prise.wav' }) {
  const body = new FormData();
  body.set('audio', new File([file], name, { type }));
  body.set('language', language);
  body.set('phraseId', phraseId);
  body.set('speakerCode', speakerCode);
  body.set('gender', extra.gender ?? '');
  body.set('ageRange', extra.ageRange ?? '');
  body.set('consent', extra.consent ?? 'yes');
  body.set('durationMs', String(extra.durationMs ?? 800));
  body.set('societe', extra.societe ?? '');
  const headers = { ...CLIENT, ...(extra.headers ?? {}) };
  return fetch(`${base}/api/recordings`, { method: 'POST', headers, body });
}

async function burst() {
  let saw = 0;
  for (let i = 0; i < 80; i += 1) {
    const response = await upload({
      phraseId: 'nope',
      language: 'fr',
      speakerCode: `bot${i}`,
      file: wav(0.4, 220),
    });
    if (response.status === 429) {
      saw += 1;
      break;
    }
  }
  assert(saw === 1, 'le quota par IP ne répond pas 429');
  console.log('burst ok');
}

async function main() {
  if (burstOnly) {
    await burst();
    return;
  }

  const health = await fetch(`${base}/api/health`);
  const healthBody = await health.json();
  assert(health.ok && healthBody.storage === 'local', 'stockage local attendu');

  const home = await fetch(`${base}/`);
  const html = await home.text();
  assert(home.ok, 'accueil en erreur');
  assert(html.includes('Pas de nom complet'), 'texte d’accueil absent');
  assert(html.includes('og:title'), 'balise Open Graph absente');
  assert(!html.includes('ADMIN_CODE'), 'le code admin ne doit pas être dans la page');

  const noHeader = await fetch(`${base}/api/recordings`, { method: 'POST', body: new FormData() });
  assert(noHeader.status === 400, `sans en-tête client : ${noHeader.status}`);

  const cross = await fetch(`${base}/api/recordings`, {
    method: 'POST',
    headers: { ...CLIENT, Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
    body: new FormData(),
  });
  assert(cross.status === 403, `requête externe : ${cross.status}`);

  const sample = wav();
  const first = await upload({
    phraseId: 'solde_01',
    language: 'fon',
    speakerCode: 'loc-testa',
    file: sample,
    extra: { gender: 'femme', ageRange: '26-35' },
  });
  const firstBody = await first.json();
  assert(first.status === 200 && firstBody.id && firstBody.id !== '0', 'premier envoi refusé');

  const oldGender = await upload({
    phraseId: 'solde_02',
    language: 'fr',
    speakerCode: 'loc-testa',
    file: sample,
    extra: { gender: 'autre' },
  });
  assert(oldGender.status === 400, `sexe retiré encore accepté : ${oldGender.status}`);

  const unspecified = await upload({
    phraseId: 'solde_03',
    language: 'fon',
    speakerCode: 'loc-testa',
    file: sample,
    extra: { gender: 'non_dit' },
  });
  assert(unspecified.status === 400, `option retirée encore acceptée : ${unspecified.status}`);

  const blankGender = await upload({
    phraseId: 'solde_04',
    language: 'yoruba',
    speakerCode: 'loc-testa',
    file: sample,
    extra: { gender: '' },
  });
  assert(blankGender.status === 200, `sexe vide refusé : ${blankGender.status}`);

  const second = await upload({
    phraseId: 'conf_02',
    language: 'fr',
    speakerCode: 'loc-testb',
    file: wav(0.5, 660),
  });
  const secondBody = await second.json();
  assert(second.status === 200 && secondBody.id, 'second envoi refusé');

  const trap = await upload({
    phraseId: 'solde_02',
    language: 'fr',
    speakerCode: 'loc-trap',
    file: sample,
    extra: { societe: 'https://spam.example' },
  });
  const trapBody = await trap.json();
  assert(trap.status === 200 && trapBody.ok === true, 'piège mal géré');

  const fake = await upload({
    phraseId: 'solde_03',
    language: 'fr',
    speakerCode: 'loc-fake',
    file: Buffer.from('ceci nest pas un audio valide du tout'),
    type: 'audio/wav',
    name: 'note.wav',
  });
  assert(fake.status === 400, `mime audio : ${fake.status}`);

  const noConsent = await upload({
    phraseId: 'solde_04',
    language: 'fr',
    speakerCode: 'loc-testa',
    file: sample,
    extra: { consent: 'no' },
  });
  assert(noConsent.status === 400, 'consentement non exigé');

  const tooLong = await upload({
    phraseId: 'solde_05',
    language: 'fr',
    speakerCode: 'loc-testa',
    file: sample,
    extra: { durationMs: 60000 },
  });
  assert(tooLong.status === 400, 'durée non limitée');

  const unknown = await upload({
    phraseId: 'introuvable',
    language: 'fr',
    speakerCode: 'loc-testa',
    file: sample,
  });
  assert(unknown.status === 400, 'phrase inconnue acceptée');

  const heavy = new Uint8Array(2_200_000);
  heavy.set(sample.subarray(0, 44), 0);
  const heavyRes = await upload({
    phraseId: 'solde_06',
    language: 'fr',
    speakerCode: 'loc-heavy',
    file: heavy,
  });
  assert(heavyRes.status === 413 || heavyRes.status === 400, `fichier lourd : ${heavyRes.status}`);

  const badLogin = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CLIENT },
    body: JSON.stringify({ code: 'pas-le-bon-code' }),
  });
  assert(badLogin.status === 401, 'mauvais code accepté');

  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CLIENT },
    body: JSON.stringify({ code: process.env.ADMIN_CODE || 'test-admin-code' }),
  });
  const cookie = cookieHeader(login);
  assert(login.status === 200 && cookie.includes('kgb_admin='), 'connexion admin refusée');

  const listRes = await fetch(`${base}/api/admin/recordings?status=`, { headers: { ...CLIENT, Cookie: cookie } });
  const list = await listRes.json();
  assert(listRes.status === 200, 'liste admin refusée');
  const ids = new Set(list.recordings.map((row) => row.id));
  assert(ids.has(firstBody.id), 'premier enregistrement absent');
  assert(ids.has(secondBody.id), 'second enregistrement absent');
  assert(!list.recordings.some((row) => row.speakerCode === 'loc-trap'), 'le piège a été stocké');
  const fon = list.recordings.find((row) => row.id === firstBody.id);
  assert(fon.language === 'fon' && fon.fallbackFr === false, 'la traduction fon devrait être utilisée');
  assert(fon.sentence.includes('ɖ'), 'phrase fon absente');
  assert(list.stats.byLanguage.fon.total >= 1, 'compteur fon manquant');
  assert(list.stats.bySpeaker.some((row) => row.speakerCode === 'loc-testa'), 'compteur locuteur manquant');

  const keep = await fetch(`${base}/api/admin/recordings/${firstBody.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...CLIENT, Cookie: cookie },
    body: JSON.stringify({ status: 'keep' }),
  });
  assert(keep.status === 200, 'garder a échoué');

  const reject = await fetch(`${base}/api/admin/recordings/${secondBody.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...CLIENT, Cookie: cookie },
    body: JSON.stringify({ status: 'reject' }),
  });
  assert(reject.status === 200, 'rejeter a échoué');

  const csvRes = await fetch(`${base}/api/admin/export?format=csv`, { headers: { Cookie: cookie } });
  const csv = await csvRes.text();
  assert(csvRes.status === 200, 'export csv refusé');
  assert(csv.includes('loc-testa') && csv.includes('solde_01'), 'csv incomplet');
  assert(csv.includes('fallback_fr') && csv.includes('false'), 'colonne fallback_fr absente');
  assert(!csv.includes('loc-testb'), 'le rejet est dans le csv');
  assert(csv.includes('file_path'), 'colonnes csv absentes');

  const jsonlRes = await fetch(`${base}/api/admin/export?format=jsonl`, { headers: { Cookie: cookie } });
  const jsonl = await jsonlRes.text();
  const row = JSON.parse(jsonl.trim().split('\n')[0]);
  assert(row.speaker_code === 'loc-testa' && row.status === 'keep' && row.fallback_fr === 'false', 'jsonl inattendu');

  const zipRes = await fetch(`${base}/api/admin/export?format=zip`, { headers: { Cookie: cookie } });
  assert(zipRes.status === 200, 'export zip refusé');
  const unzipped = unzipSync(new Uint8Array(await zipRes.arrayBuffer()));
  const manifestName = Object.keys(unzipped).find((name) => name.endsWith('manifest.csv'));
  assert(manifestName, 'manifest absent du zip');
  const manifest = new TextDecoder().decode(unzipped[manifestName]);
  assert(manifest.includes('loc-testa') && !manifest.includes('loc-testb'), 'zip mal filtré');
  const audioName = Object.keys(unzipped).find((name) => name.endsWith('.wav'));
  assert(audioName, 'audio absent du zip');
  assert(Buffer.from(unzipped[audioName]).subarray(0, 4).toString() === 'RIFF', 'wav invalide');

  const audioRes = await fetch(`${base}/api/admin/audio/${firstBody.id}`, { headers: { Cookie: cookie } });
  const audioBytes = Buffer.from(await audioRes.arrayBuffer());
  assert(audioRes.status === 200 && audioBytes.subarray(0, 4).toString() === 'RIFF', 'lecture audio refusée');

  await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: CLIENT, Cookie: cookie });
  const locked = await fetch(`${base}/api/admin/recordings`, { headers: CLIENT });
  assert(locked.status === 401, 'la session n’est pas fermée');

  console.log('e2e ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
