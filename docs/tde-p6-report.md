# P6（M1 调查员）收尾报告

> 阶段：P6 / M1「调查员」；日期：2026-10-29。
> 状态：**交付 5 位调查员 + 11 张专属主卡 + 2 张关联面**；逐人账本
> [`audit/tde-investigators.json`](../audit/tde-investigators.json) `gate.pass=true`，
> **verified 3/5**（托米 / 曼蒂 / 托尼），**pending 2/5**（卢克 → P8、派翠丝 → 仅 06017 待 P7）。
> 证据：`tests/tde-investigators.test.mjs` 24 例、P6 新增 9 条原语（`new 26/26 done`）、
> replay 13 局零漂移、`test:fast` 3968 tests / 0 fail。
> 术语：`verified` = 逐人检查全部通过且无简化；`pending` = 有显式简化（必须带 `note`）。

## 1. 范围与不做什么

- **做**：5 位正式调查员的构筑（牌组张数、专属卡、随机基础弱点、副职业）、旧印、主能力、专属卡
  与专属弱点；一卡一文件；可用性/构筑界面接线；逐人账本与测试。
- **不做**：06015a/b「梦境之门」的地点行为（P8 地点型 Bonded 接线）；卢克的「事件如同位于连接
  地点」；06017 的「隐私敌人在手牌中」。这三块都在 `tools/tde-primitive-spec.mjs` 的
  `DEFERRED_PRIMITIVES` 或条目 `note` 里显式登记，账本记 `pending`。
- **不改**：`PLAYABLE_INVESTIGATOR_CODES`（AI 自动选人池）。新增 `SELECTABLE_INVESTIGATOR_CODES`
  供构筑界面/选人；理由见 §5.1。

## 2. 产物

| 类别 | 文件 |
| --- | --- |
| 单卡文件 ×16 | `src/cards/entries/06001`–`06005`、`06006`–`06014`、`06016`、`06017`（06015a/b 本轮无条目） |
| 可用性 | [`src/deck/availability.js`](../src/deck/availability.js)：`TDE_INVESTIGATOR_CODES`、`SELECTABLE_INVESTIGATOR_CODES`、5 条 `SIGNATURES_BY_INVESTIGATOR`、strict/依赖/原因文案 |
| 构筑 | [`web/deck-rules.js`](../web/deck-rules.js)：`faction_select` / `type` / `name` 三种卡表写法翻成同一条允许项（副职业 10 张配额仍由 `validateDeckRules` 执行） |
| 内容包 | [`content/packs/tdeInvestigators/manifest.js`](../content/packs/tdeInvestigators/manifest.js)：`status: development`、16 条 `rulesImplemented: true`、`behaviorIds` |
| 引擎（P6 原语） | `asset-defeat` / `harm-transfer` / `card-counters` / `restricted-actions`（+`spell-actions` 适配）/ `deck-ops` 搜索窗口 / `phases.js` 抽牌替换 / `stats.js` 手牌上限 / `api-misc` 免费打出 |
| 测试 | [`tests/tde-investigators.test.mjs`](../tests/tde-investigators.test.mjs) 24 例；`tests/suites.mjs` + `tests/node-suite.mjs` 已登记 FAST |
| 账本 | [`audit/tde-investigators.json`](../audit/tde-investigators.json)；工具 [`tools/audit-tde-investigators.mjs`](../tools/audit-tde-investigators.mjs) |
| 原语账本 | [`artifacts/migration/tde/primitive-plan.json`](../artifacts/migration/tde/primitive-plan.json)（`batch: "P3-1+2+3+P6"`） |
| 文档 | 本文 + [`tde-investigators.md`](./tde-investigators.md) + 路线图 §13.15 + [`tde-primitives.md`](./tde-primitives.md) §9 |

## 3. P6 新增原语（9 条）

