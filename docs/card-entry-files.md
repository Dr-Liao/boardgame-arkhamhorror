# 一卡一文件：卡牌行为操作手册

> 玩家卡与非玩家卡都采用一卡一文件。本文只记录脚手架、索引和日常执行步骤；
> schema 以 [`card-model.md`](card-model.md) 为准，分层约束以
> [`../ARCHITECTURE.md`](../ARCHITECTURE.md) 为准，当前数量与迁移结果以 `audit/` 账本为准。

---

## 1. 硬规矩

1. **一张有行为的卡 = 一个文件**，玩家卡与非玩家卡同一原则：
   - 玩家卡：`src/cards/entries/<code>.js`，`export default` 恰好一个条目；范围是
     `CARD_ABILITY_ENTRIES`，`entries/` 只放玩家卡。
   - 通用非玩家卡（跨战役复用）：`src/cards/encounter-entries/shared/<encounterGroup>/<code>.js`。
   - 战役内跨关卡复用：`src/cards/encounter-entries/<campaign>/_shared/<encounterGroup>/<code>.js`。
   - 关卡专用（地点/幕/议程/专属敌人/诡计/剧情资产）：`src/cards/encounter-entries/<campaign>/<scenario>/<code>.js`。
   - **禁止**把非玩家条目写进 `encounter-abilities.js` 或任何按 scope 建的大文件（`enemies.js` /
     `treacheries.js` / `locations.js` 之类）；该文件只做兼容聚合（facade）。
2. **文件名就是卡号/条目 code**：`01001.js` 的条目 `code` 必须是 `'01001'`；`03009b.js` 这类带后缀的
   卡号同理。非玩家通道的英文运行时 id（如 `wolfManDrew`、`huntingNightgaunt`）也一卡一文件，
   文件名 = 该 id；别名条目跟随同名印刷卡放在同一档（见 §2.1）。
3. **两个聚合入口都只做聚合**：`card-abilities.js` 只允许 import `entries/index.js` 并导出
   `CARD_ABILITY_ENTRIES` / `CARD_ABILITY_CODES` / `PHASE5_MIGRATED_CODES`；
   `encounter-abilities.js` 只允许 import `encounter-entries/index.js` / `encounter-entries/_lookup.js`
   并保留旧导出。两个文件都不得再放条目。
4. **不恢复批次大文件**：不得新建 `BATCH_*`、`MIGRATED_*` 数组或 `ability-migration-batches.js`。
   迁移账本 `audit/migration-batches.json` 只记「哪张卡属于哪一批」，不是行为存放处。
5. **目录卡不等于行为卡**：`cards-data.js` 的卡面数据由导入器生成，不按卡拆文件；
   只有已经实现行为的玩家卡与非玩家条目有单卡文件。未实现的卡不要预建空文件。
6. **卡只能经描述子与 `ctx.api` 结算**：不得 import `src/engine/engine.js`、`card-abilities.js`、
   `encounter-abilities.js`、批次文件或 `content/`；不得直接改 `state`。需要新机制时先扩 `ability.js` /
   `windows.js` / `matcher.js` / `modifiers.js` / `targets.js` / `play-condition.js` / `effect-state.js`。
   非玩家卡需要跨条目查询时只走 `encounter-entries/_lookup.js`。
   「不得直接改 state」包含：不得写 `state/inv/location/enemy/act/agenda/asset/target/card` 的字段或数组，
   不得为单卡新造状态字段；重印卡（`duplicateOfCode` / `duplicatedBy`）只实现一次；同句模板第三张出现时回
   迁移规范 §4.3 补原语。合规口径与机械检查见 [`arkham-content-migration.md`](arkham-content-migration.md)
   §4.6.10 与 `npm run audit:entries`（已并入 `cards:check` / `cards:encounter-check`）。
7. **新增/删除/改名卡牌文件后必须重建索引**：玩家卡 `node tools/build-card-index.mjs --write`
   （`npm run cards:index`），非玩家卡 `node tools/build-encounter-index.mjs --write`
   （`npm run cards:encounter-index`）。两个索引都是签入仓库的生成物，运行时不做目录扫描。

