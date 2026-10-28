# 卡牌重复功能 / 未落原语 扫描报告

> 扫描日期：2026-10-28（工作树快照）
> 范围：初始包（核心包 01xxx，含 Revised Core 重印 015xx）+ 1–4 循环：敦威治 02xxx、卡尔克萨 03xxx、失落时代 04xxx、万象无终 05xxx。
> 不在范围：食梦者 06xxx、Return to 盒、独立剧本包（07xxx 等）。
> 结论口径：**「重复功能」= 同一张印刷卡 / 同一句规则模板被写成两份以上实现；「没落到原语」= 实现落在单卡 `resolve`／`encounterResolve`／章节 `behavior.js` 里，而不是声明式字段或 `ctx.api` 原语。**
> 归档（2026-10-28）：本文件是**权威版本**，随 `games/arkhamhorror` 仓库一起上传；工作区 `artifacts/dup-scan/report.md` 只保留指向这里的指针。后续 P2 进度继续更新本文件 §九。

---

## 一、结论摘要

**是，存在，且分四类。** 规模上不是零星几处：A/B/C 是三个系统性缺口，D 是原语层自身的问题。

| 类别 | 规模 | 结论 |
| --- | --- | --- |
| A. 同一张卡两次实现（重印） | 5 对（核心 010xx↔015xx）+ 3 对（敦威治↔万象无终） | 同一句卡文两套代码，且互不共享，个别行为不一致 |
| B. 同一句规则模板、逐卡手写 | 45 张「Revelation–检定」、9 张「每失败 1 点」、6 张「附属到你所在地点」、16 张「撤退」等 | 引擎没有对应的声明式原语；已有可参考的声明式读点也没复用 |
| C. 卡在条目、规则在章节 | 万象无终 149 张身份型条目（22 诡计 / 25 敌人 / 17 幕 / 9 密谋 / 12 剧情资产 / 64 地点） | 规则写进 9 个 `behavior.js`（1.0k–1.6k 行）按卡号分支，与前三个循环的写法是两套 |
| D. 原语层自身重复/死读点 | `api.choice` vs `api.choose`、地点附属两套存储、`treacheryRule.song` 无人读 | 卡片被迫 `typeof api.choose === 'function'` 防御；同一语义两套 API |

**最直接的「没落原语」证据**：204 个卡文件在条目里直接写 `state.*` / `inv.*` / `location.*` / `enemy.*` / `act.*` / `agenda.*` / `asset.*` / `target.*` / `card.*` 的字段或数组，涉及 102 个字段名，其中 **60 个字段只被 1 张卡使用**（`inv.ritaEvadeRound`、`enemy.hidingSpotAloof`、`state._playDisposal`、`location.sordidAndSilent` 等；口径与逐卡清单见 `audit/card-entry-compliance.json`）。这些字段没有原语承载，无法跨卡复用、也没有统一清理/存档校验点。

**玩家卡整体比非玩家卡健康**：570 张里 110 张用效果 DSL、547 张有 `modifiers`、46 张声明 `playCondition`；武器/技能/天赋/充能资产基本都已声明式化。但「只能在你回合打出」这一句有 7 张没落 `playCondition`（实测可越回合打出，见 §四·F）。

---

## 二、口径与方法

1. **清单**：遍历 `src/cards/entries/`（570 张玩家卡）与 `src/cards/encounter-entries/`（770 条非玩家条目：核心 6、通用 29、敦威治 168、卡尔克萨 185、失落 144、万象 248，减去 `_shared/_lookup/index`），用条目里的 `code` 回查 `cards-data.js` 得到卡名、卡文（`text` / `textZh`）、类型、卡包。
2. **卡文聚类**：英文 token Jaccard + 中文 bigram Jaccard（阈值 0.82，并查集），得到「同文族」；再按句级模板（抹平数字/技能/伤害词）统计重复规则句。
3. **实现形态**：读取单卡源码，抽取 `ctx.api` 调用、效果 DSL 类型、声明式字段、`_shared.js` helper import、规则钩子（`encounterResolve` / `locationRule` / `actRule` / `agendaRule` / `enemyScript` …），并做「抹平字符串/数字后的代码骨架」比对。
4. **人工复核**：对下面列出的每个族，逐张读过实现；统计数字都是脚本可复算的（脚本见 §七）。
5. **不把「同文」直接当问题**：升级卡（同名不同等级）、同文不同图标（01089–01092）、A/B 面（`text` 是正面、规则在背面）都单独排除或标注。

---

## 三、总体现状

### 3.1 实现形态分布（1340 条条目）

| 层 | 条目 | 效果 DSL / 声明式 | 手写函数（`resolve`/`encounterResolve`/规则钩子） | `ctx.api` 调用 |
| --- | ---: | ---: | ---: | ---: |
| 玩家卡 01–05 | 570 | 110（`effect`）/ 547（`modifiers`）/ 46（`playCondition`）/ 15（`freeTriggers`）/ 49（`commit`） | 282 有 `resolve` | 262 |
| 非玩家 01–05 | 770 | 160 `locationRule` / 87 `actRule` / 78 `agendaRule` / 27 `treacheryRule` / 49 `enemyScript` / 12 `assetRule` | 128 `encounterResolve` | 62 用 `api.test` |

### 3.2 身份型条目（没有可执行逻辑）

211 条条目只有 `code` / `scope` / `implemented` / `flags` / `note`：

| 战役 | 数量 | 其中按 scope |
| --- | ---: | --- |
| 万象无终 | 149 | 地点 64 / 敌人 25 / 诡计 22 / 幕 17 / 密谋 9 / 剧情资产 12 |
| 卡尔克萨 | 29 | 地点 15 / 敌人 7 / 剧情资产 6 / 诡计 1 |
| 敦威治 | 14 | 敌人 7 / 剧情资产 5 / 地点 2 |
| 失落时代 | 15 | 诡计 7 / 地点 5 / 敌人 2 / 剧情资产 1 |
| 通用 | 4 | 敌人 4 |

地点没有特殊规则时用身份条目是合理的；但**诡计 22 + 敌人 25 + 幕 17 + 密谋 9 + 剧情资产 12 = 85 条的规则实际写在章节代码里**（见 §四·C）。

---

## 四、发现

### A. 同一张印刷卡被实现两次

`cards-data.js` 的 `duplicateOfCode` 标出 5 对核心包重印，两号都有单卡条目，而且**实现形态不同**：

| 卡 | 旧号（`core`） | 新号（`rcore`） | 差异 |
| --- | --- | --- | --- |
| 巡警 Beat Cop | `01018.js:12,17`：`passive.stats` + `effect: dealDamage` | `01518.js:16,22`：`skillModifier()` + `kind:'free'` + `target:{kind:'enemy'}` + `api.damageEnemy` | 旧 DSL vs 能力层，两套 |
| 警徽 Police Badge | `01027.js:12,17`：`passive.stats` + `effect: targetedEffect` | `01527.js:15,22`：`skillModifier()` + 手写 `api.investigatorsAt` + `api.choice` + `api.gainAction` | 声明式 vs 手写选择循环 |
| 证据！ Evidence! | `01022.js:14–18`：`kind:'played'` + `criteria.selfOnly` | `01522.js:16–19`：`kind:'reaction'` + `fromHand` + `resolve` | 同一张牌，两种触发通道 |
| 闪躲 Dodge | `01023.js` | `01523.js` | 同上 |
| 米兰博士 Milan | `01033.js` | `01533.js` | 同上 |

