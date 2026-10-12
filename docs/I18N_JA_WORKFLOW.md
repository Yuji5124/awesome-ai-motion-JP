# 日本語翻訳の進め方

翻訳の正本は `index.json`（原文）と `locales/ja/{effects,recipes,routes,glossary}.json`（slug/ID対応の日本語訳）です。`site/` は生成物なので直接編集せず、カタログを更新して `npm run build` で再生成します。

## APIなしで翻訳する

```sh
npm run i18n:status
npm run i18n:prepare -- --collection effects --size 25
```

`locales/ja/work/` に、未訳フィールドだけを含むバッチJSONが作られます。Codexは各entryの `ja` に `missingFields` 分だけを翻訳して保存します。全項目が揃ったら次で検証・適用します。

```sh
npm run i18n:apply -- locales/ja/work/effects-0001-....json
npm run build
npm run i18n:status
```

適用は一括検証してから書き込みます。日本語の欠落、原文fingerprintの不一致、既存訳の上書きがある場合は何も保存せず停止します。準備・適用・拒否は `locales/ja/work/progress.jsonl` に追記されます。作業中断後は `status` と `prepare` を実行してください。既存訳と原文が一致する項目はバッチ対象から外れ、部分訳の場合も未訳フィールドだけが出力されます。25件以外の件数も `--size` で指定できます。

`recipes`、`routes`、`glossary` も `--collection` で同じ手順を利用できます。原文変更が検出されると、そのレコードの管理対象フィールドを再翻訳候補に戻します。既存の翻訳本文は `apply` が勝手に上書きしません。人が再レビューし、明示的に更新する必要があります。

原文変更後の再翻訳を適用するときは、出力されたバッチの `staleSource: true` と原文ハッシュを確認し、明示フラグを付けます。

```sh
npm run i18n:apply -- locales/ja/work/<batch>.json --replace-stale
```

## 任意のAPIプロバイダー

APIは既定で使われず、無料利用を前提にしません。対応するOpenAI Chat Completions互換エンドポイントを利用するときだけ、別途料金・利用条件を確認した上で環境変数を設定します。

```sh
export I18N_API_PROVIDER=openai-compatible
export I18N_API_KEY='provider key'
export I18N_API_ENDPOINT='https://provider.example/v1/chat/completions'
export I18N_API_MODEL='model-name'
export I18N_MAX_API_CALLS=25
export I18N_MAX_OUTPUT_TOKENS=1200
export I18N_MAX_TOTAL_TOKENS=40000
export I18N_MAX_SPEND_USD=2.00
export I18N_INPUT_USD_PER_MILLION=...
export I18N_OUTPUT_USD_PER_MILLION=...
npm run i18n:api -- locales/ja/work/effects-0001-....json
npm run i18n:apply -- locales/ja/work/effects-0001-....translated.json
```

キーは環境変数だけから読みます。API結果は別ファイルに出し、検証を通過した場合だけ翻訳正本へ適用されます。呼び出し数・1回の最大出力・合計トークン・単価から推定する最大費用を明示し、超過見込みの場合は送信前に止めます。日本語入力のUTF-8バイト数を入力トークンの保守的な上限見積もりに使います。単価は利用providerの現行価格を設定してください。料金、データ送信条件、APIの互換性は利用者が確認してください。provider側の追加課金などを含む絶対的な請求保証ではありません。

## 進捗と完了判定

```sh
npm run i18n:status
npm run i18n:report
npm run i18n:check
```

`i18n:status` はコレクションごと・フィールドごとの件数と原文変更候補を示します。完了までは `i18n:check` は未訳項目を理由に失敗します。名前の仮訳は完全な翻訳として数えません。
