# 万象无终（TCU）M1 调查员手册（第 5 步产物）

> 适用：`games/arkhamhorror`，第四循环 **The Circle Undone**（代号 `tcu`，中文《万象无终》）。
> 依据：[`tcu-migration-roadmap.md`](tcu-migration-roadmap.md) §7.1（M1 调查员）与 §8.3（证据规则）；
> [`tcu-primitives.md`](tcu-primitives.md)（第 2 步原语）、[`tcu-rules.md`](tcu-rules.md)（第 3 步关键词/规则书）、
> [`tcu-interactions.md`](tcu-interactions.md)（第 4 步交互）。
> 状态口径：本文只写**已经接线、有测试、审计能复算**的东西。没实现的分支不写成可用：
> 5 张卡的显式简化逐条列在 [§5](#5-显式简化5-张)，并且由 `audit/tcu-migration.json` 的 `remaining` 自动复述。

---

## 0. 这份文档怎么用

P6（M1）不是「再写 19 个卡文件」，而是三件事同时成立：**能选人**、**能构筑**、**能力真的跑得通**。
账本由代码、测试与卡面数据算出来，不手写：

```powershell
npm run cards:check                    # 索引 + 一卡一文件守卫（19 张新卡）
npm run test:tcu:investigators         # 逐人验收（Node，33 例）
npm run audit:tcu                      # 重写 audit/tcu-migration.json（含 confirmations.investigators）
npm run audit:tcu:check                # 门禁：与磁盘账本逐字节比对
npm run replay:fixtures                # 行为零变化：13 局 / 786 步
npm run test:fast                      # 全量 fast（无新增失败）
```

| 产物 | 内容 | 谁写 |
| --- | --- | --- |
| `src/cards/entries/05001…05006.js` | 六位调查员：旧印描述子 + 能力层反应 + 修正 + 卡面规则数据 | 手写 |
| `src/cards/entries/05007…05019.js` | 13 张专属卡（7 张专属非弱点 + 6 张专属弱点） | 手写 |
| `src/cards/entries/05046…05049.js` | 序章 4 位故事调查员（无牌组、不进入选人） | 手写 |
| `src/engine/hunch-deck.js` | 直觉牌库（乔·戴蒙德）：设置抽取 / 阶段揭示 / -2 费用 / 洗回 | 手写 |
| `src/engine/resource-bank.js` | 资源寄存（普雷斯顿·家族遗产） | 手写 |
| `src/engine/spell-actions.js` | 法术专用额外行动（玛丽·朗博）的授权与算术 | 手写 |
| `src/engine/cancel-note.js` | 「你拥有的一张卡取消了效果」的公开记账（黛安娜） | 手写 |
| `src/engine/harm-threat.js` | `healHorrorFrom`：治疗恐惧的唯一入口（卡洛琳的触发窗口） | 手写 |
| `src/deck/availability.js` / `src/deck/deckbuilding.js` | 选人表、13 张依赖卡、排除式构筑限制、直觉牌库配额 | 手写 |
| `src/deck/deck-rules.js` → `web/deck-rules.js` | `not: true` 排除项、`text` 正则、`hh` / `st` 构筑标签 | 手写 |
| `content/packs/tcuInvestigators/manifest.js` | 包状态 `verified`、19/19 `rulesImplemented` | 手写 |
| `tests/tcu-investigators.test.mjs` | 33 例逐人验收 | 手写 |
| `audit/tcu-migration.json` | `confirmations.investigators` + `gate.investigatorsVerified` | **审计工具** |

---

## 1. 六位正式调查员

| 卡号 | 调查员 | 职业 | 生命/理智 | 牌组 | 专属卡 / 专属弱点 | 主能力读点 | 旧印 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 05001 | 卡洛琳·弗恩 | 守护者 | 6/9 | 30 | 05007 催眠疗法 / 05008 理性思考 | `horrorHealed` 窗口上的能力反应（`src/engine/harm-threat.js#healHorrorFrom`） | +1，可治愈 1 点恐惧 |
| 05002 | 乔·戴蒙德 | 探求者 | 8/6 | 40 | 05009 柯尔特 1911 / 05010 悬案 | 直觉牌库（`src/engine/hunch-deck.js`） | +1，弃牌堆的洞察事件放到直觉牌库底 |
| 05003 | 普雷斯顿·费尔蒙特 | 流浪者 | 7/7 | 30 | 05011 家族遗产 / 05012 秘社“债务” | 资源寄存（`src/engine/resource-bank.js`） | +0，可花 2 资源改为自动成功 |
| 05004 | 黛安娜·史丹利 | 潜修者 | 7/7 | 35 | 05013 银暮匕首 / 05014 黑暗洞察 / 05015 可怕的秘密 | 底下每张 +1 意志（`modifiers` 的 `amount({ controller })`）+ `cardCancelled` 反应 | +2，可把底下的一张卡加入手牌 |
| 05005 | 丽塔·杨 | 求生者 | 9/5 | 30 | 05016 “我不会再逃了！” / 05017 兜帽人 | `evadeSuccess` 反应（伤害或移动，每轮一次） | +2，直到本轮结束忽略反应限制 |
| 05006 | 玛丽·朗博 | 潜修者 | 6/8 | 30 | 05018 神秘乐曲 / 05019 安息日男爵 | 法术专用额外行动（`src/engine/spell-actions.js`） | +1，可在控制的卡牌上增减 1 个毁灭标记 |

约定：

- **卡面规则数据写在条目里**（`investigator` 字段），引擎只认数据，不认卡号：
  `elderSign`、`hunchDeck`、`resourceBank`、`spellActionCredit`、`openingHandExtra`。
  审计对每一份数据跑 `normalizeHunchDeckRule` / `normalizeResourceBankRule`，写错在装配期就失败。
- **旧印走描述子**（`elderSign: { resolve }`）：返回值 `{ delta }` 由 `elderSignEffect` 结算，
  额外效果（治愈、自动成功、加毁灭）在 resolve 里用 `ctx.api` 完成。
- **反应走能力层**（`abilities: [{ kind: 'reaction', trigger }]`）：窗口由引擎注册在
  `src/engine/windows.js`；本批新增 `horrorHealed`、`cardCancelled`、`enemyAttacked`、`agendaWouldAdvance`。

---

## 2. 构筑规则

| 调查员 | 张数 | 构筑选项（卡表原文要点） | 排除/额外限制 |
| --- | --- | --- | --- |
| 05001 卡洛琳 | 30 | 守护者 0–3、中立 0–5、带「治愈……恐惧」字样 0–5、其他探求者/潜修者 0–1 最多 15 | 无等级 1–5 的[[武器]] |
| 05002 乔 | **40** | 探求者 0–5、守护者 0–2、中立 0–5 | 必须含至少 11 张[[洞察]]事件（含悬案） |
| 05003 普雷斯顿 | 30 | 流浪者 0–5、求生者 0–2、中立 0–5 | 无[[违法]]卡牌 |
| 05004 黛安娜 | **35** | 潜修者 0–5、守护者 0–2、中立 0–5 | 开局额外 1 张黑暗洞察 |
| 05005 丽塔 | 30 | 求生者 0–5、中立 0–5、[[技巧]] 0–3 | — |
| 05006 玛丽 | 30 | [[法术]] 0–5、潜修者 0–3、中立 0–5、[[密教]] 0、其他探求者/求生者 0 级最多 5 | — |

实现要点（`src/deck/` 与 `web/deck-rules.js`）：

1. **`not: true` 是排除项**：`optionExcluded()` 先否决整张卡，再谈「命中哪个允许项」。
   旧实现把这类规则当成永远不匹配的允许项，等于没有限制（卡洛琳能带高等级武器）。
   现在自动构筑与手动构筑都走同一份判定，`validateDeckRules` 也会报「属于构筑限制排除的卡牌」。
2. **`text` 正则与 `hh` / `st` 标签**：卡表用
   `{ tag: ['hh'], text: ['[Hh]eals? …horror'] }` 表达「带有『治愈……恐惧』字样的卡牌」。
   `hh` = 卡文能治愈恐惧（英文/中文卡文任一命中），`st` = [[法术]]（特性或卡文）。
3. **直觉牌库配额**：`buildDeck` 先放够「至少 N 张[[洞察]]事件」的配额（0 XP 开局只放 0 级卡），
   再按评分补满张数；手动构筑少放时明确报错（`牌组需要至少 10 张[[Insight]]事件作为直觉牌库`）。
4. **13 张专属卡只作依赖**：`dependencyOnly`、不可构筑、不进玩家卡池；抽到即按弱点/签名规则结算。

---

## 3. 三个调查员专属读点

### 3.1 直觉牌库（乔·戴蒙德）

- 状态：`inv.hunchDeck`（11 张，顺序隐藏）、`inv.hunchRevealed`（本阶段揭示的那张）。
- 卡面声明：`investigator.hunchDeck = { size: 11, trait: 'Insight', requiredCodes: ['05010'], discount: 2 }`。
- 结算点（全部在 `src/engine/hunch-deck.js`）：
  1. **冒险设置**：`prepareHunchDeck` 从牌库抽出 11 张洞察事件（必含悬案），其余洗回；牌库不足时在日志里明确说明差几张。
  2. **调查阶段开始**（`src/engine/turn.js#beginInvestigationPhase`，以及剧本开局那一次）：
     `revealHunchCard` 揭示牌库顶并放进手牌——「可以打出，如同它是你的手牌」因此不需要第二条打出通道。
  3. **打出费用 -2**：`playCost` 读 `hunchDeck.playDiscount`，只对揭示的那一张生效。
  4. **阶段结束**：`returnHunchCard` 把仍未打出的那张洗回直觉牌库；悬案（`avoidHunchShuffle`）改为进入威胁区域。
  5. **旧印**：`api.hunchDeck.insightsInDiscard` + `moveToBottom` 把弃牌堆的洞察事件放到牌库底。
- 公开投影：`campaignProjection(state).hunch = [{ seat, deck, revealed }]`（张数与已揭示的牌，顺序不外泄）。
- 存档：纯 JSON 数组与字符串，随存档往返；`pause/resume` 与 1–4 人开局都在测试里。

### 3.2 资源寄存（普雷斯顿·费尔蒙特）

- 卡面声明：`investigator.resourceBank = { assetCode: '05011', perTurn: 4 }`；状态是 `asset.resources`。
- **建模与简化**（写在模块头部）：寄存中的资源**同时**计入 `inv.resources`，`asset.resources`
  只记录「其中有多少是寄存的」。理由：卡面本身说「可以花费，如同在你的资源池中」，
  合并之后不需要给 40 多个 `inv.resources` 读点各加分支；唯一的规则差异（回合结束时寄存部分消失）
  由 `endTurn` 按 `min(寄存量, 现有资源)` 扣回。
- 读点：`gainResource`（卡牌效果获得资源 → 寄存）、`beginTurn`（回合开始放 4）、
  `endTurn`（回合结束弃掉寄存）、`withdrawAll`（05011 的 `[action]`：把寄存转成永久资源）。
- 公开投影：`campaignProjection(state).resourceBanks = [{ seat, code, banked }]`。

### 3.3 法术专用额外行动（玛丽·朗博）

- 卡面声明：`investigator.spellActionCredit = { doomAtLeast: 1 }`；状态是 `inv.spellOnlyActions` 与 `inv.spellCreditTurn`。
- 与引擎既有的「探索专用额外行动」同构：授权时 `actionsLeft += 1` 且 `spellOnlyActions += 1`；
  普通行动要求 `actionsLeft - spellOnlyActions - exploreOnlyActions` 足够；花掉行动后把额度收窄到不超过剩余行动。
- 授权点：回合开始（`turnBeginningWindow`）、卡牌上放置毁灭后（`placeDoomOnCard` 的读点）。
- 判据 `isSpellAction`（`table-decisions.js`）：打出的卡有 [[法术]] 特性，或激活的支援有 [[法术]] 特性。
- 读点：`dispatch.js`（扣费 / 拒绝文案）、`moves.js`（`validateMove`）、`engine.js#spendAction`。

### 3.4 治疗恐惧与取消记账

| 窗口 | 触发点 | 用途 |
| --- | --- | --- |
| `horrorHealed` | `src/engine/harm-threat.js#healHorrorFrom`（治疗调查员/支援恐惧的唯一入口） | 卡洛琳「你的卡牌效果治愈恐惧后获得 1 资源」；催眠疗法的「额外 1 点恐惧」 |
| `cardCancelled` | `src/engine/cancel-note.js` 的调用方（`cancelHarm` / `cancelEncounterDraw` / `rt.cancelPending` / 取消诡计） | 黛安娜「你的卡取消效果后压在底下」 |
| `enemyAttacked` | `src/engine/enemies.js`（攻击结算后，被取消也算） | 序章故事调查员加弗瑞拉 |
| `agendaWouldAdvance` | `src/engine/act-agenda.js#checkAgenda`（毁灭阈值将推进时） | 05018 神秘乐曲 |

约定：

- `executeDescriptor` 在结算期间记录 `state._resolvingCardCode` / `state._resolvingSeat`，
  所以取消方不需要每个调用点各传一次卡号；`_resolving*` 在 `finally` 里清除，不进存档。
- 「压在黛安娜底下」用调查员自带的 `beneath` 区域；事件卡要等自己的结算走完才进弃牌堆，
  因此走 `state.deferredBeneath` 延后搬运（`reveal.js` 在 `disposePlayedEvent` 之后统一 flush）。

---

## 4. 序章故事调查员（05046–05049）

| 卡号 | 调查员 | 主能力（读点） | 旧印 |
| --- | --- | --- | --- |
| 05046 | 加弗瑞拉·米兹拉克 | `enemyAttacked` 反应：发现 1 个线索（每轮一次） | +1，治愈 1 点伤害与 1 点恐惧 |
| 05047 | 杰罗姆·戴维斯 | `treachery` 反应：弃掉≥2 个智力图标的手牌，取消显现（每轮一次） | +1，发现 1 个线索 |
| 05048 | 瓦伦蒂诺·里瓦斯 | `testBegins` 反应：花 2 资源，本次检定难度 -1（每轮一次） | +1，获得 2 资源 |
| 05049 | 佩妮·怀特 | `skillTestSuccess` 反应：显现效果期间检定成功发现 1 个线索（每轮一次） | +1；显现期间的检定成功后，下回合额外行动 1 次 |

约束（路线图 §2.3 / D3）：

- **不进选人列表**：`canSelectInvestigator` 恒为 false；`PLAYABLE_INVESTIGATOR_CODES` 不含他们。
- **无牌组**：由 `src/engine/story-investigators.js`（P2.6）在建局时清空牌库/手牌/弃牌堆，
  不能抽牌、不参与换牌、不参与升级。
- 卡面能力与正式调查员走同一套描述子通道；由于「调查员自己的 free 能力」目前没有枚举点，
  瓦伦蒂诺的 `[fast]` 用同一时机的 `testBegins` 反应通道实现（行为等价，不新增引擎分支）。
- 「下个回合额外一次行动」由 `beginInvestigationPhase` 读 `inv.extraActionNextTurn` 落实。

---

## 5. 显式简化（5 张）

`simplified: true` + `note` 写在条目上，审计把它们逐条放进 `remaining`，不静默通过：

| 卡号 | 卡面 | 未实现的部分 | 影响 |
| --- | --- | --- | --- |
| 05009 柯尔特 1911 | 「最多 2 张[[工具]]支援不占双手」 | 现有手部槽位读点不支持按特性分组 | 只影响槽位显示 |
| 05010 悬案 | 「游戏结束时少取得 2 点经验」 | 结局经验结算属 P9/P10 | 记录标记 `inv.unsolvedCasePenalty` |
| 05012 秘社“债务” | 「仍在你手牌中则承受 1 点精神创伤」 | 本引擎弱点抽到即结算，无「留到游戏结束」的可达状态 | 不可达分支 |
| 05013 银暮匕首 | 「可以把黛安娜底下的卡当作手牌打出/投入」 | 需要通用的 beneath 打出通道（现有 `cardBackpack` 只覆盖 attached） | 意志攻击已实现 |
| 05019 安息日男爵 | 「少于 3 个毁灭标记时不能离场」 | `cannotLeavePlay` 是常量，没有阈值条件 | 3 个毁灭后自行弃掉已实现 |

---

## 6. 验收与证据

`tests/tcu-investigators.test.mjs`（33 例）覆盖路线图 §7.1 的清单：

| 组 | 用例 |
| --- | --- |
| 选人与可用性 | 6 位可选；4 位故事调查员不可选；13 张专属卡只作依赖；包清单 19/19 |
| 构筑 | 张数 30/40/30/35/30/30；专属卡与随机基础弱点；乔的洞察配额（自动/手动）；排除项 |
| 开局/存档 | 1–4 人开局 + 序列化往返一致 |
| 卡洛琳 | 治疗恐惧触发资源；别人的效果不触发；理性思考吸收恐惧并封锁资源；旧印治愈；弱点 4 点恐惧 |
| 乔 | 11 张洞察（含悬案）；揭示/-2/洗回；悬案改入威胁区域；旧印回收洞察；柯尔特攻击 |
| 普雷斯顿 | 家族遗产入场与寄存；回合开始 4 / 回合结束弃掉；旧印花 2 资源自动成功 |
| 黛安娜 | 底下每张 +1 意志；旧印取回；取消后压卡+抽牌+资源；他人取消不触发；5 张上限；弱点 |
| 丽塔 | 躲避后伤害（每轮一次）；旧印放开限制；专属事件重整+交战 |
| 玛丽 | 有/无毁灭标记的额外行动；额度只给法术；旧印增减毁灭 |
| 故事调查员 | 条目与旧印；加弗瑞拉治愈；瓦伦蒂诺降难度 + 花 2 资源 |

审计门禁（`npm run audit:tcu:check`）新增：

- `gate.investigatorsVerified`：6/6 可选且 `verified`、4/4 故事调查员检查通过、13/13 专属卡实现、
  `nodeAcceptance` 实跑 `tests/tcu-investigators.test.mjs`、逐人的 `dataDeclared / ruleDataValid / deckContract` 全真；
- `gate.packsByPhase`：调查员包 `verified` + 19/19 实现，战役包 `catalog-only` + 4 张故事调查员，
  玩家包 `catalog-only` + 0；
- `remaining` 由计算得出：未实现玩家卡 87 张（P7）、战役卡 233 张（P8）、5 条显式简化、9 章剧情与实机路径。

## 7. 与其他批次的边界

- **P7（M2 玩家卡）**：87 张玩家卡与 2 张基础弱点（05041/05042）还没进构筑池。
  本批调查员用现有循环（核心/敦威治/卡尔克萨/失落）的卡池构筑，这是 M1 与 M2 分开交付的既有口径。
- **P8（M3 剧本）**：序章的塔罗抽牌、失踪人口/证据、幽灵看守人与故事调查员的选人场景仍属 P8；
  本批只保证「调查员本身」（能力、构筑、旧印、存档）可验收。
- **P9/P10**：结局经验惩罚（05010）与浏览器实机路径不在本批。