> 说明：新旧号是同一张卡的重印，卡图上没有区别；这里不是「两张卡恰好同文」，而是**同一实体被实现了两遍**。

万象无终里还有 3 张 **跨战役重印**（卡文逐字相同，卡号不同）：

| 卡 | 敦威治实现 | 万象无终实现 |
| --- | --- | --- |
| 夜鹰 Whippoorwill | `02090.js`（`enemyScript` 手写修正） | `05266.js:7` 只有 `note: behavior.js:statModifier(...)`；规则在 `unionAndDisillusion/behavior.js` |
| 渴望死亡 Eager for Death | `02091.js`（`api.test` + `api.horror`） | `05268.js:7` 只有 note；规则在 `behavior.js:1113-1121` 手写同一套检定 |
| 灵魂之歌 Psychopomp's Song | `02221.js:12-25`（`treacheryRule.song` + `api.threat`） | `05269.js:7` 只有 note；规则在 `behavior.js:1123-1140` 里直接 `target.threat.push(...)` |

同样的情况还有一组「同文同规则、不同卡号」的遭遇牌：

- `02223`（敦威治·血色祭坛）与 `01163`（通用·惊惧）是同一张「腐烂的尸体」，两文件都在写 `api.test(willpower,3)` + `Math.max(0, 3 - result.value)`，只是写法一正一反（`02223.js:12` / `01163.js:12`）。
- `01164`（通用）与 `03226`（卡尔克萨）是同一张「呆若木鸡」：`01164.js:13` 用 `treacheryRule.threat` 声明，`03226.js:11,15` 把同一份数据在**同一个文件里写了两遍**（条目级 `threatEffect` + `api.threat()` 内联），另一种写法而已。

### B. 同一句规则模板、逐卡手写

#### B1. 「显现 – 检定 X(N)」45 张

卡面含 `Revelation - Test [skill] (N)` 的条目 **45 张**：

| 实现形态 | 张数 | 说明 |
| --- | ---: | --- |
| 手写 `encounterResolve` 包一个 `api.test` | 35 | 其中 **19 张是纯包装**（函数体只有 `api.test(...)` + `return false`） |
| `note` 指向 `behavior.js` | 3 | 05268 / 05271 / 05225 |
| `flags` / `treacheryRule` / 部分实现 | 7 | 04221、04190、05342、05344、05306、05145、05147 |

失败分支的两种写法各写一半：`if (result.success) return` 23 张、`if (!result.success)` 11 张；检定难度有时写字面量（`02223.js` 里 `3 - result.value`），有时用 `result.difficulty`（`01162.js`）。

**引擎其实已经有同类声明式读点**：`locationRule.onEnter.test` + `onEnter.failChoice.options`（声明规范化 `ability.js:706-709`，失败分支 `movement.js:94-99`，消费点 `movement.js:245-252`；`location-facts.js:26-29` 负责文案），但只有 1 张卡在用（`01133.js:19`），而诡计（treachery）根本没有对应的声明式检定字段。结果是 35 张卡各自把「技能 / 难度 / 失败分支」写进命令式代码。

#### B2. 「每失败 1 点受到 1 点伤害/恐惧」9 张：三种失败差值算法

| 写法 | 例 | 规则后果 |
| --- | --- | --- |
| `Math.max(0, 3 - result.value)` | `02223.js:13`、`01163.js:13` | 差值下限 0 |
| `Math.max(1, result.difficulty - result.value)` | `03223.js:12`、`03090.js:15` | 差值下限 1 |
| `Math.max(0, result.difficulty - result.value)` | `01162.js:14`、`03260.js:12` | 差值下限 0 |

同一句「你检定失败且每低于难度 1 点」在失败刚好 0 点时，前两种给出不同结果（0 点 vs 1 点）。这不是文案差异，是**同一规则两种实现**。

#### B3. 「显现 – 附属到你所在地点」6 张：6 个实现点、5 种以上存储

| 卡 | 实现位置 | 存储形态 |
| --- | --- | --- |
| 02102 奥术屏障 | `02102.js:17-18` | 声明式 `locationCounter` + `locationBarrier`（唯一声明式） |
| 01168 朦胧之雾 | `01168.js:14-16` | 直接写 `location.fog` / `location.fogCode` / `location.shroudMod` |
| 03094 恶灵作祟 | `03094.js:23-28` | `location.attachments.push(...)` + `location.haunted = true` |
| 04145 屋中无人 | `04145.js:21-25` | `location.attachments.push(...)` + `location.investigateExtraActions += 1` |
| 04076 疯狂生长 | `04076.js:23-24` | `location.attachments.push(...)`，清除规则另写 `threatAction` |
| 04216 有毒孢子 | `04216.js:9` 只有 `flags:{spores:true}` | 真正实现在 `heartOfTheEldersPart1/behavior.js:447-460` |

对照：引擎已有 `api.attachToLocation()`（`api-clue.js:86-99`，写 `state.playerLocationAttachments`），直接调用它的只有 1 个卡文件（`05323.js:37`），另有 4 张玩家卡通过 `_shared.attachToChosenLocation()` 共用同一原语；遭遇侧则统一直接 `location.attachments.push`（6 个文件）。同一语义三套存储（`playerLocationAttachments` / `location.attachments` / 各卡自造字段），读点也分裂在 `act-agenda.js:219` 与 `act-agenda.js:229`。

#### B4. 谈判 Parley：两种声明 + 一种手写

| 形态 | 张数 | 例 |
| --- | ---: | --- |
| `assetRule.parley`（声明式） | 3 | `03076a.js:8`、`03079.js` |
| `enemyScript.encounterAction` + 手写 `api.test` | 5 | `05095.js:14-24`、`03258.js:4-12` |
| 章节 `behavior.js` 分支 | ≥1 | `05217.js:7` 只有 note |

敌人侧没有与 `assetRule.parley` 对称的 `enemyRule.parley` 声明式字段，导致 5 张敌人手写「列出行动 → `performEncounterAction` → `api.test` → 成功分支」。

#### B5. 其它同模板族（已核对，规模较大的）