| # | 原语 | 落点 | 关键读点 / 测试 |
| ---: | --- | --- | --- |
| P6-1 | `assetDefeat`（支援被击败的唯一判定点 + `assetDefeated` 窗口） | `src/engine/asset-defeat.js`，`enemies.js` 的 applyHarm 改为调用它 | 窗口上下文带 `damage`/`horror`；`shuffledIntoDeck` 决定去向（托米） |
| P6-2 | `harm.moveBetween` | `src/engine/harm-transfer.js` + `api.moveHarm` / `harmRoomOf` | 纯函数测试 + 托米旧印端到端 |
| P6-3 | `counter.card`（具名计数器 / 赏金） | `src/engine/card-counters.js` + `api.addCardCounter` / `moveCardCounters` | 上限、未知 id 报错、赏金转移 |
| P6-4 | `investigator.restrictedAction` | `src/engine/restricted-actions.js`；`spell-actions.js` 改为共享算术；`turn/dispatch/moves/table-decisions` 接线 | 「最后 N 个行动」算术 + 托尼赏金行动 |
| P6-5 | `search.modify`（查找牌库前的窗口） | `src/engine/deck-ops.js` 的 `searchWouldResolve` | 曼蒂「额外 3 张/多 1 个目标」；修掉 `lookZoneAdapter` 写死 3 张 |
| P6-6 | `search.cardInPile`（被找到的牌自身的规则） | 条目字段 `searchedCardRule` + `deck-ops.js` 的 `searchedCardsWindow` | 06008 揭示抽走 + 发现线索；06009 弃掉 + 取消查找 + 抽遭遇 |
| P6-7 | `upkeep.replaceDraw` | `src/engine/phases.js` | 派翠丝「弃非弱点手牌、抽到 5 张」 |
| P6-8 | `investigator.cardRules`（`handSizeModifier` / `shuffleDiscardAfterTest`） | `src/engine/stats.js`、`tests.js` | 派翠丝手牌上限 5、旧印「检定结束后」 |
| P6-9 | `play.fromHandFree` | `src/engine/api-misc.js` 的 `playCardFromHandFree` | 托尼 .38 第二张免费打出 |

延后的 5 条：`play.asIfAtLocation`、`location.bondedDreamGate`、`enemy.hiddenInHand`、
`window.afterAlarmRaised`、`api.bonded.swap`（各自带阶段与原因，见 `DEFERRED_PRIMITIVES`）。

## 4. 逐人验收

| 调查员 | 构筑 | 旧印 | 主能力 | 专属卡/弱点 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 06001 托米·马尔登 | 30 张 + 06006/06007 | +2 移动最多 2 点伤害/恐惧 | 支援被击败 → X 资源 + 洗回牌库（贝基可改子弹） | 06006 弹药/攻击、06007 弃带伤支援 | `verified` |
| 06002 曼蒂·汤普森 | 30 张 + 06008×3/06009 | +0 看 3 抽 1 或投入检定 | 查找牌库前额外 3 张 / 多 1 目标（每轮一次） | 06008 揭示抽走 + 线索、06009 取消查找 | `verified` |
| 06003 托尼·摩尔根 | 30 张 + 06010/06011×2/06012 | +2 赏金 +1 | 赏金专用额外行动 | 06010 6 赏金、06011 每赏金 +1 战斗、06012 最远生成 | `verified` |
| 06004 卢克·罗宾逊 | 30 张 + 06013 | +1 门之匣 +1 充能 | **简化**（缺虚拟地点） | 06013/06014 只结算解除交战 | `pending`（P8） |
| 06005 派翠丝·海瑟薇 | 42 张 + 06016/06017 | +1 + 弃牌堆留 1 洗回 | 手牌上限 -3；补给阶段弃非弱点抽到 5 | 06016 弃 1 手牌换资源/抽牌、06017 **简化** | `pending`（仅 06017） |

## 5. 偏差、风险与处置

### 5.1 AI 自动选人池不扩容（有意）

- **现象**：把 TDE 并入 `PLAYABLE_INVESTIGATOR_CODES` 后，`replay.test.mjs` 的「auto 选人 + 自定义
  卡组」与 `import-cards.test.mjs` 的开局用例变红——AI 选人取自 `shuffle(池, 独立随机流)[0]`，
  池子变长就换人，旧种子对局的座位调查员漂移。
