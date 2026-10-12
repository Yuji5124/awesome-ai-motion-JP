#!/usr/bin/env node
// Resumable, API-free translation queue. Codex edits the exported batch; apply validates before saving.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workDir = path.join(root, 'locales/ja/work');
const technicalKeys = new Set(['default', 'range', 'ease', 'at', 'effect', 'slug', 'id', 'url', 'license', 'runtime']);
const collections = {
  effects: { id: 'slug', fields: ['name', 'oneLiner', 'conveys', 'purposes', 'useWhen', 'goodExample', 'badExample', 'avoid', 'params', 'engines', 'prompts'] },
  recipes: { id: 'slug', fields: ['name', 'oneLiner', 'style', 'structure', 'steps', 'avoid', 'prompts'] },
  routes: { id: 'slug', fields: ['name', 'title', 'oneLiner', 'content'] },
  glossary: { id: 'id', fields: ['name', 'definition', 'params', 'avoid'] }
};
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const atomicWrite = (file, contents) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, contents, { flag: 'wx' }); fs.renameSync(temp, file); };
const hasJapanese = value => typeof value === 'string'
  ? /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value)
  : Array.isArray(value) ? value.length > 0 && value.every(hasJapanese)
    : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => !technicalKeys.has(key)).length > 0 && Object.entries(value).filter(([key]) => !technicalKeys.has(key)).every(([, v]) => hasJapanese(v))
      : false;
