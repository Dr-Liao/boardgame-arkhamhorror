# P7（M2 玩家卡）迁移 worker 简报

> 适用：`games/arkhamhorror`，第四循环 **The Circle Undone**（`tcu`，《万象无终》）的 **P7 / M2 玩家卡**批量迁移。
> 主进程（Lead）负责共享文件、索引、审计账本与合并门禁；你是**玩家卡 worker**，只写自己分片的单卡文件与测试。
> 协议依据：[`docs/arkham-content-migration.md`](../../../../../docs/arkham-content-migration.md) §4.6（多子进程 + 原语队列）；
> 任务范围：[`docs/tcu-migration-roadmap.md`](../../../../../docs/tcu-migration-roadmap.md) §7.2 / §7.4；卡牌模型：`docs/card-model.md`。

---

## 1. 开始前必须读的文档（按顺序，读完整篇）

1. `docs/card-entry-files.md` —— 一卡一文件硬规矩、文件形状、条目特殊形态。
2. `docs/card-model.md` —— 条目形状、12 个 `kind`、`modifiers`、`target`、`playCondition`、费用/上限/检定的声明式写法、`ctx.api`。
3. `docs/arkham-content-migration.md` §4.6 —— 多子进程协议（你的写入边界、原语请求、合并门禁）。
4. `docs/tcu-investigators.md` §4–§5 —— P6 已有的读点/窗口与「显式简化」写法（本批大量复用）。
5. `docs/tcu-primitives.md` —— P3 落地的 14 个 TCU 原语（闹鬼/幽灵牌堆/塔罗/阵法/绑定/塔罗槽/裂口/memento 等）。
6. 根目录 `AGENTS.md` —— 不可协商项（卡文件禁止 import 引擎/content/聚合入口）。
7. 本目录 `shards.json`（分片清单、输入快照哈希）和你自己的 `<worker>.input.json`（本片 22 张卡的完整卡面字段）。

参考实现（**只读**，不 import、不复制文件）：
- `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/{Asset,Event,Skill,Enemy,Treachery}/CardDefs/TheCircleUndone/`（核心规则行为）
- `参考资源/ArkhamHorror-main/frontend/src/locales/zh/theCircleUndone/`（中文剧情，玩家卡一般用不到）
- 中文卡文以 `src/cards/cards-data.js` 的 `textZh` 为唯一事实源；英文 `text` 只作对照。

---

## 2. 你的角色与硬边界

| 项 | 内容 |
| --- | --- |
| 你只写 | ① 自己分片的 `src/cards/entries/<code>.js`；② 自己的测试文件 `tests/tcu-player-<shard>.test.mjs`；③ 自己的 `artifacts/migration/tcu/workers/<worker>.json` 报告；④ `artifacts/migration/tcu/primitive-requests/*.json`（原语请求） |
| 绝对不写 | 两个 `index.js`、任一本 `_shared.js`、`card-abilities.js` / `encounter-abilities.js`、`src/engine/**`、`src/deck/**`、`content/**`、`web/**`、`docs/**`、`audit/**`、`tools/**`、`package.json`、`tests/suites.mjs`、`tests/node-suite.mjs`、别人的卡/测试文件 |
| 索引 | `entries/index.js` 只由主进程重建；**不要**运行 `tools/build-card-index.mjs` / `build-encounter-index.mjs` |
| 原语 | 卡只能用已登记原语；表达不了时写原语请求、把卡标 `blocked`、继续下一张；**不要改引擎** |
| 目录卡 | `cards-data.js` 不按卡拆，不要改；未实现行为的卡**不要预建空文件**（本任务要求 87 张全部有实现，见 §3） |

环境说明：本会话已切到 `danger-full-access`，shell 可以写文件；但仍请**用 `write` / `edit` / `read` 工具改文件**（版本守卫更可靠）。
禁止运行 `npm ...`（PowerShell 执行策略会拦 `npm.ps1`）；需要跑脚本时一律 `node <脚本>`。不要运行全量 `test:fast`（主进程统一跑）。

---

## 3. 每张卡的交付标准（逐卡验收）

对分片内 **每一张** 卡，交付三样东西，缺一不可：

