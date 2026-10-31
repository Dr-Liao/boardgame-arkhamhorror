# P8（M3 剧本 + 幕间/尾声）收尾报告

> 阶段：P8 / M3「剧本与剧情（不含自译）」；日期：2026-10-31。
> 状态：**8 章全部落地为 `development` 章节**（`check:tde:scenario` 8/8 PASS，`check:tde:registry` PASS、`launchable 0`），
> 283 条战役记录逐条有落点（`tdeCampaign` 249 主卡全部 `rulesImplemented=true` + 34 面按归属/引用覆盖），
> 三幕间与 16 段尾声矩阵已接线到战役 manifest，逐章账本 [`audit/tde-scenario-acceptance.json`](../audit/tde-scenario-acceptance.json)
> 为 **8/8 development、0 pending 遭遇卡、253/253 章节记录覆盖、12 条显式简化**。
> 剧情正文（P8-T 自译）与逐卡等价 / 浏览器验收仍 pending：`storyText=false`、`literalCardBehavior=false`、
> `browserAcceptance=false`，本章节**不宣称可玩等价**，三组确认未齐前不升 `playable`。
> 手册：[`tde-scenarios.md`](./tde-scenarios.md)。命令见 §7。

## 1. 范围与不做什么

- **做**：8 章 `content/campaigns/theDreamEaters/scenarios/<id>/{index,definition,layout,behavior,chaos}.js`；
  283 条战役遭遇记录的单卡条目（一卡一文件）；战役层 `manifest/parts/record-labels/tde-chaos/interludes/dual-story`；
  P8 工具（分片扫描、逐章自检、逐章账本、预注册校验）；逐章测试与账本；引擎侧内容层通用 API / 钩子；
  路线图 §8.3 要求的「幕间/尾声不能留到 P9.5」。
- **不做（越界）**：P8-T 中文剧情自译（`story-text.js` 保持 `status:'pending'`，官方中文 `false`）、
  P9 逐卡等价核对（`literalCardBehavior=false`）与浏览器验收（`browserAcceptance=false`）、
  P9.5 真实双线开闸（`dualLineGate` 仍关）、P10 注册 `content/registered.js` 与三组确认升 `playable`。
- **边界**：12 条显式简化（`behavior.scenarioGaps`，逐条进账本 `remaining`）+ 11 条 rejected 原语请求（含建议）；
  10 条 noEntry 记录（8 张剧本参考卡 + 2 张背面故事面）在报告与账本中逐条登记理由；不静默近似。

## 2. 产物

| 类别 | 文件 |
| --- | --- |
| 8 章模块（43 文件） | `content/campaigns/theDreamEaters/scenarios/<id>/{index,definition,layout,behavior,chaos}.js` + 3 个 en 原文模块（`texts.js`/`text-en.js`） |
| 单卡条目 ×273 | `src/cards/encounter-entries/theDreamEaters/<chapter>/<code>.js`（8 章）+ `.../_shared/<encounterCode>/<code>.js`（12 组 + 06053 跨章复用） |
| 战役层 | `content/campaigns/theDreamEaters/{manifest,parts,chapters,record-labels,tde-chaos,interludes,dual-story,story-text,card-data,encounter-rules,shared,keywords,interactions}.js` |
| 引擎（P8 追加） | `src/engine/{scenario-runtime,hidden-rules,enemies,card-ops,tests,moves,dispatch,engine}.js`：内容层通用 API 与 6 个行为钩子（§5） |
| TDE 工具 | `tools/scan-tde-scenario-shards.mjs`、`check-tde-scenario.mjs`、`audit-tde-scenarios.mjs`、`check-tde-registry.mjs` |
| 测试 | `tests/tde-scenario-<8 chapter>.test.mjs`（196 例）、`tests/tde-campaign-layer.test.mjs`（28 例）、`tests/tde-scenario-runtime-api.test.mjs`（19 例） |
| 账本 / 生成物 | [`audit/tde-scenario-acceptance.json`](../audit/tde-scenario-acceptance.json)、[`audit/tde-scenario-source-lock.json`](../audit/tde-scenario-source-lock.json)（8 章 Haskell + en locale + 8 个战役公共来源的 SHA-256） |
| 运行目录 | `artifacts/migration/tde/{p8-shards.json,workers/w-p8-*.json,workers/*.inventory.md,primitive-requests/}`（不签入） |
| 文档 | 本文 + 重写 [`tde-scenarios.md`](./tde-scenarios.md) + 路线图 §0/§2/§8/§13 + [`tde-rules.md`](./tde-rules.md) §5 + [`tde-primitives.md`](./tde-primitives.md) P8 节 + [`tde-story.md`](./tde-story.md) |