以上 1–4、6 由 [`tests/card-entries.test.mjs`](../tests/card-entries.test.mjs) 与
[`tests/encounter-entries.test.mjs`](../tests/encounter-entries.test.mjs) 守住；索引一致性由两个
`build-*-index.mjs` 与对应用例守住；条目合规（直写状态 / 重印双实现 / 回合限制缺失）由
`npm run audit:entries` 守住（账本 `audit/card-entry-compliance.json`，基线只减不增）。

---

## 2. 文件形状

```js
// 02080 佛朗西斯·摩尔根博士
// 卡面：你得到+1[combat]。
// 卡面：[reaction]你击败一个敌人后，横置佛朗西斯·摩尔根博士：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '02080',
  modifiers: [
    skillModifier('combat', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'defeatEnemy', label: '横置：抽 1 张牌',
      criteria: [ownSeat()], cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    },
  ],
}
```

三种特殊形态（都由拆分工具生成，照抄即可）：

- **调查员旧印**：`const factory = () => ...` + `elderSign: { id, resolve: factory() }`；
  工厂里用 `investigatorSign('<code>')` 读 `INVESTIGATOR_ABILITIES`。
- **由数据表生成的条目**：`confession`/事件卡等直接写最终对象；不要为了“看起来像表”再引入共享数组。
- **需要闭包变量的条目**（如 04029/04271 的 `source: code`）：在文件顶部写 `const code = '04029'`，
  条目里继续用 `code`，这样 `resolve` 的语义与拆分前完全一致。

### 2.1 非玩家卡的文件形状与归属

目录（与 `content/campaigns/` 同构，但只放**行为条目**，不放关卡数据）：

```text
src/cards/encounter-entries/
├── _shared.js                          # 跨卡窄工具（原 encounter-abilities.js 顶部 helper）
├── _lookup.js                          # 跨条目查询（惰性建表；唯一允许的跨卡读点）
├── index.js                            # 生成索引，保持拆分前的数组顺序
├── shared/<encounterGroup>/<code>.js   # 跨战役复用
├── <campaign>/_shared/<encounterGroup>/<code>.js  # 战役内跨关卡复用
└── <campaign>/<scenario>/<code>.js     # 关卡专用（地点/幕/议程/专属敌人/诡计/剧情资产）
```

示例（关卡专用地点）：

```js
// 02052 宿舍（敦威治 · 课外活动）
// 卡面：未揭示时不能移动进入。
export default {
  code: '02052', scope: 'location', implemented: true,
  locationRule: { entryError: (state, location) => location.revealed ? null : '通往宿舍的门锁住了。' },
}
```

归属判定（扫描器、脚手架与守卫共用同一算法）：

1. 用条目 `code`、`cards-data.originalCode`、`scenarioReferences.ruleId` 在全部关卡的
   `definition.js` 与 manifest zones 里匹配；
2. 命中 1 个关卡 → `<campaign>/<scenario>/`；命中同一战役多个关卡 → `<campaign>/_shared/`；
   跨战役 → `shared/`；
3. 印刷卡有 `encounterCode` 时用它做组目录（统一 snake_case）；没有组的放该档根部
   （例如 `_shared/story/`）；
4. 运行时别名条目跟随同名印刷卡条目（要求唯一匹配），避免同一张卡被分到两处。

非玩家文件的硬约束：`export default` 恰好一个条目，`code` 等于文件名，`scope` 必须是
`enemy | location | act | agenda | storyAsset | treachery` 之一；威胁区是 `treachery` 卡可能所在的
运行区域，不是独立 scope。跨卡 helper 只从
`encounter-entries/_shared.js` 取，跨条目查询只从 `encounter-entries/_lookup.js` 取。

### 2.2 「每场游戏一次」的行动：用掉后要给 `used` 提示

