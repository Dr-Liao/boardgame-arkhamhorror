# 《食梦者》原语手册（P3 已落地 · P4 复核修订）

> **口径**：P3 三批原语已落地，账本 `primitive-plan.json` / `primitive-catalog.json` 由 `plan:tde:primitives` 生成、`audit:tde:primitives --check` 复算（当前 `new 17/17 done`、`deferredPrimitives` 空、`gate.pass=true`）。
> **P4 修订（2026-10-29）**：按官方关键词与规则文本复核，更正了 2 条原语的口径——`location.veiled`（掩藏是「已揭示 + 无线索时 [fast] 翻面」，不是「翻面前不可调查」）与 `location.doom`（地点上的毁灭标记，不是「达到阈值移除地点」）。逐条证据见 [`tde-p4-report.md`](./tde-p4-report.md) §4，规则口径见 [`tde-rules.md`](./tde-rules.md) §2。
> 事实来源：[`scope.json`](../artifacts/migration/tde/scope.json)（P1）与 [`mechanism-scan.json`](../artifacts/migration/tde/mechanism-scan.json)（P2），两者都可用 `npm run scan:tde:scope:check` / `npm run scan:tde:check` 复算。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §5；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §4.3。

## 1. 证据口径（与 TCU 一致）

每个原语条目最终包含：`id / step / title / mechanism / params / api / checks / files / tests / docs / note`。

- `checks` 只认可枚举读点（模块导出、工厂键、`scenario-runtime` 键、`ctx.api` 键、窗口、modifier 目标、effect 原语、ability kind）；无法枚举的接线点才用 `source-pattern` 并写理由。
- **五件套**（规范 §4.3 / 路线图 §5.4）：① 通用实现；② 注册期校验；③ Node 单测（正常/无目标/费用不足/存档往返）；④ 文档条目（本文件必须出现在账本 `files` 里，缺失会让全部原语变 `pending`——TCU 踩过的坑）；⑤ 既有 13 局 replay 零变化。
- 命令（P3 落地）：`npm run plan:tde:primitives`（写）、`npm run audit:tde:primitives`（`--check`）；工具优先参数化复用 `tools/audit-tcu-primitives.mjs`（约 1,986 行，不复制）。
- escape 只允许单卡逻辑，必须在 `primitive-plan.json` 的 `escape` 登记理由。

## 2. 事实：P2 已锁定的原语候选

### 2.1 机制账本里的 9 条 primitive（全部进入 P3）

| id | 卡 | 现状（P2） | 候选 API | 关键缺口 |
| --- | ---: | --- | --- | --- |
| `campaignPart` | 0 | missing | `campaign.setPart` | 四模式状态、切 part 五步、feature gate |
| `partRecord` | 12 | partial | `campaign.recordInPart` / `partRecord` | 55 键按 part 隔离、跨线写入/勾销 |
| `seatPartMap` | 0 | missing | `campaign.seatPartMap` | roomSeat↔laneSeat 派生、非连续座位、人数缩放 |
| `multiPartChaosBag` | 7 | partial | `chaosBag.multiPart` | 两袋互换、跨线同时增删 |
| `epilogueMatrix` | 0 | missing | `campaign.epilogueMatrix` | 16 段矩阵、按两线 8 条记录选 1 |
| `tokenBag` | 10 | missing | `tokenBag.create/reveal/add` | 独立 token 袋（蛛群滋生袋）与 infestation 状态 |
| `alarmLevel` | 20 | missing | `counter.investigator` / `window.afterAlarmRaised` | 按调查员计数、0–5+ 判定 |
| `verticalChain` | 15 | missing | `location.verticalChain` | 纵向/堆叠位置与布局变量复用 |
| `dreamGate` | 4 | missing | `location.placeBondedLocation` | 地点型 Bonded（06015a/b） |

### 2.2 关键词自带的高风险原语

| 关键词 | 原语候选 | 卡 | 备注 |
| --- | --- | ---: | --- |
| Swarming X | `enemy.swarmingValue` + `swarm.placeCards` | 11 敌 | X 有四种口径（固定 / `[per_investigator]` / 警报等级 / 剧本参考卡伤害数） |
| Veiled | `location.veiled`（declare/flip） | 23 地点 | 掩藏地点以已揭示面入场；「无线索时 [fast] 翻面」「翻面出 b 面故事卡」是两件事。**P8 更正**：官方 en 规则与 Haskell 均无「B3 洗回牌堆」，初勘把「洗回」误记为规则；`shuffleVeiledIntoDeck` 保留为通用原语，TDE 内容不调用 |
| Myriad | `deck.myriadLimit`（构筑期） | 14 卡 | 同名至多 3 张；`deckLimit` 字段已有，规则读点没有 |
| Researched | 记录门控升级 | 3 卡 | 读 `campaign.records` 的 Research 结果 |