## 3. 7 名并行 worker / 8 个分片

| 分片 | worker | 章节 | 记录（条目/ noEntry） | 章节测试 |
| --- | --- | --- | ---: | ---: |
| `P8-1` | `w-p8-a` | A1 梦境门外 + B1 清醒噩梦 | 47（43 + 4） | 53 例 |
| `P8-2` | `w-p8-b` | A2 寻觅卡达斯（最大章） | 53（52 + 1） | 29 例 |
| `P8-3` | `w-p8-c` | B2 万千骇形 + A3 月之暗面 | 57（55 + 2） | 28 例 |
| `P8-4` | `w-p8-d` | B3 无归之地 | 37（36 + 1） | 37 例 |
| `P8-5` | `w-p8-e` | A4 神居之所 | 37（36 + 1） | 19 例 |
| `P8-6` | `w-p8-f` | B4 编织宇宙 + 12 个战役共享组 | 52（51 + 1） | 32 例 |
| `P8-7` | `w-p8-g` | 战役层（55 键/两袋/parts+modes/三幕间/16 尾声） | — | 28 例 |
| Lead | — | 框架（card-data / encounter-rules / chapters / story-text）、P8 工具、引擎 API、合并与门禁 | — | 19 例（公共 API） |

- 分片清单与守恒：`artifacts/migration/tde/p8-shards.json`（`scan:tde:scenario:shards`，283 = Σ 6 片，无重复/遗漏）。
- 写入边界：worker 只写自己的章节目录、条目目录、章节测试与报告/原语请求；Lead 独占共享层、索引、账本与文档。
- 合并期由 Lead 处理：索引重建、`requiredPackIds` 归一（印刷包由 `tdeCampaign` cardRanges 覆盖）、
  06053 跨章复用条目的归属移动、TDE behavior.js 卡号字面量迁到 `definition.js` 的 `RAW_CODES`。

## 4. 逐章交付摘要

详见 [`tde-scenarios.md`](./tde-scenarios.md) §2 与账本 items。要点：

| 章 | 线/对 | 地点 | 幕/议程 | 敌人/诡计 | 剧情面 | 结局 | 特色实现 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 梦境门外 | A1 | 12 | 4 / 1 | 8 / 12 | 2（noEntry） | 3 | 14 种梦境选择、开局无遭遇牌库（全部 set aside 41 张）、幕 1–3 神话不抽遭遇 |
| 清醒噩梦 | B1 | 8 | 3 / 3 | 5 / 11 | 1 | 7 | 蛛群滋生袋（`api.tokenBag`）、蛛巢/寄生状态、护工替换、滋生检定 |
| 寻觅卡达斯 | A2 | 17（15 掩藏） | 5 / 2 | 13 / 10 | 17 | 3 | 4 区域切换、15 张 Veiled + 背面故事卡、神迹计数、被俘/证据记录 |
| 万千骇形 | B2 | 15 | 2 / 3 | 6 / 12 | 0 | 5 | 183–188 纵向链、Endless Descent 重排、蜂拥授予、三件「记住」事实 |
| 月之暗面 | A3 | 10 | 4 / 3 | 5 / 9 | 0 | 2 | 警报等级 0–5（`api.counters`）、被俘开场、白船限制、土星猫 Swarming X |
| 无归之地 | B3 | 13（8 掩藏） | 3 / 2 | 9 / 14 | 12 | 3 | 漆黑之海翻面读故事（P8 核对：**无洗回**）、巨噬蠕虫隧道、桥梁进度 |
| 神居之所 | A4 | 11 | 5 / 3 | 11 / 17 | 0 | 6 | 5 形态 Hidden 敌人在手牌（`hiddenEnemyInHand`+`api.hiddenCards`）、6 塔 × 4 低语、真形合成 |
| 编织宇宙 | B4 | 11 | 3 / 3 | 9 / 8 | 0 | 6 | 大网纵向堆叠（`api.verticalChain`）、阿特拉克旋转、四腿 Massive、地点毁灭（`api.locationDoom`） |

- 战役层：8 章按 A/B 交错挂 `parts`（A 梦寻 / B 梦网，各 4 章 4 对）+ `modes: singleA/singleB/pick/parallel`；
  `manifest.flow` = 双线章对门 → 三幕间 → 16 段尾声 → end；`manifest.flows.singleA/singleB` 单线只读幕间 I 对应分支、无尾声正文；
  55 个记录键（`recordTypes`: 2 number / 2 逐调查员 `string[]` / 51 boolean）；A/B 两套基础袋（A 无 skull/elderthing，B 无 tablet）。
- 剧本文本策略：definition 的 setup/rules/resolutions 逐字使用锁定 en locale 原文（去 HTML），标
  `textLanguage:'en'` + `textStatus:'pending-self-translation'`；未写中文摘要/自译（P8-T 边界）。

