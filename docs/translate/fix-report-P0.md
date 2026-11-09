# P0 修复记录（10 条 high，2026-11-09）

> 依据 [`findings.json`](findings.json) 的 high 10 条与 [`fix-plan.md`](fix-plan.md) §P0。原则：**先修生成器/展示链，再补译数据，不手改生成物**。本记录对应的代码/内容改动均已通过各战役生成器 `--check`、节点测试与 `npm run test:fast`。
> 审计基线（修复前）见 [`README.md`](README.md) 与 `scan/`；本文件只记录 P0 的修复方式与验证证据。

## 1. 修复总览

| # | finding | 状态 | 根因 | 落点 | 验证 |
| --- | --- | --- | --- | --- | --- |
| 1 | story-0001 | ✅ | `import-tfa-story.mjs` 读的是 `heartOfTheEldersPart1/2.json`（upstream 只译了 tokens/label，正文英文），完整中文在 `heartOfTheElders.json` 的 `part1/part2`；另有 1 段 upstream 仍英文 | `tools/import-tfa-story.mjs`（按 `SOURCE_FILES` 读同一文件的两个 part）、`content/campaigns/theForgottenAge/story-supplements.json`（补译 part1.r2）、`tests/tfa-heart-of-the-elders-part1.test.mjs` | `node tools/import-tfa-story.mjs --check`、`npm run test:tfa:story`、`npm run test:tfa:scenarios` |
| 2 | story-0002 | ✅ | 参考 zh locale 的 6 条路径正文英文；中文已在指南译文里审阅过 | `content/campaigns/theCircleUndone/story-supplements.json`（6 条 finding 路径 + 2 条同根因整段英文结局）、`tools/import-tcu-story.mjs`（加载补译层并登记来源哈希） | `node tools/import-tcu-story.mjs --check`、`npm run test:tcu:story` |
| 3 | story-0003 | ✅ | TDE 3 个 choice 节点 prompt 硬编码英文 | `content/campaigns/theDreamEaters/interludes.js`（interlude1.2 / 2.1 / 3.1） | `npm run test:tde:story`、`npm run test:tde:dual` |
| 4 | story-0004 | ✅ | `textBlocks()` 把整串 HTML 折成单个字符串，故事日志只得到一个 `<p>` | `content/campaigns/theInnsmouthConspiracy/chapter-definition.js#textBlocks`（按 `<p>`/`<li>` 切成段落数组；`intro` 改为 `join('\n\n')` 保留全文） | `tests/tic-story-format.test.mjs`、TIC 节点测试 |
| 5 | story-0005 | ✅ | `flashbacks.js#story()` 未还原 i18next ICU 转义 | `content/campaigns/theInnsmouthConspiracy/chapter-definition.js#restoreInlineText`（`{'{'}cultist{'}'}`→`[cultist]`，含 elderThing/autoFail 别名）、`flashbacks.js` 复用之 | `tests/tic-story-format.test.mjs`、`tests/tic-flashbacks.test.mjs` |
| 6 | story-0010 | ✅ | 参考 zh locale 结局/导入正文段首带英文 `Resolution N:` 标签 | `tools/import-dunwich-story.mjs`、`tools/import-tfa-story.mjs`（来源换中文文件后标签已不存在）、`tools/import-eote-story.mjs#normalizeZhText`（段首英文标签剥离）；指南生成器同步把段首标签译为中文 | 各 `import:*-story --check`、对应 `test:*:story` |
| 7 | guides-0001 | ✅ | 上游 zh 指南只有条件句、缺「前往/跳至…」收尾；TDE 参考 zh locale 整段缺分支 bullet | `tools/import-scenario-guides.mjs#completeBranchTargets`（en 段落有 Proceed/Skip/Read 且 zh 无去向词时按段落补中文去向；`Otherwise` 用「；否则」连接）；TDE zh 文档改用 P8-T 自译 `story-text.js` 的 sections（与 en 同构，缺键回退参考 zh） | `node tools/import-scenario-guides.mjs --check`、`tests/scenario-guides.test.mjs`、`docs/translate/tools/scan-guides.mjs` 复扫 branch 类 0 |
| 8 | guides-0002 | ✅ | 上游 zh 指南残留整行英文 `Proceed to …` | `tools/import-scenario-guides.mjs#localizeResidualEnglish`（Proceed/Skip/Read + Setup/Intro/Scenario 目标，含 `Scenario I: The Witching Hour` → 巫异时刻） | 同上；zh 指南 `Proceed to`/`Skip to` 复扫 0 |
| 9 | guides-0007 | ✅ | 参考 zh locale 的 whereTheGodsDwell / weaverOfTheCosmos 故事块被砍掉分支 bullet，整块结构不匹配 | 同 #7 的 TDE overlay：zh 指南正文取 `content/campaigns/theDreamEaters/story-text.js` 的 sections（含完整分支收尾），保留参考 zh 缺失键（如 beyondTheGatesOfSleep.specialRules） | 同上；复扫 block-missing-in-zh 0 |
| 10 | setup-0001 | ✅ | TIC setup 由 `textBlocks()` 生成，未还原 ICU 转义 | 同 #4/#5 的 `restoreInlineText`（`{'\{'}bless{'}'}`→`[bless]`、`curse` 同理；渲染层 `renderRulesText` 认方括号 token） | `tests/tic-story-format.test.mjs`、TIC 设置节点测试 |

