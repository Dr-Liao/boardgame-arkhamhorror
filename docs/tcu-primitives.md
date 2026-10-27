# 《万象无终》原语手册（14 个新原语）

> 口径：本手册对应 `primitive-plan.json` 的 **14 个新原语 + 10 条复用 + 3 条 escape**，由 [tools/audit-tcu-primitives.mjs](../tools/audit-tcu-primitives.mjs) 从代码读点、测试结果与文件存在性复算，不手写完成状态。
>
> 当前复算（P10）：新原语 14/14 done、复用 10/10 可查、escape 3/3 已登记、20/20 primitive 机制覆盖、`engine.js` 05 卡号与战役名分支均为 0。14 个原语测试文件当前实测 **122 例通过**。账本入口：[`audit/tcu-migration.json`](../audit/tcu-migration.json) 的 `primitives` 与 `gate.primitivesDone`。

## 1. 证据口径

每个原语条目包含：`id / step / title / mechanism / params / api / checks / files / tests / docs / note`。

- `checks` 只认可枚举读点：`module-export`、`factory-keys`、`scenario-runtime` 键、`ctx-api` 键、`window`、`modifier-target`、`effect-primitive`、`ability-kind`；无法枚举的接线点才用 `source-pattern` 并在 `why` 说明原因。
- 五件套（通用实现 / 注册期校验 / Node 单测 / 文档条目 / replay 零变化）与 escape 规则见 [迁移规范](./arkham-content-migration.md) §4.3 与 [路线图](./tcu-migration-roadmap.md) §4.2。
- 文档是 `files` 的必需项：1–13 号原语要求本文件，第 14 个要求 [调查员手册](./tcu-investigators.md)。文档缺失会直接让全部原语变 `pending`。
- 复算产物在运行目录 `artifacts/migration/tcu/primitive-plan.json` 与 `primitive-catalog.json`（不签入）；改代码后先 `npm run plan:tcu:primitives`，再 `npm run audit:tcu:primitives --check`。

## 2. 通用层落点

| 模块 | 职责 |
| --- | --- |
| [`src/engine/haunted.js`](../src/engine/haunted.js) | 闹鬼能力归一化、地点读点、`resolveHaunted` / `resolveAfterFailedAction` / `grantHaunted`（442 行） |
| [`src/engine/alt-decks.js`](../src/engine/alt-decks.js) | 第二遭遇牌堆（`spectral`）与场景地点牌库（`cosmos`）纯数据操作 |
| [`src/engine/locations.js`](../src/engine/locations.js) | 幽灵面翻面、地点状态、离场搬运 |
| [`src/engine/tarot.js`](../src/engine/tarot.js) / [`src/engine/tarot-slot.js`](../src/engine/tarot-slot.js) | 22 张大阿卡纳牌组与调查员塔罗槽位/开局入场 |
| [`src/engine/stats.js`](../src/engine/stats.js) | 阵法多技能合成检定的技能合计读点 |
| [`src/engine/story-investigators.js`](../src/engine/story-investigators.js) | 序章无牌组故事调查员的身份快照、交换与恢复 |
| [`src/engine/parley.js`](../src/engine/parley.js) / [`src/engine/bonded.js`](../src/engine/bonded.js) | 通用谈判入口与绑定集合 |
| [`src/campaign/mementos.js`](../src/campaign/mementos.js) / [`src/campaign/campaign-effects.js`](../src/campaign/campaign-effects.js) | 遗留记忆/看守人记录与战役资产入牌组 |
| [`src/engine/location-state.js`](../src/engine/location-state.js) / [`src/engine/enemy-faces.js`](../src/engine/enemy-faces.js) | 裂口与地点布尔状态（上限 3、第 4 个转入侵由剧本接）；敌人多面与放逐 |
| [`src/engine/scenario-runtime.js`](../src/engine/scenario-runtime.js) | 内容层唯一窄接口（上面各原语的 `scenarioRuntime.*` 键） |
| [`src/engine/windows.js`](../src/engine/windows.js) / [`src/engine/ability.js`](../src/engine/ability.js) / [`src/engine/modifiers.js`](../src/engine/modifiers.js) | 时机窗口注册表、描述子能力层、实体修正/规则读点 |

## 3. 14 个新原语

### P2.1 闹鬼结算