## 5. 引擎与共享层改动（P8 主进程，只加通用读点）

| 类别 | 内容 |
| --- | --- |
| 内容层通用 API | `api.discardEncounterTop / discardEncounterCard / takeEncounterDiscard`、`api.addCluesToLocation / removeLocationClues`、`api.hiddenCards.{list,has,place,discard,removeMarker,take,transfer,activeRules}`、`api.addCluesToEnemy`、`api.takeFromVictory`、`api.preventEnemyReady` |
| 场景行为钩子 | `canFightHidden` / `canEvadeHidden`（Hidden 敌人在手牌的攻击入口）、`veiledFlipped`（翻面后读正文/记录）、`canCommitCard`（投入限制）、`afterEvade`（躲避替代）、`spawnLocation` / `spawnFailed`（数据分派） |
| 规则读点 | `hiddenRule.maxCommitsPerRound` + 按轮计数（06319–06321）、`PREY_RANK.mostDamage/mostCardsInHand`、`enemyStatModifier(..., inv)` 与 `per.source='encounterCardsInHand'` |
| 共享战役规则层 | `content/campaigns/theDreamEaters/encounter-rules.js`：Swarming 蜂拥卡/击败门槛/溢出伤害、Veiled 翻面、enemyScript 分派、牌库耗尽强制、threatAction、`entryFlags` 数据分派（spawn/failRestricts/afterFailTest/followUp/moveBlockWhileReady…） |
| 卡面数据入口 | `card-data.js`：TDE 包/组映射、`location/veiledLocation/doubleSidedLocation`、`encounterDefinitions`（Swarming/Alert/Hidden/hiddenRule 解析）、`stages/storyFace/storyCards/veiledStoryFaces/identitiesFor` |

- 所有改动不新增卡号分支（`architecture-guard` 的 engine 卡号集合仍为空/无增长）；内容层「章节脚本卡号字面量」
  反而从 1105 基线降到 **1040**（TDE 8 章 behavior 的 133 处卡号搬进 `definition.js` 的 `RAW_CODES` 数据表）。
- 行为零漂移：`replay-fixtures --compare artifacts/migration/tde/replay-before.json` → 13 局逐条一致。
- 观察：`src/engine/veiled.js` 与路线图 §1.2/§6 原「B3 翻面后洗回遭遇牌堆」经 P8 官方 en 规则 + Haskell 复核为**初勘错误**，P8 已改口径（不洗回；`shuffleVeiledIntoDeck` 保留为通用原语，TDE 内容不调用）。

## 6. 验证记录（2026-10-31 实测）

| 项 | 结果 |
| --- | --- |
| `node tools/check-tde-scenario.mjs <8 章>` | **8/8 PASS**（记录覆盖 283/283；0 failures / 0 warnings） |
| `npm run check:tde:registry` | **PASS**：8 章 development / launchable 0 / 注册期校验与区域守恒通过 |
| `npm run audit:tde:scenarios` | 8/8 development、0 pending 遭遇卡、253/253 章节记录覆盖、**12 条显式简化、88 条 remaining** |
| `npm run test:tde:scenarios` | **223/223**（8 章 196 + 场景交互 8 + 公共 API 19） |
| `npm run test:tde:campaign` | 28 + 19 = 47 例通过（战役层 + 公共 API） |
| `npm run audit:tde:rules` / `audit:tde:primitives` / `audit:tde:investigators` / `audit:tde:player` | 全部 `--check` 一致、gate pass（primitive 29/29 done；玩家卡 87/87） |
| `node tools/replay-fixtures.mjs --compare artifacts/migration/tde/replay-before.json` | 13 局逐条一致（行为零变化） |
| `npm run test:fast` | **4361 tests / 4351 pass / 7 fail / 3 skipped**；7 条失败全部为工作区既有外部问题（§8），TDE 新增用例全绿 |
| `cards:encounter-check` | 索引一致（1056 条目）；`encounter-entries` 7 例中 1 例为外部 `02297` import `content/`；条目合规仅外部 `03295` 的 R1 |
| `npm run docs:check` | 见收尾复跑（链接 0 失效） |
| `audit/ability-coverage.json` | 已按新条目重算（`cards:audit:write`）；`architecture-guard` 18/18 通过 |

## 7. 命令

```bash
npm run scan:tde:scenario:shards          # 283 条记录切 6 片 + worker 输入清单（--check 只校验）
node tools/check-tde-scenario.mjs <id>    # 单章自检（结构/身份/掩藏/条目/本章记录覆盖）
npm run check:tde:registry                # 8 章 + 三包 + 战役 manifest 走 createContentRegistry
npm run test:tde:scenarios                # 8 章章节测试 + 交互投影 + 公共 API
npm run test:tde:campaign                 # 战役层（55 键/两袋/parts/modes/幕间/16 尾声）+ 公共 API
npm run audit:tde:scenarios               # --check 逐字节复算逐章账本；:write 重算
```

