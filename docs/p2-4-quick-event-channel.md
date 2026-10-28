# P2-4：快速事件统一通道与重印别名（2026-10-28 落地）

> 关联：[`duplicate-scan-report.md`](duplicate-scan-report.md) §九 P2-4、
> [`card-model.md`](card-model.md) §5c/§7.1、[`arkham-content-migration.md`](arkham-content-migration.md) §4.6.10 ③、
> [`handoff-2026-10-28-p3.md`](handoff-2026-10-28-p3.md) §3。

## 0. 结论

同一张印刷卡现在**只有一份行为实现**：canonical（`01xx`）文件；重印号在注册期生成「只改 code 的
别名条目」。上轮试点卡住的两个原因都已解决，而不是绕过：

1. **快速事件两条实现通道**收敛成一条：`played + fast + trigger`（旧写法，43 张卡）与
   `reaction + fromHand + quickEvent`（新写法）由 `ability.js#quickEventView` 归一，只有
   **一个候选出口**（`encounter.js#reactionWindow`）与**一个执行器**（`assets.js#playReactionCard`）。
   golden 13 局的展示方言（手牌下标 optionId / 卡名 label / `不打出` / `⚡ 快速打出` 日志 /
   `state._reaction` / 去向旗标）逐字不变。
2. **重印别名**进注册期（`engine/ability.js#registerCardAbilities`），数据来自 cards-data 的
   `duplicateOfCode` / `duplicatedBy`；5 个 `015xx` 实现文件删除，R2 由 5 → 0。

金标准：`node tools/replay-fixtures.mjs --check` **13/13 指纹一致**；`test:fast` 除既有
Playwright 证据缺失类失败外全绿。

## 1. 快速事件统一通道

### 1.1 两种合法数据写法

```js
// 旧写法（A 支，已锁指纹）：played + fast + trigger + effect|resolve
{ kind: 'played', fast: true, trigger: 'defeatEnemy', criteria: { selfOnly: true },
  effect: { type: 'discoverClue', amount: 1 } }        // 01022 证据！

// 新写法（统一通道接受的能力层写法）：reaction + fromHand + quickEvent
{ kind: 'reaction', fromHand: true, quickEvent: true, trigger: 'defeatEnemy',
  criteria: [ownSeat()], resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1) }
```

`quickEvent: true` 只能写在 `reaction` 描述子上（`normalizeDescriptor` 注册期校验，声明即接线）；
它隐式 `fromHand: true`。**普通反应/强制能力不受影响**，仍由 `openAbilityWindow` 枚举。

### 1.2 唯一候选视图：`quickEventView(code)`

`src/engine/ability.js` 返回 `{ style: 'played' | 'reaction', descriptor, trigger, criteria }`：

- 两个读点：`encounter.js#reactionWindow`（候选出口）、`assets.js#playReactionCard`（执行器）；
- 旧写法的 `criteria` 仍是旧对象方言（`selfOnly`/`anyLocation`/…），新写法的 `criteria` 是
  matcher 数组/函数，两套条件在同一个过滤函数里判定；
- `play-condition.js#playAccess` 用同一个视图推导 `reactionOnly`：两种写法都**不能当普通行动打出**
  （修掉 fromHand 事件可被普通打出的漏洞）。

### 1.3 唯一出口保持旧展示方言（golden 零漂移的前提）

`reactionWindow` 仍产出：手牌下标 optionId（`'0'`…）、卡名 label、`不打出`、`是否打出快速反应卡？`、
`⚡ 快速打出「X」。`（直觉牌库 `🔮 从直觉牌库…`）、`state._reaction` 嵌套抑制、以及
`removeAfterPlay/exileAfterPlay/addToVictory/shuffleBackAfterPlay/keepOnPlay` 全量去向旗标。
**不要**把这些换成能力窗口的 `desc:` id / `【能力】` label / `✨ 使用…` 日志——6 局 golden 在前
6 个快速事件窗口上直接依赖它们。

### 1.4 顺带修掉的通道缺陷

- `openAbilityWindow` 在 `quickEventWindow: true` 时跳过 `quickEvent` 候选，避免同一次触发被问两遍
  （旧写法本来就不会进能力窗口）；
- `playerWindow` 的免费能力有「旧 shim + 能力层 free 描述子」两条枚举路径，同一条描述子只列一次
  （`shimOffered` 去重），否则窗口选项顺序/id 变化会改重放指纹；
- fromHand 事件 `reactionOnly` 收紧后，`050xx` 系列不再能被当普通行动打出。

### 1.5 迁移边界

`050xx` 里已用 `reaction + fromHand` 写的事件（05025 等）**还没有**声明 `quickEvent`，因此仍走
能力窗口的「【能力】…」询问。逐卡迁到统一通道是后续小批（每张卡要过一遍 TCU 行为测试与浏览器
三态验收）；本轮不批量改，避免把 TCU 展示方言混进重印合并。

## 2. 重印别名

### 2.1 数据与注册

- 事实源：`src/cards/cards-data.js` 的 `duplicateOfCode` / `duplicatedBy`；
- 白名单：`src/cards/entries/_reprint-aliases.js`（硬编码守卫只允许卡号出现在
  `entries/**`、`encounter-entries/**` 与 `cards-data.js`，所以表放在 `entries/` 下，命名以 `_` 开头，
  索引生成器与合规审计按 `_shared.js` 同样忽略）；