| 模板 | 张数 | 现状 |
| --- | ---: | --- |
| `[action]: Resign`（撤退） | 16（卡文匹配 24） | 只有 4 张在条目里写 `locationRule.actions()` + `performAction` + 自定义 `rule` 名（`03070.js`、`04050.js`、`04060.js`、`04206.js`），其余写进章节 `behavior.js` 的 `actions/performAction`（`05071.js` 注释明说）；引擎只有 `api.resign`（5 处调用） |
| `Fast. Play only during your turn.` | 21 | 14 张声明了 `playCondition`（12 张 `ownTurn()` + 2 张内联 `currentSeat`），**7 张没声明**（见 §四·F） |
| `[action]: Explore` | 13 | 探索动作本身已由引擎 `doExplore` 承担（原语已落），背面剧情各写一套属正常 |
| `Action: Spend 1 ammo: Fight…` | 22 | 13 张走 `effect: fight`，9 张手写；同族还有 `combatBonus` / `skill` 字段不统一（`01060.js` vs `02154.js`） |
| `Uses (N charges/secrets/supplies)` | 22/12/18 | 基本走 `uses` + `usesType` + 效果 DSL（已落原语，正面例子） |
| `Max 1 committed per skill test` | 12 | 走 `commit.skill.maxPerTest`（已落原语，正面例子） |
| `Group limit once per game` | 18 | 走 `teamOnce()` / `limit`（已落原语） |
| `Fast. Spend 1 resource: +1 skill` | 11 | 走 `freeTriggers`（已落原语） |

### C. 万象无终：卡在条目、规则在章节

149 张身份型条目中，85 张是有规则的卡（22 诡计 / 25 敌人 / 17 幕 / 9 密谋 / 12 剧情资产）。它们的规则集中在 9 个章节文件：

| 章节 behavior.js | 行数 | `api.test` | 引用卡号数 |
| --- | ---: | ---: | ---: |
| beforeTheBlackThrone | 1578 | 2 | 3 |
| forTheGreaterGood | 1541 | 0 | 10 |
| unionAndDisillusion | 1446 | 0 | 16 |
| theWagesOfSin | 1418 | 3 | 23 |
| inTheClutchesOfChaos | 1189 | 2 | 28 |
| atDeathsDoorstep | 1005 | 0 | 24 |
| theSecretName | 723 | 0 | 7 |
| theWitchingHour | 624 | 0 | 3 |
| disappearanceAtTheTwilightEstate | 587 | 0 | 0 |

`unionAndDisillusion/behavior.js:1113-1210` 是典型样本：`resolveEncounter` 里按卡号 `if (code === ...)` 逐张写检定、威胁区、伤害加成，**与敦威治的卡条目实现重复**（§四·A 已给出三张逐字同文的对照）。这类代码还直接操作 `target.threat.push`、`state.encounterDiscard.push`，绕过了 `api.threat()`。

### D. 原语层自身的重复与死读点

1. **`api.choice` / `api.choose` 是同义两名**：玩家卡 136 个文件用 `api.choice`，遭遇卡 77 个文件用 `api.choose`，**两层从不混用**；遭遇侧还有 5 个文件写 `typeof api.choose === 'function'` 防御（`04207.js:16`、`04096.js:23`、`05139.js`、`05144.js`、`05340.js`）。两者最终都落到 `requestChoice`（`scenario-runtime.js:618`、`api-misc.js:97`）。
2. **地点附属两套存储**：`state.playerLocationAttachments`（`api.attachToLocation`，直接调用 1 个卡文件 + 4 张经 `_shared.attachToChosenLocation`）vs `location.attachments`（6 个遭遇文件直接 push）。读点也分两处：`act-agenda.js:219` / `act-agenda.js:229`。
3. **威胁区声明两套写法**：`treacheryRule.threat.{extraActionCost,endTurnTest}`（`01164.js:13`）vs `threatEffect` 内联进 `api.threat()`（`03226.js:11,15`，同一份数据在同一个文件里写了两遍）。
4. **死读点**：`02221.js:12` 的 `treacheryRule: { song: true }` 没有读取方（引擎只解构 `treacheryRule.threat`，`ability.js:736-741`）；`locationRule.onEnter.failChoice` 只有 1 张卡（01133）使用。声明了但没人读，等于「规则写了一半」。

### E. 卡片直接改 state（204 个文件 / 102 个字段）

| 字段 | 写入文件数 | 例 |
| --- | ---: | --- |
| `state.scenarioFlags` | 29 | 04303、03215、03100 |
| `state.encounterDeck` / `state.encounterDiscard` | 18 / 17 | 02173、02327、05116 |
| `inv.clues` / `inv.discard` / `inv.resources` | 11 / 9 / 9 | 05010、05275、02082 |
| `location.attachments` | 6 | 03094、04145、04076 |
| 单卡专用字段 | **60 个各被 1 张卡写** | `inv.ritaEvadeRound`(05005)、`enemy.hidingSpotAloof`(03038)、`state._playDisposal`(04010)、`location.sordidAndSilent`(02089) |

`AGENTS.md` 的硬约束是「卡只能经描述子与 `ctx.api` 结算，不得直接改 `state`」。204/1340 个文件违反这一约束，而违反的动机往往正是「现有原语表达不了这张卡」——这些字段就是**尚未抽象成原语的需求清单**。

### F. 玩家卡：「只能在你回合打出」7 张没落 `playCondition`

同族 21 张卡文是 `Fast. Play only during your turn.`：

- 14 张声明了 `playCondition`：12 张 `ownTurn()`（如 `02022.js:10`、`02266.js:10`），2 张内联 `state.currentSeat === inv.seat`（`04193.js`、`05152.js`）。
- **7 张没写**：`01036.js:15`、`01037.js:15`、`01043.js:15`、`01050.js:15`、`01085.js:11`、`04019.js:11`、`04020.js:11`。
- 用引擎自己的读点实测（`playConditionError(state, inv, code)`，两人局、当前座位是对手）：

```
01036 -> 无回合限制      04019 -> 无回合限制
01037 -> 无回合限制      04020 -> 无回合限制
01043 -> 无回合限制      02022 -> 拒绝：只能在自己的回合打出
01050 -> 无回合限制      02266 -> 拒绝：只能在自己的回合打出
01085 -> 无回合限制      04193 -> 拒绝：只能在你自己的回合打出
```

`play-condition.js:78-80` 的 `legacyPlayFields()` 已返回 `{}`（旧字段迁移完），所以这 7 张现在确实没有回合限制。这是「同一句卡文、两种实现」里影响规则正确性的一例。

---

## 五、量化汇总

| 指标 | 数值 |
| --- | ---: |
| 扫描条目（01–05） | 1340（玩家 570 / 非玩家 770） |
| 同文族（逐字相同，卡号不同） | 37 组 / 95 张 |
| 近似同文族（Jaccard ≥ 0.82） | 70 组 / 175 张 |
| 其中「同文但实现完全不同」（骨架相似度 < 0.5） | 24 组（逐字）+ 33 组（近似） |
| 同规则句模板（≥3 张） | 118 条 |
| 手写 `Revelation–Test` 包装 | 35 张（19 张纯包装） |
| 直接改 state 的文件 / 字段 / 单卡字段 | 204 / 102 / 60 |
| 身份型条目（无逻辑） | 211（万象无终 149） |
| 引擎声明式字段「声明了没人读」 | 2 处已知（`treacheryRule.song` 无读取方、`onEnter.failChoice` 仅 1 张使用） |
| 同一语义两套 API | `choice`/`choose`；`playerLocationAttachments`/`location.attachments`；`treacheryRule.threat`/`threatEffect` |

