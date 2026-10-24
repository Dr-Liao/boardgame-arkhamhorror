# 《万象无终》迁移路线图（TCU）

> 状态口径：`playable` + `earlyAccess`，`equivalenceCertified: false`。P10 账本 [`audit/tcu-migration.json`](../audit/tcu-migration.json) 的 `gate.pass=false`：未通过项只有发布浏览器与展示素材两项（根因与待办见 [发布手册](./tcu-release.md)）。本文记录过程、产物与证据规则，**不宣称规则等价**。
>
> 阅读顺序：[README](../README.md)「万象无终」段 → 本文 → [原语](./tcu-primitives.md) / [关键词与规则书](./tcu-rules.md) / [交互](./tcu-interactions.md) / [调查员](./tcu-investigators.md) / [玩家卡](./tcu-player-cards.md) / [剧本](./tcu-scenarios.md) / [剧情](./tcu-story.md) / [发布](./tcu-release.md)。通用迁移规范见 [arkham-content-migration.md](./arkham-content-migration.md)。

## 1. 范围：377 条印刷记录

| 内容包 | 记录数 | 说明 |
| --- | --- | --- |
| `tcuCampaign`（战役） | 237 | `content/campaigns/theCircleUndone/**`，含 34 个关联面 |
| `tcuInvestigators`（调查员） | 19 | 6 位正式调查员 + 13 张专属卡（含 6 张专属弱点） |
| `tcuPlayer`（玩家卡） | 87 | 85 张普通玩家卡 + 2 张基础弱点（05041/05042） |
| 合计 | **377** | 343 张主卡 + 34 个关联面（b 面） |

- 卡号范围是 05 号段 7 个卡包（`tcu`/`tsn`/`wos`/`fgg`/`uad`/`icc`/`bbt`）；唯一印刷事实源是 [`src/cards/cards-data.js`](../src/cards/cards-data.js)。
- 9 章顺序、章节参考卡号、初始混乱袋与 64 个战役记录键集中在 [`content/campaigns/theCircleUndone/shared.js`](../content/campaigns/theCircleUndone/shared.js)；21 个遭遇组 = 9 章节组 + 12 共享组。
- 调查员：6 位正式调查员（05001–05006）+ 4 位序章无牌组故事调查员（05046–05049）；10 个遗留记忆 id、4 档混乱袋（每档 13 枚）同见 `shared.js`。

## 2. 第 0 步：范围与基线（M0 / P1）

- 命令：`npm run scan:tcu:scope` / `npm run scan:tcu:scope:check`（[tools/scan-tcu-scope.mjs](../tools/scan-tcu-scope.mjs)）。
- 产物（运行目录，不签入）：`artifacts/migration/tcu/scope.json`、`replay-before.json`；范围锁 6 个来源文件的 SHA-256（cards-data、mechanism-scan、三个包 manifest、`shared.js`）。
- 门禁：`records.total=377` 全部分区、`mainCodes=343`、`faces=34`、三包计数、21 遭遇组唯一且无缺组、分片无交集；迁移前基线为 golden replay **13 局 / 786 步 / 799 个指纹**（规则版本 `n6.0`）。
- 规则：目录收录、卡文存在、进入牌库都不等于规则已实现；三包与战役在全部章节确认前保持 `catalog-only`。

## 3. 第 1 步：机制扫描（M0 / P1）

- 命令：`npm run scan:tcu` / `npm run scan:tcu:check`（[tools/scan-tcu-mechanisms.mjs](../tools/scan-tcu-mechanisms.mjs)）。
- 产物：`artifacts/migration/tcu/mechanism-scan.json`。扫描到 **40 条机制**：`primitive` 20、`scenario` 10、`interaction` 8、`rulebook` 1、`baseline` 1；分级 `mechanism` 210 张 / `content` 82 张 / `standard` 85 张；`classified=377`、`unclassified=0`。
- 扫描结论：本轮**新增 14 个原语**（20 条 primitive 机制里 20 条全部被原语覆盖，其中 10 条优先复用通用层）；`watchlist` 明确排除误判机制（swarm/seal/bless/curse 等不是新关键词）；`crossCheck` 记录与路线图初稿的计数差异（如 haunted 49、spectral 76、breach 31）。
- 未知机制默认阻断，不允许用「看起来一样」的近似卡文静默过关；每条机制必须带代表卡号、来源与候选原语。