1. **单卡文件** `src/cards/entries/<code>.js`（`export default` 恰好一个条目，`code` 等于文件名）。
   - 卡面有行为：用描述子表达（`abilities` / `modifiers` / `playCondition` / `uses` / `target` / `limit` / `cost` / `fast` / `noOpportunityAttack` / `countsAs` / `weaknessStaysInHand` 等，按卡面）。
   - 印刷效果**完全由卡面数据与引擎通用规则实现**的纯数据卡（例如只加技能图标/生命上限、或只有使用次数的资产）：在测试里用 `DATA_IMPLEMENTED_CODES` 的同一口径证明「数据通道即实现」，见 §7 的 `data` 通道写法；仍然要写测试，但**不要求**有 abilities。
   - 不要为了“看起来统一”而给纯数据卡写空 `abilities`/空 `modifiers` 之外的假逻辑。
2. **该卡至少有 1 条真实行为测试**，测试名必须以 `TCU <code> <中文名>` 开头，例如：
   `test('TCU 05020 拷问 主要印刷效果契约可执行', () => { ... })`
   - 「真实」= 在 `core-fixture` 对局态里真的打出/使用/触发该卡并断言状态变化；**不允许**只断言条目存在、卡号在目录里、文本非空、`rulesImplemented` 为 true。
   - 每张卡至少 1 条；有多个可验证分支的卡建议 2–4 条，全部用同一前缀（`TCU <code> ...`），账本会收集该前缀下的所有测试作为证据。
3. **自己的测试文件**里维护本分片全部测试：`tests/tcu-player-<shard>.test.mjs`（例如 `tests/tcu-player-m2-1.test.mjs`）。

### 3.1 显式简化（允许，但必须写出来）

引擎/原语确实表达不了的卡面分支：
- 在条目顶层写 `simplified: true`，并写 `note: '未实现：……（原因）'`，同时把**主要印刷效果做对**并测试；
- 在 worker 报告 `simplified[]` 与最终消息里逐条列出（账本 `remaining` 会汇总，P10 前必须处理或保持显式）；
- 不允许静默简化、不允许用「近似卡文」假装等价。

### 3.2 原语请求（blocked 卡）

某张卡的主要效果完全无法用现有原语表达时：
1. 写 `artifacts/migration/tcu/primitive-requests/<worker>-<code>-<primitive>.json`，先写 `.tmp` 再 rename（或直接写最终文件名也可）；
   schema 见 `docs/arkham-content-migration.md` §4.6.3（`schemaVersion/id/cycle/worker/card/primitive/params/cardText/reason/proposedApi/status:'pending'/createdAt`）；
2. 把该卡在该 worker 报告中记为 `blocked`，**不要**为它写假行为文件，继续同片其他卡；
3. 消息告知 Lead（主进程去重、实现、回写 `done`）；收到 `done` 后按 `resolution.api` 重写该卡。

---

## 4. 卡面数据与参考实现查询

完整字段（`textZh` 是中文卡文）已在你的 `artifacts/migration/tcu/workers/<worker>.input.json`。需要别的卡时：

```powershell
node --input-type=module -e "const {ALL_CARDS}=await import('./src/cards/cards-data.js'); for(const c of ['05020','05023']) console.log(JSON.stringify(ALL_CARDS[c],null,1))"
```

参考实现定位（例如 05020）：

```powershell
Get-ChildItem '参考资源\ArkhamHorror-main\backend\arkham-api\library\Arkham' -Recurse -Filter '*.hs' |
  Select-String -Pattern '05020' -List | Select-Object -First 5 Path
```

---

## 5. 行为模型速查

### 5.1 条目形状（常用字段）

```js
export default {
  code: '05xxx',
  uses: 3, usesType: 'ammo', discardWhenEmpty: true,   // 使用次数（弹药/充能/秘密/补给）
  fast: true, noOpportunityAttack: true,               // 资产/调查员的快速、不触发借机
  playCondition: [ ... ],                              // 能不能打出（组合子见 §5.5）
  modifiers: [ ... ],                                  // 常驻修正（§5.4）
  abilities: [ ... ],                                  // 生命周期钩子（§5.2）
}
```

### 5.2 kind（本批会用到）