---

## 六、建议（按收益排序）

### P0：先修不一致（不改架构）

1. **补 7 张 `playCondition`**（01036/01037/01043/01050/01085/04019/04020），与同族 14 张一致；也可反过来让引擎从卡文派生，但显式声明更符合现有写法。
2. **`02221` 的 `treacheryRule.song` 要么接读点要么删**：目前敦威治版「受到额外 2 点伤害」没有实现，万象无终版在 `behavior.beforeHarm` 里手写。
3. **统一「每失败 1 点」的取整口径**（§四·B2），先定规则（下限 0 还是 1），再逐卡对齐。

### P1：抽原语（一次消除多张手写）

| 原语 | 可折叠 | 设计提示 |
| --- | ---: | --- |
| `treacheryRule.test`（skill / difficulty 修饰 / fail 效果列表） | 35 张中约 29 张 | 已有 `locationRule.onEnter.test` + `failChoice` 的形状可复用；19 张纯包装可直接删函数体 |
| `locationAttachment`（统一存储 + 读点） | 6 张 | 把 `api.attachToLocation` 扩成同时服务玩家卡与遭遇卡；替代 `location.fog` / `attachments.push` / `haunted` / `locationBarrier` 五种写法 |
| `enemyRule.parley`（与 `assetRule.parley` 对称） | 5 张 | 把 `actionKind:'parley'` + `performEncounterAction` 收成声明式 |
| `scenarioAction.resign`（地点撤退行动） | 16（条目内 4 + 章节内 ~12） | `api.resign` 已有，缺的是「行动列表 + 文案 + 前置条件」的声明式外壳 |
| `api.choice` / `api.choose` 收口 | 213 个文件 | 保留一个名字（建议 `choice`），另一个做别名并标 deprecated；删除 5 处 `typeof` 防御 |

### P2：结构与迁移顺序

4. **重印别名**：5 对 `015xx→01xx`、3 对万象重印 → 只保留一份实现 + 卡号映射（`card-identity.js` 已有别名机制），否则每次修卡都要改两处。
5. **万象无终 149 张身份条目的迁移顺序**：先 22 诡计 + 25 敌人（behavior 分支最容易搬回条目），再 17 幕 + 9 密谋，地点留在最后（多数无规则）。
6. **204 个直写 state 的文件**：先处理 60 个单卡字段——它们最可能是「原语缺失」而不是「懒得用 API」。
7. **已落地（2026-10-28）**：本扫描已固化为 `tools/audit-card-entry-compliance.mjs` + `audit/card-entry-compliance.json`，接入 `cards:check` / `cards:encounter-check`（R1 直写状态 / R2 重印双实现 / R3 回合限制缺失，基线只减不增）；要求写入迁移规范 §4.6.10 与 `AGENTS.md`「不可协商」。

---

## 七、复现

**固化的合规审计**（已签入，随 `cards:check` 一起跑）：

```powershell
cd games/arkhamhorror
npm run audit:entries          # R1/R2/R3 基线复算（失败会给出卡号）
npm run audit:entries:write    # 修掉存量违规后收紧基线
```

**本次扫描脚本**在 `temp/dup-scan/`（工作区临时目录，未签入）：

| 脚本 | 作用 |
| --- | --- |
| `01-inventory.mjs` | 生成条目清单（code / 卡文 / 源码 / 归属） |
| `02-text-clusters.mjs` | 逐字 + 近似同文聚类 |
| `04-impl.mjs` | 代码骨架归一化、同骨架分组、实现相似度 |
| `06-templates.mjs` / `10-sentences.mjs` | 模板 / 句级规则句统计 |
| `08-code-clusters.mjs` | 共享特征代码片段聚类 |
| `11-family-report.mjs` | 每个规则句族的实现形态分布 |
| `15/17/20/21/22/25/26/27-*.mjs` | 本报告引用的各项计数 |

```powershell
node temp/dup-scan/01-inventory.mjs
node temp/dup-scan/02-text-clusters.mjs
node temp/dup-scan/04-impl.mjs
node temp/dup-scan/10-sentences.mjs
node temp/dup-scan/22-fields.mjs
node temp/dup-scan/27-revtest2.mjs
```

运行时复核（§四·F）：

```powershell
node temp/dup-scan/14-playcondition.mjs
```

---

## 八、边界

- 本报告只覆盖**已实现**的条目（1340 条）；目录里的 5,930 张卡面数据不在此列。
- 卡文聚类用 `text`（正面）；A/B 面卡片（如 `04044` 的背面规则）可能被算进同族，报告中已逐族核对并标注「背面不同属正常」。
- 「重复」不等于「错误」：升级卡、同文不同图标、A/B 版本都可能是合理设计；本报告把这类列在 §四·B5 的「已落原语」或单独注明。

---

## 九、2026-10-28 修复记录（P0 / P1）

### 已修复

| 项 | 内容 | 证据 |
| --- | --- | --- |
| P0-1 | 7 张「快速。只能在你回合打出」补 `playCondition: [ownTurn()]`：01036 / 01037 / 01043 / 01050 / 01085 / 04019 / 04020 | `tests/card-fidelity-core-p3.test.mjs`、`tests/card-fidelity-tfa-p3.test.mjs`；合规账本 R3 = 0 |
| P0-2 | `02221` 的无效 `treacheryRule.song` 换成可读的 `harmInterceptor: { trigger:'damage', extra:2, discard:true }`（读点 `enemies.js` 的 `applyHarm`，注册期校验在 `ability.js`） | `tests/card-fidelity-dunwich-p3.test.mjs` 两例（触发 / 只有恐惧不触发） |
| P0-3 | 「每失败 1 点」统一到 `failedBy(result, 难度)`（14 处），顺带把 02145 的直写 `actionsLeft`、03223 的直写 `state.doom` 换成 `api.loseActions` / `api.removeDoom` | `tests/phase2-primitives.test.mjs` 的 `failedBy` 用例；golden replay 6 局零漂移 |
| P1-1 | 新增声明式 `treacheryRule.test`（形状 `{ skill, difficulty: number \| { base, plus }, fail, penaltyKind? }`），读点 `card-rules.js` 的 `resolveDeclarativeTreacheryTest`，四个战役 `encounter-rules` 统一调用；失败分支复用引擎 `applyPenalty`（新增 `{ silent: true }` 保持日志与迁移前一致） | 01162 / 01163 / 02223 / 02091 四张已迁移；`tests/dunwich-encounter-acceptance.test.mjs`、`tests/dunwich-rules.test.mjs`、`tests/tfa-encounter-p1.test.mjs` |
| P1-2 | `api.choice` / `api.choose` 互设别名（同一个 `requestChoice`），删掉 5 处 `typeof api.choose === 'function'` 防御；文档确定 `api.choice` 为新代码唯一写法 | `src/engine/api-misc.js`、`src/engine/scenario-runtime.js`；04207 / 04096 / 05139 / 05144 / 05340 |
| P1-3 | 谈判统一到引擎已有的通用 Parley 描述子（`kind:'action'` + `actionKind:'parley'`，读点 `src/engine/parley.js`）：4 张敌人谈判条目改写描述子，删除 `encounterAction` / `performEncounterAction` 手写分发，并删掉 Carcosa `encounter-rules.js` 的两条按 rule 分支；新增 `api.clearDoomOnCard` / `api.setScenarioFlag` 收口卡内直写 | `03093` / `03258` / `05095` / `05096`；`tests/parley-primitive.test.mjs` 四例（行动点 / 检定 / 清毁灭 / 伤害 / 每场一次），`tests/tcu-shared-encounters.test.mjs`、`tests/carcosa-campaign-card-acceptance.test.mjs` 改走描述子 |
| P1-4 | 地点附属统一写入口 `src/engine/location-attachments.js`：`api.attachToLocation` 支持剧本卡 `scope:'location'`（落 `location.attachments`）与玩家卡默认 `state.playerLocationAttachments`；新增 `api.attachShroud`（雾/帷幕，读点 `actions.js` / `harm-threat.js`）与 `locationAttachmentTotal`（04145 的额外调查行动，读点 `turn-flow.js` 的 `actionCost`） | 已迁 `01168` / `03094` / `04076` / `04145`；`tests/tfa-encounter-p1.test.mjs`、`tests/tfa-threads-of-fate.test.mjs`、`tests/tcu-prologue.test.mjs`、`tests/tfa-turn-back-time.test.mjs`；golden 13 局零漂移（保留原附属 id/字段形状） |

