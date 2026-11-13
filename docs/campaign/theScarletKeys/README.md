# 八循环《绯红密钥》迁移路线图

英文名：The Scarlet Keys。战役标识：`theScarletKeys`；本轮工具及审计简称：`tsk`；来源战役编号：`09`。

**独立全量扫描（2026-11-12）**：本目录新增 [`full-scan.md`](full-scan.md) 与 [`fix-plan.md`](fix-plan.md)。
该扫描不采信下文 P0–P8 的 `verified`/勾选，对 439 条记录逐卡复核并跑真实引擎探针；结论是
**P8 的发布证据在当前工作区不能独立复现**（14 个冻结门禁 3 个失败、TSK 测试 595 例 1 fail），
并发现 **P0 级问题 7 项**（《不留痕迹》真实开局崩溃、基础弱点 09126/09128 抽到即崩、`to:'deck'` 洗回崩溃、
5 章 `choiceFor` 吞引擎 `ChoicePause`、终章全员阵亡崩溃、遭遇注册缺卡 09720/09721、两章遭遇牌库缺过半）
与大量 high 级规则偏差。下文 P0–P8 清单保留为迁移历史记录，**完成口径以 `full-scan.md` 与
`artifacts/tsk-scan/` 的独立证据为准**，修复步骤见 `fix-plan.md`。

**P0 修复完成（2026-11-13）**：7 项 P0 全部修复并通过真实引擎验收（回归见
[`tests/tsk-p0-regressions.test.mjs`](../../../tests/tsk-p0-regressions.test.mjs)）：
《不留痕迹》真实开局不再崩溃、09126/09128 抽到留手、`to:'deck'` 目标区归一、5 章 `ChoicePause`
事务恢复、终章全灭走 `noResolution`、09720/09721 已注册、六章遭遇牌库按印刷补齐。
验收：**14/14 个 TSK 冻结门禁通过、633/633 个 TSK 测试通过、`audit/tsk-migration.json#status = verified`**；
十章均可在真实引擎进入（`probe.mjs`）。P1/P2 清单仍见 `fix-plan.md`。

**P1 修复进度（2026-11-13 第二轮 → 第三轮完成 17/17 组主体）**：第二轮完成 13 组主体（两个 TSK 时机
窗口真实派发、玩家 Shift/移交入口、Concealed X 数值口径、迷你卡 `code` 跨章契约、09751/09717 api 面、
调查员 8 卡与 4 个引擎读点、玩家卡 18 张、四档混乱标记、`scenarioRuntime` 缺失原语、02310 禁用卡/
时间 35 重定向/Ω 报告/θ 记录）；第三轮补齐 **P1-11 章节机制**（deadHeat 09524/09521/09522/09532、
riddles 09516/09517 + 3 个引擎读点）、**P1-12 章节状态观察投影**（`manifest.publicScenarioFlags`
声明清单驱动 observation + mechanic-view + web 面板）、**P1-14 结局分支**（dealings 追逐 R1–R5、
sanguine「云开见日」1–7 与 09557b 生成）、**P1-15 隐私**（`knownBy` 按座位隔离、日志去身份），
并把 P1-16 的单卡 15 个与 blocked 5 张探针收口。回归见
[`tests/tsk-p1-regressions.test.mjs`](../../../tests/tsk-p1-regressions.test.mjs)（27 例真实引擎）。
剩余均为引擎原语级读点（P1-6 4 项、P1-8 3 项、P1-16 6 项），逐条列在 `fix-plan.md` 状态表。
浏览器验收已跑 TSK P4 交互 16/16（桌面 1440 + 移动 390）。

建立日期：2026-11-03。本文件是实施路线与完成清单，完成状态以代码、测试和审计证据为准。**P0（M0 范围与基线）已完成（2026-11-10）**：范围账本 `audit/tsk-scope.json`、原始基线 `audit/tsk-baseline.json`、`scan:tsk:scope:check` / `scan:tsk:baseline:check` 可复算；**P1（机制扫描）已完成（2026-11-10）**：机制扫描账本 `audit/tsk-mechanism-scan.json`、`scan:tsk:check` 可复算，439 条记录全部归类、49 项原语缺口进入 P2；**P2（通用原语）已完成（2026-11-10）**：77 项目录全覆盖（reuse 31 / new 37 / extend 9）、`audit/tsk-primitive-{plan,catalog}.json` 与 `audit/tsk-node-acceptance.json` 可复算；**P3（关键词与规则书）已完成（2026-11-10）**：29 个关键词、17 条双语规则、439 卡文直达、`audit/tsk-rules.json#confirmations` 全 verified、浏览器验收 6/6；**P4（新增交互与界面）已完成（2026-11-10）**：6 组交互事务与摘要面板、投影隐私、`audit/tsk-interactions.json#status = verified`、浏览器验收 16/16 通过；**P5（调查员及专属依赖）已完成（2026-11-10）**：6 位调查员 + 14 张专属依赖、次级职阶构筑、引擎读点接线、`audit/tsk-investigators.json#status = verified`、浏览器验收 12/12（6 人 × 桌面/移动）；**P6（一般玩家卡批量迁移）已完成（2026-11-11）**：108 条记录（103 可构筑 + 5 基础弱点，含 16 张定制卡与跨循环重印 canonical）逐卡实现并 verified（61 张近似逐条披露）、四片 126 例测试、浏览器 10/10、`audit/tsk-player-acceptance.json#status = verified`；**P7（共享遭遇、十章及战役流程）已完成（2026-11-11）**：26 个战役遭遇组（301 张需条目战役卡 + 10 张 scenario 参考卡）全部一卡一文件、十章逐章设置/幕议程/地点/敌人/诡计/剧情资产/符号/结局、伦敦序幕→幕间 I→世界地图启程循环（时间/12 段密档幕间/状况报告 α–ω/快捷旅票）→通古斯卡终章→尾声、完整中英叙事与十章指南、战役包升 `playable`；`audit/tsk-scenario-acceptance.json#status = verified`（12 项 gates 全真、10/10 章 verified、301/301 条目、262 例章测试、浏览器桌面 1440/移动 390 通过 4/4）；**P8（整体验收与发布，M5）已完成（2026-11-12）**：`audit/tsk-migration.json#status = verified`（16 项门禁全真：来源哈希 + 逐卡账本 439/439 无 missing/blocked + 原语请求 175 份全部裁决 deferred + 十章/关键词/规则书确认 + 指南/截图证据；真实大厅发布/逐章/联机/隐私/权限/断线/定制勾选/通古斯卡终章与尾声浏览器账本全部 passed；全量回归无新增失败），`confirmations.scenarios/keywords/rulebook` 三组 verified，`playable` 且 `earlyAccess:false` 发布，无未披露近似、阻塞卡或待实现原语。

复算输入计划签入 `audit/tsk-{scope,mechanism-scan,primitive-plan,primitive-catalog,rules,interactions,investigators}.json`；P0–P5 已落地 `scope`、`baseline`、`mechanism-scan`、`primitive-plan`、`primitive-catalog`、`rules`、`interactions`、`investigators` 与 Node/浏览器验收证据。大厅根目录 `artifacts/migration/tsk/` 保存运行镜像与过程资料，继续忽略，不放开整个目录。

## 1. 依据与打勾规则

遵循[内容迁移规范](../../arkham-content-migration.md)、[架构与修改约定](../../../ARCHITECTURE.md)、[一卡一文件操作手册](../../card-entry-files.md)、[卡牌模型](../../card-model.md)和[完整冒险指南要求](../../scenario-guides.md)。本文件补充本循环的执行范围，不重新定义通用协议。

- `[ ]`：未完成，或缺少验收证据；实现中、阻塞和待复核均保持未勾选。
- `[x]`：完成该项要求，并在旁边或对应审计账本登记证据路径与验证结果。
- 阶段总项只有在其子项和退出门禁全部通过后才能打勾；`blocked`、`rejected`、`simplified` 和提前开放的延后项均不算完成。
- 审计确认组仍只使用 `pending` / `verified`；本清单不代替 `confirmations` 和 `releaseAcceptance`。
- 更新时记录日期、执行命令、结果及报告位置；测试数量、耗时和 replay 指纹数量取实测值，不手工写死。

### 已完成的规划准备

- [x] 阅读现有迁移规范及冒险指南要求，确定六步顺序与逐章验收口径。证据：本文件引用的规范。
- [x] 对照本地来源确认十章标识、真实剧本提示卡号、世界地图启程及密档推进框架。证据：下文来源清单、§4 的章节表与流程。
- [x] 建立本循环独立文档目录、阶段路线清单和完成勾选约定。证据：本文件。

## 2. 来源、范围与交付位置

来源根目录为大厅仓库的 `参考资源/ArkhamHorror-main/`，只读，不直接修改：

| 内容 | 来源相对路径 | P0 要锁定的内容 |
| --- | --- | --- |
| 卡牌数据与中文卡名 | `frontend/public/cards*.json` | 本循环内容包（`tskp`、`tskc`）、卡号、正反面、定制升级卡选项、双面绯红密钥、关联卡、重印映射及 SHA-256 |
| 战役流程 | `backend/arkham-api/library/Arkham/Campaign/Campaigns/TheScarletKeys.hs` | 序幕、幕间 I、世界地图启程（`embark`）、旅行耗时与状况报告（`α–ω`）、密档幕间（`14–55`）、禁用卡规则与尾声分支 |
| 战役共用规则 | `backend/arkham-api/library/Arkham/Campaigns/TheScarletKeys/` | 章节常量（`CampaignSteps.hs`）、初始混乱袋、隐匿与阴影（`Concealed.hs`）、绯红密钥（`Key/`）、地图距离与元数据（`Meta.hs`、`Helpers.hs`） |
| 剧本身份 | `frontend/src/arkham/data/theScarletKeys.json` | 十章真实提示卡号（`09501`–`09694`）与战役归属 |
| 卡牌及剧本行为 | `backend/arkham-api/library/Arkham/` 下相应 `CardDefs`、`Cards`、`Scenario/Scenarios/TheScarletKeys/` | 卡文、定制勾选项、特别规则和参考行为逐项对应，不把参考实现自动视为无缺陷 |
| 中文剧情与指南 | `frontend/src/locales/zh/theScarletKeys/` | `base.json` 及十章 `scenarios/*.json` 的完整覆盖 |
| 英文剧情与指南 | `frontend/src/locales/en/theScarletKeys/` | 对照中文缺项、混入英文的段落、密档、设置和特别规则，补译保留自译标记 |

