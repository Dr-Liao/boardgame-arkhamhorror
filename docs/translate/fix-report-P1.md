# P1 修复记录（medium，2026-11-09）

> 依据 [`findings.json`](findings.json) 的 medium 15 条中列在 [`fix-plan.md`](fix-plan.md) §P1 的 10 项（story-0006/0007/0008/0009/0011/0012、guides-0003/0004/0005/0006、setup-0002；下表把 story-0011/0012 拆成两行）。原则同 P0：**先修生成器/展示链，再补译数据，不手改生成物**；每项都有生成器 `--check`、节点测试或复扫证据。
> 审计基线见 [`README.md`](README.md)；P0 见 [`fix-report-P0.md`](fix-report-P0.md)。

## 1. 修复总览

| # | finding | 状态 | 根因 | 落点 | 验证 |
| --- | --- | --- | --- | --- | --- |
| 1 | story-0006 | ✅ | TIC 闪回源是 HTML，含 `*…*` / `_…_` Markdown 强调；展示层在 P0 已统一由 `restoreInlineText` 剥离，但审计仍按源串计 | 展示链无需再改（`chapter-definition.js#restoreInlineText` + `flashbacks.js`）；同步扫描器口径并加回归 | `tests/tic-story-format.test.mjs`、复扫 `markdown-emphasis` 0 |
| 2 | story-0007 | ✅ | TFA 参考 zh locale 用 `{cultist}`/`{elderSign}`/`{skull}`/`{tablet}` 等花括号写混乱标记，而 `card-text.js` 只认 `[cultist]`/`[elder_sign]` | `tools/import-tfa-story.mjs#clean` 增加 `SYMBOL_TOKENS` 映射（保留补给选择器运行时插值的 `{pointsRemaining}`） | `tests/story-format-p1.test.mjs`、`import:tfa-story --check` |
| 3 | story-0008 | ✅ | TCU 隐秘之名 intro3Mystic 首段 `({mystic}):` 职阶占位未还原 | `tools/import-tcu-story.mjs#cleanText`：`({class})` → `[class]`（故事渲染器支持职阶图标 token） | `tests/story-format-p1.test.mjs`、`import:tcu-story --check` |
| 4 | story-0009 | ✅ | 结局正文段首「结局 N：」与结局面板标题重复（TCU/TDE/Dunwich/TIC 共 107 处；TDE 另含 16 段尾声） | TCU/TDE/Dunwich 在生成器映射处剥离段首标签（含补译层）；TIC 在 `chapter-definition.js#resolutions`、`resolutions.js#journal`、`flashbacks.js#story` 展示层剥离；TDE `localeKeys` 尾声同修 | `tests/story-format-p1.test.mjs`、`tests/tic-story-format.test.mjs`、复扫 `resolution-label-duplicate` 0 |
| 5 | story-0011 | ✅ | EOTE 残留英文标签与短句：P0 已清英文标签；P1 清尾声分节标题（原先回退成 `epilogue.ellsworthAndClaypool` 之类的 key） | `tools/import-eote-story.mjs`：尾声分节标题 map（埃尔斯沃思与克莱普尔/肯斯勒与辛哈/戴尔与丹佛斯/高田与曲奇/阿什瓦克） | `tests/story-format-p1.test.mjs`、`import:eote:story --check` |
| 6 | story-0012 | ✅ | EOTE 参考 locale 的 `[count]` 占位在 `campaign.records.labels` 与 `toTheForbiddenPeaks` label 中残留，渲染层无插值点 | `tools/import-eote-story.mjs#normalizeZhText`：`[count]` → `X`（可读且不冒充具体数字） | `tests/story-format-p1.test.mjs`、复扫 `marker-named-placeholder` 0 |
| 7 | guides-0003 | ✅ | 中文指南夹英文连接词（`, and` / 半角逗号）与英文标签；标签已在 P0 统一译掉，连接词未清 | `tools/import-scenario-guides.mjs#localizeZhConnectors`：`, and`→`、`、中文/`]` 后半角逗号→`、`，清理顿号后多余句点 | `tests/scenario-guides.test.mjs`、复扫 `mixed-language-word` 0 |
| 8 | guides-0004 | ✅ | 生成器整段剥掉 `<section class="encounter-sets"><img…>` 后留下「这些遭遇组以下列图标表示：」悬空句（61 份指南） | `tools/import-scenario-guides.mjs#stripEncounterIconHints`（zh/en 同口径）+ EOTE `eoteBlocks` + TIC `textBlocks`；扫描器只把「遭遇组/遭遇牌…图标…：」清单引导句计为图标句 | `tests/scenario-guides.test.mjs`、复扫 `icon-sentence-dangling` 0 |
| 9 | guides-0005 | ✅ | TDE 梦境条目 zh 只译「守卫者/探求者/…」文字，en 的 `[guardian]`/`[seeker]`/`[rogue]`/`[mystic]`/`[survivor]` token 丢失 | `tools/import-scenario-guides.mjs#restoreClassTokens`：按 en token 数量在中文职阶词后补 `（[token]）`；覆盖「神秘学家」译名 | `tests/scenario-guides.test.mjs`、`beyondTheGatesOfSleep` 五职阶 token 均存在 |
| 10 | guides-0006 | ✅ | EOTE **en 指南面板** 3 处 `[shelterValue]` 无插值点（zh 已改写为「营地庇护值」） | `tools/import-scenario-guides.mjs#eoteBlocks`：en 文本 `[shelterValue]` → `the camp's shelter value` | `tests/scenario-guides.test.mjs`、复扫 `unresolved-placeholder` 0 |
| 11 | setup-0002 | ✅ | TIC 设置正文保留 Markdown 星号、HTML 折叠、悬空「图标」句 | `chapter-definition.js#restoreInlineText`（星号/HTML 已在 P0 处理）+ `textBlocks` 删遭遇组图标悬空句、按段落拆分 | `tests/tic-story-format.test.mjs`、复扫 setup 层 `icon-sentence-dangling` 0 |