### 修复后账本（`audit/card-entry-compliance.json`）

| 指标 | 修复前 | 修复后 |
| --- | ---: | ---: |
| R1 直写状态 | 204 | 196 |
| R2 重印双实现 | 5 | 5 |
| R3 回合限制缺失 | 7 | **0** |
| 手写「显现-检定」包装 | 19 | **15** |
| 单卡私有字段（观察项） | 60 | 57 |

### P1-5 `scenarioAction.resign`（本轮未改，结论：不是原语缺口）

调查后确认引擎早已有「撤退」原语：地点定义写 `resign: true`，`moves.js` 统一列项、`dispatch.js` 走 `doResign`；多数印刷撤退地点已用这条路径。真正带手写 `locationRule.actions` 的只剩 4 张，其中 03070 撤退要转移线索、04050/04060 还要先查补给，属于「撤退 + 前置效果」，不是纯撤退；而 04050 / 04060 的 `scenarioAction resignCamp` / `resignEntryway` 已写进 `tests/fixtures/replay/golden-replays.json` 的 TFA 录像，改成引擎 `resign` 需要重录基线。因此本轮只把口径写进迁移文档（§4.6.10 ③），不改录像锁定的路径。

- 万象无终的 behavioral 规则量很大，本报告只抽样核对（`unionAndDisillusion`、`theWagesOfSin`、`beforeTheBlackThrone`），未逐行审 9 个章节。

### P2 执行记录（2026-10-28）

**P2-4 重印别名：已试点，暂列阻塞。** 试过「只留一份条目 + 运行时别名」（`duplicateOfCode`/`duplicatedBy` 双向解析、生成只改 code 的注册条目、删除 5 个重印文件）。结果暴露两处**引擎通道不收敛**，不能靠删文件完成：

- `01022` / `01023`（快速事件）存在两套合法通道：`played + fast + trigger + effect`（旧，背包/直觉牌库/`play-channels` 在用）与 `reaction + fromHand + resolve`（新，`card-fidelity-p1` / `ability-layer` 在用）。任选一套都会改动另一套的窗口/弃牌/日志，并让 `notz-*`、`tfa-*` golden 指纹漂移。
- `01033`（米兰）旧实现是「纯收益自动领取」（`legacyReaction` + `effect`），新实现是普通询问窗口；两版测试各自锁定了相反口径。

已回滚试点（`entries/` 恢复 573 个文件、`test:fast` 恢复全绿），结论写入本节：**先补「快速事件统一通道」原语（让 `played` 与 `reaction` 共用同一套手牌/背包/直觉/收尾窗口与弃牌口径），再合并重印**；否则不是重印问题，而是通道分叉问题。

**2026-10-28 第二次试点（反向：以 01xx 为 canonical）**：同样补了双向别名与生成注册条目，删除 5 个 015xx 文件。剩余 6 个测试冲突，证明不能只换方向：
- `01022`/`01023` 的 `played` 描述子不打开 `reaction` 手牌窗口（`ability-layer` 的 01523/01522 用例失败）；
- `01033` 的 `legacyReaction` 不产生新式反应窗口（`ability-layer` 的 01533 用例失败）；
- `01018` 缺 `target`（`phase1-state` 的 B1 接线用例失败）；
- `card-fidelity-p1` 要求 01522/01523 有 `reaction` 描述子，`auto-pass` 对米兰自动/询问的口径与旧实现相反。
再次回滚并保持全绿。结论不变：先做「快速事件/反应窗口统一通道」原语，再谈重印合并；否则只能改测试口径，等于把行为分叉固化。

**P2-5 结构完成度（2026-10-28）**：9 个 TCU 章节的 `behavior.js` 已**没有按卡号分支**
（`code === '05xxx'` / `codeOf(...) === '05xxx'` / `original(...) === '05xxx'` 扫描为 0）；
最后两处（05311 混沌见证者的入场/移动放裂口）改为条目数据 `breachOnEnter: 1` + 章节按字段统一执行。
剩余章节代码都是跨卡流程（幕/议程推进、裂口入侵、闹鬼脚本、结局分流），不再是单卡规则。


**P2-5 / P2-6 的下一步顺序**（按报告 §C/§E）：

1. P2-5 先做小章节纵切：`theWitchingHour`（3 张引用）→ `theSecretName`（7 张），验证「诡计/敌人先、幕/密谋后」的搬法；再按 `theWagesOfSin`(23) → `inTheClutchesOfChaos`(28) → `atDeathsDoorstep`(24) → `unionAndDisillusion`(16) → `forTheGreaterGood`(10) → `beforeTheBlackThrone`(3) 推进，地点最后。
2. P2-6 先做「已有 API 但仍在直写」的一批（`inv.threat`、`inv.resigned`、`asset.exhausted`、`asset.uses`、`agenda.doom`、`enemy.location`/`inv.location`、`card.doom`、`location.shroudMod` 等），再处理需要新原语的回合标记族（`*Round`）与 `inv.playUpgrades05xxx`（同一模板 3 张）。