### 2.3 路线图 §5.2 的其余候选（P3 逐条决定进/不进）

`campaign.epilogueMatrix`、`chaosBag.multiPart`、`location.placeBondedLocation`、`deck.myriadLimit`、`window.afterDeckSearch`（曼蒂）、`window.afterAlarmRaised`、`scenario.markerCount`（A2 神迹 / B3 剧本参考卡伤害数）、`location.doom`（B4 大网地点上的毁灭标记）、`attach.facedown`、`api.bonded.swap`、`location.verticalChain`、`investigator.extraRestrictedAction`、`window.replaceUpkeepDraw`（派翠丝）；复用项：`campaign.awardStoryCard`（剧情支援，P2 已归 `storyAssets`）。

### 2.4 escape 候选（§5.3，必须在账本登记理由）

| 卡号 | 名称 | 理由 |
| --- | --- | --- |
| 06164 | 飘渺灵体 | 「无形」状态位只服务 1 张卡 |
| 06329 | 闪耀的偏方三八面体 | 费用替代管线的一次性特例 |
| 06331 | 梦境寄生物 | 负技能图标 + 强制投入；若做通用「负图标」原语则移出 escape |

## 3. 落地状态

P3 三批与 §6–§9 已落地（含 P6 的 9 条调查员原语，`gate.pass=true`）。这里不再保留已完成待办。尚未接到真实卡面/章节的语义见各条说明，以及 [`tde-rules.md`](./tde-rules.md) §7：蜂拥实体、掩藏翻面动作、梦境之门地点实体、构筑界面上的多重计数。

## 4. 边界

- 本文件是账本输入：P3 建 `primitive-plan.json` 时已把本文件写进各原语的 `files`；条目状态由工具复算，不手写。
- P0 的协议级双 lane spike（[`tde-p0-report.md`](./tde-p0-report.md) §7）只证明协议可写，**不是** adapter 级原语。
- 原语数量与 API 以 `mechanism-scan.json` 的 `candidatePrimitives` 与 P3 计划为准；本文件的表只是入口。

## 5. 相关手册与维护

- 规则与关键词：[`tde-rules.md`](./tde-rules.md)；交互：[`tde-interactions.md`](./tde-interactions.md)；剧本：[`tde-scenarios.md`](./tde-scenarios.md)；
  调查员：[`tde-investigators.md`](./tde-investigators.md)；玩家卡：[`tde-player-cards.md`](./tde-player-cards.md)；剧情：[`tde-story.md`](./tde-story.md)；发布：[`tde-release.md`](./tde-release.md)。
- 维护：P3 每落地一个原语，先改代码与测试，再跑 `plan:tde:primitives --write`，最后 `audit:tde:primitives --check`；本文件的「事实」表随 `mechanism-scan.json` 变化同步。

## 6. P3 批次 1 落地清单（2026-10-27）

> 账本：`artifacts/migration/tde/primitive-plan.json` / `primitive-catalog.json`（`npm run plan:tde:primitives` 生成、`npm run audit:tde:primitives --check` 复算）。
> 状态由工具从代码读点 + 测试实跑 + 文件哈希计算，**本文件不手写「已完成」**。

| # | 原语 | 状态 | 落点 | 测试 |
| ---: | --- | --- | --- | --- |
| P3.1 | `campaignPart` | done（工具复算） | [`src/campaign/campaign-parts.js`](../src/campaign/campaign-parts.js) | [`tests/tde-campaign-parts.test.mjs`](../tests/tde-campaign-parts.test.mjs) |
| P3.2 | `recordInPart` | done | 同上 | 同上 |
| P3.3 | `seatPartMap` | done | 同上 | 同上 |
| P3.4 | `chaosBag.multiPart` | done | 同上 | 同上 |
| P3.5 | `inPart` | done | 同上 | 同上 |
| P3.6 | `partFlowCondition` | done | 同上 | 同上 |

