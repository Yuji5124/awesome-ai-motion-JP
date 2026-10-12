#!/usr/bin/env node
// Preserve translations by slug; add new upstream records and refresh source fingerprints.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { japaneseName } from './names.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const hash = item => crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex');
const glossaryId = item => `glossary-${crypto.createHash('sha1').update([item.en, item.ko, item.group, item.effect, item.src].join('\0')).digest('hex').slice(0, 12)}`;
const reviewedJa = {
  recipes: {
    'ai-principle': { oneLiner: 'トークンを分割して参照関係を示し、次の語を選ぶまでを1文で描く。', style: 'AIの原理を説明する教育動画', structure: 'トークン分割 → アテンション線を描画 → 次の語を選択' },
    'before-after': { oneLiner: '変更前後を並べ、変更後の数値と差を表す語句を順に強調する。', style: '製品の改善点を比較するプレゼンやデータ動画', structure: '画面分割比較 → 変更後の数値をカウントアップ → 差を表す語句を強調' },
    'concept-explainer': { oneLiner: 'タイトルと3段階の図解を順に見せ、中心となるモデルへ視線を集める。', style: 'AIの原理を1つのシーンで説明する教育動画', structure: 'タイトルに強弱をつけて登場 → 入力・モデル・出力を順に表示 → モデルをスポットライトで強調' },
    'chapter-transition': { oneLiner: 'インク色の章番号カードをはさみ、次章の冒頭シーンへつなぐ。', style: '教育動画やプレゼンの章間の切り替え', structure: '前のシーン → インク色の「02」カードへワイプ → 章タイトルを表示 → 0.45秒保持 → 円形マスクで次章へ' },
    'data-story': { oneLiner: '結論となる数値を示してから、候補ごとの確率とその読み取り方を説明する。', style: '数値の結論を先に示すデータ解説動画', structure: '62%までカウントアップ → 候補の確率バーを伸ばす → 最も高い確率に注釈を添える' },
    'product-demo': { oneLiner: '実際のUI操作に沿って、質問の入力からモデルの応答までを見せる。', style: 'AI製品への入力から応答までを見せる製品デモ', structure: '質問をタイプ入力 → カーソルでクリック → 回答をストリーミング表示 → 回答の要点を拡大' },
    'quote-card': { oneLiner: '2行の引用文を表示し、要点となる一節と出典を順に示す。', style: '引用文と要点を伝える解説動画', structure: '行ごとにマスク表示 → 要点をハイライト → 出典への引き出し線を描く' },
    'scrolldeck-scene': { oneLiner: '登場・保持・退場を、スクロール進捗の3区間で見せる。', style: 'スクロールデッキの1シーンを設計する教育動画', structure: 'スタッガーとマスクで登場 → 保持中にハイライト → 全体をフェードして上へ退場' },
    'shorts-hook': { oneLiner: '最初の1秒で3語のフックを見せ、次の場面へズームし、数値と結論で締める。', style: '縦型ショート動画の冒頭フックと主要指標', structure: 'キネティック文字を3拍で表示 → Oの中へズームして転換 → 939までカウントアップして結論を表示' },
    'title-opener': { oneLiner: '2行タイトルと副題のリズムで始め、要点の語句に下線を引く。', style: '教育動画の冒頭4秒や短いタイポグラフィのオープニング', structure: '2行タイトルをマスク表示 → 副題を文字ごとにずらして表示 →「次の語」に下線を描く' },
    'edu-hook': { oneLiner: '問いで興味を引き、要点・学習の流れ・学ぶ概念を5秒以内に示す。', style: '教育・解説動画の横長オープニング5秒', structure: '問いを表示 → 要点の語句を強調 → 学習の流れを示す → 学習目標に下線を引く' }
  },
  routes: {
    newsletter: { title: 'ニュースレター・ブログ本文でのモーション活用ガイド', oneLiner: '本文の流れと読者の理解を優先し、記事間の図解・短いGIF・UIデモ・データ比較に使う技法を選びます。' },
    infographic: { title: 'インフォグラフィックのモーション活用ガイド', oneLiner: '静止画・動画インフォグラフィックで、データや注釈、前後比較を強調し、Web掲載へつなげます。' },
    thumbnail: { title: 'サムネイル制作ガイド', oneLiner: '動画サムネイル、講座一覧カード、シリーズカバーに使う静止画の見せ方を選びます。' },
    'video-editing': { title: '解説・講義動画の編集とモーション活用ガイド', oneLiner: 'カットのリズム、画面転換、字幕、画面操作、図解アニメーション、ナレーション同期に使う技法を選びます。' },
    promo: { title: '製品紹介・プロモーション動画の制作ガイド', oneLiner: '製品紹介、ローンチ予告、フック、製品リビール、ロゴ演出、CTAを動画のビートに配置します。' },
    shorts: { title: 'ショート動画・リールのモーション活用ガイド', oneLiner: '9:16縦型動画の冒頭1秒で視線をつかみ、テンポよく韓国語字幕を見せる技法を選びます。' },
    'deck-and-site': { title: 'プレゼン資料とWebサイトのモーション活用ガイド', oneLiner: 'スクロールデッキ、Webサイト、Webベースの体験UIに適した技法を選びます。' }
  }
};
for (const [key, idKey] of [['effects', 'slug'], ['recipes', 'slug'], ['routes', 'slug'], ['glossary', 'id']]) {
  const dest = path.join(root, `locales/ja/${key}.json`);
  const previous = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, 'utf8')) : { schemaVersion: 1, entries: [] };
  const previousEntries = previous.entries || previous.effects || [];
  const known = new Map(previousEntries.filter(entry => entry[idKey]).map(entry => [entry[idKey], entry]));
  const migrated = new Set();
  const sourceItems = (source[key] || []).map(item => key === 'glossary' ? { ...item, id: glossaryId(item) } : item);
  const sourceIds = new Set(sourceItems.map(item => item[idKey]));
  const entries = sourceItems.map(item => {
    const id = item[idKey];
    let current = known.get(id);
    if (!current && key === 'glossary') {
      const index = previousEntries.findIndex((entry, i) => !migrated.has(i) && !entry.id && entry.en === item.en);
      if (index >= 0) { migrated.add(index); current = previousEntries[index]; }
    }
    current ||= { [idKey]: id, ja: {}, reviewed: {} };
    const sourceHash = hash(item);
    const title = ['effects', 'recipes', 'routes'].includes(key) ? japaneseName(item) : null;
    const ja = { ...current.ja };
    const reviewed = { ...current.reviewed };
    const prose = reviewedJa[key]?.[item.slug];
    if (prose) {
      for (const [field, translation] of Object.entries(prose)) if (!ja[field]) ja[field] = translation;
      reviewed.sourceHash = sourceHash;
      reviewed.fields = [...new Set([...(reviewed.fields || []), ...Object.keys(prose)])];
    }
    if (title?.status === 'curated' && !ja.name) {
      ja.name = title.text;
      reviewed.sourceHash = sourceHash;
      reviewed.fields = [...new Set([...(reviewed.fields || []), 'name'])];
    }
    return { ...current, [idKey]: id, ja, reviewed, sourceHash };
  });
  for (const old of previousEntries) if (old[idKey] && !sourceIds.has(old[idKey])) entries.push(old);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify({ schemaVersion: 1, sourceRepository: 'gongnyang/awesome-ai-motion', entries }, null, 2)}\n`);
  console.log(`${key}: ${entries.length}件をslug/IDで同期。既存の日本語訳は保持しました。`);
}