**P2-6 第一批（2026-10-28，已落地）**：补齐 6 个原语并把 10 个单卡字段改为 API 写入——
`api.removeDoomFromCard`（04303 地点/敌人/支援）、`api.addInvestigatorTrait`（04085 蛇族特性）、
`api.addFog`（03101 全局帷幕）、`api.placeCluesOnAct`（03070 情报转幕线索）、
`api.markResigned`（02198 强制全员撤退）、`api.setShroudMod` 的 scenarioRuntime 侧（03262）；
另把 03004 充能改用 `api.addUses`、02005 重整改用 `api.ready`、05237 取消毁灭改用
`api.removeDoomFromCard`/`api.removeDoom`、05126 议程毁灭转移改用 `api.removeDoom` /
`api.clearDoomOnCard` / `api.doomOn`。账本：R1 196→190、单卡字段 57→47；`test:fast` 3763 pass、
13 局 golden 零漂移、Carcosa/TFA 审计通过。

**P2-5 第一批（2026-10-28，theWitchingHour 纵切，已落地）**：把 3 张「卡号写在章节」的敌人规则搬回条目——
- 05057 安妮特·梅森：新增 `enemyScript.onDefeated` → `api.setScenarioFlag('anetteDefeated')`；
- 01180 黑山羊眷族：`enemyScript.onDefeated` → 本地每位调查员 `api.horror(1)`；
- 01179 坚韧的黑山羊幼崽：`enemyScript.onRoundEnd` → 新增原语 `api.healEnemy(enemy, 2)`；
章节 behavior 的 `enemyDefeated` 只委托 `encounterRules.enemyDefeated`，`roundEnded` 只委托
`encounterRules.roundEnded`（共享钩子已经统一派发 `onDefeated` / `onRoundEnd`），不再出现
`ANETTE_MASON` / `GOAT_SPAWN` / `RELENTLESS_DARK_YOUNG` 分支。`tests/tcu-witching-hour.test.mjs` 38 项全绿。
下一章按顺序：theSecretName（7 张）。

**P2-5 第二批（2026-10-28，theSecretName 首刀，已落地）**：把两名敌人的常驻/强制规则搬回条目——
- 05148 布朗·詹金：攻击光环改为数据 `enemyStatRule.aura`（读点 TCU `encounter-rules.enemyStatModifier`：
  重整的 Creature +2 攻击）；「敌军阶段结束弃手牌再抽等量」→ `enemyScript.onEnemyPhaseEnd`；
  「被击败记录」→ `enemyScript.onDefeated`。
- 05149 那赫卜：`enemyStatRule.fightPerAgenda`（攻击 + 当前密谋编号）；「敌军阶段开始若重整放 1 毁灭」→
  `enemyScript.onEnemyPhaseStart`；被击败记录 → `enemyScript.onDefeated`。
- 章节 behavior 只保留跨卡流程：`enemyStatModifier` 只剩「非弱点生命 + 密谋编号」，
  `enemyPhaseStart/End` 只转发共享钩子；那赫卜 act3 的「击败后不弃掉、治愈/横置/解除交战」仍需 agenda 反应，
  继续留在章节（已在注释中标明）。
`tests/tcu-secret-name.test.mjs` 46 项全绿，`behaviorLines 23534 → 23515`。

**P2-6 第二批（2026-10-28，回合标记族，已落地）**：4 个「本轮/本阶段」标记改为语义 API（状态字段与读点不变）：
`api.evadeDamageInstead(seat)`（05016，读点 `combat.js` 的 `evadeDamageInsteadRound`）、
`api.lockLocationThisRound(location)`（03256，读点 `hidden-rules.js` 的 `cannotLeaveRound`）、
`api.markHunterMoved(enemy)`（03183，读点 `attackModifier` 的 `hunterMovedRound`）、
`api.skipEnemyAttackThisRound(enemy)`（03086，读点 `turn.js` 的 `skipAttackRound`）。
账本：R1 190→186、单卡字段 47→43；golden 13 局零漂移。

**P2-5 第三批（2026-10-28，theSecretName 诡计，已落地）**：把两条回合结束强制从章节搬进条目——
- 05146 群星牵引：`treacheryRule.turnEnd: { kind: 'horrorIfNotMoved', amount: 2 }`
- 05147 不安的梦：`treacheryRule.turnEnd: { kind: 'discardEncounterTop', amount: 1 }`
共享 `encounterRules.turnEnded` 新增数据分支（读条目 `turnEnd`，带卡名日志），
删除 `definition.threatTurnEnd` 映射与章节里的 per-card 循环。`behaviorLines 23515 → 23500`，
`tests/tcu-secret-name.test.mjs` 46 项全绿。

**P2-5 第四批（2026-10-28，unionAndDisillusion 诡计，已落地）**：本章 5 张诡计全部回条目——
- 05268 渴望死亡 / 05271 死亡记号：声明式 `treacheryRule.test`，难度用 `{ base: 2, plus: 'damage' | 'horror' }`，失败 `takeHorror` / `takeDamage`；
- 05269 灵魂之歌 / 05270 死期临近：条目 `harmInterceptor`（伤害/恐惧额外 +2 并弃卡，读点 `enemies.js` 的 `applyHarm`）+ `encounterResolve` 选择任意调查员放入威胁区；
- 05272 看守人的注视：`encounterResolve` 全员意志 5，失败用 `api.hauntedAt` 过滤两个地点的合法选项、`api.haunted` 结算。
章节 `resolveEncounter` 改为只委托共享 `encounterRules.resolveEncounter`，删除整段按卡号分支与 `beforeHarm`；
`behaviorLines 23500 → 23407`，`tests/tcu-union-disillusion.test.mjs` 42 项全绿。

**P2-5 第五批（2026-10-28，unionAndDisillusion 敌人，已落地）**：
- 05266 夜鹰：生成地点 → `enemySpawnRule.spawnAtFirstInvestigator`；「所在地点的每张夜鹰使全技能 -1」→
  `enemyStatRule.skillAura: { amount: -1, locationBound: true }`（读点 TCU `encounter-rules.statModifier`）。
- 05267 幽灵乌鸦：生成地点 → 同一条 `enemySpawnRule.spawnAtFirstInvestigator`。
章节 `spawnLocation` 改为读条目数据（不再写 `WHIPPOORWILL` / `SPECTRAL_RAVEN` 分支），
`statModifier` 只转发共享钩子。`behaviorLines 23407 → 23403`，`tests/tcu-union-disillusion.test.mjs` 42 项全绿。

**P2-5 第六批（2026-10-28，unionAndDisillusion 交战/数值，已落地）**：
- 05267 幽灵乌鸦：交战二选一 → 条目 `enemyScript.onEngaged`（共享 `encounterRules.enemyEngaged` 新增派发）；
  「+2 攻击/+2 躲避直到调查阶段结束」→ `enemyStatRule.boostUntilRound` + 新原语 `api.boostEnemyUntil`。