- 合成两 part 夹具覆盖：切 part 五步、两线记录隔离、跨线勾销、非连续房间座位映射、两袋混乱袋、`inPart` 作用域还原、JSON 往返、模式/人数校验（21 例）。
- **schema 仍是 7**：`parts`/`seatParts` 是可选字段，未声明 parts 的战役不产生字节变化；`stateHash` 包含 `schemaVersion`，现在升 8 会让既有 13 局指纹全变、违反 `--compare` 零漂移门禁。schema 7→8 与 save-migration 推迟到 P5（TDE 真正产生存档时），见路线图 R12。
- 未接线部分（诚实边界）：`campaign-flow` 还没消费 `partFlowCondition`、`campaignView` 还没按 part 脱敏、hub 还没接 `validateModeSeats`、运行时座位重建（lane adapter）属 P5。

### P3.1 双 part 状态与切换

API `createPartsState({ mode, seatParts, activeParts, currentPart })` 与 `setPart(state, part)`；`setPart` 五步：当前线整块存 `parts` → 目标线快照载入顶层 → 共享字段（flow/scenarioResults/…）不动 → 换 `currentPart` → 同步 `state.chaosBag`。**不**重建 `state.investigators`。

### P3.2 按线隔离的记录读写与勾销

`partRecord` / `recordInPart` / `crossOutInPart` / `partScope` / `ensurePartSnapshot`。记录是存在性语义（假 = 未记录），与 `campaign-effects` 的读法一致；勾销 = 删除键并返回旧值，跨线写入不触碰当前线。

### P3.3 房间座位↔线内连续座位映射

`seatPartMap` / `laneSeatOf` / `roomSeatOf` / `seatsOfLane` / `laneCounts` / `normalizeSeatParts`。映射由 `seatParts` 确定性派生，不持久化第二份真相；越界线内座位返回 `null`，不做静默截断。

### P3.4 两袋混乱袋

`partChaosBag` / `mutateBothBags`。活动线读 `campaign.chaosBag` 并与 `state.chaosBag` 同步；非活动线落 `parts` 快照；逐章符号表属 P8（`tde-chaos.js`）。

### P3.5 数据作用域绑定

`inPart(state, part, fn)`：只绑定 `records`/`chaosBag` 等逐线数据，不换 `currentPart`、不换 `state.investigators`；回调抛错也保证还原。

### P3.6 Flow 的 part 条件

`partFlowCondition(campaign, condition)`：支持 `part` / `parts` / `mode` / `modeIn` / `activeParts`；未知键返回 false，由 P5 的 flow 加载期校验拒绝。本批不接 `campaign-flow`。

## 7. P3 批次 2 落地清单（2026-10-27）：6 条高风险机制原语

> 账本：`batch: "P3-2"`（同一份 `primitive-plan.json`，`newPrimitives` 合计 12 条）。
> 六个原语都挂在 `scenarioRuntime` 上（`counters` / `swarming` / `swarm` / `veiled` / `tokenBag` / `verticalChain`），
> 转发层在 [`src/engine/scenario-runtime-extras.js`](../src/engine/scenario-runtime-extras.js)，只做纯数据转发，**不改变既有战役行为**。

| # | 原语 | 机制（P2 卡数） | 落点 | 测试 |
| ---: | --- | --- | --- | --- |
| P3.7 | `counter.investigator` | alarmLevel（20） | [`counters.js`](../src/engine/counters.js) | [`tde-primitives-counters.test.mjs`](../tests/tde-primitives-counters.test.mjs) |
| P3.8 | `enemy.swarmingValue` | swarming（11 敌） | [`swarming.js`](../src/engine/swarming.js) | [`tde-primitives-swarming.test.mjs`](../tests/tde-primitives-swarming.test.mjs) |
| P3.9 | `swarm.placeCards` | swarming（11 敌） | [`swarm.js`](../src/engine/swarm.js) | [`tde-primitives-swarm.test.mjs`](../tests/tde-primitives-swarm.test.mjs) |
| P3.10 | `location.veiled` | veiled（23 地点） | [`veiled.js`](../src/engine/veiled.js) | [`tde-primitives-veiled.test.mjs`](../tests/tde-primitives-veiled.test.mjs) |
| P3.11 | `tokenBag` | tokenBag（10） | [`token-bag.js`](../src/engine/token-bag.js) | [`tde-primitives-token-bag.test.mjs`](../tests/tde-primitives-token-bag.test.mjs) |
| P3.12 | `location.verticalChain` | verticalChain（15） | [`vertical-chain.js`](../src/engine/vertical-chain.js) | [`tde-primitives-vertical-chain.test.mjs`](../tests/tde-primitives-vertical-chain.test.mjs) |