`09001`–`09128`（`tskp`）和 `09501`–`09770b`（`tskc`）是首轮扫描候选，不把连续编号或包名直接当作最终迁移范围。P0 必须展开双面绯红密钥（`[[Stable]]`／`[[Unstable]]`）、隐匿迷你卡与诱饵实体、调查员依赖、定制卡数据字段、环球漫游／红色同志会剧情奖励及跨循环重印；复用核心遭遇组只登记依赖，不重复归入本轮分片。

以下路径均相对 `games/arkhamhorror/`，是计划交付位置，尚未建立的文件不表示已实现：

| 产物 | 计划路径 |
| --- | --- |
| 战役与十章内容 | `content/campaigns/theScarletKeys/{manifest,shared,chapters,story-text,encounter-rules}.js`、`scenarios/<scenarioId>/`；按需拆分，不建空壳 |
| 内容包 | `content/packs/tskCampaign/`、`tskInvestigators/`、`tskPlayer/` 的 `manifest.js` |
| 玩家卡行为 | `src/cards/entries/<code>.js`，重印号复用 canonical 实现 |
| 非玩家卡行为 | `src/cards/encounter-entries/theScarletKeys/_shared/<group>/<code>.js` 或 `<scenarioId>/<code>.js`；跨战役卡沿用 `shared/<group>/` |
| 叙事生成 | `tools/import-tsk-story.mjs` 与生成后的 `story-text.js` |
| 完整冒险指南 | 接入 `tools/import-scenario-guides.mjs`，生成 `web/scenario-guides/<scenarioId>.json` 中英正文 |
| 总审计与专项账本 | `tools/audit-tsk.mjs`、`audit/tsk-migration.json`；按需拆分原语、调查员、玩家卡、章节和逐卡账本 |
| P0 范围与基线（已落地） | `tools/scan-tsk-scope.mjs` + `audit/tsk-scope.json`、`tools/scan-tsk-baseline.mjs` + `audit/tsk-baseline.json`、`tests/fixtures/replay/tsk-baseline.json`、`tests/tsk-migration.test.mjs` |
| P1 机制扫描（已落地） | `tools/tsk-mechanisms.mjs`、`tools/tsk-mechanism-primitives.mjs`、`tools/tsk-guide-scan.mjs`、`tools/scan-tsk-mechanisms.mjs` + `audit/tsk-mechanism-scan.json` |
| P2 通用原语（已落地） | `src/engine/tsk-*.js`（8 个原语模块 + `tsk-primitives.js` 校验汇总）、`tools/tsk-primitive-spec.mjs`、`tools/audit-tsk-primitives.mjs`、`tools/verify-tsk.mjs` + `audit/tsk-primitive-{plan,catalog}.json`、`audit/tsk-node-acceptance.json`、`docs/campaign/theScarletKeys/primitives.md` |
| P3 关键词与规则书（已落地） | `content/campaigns/theScarletKeys/keywords.js`、`web/tsk-rules.js`（注册进 `web/rulebook-data.js`）、`tools/audit-tsk-rules.mjs`、`tests/tsk-rules.test.mjs`、`tests/tsk-rules.browser.mjs` + `tests/playwright/playwright.tsk.config.mjs` + `audit/tsk-rules.json`、`audit/tsk-browser-acceptance.json`、`docs/campaign/theScarletKeys/rulebook.md` |
| P4 新增交互与界面（已落地） | `src/engine/tsk-interactions.js`、`src/integration/mechanic-view.js`（tsk 投影/掩码）、`web/mechanic-ui.js` / `mechanic-ui.css` / locale、`tools/audit-tsk-interactions.mjs`、`tools/verify-tsk-regression.mjs`、`tests/tsk-interactions.test.mjs`、`tests/tsk-interactions.browser.mjs`、`tests/tsk-interaction-fixture.mjs` + `tests/playwright/playwright.tsk-p4.config.mjs` + `audit/tsk-interactions{,-browser}.json`、`audit/tsk-regression.json`、`docs/campaign/theScarletKeys/interactions.md` |
| P5 调查员及专属依赖（已落地） | `src/cards/entries/090{01..20}.js`（6 调查员 + 14 专属依赖）、`content/campaigns/theScarletKeys/investigator-data.js`、`content/packs/tskInvestigators/manifest.js`（playable）、`src/engine/tsk-investigator-support.js`、`tools/audit-tsk-investigators.mjs`、`tests/tsk-investigator-*.test.mjs`、`tests/tsk-investigators.browser.mjs` + `tests/playwright/playwright.tsk-p5.config.mjs` + `audit/tsk-investigators{,-browser}.json`、`docs/campaign/theScarletKeys/investigators.md` |
| P6 一般玩家卡（已落地） | `src/cards/entries/09021–09128.js`（108 条）、`tools/plan-tsk-player.mjs` + `audit/tsk-player-shards.json`、`tools/tsk-player-options.mjs`、`tools/audit-tsk-player.mjs` + `audit/tsk-player-{acceptance,browser}.json`、`src/cards/tsk-player-acceptance.js`（生成物）、`src/engine/ability.js`（customizationOptions 读点）、`content/packs/tskPlayer/manifest.js`（playable）、`tests/tsk-player-m2-{1..4}.test.mjs`、`tests/tsk-player-fixture.mjs`、`tests/tsk-player.browser.mjs` + `tests/playwright/playwright.tsk-p6.config.mjs` + `tools/run-tsk-player-browser.mjs`、`docs/campaign/theScarletKeys/player-cards.md` |
| 测试 | `tests/tsk-*.test.mjs`、`tests/tsk-*.browser.mjs`，注册本循环测试与审计脚本 |

运行资料放在**大厅仓库根目录** `artifacts/migration/tsk/`，不与 Mod 下的历史 `artifacts/` 混用。最少包含 `scope.json`、`mechanism-scan.json`、`primitive-plan.json`、`primitive-catalog.json`、`shards.json`、`primitive-requests/`、`workers/`、`reports/` 和 replay 基线。只有干净检出复算所需的最小输入可逐文件加入白名单；截图、日志和执行过程文件不签入。

卡图继续使用 `web/img/cards/` 与 `web/img/zh/cards/` 及既有远程回退，不另建循环专属卡图副本。

## 3. 阶段路线清单

执行顺序为 **P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8**。其中 P5–P7 是规范第 5 步的不同内容批次；P8 是第 6 步。M0–M5 仅表示内容产物范围，不替代执行顺序。

### P0：锁定范围与基线（M0）

- [x] 扫描候选内容包（`tskp`、`tskc`），输出唯一卡号全集、正反面与双面密钥关联卡、定制卡元数据、重印 canonical 映射及范围外依赖。证据：`audit/tsk-scope.json`（439 条记录 = 369 主卡 + 70 关联面 / 398 个物理卡位；10 把双面密钥 20 条记录；16 张定制升级卡逐项勾选；6 组同印刷身份含 2 组跨循环重印 `04096↔09587`、`09064↔12049`；范围外依赖 `88045` 与 8 个核心遭遇组），`node tools/scan-tsk-scope.mjs --check` 逐字节复算一致。
- [x] 将调查员及专属依赖、一般玩家卡、共享遭遇组（含红色同志会、环球漫游、异界等）和逐章非玩家卡分成无交集集合，保留并集守恒检查。证据：三包 311/20/108 无重叠、并集 = 439；四类集合（调查员 20 / 一般玩家卡 108 / 共享组 16 / 章节组 10）守恒；`tests/tsk-migration.test.mjs` 的「三包守恒」「遭遇组分片」用例。
- [x] 逐章锁定来源、真实提示卡号（`09501`–`09694`）、四档混乱符号规则、初始混乱袋、世界地图节点表和完整指南来源，记录相对路径与 SHA-256。证据：`scope.sources` 427 个来源逐文件 SHA-256；`scope.chapters[*].promptCard` 逐字锁定 Easy/Standard + Hard/Expert 与 `[skull]` 规则、档案编号 `archiveLabelMatched`；`scope.worldMap` 36 节点（连接双向对称、5 绿地、26 初始解锁、起点伦敦、0-1 BFS 距离）；`scope.chaosBags` 四档（16/16/17/18，无 cultist）与状况报告 `α–ω` 阈值/效果；`scope.guideSources` 22 份中英指南。
- [x] 记录起始提交、工作区已有改动、回归既有失败，以及引擎卡号字面量、`EFFECTS`、逃生原语和 R1/R2/R3 合规基线。证据：`audit/tsk-baseline.json`（`gitHead=fb7d536`；`worktree` 45 条既有 `docs/edgeOfTheEarth/**` 删除；`fastFailures` 4 条既有失败；12 项能力层指标；`complianceBaseline`）。
- [x] 在行为改动前生成 golden replay 临时基线；登记 `scope.json` 和报告位置。证据：`tests/fixtures/replay/tsk-baseline.json`（13 局 / 797 步，`replaySha256` 内嵌基线）；临时采集镜像 `artifacts/migration/tsk/replay-before.json`；`scope.json` ↔ `artifacts/migration/tsk/scope.json`。
- [x] 接入目录身份和必要的审计骨架；未验收内容保持 `catalog-only`，战役、选人和构筑不因数据收录而开放。证据：三包 `catalog-only` 注册进 `content/registered.js`；`content/campaigns/theScarletKeys/{shared,chapters,manifest}.js`；战役清单与十章占位不进生产组合根，439 张卡可用性全部 `catalog-only`（不可构筑/不可选人）；`scan:tsk:scope[:check]`、`scan:tsk:baseline[:check]`、`test:tsk` 已登记。

退出门禁：来源可复算，集合无重叠无遗漏，现有 replay 可复现；此后来源漂移必须让 `--check` 失败。

