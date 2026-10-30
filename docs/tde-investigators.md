# 《食梦者》调查员手册（M1 / P6 · 已交付：3 人 verified + 2 人显式简化）

> **口径**：本文件是 P6 交付后的**证据文档**，不是计划。5 位正式调查员、11 张专属主卡与 2 张关联面
> 已有可复算账本 [`audit/tde-investigators.json`](../audit/tde-investigators.json)（`gate.pass=true`），
> 逐人状态由 `node tools/audit-tde-investigators.mjs --check` 计算，**不手写**。
> 已 `verified`：**托米·马尔登 / 曼蒂·汤普森 / 托尼·摩尔根**。
> 仍 `pending`（显式简化，带 `note`）：**卢克·罗宾逊**（06004/06013/06014，依赖 P8 的虚拟地点与
> 梦境之门地点接线）、**派翠丝·海瑟薇**（仅 06017 隐私敌人，依赖 P7 的敌人形态隐私）。
> 事实来源：[`scope.json`](../artifacts/migration/tde/scope.json)（M0 归属）、[`cards-data.js`](../src/cards/cards-data.js)
> （印刷事实）、[`audit/tde-investigators.json`](../audit/tde-investigators.json)（逐人账本）。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §8.1；过程：[`tde-p6-report.md`](./tde-p6-report.md)。规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §4.8 M1。

## 1. 事实：5 位正式调查员 + 13 条专属记录

| 调查员 | 职业 | 卡号 | 专属卡（card 依赖） | 专属弱点 | 状态 |
| --- | --- | --- | --- | --- | --- |
| Tommy Muldoon 托米·马尔登 | guardian | 06001 | 06006 贝基 | 06007 低级错误 | `verified` |
| Mandy Thompson 曼蒂·汤普森 | seeker | 06002 | 06008 神秘证据 ×3 | 06009 惊人的发现 | `verified` |
| Tony Morgan 托尼·摩尔根 | rogue | 06003 | 06010 赏金合约、06011 托尼的 .38 长管手枪 ×2 | 06012 托尼的猎物 | `verified` |
| Luke Robinson 卢克·罗宾逊 | mystic | 06004 | 06013 门之匣、06015a/b 梦境之门（关联面） | 06014 脱离现实 | `pending`（P8） |
| Patrice Hathaway 派翠丝·海瑟薇 | survivor | 06005 | 06016 派翠丝的小提琴 | 06017 异次元监视者 | `pending`（仅 06017，P7） |

- 账本登记 **18 条记录** = 16 条主记录（5 调查员 + 11 张专属主卡）+ 2 张关联面（`06015a/b`）。
  `06015a/b` 是**地点**，不进牌组、不计入构筑依赖，只由门之匣/脱离现实放进场。
- 卡池字段：`deckRequirements.card`（专属依赖）、`deckRequirements.random`（基础弱点）、`deckOptions`
  （主/副职业与等级上限）、`signatureCards`。专属卡不计入 30/42 张。
- 牌组张数：托米/曼蒂/托尼/卢克 30，派翠丝 42（`deckRequirements.size`）。曼蒂的「牌组 30/40/50」
  目前只支持 30（`deck_size_select` 不是卡牌许可，读点见 §4.2）。

## 2. 逐人能力读点（P6）