function sourceFor(collection) {
  const index = read(path.join(root, 'index.json'));
  return (index[collection] || []).map(item => {
    if (collection === 'glossary') return { ...item, id: `glossary-${crypto.createHash('sha1').update([item.en, item.ko, item.group, item.effect, item.src].join('\0')).digest('hex').slice(0, 12)}` };
    if (collection === 'routes') {
      const markdownPath = path.join(root, item.file || '');
      return { ...item, content: fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, 'utf8') : '' };
    }
    return item;
  });
}
function catalogFor(collection) { return read(path.join(root, `locales/ja/${collection}.json`)); }
function pendingFor(collection) {
  const spec = collections[collection];
  const source = sourceFor(collection), catalog = catalogFor(collection);
  const translations = new Map(catalog.entries.map(entry => [entry[spec.id], entry]));
  return source.map(item => {
    const id = item[spec.id], existing = translations.get(id) || { ja: {} };
    const reviewedHash = existing.reviewed?.sourceHash || existing.sourceHash;
    const stale = reviewedHash && reviewedHash !== hash(item);
    const missing = stale ? spec.fields : spec.fields.filter(field => !hasJapanese(existing.ja?.[field]));
    return { item, existing, missing, stale };
  }).filter(x => x.missing.length || x.stale);
}
function log(event) {
  fs.mkdirSync(workDir, { recursive: true });
  fs.appendFileSync(path.join(workDir, 'progress.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}
function usage() {
  console.log('Usage: node scripts/i18n/batch.mjs status | prepare [--collection effects] [--size 25] | apply <translated-batch.json> | retry | api <batch.json>');
}
const [command, ...args] = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
if (!command || command === '--help') { usage(); process.exit(0); }
if (command === 'status') {
  for (const [collection, spec] of Object.entries(collections)) {
    const source = sourceFor(collection), cat = catalogFor(collection), byId = new Map(cat.entries.map(e => [e[spec.id], e]));
    const counts = Object.fromEntries(spec.fields.map(field => [field, source.filter(item => hasJapanese(byId.get(item[spec.id])?.ja?.[field])).length]));
    const stale = source.filter(item => { const entry = byId.get(item[spec.id]); const reviewedHash = entry?.reviewed?.sourceHash || entry?.sourceHash; return reviewedHash && reviewedHash !== hash(item); }).length;
    const pending = pendingFor(collection).length;
    console.log(`${collection}: ${source.length}件 | 未完了 ${pending}件 | 原文変更要確認 ${stale}件`);
    console.log(`  ${Object.entries(counts).map(([k, v]) => `${k} ${v}/${source.length}`).join(' · ')}`);
  }
  const logPath = path.join(workDir, 'progress.jsonl');
  console.log(`進捗ログ: ${fs.existsSync(logPath) ? logPath : 'まだありません'}`);
  process.exit(0);
}
if (command === 'prepare') {
  const collection = arg('--collection', 'effects'), size = Number(arg('--size', '25'));
  if (!collections[collection] || !Number.isInteger(size) || size < 1 || size > 100) throw new Error('collection or batch size is invalid');
  const pending = pendingFor(collection), selected = pending.slice(0, size), spec = collections[collection];
  if (!selected.length) { console.log(`${collection}: 翻訳待ち項目はありません。`); process.exit(0); }
  const seq = (fs.existsSync(workDir) ? fs.readdirSync(workDir) : []).filter(f => f.startsWith(`${collection}-`) && f.endsWith('.json')).length + 1;
  const batchId = `${collection}-${String(seq).padStart(4, '0')}-${Date.now()}`;
  const batch = { schemaVersion: 1, batchId, collection, idField: spec.id, translationMode: 'codex', createdAt: new Date().toISOString(), instructions: '各entryのjaにmissingFieldsだけを自然な日本語で記入。原文を根拠にし、不明点を創作しない。識別子・パラメータ値・コード・URLは維持。出力はこのJSONのentries配列を保持して保存する。既存訳は変更しない。', entries: selected.map(({ item, existing, missing, stale }) => ({ [spec.id]: item[spec.id], sourceHash: hash(item), missingFields: missing, staleSource: !!stale, source: item, existingJa: existing.ja || {}, ja: {} })) };
  fs.mkdirSync(workDir, { recursive: true });
  const file = path.join(workDir, `${batchId}.json`);
  atomicWrite(file, `${JSON.stringify(batch, null, 2)}\n`);
  log({ type: 'prepared', batchId, collection, itemCount: selected.length, file: path.relative(root, file) });
  console.log(`Codex翻訳バッチを作成: ${path.relative(root, file)} (${selected.length}項目)`);
  console.log('翻訳後、このファイルを保存して `npm run i18n:apply -- <file>` を実行してください。');
  process.exit(0);
}
if (command === 'apply') {
  const input = args[0]; if (!input) throw new Error('翻訳済みバッチJSONを指定してください');
  const allowStaleOverwrite = args.includes('--replace-stale');
  const batchFile = path.resolve(root, input), batch = read(batchFile), spec = collections[batch.collection];
  if (batch.schemaVersion !== 1 || !spec || !Array.isArray(batch.entries)) throw new Error('Unsupported or malformed batch');
  const src = new Map(sourceFor(batch.collection).map(item => [item[spec.id], item]));
  const catalogPath = path.join(root, `locales/ja/${batch.collection}.json`), catalog = catalogFor(batch.collection);
  const dest = new Map(catalog.entries.map(entry => [entry[spec.id], entry]));
  const errors = [], applied = [];
  const seen = new Set();
  for (const row of batch.entries) {
    const id = row[spec.id], source = src.get(id), current = dest.get(id);
    if (seen.has(id)) { errors.push(`${id}: duplicated in batch`); continue; }
    seen.add(id);
    if (!source || hash(source) !== row.sourceHash) { errors.push(`${id}: 原文が変更されています。再prepareしてください`); continue; }
    if (!row.ja || typeof row.ja !== 'object') { errors.push(`${id}: ja translation object is missing`); continue; }
    for (const field of row.missingFields) {
      const value = row.ja[field];
      if (!hasJapanese(value)) { errors.push(`${id}.${field}: 日本語訳が空または日本語文字を含みません`); continue; }
      if (current?.ja?.[field] && JSON.stringify(current.ja[field]) !== JSON.stringify(value) && !(allowStaleOverwrite && row.staleSource)) { errors.push(`${id}.${field}: 保存済み訳の上書きは禁止されています (原文変更の再翻訳は --replace-stale を明示)`); continue; }
      if (field === 'params' && Array.isArray(source.params) && Array.isArray(value)) {
        if (source.params.length !== value.length || source.params.some((p, i) => p.default !== value[i]?.default || p.range !== value[i]?.range)) errors.push(`${id}.params: default/range/項目数を原文から変更しないでください`);
      }
      if (field === 'steps' && Array.isArray(source.steps) && Array.isArray(value)) {
        if (source.steps.length !== value.length || source.steps.some((step, i) => step.effect !== value[i]?.effect || step.at !== value[i]?.at)) errors.push(`${id}.steps: effect slug・at・手順数を原文から変更しないでください`);
      }
      if (Array.isArray(source[field]) && Array.isArray(value) && source[field].length !== value.length) errors.push(`${id}.${field}: 原文と配列要素数が一致しません`);
      if (['engines', 'prompts'].includes(field) && source[field] && typeof source[field] === 'object') {
        const sourceKeys = Object.keys(source[field]).sort(), translatedKeys = Object.keys(value || {}).sort();
        if (JSON.stringify(sourceKeys) !== JSON.stringify(translatedKeys)) errors.push(`${id}.${field}: 原文のキーをすべて維持してください (${sourceKeys.join(', ')})`);
      }
    }
  }
  if (errors.length) {
    log({ type: 'apply-rejected', batchId: batch.batchId, collection: batch.collection, errors });
    console.error(`保存せず停止しました (${errors.length}件):\n${errors.join('\n')}`);
    process.exit(1);
  }
  for (const row of batch.entries) {
    const id = row[spec.id], current = dest.get(id) || { [spec.id]: id, ja: {}, reviewed: {} };
    for (const field of row.missingFields) current.ja[field] = row.ja[field];
    current.sourceHash = row.sourceHash;
    const translationMode = batch.translationMode || 'codex';
    const reviewStatus = translationMode === 'api' ? 'machine-translated' : translationMode === 'codex' ? 'codex-translated' : 'human-reviewed';
    current.reviewed = { ...current.reviewed, sourceHash: row.sourceHash, status: reviewStatus, fields: [...new Set([...(current.reviewed?.fields || []), ...row.missingFields])] };
    dest.set(id, current); applied.push(id);
  }
  catalog.entries = [...dest.values()];
  atomicWrite(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  log({ type: 'applied', batchId: batch.batchId, collection: batch.collection, itemCount: applied.length, ids: applied });
  console.log(`保存しました: ${batch.collection} ${applied.length}件。翻訳データは ${path.relative(root, catalogPath)} にあります。`);
  process.exit(0);
}
if (command === 'retry') {
  if (!fs.existsSync(workDir)) { console.log('再試行項目はありません。'); process.exit(0); }
  const logPath = path.join(workDir, 'progress.jsonl');
  const history = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  const rejected = [...history].reverse().find(event => event.type === 'apply-rejected');
  if (!rejected) { console.log('失敗バッチはありません。続きは `npm run i18n:prepare` で作成できます。'); process.exit(0); }
  const spec = collections[rejected.collection], pending = pendingFor(rejected.collection), ids = new Set(rejected.errors.map(error => error.split(':', 1)[0]));
  const selected = pending.filter(row => ids.has(row.item[spec.id]));
  if (!selected.length) { console.log('失敗項目は修正済みか、原文変更により対象外です。状態確認後、必要なら `npm run i18n:prepare` を実行してください。'); process.exit(0); }
  const batchId = `${rejected.collection}-retry-${Date.now()}`;
  const batch = { schemaVersion: 1, batchId, collection: rejected.collection, idField: spec.id, createdAt: new Date().toISOString(), instructions: '失敗項目の再試行。missingFieldsだけを自然な日本語で翻訳し、既存訳と識別子・コード・URL・パラメータ値を変更しない。', entries: selected.map(({ item, existing, missing, stale }) => ({ [spec.id]: item[spec.id], sourceHash: hash(item), missingFields: missing, staleSource: !!stale, source: item, existingJa: existing.ja || {}, ja: {} })) };
  const file = path.join(workDir, `${batchId}.json`);
  atomicWrite(file, `${JSON.stringify(batch, null, 2)}\n`);
  log({ type: 'retry-prepared', batchId, collection: rejected.collection, itemCount: selected.length });
  console.log(`失敗分の再試行バッチを作成: ${path.relative(root, file)} (${selected.length}項目)`);
  process.exit(0);
}
if (command === 'api') {
  const key = process.env.I18N_API_KEY, endpoint = process.env.I18N_API_ENDPOINT, model = process.env.I18N_API_MODEL;
  const limit = Number(process.env.I18N_MAX_API_CALLS || 0), tokenCap = Number(process.env.I18N_MAX_OUTPUT_TOKENS || 0), totalTokenCap = Number(process.env.I18N_MAX_TOTAL_TOKENS || 0);
  const maxSpend = Number(process.env.I18N_MAX_SPEND_USD || 0), inputRate = Number(process.env.I18N_INPUT_USD_PER_MILLION || -1), outputRate = Number(process.env.I18N_OUTPUT_USD_PER_MILLION || -1);
  if (!key || !endpoint || !model || process.env.I18N_API_PROVIDER !== 'openai-compatible' || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(tokenCap) || tokenCap < 1 || !Number.isSafeInteger(totalTokenCap) || totalTokenCap < 1 || !Number.isFinite(maxSpend) || maxSpend <= 0 || !Number.isFinite(inputRate) || inputRate < 0 || !Number.isFinite(outputRate) || outputRate < 0) throw new Error('API翻訳は停止しました。I18N_API_PROVIDER=openai-compatible、I18N_API_KEY、I18N_API_ENDPOINT、I18N_API_MODEL、I18N_MAX_API_CALLS、I18N_MAX_OUTPUT_TOKENS、I18N_MAX_TOTAL_TOKENS、I18N_MAX_SPEND_USD、I18N_INPUT_USD_PER_MILLION、I18N_OUTPUT_USD_PER_MILLIONを明示してください。');
  const input = args[0]; if (!input) throw new Error('API翻訳に使うバッチJSONを指定してください');
  const batch = read(path.resolve(root, input));
  if (!Array.isArray(batch.entries) || batch.entries.length > limit) throw new Error(`バッチ項目数が呼び出し上限 ${limit} を超えています`);
  batch.translationMode = 'api';
  let spentTokens = 0, reservedTokens = 0, projectedSpend = 0;
  for (const row of batch.entries) {
    const prompt = `韓国語のモーション技法データを、映像/Webアニメーション制作者向けの自然な日本語に翻訳します。原文にない情報を作らないでください。slug、コード、URL、パラメータの default/range はそのまま保ってください。missingFieldsの値だけを含むJSONオブジェクトを返してください。\n${JSON.stringify({ missingFields: row.missingFields, source: row.source })}`;
    // UTF-8 bytes are a conservative upper bound for input token reservation.
    const reserve = Buffer.byteLength(prompt, 'utf8') + tokenCap;
    const inputBytes = reserve - tokenCap;
    const nextSpend = projectedSpend + (inputBytes / 1_000_000) * inputRate + (tokenCap / 1_000_000) * outputRate;
    if (reservedTokens + reserve > totalTokenCap || nextSpend > maxSpend) throw new Error(`利用上限に達する見込みのため、${row[batch.idField]}のAPI呼び出し前に停止しました。使用量上限または翻訳バッチを調整してください。`);
    reservedTokens += reserve;
    projectedSpend = nextSpend;
    const response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, temperature: 0, max_tokens: tokenCap, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }) });
    if (!response.ok) throw new Error(`API request failed (${response.status}); batch file remains unchanged`);
    const payload = await response.json(); spentTokens += Number(payload.usage?.total_tokens || 0);
    if (spentTokens > totalTokenCap) throw new Error('Token budget exceeded; no translation file was changed');
    const content = payload.choices?.[0]?.message?.content;
    try { row.ja = JSON.parse(content); } catch { throw new Error(`Provider returned invalid JSON for ${row[batch.idField]}; batch file remains unchanged`); }
  }
  const output = path.resolve(root, input.replace(/\.json$/i, '.translated.json'));
  atomicWrite(output, `${JSON.stringify(batch, null, 2)}\n`);
  log({ type: 'api-translated', batchId: batch.batchId, provider: 'openai-compatible', calls: batch.entries.length, totalTokens: spentTokens, reservedTokenCeiling: reservedTokens, estimatedSpendUsd: Number(projectedSpend.toFixed(8)), maxSpendUsd: maxSpend });
  console.log(`API翻訳結果を ${path.relative(root, output)} に書きました。検証・反映には別途 i18n:apply を実行してください。設定単価による保守的な見積もり: $${projectedSpend.toFixed(4)} / 上限 $${maxSpend.toFixed(4)}。実請求はproviderの料金体系に従います。`);
  process.exit(0);
}
usage(); process.exitCode = 2;
