# 一卡一文件：卡牌行为目录（agent 执行手册）

> 日期：2026-10。状态：**已执行**。460 个能力层条目（386 条描述子）已从 `card-abilities.js` /
> `ability-migration-batches.js` 拆到 `src/cards/entries/<code>.js`；replay 基线 13 局 / 779 步
> 逐条指纹一致。本文是**当前规矩**，不是历史记录；历史阶段见
> [`phase5-migration.md`](phase5-migration.md) 与 [`architecture-refactor-roadmap.md`](architecture-refactor-roadmap.md)。

---

## 1. 硬规矩

1. **一张有行为的玩家卡 = 一个文件**：`src/cards/entries/<code>.js`，`export default` 恰好一个条目。
   范围是 `CARD_ABILITY_ENTRIES`（460 个条目）；非玩家卡（敌人/地点/幕/议程等 9 条）仍走
   `src/cards/encounter-abilities.js` 的 D1 通道，**不要**混进 `entries/` 或 `CARD_ENTRY_LIST`。
2. **文件名就是卡号**：`01001.js` 的条目 `code` 必须是 `'01001'`；`03009b.js` 这类带后缀的
   卡号同理（非玩家通道的英文 id 不在此目录）。守卫用例逐文件断言。
3. **`card-abilities.js` 只做聚合**：只允许 import `entries/index.js` 并导出
   `CARD_ABILITY_ENTRIES` / `CARD_ABILITY_CODES` / `PHASE5_MIGRATED_CODES`。不得再放条目。
4. **不恢复批次大文件**：不得新建 `BATCH_*`、`MIGRATED_*` 数组或 `ability-migration-batches.js`。
   迁移账本 `audit/migration-batches.json` 只记「哪张卡属于哪一批」，不是行为存放处。
5. **目录卡不等于行为卡**：`cards-data.js` 里的 5,930 张卡面数据仍由导入器生成，不按卡拆文件；
   只有已经实现行为的 460 张玩家卡在 `entries/` 里有文件。未实现的卡不要预建空文件。
6. **卡只能经描述子与 `ctx.api` 结算**：不得 import `src/engine/engine.js`、`card-abilities.js`、
   批次文件或 `content/`；不得直接改 `state`。需要新机制时先扩 `ability.js` / `windows.js` /
   `matcher.js` / `modifiers.js` / `targets.js` / `play-condition.js` / `effect-state.js`。
7. **新增/删除/改名卡牌文件后必须重建索引**：`node tools/build-card-index.mjs --write`
   （或 `npm run cards:index`）。索引是签入仓库的生成物，运行时不做目录扫描。

以上 1–4、6 由 [`tests/card-entries.test.mjs`](../tests/card-entries.test.mjs) 守住；
索引一致性由同一个用例 + [`tools/build-card-index.mjs`](../tools/build-card-index.mjs) 守住。

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

`npm run test:fast` 应全绿（2026-10-21 实测 2182 例全部通过）；新增失败 0 条才算通过。

### 3.1 批量迁移时：索引只由主进程重建

整轮扩展由主进程 + 多个子进程迁移卡牌。子进程**只写自己分到的** `entries/<code>.js`：

```bash
# 子进程：创建骨架但不重建索引
node tools/scaffold-card.mjs 01xxx --entry --no-index
# 主进程：所有分片合并后统一重建一次
node tools/build-card-index.mjs --write
npm run cards:check
```

- 子进程不得改 `entries/index.js`、`_shared.js`、`card-abilities.js`、`src/engine/**`、`content/**`、`docs/**`、`audit/**`。
- 需要新原语时，子进程写 `artifacts/migration/<cycle>/primitive-requests/*.json` 并继续其他卡；
  主进程实现、补测试、更新原语目录并回写 `done` 后才继续该卡。协议见
  [`arkham-content-migration.md`](arkham-content-migration.md) §4.6.3。
- 合并门禁：分片无交集、无越界写入、索引只重建一次、`cards:check` 通过、replay 一致、
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

规则：