### P3.7 按调查员的计数器

`counterOf` / `addCounter` / `setCounter` / `setCounterMax` / `highestCounter` / `counterAtLeast` / `counterSummary` / `resetCounter`。
警报等级按**调查员**计（0–5+，`>= 5` 判定），与赏金、任何「每人一份计数」共用；只读函数不建字段。

### P3.8 Swarming X 求值

`swarmingSpec(text)` → `{ kind, value, perInvestigator, raw }`；四种口径：固定值、`[per_investigator]`、警报等级、剧本参考卡伤害数。
`swarmingCount(spec, { numInvestigators, x })` 对 X 口径**必须**有 `x`，缺了抛错（不静默按 0）；`swarmingCountForText(state, text)` 一次算完。

### P3.9 蜂拥卡放置与击败判定

`placeSwarmCards`（默认抽遭遇牌库顶，抽不够抛错）/ `swarmCardsOf` / `removeSwarmCard` / `clearSwarmCards` /
`swarmCanBeDefeated`（清空前不可击败）/ `swarmBlockedReason` / `splitSwarmingDamage`（溢出伤害逐张扣蜂拥卡）/ `swarmHostOf`（头领反查）。
蜂拥卡是独立实体（`{ id, code, hostId, kind:'swarm' }`），真实实体的生成与攻击接线属 P8。

### P3.10 掩藏地点

官方 `rules.veiled`：掩藏地点**没有未揭示面**，以已揭示面入场并按线索值放置线索；位于该地点且**该地点上没有线索**的调查员可以作为一个 [fast] 能力把它翻面，结算背面故事卡；翻过一次后本局不能再翻。
`isVeiledLocation`（字段 / keywords / 卡文首行）/ `veiledFlipBlockedReason`（不是掩藏地点 / 已翻面 / 地点上还有线索）/ `canFlipVeiledLocation` / `flipVeiledLocation`（返回 `{changed, storyCode, reason}`，被拒绝不抛错）/
`shuffleVeiledIntoDeck`（翻面后洗回，未翻面拒绝；**P8 复核：TDE 无卡使用，官方 B3 无洗回**）/ `normalizeVeiledScenario`（注册期校验：缺背面故事卡且未声明 `shuffleBack` → `missing`）。
「翻面」「翻面出 b 面故事卡」是两件事，分开表达；调查动作与故事卡阅读器接线属 P8（已交付：引擎原生 `flipVeiled` + 章节 `veiledFlipped`）。**P4 更正**：P3 曾把「未揭示限制」写成关键词规则（`veiledBlocksInvestigation`），与官方规则冲突，已删除。**P8 更正**：初勘误记「B3 翻面后洗回牌堆」，官方 en `rules.veiled`/`rules.locations`（A2/B3 同文）与 Haskell 均无洗回；P8 已按官方口径落地。

### P3.11 蛛群滋生袋

`createTokenBag` / `revealTokenFromBag`（可注入 rng，确定性）/ `addTokenToBag` / `returnTokenToBag` / `tokenBagInfo`（只公开张数与已揭示）/
`resetTokenBag` + `markInfested` / `clearInfested` / `isInfestedLocation` / `infestedCount`。与混乱袋语义不同，**不复用** `chaos-bag.js`。

### P3.12 纵向地点链

`linkVerticalChain`（写 `verticalIndex` + 既有 `connections`，幂等）/ `orderVerticalChain` / `chainNeighbors` / `moveAlongChain`（越界 `null`）/
`normalizeVerticalChain`（层号连续、无重复）。不新建循环专属布局；渲染属 P5。

### 7.7 批次 2 之后

这 5 条已在 §8 落地，不再挂在 `DEFERRED_PRIMITIVES`。

## 8. P3 批次 3 落地清单（2026-10-28）：最后 5 条原语

> 账本：`batch: "P3-1+2+3"`，`newPrimitives` 合计 **17 条**，`deferredPrimitives` 为空。
> `bondedLocation` / `locationDoom` / `markers` 挂到 `scenarioRuntime`；`myriad`（构筑期）与 `epilogueMatrix`（战役层）只在模块层。

