# 《绯红密钥》P2 通用原语（实现口径与读点）

本文件是八循环 P2（规范第 2 步：拆分并实现通用原语）的实现说明。P1 机制扫描登记了 77 项候选原语
（`audit/tsk-mechanism-scan.json#primitives`），P2 把其中 49 项 `new`/`extend` 缺口全部落地为
引擎读点与 `ctx.api`，其余 28 项走既有能力（reuse）。只读目录与计划见
`audit/tsk-primitive-catalog.json`、`audit/tsk-primitive-plan.json`。

**P2 不写卡、不改关卡内容**：本阶段只提供通用接口；卡牌行为在 P5–P7 才逐卡验收。

## 1. 存档与迁移契约

- 不提升顶层 `STATE_SCHEMA_VERSION`（仍为 7）。新状态放进两个可选 JSON 扩展，带 `version: 1`：
  - 战役级：`state.campaign.tsk = { version, keys?, map?, statusReports?, coterie?, erased?, dossiers?,
    sideStories?, customizations?, invalidCards? }`
  - 场景级：`state.scenarioFlags.mechanics.tsk = { version, concealed?, hollows?, otherworld?, crossSeat?,
    doomDiscount?, patrol?, evidence? }`
- 读点从不初始化容器（`create = false` 时返回 `null`）；旧存档/旧战役不会因为加载本模块多出字段，
  字节与 replay 指纹保持不变。
- `src/engine/tsk-primitives.js#validateTskState` 汇总「存在才校验」的容器形状与子记录，
  由 `save-migration.js#migrateState` 在读档（普通存档 / 续算基底 / 并行线）时调用。
- 以后若要改变扩展形状（字段改名/语义变化），必须显式提升 `version` 并登记迁移，不能在旧数据上静默补解释。

## 2. 模块与读点

| 模块 | 原语（P1 id） | 主要读点 |
| --- | --- | --- |
| `src/engine/tsk-state.js` | 容器（`tskCampaignState` / `tskScenarioState`） | `validateTskContainers` |
| `src/engine/tsk-concealed.js` | concealedEntity / Distribution / Expose / ExposeRange / shadowPositions / RoundEnd / windowExposed / IdentityProjection + extend.hiddenInfo | `ctx.api.tsk.concealed.*`；`view.concealedMiniCards`；窗口 `tskExposed` |
| `src/engine/tsk-hollow.js` | hollowZone / Count / CountModifierScope / Recall / erasedFromExistence / invalidCards + extend.cardCounters + extend.records | `ctx.api.tsk.hollow.*`；卡实例计数器 `evidence` / `hollow` |
| `src/engine/tsk-scarlet-keys.js` | scarletKeyEntity / keyShift / keyBinding / keySteal + extend.physicalFaces | `ctx.api.tsk.keys.*`；`physical-faces.js#nextPrintedFace` |
| `src/engine/tsk-map.js` | worldMap / travelTime / embarkChoice / statusReports / expeditedTicket / mapNodeUnlocks / sideStories / dossierReading + extend.campaignFlow | `ctx.api.tsk.map.*`；`map-graph.js#weightedDistance`；战役图 `map` 节点 |
| `src/engine/tsk-customizable.js` | customizableCard / customizationUpgrade + extend.costDiscount + extend.modifiers | `ctx.api.tsk.customizable.*`；`modifiers.js#registerModifierProvider` 读点 |
| `src/engine/tsk-coterie.js` | redCoterie / coterieEncounterInjection / patrolKeyword | `ctx.api.tsk.coterie.*` / `ctx.api.tsk.patrol.*` |
| `src/engine/tsk-investigator.js` | crossSeatAction / crossSeatActionWindow / healTrigger / evadeDiscard / doomDiscount / evidence | `ctx.api.tsk.investigator.*`；窗口 `tskCrossSeatAction` / `damageHealed` |
| `src/engine/tsk-primitives.js` | 存档校验汇总 | `validateTskState` / `tskStateSummary` |