## 4. 第 2 步：拆分原语（P3）

### 4.1 顺序（P2.1–P2.13，加 P6 的第 14 个）

P2.1 闹鬼结算 → P2.2 幽灵界第二遭遇牌堆 → P2.3 幽灵地点与翻面 → P2.4 塔罗牌组 → P2.5 阵法（多技能合成检定）→ P2.6 序章故事调查员 → P2.7 通用谈判 → P2.8 绑定 → P2.9 塔罗槽位 → P2.10 遗留记忆/看守人/战役资产 → P2.11 裂口与地点状态 → P2.12 异端者多面与放逐 → P2.13 Cosmos 牌库；第 14 个「直觉牌库（乔·戴蒙德）」随 M1 交付。

### 4.2 五件套

每个新原语必须同时具备：① 通用实现（`src/engine/*` 或 `src/campaign/*` 按所属层）；② 注册期校验（参数形状/未知目标/未知窗口加载即失败）；③ Node 单测（正常、无合法目标、费用不足、存档往返）；④ 文档条目（写入 `primitive-plan.json` 的 `docs` 字段，稳定原语再补引擎注释）；⑤ 对既有卡 replay 零变化。

### 4.3 escape 逃生口

单卡一次性逻辑允许留在 `resolve`，但必须登记：`05346` 阿撒托斯终局（毁灭计时 + Cosmos + 结局判定绑定）、`05178a–05178l` 罪恶报应 6 个异端者的单面特殊分支、`05258–05261` 聚合幻灭 4 张命运故事卡的分支组合。禁止把可复用原语写成 escape 绕过队列。

### 4.4 门禁

- 命令：`npm run plan:tcu:primitives`（写入 `primitive-plan.json` / `primitive-catalog.json`）、`npm run audit:tcu:primitives`（`--check` 复算）。
- 当前：新增 14 / 完成 14 / pending 0；10 条复用读点全部可查；3 条 escape 全部登记；20/20 primitive 机制覆盖；`engine.js` 无 05 卡号分支、无战役名分支。
- 文档依赖：每个原语的 `files` 把 [tcu-primitives.md](./tcu-primitives.md) 与 [tcu-investigators.md](./tcu-investigators.md) 作为必需文件。此前 9 篇 `docs/tcu-*.md` 缺失导致该门禁失败；补文档后仍需重跑 `plan:tcu:primitives` 更新 plan/catalog 的文件哈希。

## 5. 第 3 步：关键词与规则书（M4）

- 16 行关键词/机制台账的唯一事实源是 [`content/campaigns/theCircleUndone/keywords.js`](../content/campaigns/theCircleUndone/keywords.js)；规则书条目在 [`web/rulebook-data.js`](../web/rulebook-data.js)。
- 账本记录：`confirmations.keywords` 16 条全部 `verified`（sourceInventoried / engineBehavior / nodeAcceptance / rulebookEntry / cardLinks）；`confirmations.rulebook` 16 条条目，campaignOverview / scenarioMechanics / keywordEntries / cardLinks / 桌面 / 移动检查全部为真。
- 命令：`npm run test:tcu:rules`（Node）、`npm run test:tcu:rules:browser`（桌面/移动端目录、搜索、返回与卡文跳转）。细节见 [关键词与规则书手册](./tcu-rules.md)。

## 6. 第 4 步：交互与界面（M4）

- 11 条交互（塔罗抽牌 `pickTarot`、序章选人 `storyInvestigator`、闹鬼结算、幽灵牌堆面板、阵法多技能合计、谈判目标、遗留记忆/记录、看守人提示、裂口/毁灭、异端者两面、塔罗槽位）登记在 `confirmations.interactions.items`，全部 `verified`（模型/引擎读点/Node/桌面/移动）。
- 面板模型集中在 [`web/tcu-ui.js`](../web/tcu-ui.js)，样式在 [`web/tcu-panels.css`](../web/tcu-panels.css)；浏览器只读观察投影、只提交 `legalMoves` 里的动作。详见 [交互手册](./tcu-interactions.md)。

## 7. 第 5–6 步：卡牌、剧本、剧情、发布