| 调查员 | 主能力 | 实现读点 | 旧印 | 备注 |
| --- | --- | --- | --- | --- |
| 托米 06001 | 你控制的支援被击败后：获得 X 资源（X = 该支援上的伤害+恐惧），把它洗回牌库 | P6 原语 `assetDefeat`（[`asset-defeat.js`](../src/engine/asset-defeat.js)）的 `assetDefeated` 窗口；`context.shuffledIntoDeck` 是去向出口 | +2，可在自己与一个支援之间移动最多 2 点伤害/恐惧（`api.moveHarm`，[`harm-transfer.js`](../src/engine/harm-transfer.js)） | 贝基在场时资源可改为子弹（`api.addUses`） |
| 曼蒂 06002 | 同地点调查员查找牌库/遭遇牌库前：额外查找 3 张，或多结算 1 个目标（每轮一次） | P6 窗口 `searchWouldResolve`（[`deck-ops.js`](../src/engine/deck-ops.js) 的 `lookAt` / `searchDeck`）；`context.extraCards` / `extraTargets` | +0，查找牌库顶 3 张，抽走或投入本次检定（`api.lookAt` + `api.commitCards` + `api.shuffleDeck`） | 顺带修掉 `lookZoneAdapter` 只看 3 张的写死上限 |
| 曼蒂 06008 | 查找的牌中有它时揭示：抽走并发现 1 个线索 | 条目级 `searchedCardRule`（`mode: reaction`、`take`、`discoverClue: 1`） | — | 牌还在牌库里，描述子枚举看不到它，所以不是窗口 |
| 曼蒂 06009 | 强制：弃掉它、取消这次查找、抽 1 张遭遇卡 | 条目级 `searchedCardRule`（`mode: forced`、`discard`、`cancelSearch`、`drawEncounter`） | — | 弱点显现本身走 `weakness` 描述子（洗回牌库） |
| 托尼 06003 | 额外 1 次行动，只能用于与带赏金的敌人交战或攻击它 | P6 原语 `investigator.restrictedAction`（[`restricted-actions.js`](../src/engine/restricted-actions.js)）；判定在 `table-decisions.restrictedKindOfMove` | +2，在赏金合约上放 1 赏金 | 额度是「最后 1 个行动」，普通行动不能花 |
| 托尼 06010 | 永久；6 赏金；敌人入场后可移 1–3 赏金；击败带赏金敌人后赏金转化为资源 | 通用具名计数器 `counter.card`（[`card-counters.js`](../src/engine/card-counters.js)）+ `enemySpawn` / `defeatEnemy` 窗口 | — | 赏金存在 `card.markers.bounty` |
| 托尼 06011 | 每个赏金 +1 战斗、伤害 +1；击败带赏金敌人回 1 赏金；打出后免费打第二张 | `api.fight`（`combatBonus`/`damageBonus`）+ `api.playCardFromHandFree`；`assetEnteredPlay` 窗口 | — | 攻击按 `countsAs: 'fight'` 结算，不引发借机攻击 |
| 派翠丝 06005 | 手牌上限 -3；补给阶段弃掉全部非弱点手牌、抽到 5 张 | `investigator.handSizeModifier`（[`stats.js`](../src/engine/stats.js) 的唯一读点）+ `investigator.upkeepDraw`（[`phases.js`](../src/engine/phases.js)） | +1，检定结束后可把弃牌堆留 1 张、其余洗回（`elderSign.shuffleDiscardAfterTest`，读点 [`tests.js`](../src/engine/tests.js)） | 06016 小提琴是 `free` 能力（弃 1 手牌 + 横置） |
| 卢克 06004/06013/06014 | 以门之匣开始游戏（`investigator.startsWith`）；每回合 1 张事件如同位于连接地点 **未实现** | `startsWith` 已接线；事件「虚拟地点」与梦境之门地点属 P8 | +1，在门之匣上放 1 充能 | 06013/06014 只结算「解除所有交战」，显式 `simplified` |

## 3. 显式简化与待实现（账本 `pending` 的唯一依据）

| 卡号 | 简化内容 | 依赖阶段 | 说明位置 |
| --- | --- | --- | --- |
| 06004 | 「每回合 1 张事件如同位于连接地点并与该地点的敌人交战」 | P8（缺「虚拟地点」原语） | 条目 `note` + 本文 §2 |
| 06013 | 「查找绑定卡牌，放置梦境之门并移动到该地点」 | P8（地点型 Bonded 的真实地点实体/连接/阶段钩子） | 条目 `note` |
| 06014 | 同上（翻面 / 放置 / 移动到梦境之门） | P8 | 条目 `note` |
| 06017 | 「隐私敌人（在手牌中）」与「从手牌攻击/躲避」「牌库耗尽时攻击」 | P7（敌人形态隐私投影 + 从手牌建立战斗目标） | 条目 `note` |
| 06015a/b | 梦境之门地点本身（连接每个已揭示地点、除卢克外不能进入、调查阶段结束时放在一边） | P8 | `tools/tde-primitive-spec.mjs` 的 `DEFERRED_PRIMITIVES` |