| # | 原语 | 机制 | 落点 | 测试 |
| ---: | --- | --- | --- | --- |
| P3.13 | `location.placeBondedLocation` | dreamGate（4） | [`bonded-location.js`](../src/engine/bonded-location.js) | [`tde-primitives-bonded-location.test.mjs`](../tests/tde-primitives-bonded-location.test.mjs) |
| P3.14 | `campaign.epilogueMatrix` | epilogueMatrix（0） | [`epilogue-matrix.js`](../src/campaign/epilogue-matrix.js) | [`tde-primitives-epilogue-matrix.test.mjs`](../tests/tde-primitives-epilogue-matrix.test.mjs) |
| P3.15 | `deck.myriadLimit` | myriad（14） | [`myriad.js`](../src/engine/myriad.js) | [`tde-primitives-myriad.test.mjs`](../tests/tde-primitives-myriad.test.mjs) |
| P3.16 | `location.doom` | locationDoom（7） | [`location-doom.js`](../src/engine/location-doom.js) | [`tde-primitives-location-doom.test.mjs`](../tests/tde-primitives-location-doom.test.mjs) |
| P3.17 | `scenario.markerCount` | signsOfTheGods（8） | [`marker-count.js`](../src/engine/marker-count.js) | [`tde-primitives-marker-count.test.mjs`](../tests/tde-primitives-marker-count.test.mjs) |

### P3.13 地点型 Bonded（梦境之门）

`bondedCodesOf`（卡文 `Bonded (06126)` / 字段）/ `placeBondedLocation`（成对放置、互链、可复用已在场的伙伴）/ `bondedPartnerOf` /
`removeBondedLocation`（成对移除）/ `normalizeBondedLocations`（注册期点名缺伙伴）。地点实体由内容层注入 `spawnLocation`。

### P3.14 双线结局矩阵

`normalizeEpilogueMatrix`（4×4=16 格完整性：缺格/多格点名）/ `epilogueFor`（未知组合返回 null）/ `epilogueRows` 等查表与反查。
正文与分支接线属 P8-T。

### P3.15 多重构筑限制

`isMyriad` / `validateMyriadLimit`（按标题跨卡号共享 3 张额度）/ `addCardRespectingMyriad`（超限拒绝并给原因）/ `myriadUsage`（UI 显示 n/3）。
只拦 Myriad；普通同名上限属别的校验。

### P3.16 地点上的毁灭

官方卡面（06341–06354 与 06333）：大网地点会累积**毁灭标记**；地点上的毁灭就是毁灭——计入议程阈值，也被剧本参考卡的骷髅符号读取（X 为单地点最高毁灭，困难/专家取全部地点之和）。06 段没有任何「毁灭达到阈值移除地点」的规则。
`locationDoomOf` / `addLocationDoom`（0 下限）/ `removeLocationDoom`（卡面「移除 1 个毁灭」）/ `totalLocationDoom` / `highestLocationDoom`（B4 骷髅读点）/ `normalizeLocationDoom`（非负整数）。
**P4 更正**：P3 曾实现 `shouldDestroyLocation`/`destroyLocation`/`locationDoomThreshold`（阈值移除地点），属对「毁灭 = doom」的误读，已删除。

### P3.17 剧本参考卡计数

`markerCountOf` / `addMarker` / `setMarkerCount` / `referenceMarkerCount` / `resetMarkerCount` / `markerSummary`。
通用命名计数（默认 `reference`），A2 神迹与 B3 的参考卡 X 共用；只读函数不建字段。

### 8.6 批次 3 之后

`DEFERRED_PRIMITIVES` 已清空；后续新候选（如 P4 关键词、P5 交互需要的新原语）重新登记进该数组与账本，不直接写引擎。

## 9. P6 落地清单（2026-10-29）：调查员能力需要的 9 条原语

> 账本：`batch: "P3-1+2+3+P6"`，`newPrimitives` 合计 **26 条**（P3 的 17 + P6 的 9），`deferredPrimitives` **5 条**。
> 逐人验收见 [`tde-investigators.md`](./tde-investigators.md) 与 [`tde-p6-report.md`](./tde-p6-report.md)。