- 出口：`src/cards/card-identity.js`（`REPRINT_ALIASES` / `reprintAliasesFor`，符合
  「重印另一号走 card-identity 的别名」约定）；
- 注册：`registerCardAbilities` 注册 canonical 后，为白名单里、**没有自己的条目文件**的别名号生成
  `{ ...canonicalEntry, code: alias, reprintOf: canonical }`，与 canonical 走同一套描述子校验、
  同一套窗口/执行路径；`reprintOf` 让 `declaredAbilityCount()` 等指标不重复计数（指标只减不增）；
- 运行时门槛：`stats.js#runtimeCardAvailable` 对别名号回落到 canonical 的可用性（`015xx` 是
  catalog-only，否则反应窗口会被过滤掉）；**构筑/牌池可用性仍在 deck 层判定，不受影响**。

### 2.2 5 对合并结果

| 印刷卡 | canonical | 别名 | canonical 选择与说明 |
| --- | --- | --- | --- |
| 巡警 Beat Cop | `01018` | `01518` | 采用能力层写法：`modifiers` +1 战斗、`target:{kind:'enemy'}` + `effect`（B1 接线）；保留 `cost.action:false` 的 `action` 形状，避免收尾窗口多一条 free 候选改指纹 |
| 证据！Evidence! | `01022` | `01522` | 保留旧 `played+fast` 写法（golden 6 局直接打出，optionId/日志已锁） |
| 闪躲 Dodge | `01023` | `01523`、`60113` | 保留旧 `played+fast` 写法（同上） |
| 警徽 Police Badge | `01027` | `01527` | 保留 `01027` 的 `targetedEffect`（`activeTurnOnly`）：01527 手写实现缺「正在行动」过滤且直写字段，属实现缺陷，不采用 |
| 米兰·克里斯托弗博士 | `01033` | `01533` | 保留 `01033` 的 `legacyReaction + effect`：golden 3 局在调查成功后**自动领取**并写 `⚡ 触发「米兰」的反应。`，日志参与指纹 |

## 3. 口径裁决（本轮拍板）

1. **纯收益反应自动领取优先**：`01033/01533` 统一为自动领取（`autoByDefault: true`、
   `hasReactionPrompt: false`）。规则书层面「可选反应」仍成立，但零漂移要求与既有 01033 行为优先；
   01533 的「新式询问」口径作废。相应更新 `tests/auto-pass.test.mjs`、`tests/ability-layer.test.mjs`、
   `tests/player-dashboard.browser.mjs`（浏览器三态断言，需 Playwright 环境复跑）。
2. **快速事件以 canonical 的旧方言为准**：`01522/01523` 是别名，行为与 `01022/01023` 完全一致；
   之前为 015xx 新式写法写的「能力窗口【能力】label」断言改为别名一致性断言
   （`tests/ability-layer.test.mjs`、`tests/card-fidelity-p1.test.mjs`）。
3. **01018 形状裁决**：`action + cost.action:false + target + effect`。试过的两种形状都被 golden
   否决：`free + resolve` 让收尾窗口多出空候选（`notz-strict-random-3p` 第 80 步漂移）；
   `action + resolve` 让「无敌人时也列能力」（`dunwich-extracurricular-hub` 第 15 步漂移）。

## 4. 验证证据

| 门禁 | 结果 |
| --- | --- |
| `node tools/replay-fixtures.mjs --check` | 13/13 指纹一致（含 01022/01023 共 10 次快速事件打出、01033 自动领取 3 局） |
| `audit/card-entry-compliance.json` | R1 152 → 151（删 01527），**R2 5 → 0**，R3 0，singleCardField 0 |
| `audit/ability-coverage.json` | descriptorEntries 572 → 567、descriptorAbilities 531 → 526（只降不升） |
| `audit/hardcode-whitelist.json` | 无新增（别名表在 `entries/` 下，守卫口径内） |
| `tests/reprint-aliases.test.mjs` | 别名表与 cards-data 双向一致、注册形状一致、运行时可用性、`quickEventView` 与注册期校验 |
| `test:fast` | 除 `tests/tcu-migration.test.mjs` P1 账本（缺 Playwright 截图证据，既有基线环境问题）外全绿 |

## 5. 文件清单

- 引擎：`src/engine/ability.js`（`quickEventView` / 别名注册 / `reprintOf`）、`encounter.js`
  （唯一候选出口 + `playerWindow` 去重）、`assets.js`（执行器走统一视图）、`ability-exec.js`
  （`quickEventWindow` 跳过）、`play-condition.js`（`reactionOnly`）、`stats.js`（别名运行时可可用性）、
  `engine.js`（依赖注入）；
- 数据：`src/cards/entries/_reprint-aliases.js`（新）、`src/cards/card-identity.js`（出口）、
  `src/cards/entries/01018.js`（合并后唯一实现）、删除 `01518/01522/01523/01527/01533.js`、
  `entries/index.js` 重建；
- 测试：新增 `tests/reprint-aliases.test.mjs`；更新 `ability-layer` / `auto-pass` /
  `card-fidelity-p1` / `turn-end-window` / `card-entries` / `suites`；
- 工具：`tools/build-card-index.mjs`、`tools/audit-card-entry-compliance.mjs`（忽略 `_reprint-aliases.js`）。
