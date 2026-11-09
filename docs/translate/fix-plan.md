# 修复计划（按 finding 的优先级）

> 依据 [`findings.json`](findings.json) 与 [`README.md`](README.md) §3/§4。原则：**先修生成器/展示链，再补译数据，最后做一致性清理**；改完必须走各战役既有的 `import:*-story --check` / `import-scenario-guides` / `test:*` 门禁，不手改生成物。
> **2026-11-09：P0（10 条 high）与 P1（10 项 medium）已修复 ✅**，实现、落点与验证证据见 [`fix-report-P0.md`](fix-report-P0.md)、[`fix-report-P1.md`](fix-report-P1.md)；P2 仍待执行。

## P0 · 英文进中文界面 / 玩家读不懂（10 条 high，已修复 ✅）

| # | finding | 动作 | 落点 | 验证 |
| --- | --- | --- | --- | --- |
| 1 | story-0001 | ✅ 生成器改读 `heartOfTheElders.json` 的 `part1/part2` 中文；上篇 r2 补译并登记哈希 | `tools/import-tfa-story.mjs`、`content/campaigns/theForgottenAge/story-supplements.json`、`tests/tfa-heart-of-the-elders-part1.test.mjs` | `node tools/import-tfa-story.mjs --check`、`npm run test:tfa:story`、`npm run test:tfa:scenarios` |
| 2 | story-0002 | ✅ 新增 TCU 补译层（6 条 finding 路径 + 2 段同根因英文结局），从已审阅指南译文提取叙事正文 | `content/campaigns/theCircleUndone/story-supplements.json`、`tools/import-tcu-story.mjs` | `npm run import:tcu-story -- --check`、`npm run test:tcu:story` |
| 3 | story-0003 | ✅ 三个 TDE choice 节点 prompt 本地化 | `content/campaigns/theDreamEaters/interludes.js` | `npm run test:tde:story`、`npm run test:tde:dual` |
| 4 | story-0004 | ✅ `textBlocks()` 按 `<p>`/`<li>` 切段；intro 保留全文 | `content/campaigns/theInnsmouthConspiracy/chapter-definition.js` | `tests/tic-story-format.test.mjs`、`npm run test:tic` |
| 5 | story-0005 | ✅ ICU 转义 `{'{'}x{'}'}`→`[x]` 统一在 `restoreInlineText`/`flashbacks.js` 还原 | `content/campaigns/theInnsmouthConspiracy/chapter-definition.js`、`flashbacks.js` | `tests/tic-story-format.test.mjs`、`npm run test:tic:interactions` |
| 6 | story-0010 | ✅ Dunwich/TFA/EOTE 来源换中文文件或剥离段首英文标签；指南生成器同步译标签 | `tools/import-dunwich-story.mjs`、`tools/import-tfa-story.mjs`、`tools/import-eote-story.mjs`、`tools/import-scenario-guides.mjs` | 各 `import:*-story --check`、对应 `test:*:story` |
| 7 | guides-0001 | ✅ 生成器按 en 指令补「前往/跳至…」收尾；TDE zh 文档改用自译 story-text sections（整块补全） | `tools/import-scenario-guides.mjs` | `node tools/import-scenario-guides.mjs --check`、`node --test tests/scenario-guides.test.mjs` |
| 8 | guides-0002 | ✅ 生成器统一本地化残留 `Proceed to …` 英文转场 | `tools/import-scenario-guides.mjs#localizeResidualEnglish` | 同上；复扫 `Proceed to`/`Skip to` 为 0 |
| 9 | guides-0007 | ✅ TDE overlay：zh 指南正文取 `story-text.js` sections（含完整分支 bullet），缺键回退参考 zh | `tools/import-scenario-guides.mjs` | `npm run import:tde-story:check`、`import-scenario-guides --check`、复扫 block-missing 为 0 |
| 10 | setup-0001 | ✅ TIC setup 生成前还原 ICU 转义（`[bless]`/`[curse]`） | `content/campaigns/theInnsmouthConspiracy/chapter-definition.js#restoreInlineText` | `tests/tic-story-format.test.mjs`、`npm run test:tic` |