| # | 原语 | 服务对象 | 落点 | 测试 |
| ---: | --- | --- | --- | --- |
| P6-1 | `assetDefeat`（+ `assetDefeated` 窗口） | 托米主能力 | [`asset-defeat.js`](../src/engine/asset-defeat.js) | [`tde-investigators.test.mjs`](../tests/tde-investigators.test.mjs) |
| P6-2 | `harm.moveBetween` | 托米旧印 | [`harm-transfer.js`](../src/engine/harm-transfer.js) | 同上 |
| P6-3 | `counter.card` | 托尼赏金 | [`card-counters.js`](../src/engine/card-counters.js) | 同上 |
| P6-4 | `investigator.restrictedAction` | 托尼额外行动（+ 玛丽法术行动） | [`restricted-actions.js`](../src/engine/restricted-actions.js) | 同上 |
| P6-5 | `search.modify`（`searchWouldResolve`） | 曼蒂主能力 | [`deck-ops.js`](../src/engine/deck-ops.js) | 同上 |
| P6-6 | `search.cardInPile`（`searchedCardRule`） | 06008 / 06009 | `deck-ops.js` + `ability.js` | 同上 |
| P6-7 | `upkeep.replaceDraw` | 派翠丝主能力 | [`phases.js`](../src/engine/phases.js) | 同上 |
| P6-8 | `investigator.cardRules` | 派翠丝手牌上限 / 旧印 | [`stats.js`](../src/engine/stats.js)、[`tests.js`](../src/engine/tests.js) | 同上 |
| P6-9 | `play.fromHandFree` | 托尼 .38 第二张 | [`api-misc.js`](../src/engine/api-misc.js) | 同上 |

### P6.1 支援被击败的唯一判定点

`isAssetDefeated` / `assetHarmCapacity` / `checkAssetDefeated`。此前判定内联在 `applyHarm` 末尾，
只有「一次伤害/恐惧分配」会触发；「移动伤害到支援上」会让支援超过上限却留在场。现在两条路径共用
同一判定：先开 `assetDefeated` 窗口（上下文 `damage`/`horror`/`asset`），反应可以把去向改成
「洗回牌库」（`context.shuffledIntoDeck`），再离场、记录、开既有 `defeatAtLocation` 窗口、结算反伤。

### P6.2 伤害/恐惧移动

`harmOf` / `harmRoom` / `moveHarm`（`api.moveHarm` / `api.harmRoomOf`）。是「移动」不是承受/治疗：
不触发受到伤害窗口、不走 soaking；受目标容量限制；支援到上限后由 P6.1 判定。

### P6.3 卡牌具名计数器

`cardCounterOf` / `addCardCounter` / `setCardCounter` / `moveCardCounters` / `totalCardCounters`。
状态是 `card.markers[counterId]`；`CARD_COUNTER_IDS` 注册期校验（目前 `bounty`）；上限由调用方给
（敌人赏金不超过其生命值）。

### P6.4 受限额外行动

`grantRestrictedAction` / `actionsAvailable` / `consumeAction` / `clearRestrictedAction` /
`restrictedActionRule`。第四循环的法术专用行动改成同一本账（`spellOnlyActions` 字段与函数名保留），
新增 `bounty` kind；「这个行动能不能花受限额度」的唯一判定是
`table-decisions.restrictedKindOfMove`（法术特性 → `spell`；交战/攻击带赏金的敌人 → `bounty`）。
额度口径是「最后 N 个行动」，普通行动不能花。

### P6.5 查找牌库窗口 + P6.6 被找到的牌

- `searchWouldResolve` 窗口（`lookAt` / `searchDeck`）：`context.extraCards` / `extraTargets`。
  顺带修掉 `lookZoneAdapter` 写死「只看 3 张」的上限。
- `searchedCardRule`（条目级）：`{ mode: 'reaction'|'forced', take?, discard?, cancelSearch?, drawEncounter?, discoverClue? }`。
  被找到的牌还在牌库里，能力源枚举看不到它，所以不是窗口；读点只有 `deck-ops.js` 一处。

### P6.7 补给阶段抽牌替换

`investigatorRule(code).upkeepDraw = { discardNonWeakness, handSize }`。派翠丝：弃掉手牌中全部
非弱点卡，抽到 5 张；未声明该键的调查员行为不变。

### P6.8 调查员卡面常驻规则 + P6.9 从手牌免费打出