**P0 完成证据（2026-11-10）**

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 范围账本 | 439 条记录 / 398 卡位 / 三包 311·20·108 / 26 遭遇组 / 10 章 / 10 钥匙 / 16 定制卡 | `audit/tsk-scope.json`；`node tools/scan-tsk-scope.mjs --check` |
| 来源锁 | 427 个参考文件 SHA-256（战役、十章剧本、卡牌定义与实现、中英剧情指南、卡表四份） | `scope.sources`；`--check` 漂移即失败 |
| 基线 | `gitHead fb7d536`、45 条既有工作区删除、4 条既有 fast 失败、12 项能力层指标 | `audit/tsk-baseline.json`；`node tools/scan-tsk-baseline.mjs --check` |
| golden replay | 13 局 / 797 步，行为零变化 | `tests/fixtures/replay/tsk-baseline.json`；`replay-fixtures --compare` exit 0 |
| fast 回归 | P0 前 7056 tests / 7049 pass / 4 fail → P0 后 7061 tests / 7054 pass / 4 fail（新增 5 例全绿；4 条失败与 P0 前完全一致，未修未洗白） | `artifacts/migration/tsk/reports/fast-baseline.log`（sha256 `7c46665…`）与 `fast-after-2.log` |
| 专项测试 | `test:tsk` 5/5；分层清单与 `node-suite` 一致 | `tests/tsk-migration.test.mjs`；`tests/suites.mjs` |
| 跨循环缝 | 组合根变更按既有维护口径重签依赖账本：`audit/tde-migration.json` 仅 `content/registered.js` 哈希 1 行变化，`audit-tde --check` 复算一致；TIC/EotE 账本此前已各自漂移，保持既有失败账不重签 | `audit/tde-migration.json`；`artifacts/migration/tsk/reports/` |

P0 期间重跑 README §7 门禁时，以下命令在 P0 前就已失败，已按既有失败冻结在 `audit/tsk-baseline.json#preExistingFailures.otherCommands`，不在本轮修复或重签：`npm run docs:check`（7 条失效链接全部指向 P0 前已删除的 `docs/edgeOfTheEarth/**`）、`npm run presentation:check`（`audit/presentation-report.json` 早于本轮漂移）、`npm run audit:check`（N0 资源基线 `audit/migration-scope.json` 早已漂移）。其余 P0 门禁 `cards:check` / `cards:encounter-check` / `audit:entries` / `cards:audit` / `replay:fixtures` / `images:verify` / `scan:tsk:scope:check` / `scan:tsk:baseline:check` 全部通过。

注意：目录期不把「数据收录」当「规则实现」——`audit/tsk-scope.json` 的 `status` 仍是 `catalog-only`，`audit/tsk-scope.json#pending` 列出的 11 项数据/来源差异（双击密钥数据口径、09606a 单面卡、`09747`–`09749` 无主卡记录、档案编号分布、side story 依赖等）必须在 P1 逐项复核，不得静默带入 P2。

### P1：扫描新增机制（规范第 1 步）

- [x] 全量扫描卡面、背面、定制栏、规则、地图密档及每章指南，形成 `mechanism-scan.json`，覆盖 `primitive / keyword / rulebook / interaction / scenario / content`。证据：`audit/tsk-mechanism-scan.json`（132 个机制行：primitive 21 / keyword 29 / rulebook 40 / interaction 19 / scenario 10 / content 13；扫描语料 = 正面 + 背面 + 定制栏 + 定制变更 + 特质），`node tools/scan-tsk-mechanisms.mjs --check` 逐字节复算一致。
- [x] 每张范围内卡至少关联一个机制条目；同一机制合并，记录代表卡号、来源、既有实现、缺口与候选原语。证据：439 条记录全部归类、`unclassified = 0`；每个机制行带 `cards`（代表卡）、`source`、`existing`、`gap`、`candidatePrimitives`；全部卡 `behaviorStatus = pending`（分类不等于逐卡行为验收）。
- [x] 将 §5 的重点机制逐项分类，核实复用能力与真实缺口；未知机制保持阻断。证据：`keyMechanisms` 8/8（7 项 `reuse+gaps`、已有关键词保持纯 `reuse`）；原语目录 77 项 = 28 reuse + 10 extend + 39 new，49 项缺口全部被机制引用并进入 P2 输入；3 项规则边界未决原语（`new.concealedExposeRange`、`new.crossSeatActionWindow`、`new.hollowCountModifierScope`）标 `blocked` 并进 `pending`；引擎关键词读点明确 patrol / concealed / customizable / shift / hollow 未支持。
- [x] 建立十章完整指南及战役地图密档段落清单，单列中文缺译和特别规则，不以“已有剧情正文”代替指南覆盖。证据：10 章指南 677 段（覆盖 heading / tokens / setup / intro / interlude / resolutions / specialRules / rules / versions / labels / characters 等层）；14 份地图密档（档案编号 ↔ 地图节点 ↔ 章节／海外幕间）；17 段幕间、8 份状况报告、12 段战役特别规则、81 个记录键；中文缺译 66 处按来源单列（指南 35 / 剧情 19 / 特别规则 12），另有 1 个记录键中文标签缺译进 `pending`。

退出门禁：未分类卡为 0，所有原语缺口进入 P2；扫描阶段不批量写卡。

**P1 完成证据（2026-11-10）**

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 机制扫描 | 439/439 归类；132 机制行六类齐全；8/8 重点机制（7 项有缺口、已有关键词纯复用） | `audit/tsk-mechanism-scan.json`；`npm run scan:tsk:check` |
| 原语缺口 | 目录 77 项 = 28 reuse + 10 extend + 39 new；49 项 `primitiveGaps` 全部被机制引用 | `primitiveGaps`；3 项 blocked 待 P2 裁决 |
| 引擎盘点 | EFFECT_PRIMITIVES 56、ctx.api 6 模块（顶点键动态读取）、窗口 113、matcher 39、kind 12、play channels 9、关键词读点 30（P2 新增原语后窗口更新为 116） | `ENGINE_INVENTORY`；`test:tsk`「P1 机制扫描」用例 |
| 指南/密档 | 10 章 677 段、14 密档、17 幕间、8 状况报告、6 特别规则（12 段）、81 记录键 | `npm run scan:tsk:check`；`test:tsk`「P1 指南与规则来源」用例 |
| 中文缺译 | 66 处（指南 35 / 剧情 19 / 特别规则 12）+ 1 记录键标签缺译 | `counts.chineseGaps`；`pending#recordKeysMissingZh` |
| 回归 | `test:tsk` 7/7；扫描不改卡、不改引擎，replay 指纹不变 | `tests/tsk-migration.test.mjs`；`artifacts/migration/tsk/reports/fast-p1.log` |

注意：P1 只登记分类与缺口，`behaviorStatus` 全为 `pending`；P0 `scope#pending` 的 7 个来源/数据差异已结转成 `audit/tsk-mechanism-scan.json#pending` 的 `verify-in-P2`，P2 开工前必须逐项裁决，不得静默带入。

### P2：拆分并实现通用原语（规范第 2 步）

- [x] 盘点 `EFFECT_PRIMITIVES`、`ctx.api`、能力 kind、窗口、matcher、目标枚举和 play channels，先复用再新增。证据：`audit/tsk-primitive-plan.json#reuse` 31 项（既有 EFFECT_PRIMITIVES 56 / ctx.api 6 模块（P2 后 `mechanics` 顶层 28 组）/ 窗口 116 / matcher 39 / kind 12 / play channels 9）全部给出模块与读点定位，未重复实现。
- [x] 为阴影与隐匿（Concealed／In the Shadows）、空洞与存在抹除（Hollow／Erased from Existence）、绯红密钥与变换（Scarlet Keys／Shift）、定制升级卡（Customizable）、世界地图与时间预算（Embark／Time）及调查员特殊行动授权建立 `reuse / new / escape` 计划。证据：`plan.p2.new` 37 项、`plan.p2.extend` 9 项、`plan.reclassified` 3 项（`new.allySlotBonus`、`new.allyReadyBonus`、`extend.assetSlots` 复议为 reuse）、`plan.escape = []`；P1 三项 blocked 原语在 `plan.adjudications` 全部裁决。
- [x] 新原语同时交付注册校验、引擎读点、正常及负面路径测试、JSON 存档往返和文档；新状态纳入版本迁移。证据：`src/engine/tsk-state.js` + `tsk-primitives.js#validateTskState` 接入 `save-migration.js`（旧存档零字节变化）；7 个新模块 + 8 个既有模块扩展；6 份 `tests/tsk-primitives-*.test.mjs` 共 41 用例（正/负路径、JSON 往返、读档校验）；`docs/campaign/theScarletKeys/primitives.md`。
- [x] 同句规则在第二张出现时提取候选，第三张前完成原语；本阶段先完成通用接口，不批量写卡，`escape` 默认保持为空。证据：P2 未新增/修改任何卡文件（`git status` 无 `src/cards/**` 变化）；`escape: []` 并在 `escapeNote` 说明单卡逻辑留到 P5/P6。
- [x] 完成 `primitive-plan.json` 与只读 `primitive-catalog.json`；所有 `new` 项为 `done`，复用项可定位，replay 对比无非预期漂移。证据：`audit/tsk-primitive-plan.json`（77 项目录全覆盖：reuse 31 / P2 new 37 + extend 9；`gapsDone 49/49`）、`audit/tsk-primitive-catalog.json`；`tools/verify-tsk.mjs --node` 记录 41/41 pass 且 replay `--compare` exit 0。

退出门禁：原语单测和 `test:fast` 无新增失败；不得留下卡号分支、直写状态或“声明无人读取”的字段。

**P2 完成证据（2026-11-10）**

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 原语目录 | 77 项全覆盖：reuse 31 / P2 new 37 / P2 extend 9；P1 的 49 项缺口 `gapsDone 49/49` | `audit/tsk-primitive-plan.json`、`audit/tsk-primitive-catalog.json`；`npm run audit:tsk:primitives` |
| 关键裁决 | 3 项 blocked 全部裁决（concealed 攻防范围、跨座位时机、空洞计数口径），分类差异 3 项均有理由 | `plan.adjudications`、`plan.reclassified`；`primitives.md` §3–§4 |
| 状态容器 | `campaign.tsk` / `scenarioFlags.mechanics.tsk` 可选扩展 `version:1`，旧存档零字节变化 | `src/engine/tsk-state.js`、`src/engine/tsk-primitives.js`、`save-migration.js` |
| 引擎扩展 | 8 个既有模块加读点：card-counters / modifiers / scenario-decks / physical-faces / map-graph / harm-threat / campaign-flow / observation + windows（3 个新窗口） | `tests/tsk-primitives-*.test.mjs` |
| 测试 | 41 用例（6 文件）全过；`test:tsk` 8/8 | `npm run verify:tsk:node`、`tests/tsk-migration.test.mjs`「P2 原语计划」 |
| 回归 | replay 基线 `--compare` exit 0（无漂移）；P2 不写卡、不改关卡 | `audit/tsk-node-acceptance.json`、`tests/fixtures/replay/tsk-baseline.json` |
| 无卡号分支 | 新引擎模块剥注释后无 `0[89]xxx` 卡号分支（门禁 `noEngineCardCodeBranches`） | `plan.gates`；`npm run audit:tsk:primitives` |
| fast | `test:fast` 7105 tests / 7098 pass / 4 fail：4 条与 P0 冻结基线逐字相同（无新增失败） | `artifacts/migration/tsk/reports/fast-p2.log` |