## 8. 已知问题与既有失败（非 P8 产生）

以下在本轮开始前即存在于工作区（外部未提交改动/旧账本漂移），P8 未改这些文件，按「既有失败单独记账」：

1. `thePathToCarcosa/blackStarsRise/03295.js` 的 R1 直写（工作区改动）→ `audit:entries` 报 R1 新增违规。
2. `theDunwichLegacy/whereDoomAwaits/02297.js` import `content/`（工作区改动）→ `encounter-entries` 守卫 1 例。
3. `tests/carcosa-final.test.mjs` / `carcosa-pending-encounters.test.mjs` / `tde` 之外 3 条 Carcosa 红（工作区 WIP）。
4. `tests/core-ledger.test.mjs`、`tests/dunwich-ledger.test.mjs`：证据文件在工作区被外部修改 → 账本 stale。
5. `tests/tcu-migration.test.mjs`（P1 账本）：TCU `scope.json` 记录的 `src/cards/cards-data.js` 哈希与当前文件不一致——`cards-data.js` 在 P6 后的一次发布提交更新而 TCU scope 未重采，属**已提交的旧账本漂移**；P8 不改 cards-data。
6. `baseline:check` 的全局 `audit/baseline.json` 未重采（36/288、tests 数字随迁移变化；R4 已知）。

> 说明：P8 开工时 `architecture-guard` 的 behavior.js 行数基线失败由 P8 新增 8 章引起，已按实测重锁（§5）；TDE 新增的「内容层章节脚本卡号字面量」通过把 behavior 的 133 处卡号搬进 `definition.js` 的 `RAW_CODES` 降到 1040（≤ 1105 基线），没有放宽守卫。

P8 自身新增失败为 **0**；上述 7 条与 P7 报告的既有失败集合一致，建议由对应循环修复轮处理。

## 9. 剩余工作（交接）

1. **P8-T（剧情自译）**：`story-text.js` 仍 `pending`；需按 §8.5 的 14 批译校 + `tools/import-tde-story.mjs` 生成，
   之后各章 `storyText` 才能翻真、`textLanguage:'en'` 占位被替换；`interlude`/`epilogue` 节点已带
   `storySection`/`storyCell`/`textKey` 便于对齐。
2. **P9（逐章/全卡验收）**：`literalCardBehavior` 逐卡核对（**12 条显式简化**逐条还账或保持 `simplified`）、
   8 章桌面 1440 / 移动 390 浏览器路径 + 截图 → `browserAcceptance`；交互 3–10 在真实章节上的 UI 路径。
3. **P9.5（双线开闸）**：`dualLineGate` 打开前提——`campaignManifestFor` 需要改为「`manifest.flows[mode]` 优先」，
   幕间跨 part 效果需按 `partRecord/recordInPart/mutateBothBags` 结算（P8 只交付数据：`effects[].part` /
   `branches.pendingEngine`）；2+2 / 1+1 / 2+1、16 排列、并发提交、存档/回放与 §11.2 十条门禁。
4. **P10（发布）**：三包 + 战役 + 8 章进 `content/registered.js`（并重采 `audit/baseline.json`）；
   处理 P7 的 57 张显式简化与 5 条 rejected 请求、本报告 §5 的 11 条 rejected 请求评估；`equivalenceCertified=false`。
5. **`audit/baseline.json` / `baseline:check`**：随 P10 重采一次（当前数字失真为已知 R4）。

## 10. 维护

- 改条目：改单卡文件 → `node tools/build-encounter-index.mjs --write` → `node tools/check-tde-scenario.mjs <章>` →
  `node tests/tde-scenario-<章>.test.mjs` → `node tools/audit-tde-scenarios.mjs --write` 并审阅 diff。
- 改章节流程：`behavior.js` 覆盖共享钩子必须转发 `encounterRules.<hook>(...)`；卡号常量走 `definition.js` 的
  `RAW_CODES`（不要写回 behavior.js 字面量，architecture-guard 会拦）。
- 改战役层：同步 `tests/tde-campaign-layer.test.mjs`（55 键/两袋/16 排列/矩阵）与路线图 §1.4/§7。
- 改引擎 API/钩子：补 `tests/tde-scenario-runtime-api.test.mjs`；`audit-tde-primitives` 的 engineBoundary 要求
  `src/engine/**` 不出现 `tde`/`theDreamEaters` 字样与 06 卡号。