- 05086 幽灵看守人：「每个 stolenSoul 标记 +1 攻击」→ `enemyStatRule.fightPerMarker`（共享读点）。
章节删除 `enemyEngaged` 的乌鸦分支与 `enemyStatModifier` 的看守人/乌鸦分支，只转发共享钩子。
`behaviorLines 23403 → 23371`，`tests/tcu-union-disillusion.test.mjs` 42 项全绿。

**P2-6 第三批（2026-10-28，牌堆/连接/幕指针，已落地）**：
- 05281 勇闯火线：去掉 `try/catch` + `inv.statOverrides` fallback，直接走 `api.setBaseSkillValue`
  （原注释里的 `SKILL_NAMES.includes` 引擎 bug 已不存在，校验点是 `Object.hasOwn`）；
- 05049 佩妮：`api.grantExtraActionNextTurn`；
- 05136 古老者之城：`api.connectLocations`（连接唯一写点，双向）；
- 03203 第三夜：`api.setActIndex`（再 `advanceAct`）；
- 02101 世外诡影：`api.discardHandOfTypes`（弃手牌按类型，静默以保持 golden 指纹）；
- 02296 哭嚎仪式：`api.shuffleDiscardWeaknessesIntoDeck`。
账本：R1 186→181、单卡字段 43→37；`behaviorLines 23373` 不变；golden 13 局零漂移。

**P2-6 第四批（2026-10-28，威胁区/困境/战役记录/探索牌库，已落地）**：
- 02084 死灵之书：`api.removeThreat`（弃牌与去重交给引擎唯一实现）；
- 05010 悬案：`api.clearHunchRevealed`（不再写 `inv.hunchRevealed`）；
- 05134 发霉的走道：`api.campaignRecord` / `api.setCampaignRecord`（不直写 `state.campaign.records`）；
- 04060 遗迹入口：`api.takeExplorationTop` / `addExplorationTop` / `discardExploration` / `shuffleExploration`
  （探索牌库的查看/弃诡计/洗回全走原语）。
账本：R1 181→179、单卡字段 37→33；新增 7 个语义 API，golden 仍零漂移。

**P2-6 第五批（2026-10-28，敌人实例字段 / 密谋附属，已落地）**：
- 05100 冥府之雾：`api.setEnemyPreySeat(enemy, seat|null)`（引擎 preyTarget 读实例）；
- 04055 暗起波澜：`api.setEnemyResources(enemy, n)`；
- 04146 鲜血阴谋：`api.attachToAgenda(code)` + `api.addAgendaDoomThreshold(delta)`（密谋附属与阈值唯一写点）；
- 05103 怨灵：`api.recordEnemyDamageSource(enemy, source, round)`；
- 02064 地下打手：`api.moveInvestigator` / `api.moveEnemy`（不再直写 `inv.location` / `enemy.location`）。
账本：R1 179→177、单卡字段 33→25，golden 13 局零漂移。

**P2-6 第六批（2026-10-28，资源损失 / 看守人攫噬 / 结束回合，已落地）**：
- 04082 补给短缺：把 `loseResources` 从 `api-misc.js` 抽到 `src/engine/resource-loss.js`，
  玩家卡与遭遇卡共用同一实现（含 `wouldLoseResources` 窗口），卡面改 `api.loseResources`；
- 05087 看守人的攫噬：`inv.engaged` / `enemy.engagedSeat` / `damageTaken` / `exhausted` / `preySeat`
  全部改走 `api.engage` / `api.healEnemy` / `api.readyEnemy` / `api.exhaustEnemy` / `api.setEnemyPreySeat`，
  删除手写 fallback；
- 04075 杂草丛生的遗迹：`inv.actionsLeft` + `inv.turnEnded` → `api.endTurn(seat)`。
账本：R1 177→174、单卡字段 25→22，golden 13 局零漂移。

**P2-6 第七批（2026-10-28，地点计数器 / 回合锁 / 密谋锁，已落地）**：
- 02102 奥术屏障 / 02089 忍气吞声：`api.markLocationCounter(locationId, key, n)`；
- 02180 蒸汽之爪：`api.lockMovementThisRound(seat)`；
- 04079 蟒蛇：`api.preventReadyNextUpkeep(seat)`（引擎经 `campaign-state.setCannotReadyRound` 写 TFA 字段，
  满足 phase6 战役字段守卫）；
- 04195 暴露弱点：`api.exposeEnemyWeakness(enemy)`；
- 05018 神秘乐曲：`api.lockAgendaDoomThisPhase()`；
- 05015 可怕的秘密：`api.scheduleWeaknessShuffle(seat, code)`；
- 05104 被困的灵魂：`api.setHauntedCommitCost(locationId)` / `api.clearHauntedCommitCost()`。
账本：R1 174→167、单卡字段 22→14，golden 13 局零漂移。

**P2-6 第八批（2026-10-28，打出处置 / 压牌 / 冷漠，已落地）**：
- 04010 走私货物：`state._playDisposal` → `api.shufflePlayedCardBack()`；
- 05004 黛安娜：`state.deferredBeneath` → `api.deferCardBeneath(seat, code)`；
- 03038 藏身地点：`enemy.hidingSpotAloof` / `aloof` → `api.grantHidingSpotAloof(enemy)`；
- 02063 四叶草俱乐部：`enemy.aloof = false` → `api.clearEnemyAloof(enemy)`（基线重扫后新暴露的一项）。
账本：R1 167→164、单卡字段 14→11，golden 13 局零漂移。

**P2-6 第九批（2026-10-28，打出时选择升级，已落地）**：
- 引擎：`payPlayCost` 的 `beforePlayCost` 窗口对象（含 `playUpgrades`）随成功支付返回，
  `doPlay` 把它作为 `context.playCost` 传给 `played` 描述子——打出时选择不再写调查员字段，
  也不再需要打出后的 `delete`；
- 05111 情报报告 / 05234 诱敌 / 05277 帮个小忙：三条卡的「提升费用 2 点」二选一全部改为
  `context.playUpgrades`（费用窗口写入、played 读取），删除 `inv.playUpgrades05xxx` 三个字段。
账本：R1 164→161、单卡字段 11→8，golden 13 局零漂移。

**P2-6 第十批（2026-10-28，敌人身上的线索 / 王之法令数据化，已落地）**：
- 新增原语 `src/engine/enemy-clues.js`：`moveClueToEnemy(enemy, { from: 'location' | 'investigator', seat })`
  与 `clearCluesOnEnemy(enemy)`，能力面 `api-clue.js`、遭遇面 `scenario-runtime.js` 同时登记；
  「往事回声」议程的 `clueToDoom` 翻毁灭面收进原语，条目不再 import `_shared.js` 的
  `flipEnemyCluesToDoom`（该辅助函数删除）。
- 03098 狂徒 / 03099 王之特使 / 03100 王之法令 / 03144 卡尔克萨探求者 / 03145 引入歧途 5 张卡的
  线索搬运全部改为原语（按「同一句卡文出现第二张就提原语」处理，5 份实现收成 1 份）。