注意：P2 只交付通用接口与「存在才校验」的存档迁移，不再需要把 P1 的 `verify-in-P2` 数据差异带进来——这 7 项仍是 P7 内容落地前的数据来源差异，已在 `audit/tsk-mechanism-scan.json#pending` 明确保留，P7 逐章实现时按项关闭。

### P3：关键词与规则书（规范第 3 步，M4）

- [x] 对照全部卡面与指南确认隐匿（Concealed X）、巡逻（Patrol）、变换（Shift）、定制（Customizable）及已有关键词在本循环的适用性，逐项登记代表卡号。证据：`content/campaigns/theScarletKeys/keywords.js` 29 个关键词，`cardCodes` 与 P1 机制扫描 `type: keyword` 行逐张一致（复算语料 = 卡名 + 副名 + 正文 + 背面 + 定制栏 + 定制变更 + 特质），每个关键词登记全部卡号与规则条目。
- [x] 实现并验收隐匿与揭露、空洞化、绯红密钥稳定／动荡翻转、定制勾选项及巡逻移动等规则原语缺口；实际单卡字面行为仍在 P5–P7 验收，机制全链路见 §5。证据：P2 已交付 `new.concealed*`、`new.hollow*`、`new.key*`、`new.customizable*`、`new.patrolKeyword` 等原语（`audit/tsk-primitive-plan.json` 全部 `done`）；P3 审计逐关键词核对 `engineBehavior` 与 Node 验收证据。
- [x] 完成循环概览、世界地图与时间标记、阴影与隐匿迷你卡、空洞与存在抹除、绯红密钥与定制卡等规则条目及卡文直达链接。证据：`web/tsk-rules.js` 17 条双语规则（`tskCampaign`、`tskMap`、`tskStatusReports`、`tskConcealed`、`tskHollow`、`tskKeys`、`tskShift`、`tskCustomizable` 等），注册进 `web/rulebook-data.js`；439/439 卡全部有规则链接（`cardLinks.unlinked = []`），关键词卡与章节参考卡逐张核对。
- [x] 规则书只描述已实现的规则，补齐中英文、关联 ID 与检索索引，通过桌面 1440／移动 390 阅读和返回验收。证据：每条规则中英正文段数一致、`related` 全部可解析、拼音排序键与中英标题检索通过；`audit/tsk-browser-acceptance.json` 6/6 用例通过（desktop 1440 / mobile 390 × zh-CN/en、卡文直达、无横向滚动），截图在 `artifacts/migration/tsk/reports/screenshots/`。
- [x] 建立 `confirmations.keywords`、`confirmations.rulebook`；符合条件的条目由审计写入 `verified`。证据：`audit/tsk-rules.json#confirmations`：keywords 29/29 verified、rulebook 17 条 verified，门禁全真；规则正文经 `ENGINEERING_WORDS` 门禁确认不含实现/引擎/验证字样。

退出门禁：本批卡牌所依赖的关键词已验收；未实现机制不能以可用规则条目开放。

**P3 完成证据（2026-11-10）**

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 关键词 | 29 个全部 verified：7 个本循环新增规则条目 + 19 个复用基础条目 + 3 个本循环单独成条（Objective / Resign / Bonded） | `audit/tsk-rules.json#confirmations.keywords`；`content/campaigns/theScarletKeys/keywords.js` |
| 规则书 | 17 条中英双语规则全部 verified；只写规则本身，不含实现字样 | `web/tsk-rules.js`；`web/rulebook-data.js`；`npm run audit:tsk:rules` |
| 卡文直达 | 439/439 卡有规则链接；29 个关键词的卡面来源逐张命中对应条目 | `confirmations.rulebook.cardLinks`；`tests/tsk-rules.test.mjs` |
| 浏览器验收 | 6/6 用例通过（desktop 1440 / mobile 390 × zh-CN/en、目录/搜索/阅读/返回、卡文直达与焦点恢复、无横向滚动） | `audit/tsk-browser-acceptance.json`、`artifacts/migration/tsk/reports/screenshots/` |
| 确定性 | 规则审计账本逐字节可复算；来源 6 份 SHA-256 全部登记 | `npm run audit:tsk:rules`；`tests/tsk-rules.test.mjs` |
| 测试 | `node --test tests/tsk-rules.test.mjs` 4/4；`npm run test:tsk` 53/53（迁移 8 + 原语 41 + 规则书 4） | `tests/tsk-rules.test.mjs`；`tests/tsk-migration.test.mjs` |
| fast | `test:fast` 7109 tests / 7102 pass / 4 fail：4 条与 P0 冻结基线逐字相同（无新增失败） | `artifacts/migration/tsk/reports/fast-p3.log`、`p3-report.md` |

注意：P3 只交付「关键词身份 + 规则条目 + 卡文直达 + 验收证据」；单卡字面行为仍由 P5–P7 逐卡验收，未实现机制不会以可用规则条目开放。

### P4：新增交互与界面（规范第 4 步）

- [x] 完成阴影区域展示、地点旁正面朝下隐匿迷你卡的摆放／混洗／目标选择／揭露（Expose）、三位置阴影地点（左／中／右）等扫描确认的新交互。证据：`src/engine/tsk-interactions.js#concealed`（揭露/轮末重排/范围读点）+ `web/mechanic-ui.js` 摘要（地点·位置·正反面状态，未揭露不显示真身）+ `tests/tsk-interactions.test.mjs`；浏览器用例「隐匿迷你卡揭露与空状态」覆盖合法/非法/取消/空状态。
- [x] 完成绯红密钥持有／夺取／稳定与动荡变换（Shift）、空洞区（Hollows）查看与回收、世界地图目的地选择与快捷旅票使用、定制升级卡勾选项面板及卡森跨座位即时行动授权等交互，复用现有组件、CSS 变量和服务端合法动作。证据：`interactions.tsk.keys/hollows/map/customizable/crossSeat` 事务 + 摘要面板（`[data-tsk-*]`）+ locale 片段；6 组 × 桌面/移动浏览器用例全过。
- [x] 确认未揭露隐匿迷你卡的真身／诱饵身份、未解锁密档、异界牌库顺序与条件剧情的座位可见性，不向客户端观察投影或演出快照泄露正面身份。证据：`src/integration/mechanic-view.js#tskView` 只投影位置/可见性、密档只给解锁/已读 key、异界只给张数；`maskMechanicSnapshot` 对他人勾选/授权再掩码；`tests/tsk-interactions.test.mjs`「观察投影与快照掩码」逐项断言。
- [x] 幕／议程行动正确标记 `scriptCard`，在剧本书对应卡片旁显示，包含不可用原因。证据：通用证据 spec `tests/script-actions-tfa.browser.mjs` 在 P4 配置中桌面/移动各跑一条，`audit/tsk-interactions.json#checks.scriptOwnership` 全真。
- [x] 复用固定“关卡设置”入口：剧本书右侧、混乱提示卡下方；特别规则优先，后续剧情与结局默认折叠。证据：通用证据 spec `tests/scenario-guides.browser.mjs`（完整指南按需加载、失败重试与键盘焦点），`checks.guidePlacementAndPrivacy` / `guideFailureRetryAndKeyboard` 全真。
- [x] 桌面 1440／移动 390 覆盖合法、非法、空状态、取消／重试、键盘操作与焦点恢复，保存截图和报告。证据：`audit/tsk-interactions-browser.json` 16/16 用例通过、14 张截图（`artifacts/migration/tsk/p4/screenshots/`）；取消/Escape 焦点恢复由通用机制与用例覆盖。

退出门禁：新增交互已通过浏览器验收，再进入批量卡牌阶段；不得在卡批次中临时拼接界面。

**P4 完成证据（2026-11-10）**

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 交互事务 | 6 组交互（隐匿揭露/密钥变换/空洞回收/地图启程/定制勾选/跨座位授权）+ 转移与执行变体；全部走服务端选择事务，取消零写入、空候选不暂停 | `src/engine/tsk-interactions.js`；`tests/tsk-interactions.test.mjs` |
| 界面 | 交互摘要面板（`[data-tsk-*]`）+ 选择面板复用既有 `.ah-mechanic-choice`；中英文案齐备 | `web/mechanic-ui.js`、`web/mechanic-ui.css`、`web/locales/{zh-CN,en}.misc.js` |
| 投影隐私 | 未揭露身份/密档正文/异界牌序/他人勾选与授权不泄露；快照再次掩码 | `src/integration/mechanic-view.js`；Node 隐私用例 |
| 浏览器验收 | 16/16 通过（6 组交互 × 桌面 1440 / 移动 390，另有两条通用证据 spec）；14 张截图；覆盖矩阵/脚本归属/指南/基线/fast/replay 六类检查全真 | `audit/tsk-interactions-browser.json`、`audit/tsk-interactions.json` |
| 回归 | replay 精确一致；fast **7118 tests / 7111 pass / 4 fail**：4 条与 P0 冻结基线逐字相同（`additionsSinceInitialBaseline = []`，无新增失败）；`test:tsk` 62/62 | `audit/tsk-regression.json`；`artifacts/migration/tsk/reports/p4-report.md` |

注意：P4 只交付交互与界面，不开放内容；测试夹具只在验收进程内使用，不进生产组合根。完整十章指南与逐章流程仍在 P7。

### P5：调查员及专属依赖（规范第 5 步，M1）

中文显示名最终以锁定的本项目中文数据为准；此处用卡号及中英文名对照。

