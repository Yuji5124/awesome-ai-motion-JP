# Awesome AI Motion JP

gongnyang による [Awesome AI Motion](https://github.com/gongnyang/awesome-ai-motion) を基にした、非公式の日本語版です。原文、slug、技法カード、参考クリップ、レシピ、出典情報を保持し、日本語の検索語と表示を追加しています。原作者による公式日本語版ではありません。

- Original project: [gongnyang/awesome-ai-motion](https://github.com/gongnyang/awesome-ai-motion)
- Original author: gongnyang
- Original work: MIT License（第三者素材には個別のライセンスが適用されます。`LICENSE` と `ATTRIBUTIONS.md` を参照してください）
- 日本語版の変更履歴: [locales/ja](locales/ja/) と [日本語版Codexスキル](SKILL.ja.md)
- 公開サイト: [yuji5124.github.io/awesome-ai-motion-JP](https://yuji5124.github.io/awesome-ai-motion-JP/)

## 開発

Node.js 20以上を使います。

```bash
npm run build
npm run check
npm run i18n:report
npm run i18n:check
npm run serve
```

`i18n:sync` は `index.json` と日本語訳カタログのIDを照合し、新規IDを追加します。既存訳はslugで保持します。原文の変更は訳側の `reviewed.sourceHash` と現在の `sourceHash` を比較して検出します。`i18n:check` は未訳項目が残る間は失敗します。自動生成の検索別名や仮訳候補は、確認済みの翻訳として数えません。

## 検索と元データ

検索では英語・韓国語の原文に加え、`locales/ja/terms.json` の日本語同義語を使います。日本語の語句は技法slug・分類から候補を絞ります。意味理解を行う検索サービスや外部APIは使いません。

技法の原文データは `index.json` にあります。日本語訳は `locales/ja/effects.json`、`recipes.json`、`routes.json`、`glossary.json` にslugまたは安定したIDで追加します。翻訳は原文を置換せず、原文ハッシュと確認済みハッシュで更新箇所を追跡します。

## ライセンス

原作者の `LICENSE` と `ATTRIBUTIONS.md` を保持しています。元プロジェクトのMIT表記は同梱されたすべての第三者素材を包括するものではありません。
