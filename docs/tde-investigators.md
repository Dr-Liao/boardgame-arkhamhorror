# 《食梦者》调查员手册（M1 / P6 骨架 · draft）

> **口径**：本文件是 **P6 之前的骨架**（`draft`），只登记 5 位调查员的归属、卡号与已知验收难点；TDE 仍是 `catalog-only`，调查员**不可选、不可构筑**。
> 事实来源：[`scope.json`](../artifacts/migration/tde/scope.json)（P1：调查员包 18 条记录）与 `content/packs/tdeInvestigators/manifest.js`（M0 骨架，`status: catalog-only`）。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §8.1 / §1.3；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §4.8 M1。

## 1. 事实：5 位正式调查员 + 13 条专属记录

| 调查员 | 职业 | 卡号 | 专属卡（card 依赖） | 专属弱点 |
| --- | --- | --- | --- | --- |
| Tommy Muldoon 托米·马尔登 | guardian | 06001 | 06006 贝基（Becky） | 06007 低级错误 |
| Mandy Thompson 曼蒂·汤普森 | seeker | 06002 | 06008 神秘证据 | 06009 惊人的发现 |
| Tony Morgan 托尼·摩尔根 | rogue | 06003 | 06010 赏金合约、06011 托尼的 .38 长管手枪 | 06012 托尼的猎物 |
| Luke Robinson 卢克·罗宾逊 | mystic | 06004 | 06013 门之匣、06015a/b 梦境之门（关联面） | 06014 脱离现实 |
| Patrice Hathaway 派翠丝·海瑟薇 | survivor | 06005 | 06016 派翠丝的小提琴 | 06017 异次元监视者 |

- 调查员包合计 **18 条记录** = 16 张主卡（5 调查员 + 11 专属）+ 2 张关联面（06015a/b）；`06015a/b` 无 `encounterCode`，按 `Bonded (Gate Box)` 走显式 override（P1 账本 `unownedFaces`）。
- 构筑规则来自卡池字段：`deckRequirements.card`（专属卡依赖）、`deckRequirements.random`（基础弱点）、`deckOptions`（主/副职业与等级上限）、`signatureCards`。
- 三个包的分区：调查员包 16 主卡 + 2 面；战役包 249 主卡 + 34 面；玩家包 87 主卡。**专属卡不计入构筑张数**。

### 1.1 已知验收难点（§8.1，P6 逐人消账）

| 调查员 | 难点 | 需要的原语/读点 |
| --- | --- | --- |
| Tommy | 伤害承接（承接队友伤害）与 Becky 弹药 | 既有 damage 转移 + 弹药 uses；无新原语 |
| Mandy | 查找改写（搜索牌库后替换/顺序） | `window.afterDeckSearch`（§5.2 候选） |
| Tony | 赏金/猎物（按调查员计数与记录） | `counter.investigator`（与 alarmLevel 同一原语） |
| Luke | 门之匣 + 梦境之门（绑定地点 + 移动） | `location.placeBondedLocation` / `api.bonded.swap` |
| Patrice | 牌库/弃牌循环与手牌上限 | `window.replaceUpkeepDraw`（§5.2 候选） |

## 2. 待办（P6 / M1）

| # | 事项 | 产物 / 验收 |
| ---: | --- | --- |
| 1 | 每人初始化、主能力、旧印、专属卡与弱点 | 5 人逐人验收 |
| 2 | 自动构筑与手动构筑同一套服务端规则 | 同一 `deckbuilding` 服务端校验 |
| 3 | 存档恢复与负面路径 | 每人至少一条读档/非法构筑用例 |
| 4 | 账本 | `confirmations.investigators` 逐人 `verified` |
| 5 | 测试 | `tests/tde-investigators.test.mjs`（原语/能力/构筑/读档） |

## 3. 边界

- `content/packs/tdeInvestigators/manifest.js` 是 **M0 骨架**：`rulesImplemented=false`、`deckbuilding=false`，没有能力实现；M1 完成后才允许把包状态推进到 `development`/`playable`。
- 调查员专属原语（Mandy/Patrice/Tony/Luke）在 P2 机制扫描里归 `standardRules`（不预判主能力），P6 逐人验收时按原语队列登记（见 [`tde-primitives.md`](./tde-primitives.md)）。
- 同一调查员不能同时出现在 A/B 两线（§1.4.1 的跨线重复选人校验，P5 实现）。

## 4. 相关手册与维护

- 玩家卡：[`tde-player-cards.md`](./tde-player-cards.md)；原语：[`tde-primitives.md`](./tde-primitives.md)；规则书：[`tde-rules.md`](./tde-rules.md)；发布：[`tde-release.md`](./tde-release.md)。
- 维护：本文件的卡号/归属来自 P1 账本；P6 起每完成一人就补「能力读点 / 测试 / 账本证据」三列，状态只能由 `audit:tde` 计算。