- `investigator.handSizeModifier`（`stats.js` 的唯一手牌上限读点）、
  `elderSign.shuffleDiscardAfterTest`（`tests.js` 的旧印后续结算，真正的「本次检定结束后」）、
  `investigator.startsWith`（既有读点，门之匣开局在场）。
- `api.playCardFromHandFree(seat, code)`：走 `doPlay` 的 `playDiscount`，与正常支付/入场/反应窗口同源。

### P7（M2 玩家卡）：不新增引擎原语

P7 的 87 条玩家包记录全部落在既有读点上（描述子 / `ctx.api` / 已注册窗口 / `searchedCardRule` / `bonded` / `myriad`）。57 张卡的未还原子句按「显式简化」收尾，5 条 worker 原语请求由主进程回写 `rejected` + 建议（`artifacts/migration/tde/reports/primitive-queue.json`）；处理清单见 [`tde-p7-report.md`](./tde-p7-report.md) §5/§9。因此本账本的 `new 29/29 done` 不变，`escape` 仍为 3。

### 9.4 P8 追加的内容层 API 与行为钩子（不新增 P3 原语条目）

> P8 实现剧本时补齐的**通用读点**。它们不是循环专属原语，因此不新增 `new` 账本条目；
> 但都满足「唯一入口 + 测试 + 文档」：实现在 `src/engine/{scenario-runtime,hidden-rules,enemies,card-ops,tests,moves,dispatch}.js`，
> 行为测试在 `tests/tde-scenario-runtime-api.test.mjs`，`audit-tde-primitives` 的 engineBoundary（引擎不出现 tde 字样/06 卡号）保持通过。

| 类别 | 读点 | 用途 |
| --- | --- | --- |
| 遭遇牌库 | `api.discardEncounterTop / discardEncounterCard / takeEncounterDiscard` | 弃遭遇牌库顶 N 张 / 按卡号弃 / 取回弃牌堆（卡条目禁止直写 `state.encounterDeck`） |
| 线索 | `api.addCluesToLocation / removeLocationClues / addCluesToEnemy` | 地点/敌人身上的线索增减（B3 背面故事、地点效果） |
| 隐私手牌 | `api.hiddenCards.{list,has,place,discard,removeMarker,take,transfer,activeRules}` | Hidden 遭遇卡进手牌/揭示/弃置/移交（A4 奈亚拉托提普 5 形态） |
| 胜利区/整备 | `api.takeFromVictory` / `api.preventEnemyReady` | 从胜利区取回（B3 巨噬蠕虫）/ 下一个补给阶段不重整（06092） |
| 行为钩子 | `canFightHidden / canEvadeHidden / veiledFlipped / canCommitCard / afterEvade / spawnLocation / spawnFailed` | 手牌敌人入口、掩藏翻面后正文/记录、投入限制、躲避替代、生成地点/失败数据分派 |
| 隐藏规则 | `hiddenRule.maxCommitsPerRound`（按轮计数） | 06319–06321「每轮投入 ≤1 张」 |
| 猎物/数值 | `PREY_RANK.mostDamage / mostCardsInHand`；`enemyStatModifier(..., inv)` + `per.source='encounterCardsInHand'` | 06091/06086 等共享组规则 |

复用判定：以上全部是「内容层拿不到、但不做就写不了卡」的窄读点；单卡一次性逻辑仍走条目 `resolve`/`enemyScript`，没有把卡号分支搬进引擎。

### 9.5 仍未落地（`DEFERRED_PRIMITIVES`）

| 原语 | 阶段 | 原因 |
| --- | --- | --- |
| `play.asIfAtLocation` | P8 | 事件结算期间的所在地点覆盖 + 按该地点的敌人建立交战；`inv.location` 无单一读点 |
| `location.bondedDreamGate` | P8 | 梦境之门（06015a/b）的地点实体、连接、进入限制、阶段结束放在一边 |
| `enemy.hiddenInHand` | **P8 已完成** | A4 的 Hidden 敌人抽象为条目字段 `hiddenEnemyInHand` + `canFightHidden/canEvadeHidden` 钩子；P6 的 06017 路径保留 |
| `window.afterAlarmRaised` | P8 评估后不实现 | 只服务 06224 一张卡；A3 章节 behavior 在警报提升调用点自行结算反应（条目 flags），该子句记 simplified；P9 若出现第二张同类再评估 |
| `api.bonded.swap` | P8 | 06015a/b 的翻面（随地点型 Bonded） |