## 2. 新增/变更文件

**生成器/展示链**

- `tools/import-tfa-story.mjs`：`SYMBOL_TOKENS` 花括号 → 方括号 token 映射。
- `tools/import-tcu-story.mjs`：`({class})` → `[class]`；结局段首标签剥离（含补译层）。
- `tools/import-tde-story.mjs`：章节合集/结局/尾声段首标签剥离（含 `localeKeys.*epilogueN.body`）。
- `tools/import-dunwich-story.mjs`：结局段首中文标签剥离。
- `tools/import-eote-story.mjs`：`[count]`→`X`；尾声分节标题可读化。
- `tools/import-scenario-guides.mjs`：`stripEncounterIconHints`、`localizeZhConnectors`、`restoreClassTokens`；EOTE en `[shelterValue]` 改写。
- `content/campaigns/theInnsmouthConspiracy/chapter-definition.js` / `resolutions.js` / `flashbacks.js`：TIC 结局标签展示层剥离 + 设置/剧情图标悬空句清理。
- `docs/translate/tools/scan-story.mjs`、`scan-guides.mjs`：P1 修复后的检测口径（TIC 展示层已处理的 Markdown/结局标签按玩家可见结果判定；图标句只认遭遇组清单引导句；TFA 补给占位运行时插值豁免；TCU tarot `{name}` 运行时插值豁免）。

**测试**

- 新增 `tests/story-format-p1.test.mjs`（注册进 `tests/suites.mjs`、`tests/node-suite.mjs`）：TFA 花括号、TCU 职阶/结局标签、TDE 结局/尾声标签、Dunwich 标签、EOTE `[count]`/尾声标题。
- `tests/tic-story-format.test.mjs`：新增 Markdown、全部设置无 Markdown/HTML/悬空图标句、结局标签展示层剥离 4 条。
- `tests/scenario-guides.test.mjs`：新增英文连接词/悬空图标句/en `[shelterValue]`、TDE 职阶 token 2 条；setup 长度阈值 100→80（图标句剥离后短章节仍完整）。

## 3. 验证

- 6 个生成器 `--check` 全部通过（TFA/Dunwich/TCU/TDE/EOTE/指南）。
- 新增/更新测试：`story-format-p1` 5/5、`tic-story-format` 7/7、`scenario-guides` 11/11 通过；受影响 story/migration/replay 套件 184/188 通过（失败为 P0 报告中已说明的既有问题）。
- `npm run test:fast`：**7042/7049 通过**；4 条失败与 P0 报告一致（EOTE 发布证据产物缺失 ×2、`web/music-player.js` 既有中文词典告警、TCU scope 因既有 TCU 工作区改动漂移），均与本轮 P1 无关。
- 浏览器验收：`npx playwright test --config tests/playwright/playwright.config.mjs scenario-guides.browser.mjs` → **2/2 通过**（桌面 1440 / 移动 390 指南面板按需加载与失败重试）。
- 复扫（`docs/translate/tools/scan-*.mjs --write`，快照见 [`scan/after-fix-p1/`](scan/after-fix-p1/)）：
  - 剧情：`markdown-emphasis`、`marker-placeholder-brace`、`resolution-label-duplicate`、`marker-named-placeholder`、`label-english-label`、`untranslated`、`symbol-brace-token` 均为 **0**。
  - 指南：`icon-sentence-dangling`、`mixed-language-word`、`unresolved-placeholder`、`label-english-label` 均为 **0**；`icon-count-mismatch` 从 18 降到 9，剩余为 EOTE/Carcosa 的 token 简写差异（guides-0008 low），TDE 五职阶已补回。
  - 设置：high 0；TIC 设置不再含 Markdown/HTML/悬空图标句。
- 因内容更新而同步重采的配套生成物：`tests/fixtures/replay/tic-p8-baseline.json`（结局标签展示层改动进入状态）、`audit/tde-migration.json`（TDE story 验收证据哈希）、`audit/tde-story-acceptance.json`（TDE 生成器自动写）、`audit/tcu-migration.json`（TCU story-text 证据哈希）。

## 4. 残留说明

1. **剩余 3 条 high 是检测器对「作品内英文/引用」的误报**：TCU 序章洛夫克拉夫特作品名引用（`H. P. Lovecraft, The Dreams in the Witch House`）与 TIC 闪回 VII 的 R'lyehian 咒语转写。属 story-0016 low（英文虚词残留多为作品名引用），P1 不处理；扫描器保留 high 以便人工复核，报告中不作为未修项。
2. **setup 层 `resolution-label-duplicate` 25 处**（TFA 6 / TCU 19）来自各关 `scenario.resolutions` 的硬编码文案，设置面板不展示该字段（故事正文由 story-text 提供且已修）；属 setup 层独立问题，未列入本轮 P1 finding，留待后续统一。
3. **guides icon-count-mismatch 9 处**剩余为 `[per_investigator]`/`[auto_fail]` 等 token 简写差异（guides-0008 low），不是职阶图标缺失。
4. 简繁、标点、术语等 P2 项仍按 [`fix-plan.md`](fix-plan.md) §P2 处理。