> 额外同根因修复：#6 的标签问题在 TIC 章节正文段首也存在（`<b>Intro 4:</b>`），统一在 `restoreInlineText` 译为「引言 4：」；指南生成器同时把 `Intro N:`/`Resolution N:`/`Scenario I:` 译为中文标签，因此 guides-0003 的英文标签候选也归零。

## 2. 新增/变更文件

**生成器（只改生成链，不手改生成物）**

- `tools/import-tfa-story.mjs`：`SOURCE_FILES` 声明每个注册关卡读哪个文件/part；新增补译层加载与哈希登记；`story-supplements.json` 内容校验（必须是中文段落数组，禁止英文句子）。
- `tools/import-tcu-story.mjs`：新增补译层加载、校验与 `story.supplements` 登记。
- `tools/import-dunwich-story.mjs`：单行正文去掉段首英文 `Intro/Resolution/No Resolution` 标签。
- `tools/import-eote-story.mjs`：`normalizeZhText()` 剥离段首英文分节标签（仅 zh 展示值）。
- `tools/import-scenario-guides.mjs`：新增 `localizeResidualEnglish()`、`completeBranchTargets()`、TDE zh 文档 overlay；生成时若 zh 正文仍留有英文去向句/去向缺失则**抛错**，避免回归。
- `docs/translate/tools/scan-guides.mjs`、`docs/translate/tools/scan-story.mjs`：修正分支检测口径（转至/转到/跳转至/推进/设置/进行等中文去向词；`nameEn/titleEn` 元数据不按正文计；TIC 已在展示层清洗的 ICU/标签/分段不再按源串重复计），并注明对应回归测试。

**内容补译/补充（玩家可见）**

- 新增 `content/campaigns/theForgottenAge/story-supplements.json`：久远腹地上篇结局 2 正文（upstream 仍英文）。
- 新增 `content/campaigns/theCircleUndone/story-supplements.json`：6 条 finding 路径 + `endings.reversedTheIncantation` / `endings.covenHoldsTheWorld` 两段整段英文结局（复用已审阅的指南译文叙事部分，去结算列表）。
- `content/campaigns/theDreamEaters/interludes.js`：3 个 prompt 中文化。
- `content/campaigns/theInnsmouthConspiracy/chapter-definition.js`、`flashbacks.js`：ICU/标签/Markdown/分段统一在展示层规范化。
- `content/campaigns/edgeOfTheEarth/locale-supplement/chapters-a.json`：补 `iceAndDeathPart1` intro4 的「找到并阅读下一栏对应段落。然后，进入冒险设置。」（上游中文截断）。
- `tests/tic-story-format.test.mjs`（新增并注册到 `tests/suites.mjs`、`tests/node-suite.mjs`）：TIC 分段、ICU、Markdown、英文标签 4 条回归。
- `tests/tfa-heart-of-the-elders-part1.test.mjs`：断言从英文 `Intro N:` 改为官方中文片段，并断言不再出现英文标签。

**生成物（由上述生成器重写，勿手改）**

- `content/campaigns/theForgottenAge/story-text.js`、`theCircleUndone/story-text.js`、`theDunwichLegacy/story-text.js`、`edgeOfTheEarth/story-text.js`、`theInnsmouthConspiracy/story-text.js`（仅 TIC 为展示层修复，未改数据）。
- `web/scenario-guides/*.json`：15 份指南更新（TDE 2 份补全整块、TFA/TCU/Dunwich/TIC 分支收尾与标签、EOTE 2 份标签/补尾）。

## 3. 验证

```sh
# 生成物一致性（全部通过）
node tools/import-tfa-story.mjs --check
node tools/import-dunwich-story.mjs --check
node tools/import-tcu-story.mjs --check
node tools/import-tde-story.mjs --check
node tools/import-eote-story.mjs --check
node tools/import-scenario-guides.mjs --check

# 节点测试（通过）
node --test tests/tfa-story.test.mjs tests/tcu-story.test.mjs tests/tde-story.test.mjs \
  tests/eote-story.test.mjs tests/scenario-guides.test.mjs tests/tic-story-format.test.mjs \
  tests/tfa-heart-of-the-elders-part1.test.mjs tests/tfa-heart-of-the-elders-part2.test.mjs
npm run test:fast
```

修复后复扫（`docs/translate/tools/scan-*.mjs --write`）结果：