- [x] `09001` Carson Sinclair（卡森·辛克莱）：次级职阶三选一构筑、专属额外行动授权同地点另一调查员立即执行一次行动（每轮每人限一次）、旧印自己与同地点队友触发及专属依赖 `09002`（2 张）、`09003`。证据：受限额外行动 + `api.beginImmediateAction`、每轮每人一次记账、投入他人检定记账；`tests/tsk-investigator-09001.test.mjs`。
- [x] `09004` Vincent Lee（文森特·李）：“治愈伤害”文本匹配构筑、开局按人数场外预置 `09006` 术后恢复、卡牌效果治愈调查员或盟友伤害后发放术后恢复、旧印及专属依赖 `09005`、`09006`、`09007`。证据：`investigator.setup.setAsideSignature`、`damageHealed` 窗口反应、`zoneReplacement→setAside`；`tests/tsk-investigator-09004.test.mjs`。
- [x] `09008` Kymani Jones（基玛尼·琼斯）：构筑、快速交战横置敌人、躲避已横置非精英敌人时将智力加入技能值且按超过难度至少剩余生命值直接弃置敌人、旧印及专属依赖 `09009`、`09010`。证据：`freeAction` 快速交战、`testBegins`/`evadeSuccess` 窗口、额外 5 经验；`tests/tsk-investigator-09008.test.mjs`。
- [x] `09011` Amina Zidane（阿米娜·齐达内）：构筑、每轮一次打出支援减 3 费并带 1 毁灭入场、旧印同地点卡牌间转移全部毁灭及专属依赖 `09012`、`09013`、`09014`。证据：`beforePlayCost`（每轮一次）+ `assetEnteredPlay` 毁灭、旧印全量转移；`tests/tsk-investigator-09011.test.mjs`。
- [x] `09015` Darrell Simmons（达雷尔·西蒙斯）：构筑、开局 `09016` 达雷尔的柯达相机在场、地点/敌人/诡计上的证据收集、检定期间花费 1 证据使难度降低 2（每次检定限一次）、旧印及专属依赖 `09016`、`09017`。证据：`investigator.startsWith`、`evidence` 具名计数器、`reduceTestDifficulty` + `oncePerTest`；`tests/tsk-investigator-09015.test.mjs`。
- [x] `09018` Charlie Kane（查理·凯恩）：双次级职阶构筑、额外 3 个盟友槽位、检定期间横置受控盟友按基础 `+1` 及匹配图标数加成、旧印重整同地点盟友及专属依赖 `09019`、`09020`。证据：`investigator.extraSlots`（assets 容量读点）、`freeAction.duringOwnSkillTest` + `api.cardIcons`、`assetExhausted` 窗口；`tests/tsk-investigator-09018.test.mjs`。
- [x] 六位调查员分别通过初始化、能力、构筑合法／非法、专属依赖、多人窗口和存档恢复；自动／手动构筑共用服务端规则。证据：`tests/tsk-investigator-signatures.test.mjs` + `audit/tsk-investigators.json`（逐人 verified）；浏览器 12/12（6 人 × 桌面 1440 / 移动 390，12 张截图）。

退出门禁：逐位证据完整才开放该调查员；已有同名版本不自动证明本编号与依赖已完成。

### P6：一般玩家卡批量迁移（规范第 5 步，M2）

- [x] 主进程生成 `shards.json`，按卡号／职阶／机制拆成适当分片，检查无交集、并集覆盖全部一般玩家卡（含各职阶定制升级卡、空洞交互卡、毁灭／证据／治疗／工具协同卡与基础弱点）。证据：`tools/plan-tsk-player.mjs` → `audit/tsk-player-shards.json`（4 片 ×27，108 张无交集、并集等于 scope 分区；16 张定制卡与 5 张基础弱点逐张归类；`--check` 复算一致）。
- [x] 按通用规范使用主进程与 worker 分工：worker 只写分配的单卡文件、进度和原语请求；共享层、账本、文档及索引由主进程维护。证据：4 个分片 worker 输入 `artifacts/migration/tsk/workers/w-m2-N.input.json`；worker 产出 108 张条目 + 4 份分片测试 + 56 份原语请求；索引/账本/文档由主进程重签。
- [x] 逐卡核对费用、定制勾选项（半费构筑、经验阈值、附加词条、槽位／类型／属性变更）、使用次数、目标、窗口、区域、持续时间、每轮／每局限制及负面路径。证据：四片 126 例逐卡行为测试全绿（`tests/tsk-player-m2-{1..4}.test.mjs`）；16 张定制卡 `customizationOptions` 与 `artifacts/migration/tsk/workers/options.json` 逐字一致并在注册期登记到 `tsk-customizable` 原语。
- [x] 缺原语时写 `primitive-requests/*.json` 并将卡记为 `blocked`；主进程实现并验证后再恢复，不绕过 API 直写状态。证据：56 份请求（31 个卡号）逐条评审为 `deferred`（P7/P8 原语 backlog），条目 note 逐条披露近似；账本 `primitiveBacklog` 可查、`noPendingRequests` 门禁通过；R1/R2/R3 条目合规无新增违规。
- [x] 跨包／跨循环重印只保留 canonical 实现；每张卡登记 `descriptor / legacy / hybrid / missing` 和测试证据。证据：04096↔09587（canonical 04096，本循环只锁映射不建实现）、09064↔12049（canonical 09064，本循环实现一份）；账本逐卡 `channel` 与 `implementation` 哈希，108/108 verified。
- [x] 合并后统一重建索引，完成单卡检查、R1/R2/R3 审计、replay 对比与 `test:fast`，队列无悬挂。证据：索引 1042 张；`cards:check`/`audit:entries` 通过；TSK golden replay `--compare` exit 0；fast 仅剩 P0 冻结 4 条；浏览器 10/10（`audit/tsk-player-browser.json#status = passed`）。

退出门禁：开放卡全部有可执行行为与证据；`missing`、简化卡和阻塞卡不进入已完成数量或构筑池。P6 结果：108/108 verified（61 张近似逐条披露、不冒充等价），103 张可构筑 + 5 张基础弱点依赖；阻塞请求 0（56 份 `deferred` 逐条可查）。

### P7：共享遭遇、十章及战役流程（规范第 5 步，M3）

- [x] 先迁移战役内共享遭遇组（红色同志会、环球漫游、暗影、异界、清理小队、深红密谋等），再按 §4 落地十章与世界地图密档；按归属目录分片，避免共享卡重复实现。证据：16 组 66 张共享卡一卡一条目（`src/cards/encounter-entries/theScarletKeys/_shared/**`，snake_case 组目录），`tests/tsk-shared-encounters-{a,b}.test.mjs` 54 例全绿；归属算法 0 unresolved（`tools/encounter-entry-placement.mjs`）。
- [x] 十章逐项完成准备、红色同志会乱入与绯红密钥配置、区域守恒、地点连接、全部幕／议程正反面、阴影与隐匿迷你卡、敌人／诡计／剧情资产、符号与结局。证据：`content/campaigns/theScarletKeys/scenarios/<id>/{definition,layout,behavior,chaos,index}.js` 十章齐备；`audit/tsk-scenario-acceptance.json` 逐章 `verified`（模块/清单/布局/behavior/遭遇组/指南/测试/条目 8 项全真）。
- [x] 严格按原版规则实现伦敦序幕关 → 幕间 I → 世界地图启程循环（含时间消耗、12 段密档幕间、状况报告 `α–ω` 与快捷旅票） → 通古斯卡终章 → 尾声。证据：`flow.js` 143 节点（序幕/10 章/17 段幕间/8 状况报告/14 密档/快捷旅票/终章/尾声）+ `parts.js#tskNextStep`（时间 ≥35 强制终章）；`tests/tsk-campaign-flow.test.mjs` 13 例、`tests/tsk-interludes.test.mjs` 21 例全绿。
- [x] 根据实际到达关卡与密档规则处理经验结算、升级窗口、被盗密钥夺回及 `02310`／存在抹除卡（`ErasedFromExistence`）的战役构筑禁用。证据：`records.js`（94 个战役记录键 + 3 个章节记录扩展键）、`flow.js#upgradeWindows` 与章末/幕间 XP 结算、`shared.js#CHAPTER_MAP_TRIGGERS` 与 `campaignFlowExtras.travelTriggers`、`ERASED_CAMPAIGN_CARDS` 禁用；`audit/tsk-scope.json` 的 `invalidCards` 锁定。
- [x] 从锁定来源生成完整叙事（含全部密档与状况报告），覆盖所有可达分支；运行时只显示已到达且有权查看的正文，历史正文不被当前记录改写。证据：`tools/import-tsk-story.mjs` → `story-text.js`（campaign 458 叶 + 10 章 677 叶，来源锁 14 个 locale 文件 + 3 个补译层，`--check` 一致、chineseGaps=0）；`tests/tsk-story.test.mjs` 7 例全绿。
- [x] 每章同步生成完整中英文指南，补译并标记缺项，通过来源覆盖、生成校验、Node 和浏览器验收。证据：10 份 `web/scenario-guides/<id>.json`（指南生成器逐字节复算一致、guideKeyCount 与 P1 扫描对齐、officialChinese=false 明确标注）、`content/scenario-guides.js` 补十章设置面板说明；`tests/eote-story.test.mjs` 12 例全绿（72 场景生成物一致）；`audit/tsk-scenarios-browser.json#status=passed`（桌面 1440 / 移动 390，20 张截图）。
- [x] 十章完成 §6 的 P7 章级确认（模块/清单/布局/behavior/遭遇组/指南/测试/条目 8 项），战役记录、时间轴、地图节点、绯红密钥归属、空洞抹除、混乱袋和存档跨章一致。证据：`audit/tsk-scenario-acceptance.json` 12 项 gates 全真（10/10 章 verified、章测试 262 例、条目 301/301、指南 10/10、战役注册 playable、flow/records 声明、浏览器双视口）；各章测试含 JSON 往返 + `validateTskState`。§6 模板中的逐卡字面行为、逐章 saveReplay/浏览器确认按分工留 P8 发布验收（见 P8 清单）。

退出门禁：每章的行为（章测试 + 一卡一条目 + 近似逐条披露）与指南均有证据；章内定向夹具不能代替真实大厅路线，逐卡字面行为、逐章 saveReplay/浏览器与发布账本汇总由 P8 验收。