API `scenarioRuntime.haunted(seat, { locationId, times, kind, source })`；落点 `haunted.js` + `windows.js`（`haunted` interrupt）+ `actions.js` 失败分支 + `setup.js` 的 `normalizeScenarioHaunted`。测试 [tests/tcu-primitives-haunted.test.mjs](../tests/tcu-primitives-haunted.test.mjs)；14 项 checks 含模块导出、工厂键、scenario-runtime 键、窗口与两处 source-pattern。

### P2.2 幽灵界第二遭遇牌堆

API `extraDeck(id, codes)` / `drawExtra` / `shuffleExtra` / `discardExtra`；落点 `alt-decks.js`（`setExtraEncounterDeck` 等）+ `encounter.js`（复用显现管线）+ 观察投影（张数/弃牌堆）。测试 [tests/tcu-primitives-spectral-deck.test.mjs](../tests/tcu-primitives-spectral-deck.test.mjs)。

### P2.3 幽灵地点与翻面

API `flipLocationToSpectral(id, seat)` / `locationIsSpectral(id)`；落点 `locations.js`（`spectralFaceOf`、`isSpectralLocation`、`normalizeScenarioSpectralLocations`）+ `engine.js:flipLocationFace`。测试 [tests/tcu-primitives-spectral-location.test.mjs](../tests/tcu-primitives-spectral-location.test.mjs)。

### P2.4 塔罗牌组

22 张大阿卡纳在 `src/engine/tarot.js` 数据化（正逆位、抽牌、N 选一、洗回、弃置），状态纯 JSON、随机只走 `randomValue`；观察投影只给张数与已抽牌。测试 [tests/tcu-primitives-tarot.test.mjs](../tests/tcu-primitives-tarot.test.mjs)。

### P2.5 阵法

多技能合成检定读点：技能合计、图标统计与目标选择在 `src/engine/stats.js` + `tests.js` + `scenario-runtime.js`；`[[阵法]]`/`[[Circle]]` 卡按印刷技能组合检定。测试 [tests/tcu-primitives-circle.test.mjs](../tests/tcu-primitives-circle.test.mjs)。

### P2.6 序章故事调查员

无牌组故事调查员：不登记战役身份、不建牌库、不受创伤；卡面职业/四项技能/生命/理智由 `setup.js` 的故事调查员分支写入，换回时 `story-investigators.js` 按身份快照恢复。测试 [tests/tcu-primitives-story-investigators.test.mjs](../tests/tcu-primitives-story-investigators.test.mjs)。

### P2.7 通用谈判

`parley.js` 统一谈判入口 + `moves.js` 的 `parley` 行动 + 描述子通道；内容层只在 `behavior.actions()` 给谈判行动，不得在引擎按卡号分支。测试 [tests/tcu-primitives-parley.test.mjs](../tests/tcu-primitives-parley.test.mjs)。

### P2.8 绑定

`bonded.js` 维护场外绑定集合（`bondedGroupOf` / `retrieveBonded` / `returnBonded`）；05313/05314/05316/05317 的「同名牌组」用它实现。测试 [tests/tcu-primitives-bonded.test.mjs](../tests/tcu-primitives-bonded.test.mjs)。

### P2.9 塔罗槽位

`tarot-slot.js` + `setup.js`：塔罗支援占槽位、开局入场、容量上限（7 张玩家卡 + 05283 的额外槽）；读点与描述子见 `ability.js` / `tests.js`。测试 [tests/tcu-primitives-tarot-slot.test.mjs](../tests/tcu-primitives-tarot-slot.test.mjs)。

### P2.10 遗留记忆与看守人

`src/campaign/mementos.js` 与 `campaign-effects.js` 统一写/读 10 个 Memento 与「看守人」记录；战役资产（机关盒 05228、黑书 05150、四把钥匙 05203）经 `campaignCard` 入战役牌组、不占 30 张、不洗入牌库。测试 [tests/tcu-primitives-campaign-records.test.mjs](../tests/tcu-primitives-campaign-records.test.mjs)。

### P2.11 裂口与地点状态

`location-state.js`：`addBreach` / `removeBreach` / `breachOf` / `locationSkullValue`（裂口 + 地点毁灭）/ `breachTotal` / 布尔地点标记（`LOCATION_FLAGS=['brazier']`，火盆用同一份数据）；观察投影只给有标记的地点。测试 [tests/tcu-primitives-location-state.test.mjs](../tests/tcu-primitives-location-state.test.mjs)。