| 层 | 修复前 high | 修复后 high | 说明 |
| --- | --- | --- | --- |
| 剧情 | 10 条 finding 对应候选 | 0（对应类别） | `label-english-label`/`marker-icu-escape`/`display-segmentation`/`resolution-label-untranslated` 均为 0；`untranslated` 仅剩 EOTE `epilogue.sections.*.title` 5 条元数据键名（非正文），其余 high 属 story-0007/0008/0012/cross-0001（非 P0） |
| 指南 | guides-0001/0002/0007 共 3 条 high | 0 | `branch-count-deficit`/`branch-target-missing`/`branch-instruction-missing`/`block-missing-in-zh`/`label-english-label` 均为 0；剩余 1 条 high 是 inTooDeep 的 R'lyehian 咒语（作品内转写，保留） |
| 设置 | setup-0001 | 0 | `scenario.setup` 中 ICU 转义候选 0；剩余为 setup-0002 的 Markdown/图标句等非 P0 |

补充验证（逐 finding 的 23 条 Node 断言全部通过，覆盖：TFA 两半中英文/标签、TCU 8 条路径中文、TDE 3 个 prompt、TIC 分段/ICU/标签/`[bless]`、Dunwich/EOTE 段首标签、15 份改动指南无英文去向/标签、TDE 分支收尾）。

`npm run test:fast` 结果：**7032/7039 通过**，4 条失败均为**与本轮 P0 无关的既有失败**（已在改动前复现）：

- `P8 eote all-cards …》` / `P8 eote migration ledger …`：依赖本轮未生成的发布浏览器截图/全卡证据产物，账本快照与当前工作区不一致；把本轮的 EOTE `story-text.js`/`locale-supplement` 改动暂存（stash）后同样失败。
- `已本地化的 UI 文件不再残留用户可见中文`：`web/music-player.js` 的 EOTE 曲目 `mood` 字段（既有文件、本轮未改；测试白名单未覆盖）。
- `P1 账本：scope.json 与 audit/tcu-migration.json 可复算`：TCU 工作区既有的引擎/卡牌改动使 `artifacts/migration/tcu/scope.json` 来源哈希过期（scope 来源不含本轮改动的 story-text）。

因本轮内容更新而同步重采集/重算的账本（属于配套生成物，不是手工改内容）：

- `tests/fixtures/replay/tic-p8-baseline.json`：TIC `textBlocks()` 修正后 scenario 展示文本进入状态，按测试头注释用 `node tools/replay-tic-fixtures.mjs --write` 重采，`replay-tic-p8.test.mjs` 4/4 通过。
- `tests/fixtures/replay/eote-p8-baseline.json`：EOTE intro4 补全后按既有 `regen-eote-p8-baseline.mjs`（HEAD 中的官方脚本）重采，`replay-eote-p8.test.mjs` 2/2 通过。
- `audit/tde-migration.json`：TDE 幕间 prompt 改动后按 `node tools/audit-tde.mjs --write` 重算，`tde-migration.test.mjs` 5/5 通过。
- `audit/tcu-migration.json`：TCU story-text 证据哈希随生成物更新（其余既有漂移不在本轮处理）。

浏览器验收：`npx playwright test --config tests/playwright/playwright.config.mjs scenario-guides.browser.mjs` → **2/2 通过**（桌面 1440 / 移动 390 指南面板按需加载与失败重试）。TIC 故事/闪现记忆的展示修复由 `tests/tic-story-format.test.mjs` 与 TIC 节点测试覆盖。

## 4. 修复后的口径说明与残留

1. **TIC 生成物仍保留参考 locale 的 HTML/ICU/Markdown 原串**：玩家看到的是 `textBlocks()`/`flashbacks.js` 规范化后的文本；审计扫描器对 TIC 已按展示链口径复核（新增回归测试锁定），不把源串原样重复计入。若后续要清洗源数据本身，应改 `tools/import-tic-story.mjs` 并重生成，属于独立重构。
2. **指南分支补全只补「去向词」**：`completeBranchTargets()` 只在 en 有 `Proceed/Skip/Read` 且 zh 段落没有任何中文去向词时追加「前往〈引言 N〉/跳至冒险设置…」；不会重写条件句本身。若后续上游译文改动，生成器仍会重新配对，已有去向的段落不动。
3. **TDE 指南 zh 文档来源已改为 P8-T 自译 story-text sections**：与 en locale 同构、比参考 zh 完整；`beyondTheGatesOfSleep.specialRules` 等 story-text 未覆盖的键回退参考 zh。en 面板仍读参考 en locale，未改动。
4. **补译内容是「本仓补译（非官方中文）」**：`story-supplements.json` 在生成物 `story.supplements` 里登记来源路径 + sha256；生成器校验中文段落数组，防止英文回填。
5. **不在本次 P0 范围、但在复扫中仍可见的问题**：story-0007（TFA 花括号 token）、story-0008（TCU `({mystic})`）、story-0012（EOTE `[count]`）、cross-0001（token 规范）、story-0009/story-0014/guides-0009 等 medium/low 条目仍按 [`fix-plan.md`](fix-plan.md) §P1/§P2 处理。