| kind | 用途 | payload |
| --- | --- | --- |
| `action` | 支援/敌人的主动行动（含 `[action]`/`[free]` 行动） | `resolve` 或 `effect` 数据体；`cost`、`target`、`limit` |
| `free` | 玩家窗口内的免费触发（如投入前、检定后） | `trigger` + `resolve`/`effect` |
| `reaction` / `forced` | 事件窗口后的反应/强制 | `trigger` + `criteria` + `resolve`/`effect` |
| `played` | 事件卡打出时结算 | `effect`（效果 DSL）；`fast`/`noOpportunityAttack` 写在这一层 |
| `commit` | 技能卡/投入时修正 | `skill: { icons|onSuccess|... }`（检定档案） |
| `weakness` | 弱点揭示结算 | `weakness: {...}`，可加 `resolve` 接管 |
| `entersPlay` / `leavesPlay` | 支援入场/离场钩子 | `entersPlay` / `leavesPlay` 效果 DSL，或 `resolve` |
| `setup` | 开局效果（永久卡） | 效果 DSL（走 EFFECTS 回退路径） |

`kind` 与卡型必须匹配（`tests/card-entries.test.mjs` 守）：**事件卡必须有 `played` 或 `reaction+fromHand`**；**支援不得只有 `played`**。

### 5.3 效果 DSL（`played`/`entersPlay` 等用，详见 docs/card-model.md）

```js
effect: { type: 'fight', combatBonus: 2, damageBonus: 1 }
effect: { type: 'investigate', shroudMod: -1 }
effect: { type: 'dealDamage', amount: 1, target: 'here', noOpportunityAttack: true }
effect: { type: 'draw', amount: 1 } / { type: 'gainResources', amount: 2 } / { type: 'heal', ... }
effect: { type: 'addDoom', amount: 1 } / { type: 'discoverClue', ... } / { type: 'move', ... }
```
复杂/条件效果用 `resolve(ctx)` + `ctx.api`（数据表达不了时才用；不得直接改 state）。

### 5.4 常驻修正 `modifiers`

```js
{ target: 'skill:willpower', amount: 1 }
{ target: 'skill:*', amount: 1, condition: { ... } }
{ target: 'maxHealth', amount: 1 } / { target: 'maxSanity', amount: 1 }
{ target: 'add:slot', value: 'tarot' }        // 额外塔罗槽（P2.9 读点）
{ target: 'slot:hand', amount: 1 }            // 注意：额外槽位必须用 add:slot，不要写 slot:...
```
条件写法：`damageAtLeast / resourcesAtMost / atTrait / sourceInHand / when(ctx)` 等（见 card-model.md §4）。

### 5.5 条件 / 目标 / 费用 / 上限

- `playCondition`：`ownTurn / ownFirstAction / clueAtLocation / noEnemiesHere / remainingSanityAtLeast / investigatorClues / resignAvailable` 或旧字段翻译。
- `target: { kind: 'enemy' | 'investigator' | 'location' | 'asset' | 'cardInHand', optional?: boolean, query?: predicate }`。
- `cost: { action, resources, uses, exhaust, discardSelf, horror, clues, ... }`，支持 `{ per: '...' }` 表达式。
- `limit: 'oncePerTurn'` 或 `{ scope: 'perTurn'|'perRound'|'perGame'|'perTest'|'perPhase', owner: 'instance'|'investigator' }`。
- 非普通行动结算的能力（如“按躲避结算/按攻击结算”）必须写 `countsAs: 'evade'` / `'fight'`。

### 5.6 `ctx.api` 常用读点（完整列表见 card-model.md §6.1 与引擎源码）

`drawCards / gainResources / heal / harm / test / commitCards / choice / info / discoverAt / dealDamage / moveInvestigator / engage / evade / fight? / putIntoPlay / discardFromHand / shuffleDeck / topDeckCodes / searchDeck / lookAt / attachCardFromDeck / attachToLocation / addEffect / placeDoomOnCard / removeThreat / cardName / cardType / cardTraits / cardIcons / locationName / investigatorsAt / setAssetUses / addPendingTestBonus / ...`
拿不准时先 `grep 'api\.' src/cards/entries/*.js` 找同类卡写法。

### 5.7 P3/P6 与本批强相关的既有读点