> 修复记录中的复扫口径（指南分支动词/元数据过滤、TIC 展示层清洗）见 [`fix-report-P0.md`](fix-report-P0.md) §4。

## P1 · 内容/生成器修复（medium，已修复 ✅）

> 实现、落点与验证证据见 [`fix-report-P1.md`](fix-report-P1.md)。

- **story-0006** ✅：TIC 展示层已统一剥 Markdown 强调；审计口径改为按玩家可见文本判定，并加回归。
- **story-0007** ✅：`tools/import-tfa-story.mjs#clean` 把 `{token}`→`[token]`（`elderSign`→`elder_sign`；补给 `{pointsRemaining}` 保留运行时插值）。
- **story-0008** ✅：TCU `cleanText` 把 `({class})`→`[class]`（intro3Mystic 显示 `[mystic]` 图标）。
- **story-0009** ✅：TCU/TDE/Dunwich 生成器 + TIC 展示层（chapter-definition/resolutions/flashbacks）统一剥离结局段首标签；TDE 16 段尾声 `localeKeys.*.body` 同修。
- **story-0011/0012** ✅：EOTE 尾声分节标题可读化、`[count]`→`X`（生成器 `normalizeZhText`）。
- **guides-0003** ✅：zh 指南 `, and`→`、`、半角逗号→`、`；英文分节标签已在 P0 统一翻译。
- **guides-0004** ✅：生成器/EOTE 指南/TIC 设置删除「遭遇组…图标…：」悬空句（en 同修）；扫描器只认遭遇组清单引导句。
- **guides-0005** ✅：TDE 梦境条目按 en token 数量补回 `[guardian]`/`[seeker]`/`[rogue]`/`[mystic]`/`[survivor]`。
- **guides-0006** ✅：EOTE en 面板 `[shelterValue]` → `the camp's shelter value`（zh 已为「营地庇护值」）。
- **setup-0002** ✅：TIC setup 去 Markdown 星号/HTML、按段落拆分、删悬空图标句。

## P2 · 一致性清理（low/medium）

- **story-0013**：保留 TDE `pendingTranslation === false` 回归断言（新增键必须先补中文）。
- **story-0014 / guides-0009**：批量「著」→「着」（人工复核 著名/著作/土著/显著），清理零星繁体；来源修在参考 zh locale / 自译源，重生成。
- **story-0015 / guides-0010**：生成器 zh 分支做确定性标点规整（半角→全角、引号配对、去多余空格），参照 EOTE fix-batch 的替换清单。
- **guides-0008**：逐条裁定 token 简写是否可接受；生成器加「en 去重 token 集合 ⊆ zh token 集合」软校验。
- **guides-0011**：把内联的结局标题提升为 title 层（或保持现状并记录为结构差异）。
- **setup-0003**：给敦威治 6 关补 `content/scenario-guides.js` 的 setup 摘要（参照 theGathering 写法）。
- **setup-0004**：统一 TDE/EOTE 关卡名格式（product 裁定后改 chapters/manifest 的 name）。
- **setup-0005**：人工确认 fatalMirage intro 与 TIC noResolution 重定向为既定行为，写进本报告附录/账本。
- **cross-0001/0002**：建 token 规范 + 术语表（Intro/Resolution/Scenario/记录词），纳入生成器断言与 CI。
- **cross-0003/0004**：来源口径与范围说明随本报告维护，后续合并卡面审计时更新。

## 门禁与回归（每批执行）

```sh
# 生成物一致性（按改动战役选择）
node tools/import-tfa-story.mjs --check
node tools/import-dunwich-story.mjs --check
node tools/import-carcosa-story.mjs --check
node tools/import-tcu-story.mjs --check
node tools/import-tde-story.mjs --check
node tools/import-eote-story.mjs --check
node tools/import-scenario-guides.mjs --check

# 测试
node --test tests/scenario-guides.test.mjs
npm run test:fast
npm run test:tfa:story          # 以改动战役为准
npm run test:tcu:story
npm run test:tde:story
npm run test:tic
npm run test:eote
npm run test:release            # 发布前
```

浏览器验收（关卡设置面板 + 故事导入）：1440 桌面与 390 移动，参照 `docs/scenario-guides.md` 与各战役 README 的验收命令。