### P8：整体验收与发布（规范第 6 步，M5）

- [x] 汇总 `audit/tsk-migration.json`：来源哈希、逐卡账本、原语队列、章节、关键词、规则书、指南和截图证据可追溯。证据：`tools/audit-tsk-migration.mjs --check` 复算一致（`status: verified`，16 项门禁全真）；30 份来源文件 sha256、`audit/tsk-all-card-acceptance.json` 439 行逐卡账本（missing=0/blocked=0）、原语请求 175 份全部 `deferred`（P9 backlog，`artifacts/migration/tsk/primitive-adjudication.json`）、十章 `audit/tsk-scenario-acceptance.json`、29 关键词/17 规则 `audit/tsk-rules.json`、指南生成物、三份发布浏览器账本（release/customization/epilogue）与逐张截图 sha256 均可复算。
- [x] 覆盖完整合法战役（多条跨洲航线组合、提前前往通古斯卡与 35 时间超时强制终局）、失败／撤退路线、同志会化敌为友／敌对分支、四档难度、存档恢复和 replay。证据：`tests/tsk-p8-campaign.test.mjs` 8 例 + `tests/tsk-p8-fixes.test.mjs` 4 例（真实 `createGameState`+生产组合根）：三条多航线、α/ε 状况报告、时间 ≥35 只给通古斯卡→钥匙议会→尾声、四档难度、JSON 往返后继续、失败/撤退回地图、幕间取快捷旅票直达未解锁节点、权限边界；另修复结局 `api.addTrauma` 双口径、章节时间并入 35 时间轴、双面卡基础号存档解析、TSK 基础弱点手动构筑许可；同志会三种结局与化敌为友/敌对记录由 `tests/tsk-campaign-flow.test.mjs`/`tests/tsk-interludes.test.mjs`/章测试覆盖；`replay-fixtures --compare` 13 局零漂移。
- [x] 从真实大厅验证选战役、选人、构筑（含定制卡初始勾选与关间升级勾选）、开局、地图启程、逐章推进与尾声；覆盖多人、AI、断线恢复和权限边界。证据：`audit/tsk-release-browser.json#status = passed`（3 phase × 桌面 1440/移动 390 = 6 行：真实大厅→选人/自动构筑→开局→世界地图启程→逐章推进→联机/隐私/权限/断线，62 张截图）；`audit/tsk-customization-browser.json#status = passed`（2 spec × 双视口：构筑期初始 0 勾选面板 + 关间真实 `hubCustomize` 扣 XP 勾选 + 刷新恢复，12 张截图）；`audit/tsk-epilogue-browser.json#status = passed`（2 spec × 双视口：真实时间累积至 35→被迫启程通古斯卡→钥匙议会终章→尾声→`campaignResult`，20 张截图）；定制/地图/密钥/隐匿等 6 组交互面板另有 `audit/tsk-interactions-browser.json`（16/16）。三份账本合计 8 行测试、94 张截图。
- [x] 通过单卡及合规门禁、指南生成检查、本循环测试与审计、既有 replay、全量回归、展示数据和浏览器检查。证据：`cards:check` / `cards:encounter-check` / `audit:entries` 通过；`import-scenario-guides` 生成校验一致；TSK 审计链（scope/baseline/mechanism/primitive/node/rules/interactions/investigators/player/scenario/all-cards/regression）`--check` 全绿；`replay-fixtures --compare` 零漂移；`verify-tsk-regression` 全量 fast 7664 例无新增失败（仅 P0 冻结 4 条）；`build-presentation --check`、`check-doc-links` 通过；三份发布浏览器账本 passed。
- [x] 核对本循环英文／中文卡图库存与远程回退，发布运行时不依赖 `参考资源/`。证据：439/439 记录图像解析可解析（本地 439、中文本地化 419，无 unresolved）；`node tools/fetch-images.mjs --verify --scope=manifest` → `manifestPresent/contentComplete/missing=0/invalid=0`；运行时源码扫描 `src/lib/content/web` 对 `参考资源/` 的真实读取依赖 = 0（仅文档/注释溯源不计）。已知素材项：09537 单张卡图请求 404（浏览器证据登记，页面无 pageerror、远程候选可回退；P9 素材补齐）。
- [x] `confirmations.scenarios / keywords / rulebook` 全部 `verified`，且发布验收全部完成后，才确认完整迁移完成。证据：`audit/tsk-migration.json#confirmations`：scenarios 10/10（§6 12 项齐全）、keywords 29/29、rulebook 6/6；`content/migration-confirmation.js#assertMigrationConfirmations` 复算通过；`playable: true`、`earlyAccess: false`、`equivalenceCertified: true`。
- [x] 不采用提前开放：全部发布门禁真实通过后以 `earlyAccess:false` 发布，未设置 `releaseAcceptance.deferred` 项；如将来需要提前开放，另行证明基础门禁并在 `releaseAcceptance.deferred`、`remaining` 和大厅明确延后项（本阶段无延后项、无阻塞卡、无未披露近似）。

退出门禁：无新增失败，既有失败单独记账；无未披露的近似、阻塞卡或待实现原语。全部发布证据完成后才能撤销提前开放标识。

## 4. 十章路线与逐章清单

以下名称来自本地中文剧情与卡表；真实提示卡号来自 `theScarletKeys.json`。除首章《谜雨》与终章《钥匙议会》外，其余八章由玩家在世界地图自由规划航线按时间解锁游玩。

| 顺序 | 章节 | scenarioId | 提示卡号 | 所在地／档案号 | 优先验收内容 |
| --- | --- | --- | --- | --- | --- |
| 1 | 谜雨 / Riddles and Rain | `riddlesAndRain` | `09501` | 伦敦 | 序幕关、阴影区域与隐匿迷你卡教学、红手套男子追踪、奎因特工与时间起点 |
| 2 | 死亡酷暑 / Dead Heat | `deadHeat` | `09520` | 马拉喀什（`#11-B`） | 平民救援与杀害计数、苏生死者生成、阿玛兰斯与灾毁之钟密钥争夺 |
| 3 | 血色阴影 / Sanguine Shadows | `sanguineShadows` | `09545` | 布宜诺斯艾利斯（`#16-D`） | 标靶标记分配与轮转、拉奇卡·罗哈隐匿定位、真身／诱饵混洗与时间奖惩 |
| 4 | 暗中交易 / Dealings in the Dark | `dealingsInTheDark` | `09566` | 君士坦丁堡（`#21-F`） | 异教徒抢夺线索、彰显的线索、日食计数重翻密谋、艾婕信任／敌对与密室突围 |
| 5 | 疯星乱舞 / Dancing Mad | `dancingMad` | `09591` | 哈瓦那（`#28-I`） | 谈判潜入模式与战斗警报切换、德西交涉、阴影敌人与投入卡空洞化 |
| 6 | 如履薄冰 / On Thin Ice | `onThinIce` | `09609` | 安克雷奇（`#33-K`） | 荒野追踪、虚空奇美拉四类分裂形态、手牌／牌库顶／支援空洞化与回收 |
| 7 | 战争疮痍 / Dogs of War | `dogsOfWar` | `09635` | 亚历山大（`#38-N`） | 暗红骑士与野兽之牙三路线分支、巡逻敌人、钥匙节点（Key Locus）守护或破坏 |
| 8 | 苦痛之影 / Shades of Suffering | `shadesOfSuffering` | `09660` | 吉隆坡（`#46-Q`） | 福林特工状态分支、朱三娘与影穑（The Shade Reaper）充能、灵怪交互与伞密钥 |
| 9 | 不留痕迹 / Without a Trace | `withoutATrace` | `09681` | 百慕大三角（`#56-Y`） | 异界牌库（Otherworld deck）、左／中／右阴影地点揭露入场、个人空洞数修正与逃生 |
| 10 | 钥匙议会 / Congress of the Keys | `congressOfTheKeys` | `09694` | 通古斯卡（`#59-Z`） | 红手套男子与同志会投票、密谋三版本分支、异界终局、全部密钥与存在抹除结局 |

战役推进骨架（按参考战役 `TheScarletKeys.hs` 的 `nextStep`、`embark` 与 `travel` 核对）：

```text
序幕 → 谜雨（09501） → 幕间 I：基金会（真相／隐瞒选择，初始化世界地图）
     → 世界地图启程循环（Embark & Travel）：
        ├─ 选择目的地计算最短路径耗时（跨大洲额外 +1 时间；可放逐快捷旅票 09765 记 1 时间直达）
        ├─ 累计时间跨越 7 / 10 / 15 / 20 / 24 / θ / ψ / 35 时依次触发状况报告 α / ε / β / ζ / γ / θ / ψ / ω
        ├─ 主线关卡节点：马拉喀什（09520）、布宜诺斯艾利斯（09545）、君士坦丁堡（09566）、哈瓦那（09591）、
        │               安克雷奇（09609）、亚历山大（09635）、吉隆坡（09660）、百慕大三角（09681）
        ├─ 密档幕间节点：坎布尔／基多／圣胡安／雷克雅未克（#14-C）、百慕大（#20-E）、莫斯科／旧金山（#26-G）、
        │               伦敦（#27-H）、上海（#32-J）、孟买／斯德哥尔摩（#36-L）、拉各斯／东京（#37-M）、
        │               里约热内卢（#44-O）、马诺夸里（#45-P）、悉尼（#49-R）、香港（#50-S）、罗马（#51-T）、
        │               宜博市（#52-U）、加德满都（#53-V）、内罗毕（#54-W）、珀斯（#55-X）
        └─ 时间达到 35 触发状况报告 ω 强制前往通古斯卡，或在解锁 #59-Z 后主动前往通古斯卡
     → 钥匙议会（09694） → 尾声
```