- **处置**：新增 `SELECTABLE_INVESTIGATOR_CODES`（含 TDE）供构筑界面/选人/测试；AI 池保持
  `PLAYABLE_INVESTIGATOR_CODES`。P10 食梦者战役可启动时再并入并重采基线。这条写进
  `availability.js` 与 `tde-investigators.md` §4.3。

### 5.2 `lookZoneAdapter` 只看 3 张（顺带修掉）

- 旧实现的 `readArray = array.slice(-3).reverse()` 写死了 3 张，任何「看顶 N 张」N>3 都会被静默截断
  （曼蒂的 +3 因此不可见）。P6 改成按 `count` 取牌；既有卡都是 3 张，replay 零漂移已验证。

### 5.3 `searchedCardRule` 为什么不是窗口

- 06008/06009 在被查找时**还在牌库里**，引擎的能力源枚举（手牌/场上/调查员）看不到它们，
  用反应描述子会永远不触发。改为条目级声明 + `deck-ops` 唯一读点；代价是这两个效果不是
  「能力窗口」，无法被其它卡在同类时点响应（本轮没有这类卡）。

### 5.4 TCU 账本与覆盖度账本的连带更新

- `availability.js` 是 TCU 玩家卡账本的证据文件：P6 改它会让 `audit/tcu-player.mjs` 报
  `Acceptance artifact stale`。按 P5 的 remedy 重算：`audit-tcu-player --write` →
  `audit-tcu --write` → `audit:tcu` 校验通过（玩家卡 87/87、investigators 6/6、all-cards 377/377）。
- `audit/ability-coverage.json` 因新增 16 个条目 + 2 个窗口重算（engineCodes/effects 仍为 0）。

## 6. 验证记录

| 项 | 实测 |
| --- | --- |
| `npm run test:tde:investigators` | 24 例 / 0 失败 |
| `npm run audit:tde:investigators` | 18 条记录（16 主 + 2 面）、`gate.pass=true`、verified 3/5、simplified 4、node 24 例 |
| `npm run plan:tde:primitives` / `audit:tde:primitives` | `new 26/26 done`、`reuse 2`、`escape 3`、`deferred 5`、`gate.pass=true` |
| `node tools/replay-fixtures.mjs --compare artifacts/migration/tde/replay-before.json` | 13 局逐条一致（零漂移） |
| `npm run cards:check` | 索引 584 张一致、一卡一文件、条目合规 0 新增 |
| `npm run test:fast` | **3968 tests / 3965 pass / 3 skipped / 0 fail** |
| `npm run audit:tcu:check`（连带） | 通过（账本已按 remedy 重算） |

## 7. 剩余工作（交接）

1. **P7**：06017 的隐私敌人（手牌中）与从手牌攻击/躲避；`ALL_BASIC_WEAKNESS_CODES` 是否纳入
   06035–06038（TDE 基础弱点，属玩家包）。
2. **P8**：`location.bondedDreamGate`（06015a/b 的连接/进入限制/阶段结束放在一边）与
   `play.asIfAtLocation`（卢克的事件）→ 三张 `simplified` 条目转 `verified`。
3. **P9/P10**：把 `audit/tde-investigators.json` 并入 `audit/tde-migration.json` 的
   `confirmations.investigators`；TDE 并入 AI 池并重采 replay 基线。
4. **P7 顺带**：曼蒂的牌组 40/50 选项（`deck_size_select`）若要支持，需要构筑界面的独立入口。

## 8. 维护

- 改能力：先改条目 + 测试，再 `node tools/audit-tde-investigators.mjs --write`；提交前 `--check`。
- 改原语：同步 `tools/tde-primitive-spec.mjs` 的 checks/files/tests，跑
  `plan:tde:primitives` + `audit:tde:primitives`；engine 边界（0 个 06 卡号 / 0 次循环名）由工具守护。
- 简化项转 verified 的条件：条目去掉 `simplified`、补测试、账本 `--write` 后 status 自然变化。