- 只有两张以上卡真正复用的逻辑才进 `_shared.js`；一张卡的私有 helper 留在该卡文件里。
- matcher 组合子从 `../../engine/matcher.js` 按需 import；不要在这里复制 predicate。
- `INVESTIGATOR_ABILITIES` 只从 `../card-effects.js` 取（旧印/加尔文等数据表）；不要直接读 `cards-data.js`。
- 依赖方向：`entries/<code>.js` → `_shared.js` / `engine/matcher.js` / `cards/card-effects.js`；
  **不能**反向 import `card-abilities.js` 或 `engine.js`。

---

## 5. 为什么不是 5,930 个文件

| 层 | 数量 | 存放 | 是否一卡一文件 |
| --- | --- | --- | --- |
| 卡面数据（名字/类型/费用/文本） | 5,930 | `src/cards/cards-data.js`（导入器生成） | 否；生成物，按循环拆也没有收益 |
| 行为描述子 | 460（+9 非玩家） | `src/cards/entries/<code>.js` | 是 |
| 战役/关卡内容 | 按章节 | `content/campaigns/` | 按章节文件 |

实测（Node 24，热缓存）：460 个模块约 +165 ms/新进程；5,930 个模块约 +1.9 s/新进程。
测试按文件独立进程运行，后者会把启动成本乘以用例数量，且商店清单/增量更新也会变大。
所以目录卡保持单文件；只给**已经实现行为**的卡建文件，未实现的卡用脚手架按需生成。

---

## 6. 守卫与工具

| 工具/用例 | 作用 |
| --- | --- |
| [`tools/build-card-index.mjs`](../tools/build-card-index.mjs) | 生成/校验 `entries/index.js`；`--write` / `--check` |
| [`tools/scaffold-card.mjs`](../tools/scaffold-card.mjs) | `--entry` 生成单卡骨架（默认同时重建索引；批量迁移用 `--entry --no-index` 跳过索引）；同时生成 `develop/scaffolds/<code>.test.mjs` |
| [`tools/migrate-card.mjs`](../tools/migrate-card.mjs) | 旧 DSL → 单卡文件；`--verify` 校验账本与文件 |
| [`tools/split-card-entries.mjs`](../tools/split-card-entries.mjs) | **一次性**拆分工具；旧源码在拆分时备份到 `artifacts/legacy/`（`artifacts/` 不签入，需要回看时从 git 历史取），不要重跑 |
| [`tests/card-entries.test.mjs`](../tests/card-entries.test.mjs) | 文件名/`code`/单一 default/索引顺序/禁止批次/禁止 import |
| [`tests/migration-tools.test.mjs`](../tests/migration-tools.test.mjs) | 账本每张卡都有单卡文件；渲染/判定仍可复用 |

`npm run cards:index` = `build-card-index.mjs --write`；`npm run cards:index:check` = `--check`。

---

## 7. 拆分记录（可复现）

- 旧源：`src/cards/card-abilities.js`（3,871 行） + `src/cards/ability-migration-batches.js`（1,781 行）。
- 生成：459 个文件，其中 21 个旧印、22 个快速反应事件、2 个 `.map` 生成的意志闪避、1 个加尔文；
  28 个卡号在旧 `byCode` 里由多条合并（abilities/modifiers 拼接、同名字段后者覆盖）。
- 顺序：`entries/index.js` 保持旧 `byCode` 的首次出现顺序；`CARD_ABILITY_ENTRIES` 直接等于索引列表。
- 证据：
  - `node tools/split-card-entries.mjs --check` → 代码集合/字段集合/abilities/modifiers 条数与运行时一致；
  - 逐条递归对比（函数按源码归一化）→ 0 处差异；
  - `node tools/replay-fixtures.mjs --compare artifacts/card-split-baseline.json` → 10 局 / 529 步逐条一致。
- 旧源快照：拆分时写到 `artifacts/legacy/card-abilities.js` 与
  `artifacts/legacy/ability-migration-batches.js`（`artifacts/` 不签入；需要时从 git 历史取）。
  它们只作证据/回滚，不是运行时输入。