扩展的既有模块（只加读点/白名单，不改语义）：

- `src/engine/card-counters.js`：`CARD_COUNTER_IDS` 增加 `evidence` / `hollow`。
- `src/engine/modifiers.js`：外部修正源注册表（`registerModifierProvider` / `externalModifierTotal`），
  读点接入 `playCostDelta` 与 `statPipeline`；内容层注册后才生效（未注册时为 0）。
- `src/engine/scenario-decks.js`：`scenarioDeckTop` / `scenarioDeckReturnTop` / `scenarioDeckTotal`
  （异界牌库顶牌顺序；不改既有 `scenarioDecks` 存档形状）。
- `src/engine/physical-faces.js`：`nextPrintedFace`（非在场双面卡的面配对校验）。
- `src/engine/map-graph.js`：`weightedDistance`（0-1 加权最短距离）。
- `src/engine/harm-threat.js`：`damageHealed` 窗口与 `extendHealDamage`（治疗伤害后的统一窗口）。
- `src/engine/windows.js`：注册 3 个新窗口（`tskExposed` / `tskCrossSeatAction` / `damageHealed`）。
- `src/integration/observation.js`：`view.concealedMiniCards` 投影（未翻面/未合法获知不泄露真身与诱饵）。
- `src/campaign/campaign-flow.js`：战役图新增 `map` 节点类型（注册期校验；执行器停在节点交给战役行为）。
- `src/engine/api-mechanics.js`：`ctx.api.tsk.*` 命名空间（内容层唯一改状态入口）。

## 3. 关键裁决（P1 blocked 三项，P2 已裁决）

| P1 blocked 原语 | P2 裁决 |
| --- | --- |
| `new.concealedExposeRange` | 位于阴影位置（left/middle/right）的迷你卡在**本地点或相邻地点**可被攻防；揭露（Expose）只能在本地点；不在阴影位置的迷你卡必须同地点。见 `concealTargetScope`。 |
| `new.crossSeatActionWindow` | 授权后**立即**开窗口：先结算授权者效果 → `tskCrossSeatAction` 窗口 → 目标座位执行一次行动 → 回原时序。每轮每目标座位最多 1 次。见 `grantCrossSeatAction`。 |
| `new.hollowCountModifierScope` | 卡面「你」= `scope:'investigator'`（只算该座位）；「你的队伍」/剧本级 = `scope:'team'`（全队合计）。`hollowCard` 必须显式给 scope，不做默认猜测。见 `hollowCount`。 |

三项裁决后状态均为 `done`，审计见 `audit/tsk-primitive-plan.json#adjudications`。

## 4. 与 P1 目录的口径差异（审计可见）

P1 目录 kind 与 P2 最终 classification 不同的三项（`audit/tsk-primitive-plan.json#reclassified`）：

- `new.allySlotBonus` → reuse：既有 `add:slot` 授予 + `slotBonus` 读点无需新引擎代码。
- `new.allyReadyBonus` → reuse：既有 `add:skillIcon` / `addTestValue` 修正与 `exhaust` 选择已足够。
- `extend.assetSlots` → reuse：同上（槽位授予走既有修正管线）。

## 5. 验收与证据

```powershell
node tools/verify-tsk.mjs --node     # 跑 P2 原语 Node 测试 + replay 对比 → audit/tsk-node-acceptance.json
npm run plan:tsk:primitives          # 生成 audit/tsk-primitive-plan.json + primitive-catalog.json
npm run audit:tsk:primitives         # 只复算两份账本（模块/导出/证据漂移即失败）
npm run test:tsk                     # TSK 专项 Node 测试（P0–P2）
```

每个 P2 原语至少覆盖：正常路径、负路径（非法值不产生部分写入）、JSON 存档往返与读档校验；
六份测试文件见 `tests/tsk-primitives-*.test.mjs`。`test:fast` 与 replay 基线是最终门禁，
`escape` 默认保持为空（P2 不写单卡逻辑）。