- **塔罗槽位**（P2.9）：`src/engine/tarot-slot.js` —— `add:slot` value `tarot`；开局入手入场、手牌封锁、换牌保护都由引擎读点处理，卡面只需 `modifiers` + `reaction scenarioStarts`（参照 05023）。
- **绑定 Bonded**（P2.8）：`src/engine/bonded.js`；卡面数据 `bondedCards/bondedTo/bondedCount` 已在 `cards-data.js`。05313/05314、05316/05317 是绑定组，入场/离场行为优先用引擎读点（`ctx.api.bonded` 或 `api.attachCardFromDeck` 口径以 P3 测试 `tests/tcu-primitives-bonded.test.mjs` 为准）。
- **通用谈判 Parley**（P2.7）：`src/engine/parley.js`；玩家卡里 05020 拷问是「谈判」行动（`actionKind: 'parley'` 的实体能力通道主要给敌人/地点；玩家卡打出谈判事件的写法看现有事件卡）。
- **法术专用额外行动**（P6）：`src/engine/spell-actions.js`（只与 05006 调查员相关，玩家卡一般不用）。
- **新窗口**（P6 落地）：`horrorHealed / cardCancelled / enemyAttacked / agendaWouldAdvance`；另有已注册窗口清单可在 `node --input-type=module -e "await import('./src/engine/engine.js'); const w=await import('./src/engine/windows.js'); console.log(w.windows().map(x=>x.id).join(','))"` 打印（注意 `spellPlayed / chaosTokenRevealed / symbolRevealed / enemyDefeated / evadeSuccess / investigateFail / damageAssignedToSelf / scenarioStarts` 等都在）。
- **取消/替换**：05021/05032/05033/05280/05315/05324 这类「取消伤害/恐惧/标记/效果」优先用 `reaction` + `api.harm`/`state` 读点；没有通用取消原语时用 `resolve` 精确实现，并在原语请求中记录（主进程决定是否提升为通用原语）。
- **永久/卓越**：05276/05278/05320 —— `permanent`/`exceptional` 卡面字段在 `cards-data.js`；永久卡开局效果走 `setup` 通道（看 04106/04109 的 data 通道与 docs）；卓越卡升级费用读点见 `src/campaign/campaign.js`。
- **升级卡**：同名的 0 级/3 级/4 级/5 级变体行为通常共享主体，允许在各自文件里重复必要的少量逻辑；**不得**新建 batch/shared 大数组。可把跨卡逻辑写进 `_shared.js`？——不可以，`_shared.js` 只有主进程能改；需要时发原语请求。

---

## 6. 测试文件规范

路径：`tests/tcu-player-<shard>.test.mjs`（你自己的分片；文件名与 `shards.json` 一致）。
本文件由主进程登记进 `tests/suites.mjs`（fast tier）与 `tests/node-suite.mjs`，你**不要**改那两个文件。

骨架：

```js
// 万象无终（第四循环）M2 玩家卡 · <your shard> 逐卡验收 —— P7。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, play, move, asset, enemy, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry } from '../src/engine/ability.js'
import { DATA_IMPLEMENTED_CODES } from '../src/cards/card-implementation.js'
import { EFFECTS } from '../src/cards/card-effects.js'

const codes = ['05020', /* ...本分片全部卡号，顺序固定... */]
assert.equal(codes.length, 22)   // 与本分片一致

for (const code of codes) {
  test(`TCU ${code} ${ALL_CARDS[code].nameZh || ALL_CARDS[code].name} 主要印刷效果契约可执行`, () => {
    // 真实行为：fixture → play/asset/use/trigger → 断言状态；纯数据卡走 data 通道断言
  })
}

// 复杂卡再加：`TCU <code> ...` 开头的分支测试（取消/负面路径/存档往返等）
```

约定与坑：
- 测试名唯一；所有本卡相关测试都以 `TCU <code> ` 开头（账本按这个前缀收集证据）。
- 每次事务/`applyMove` 后引擎会替换调查员对象：断言前重新 `state.investigators[0]`。
- 会弹选择的结算用 `settle(state)`（core-fixture）或自定义 `choose`；循环上限保护。
- 测试必须**确定性**：随机只通过引擎 `randomValue`/seed；不要依赖时间/外部网络。
- `fixture()` 会清空手牌/资产/牌库并给 30 资源；需要时直接改 `state.investigators[0].hand` 等字段准备局面。
- 纯数据卡证明方式示例（参照 `tests/tfa-player-acceptance.test.mjs` 的 `hasBehaviorData`）：
  `assert.ok(registeredEntry(code) || DATA_IMPLEMENTED_CODES.has(code) || ...)`
  再加至少一条可执行断言（例如卡面数据字段、图标、槽位、费用与 `ALL_CARDS[code]` 一致，或引擎读点行为）。**只断言存在**会被账本工具当成目录级证据拒绝。