`actions()` / `encounterActions()` 里带 `reason` 的行动不会进 `legalMoves`，但会进
`scriptActionHints`（AI 的「暂时不可执行的卡面行动」）。因此一次性行动**不要用早退把条目删掉**：

```js
actions({ state, moves }) {
  const used = Boolean(state.scenarioFlags?.someFlagUsed)
  moves.push({
    action: 'scenarioAction', rule: 'someRule', label: '…（每场游戏一次）',
    reason: used ? '本场游戏已使用（每场游戏仅限一次）' : null,
    used: used || undefined,   // 观察投影收进 view.usedActions；牌桌在地点详情/动作栏显示「已用」
  })
}
```

`used: true` 只表示「这个行动已经用掉」，牌桌不会把它当成可点按钮；不写 `used` 的普通
`reason` 提示仍然只喂 AI。支援上的 `limit` 能力不需要手写这段：引擎的
`abilityUsage` 会按同一份 `state.abilityLimits` 投影到 `view.abilityUsage`。

---

## 3. 新增一张卡（agent 一次执行完）

单卡/少量卡按下面的顺序执行，**不要**只做一半就交回。整轮扩展的多子进程批量迁移走
[`arkham-content-migration.md`](arkham-content-migration.md) §4.6，顺序与写入边界以那份文档为准：

```bash
# 1. 生成行为文件骨架 + 自动更新 entries/index.js
node tools/scaffold-card.mjs 01xxx --entry

# 2. 编辑 src/cards/entries/01xxx.js，写描述子
#    - 主动/免费/反应/强制能力：abilities
#    - 常驻修正：modifiers
#    - 打出条件：playCondition
#    - 旧印：elderSign（或 const factory + factory()）
#    - 只通过 resolve(ctx) 里的 ctx.api 改状态

# 3. 如果手工新增/删除了文件，重建索引（scaffold --entry 已自动做过一次）
node tools/build-card-index.mjs --write
npm run cards:check

# 4. 行为改动必须证明零变化（只改文案/卡图/数据时跳过）
node tools/replay-fixtures.mjs --baseline artifacts/card-before.json
#    ...改行为...
node tools/replay-fixtures.mjs --compare artifacts/card-before.json

# 5. 日常回归 + 账本
npm run test:fast
node tools/audit-abilities.mjs --write

# 6. 如果有卡包验收账本，重算证据哈希
node tools/rehash-acceptance.mjs --write
```

`npm run test:fast` 应全绿（2026-10-22 实测 2304 例全部通过）；新增失败 0 条才算通过。

### 3.0 非玩家卡（敌人/诡计/地点/幕/议程/剧情资产）

```bash
# 1. 生成单卡骨架并落到归属目录（scaffold 会先算 shared / _shared / scenario）
node tools/scaffold-card.mjs <code> --encounter

# 2. 编辑落点文件；条目形状与玩家卡相同的描述子，另加 scope
#    不要写回 encounter-abilities.js，也不要新建 enemies.js/treacheries.js 这类按 scope 的大文件

# 3. 重建非玩家索引并跑归属/一卡一文件守卫
node tools/build-encounter-index.mjs --write
npm run cards:encounter-check

# 4. 行为改动先 baseline 再 compare；日常回归与账本同玩家卡
node tools/replay-fixtures.mjs --baseline artifacts/encounter-before.json
node tools/replay-fixtures.mjs --compare artifacts/encounter-before.json
npm run test:fast
node tools/audit-abilities.mjs --write
```

迁移完成后，`encounter-abilities.js` 只作为 facade 读取；**任何新增都进单卡文件**。529 条存量条目
已完成一次性迁移，快照对账与验收证据保留在 `artifacts/` 与 git 历史中。

### 3.1 批量迁移时：索引只由主进程重建

整轮扩展由主进程 + 多个子进程迁移卡牌。子进程**只写自己分到的单卡文件**（玩家卡
`entries/<code>.js`；非玩家卡 `encounter-entries/<归属目录>/<code>.js`）：