### P2.12 异端者多面与放逐

`enemy-faces.js`：敌人多面/当前面、`banishEnemyToVictory`（放逐到胜利区并计胜利点）、`cannotBeDefeated` 读点；`scenarioRuntime` 暴露 `banish`/`faceOf`/`flipEnemyFace`。测试 [tests/tcu-primitives-enemy-faces.test.mjs](../tests/tcu-primitives-enemy-faces.test.mjs)。

### P2.13 Cosmos 牌库

`alt-decks.js` 的场景地点牌库（建堆/抽/选 1/洗回/弃置，状态纯 JSON）+ `scenarioRuntime.cosmos({build|draw|take|shuffle|discard})`；`[[虚空]]`空格不建实体，只用 `scenarioFlags.emptySpaceCount` 记账。测试 [tests/tcu-primitives-cosmos.test.mjs](../tests/tcu-primitives-cosmos.test.mjs)。

### 3.1 直觉牌库（乔·戴蒙德）

第 14 个原语（P6/M1）：[`src/engine/hunch-deck.js`](../src/engine/hunch-deck.js)。冒险设置抽 11 张洞察事件；调查阶段开始揭示并视作手牌；打出费用 -2；阶段结束洗回。「如同你的手牌」已收敛到引擎级统一原语 [`src/engine/play-channels.js`](../src/engine/play-channels.js) 的 `hunch` 通道：普通行动、快速事件的反应窗口、收尾玩家窗口、能力层 `fromHand` 窗口共用同一套条目/门控/折扣/取牌，折扣读点 `hunchDeck.playDiscount`（05002 默认 -2）与实付同源；服务端下发 `uiKey`（`hunch:<卡号>`）供牌桌把选项挂回直觉区那张牌。与卡洛琳的资源寄存（[`resource-bank.js`](../src/engine/resource-bank.js)）、黛安娜的法术专用额外行动（[`spell-actions.js`](../src/engine/spell-actions.js)）同为调查员专属读点；`cancel-note.js` 承接「取消后记录」类反应。测试 [tests/tcu-investigators.test.mjs](../tests/tcu-investigators.test.mjs)、[tests/turn-end-window.test.mjs](../tests/turn-end-window.test.mjs)、[tests/play-channels.test.mjs](../tests/play-channels.test.mjs)。

## 4. 复用的 10 个原语

`doomOn`（按卡放毁灭统一入口）、`recordUnion/recordRemove`（记录并集/移除）、`flipScenarioLocation`（地点翻面）、`flow branch/record/includes`（战役流程条件）、`effect:draw`、`effect:chooseOne`、`cardsBeneath`（底下牌）、`permanentExceptionalExile`（永久/卓越/放逐费用）、`coreEncounterGroups`（核心遭遇组映射）、`tarotSlotCapacity`（塔罗槽位容量）。均已确认引用点在注册表可查。

## 5. Escape 逃生登记

| 卡号 | 理由 |
| --- | --- |
| 05346 | 《黑色王座》阿撒托斯终局：毁灭计时、Cosmos 抽取与结局判定绑定在一张议程上，不进通用原语 |
| 05178a–05178l | 《恶罪报应》6 个异端者的单面特殊分支（未了之事翻面/放逐细节），只服务该章 |
| 05258–05261 | 《聚合幻灭》4 张命运故事卡：火盆点燃结果与阵营记录组合，每张只出现一次 |

## 6. 验收与已知边界

- 命令：`npm run plan:tcu:primitives`（写）、`npm run audit:tcu:primitives`（`--check`）；单测用 `node --test tests/tcu-primitives-*.test.mjs`（14 文件，当前 122 例全过）。
- 门禁复算：`newPrimitives 14/14`、`newPrimitivesHaveTests`、`reuseReadPoints 10/10`、`escapeRegistered 3/3`、`mechanismCoverage 20/20`、`engineBoundary codes=0 names=0`。
- 已知边界：本文件与 [调查员手册](./tcu-investigators.md) 是工具 `files` 的必需输入，补文档后必须重跑 `plan:tcu:primitives --write` 才能让 `--check` 复算一致；`artifacts/migration/tcu/**` 被 gitignore，干净检出缺少审计输入时只能复现代码侧读点，不能复现 plan/catalog 哈希。
