# FHV P7 中文自译层契约（story-source）

参考工程没有《铁杉谷盛宴》中文 locale，因此指南/剧情正文的中文来自本仓库自译层：

- 目录：`content/campaigns/theFeastOfHemlockVale/story-source/`
- 输入（只读）：`参考资源/ArkhamHorror-main/frontend/src/locales/en/theFeastOfHemlockVale/<file>`
- 生成：`node tools/import-fhv-story.mjs --write` 把 `story-source/**` 深合并进 `story-text.js`；
  `node tools/check-fhv-translations.mjs` 校验覆盖（每个英文叶子必须有一个含中文的译叶）。

## 分片

| 输出文件 | 来源文件 | 顶层键（只写这些键，结构与 en 同构） |
| --- | --- | --- |
| `base.part1.json` | `base.json` | `prelude` |
| `base.part2.json` | `base.json` | `prelude1`, `prelude2` |
| `base.part3.json` | `base.json` | `prelude3`, `prelude4` |
| `base.part4.json` | `base.json` | `key`, `specialRules`, `epilogue`, `additionalRulesAndClarifications`, `newKeywords` |
| `base.part5.json` | `base.json` | `prologue`, `campaignLog`, `fatigue`, `headings`, `remembered`, `label`, `tooltips`, `tokens` |
| `writtenInRock.json` | `writtenInRock.json` | 整个文件 |
| `hemlockHouse.json` | `hemlockHouse.json` | 整个文件 |
| `theSilentHeath.json` | `theSilentHeath.json` | 整个文件 |
| `theLostSister.json` | `theLostSister.json` | 整个文件 |
| `theThingInTheDepths.json` | `theThingInTheDepths.json` | 整个文件 |
| `theTwistedHollow.json` | `theTwistedHollow.json` | 整个文件 |
| `theLongestNight.json` | `theLongestNight.json` | 整个文件 |
| `fateOfTheVale.json` | `fateOfTheVale.json` | 整个文件 |

## 翻译规则（必须逐条遵守）

1. **同构**：输出的嵌套对象/数组结构与英文完全一致；只把字符串叶子换成中文。
   不可增删键、不可改数组长度、不可把对象改成字符串。
2. **保留标记原样**：HTML 标签（`<b> <i> <p> <blockquote> <section class="encounter-sets"> <img …>`）、
   游戏 token（`[action] [fast] [reaction] [willpower] [agility] [skull] [cultist] [tablet] [elder_thing]
   [auto_fail] [per_player] [guardian] [survivor]` 等）、占位符（`{xp} {name} {key} {perPlayer}
   {shelterValue} {fast}`）、引用（`@:…`）与换行结构保持不变。
3. **术语一致**：卡名/地点名/敌人名/幕名/议程名用本仓库卡表中文（`src/cards/cards-data.js` 的
   `nameZh/textZh`；可用 `node` 一行查询）；关键词（警戒/巡逻/猎手/冷漠/庞大/反击/涌动/危殆/报复/潜行等）、
   居民/关系等级/传家宝/法典/未花费经验/勘察/整备等用本循环 `docs/campaign/theFeastOfHemlockVale/rulebook.md`
   与 `content/campaigns/theFeastOfHemlockVale/keywords.js` 的既有译法。
4. **完整**：不得留英文占位、不得省略句子、不得写「TODO」；每个叶子都要是可读中文（纯数字/符号叶子可原样）。
5. 只写自己负责的输出文件；不改其它目录/文件；不跑构建、审计或测试之外的工具。
6. 自检：`node tools/check-fhv-translations.mjs --file <file>`（只看自己的来源文件）；
   输出 JSON `{"file","part","leaves":N,"translated":N,"gaps":[]}`。

## 校验口径

- 每个英文叶子 key 在合并后的中文树中必须存在且含 CJK 字符；结构类型一致。
- 指南生成器会读取合并结果；缺译叶子会进入 `chineseGaps` 并阻断 P7 指南门禁。