```bash
# 子进程：创建骨架但不重建索引
node tools/scaffold-card.mjs 01xxx --entry --no-index
node tools/scaffold-card.mjs <code> --encounter --no-index
# 主进程：所有分片合并后统一重建一次
node tools/build-card-index.mjs --write
node tools/build-encounter-index.mjs --write
npm run cards:check
npm run cards:encounter-check
```

- 子进程不得改 `entries/index.js`、`encounter-entries/index.js`、任一本 `_shared.js` /
  `_lookup.js`、两个聚合入口、`src/engine/**`、`content/**`、`docs/**`、`audit/**`。
- 需要新原语时，子进程写 `artifacts/migration/<cycle>/primitive-requests/*.json` 并继续其他卡；
  主进程实现、补测试、更新原语目录并回写 `done` 后才继续该卡。协议见
  [`arkham-content-migration.md`](arkham-content-migration.md) §4.6.3。
- 合并门禁：分片无交集、无越界写入、索引只重建一次、两个 `cards:*:check` 通过、replay 一致、
  `test:fast` 无新增失败、队列无悬挂。

### 从旧 DSL 迁移一张卡

不要手写批次数组。用迁移工具，它会：

1. 删掉旧 `EFFECTS` 条目；
2. 在 `src/cards/entries/<code>.js` 写单卡文件；
3. 重建 `entries/index.js`；
4. 把卡包登记到 `abilityLayerCodes`。

```bash
node tools/migrate-card.mjs --plan 01xxx      # 先判定
node tools/migrate-card.mjs --write 01xxx     # 写入单卡文件 + 索引
node tools/migrate-card.mjs --verify          # 账本/文件一致性
```

`--batch <名>` 仍然可用，它只影响账本分组，不再生成批次文件。

---

## 4. 共享 helper 与 import 方向

`src/cards/entries/_shared.js` 只放**跨卡复用的窄工具**：

- `investigatorSign` / `skillModifier` / `allSkillModifiers`
- `SKILL_NAMES_ZH` / `CHAOS_SYMBOLS`
- `searchInvestigatorDeck` / `attachToChosenLocation` / `healWithTrauma`
- `attackableEnemies`（「攻击。」事件的可攻击目标过滤：排除未交战的冷漠敌人；文本清空/庞大敌人按引擎口径放行）

规则：

- 只有两张以上卡真正复用的逻辑才进 `_shared.js`；一张卡的私有 helper 留在该卡文件里。
- matcher 组合子从 `../../engine/matcher.js` 按需 import；不要在这里复制 predicate。
- `INVESTIGATOR_ABILITIES` 只从 `../card-effects.js` 取（旧印/加尔文等数据表）；不要直接读 `cards-data.js`。
- 依赖方向：`entries/<code>.js` → `_shared.js` / `engine/matcher.js` / `cards/card-effects.js`；
  **不能**反向 import `card-abilities.js` 或 `engine.js`。

非玩家条目另有两个共享模块：

- `src/cards/encounter-entries/_shared.js`：原 `encounter-abilities.js` 顶部 52 个跨卡 helper 的落点。
  只放窄工具；某张卡的私有 helper 留在该卡文件。跨战役通用的（`originalOf` / `victoryVengeance` /
  `shortestNextStep` / `teamOnce`）与战役专用的（`tfaPursuitEvade` / `essexPassengerCompartment` 等）先
  同放这里，禁止写卡牌规则；增长到需要再按战役拆时另立 `encounter-entries/<campaign>/_shared.js`。
- `src/cards/encounter-entries/_lookup.js`：跨条目查询的唯一读点。因为 `index.js` 会 import 所有条目，
  条目再 import `index.js` 会形成 ESM 循环；`index.js` 求值完成后把列表注册给 `_lookup.js`，查询在
  第一次调用时才 `new Map`。条目可以在 `resolve`/规则函数里安全调用，单独 import 一个条目也不会踩 TDZ。
  禁止条目之间直接 import。

依赖方向：`encounter-entries/<归属>/<code>.js` → `encounter-entries/_shared.js` /
`_lookup.js` / `engine/matcher.js`；**不能** import 聚合入口、`engine.js`、`content/`。