- [x] C1 谜雨：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-riddlesAndRain.test.mjs` 全绿。
- [x] C2 死亡酷暑：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-deadHeat.test.mjs` 全绿。
- [x] C3 血色阴影：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-sanguineShadows.test.mjs` 全绿。
- [x] C4 暗中交易：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-dealingsInTheDark.test.mjs` 全绿。
- [x] C5 疯星乱舞：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-dancingMad.test.mjs` 全绿。
- [x] C6 如履薄冰：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-onThinIce.test.mjs` 全绿。
- [x] C7 战争疮痍：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-dogsOfWar.test.mjs` 全绿。
- [x] C8 苦痛之影：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-shadesOfSuffering.test.mjs` 全绿。
- [x] C9 不留痕迹：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-withoutATrace.test.mjs` 全绿。
- [x] C10 钥匙议会：§6 全部通过，记录证据。证据：`audit/tsk-scenario-acceptance.json` 本章 verified；`tests/tsk-scenario-congressOfTheKeys.test.mjs` 全绿。
- [x] 世界地图距离计算、时间累计、状况报告 `α–ω`、全部密档幕间（`14–55`）与被盗密钥追回均完成独立测试。证据：`tests/tsk-campaign-flow.test.mjs`（36 旅行节点/时间轴/状况报告顺序）与 `tests/tsk-interludes.test.mjs`（17 段幕间、ζ 夺钥与 #14 追回）。
- [x] 尾声覆盖同志会同盟／敌对、密钥归属及存在抹除等全部可达分支，无未触发剧情泄露。证据：`epilogue.js` 三结局 + `flow.js` 尾声节点正文全部走 story-text；`tests/tsk-campaign-flow.test.mjs` 尾声三结局用例。

## 5. 本循环重点机制检查表

此表是扫描和验收重点，不表示已穷尽本循环机制，也不预设全部需要新增引擎能力。P1–P2 必须先盘点现有能力与地图、隐藏信息、卡牌升级接口，再决定扩展。

- [x] **阴影区域（In the Shadows）与隐匿迷你卡（Concealed X）**：敌人或阴影地点进入阴影时拿取对应隐匿迷你卡及 `X × 调查员数` 张诱饵（Decoy）正面朝下混洗分配到指定地点；在有隐匿迷你卡的地点通过调查、攻击、躲避或卡牌效果揭露（Expose）1 张；揭露诱饵时翻面移除，揭露真身时将对应敌人移到该地点（或将阴影地点揭示入场）并触发 `exposed` 窗口；轮末或卡牌效果重新混洗位置。
- [x] **空洞（Hollow）与存在抹除（Erased from Existence）**：将手牌、牌库顶、投入卡或场上非弱点卡移出场外记为“空洞”（`hollowed`）；按个人或全队空洞数量计算修正、触发效果或回收洗回牌库；终局或结局将空洞卡记入 `ErasedFromExistence` 永久从牌组移除并禁止在剩余战役中构筑（含战役全程禁用 `02310` 戴红手套的男子）。
- [x] **绯红密钥（Scarlet Keys）与变换（Shift）**：双面钥匙卡（`[[Stable]]` 稳定面与 `[[Unstable]]` 动荡面）在调查员与敌人之间的绑定、转移与夺取；每轮一次或强制触发 `Shift` 结算当前面效果并翻面；敌人变换附属密钥、状况报告 `ζ` 盗走密钥及圣所追回。
- [x] **世界地图启程（Embark）、时间轴（Time）与状况报告**：地图节点邻接图、跨区航线耗时计算、已访问与已解锁节点状态、快捷旅票（`09765`）放逐直达、时间跨越阈值按序触发状况报告 `α/ε/β/ζ/γ/θ/ψ/ω`、时间满 35 强制跳转通古斯卡。
- [x] **定制（Customizable）升级卡**：每张定制卡的勾选项定义（格数、名称、解锁效果）、构筑时勾选项经验折半（向上取整）计入等级、关间升级勾选累积、运行时按已勾选条目动态改变卡牌费用、槽位、特性、图标或附加能力。
- [x] **红色同志会（Red Coterie）与巡逻（Patrol）**：同志会核心成员在“恩怨未了”池、盟友池与已击败池之间的转换，状况报告 `ε` 后每关设置随机抽 1 名“恩怨未了”同志会敌人洗入遭遇牌库；`Patrol` 敌人在敌军阶段按最短路径向指定目标地点移动。
- [x] **调查员特殊能力**：卡森跨座位即时行动授权、文森特“治愈伤害”构筑匹配与术后恢复发放、基玛尼智力躲避直接弃置横置敌人、阿米娜带毁灭减费入场与毁灭搬移、达雷尔证据生成与花费降难度、查理·凯恩多盟友槽与横置盟友图标加成。
- [x] **已有关键词及模板**：猎手、冷漠、反击、警戒、险境、涌动、流放等以实际扫描结果为准；已有实现也要验证本循环所需时机与交互。

## 6. 每章完成模板

每章在 `confirmations.scenarios.items` 建立独立记录并复制本清单。各项必须附源码、行为测试或审计证据；只检索卡号、文本非空或条目存在均不足以通过。

- [ ] `sourceLocked`：卡面、规则、指南和剧情来源及哈希完整。
- [ ] `identityRegistered`：真实提示卡号、名称、章节身份及布局对应正确。
- [ ] `setupAndZones`：准备、同志会乱入、绯红密钥、隐匿迷你卡池、空洞区、遭遇／保留／移除／胜利区和随机变体守恒。
- [ ] `actsAndAgendas`：全部幕／议程、推进、背面、行动及 `scriptCard` 归属通过。
- [ ] `locationsAndConnections`：地点正反面、连接、阴影三位置／异界牌库、动态变体与离场通过。
- [ ] `encounterBehaviors`：专属与共享敌人、隐匿实体、诡计、绯红密钥与剧情资产行为全部接线。
- [ ] `literalCardBehavior`：逐卡逐能力核对费用、目标、区域、限制、持续时间与清理；合法入口出现、非法入口不出现、结果符合卡面。
- [ ] `chaosEffects`：四档提示卡与符号时机、隐匿／空洞／密钥联动和相关触发通过。
- [ ] `resolutionsAndRecords`：全部可达结局、时间消耗、密钥归属、同志会状态、空洞抹除、经验、创伤、混乱袋和跨章记录通过。
- [ ] `storyText`：完整叙事与完整中英指南覆盖开场、分支、设置、特别规则、后续剧情、结局和结算；实际演出只投影已到达分支。
- [ ] `saveReplay`：关键选择前后 JSON 往返、恢复及 replay 确定性通过。
- [ ] `browserAcceptance`：真实大厅、桌面 1440／移动 390、指南入口位置、特别规则、折叠剧透、中英切换、重试与键盘操作通过。

## 7. 验证命令与记录方式

以下命令在 `games/arkhamhorror/` 执行。P0 的 baseline 必须先于行为修改，compare 在修改后执行；其余按对应阶段运行。

```powershell
# 从 Mod 目录指向大厅根目录的运行资料
node tools/replay-fixtures.mjs --baseline ../../artifacts/migration/tsk/replay-before.json
node tools/replay-fixtures.mjs --compare ../../artifacts/migration/tsk/replay-before.json

npm run cards:check
npm run cards:encounter-check
npm run audit:entries
npm run test:fast

node tools/import-scenario-guides.mjs --write
node tools/import-scenario-guides.mjs --check
node --test tests/scenario-guides.test.mjs
npx playwright test --config tests/playwright/playwright.config.mjs scenario-guides.browser.mjs

npm run replay:fixtures
npm test
npm run presentation:check
npm run test:browser
npm run images:verify
npm run docs:check
```

本循环计划注册的专项命令如下（随各阶段推进落地，扫描、计划及审计生成与 `--check` 校验分开；检查不重写基线）。P0–P2 已落地前十一条：

```powershell
# P0（已落地）：范围账本与原始基线；--check 只校验不重写
npm run scan:tsk:scope
npm run scan:tsk:scope:check
npm run scan:tsk:baseline
npm run scan:tsk:baseline:check
npm run test:tsk

# P1（已落地）：机制扫描账本与指南/密档来源
npm run scan:tsk
npm run scan:tsk:check

# P2（已落地）：原语 Node 验收证据 + 原语计划/只读目录
npm run verify:tsk:node
npm run plan:tsk:primitives
npm run audit:tsk:primitives

# P3（已落地）：关键词与规则书
npm run plan:tsk:rules
npm run audit:tsk:rules
npm run test:tsk:rules:browser

# P4（已落地）：交互事务/投影/界面 + 浏览器与回归证据
node tools/verify-tsk-regression.mjs
npm run plan:tsk:interactions
npm run audit:tsk:interactions
npm run test:tsk:interactions:browser

# P5（已落地）：调查员与专属依赖 + 浏览器与回归证据
node --test tests/tsk-investigator-*.test.mjs
node tools/run-tsk-investigators-browser.mjs
npm run plan:tsk:investigators
npm run audit:tsk:investigators

# P6（已落地）：一般玩家卡 108 条 + 浏览器与回归证据
node tools/plan-tsk-player.mjs --write
node tools/plan-tsk-player.mjs --check
node tools/tsk-player-options.mjs --write
npm run test:tsk:player
npm run audit:tsk:player
npm run test:tsk:player:browser