- 不要 import `../src/engine/engine.js` 之外的内部实现文件（测试可以 import 引擎读点，卡文件不行）。
- 已有 5 张样本卡（05023/05025/05028 在 M2-1；05112/05115 在 M2-2）**必须重新逐卡核对**：卡文逐句对照，补测试；05112 曾标 `simplified`，能补齐就补齐，不能就保留显式简化并写明。

### 6.1 自检流程（重要）

1. 写完一批（建议先写 2–3 张「试点卡」）→ 对每个条目跑 `node --check src/cards/entries/<code>.js`；
2. 消息 Lead：「`<worker>` 试点卡条目已写完，请重建索引」——主进程重建 `entries/index.js` 后回复你；
3. 跑自己的测试文件：`node tests/tcu-player-<shard>.test.mjs`（**注意：不是 `node --test`**；本环境 `node --test` 会尝试 spawn 子进程）；
4. 失败就修条目/测试，重跑；不要把失败留给主进程；
5. 全绿后消息 Lead：「`<worker>` 测试全绿，请合并」并写 worker 报告。

> 主进程会在收到你的「条目写完」后重建索引；此后你新增的条目会被下一次重建收录。**不要**自己重建索引。

---

## 7. worker 报告（最后必写）

`artifacts/migration/tcu/workers/<worker>.json`：

```json
{
  "schemaVersion": 1,
  "worker": "w-m2-1",
  "shard": "M2-1",
  "cycle": "tcu",
  "milestone": "P7",
  "startedAt": "2026-10-24T02:10:00+08:00",
  "finishedAt": "2026-10-24T03:00:00+08:00",
  "codes": ["05020", "..."],
  "done": ["05020", "..."],
  "blocked": [],
  "simplified": [{ "code": "05112", "note": "……" }],
  "doneCount": 22,
  "blockedCount": 0,
  "testFile": "tests/tcu-player-m2-1.test.mjs",
  "testsPassed": 26,
  "primitiveRequests": [],
  "notes": "……"
}
```
每完成一张卡可先写一份草稿，最后更新为终稿（这是你的报告，不是共享账本）。

---

## 8. 里程碑与沟通节奏

1. **开工**：读文档 → 看自己的 input.json 与 shards.json → 在共享任务板领任务（Lead 会给你 task id）。
2. **试点**（建议前 2–3 张）：写条目 + 测试 → `node --check` → 消息 Lead 重建索引 → 跑测试 → 绿了继续。
3. **全量写卡**：按卡号顺序推进；blocked/simplified 随时记录。
4. **测试全绿**：`node tests/tcu-player-<shard>.test.mjs` 通过（0 fail）→ 写报告 → 消息 Lead 汇报：done/blocked/simplified/测试通过数。
5. Lead 合并/复核后可能发回返工项：修完重跑、回报。

消息保持简短；不要每条卡都发消息（按试点/半程/全绿/返工四个节点）。

---

## 9. 常见会被门禁打回的写法

- 卡文件 import `engine.js` / `card-abilities.js` / `encounter-abilities.js` / `content/**` / `src/deck/**`。
- 一个文件里 `export default` 多个；`code` 与文件名不一致；一个文件写多张卡。
- 事件卡缺 `played`；支援只有 `played`；`kind` 与卡型不匹配。
- 写未知字段/未知 `kind`/未知窗口/未知 `modifier target`（注册期会抛错，测试直接红）。
- 只写「条目存在/卡号在目录/文本非空」的测试 → 账本工具判为目录级证据，拒绝。
- 为省事把行为塞进 `_shared.js`/引擎/新 batch 文件 → 越界。
- 改了别人的卡/索引/共享文件 → 合并拒绝。

不确定时优先：读现有同类卡 + 读 docs + 发消息问 Lead。**先原语、后卡牌；宁可按协议发原语请求，不要改引擎。**