- 03100 的本轮攻击修正改为条目数据 `enemyStatRule.kingsEdict`（`{ stat, trait, perMarkers, amount }`）+ 
  `scenarioFlags.kingsEdictRound` 轮次标记，读点是 Carcosa `encounter-rules.enemyStatModifier`；
  删除引擎 `enemyFightValue` 里的 `enemy.kingsEdictRound` 分支与 `enemySpawned` 的实例标记——
  本轮内后入场的异教徒同样按轮次现算，不再写「进场快照」字段。
账本：R1 161→156、单卡字段 8→7（`enemy.kingsEdictRound` 消失），golden 13 局零漂移；
Carcosa 全卡账本 383 张重生成、`tests/carcosa-campaign-card-acceptance.test.mjs` 278 项全绿。

> 基线备注（2026-10-28 接手复核）：`test:fast` 有 1 条**既有**失败
> `tcu-migration.test.mjs`「P1 账本：scope.json 与 audit/tcu-migration.json 可复算」，
> 原因是工作区缺少 gitignore 的 `artifacts/tcu-migration/*.png` 浏览器证据（本机未装 Playwright 浏览器），
> 与 P2 改动无关；其余 3776 项通过、replay 13 局零漂移。

**P2-6 第十一批（2026-10-28，哈斯塔的傀儡，已落地）**：
- 03096 的「+3 攻击直到调查阶段结束」改为运行期敌人修正
  `api.addEnemyStatModifier(enemy, { fight: 3 }, { until: 'investigationEnd' })`：原语新增
  `investigationEnd` 时长（神话/调查阶段交战按当前轮，敌人/维持阶段交战顺延到下一轮；
  `src/engine/scenario-runtime.js`），读点是 `enemies.js` 的 `runtimeEnemyStat`；
  删除条目里的 `modifiers` 与 `enemy.puppetFightBonuses` 单卡字段。
账本：R1 156→155、单卡字段 7→6，golden 13 局零漂移；Carcosa 全卡账本 383 张重生成（424 项）。

**P2-6 第十二批（2026-10-28，丽塔·杨的每轮上限，已落地）**：
- 05005 的「每轮仅限一次」改用引擎通用上限账本 `limit: { scope: 'perRound', owner: 'player' }`
  （`src/engine/limits.js`），删除 `inv.ritaEvadeRound` / `inv.ritaEvadeUses` / `inv.ritaIgnoreLimitRound`
  三个单卡字段；
- 新增通用原语 `api.ignoreLimitForRound(descriptorId)`（`limits.js` 的 `ignoreLimitForRound` /
  `limitIgnored`，玩家面 `api-misc` 与遭遇面 `scenario-runtime` 同时登记）：旧印「直到本轮结束忽略该能力限制」。
  忽略期间**同一窗口实例内仍只结算一次**（`abilityLimits[].windowInstance` = 窗口名+轮/阶段/回合+行动序号+窗口主体），
  跨续算稳定、可重放；新关卡 `clearScenarioSceneLeftovers` 清 `limitOverrides`。
账本：R1 155→154、单卡字段 6→3（丽塔三字段消失），golden 13 局零漂移；
`tests/tcu-investigators.test.mjs` 的丽塔用例（真实躲避流程）全绿。

**P2-6 第十三批（2026-10-28，地点交换 / 移出游戏原语，已落地）**：
- 新增 `src/engine/location-swap.js`（唯一实现，依赖注入、不 import engine）：
  `swapLocationInPlay(state, events, fromId, toId, options, deps)` = `placeLocation` 入场 →
  搬 revealed / 线索 / 毁灭 / maxClues → 地点附属与 beneath **移动** → `playerLocationAttachments` 改 id →
  从 `scenarioZones.setAside` 取走新地点卡号 → 先敌人后调查员迁移（与迁移前 05125 同序）→
  旧地点 `removeLocation(…, { silent: true })` 静默离场；`removeLocationFromGame(state, events, id)` =
  地点上的敌人经 `discardEnemyCard` 进遭遇弃牌堆，其余清理与「被移出游戏」日志沿用 `removeLocation`。
- 遭遇面 `scenario-runtime` 新增 `swapLocation` / `removeLocationFromGame` / `takeFromSetAside` /
  `shuffleIntoEncounterDeck`（push 后洗一次，RNG 消耗与旧写法逐位一致）；能力面 `api-misc` 委托两项地点 API；
  `locations.js` 的 `removeLocation` 增加可选 `{ silent }` 日志开关（默认行为不变）。
- 05125 探访巫宅重写为纯 API 调用（0 直写）：换地点 / 移除其余地点 / 黑书归属 / 2 张古怪图形洗入全部走原语。
账本：R1 155→153、单卡字段 6→2（只剩 04289 的 TFA 两级嵌套检定字段），`fields['state.locations']` 消失；
golden 13 局零漂移；新增 `tests/tcu-location-api.test.mjs`（4 例，已在 `tests/suites.mjs` 与
`tests/node-suite.mjs` 双向登记），`tests/tcu-secret-name.test.mjs` 46 项全绿。

**P2-6 第十四批（2026-10-28，04289 嵌套检定链 · 单卡字段清零，已落地）**：
- 引擎新增「检定链后继续同一次探索」原语：`doExplore(state, seat, events, { resumed })`；
  遭遇面 `scenario-runtime` 暴露 `api.resumeExplore(seat)`（跳过重复的行动支付与 `beforeExplore`）；
  `api.defeat(inv, 'killed')` 统一把战役记录状态写成 `killed`（卡条目不再直写 campaign 记录）。
  嵌套检定本身由引擎已有的混乱袋帧栈（`chaos.frames`）与 `performTest` 的 `previousTest` 恢复支持，
  本轮用真实引擎验收证明「检定 → 回调 → 下一检定 → 恢复探索」整条链可跑通、且行动只付一次。
- 04289 岌岌可危的悬崖改为：`beforeExplore` 启动三级检定链并返回 false（本次探索先暂停），
  任一成功在回调里 `api.resumeExplore` 继续同一次探索，全失败 `api.defeat(inv,'killed')`；
  删除 `inv.tfaPrecipiceResuming` / `inv.tfaPrecipiceStage` 两个过渡字段与手动回退行动点。
账本：**单卡字段 2→0（清零）**、R1 153→152；golden 13 局零漂移；
`tests/tfa-depths-of-yoth.test.mjs` 新增 3 条真实引擎验收（检定通过 / 首项失败续链 / 三次失败坠亡），44 项全绿。

> 基线备注（2026-10-28 接手复核，续）：`test:fast` 仍有 1 条**既有**失败
> `tcu-migration.test.mjs`「P1 账本：scope.json 与 audit/tcu-migration.json 可复算」（浏览器截图证据缺失，
> 本机未装 Playwright 浏览器）；`audit/tcu-scenario-acceptance.json` 与
> `artifacts/migration/tcu/primitive-{catalog,plan}.json` 的浏览器/规划产物也属该环境缺口，
> 重新 `--write` 只会把 verified 降级为 development，因此**未提交**这些降级结果，与 P2 改动无关。
