> 简化的判定口径：条目 `simplified: true` + `note` + 本表 + 账本 `gate.simplifiedDocumented`。
> 任一缺失都会让账本 `gate` 变红；**不得**把简化项写成 `verified`。

## 4. 构筑规则

### 4.1 专属卡与随机基础弱点

- 自动构筑与手动构筑共用服务端同一套规则（`buildDeck` / `buildDeckFromList`）：专属卡与专属弱点
  自动加入，不占 30/42 张，也不进构筑池；随机基础弱点默认取 `ALL_BASIC_WEAKNESS_CODES`。
- 5 位调查员的牌组张数、专属卡清单与随机基础弱点由 `tests/tde-investigators.test.mjs` 逐人断言。

### 4.2 副职业（曼蒂 / 托尼）

- 卡表的 `faction_select`（副职业可选范围）与 `type`（只有事件/技能）在
  [`web/deck-rules.js`](../web/deck-rules.js) 翻成同一条允许项，`limit: 10` 仍由
  `validateDeckRules` 的容量分配执行。
- `deck_size_select`（30/40/50）**不**作为卡牌许可；本轮只支持印刷的 30 张。选 40/50 需要
  单独的构筑入口，属后续批次。

### 4.3 可用性

- `SELECTABLE_INVESTIGATOR_CODES` = 一至四循环 + 第五循环 5 位；构筑界面与选人读这一份。
- **AI 自动选人池仍是 `PLAYABLE_INVESTIGATOR_CODES`**（不含 TDE）：AI 选人按
  `shuffle(池, 独立随机流)[0]` 决定，池子变长会让既有种子对局的 AI 选人漂移（重放/开局参数用例）。
  食梦者战役到 P10 才可启动，届时并入 AI 池并重采基线。

## 5. 证据与命令

| 命令 | 产物 / 结果 |
| --- | --- |
| `npm run test:tde:investigators` | `tests/tde-investigators.test.mjs` **24 例**（可用性 / 构筑 / 开局存档 / P6 原语 / 逐人能力 / 简化登记） |
| `npm run audit:tde:investigators:write` / `audit:tde:investigators` | `audit/tde-investigators.json`（18 条记录、`gate.pass=true`、verified 3/5、simplified 4） |
| `npm run plan:tde:primitives` / `audit:tde:primitives` | P6 新增 9 条原语进入 `primitive-plan.json`（`new 26/26 done`、deferred 5） |
| `npm run cards:check` | 一卡一文件、索引一致、条目合规（R1/R2/R3） |
| `node tools/replay-fixtures.mjs --compare artifacts/migration/tde/replay-before.json` | 13 局逐条一致（非 TDE 行为零变化） |
| `npm run test:fast` | 3968 tests / 3965 pass / 3 skipped / **0 fail** |

## 6. 边界

- 06015a/b 没有行为条目（`registered=false`）：账本把它们单列在 `facesPending`，原因写进
  `DEFERRED_PRIMITIVES`，不算「已实现」。
- 卢克与派翠丝的 `pending` **不是失败**：`gate.pass` 只要求「结构完整 + 节点用例通过 + 简化有 note」；
  逐人 `status` 如实记录 3/5 verified。
- 本文件不声明规则等价；`literalCardBehavior` 仍由 P9 的逐卡账本决定。

## 7. 相关手册与维护

- 玩家卡：[`tde-player-cards.md`](./tde-player-cards.md)（P7）；原语：[`tde-primitives.md`](./tde-primitives.md) §9；
  规则书：[`tde-rules.md`](./tde-rules.md)；发布：[`tde-release.md`](./tde-release.md)。
- 维护：能力/简化变化时先改条目与测试，再 `node tools/audit-tde-investigators.mjs --write`；
  提交前跑 `--check`。状态只能由账本计算，不手改。