# P7+（计划）
npm run audit:tsk
npm run audit:tsk:investigators
npm run audit:tsk:check
```

### 阶段总览与证据登记

- [x] P0 范围与基线完成。
- [x] P1 机制扫描完成。
- [x] P2 原语完成。
- [x] P3 关键词与规则书完成。
- [x] P4 交互完成。
- [x] P5 调查员及专属依赖完成。
- [x] P6 一般玩家卡完成。
- [x] P7 十章、世界地图、密档幕间、指南及战役流程完成（2026-11-11，证据见 §3 与 `audit/tsk-scenario-acceptance.json`）。
- [x] P8 发布验收完成，完整迁移交付（2026-11-12，证据见 §3 P8 清单与 `audit/tsk-migration.json`）。

| 日期 | 项目 | 状态／勾选依据 | 验证结果 | 证据路径 |
| --- | --- | --- | --- | --- |
| 2026-11-03 | 规划准备 | 完成规范阅读、来源定位、十章及地图密档路线与清单建立；实现阶段均未勾选 | 文档链接检查通过 | `docs/campaign/theScarletKeys/README.md` |
| 2026-11-10 | P0 范围与基线 | 439 条记录三包守恒（311/20/108）、26 遭遇组、10 章、10 双面密钥、16 定制卡；427 来源 SHA-256；三包 `catalog-only` 注册、战役与十章不进生产组合根、439 卡不可构筑/选人 | `scan:tsk:scope:check` 复算一致；`scan:tsk:baseline:check` 复算一致（replay 13 局 / 797 步 `--compare` exit 0）；`test:tsk` 5/5；fast 7056/7049/4（4 条为既有失败） | `audit/tsk-scope.json`、`audit/tsk-baseline.json`、`tests/fixtures/replay/tsk-baseline.json`、`tests/tsk-migration.test.mjs`、`artifacts/migration/tsk/reports/fast-baseline.log` |
| 2026-11-10 | P1 机制扫描 | 439/439 记录归类（unclassified=0）；132 机制行六类齐全；8/8 重点机制（7 项 reuse+gaps、已有关键词纯复用）；原语目录 77 项 = 28 reuse + 10 extend + 39 new，49 项缺口全部被机制引用；10 章 677 段指南、14 地图密档、17 幕间、8 状况报告、81 记录键、66 处中文缺译单列 | `npm run scan:tsk:check` 复算一致；`test:tsk` 7/7；扫描不改卡/引擎，replay 基线不变 | `audit/tsk-mechanism-scan.json`、`tools/tsk-guide-scan.mjs`、`tests/tsk-migration.test.mjs`、`artifacts/migration/tsk/reports/fast-p1.log` |
| 2026-11-10 | P2 通用原语 | 77 项目录全覆盖（reuse 31 / P2 new 37 + extend 9）；P1 的 49 项缺口 `gapsDone 49/49`；3 项 blocked 全部裁决、3 项分类差异有理由、`escape=[]`；8 个原语模块 + 8 个既有模块扩展 + 3 个新窗口；`campaign.tsk`/`scenarioFlags.mechanics.tsk` 可选扩展接入存档校验（旧存档零字节变化） | `verify:tsk:node` 41/41 pass 且 replay `--compare` exit 0；`audit:tsk:primitives` 复算一致（16 门禁全真）；`test:tsk` 8/8；P2 未写任何卡 | `audit/tsk-primitive-plan.json`、`audit/tsk-primitive-catalog.json`、`audit/tsk-node-acceptance.json`、`docs/campaign/theScarletKeys/primitives.md`、`tests/tsk-primitives-*.test.mjs`、`artifacts/migration/tsk/reports/p2-report.md` |
| 2026-11-10 | P3 关键词与规则书 | 29 个关键词全部 verified（cardCodes 与 P1 扫描逐张一致）；17 条中英双语规则全部 verified（只写规则本身）；439/439 卡有规则链接；`confirmations.keywords` 29/29、`confirmations.rulebook` 17 条 verified；浏览器验收 6/6（desktop 1440 / mobile 390 × zh/en、卡文直达、无横向滚动） | `npm run audit:tsk:rules` 复算一致；`node --test tests/tsk-rules.test.mjs` 4/4；浏览器证据 `status: passed` 六项 checks 全真；`test:fast` 无新增失败 | `audit/tsk-rules.json`、`audit/tsk-browser-acceptance.json`、`web/tsk-rules.js`、`content/campaigns/theScarletKeys/keywords.js`、`docs/campaign/theScarletKeys/rulebook.md`、`artifacts/migration/tsk/reports/p3-report.md` |
| 2026-11-11 | P6 一般玩家卡批量迁移 | 108 条记录（103 可构筑 + 5 基础弱点，含 16 张定制卡、跨循环重印 canonical）逐卡行为实现；4 片 ×27 分片、四片 126 例测试全绿；108/108 verified，61 张近似逐条披露、56 份原语请求裁决为 P7/P8 backlog；tkPlayer 包升 playable，103 张进入大厅构筑池；浏览器 10/10（桌面 1440 / 移动 390、10 张截图） | `npm run audit:tsk:player` 复算一致（6 项 gates 全真）；`tests/tsk-player-m2-{1..4}.test.mjs` 126/126；`audit/tsk-player-browser.json#status=passed`；TSK golden replay `--compare` exit 0；fast 仅剩 P0 冻结 4 条 | `audit/tsk-player-acceptance.json`、`audit/tsk-player-browser.json`、`audit/tsk-player-shards.json`、`src/cards/tsk-player-acceptance.js`、`tests/tsk-player-m2-{1..4}.test.mjs`、`docs/campaign/theScarletKeys/player-cards.md`、`artifacts/migration/tsk/reports/p6-report.md` |
| 2026-11-11 | P7 共享遭遇、十章及战役流程 | 26 个战役遭遇组（301 张需条目战役卡 + 10 张 scenario 参考卡）一卡一文件；十章五件套（definition/layout/behavior/chaos/index）逐章实现设置/幕议程/地点/敌人/诡计/剧情资产/符号/结局；战役根流程 143 节点（序幕、幕间 I、16 段密档幕间、8 份状况报告、快捷旅票、世界地图启程循环、通古斯卡终章、尾声）；完整中英叙事（campaign 458 叶 + 十章 677 叶，缺译 0）与 10 份指南；战役与 10 章注册进生产组合根，tskCampaign 包升 playable；浏览器 4/4（桌面 1440 / 移动 390、20 张截图） | `npm run audit:tsk:scenarios` → `audit/tsk-scenario-acceptance.json#status=verified`（12 项 gates 全真、10/10 章 verified、262 例章测试、301/301 条目）；`tests/tsk-{scenario-*,shared-encounters-a,shared-encounters-b,campaign-flow,interludes,story,campaign-plan}.test.mjs` 360/360；replay fixture 13 局一致；fast 仅剩 P0 冻结 4 条 | `audit/tsk-scenario-acceptance.json`、`audit/tsk-scenarios-browser.json`、`audit/tsk-campaign-plan.json`、`content/campaigns/theScarletKeys/**`、`src/cards/encounter-entries/theScarletKeys/**`、`web/scenario-guides/<id>.json`、`artifacts/migration/tsk/reports/p7-report.md` |
| 2026-11-10 | P5 调查员及专属依赖 | 6 位调查员（09001/09004/09008/09011/09015/09018）+ 14 张专属依赖全部注册并逐人 verified（旧印/关键能力/构筑/专属依赖/选人）；次级职阶选择（卡森 1 选、查理 2 选）通用判定 + 基玛尼额外 5 经验；引擎 10 处读点接线（受限额外行动、freeAction.resolve、额外槽、开局场外、damageHealed/assetExhausted 窗口、投入他人检定记账、beforePlayCost cardType）；浏览器 12/12（6 人 × 桌面 1440 / 移动 390，12 张截图） | `npm run audit:tsk:investigators` 复算一致（逐人 verified + Node/浏览器/边界/回归全真）；`node --test tests/tsk-investigator-*.test.mjs` 16/16；replay 零漂移；fast 失败集合 = P0 冻结 4 条 | `audit/tsk-investigators.json`、`audit/tsk-investigators-browser.json`、`audit/tsk-node-acceptance.json`、`audit/tsk-regression.json`、`src/cards/entries/09001–09020.js`、`docs/campaign/theScarletKeys/investigators.md`、`artifacts/migration/tsk/reports/p5-report.md` |
| 2026-11-10 | P4 新增交互与界面 | 6 组交互事务（隐匿揭露/密钥变换/空洞回收/地图启程/定制勾选/跨座位授权）+ 转移执行变体；摘要面板与选择面板复用既有组件；投影隐私（未揭露身份/密档正文/异界牌序/他人勾选与授权）与快照掩码；浏览器 16/16（6 组 × desktop 1440 / mobile 390 + 两条通用证据 spec）、14 张截图 | `npm run audit:tsk:interactions` 复算一致（`status: verified`，覆盖矩阵/脚本归属/指南/基线/fast/replay 全真）；`node --test tests/tsk-interactions.test.mjs` 9/9；`test:fast` 无新增失败（冻结 4 条除外）；replay 精确一致 | `audit/tsk-interactions.json`、`audit/tsk-interactions-browser.json`、`audit/tsk-regression.json`、`src/engine/tsk-interactions.js`、`src/integration/mechanic-view.js`、`web/mechanic-ui.js`、`docs/campaign/theScarletKeys/interactions.md`、`artifacts/migration/tsk/reports/p4-report.md` |

| 2026-11-12 | P8 整体验收与发布（M5） | `audit/tsk-migration.json#status=verified`：16 项门禁全真（来源 sha256 / 逐卡账本 439 条 missing=0 / 原语 175 份全部 deferred 到 P9 / 十章 10/10 / 关键词 29 / 规则书 17 / 指南 10 / 四份浏览器账本 / 全量回归冻结基线）；`confirmations.scenarios/keywords/rulebook` verified；`playable + earlyAccess:false + equivalenceCertified`；世界地图启程/逐章推进接入真实 hub（`hubEmbark`/`hubAdvanceReport`），修复结局 api.addTrauma 双口径与章节时间奖励并入 35 时间轴；真实大厅发布/逐章/联机/隐私/权限/断线 6 行 + 定制勾选 4 组 + 通古斯卡终章/尾声 6 组浏览器 checks 全真（70+ 张截图）；全量 fast 无新增失败、replay 零漂移、展示/文档/图像回退检查通过 | `npm run audit:tsk:release` 复算一致（`status: verified`、`--check` 逐字节可复算）；`node tools/audit-tsk-all-cards.mjs --check`（439/439、missing=0）；`node tools/verify-tsk-regression.mjs`（fast 仅 P0 冻结 4 条、additions=[]、replay exit 0）；`node tools/run-tsk-p8-browser.mjs` / `node tools/run-tsk-customization-browser.mjs` / `node tools/run-tsk-epilogue-browser.mjs` 全部 passed；`node tests/tsk-p8-migration.test.mjs`、`node tests/tsk-p8-campaign.test.mjs`、`node tests/tsk-p8-fixes.test.mjs` 全绿 | `audit/tsk-migration.json`、`audit/tsk-all-card-acceptance.json`、`audit/tsk-release-browser.json`、`audit/tsk-customization-browser.json`、`audit/tsk-epilogue-browser.json`、`audit/tsk-regression.json`、`artifacts/migration/tsk/primitive-adjudication.json`、`tests/tsk-p8-*.test.mjs`、`artifacts/migration/tsk/reports/p8-report.md` |

后续每次推进在此追加记录，并把稳定的逐卡／逐章证据写入 `audit/`。只有代码、来源与验收结果一致时才更新完成勾选。