- M1 调查员：6 位正式 + 4 位序章故事调查员，19 条记录逐人验收；见 [调查员手册](./tcu-investigators.md)。
- M2 玩家卡：87 张一卡一文件（[src/cards/entries](../src/cards/entries)），4 个批次测试；22 张显式简化 + 2 张基础弱点仅作依赖；见 [玩家卡手册](./tcu-player-cards.md)。
- M3 剧本：9 章在 `content/campaigns/theCircleUndone/scenarios/<id>/`，47 个目录文件 + 2 个补充文件（`notes.js`/`story-text.js` 各两份），逐章 12 项检查；88 条忠实近似登记在 `behavior.scenarioApproximations`；见 [剧本手册](./tcu-scenarios.md)。
- M3-C 剧情：`tools/import-tcu-story.mjs` 从 10 个锁定中文 JSON 生成 [`story-text.js`](../content/campaigns/theCircleUndone/story-text.js)，`manifest.flow` 串起序章 → 9 章 → 幕间 → 尾声；见 [剧情手册](./tcu-story.md)。
- M5 发布：`playable` + `earlyAccess`；发布门禁与待修项见 [发布手册](./tcu-release.md)。

## 8. 审计证据与发布口径

### 8.1 账本结构

`audit/tcu-migration.json` 含 `scope/status/counts/packs/scenarios/chapters/encounterGroups/mechanics/primitives/confirmations/evidence/tests/remaining/gate`；逐卡账本 `audit/tcu-all-card-acceptance.json`（377/377 verified）与 `audit/tcu-card-behavior-audit.json`（P10 旧结论 143 match / 174 approximation / 60 gap）；逐章账本 `audit/tcu-scenario-acceptance.json`（9/9 verified）。

### 8.2 三层证据

① Node：原语/章节/账本单测（`npm run test:tcu` 等）；② 浏览器：`npm run test:tcu:browser` 的 5 个 spec（规则书/交互/9 章实机/真实大厅/媒体）；③ 运行态：真实 `createGameState` 逐章建局与合法动作走查、存档往返。只有 Node 测试不算交互完成。

### 8.3 证据规则

- 判定以「卡面印刷 + 文件:行号读点」为准；卡号出现在 definition/behavior/测试源码中，不能单独证明行为已实现。
- 任何简化、近似或未覆盖分支都必须写进 `remaining`（或 `scenarioApproximations`）并显式标记；不得用「看起来一样」通过验收。
- 账本只能由工具 `--write` 生成、`--check` 复算；不得手写 `gate`/`verifiedScope`/`confirmations`。当前工作区与账本存在证据哈希漂移（`--check` 失败），重跑 `audit:tcu` 前需先固定工作区并审阅 diff。
- 干净检出无法复算：`artifacts/migration/tcu/**`（scope/mechanism/primitive 输入）被 `.gitignore` 忽略，所需输入需随审计一并归档。

### 8.4 earlyAccess 口径

`playable` 只表示「本 Mod 声明的实现范围可玩、可从大厅启动」；`earlyAccess=true`、`equivalenceCertified=false` 表示未逐条等价：60 张卡有未实现子句、174 张为显式近似、88 条剧本近似仍在。发布门禁未通过时不得描述为已验收或规则等价。

## 9. 命令与维护

| 用途 | 命令 |
| --- | --- |
| 范围/机制 | `npm run scan:tcu:scope:check`、`npm run scan:tcu:check` |
| 原语 | `npm run plan:tcu:primitives`、`npm run audit:tcu:primitives` |
| 卡牌 | `npm run test:tcu:cards`、`npm run audit:tcu:all-cards`、`npm run audit:tcu:player` |
| 剧本/剧情 | `npm run test:tcu:scenarios`、`npm run audit:tcu:scenarios`、`npm run import:tcu-story:check` |
| 全量账本 | `npm run test:tcu`、`npm run audit:tcu`（`--check` 复算） |
| 浏览器/文档 | `npm run test:tcu:browser`、`node tools/check-doc-links.mjs` |

维护要求：先改代码再 `--write`；提交前跑对应 `--check`；账本、文档、`docs/tcu-*.md` 与代码同一提交；门禁红项与既有失败分开记账，不得写成「全部通过」。
