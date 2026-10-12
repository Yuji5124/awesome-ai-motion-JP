#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const hash = item => crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex');
const glossaryId = item => `glossary-${crypto.createHash('sha1').update([item.en, item.ko, item.group, item.effect, item.src].join('\0')).digest('hex').slice(0, 12)}`;
const file = path.join(root, 'locales/ja/effects.json');
const catalog = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { entries: [] };
const translations = new Map((catalog.entries || []).map(effect => [effect.slug, effect]));
const fields = ['name', 'oneLiner', 'conveys', 'useWhen', 'goodExample', 'badExample', 'avoid', 'params', 'engines', 'prompts'];
const stats = Object.fromEntries(fields.map(field => [field, { translated: 0, total: source.effects.length }]));
const missingIds = [], extraIds = [], stale = [];
const untranslatedNames = [], untranslatedSummaries = [], untranslatedPrompts = [], duplicateIds = [];
const hasJa = value => {
  if (typeof value === 'string') return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value.trim());
  if (Array.isArray(value)) return value.length > 0 && value.every(hasJa);
  if (value && typeof value === 'object') {
    const technical = new Set(['default', 'range', 'ease', 'at', 'effect', 'slug', 'id', 'url', 'license', 'runtime']);
    return Object.keys(value).length > 0 && Object.entries(value).every(([key, child]) => technical.has(key) || hasJa(child));
  }
  return false;
};
for (const effect of source.effects) {
  const localized = translations.get(effect.slug);
  if (!localized) { missingIds.push(effect.slug); untranslatedNames.push(effect.slug); untranslatedSummaries.push(effect.slug); untranslatedPrompts.push(effect.slug); continue; }
  if (localized.reviewed?.sourceHash && hash(effect) !== localized.reviewed.sourceHash) stale.push(effect.slug);
  for (const field of fields) if (hasJa(localized.ja?.[field])) stats[field].translated++;
  if (!hasJa(localized.ja?.name)) untranslatedNames.push(effect.slug);
  if (!hasJa(localized.ja?.oneLiner)) untranslatedSummaries.push(effect.slug);
  if (!hasJa(localized.ja?.prompts)) untranslatedPrompts.push(effect.slug);
}
const sourceSlugs = new Set(source.effects.map(effect => effect.slug));
const translatedIds = new Set();
for (const effect of catalog.entries || []) {
  if (!sourceSlugs.has(effect.slug)) extraIds.push(effect.slug);
  if (translatedIds.has(effect.slug)) duplicateIds.push(effect.slug);
  translatedIds.add(effect.slug);
}
const names = stats.name.translated;
console.log(`技法: ${source.effects.length}件 | 日本語名: ${names}/${source.effects.length} (${(100 * names / source.effects.length).toFixed(1)}%)`);
for (const [field, count] of Object.entries(stats)) console.log(`${field}: ${count.translated}/${count.total}`);
console.log(`翻訳データ未作成: ${missingIds.length} | 原文にないslug: ${extraIds.length} | 原文変更の要確認: ${stale.length}`);
if (missingIds.length) console.log(`未作成slug: ${missingIds.join(', ')}`);
if (extraIds.length) console.log(`余分なslug: ${extraIds.join(', ')}`);
if (stale.length) console.log(`原文変更: ${stale.join(', ')}`);
if (duplicateIds.length) console.log(`重複slug: ${duplicateIds.join(', ')}`);
if (untranslatedNames.length) console.log(`未訳の技法名 (${untranslatedNames.length}): ${untranslatedNames.join(', ')}`);
if (untranslatedSummaries.length) console.log(`未訳の要約 (${untranslatedSummaries.length}): ${untranslatedSummaries.join(', ')}`);
if (untranslatedPrompts.length) console.log(`未訳のプロンプト (${untranslatedPrompts.length}): ${untranslatedPrompts.join(', ')}`);
let incomplete = false;
for (const [key, idKey, fields] of [
  ['recipes', 'slug', ['name', 'oneLiner', 'style', 'structure', 'steps', 'avoid', 'prompts']],
  ['routes', 'slug', ['name', 'title', 'oneLiner', 'content']],
  ['glossary', 'id', ['name', 'definition', 'params', 'avoid']]
]) {
  const input = (source[key] || []).map(item => {
    if (key === 'glossary') return { ...item, id: glossaryId(item) };
    if (key === 'routes') {
      const markdown = path.join(root, item.file || '');
      return { ...item, content: fs.existsSync(markdown) ? fs.readFileSync(markdown, 'utf8') : '' };
    }
    return item;
  });
  const translationPath = path.join(root, `locales/ja/${key}.json`);
  const data = fs.existsSync(translationPath) ? JSON.parse(fs.readFileSync(translationPath, 'utf8')) : { entries: [] };
  const indexed = new Map((data.entries || []).map(item => [item[idKey], item]));
  const count = input.filter(item => indexed.has(item[idKey])).length;
  const misses = fields.reduce((sum, field) => sum + input.filter(item => hasJa(indexed.get(item[idKey])?.ja?.[field])).length, 0);
  console.log(`${key}: ${input.length}件 | 翻訳レコード ${count}/${input.length} | 主要項目 ${misses}/${input.length * fields.length}`);
  const ids = new Set();
  for (const entry of data.entries || []) {
    if (ids.has(entry[idKey])) duplicateIds.push(`${key}:${entry[idKey]}`);
    ids.add(entry[idKey]);
    const sourceItem = input.find(item => item[idKey] === entry[idKey]);
    if (sourceItem && entry.reviewed?.sourceHash && entry.reviewed.sourceHash !== hash(sourceItem)) stale.push(`${key}:${entry[idKey]}`);
  }
  const sourceIds = new Set(input.map(item => item[idKey]));
  const orphans = (data.entries || []).filter(item => !sourceIds.has(item[idKey])).map(item => item[idKey]);
  if (orphans.length) { extraIds.push(...orphans.map(id => `${key}:${id}`)); console.log(`${key}に余分なID: ${orphans.join(', ')}`); }
  if (count !== input.length || misses !== input.length * fields.length) incomplete = true;
}
if (duplicateIds.length) console.log(`翻訳の重複ID: ${duplicateIds.join(', ')}`);
if (process.argv.includes('--check') && (missingIds.length || extraIds.length || stale.length || duplicateIds.length || names !== source.effects.length || Object.values(stats).some(value => value.translated !== value.total) || incomplete)) process.exitCode = 1;