---

## 5. 哪些内容需要一卡一文件

| 层 | 存放 | 组织方式 |
| --- | --- | --- |
| 卡面数据（名字/类型/费用/文本） | `src/cards/cards-data.js` | 导入生成的目录，不按卡拆分 |
| 玩家卡行为描述子 | `src/cards/entries/<code>.js` | 一卡一文件 |
| 非玩家行为条目 | `src/cards/encounter-entries/` | 一卡一文件，按使用范围归档 |
| 战役/关卡内容 | `content/campaigns/` | 按章节与规则职责拆分 |

只有已实现行为的卡创建条目文件。目录数据保持生成物，避免把纯展示记录扩展成大量无行为模块；
单卡文件的收益是明确的 review、并行迁移和回滚边界，而不是复制整份卡牌目录。

---

## 6. 守卫与工具

| 工具/用例 | 作用 |
| --- | --- |
| [`tools/build-card-index.mjs`](../tools/build-card-index.mjs) | 生成/校验 `entries/index.js`；`--write` / `--check` |
| [`tools/build-encounter-index.mjs`](../tools/build-encounter-index.mjs) | 生成/校验 `encounter-entries/index.js`；保持拆分前顺序 |
| [`tools/encounter-entry-placement.mjs`](../tools/encounter-entry-placement.mjs) | 归属算法：扫描器、`scaffold --encounter` 与守卫共用，0 unresolved |
| [`tools/scaffold-card.mjs`](../tools/scaffold-card.mjs) | `--entry` 生成玩家卡骨架；`--encounter` 生成非玩家卡骨架并按归属落点；默认同时重建索引，批量迁移加 `--no-index`；同时生成 `develop/scaffolds/<code>.test.mjs` |
| [`tools/migrate-card.mjs`](../tools/migrate-card.mjs) | 旧 DSL → 单卡文件；`--verify` 校验账本与文件 |
| [`tools/audit-card-entry-compliance.mjs`](../tools/audit-card-entry-compliance.mjs) | **条目合规审计**：R1 直写状态 / R2 重印双实现 / R3 回合限制缺失（阻断，基线 `audit/card-entry-compliance.json` 只减不增），并记录单卡字段与手写 test 包装；`--check` / `--write` |
| [`tools/split-card-entries.mjs`](../tools/split-card-entries.mjs) | **一次性**玩家卡拆分工具；旧源码在拆分时备份到 `artifacts/legacy/`，不要重跑 |
| [`tools/split-encounter-entries.mjs`](../tools/split-encounter-entries.mjs) | **一次性**非玩家条目拆分工具；源码切片 + 顺序快照对账，已执行，不要重跑 |
| [`tests/card-entries.test.mjs`](../tests/card-entries.test.mjs) | 玩家卡：文件名/`code`/单一 default/索引顺序/禁止批次/禁止 import |
| [`tests/encounter-entries.test.mjs`](../tests/encounter-entries.test.mjs) | 非玩家卡：一卡一文件/归属目录/索引顺序/禁止写回 facade/禁止 import/单文件 import |
| [`tests/migration-tools.test.mjs`](../tests/migration-tools.test.mjs) | 账本每张卡都有单卡文件；渲染/判定仍可复用 |

`npm run cards:index` = `build-card-index.mjs --write`；`npm run cards:index:check` = `--check`。
`npm run cards:encounter-index` = `build-encounter-index.mjs --write`；
`npm run cards:encounter-check` = 索引校验 + `tests/encounter-entries.test.mjs` + `audit:entries`。
`npm run audit:entries` = 条目合规审计 `--check`；`npm run audit:entries:write` = 收紧基线。

---

## 7. 历史迁移证据

玩家卡和非玩家卡的一次性拆分已经完成。历史文件数量、源码快照、哈希和逐步 replay 结果不属于当前
操作契约，需要追溯时从 `audit/`、对应提交和 git 历史读取；不要把历史基线复制回本文。
