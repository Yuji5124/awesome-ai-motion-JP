import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const terms = JSON.parse(fs.readFileSync(path.join(root, 'locales/ja/terms.json'), 'utf8')).aliases;
const exact = {
  'infinite-zoom': '無限ズーム', 'deep-parallax': '多層パララックス',
  'particle-assemble': 'パーティクル集合', 'noise-dissolve': 'ノイズディゾルブ',
  'camera-flythrough': 'カメラ・フライスルー', 'morph-match-cut': 'モーフ・マッチカット',
  'overlapping-action': 'オーバーラップ動作', 'infinite-pan': '無限パン',
  'kinetic-type-sweep': 'キネティックタイポ・スイープ', 'giant-mask-reveal': '巨大マスクリビール',
  'card-flip-stack': 'カードの積み重ねと反転', 'perspective-tilt': '遠近パースの傾き',
  'shader-wipe': 'シェーダーワイプ', 'light-sweep': '光のスイープ',
  'scroll-scrub-cinema': 'スクロール連動のシネマ演出', 'ken-burns': 'ケン・バーンズ効果',
  'follow-through': 'フォロースルー', 'stagger': '時間差表示', 'easing-curves': 'イージングカーブ',
  'mask-reveal': 'マスクで表示', 'bar-grow': '棒グラフの伸長', 'next-token': '次のトークンを表示',
  'token-split': 'トークン分割', 'attention-lines': 'アテンションの線',
  'before-after': 'ビフォー・アフター', 'split-compare': '画面分割比較',
  'chapter-transition': '章の切り替え', 'chapter-interstitial': '章間タイトル',
  'title-opener': 'タイトルオープニング', 'product-demo': '製品デモ',
  'quote-card': '引用文の表示', 'data-story': 'データストーリー',
  'shorts-hook': 'ショート動画の冒頭フック', 'edu-hook': '教育動画の冒頭フック',
  'camera-follow': 'カメラ追従', 'camera-orbit': 'カメラ周回', 'camera-shake': 'カメラ揺れ',
  'particle-network': 'パーティクルネットワーク', 'particle-vortex': 'パーティクルの渦',
  'firefly-twinkle': 'ホタルのきらめき', 'film-grain': 'フィルムグレイン',
  'lower-third-reveal': 'ローワーサードの表示', 'karaoke-caption': 'カラオケ字幕',
  'chart-path-morph': 'チャートのパス変形', 'gantt-progress': 'ガントチャートの進捗表示',
  'typography-sweep': 'タイポグラフィのスイープ', 'wave-dissolve': '波形ディゾルブ',
  'hard-cut': 'ハードカット', 'jump-cut': 'ジャンプカット'
  ,'ai-principle': 'AIの原則を1カットで', 'scrolldeck-scene': 'スクロールデッキのシーン',
  'concept-explainer': '概念解説', 'chapter-transition': '章の切り替え',
  'newsletter': 'ニュースレター', 'shorts': 'ショート動画', 'video-editing': '動画編集',
  'thumbnail': 'サムネイル', 'infographic': 'インフォグラフィック', 'promo': 'プロモーション',
  'deck-and-site': 'プレゼンとWebサイト'
};
const skipped = new Set(['the', 'and', 'of', 'to', 'in', 'on', 'with', 'a', 'an', 'for', 'by', 'via']);
export function japaneseName(effect) {
  if (exact[effect.slug]) return { text: exact[effect.slug], status: 'curated' };
  const words = effect.slug.toLowerCase().split('-').filter(word => !skipped.has(word));
  const translated = words.map(word => word === '3d' ? '3D' : word === 'ui' ? 'UI' : (terms[word]?.[0] || word));
  return { text: translated.join('・') || effect.en || effect.slug, status: 'draft' };
}
