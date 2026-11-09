# 四循环《万象无终》全量扫描报告（2026-11-09）

> 扫描对象：TCU（The Circle Undone，四循环《万象无终》，`05xxx`）当前 HEAD 的全量内容：
> **377 条印刷记录**（343 主卡 + 34 关联面；`tcuCampaign` 237 / `tcuInvestigators` 19 / `tcuPlayer` 87）、
> 6 位正式调查员 + 4 位序章故事调查员、87 张玩家卡、237 张战役卡、9 个章节单元、21 个遭遇组、9 章冒险指南。
>
> 扫描方式：**独立复核**——不采信 `audit/tcu-*.json` 的 `verified`/`match`、README 勾选或测试标题；
> 只采信「卡面印刷文本 + 当前实现文件 + 引擎读点 + 可复现探针」。本轮由 10 个逐卡审计分片（覆盖 377 条记录、
> 357 个实现文件、3406 条既有账本证据引用）并行复核，再由 Lead 做机械审计、真实引擎探针与对抗式复核。
>
> 数据与复现：工作区 `G:/boardgame-hall-ai/artifacts/tcu-scan/`（`data/` 提取与机械账本、`shards/` 逐卡审阅包、
> `findings/` 10 个分片逐卡 JSON、`scripts/` 全部可复现探针）。结论只代表本次复核对当前工作区源码的判定；
> **扫描阶段未修改源码**。
>
> **修复状态（2026-11-09 追加）**：本报告的 **4 个 P0 已全部修复**并通过真实引擎回归
> （05130 崩溃、05162/05165 翻面清零线索、变体地点翻面分组、05201 幕 1 正面反应），修改文件与验收证据见
> [`fix-plan.md`](fix-plan.md) §0.1。
>
> **P1 状态（同日追加）**：**P1 全部 16 组已修复/接线并有回归**（含九章真实引擎冒烟、
> 观察投影与前端、05230 目标枚举、05104 投入费用时机、死声明清理、R1 直写清零 51→0、
> **P1-16 ICC 卡号表结构性迁移**：16 地点规则迁回单卡条目 + 5 诡计改吃 `resolveRule` 数据分派，
> 架构守卫卡号表基线 121→100、behavior.js 33773→33475 行）。修改文件、原语表与逐项验收证据见
> [`fix-plan.md`](fix-plan.md) §0.1–§0.6。本报告其余 high/medium 结论保持扫描时快照；后续只剩
> P2 的账本基线/i18n/复用与原语队列项。

## 0. 结论

**账本层：「377/377 verified、equivalenceCertified=true」在当前 HEAD 不能独立复现。** TCU 的 4 个冻结门禁
（`audit:tcu:check`、`audit:tcu:player`、`audit:tcu:primitives`、`scan:tcu:check`/`scan:tcu:scope:check`）
全部失败，根因是后续循环合入后 `src/cards/cards-data.js` 与共享引擎发生漂移而账本仍固定在旧来源；
TCU 测试 1249/1250，唯一失败即 `scope.json` 复算。逐卡账本 `377 match / 0 approximation / 0 gap` 与本轮独立
复核结论不符（见 §2、§3）。

**逐卡层**：377 条记录中 **match 299 / approximation 73 / gap 5 / blocked 0**（10/10 分片汇总，详见 §2 表），
独立复核判出 **high 级问题 32 条（其中 05346 一条经对抗复核降级，有效 31 条；按根因去重后 22 条）**、
medium 202 条、low 117 条，另有 **P0 崩溃 1 条**（由真实引擎探针新增）。
不成立的代表性断言：05015「不能取消」未实现、05024 多实现「补给耗尽弃置」、05190/05191 触发条件错位、
05230 卡面主场景不可达、05282 缺 `countsAs:'evade'`、05201 幕 1 正面反应不生效、05246 版本四错误生成敌人、
05103 怨灵附属无限累积、05104 额外费用先于投入决策结算。

**关卡层**：真实大厅 hub 流程探针可 **9/9 章从序章推进到战役结算**（`campaign.finished=true`，0 转场失败；
§7 表），9/9 章 setup 合法（地点/shroud/clues/幕/议程/遭遇牌库/混乱袋/放一边齐全，`config` 无 P0 缺失），
9/9 章指南中英齐备。但**章节内真实玩法**发现 1 个 P0 崩溃（《隐秘之名》「乔的房间」合法场景行动抛
`选择选项 id 重复`）与 2 个《恶罪报应》章节核心循环断裂（幽灵面翻面清零全部线索；变体地点翻面后分组失效），
且 9 章里 8 章的验收测试是「合成 state + api stub」钩子级测试，真实引擎文件仅 6/41——既有「逐章 12/12 全绿」
不能作为章节可玩证据。

**交互层**：选择事务、UI token、隐私投影与 TCU 面板（塔罗/幽灵牌堆/地点裂口/火盆/遗留记忆/看守人）总体完备，
en/zh locale 的 `tcu.*` 文案键存在；但至少 4 类玩家决策信息没有任何观察投影/前端承载：
05325 阿撒托斯毁灭计数、05325 冒险参考卡资源、05203 四把钥匙、05284 幕上裂口。
此外 146 个条目文件共 423 处动态 `label/prompt/info` 中文硬编码（章节内 247 处），与 en locale 无回退。

**原语层**：R1 直写状态仍有 51 张 TCU 条目（均在 `audit/card-entry-compliance.json` 存量基线上，只减不增）；
4 个声明字段无任何读点（`threatArea` ×7、`allowsCrossWoodsCommit`/`crossWoodsCommitIcons`、`redirectSpawnHere`）、
4 个分派值无处理器；`escape` 登记 3 条（含 05346；审计分片曾误报「未登记」，已被 Lead 复核驳回，见 §5）。
引擎行为级卡号分支本轮未发现新增（机械扫描 0），但「章节 behavior 内按卡号写规则」的存量结构性债务明显（D4 129 条）。

**复用层**：6 组同文卡簇中 **4 组应上收共享实现而各自独立实现**（6 张异端者、3 张镜中地点、2 张秘社大门、
2 张仪式地点；另有 05175/05175b 正背面与 2 条克隆例外）；7 条跨循环重印（`duplicatedBy` 指向后续循环卡号）
只实现一次（合规）；`05001→98010`、`05006→99001`、`05024→12031`、`05114→12077` 的重印别名未登记（潜在不可用）。

| 指标 | 数值 |
| --- | --- |
| 逐卡 verdict（10/10 分片） | match 299 / approximation 73 / gap 5 / blocked 0 |
| issue（去重前） | high 32（有效 31，去重后 22）/ medium 202 / low 117；另 scenarioIssues 43 条 |
| 维度分布 | D4 129 / D1 112 / D2 40 / D5 22 / D3 5 |
| 真实引擎流程 | 9/9 章可达、campaign.finished=true、转场失败 0 |
| 真实引擎崩溃 | 1 个 P0（theSecretName 05130，两轮+独立脚本复现） |
| 章节验收测试真实性 | 真实引擎文件 6/41；9 章中 8 章为合成 state/api stub |
| TCU 门禁 | 4 类检查失配、2 类通过；测试 1249/1250 |
| 账本证据可追溯 | 3406 条 clause 引用中 48 条不可追溯（1.4%），涉 32 张卡 |

**修复顺序见同目录 [`fix-plan.md`](fix-plan.md)：P0 4 项（崩溃/章节核心循环/反应不生效，**2026-11-09 已修复**）、
P1 16 组、P2 7 组。**

## 1. 扫描范围与方法

### 1.1 范围与分片

| 分片 | 覆盖 | 卡数 |
| --- | --- | --- |
| investigators | 6 位正式调查员 + 4 位故事调查员 + 专属/签名/弱点 | 23 |
| playerA / playerB | 87 张玩家卡（两波） | 44 + 43 |
| chapters-early | 序章《暮色庄园失踪事件》+《巫异时刻》 | 19 |
| chapters-middle1 | 《死亡门前》+《隐秘之名》 | 53 |
| chapters-middle2 | 《恶罪报应》 | 47 |
| chapters-late1 | 《崇高利益》+《聚合幻灭》 | 72 |
| chapters-late2 | 《混沌魔掌》+《黑色王座》 | 39 |
| sharedA / sharedB | 12 个循环共享遭遇组（21 组中的共享部分） | 14 + 23 |

### 1.2 五个维度（判定口径）

| 维度 | 名称 | 判定内容 |
| --- | --- | --- |
| D1 | 实现 vs 描述 | 每个印刷子句是否逐句落地；错值/缺分支/语义反向/只声明不实现 |
| D2 | 交互可感知 | `legalMoves` 是否产出行动、待决选择是否有 prompt/label、状态是否进观察投影（`observation.js`/`campaign-view.js`）、前端是否有承载 UI、动态文案 i18n |
| D3 | 关卡可跑通 | 真实大厅流程 setup/推进/结算/转场；behavior 钩子是否被引擎读点调用；章节测试是否真实引擎 |
| D4 | 原语合规 | 条目是否直写运行时状态（R1）、声明字段是否有读点（声明即接线）、卡号分支、同一规则重复手写 |
| D5 | 复用/重印 | 同文卡是否共享实现；重印是否只实现一次且卡号走身份别名 |

### 1.3 证据与复核

- 逐卡证据：每条 clause 给出 `file:line`；issue 带 severity/dimension/evidence/repro/confidence。分片审计员先跑
  `createGameState`/`core-fixture` 定向探针，再由 Lead 对 high 级问题逐条复核（复核记录见 §5）。
- 机械审计：`artifacts/tcu-scan/scripts/extract.mjs`（范围/实现/账本/测试/场景提取）、`screen.mjs`（R1/死声明/
  同文簇/证据可追溯/动态文案）、`test-authenticity.cjs`（章节测试真实性）、`aggregate-findings.cjs`（汇总）。
- 真实引擎探针：`probe-flow.mjs`（真实大厅 hub 流程逐章推进）、`repro-secretname-crash.mjs`（P0 复现）、
  `verify-lead.mjs`（翻面清零线索 + 观察投影）、`probe-view.mjs`（TCU 机制投影）、`inspect-probe.cjs`。
- 分片数据包：`shards/<分片>/meta.json + chunk-*.md`（印刷文本/实现全文/既有账本/机械提示）。

## 2. 逐卡审计结果

### 2.1 汇总（10/10 分片，377/377 条记录全覆盖）

| 分片 | 卡数 | match | approximation | gap | blocked | high | medium | low |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| investigators | 23 | 20 | 2 | 1 | 0 | 1 | 9 | 2 |
| playerA | 44 | 28 | 16 | 0 | 0 | 3 | 19 | 21 |
| playerB | 43 | 35 | 8 | 0 | 0 | 4 | 17 | 5 |
| chapters-early | 19 | 15 | 4 | 0 | 0 | 1 | 16 | 13 |
| chapters-middle1 | 53 | 42 | 11 | 0 | 0 | 1 | 20 | 11 |
| chapters-middle2 | 47 | 39 | 7 | 1 | 0 | 3 | 5 | 15 |
| chapters-late1 | 72 | 63 | 7 | 2 | 0 | 3 | 9 | 9 |
| chapters-late2 | 39 | 34 | 5 | 0 | 0 | 4 | 46 | 6 |
| sharedA | 14 | 7 | 7 | 0 | 0 | 1 | 17 | 9 |
| sharedB | 23 | 16 | 6 | 1 | 0 | 5 | 22 | 11 |
| **合计** | **377** | **299** | **73** | **5** | **0** | **32** | **202** | **117** |

> high 的 32 条里含同一根因的重复登记（如「翻面清零线索」同时记在 05162、05165 与章级 issue；「入场毁灭绕过
> canPlaceDoomOn」同时记在 05095 与章级）与 1 条对抗复核后降级的 05346（见 §5）；按根因去重后为 22 条 high
> （另加流程探针发现的 1 条 P0），即 §6 的 4 个 P0 + 16 组 P1 的依据。

### 2.2 逐卡 verdict 的判定口径

- `match`：全部印刷子句实现且与卡面一致；`approximation`：主行为可用但有明确偏差/简化；
  `gap`：存在未实现子句或不可达关键效果；`blocked`：实现完全不可用/触发即崩溃。
- 原账本的 `377/377 match` 不成立：本轮判出 32 条 high（有效 31 条，按根因去重 22 条），其中 22 条为
  D1/D3 规则实现偏差/缺失；另有 1 条 P0（theSecretName 崩溃）由真实引擎流程探针发现。

## 3. 分维度结果

### D1 实现 vs 描述（112 条 issue）

不成立的典型（按影响排序）：

1. **05015「不能取消」整条子句未实现**（high）：玩家牌库弱点抽取窗口 `src/engine/deck-ops.js:582-593` 不读
   `cannotBeCanceledRevelation`，05015 条目（`src/cards/entries/05015.js:8-41`）也未声明该字段；导致 05014
   黑暗洞察可以取消招牌弱点并洗回牌库——正是该子句要挡的交互。
2. **《恶罪报应》幽灵面翻面清零全部线索**（high，D1/D3）：`content/campaigns/theCircleUndone/card-data.js:78-83`
   的 `backFace()` 对地点默认 `clues: 0`，`src/engine/locations.js:222-225` 翻面时 `loc.clues = back.clues`；
   Lead 探针复现：翻面前线索 `2/4/4` → 翻面后全 `0`（`verify-lead.mjs`）。05162 幕背「将每个地点翻到幽灵面」
   与 05165 的 `[free]` 翻面都会触发。
3. **《恶罪报应》变体地点只按正面卡号建表**（high）：`definition.js:75-80` 的 `LOCATION_VARIANTS` 只列正面
   卡号，`behavior.js:86-101` 用 `original(loc)` 匹配；翻面后地点卡号变成 `05169b`… → `placedGroup`/
   `locationGroupOf`/`isAtAttic` 全部失效，05179/05180 的「生成 - 绞刑架/墓地、阁楼/地下室」整条失效，
   05175b 的两条印刷规则不可达。
4. **05201 幕 1 正面躲避反应不生效**（high）：`infiltrationReactionActive` 只在 actReveal 中置真
   （`forTheGreaterGood/behavior.js:749-753`），而真实引擎开局进入幕 1 正面时该 flag 未初始化（Lead 探针：
   `startScenario` 后 `actIndex=0` 且 flag 为 undefined），读取处 `:968` 的反应因此永久缺席直到幕推进。
5. **05246 版本四背面串入版本三规则**（high）：`unionAndDisillusion/behavior.js:779-793` 的 `else` 同时覆盖
   ACT_BEYOND_V3 与 V4，V4 也生成 1–2 张秘社新信徒；05246 印刷背面无该句。
6. **05024 多实现「补给耗尽弃置」**（high）：卡面无此句，条目却声明 `discardWhenEmpty:true`
   （`src/cards/entries/05024.js:16`），第 3 次使用后资产被弃置。
7. **05190/05191 触发条件写在 resolve**（high）：印刷「在诡计卡牌的一次检定中」没有进 `criteria`（枚举读点
   `src/engine/ability-rules.js:205-244`），费用在 resolve 前支付（`src/engine/reveal.js:228/255`）→ 任何自家
   检定都能点，点错白扣 1 补给 + 横置；仓库测试反而断言了「空转也扣费」。
8. **05230 瞄准镜主场景不可达**（high）：宿主枪械攻击行动只在「所在地点有敌人」时枚举
   （`src/engine/moves.js:505-518`），而「改指连接地点」只认手牌事件 04104（`moves.js:181-188`）不认附属卡；
   实测「本地无敌人、连接地点有敌人」时该攻击行动数为 0。
9. **05282 缺 `countsAs:'evade'`**（high）：`src/cards/entries/05282.js:28-30` 未声明行动类型，
   `table-decisions.js:296-316` 回落为 play → 打出「躲避」事件引发借机攻击（实测 damage/horror 0/0→1/1）。
10. **05072 弃牌堆敌人生成重复实体**（high）：`encounter-rules.js:345-347` 先把弃出的敌人放进遭遇弃牌堆，
    `atDeathsDoorstep/behavior.js:811-829` 的 `api.spawn` 只新建实例、不从弃牌堆取回 → 同一张实体卡同时在
    场上与弃牌堆，洗回后可再抽出第二份。
11. **05152 返回手牌的附属同时留在弃牌堆**（high）：`src/engine/assets.js:353-359` 先把 attachment 推进弃牌堆，
    05152 再走 `api-misc.js:374-376` `putInHand` 不回滚 → 重复卡张，且同一窗口反复询问反应。
12. **05156 时机越界**（high）：`betweenActionsAnyTurn` 在 `src/engine/encounter.js:523-537` 是无条件「或」分支，
    任何 playerWindow（含神话/敌人/维持阶段与技能检定）都会提供；执行时把 phase 强改为 investigation。
13. **05103 被附属怨灵无限累积**（high）：`_shared/trapped_spirits/05103.js:61-77` 在闹鬼生成后不移除
    `location.attachments` 上的旧怨灵与授予，`haunted.js:331-333` 每次生成全新实例、`:467-479` 只在显式调用时清理
    → 每次结算都额外生成新怨灵，授予无限累积。
14. **05104 额外费用先于投入决策**（high）：`src/engine/tests.js:360-373` 在每个 owner 的投入循环开头就调用
    `beforeCommitCard`，`:438-449` 之后才询问玩家投入/放弃；05104 的「投入卡牌的额外费用」因此对「投入 0 张、
    放弃协助」的调查员也强制结算闹鬼。

其余 medium 典型：05002/05009「直觉牌库底」实为放顶（`src/engine/hunch-deck.js:204` push vs reveal `:157` pop，
测试锁定错误方向）；05243/05245/05246 的 `spawnPrinted` 丢 `victory`/`healthPerInvestigator`；05177 攻击难度用
`target.fight` 而非 `enemyFight`；05082 涌动条件结算后才求值；05088/05091 强制攻击用 `break` 漏掉后续调查员；
05259/05269/05270 等重复手写同一规则；05093/05094 把「自动成功」实现成跳过检定；R1 直写（见 D4）。

### D2 交互可感知（40 条 issue）

**已投影/有 UI（核验通过）**：塔罗（`campaign-view.js:41` `tarotInfo`）、幽灵遭遇牌堆（`:39`）、地点状态
（`:132` `locationStates`：地点裂口/火盆徽标，`web/tcu-ui.js:157-206`）、遗留记忆/看守人（`:129`
`watcherAndMementoProjection`）、序章故事调查员（`storyInvestigators`）、地点上的塔罗指南针（`observation.js:166`）、
裂口封印（`:168`）。`zh-CN`/`en` locale 均有 `tcu.*` 文案键（`web/locales/*.panels.js`）。

**不可感知（high）**：

1. **05325 阿撒托斯毁灭计数**：核心计时器存 `scenarioFlags.azathothDoom`
   （`beforeTheBlackThrone/behavior.js:59-83`），`PUBLIC_SCENARIO_FLAGS` 仅 `depthLevel/pillars/deepDark`
   （`observation.js:43-45`），骷髅值、黑色王座隐藏值、05344/05345 与「≥10 毁灭吞食宇宙」均无法预判
   （Lead 探针：`viewState` 中不含该字段）。
2. **05325 冒险参考卡资源**：`scenarioFlags.referenceResources`（`behavior.js:1132` 初始化）未投影，
   05336/05337/05338/05339/05340 的代价能力全以它开门（Lead 探针同样验证不可见）。
3. **05203 四把钥匙**：`state.scenarioKeys` 只写不投影（`forTheGreaterGood/behavior.js:89-124`），
   观察投影/前端均无钥匙归属，幕 3 目标不可判断。
4. **05284 幕上裂口**：裂口存 `state.acts[i].breaches`（`inTheClutchesOfChaos/behavior.js:157-168`），
   `web/` 只渲染地点裂口（`tcu-ui.js:165-197`），玩家无法据此决策幕 `[fast]` 行动（`:1120-1125`）。

**不可感知（medium）**：05089/05102/05107「放在密谋牌库旁」写入 `state.scenarioZones.agendaAside`，而公开投影
只取 `state.agendaAside`（`observation.js:31`）且 web 无渲染（`game-ui.js:916-932` 只渲染 setAside/victory）；
05107 的「3 张齐了全体 3 点恐惧」正依赖这个不可见计数。05006 法术专用额外行动无投影（`observation.js:51-60`
只投影 `exploreOnlyActions`），普通行动静默从 legalMoves 消失且无解释；05114/05118/05157 的 `target:{kind:'enemy'}`
不筛冷漠敌人 → 出现「点得到但执行被拒」的死按钮；05152 反应窗口重复询问最多 13 次。

**i18n**：146 个条目文件 423 处动态中文（`label/prompt/info`）硬编码，章节内 247 处；en locale 只覆盖静态
`tcu.*` 键，动态文案不会翻译（系统性口径，非单卡缺陷）。

### D3 关卡可跑通（5 条 issue + 探针结果）

- **真实大厅流程**（`probe-flow.mjs`）：9/9 章顺次到达并抵达战役结算，`campaign.finished=true`，转场失败 0；
  两轮不同结局键偏好均完成。**结论：关卡注册/流程接线/转场/结算链路可用。**
- **逐章 setup**：9/9 章在真实 `startScenario` 后通过 setup 校验（地点数量与 shroud/clues、幕/议程数量与阈值、
  遭遇牌库非空且卡号已知、混乱袋非空、放一边与剧情资产数量、指南存在）。序章议程无毁灭阈值属印刷设计（低）。
- **P0 崩溃（真实引擎路径）**：《隐秘之名》「乔的房间」05130 的 `scenarioAction:joeSearchBlessed` 抛
  `选择选项 id 重复（card：01020）`（`resolution.js:60` ← `05130.js:29-34` 用 `candidates.map(code => ({id: code}))`
  且牌组含同名卡两张）；两轮流程探针均在第 8–11 步复现，独立脚本 `repro-secretname-crash.mjs` 稳定复现。
- **章节测试真实性**：9 章逐章测试中 8 章是「合成 state + api stub」钩子级测试（仅 forTheGreaterGood 含
  `createGameState/startScenario`，序章含 `createGameState`），因此「逐章 12/12 全绿」只证明钩子单测通过，
  不证明真实引擎可玩；本轮 Wages/05130 两类真实路径缺陷都未被既有测试捕获。
- 其他 D3 medium：05045 幕 1b「记录你被追捕/翻回 1a」真实流程不可达但 manifest 仍声明 `recordWrites`；
  atDeathsDoorstep 在空战役记录时不放置失踪人口线索（真实流程 prologue 会写入记录，故实际影响需按存档路径复核）；
  序章 7 张幽灵地点只有有调查员的地点被揭示（definition 未声明 `locationsStartRevealed`）。

### D4 原语合规（129 条 issue）

- **R1 直写状态**：51 张 TCU 条目直接写运行时状态（`state.*`/`inv.*`/`enemy.*` 等），全部在
  `audit/card-entry-compliance.json` 的 `baseline.directStateWrite` 存量基线内（只减不增）；典型：05051/05057/
  05058/05059/05060/05061/05086/05089/05090/05091/05107/05116/05121/05122/05126/05129/05336/05339/05340。
  另有工具漏检（`state.investigators[seat].x.push` 索引式；`source.attachments`）应由审计工具补规则。
- **声明即接线（无读点）**：`threatArea`（7 张：05093/05094/05098/05105/05108/05146/05147）、
  `allowsCrossWoodsCommit`/`crossWoodsCommitIcons`（05062，behavior 实际走 `crossLocationCommit`）、
  `redirectSpawnHere`（05064，behavior 按卡号判断）、`flags.storyRule`（Wages 6 张异端者）、
  `05053 actRule.chapterFlow`、`05054 frontsUnlocked`、`05055b anetteSpawned` 等。
- **顶层/嵌套声明错位（high，05311 型）**：05311 把 `breachOnEnter: 1` 写在条目顶层
  （`inTheClutchesOfChaos/05311.js:11`），章节却读 `entryFlags(...)?.breachOnEnter`（`behavior.js:1070,1077`），
  而 `entryFlags` 只返回 `entry.flags`（`src/cards/card-rules.js:258-260`）→ 「进入地点后放 1 裂口」永不触发。
  该型问题在「声明存在 ≠ 引擎读到」中占多数，修复时应统一走 `flags.*` 或补顶层字段读点。
- **分派值无处理器**：`unfinishedBusinessImmediate`（05178j/l）、`discardPunishment`（05181）、
  `discardWracked`（05093）、`discardBedeviled`（05094）。
- **结构性**：多章 behavior 以卡号表写 10+ 张地点/诡计规则（Death's Doorstep 7 地点、ICC 12 地点+3 诡计、
  BBT 3 枢纽+6 地点+4 诡计），单卡条目只剩 `implemented` 身份声明；ICC 幕裂口容器另起一套
  `state.acts[].breaches`，引擎既有 `api.addActBreach/removeActBreach`（`scenario-runtime.js:1184-1201`）无人使用。
  架构守卫正则只匹配 `code/originalCode === '0xxxx'`（`tests/architecture-guard.test.mjs:347-353`），ICC behavior.js
  实测命中 0、`CONTENT_BRANCH_BASELINE=0` 仍通过——即「卡号表硬编码」没有被守卫识别为引擎行为级卡号分支。
- **escape 登记**：`artifacts/migration/tcu/primitive-plan.json` 已登记 3 条（05346 终局、05178a-l 异端者、
  05258-05261 剧情卡），登记流程可复算。
- **引擎边界**：机械扫描未发现 TCU 引入的新增行为级卡号分支（`engineBoundary.codes=0`），本轮不新增债务；
  但既有「behavior 内卡号分支」是内容层结构性债务。

### D5 复用/重印（22 条 issue）

- **应复用未复用（4 组）**：05178a/c/e/g/i/k 六张同文异端者（六份独立条目 + 同一 `HERETIC_FACES` 数据双写）、
  05204/05205（秘社大门同文地点）、05244/05245/05246（三张同文地点）、05286a/05288a（同文幕背）。
- **合规**：05175/05175b 为同一张卡的正/背面（非重复）；6 张异端者的规则实为共享 `HERETIC_FACES` 数据 +
  behavior 分派（D5 条目层仍双写，但规则主体已共享）；7 条跨循环重印只实现一次。
- **重印别名缺失（潜在）**：`05001→98010`、`05006→99001`、`05024→12031`、`05114→12077` 在
  `cards-data.js` 标了 `duplicatedBy`，但 `src/cards/entries/_reprint-aliases.js` 未登记，重印号
  `registeredEntry` 为空（当前不可选，属潜在炸点）。
- **同规则重复手写**：05269/05270「加入任意调查员威胁区」两份；05277/05234/05322「连接内地点」四份；
  05093/05094「自动成功」实现成跳过检定（引擎 `skillTest.autoSuccess` 无写入口，属原语缺口）；
  「弃遭遇牌库顶」3 份（共享版 + 05090 内联 + 05099 本地且不识别幽灵牌堆）；05095/05096 谈判能力两份、
  05190/05191 触发块逐字两份、05286a/05288a 同文同数据两份。

## 4. 账本、证据与测试可靠性

1. **门禁失配（可复现）**：
   - `audit:tcu:check` exit 1：`audit/tcu-migration.json` 的 `earlyAccess, equivalenceCertified, verifiedScope,
     confirmations, evidence, remaining, releaseAcceptance, gate` 与内容不一致；
   - `audit:tcu:player` exit 1：`audit/tcu-player-acceptance.json` 被判定过期（hash/来源复算失败）；
   - `audit:tcu:primitives` exit 1：`primitive-plan.json`、`primitive-catalog.json` 与代码不一致；
   - `scan:tcu:check` exit 1：机制扫描与 `cards-data.js`/参考来源漂移；
   - `scan:tcu:scope:check` exit 1：`scope.json` 记录的 `src/cards/cards-data.js` sha `6a238be7…` 与当前
     `ec503cc5…` 不一致（根因：TIC/EOTE 等后续循环合入改动全局卡表）。
   - 通过项：`audit:tcu:all-cards`（账本自洽 377/377）、`audit:tcu:scenarios`（9/9 账本自洽）、
     `cards:dead-code`。**「自洽」只说明生成器与冻结文件一致，不等于规则等价。**
2. **测试**：TCU 41 个 test 文件、1250 例、1249 pass / 1 fail；唯一失败为 `tests/tcu-migration.test.mjs` 的
   `scope.json` 复算。另有 33 个测试文件使用 `apiStub`/手搭 state 风格，真实引擎文件仅 6 个。
3. **账本证据可追溯性**：3406 条 clause 证据引用中 48 条（1.4%）不可追溯，涉 32 张卡：行号过期 15、
   证据文本被截断成半截路径 15、裸文件名 2、其余 16（同族截断/疑似旧路径）。
4. **账本字面口径**：163/377 张卡的 clause 文本与当前 `cards-data` 卡面不能逐字对上（多为摘要式改写，
   recall < 0.7）；「逐句核对印刷文本」的字面口径在当前账本中不成立，需按 `fix-plan.md` P2-2 重新生成逐字 clause。
5. **章节账本假绿链路**：`audit/tcu-scenarios` 依赖各章测试文件的实跑结果，而 8/9 章测试不进入真实引擎，
   因此 12/12 检查项通过不覆盖 setup→推进→结算的真实链路（本轮 Wages 翻面清零线索、theSecretName 崩溃均
   未被捕获）。
6. **issue 构成**：去重前高/中/低 = 32/202/117，另章节级 `scenarioIssues` 43 条（其中 high 6 条已并入 §0 表）；
   按维度 D4 129 / D1 112 / D2 40 / D5 22 / D3 5。D4 占比最高说明「声明未接线/直写状态」是 TCU 的主要债务，
   而不是逐卡缺实现（gap 仅 5 张：05015、05201、05246、05175b、05311；approximation 73 张集中在
   「近似实现/口径偏差」）。

## 5. 对抗复核与修正

对 high 级结论由 Lead 逐条复核（读码 + 真实引擎探针）：

- **Confirmed（Lead 独立复现）**：theSecretName 05130 崩溃（`repro-secretname-crash.mjs` 稳定复现）；
  Wages 幽灵面翻面清零线索（`verify-lead.mjs`：2/4/4 → 0/0/0）；变体地点正面卡号表（代码核对
  `definition.js:75-80` + `behavior.js:86-101`）；05201 幕 1 flag 未初始化（真实 `startScenario` 后
  `scenarioFlags.infiltrationReactionActive === undefined`）；05203/05325 未投影（`viewState` 逐字段核对）；
  05284 幕裂口无前端（`web/` 仅地点裂口）；05246 V4 分支（`behavior.js:779-793` 与 05246 印刷文本比对）；
  05015 不能取消（`deck-ops.js:582-593` 不读 `cannotBeCanceledRevelation`）；05190/05191（无 criteria +
  费用先付）；05282（无 countsAs）；05002/05009 牌库底/顶（`hunch-deck.js:204` push vs `:157` pop）；
  05103 怨灵附属/grant 无生命周期（`_shared/trapped_spirits/05103.js:61-77` 与 `haunted.js:331-333`，全仓无清理点）；
  05104 投入费用先于投入决策（`src/engine/tests.js:360-373` 先调 `beforeCommitCard`，`:438-449` 才询问）；
  05311 `breachOnEnter` 顶层声明 vs `entryFlags` 读取（`05311.js:11` vs `behavior.js:1070,1077`）。
- **Refuted（驳回）**：分片 late2 报「05346 的 escape 未登记、声称的原语登记文件不存在」——实际
  `artifacts/migration/tcu/primitive-plan.json` 的 `escape` 明确登记了 05346、05178a-05178l、05258-05261
  （审计员查错了 `artifacts/tcu-fix/…` 目录）；05346 的 `immuneToPlayerCards/omnipotent/spawnAt` 三字段确无
  引擎读点，但 behavior 采用「不生成实体」的已登记近似，故降级为 low（声明即接线提示，不是 high）。
- **修正**：分片 middle1 的「空记录时失踪人口线索不可达」在真实战役流程（prologue 写入记录）下不成立，
  降级为 medium/条件性；分片 late2 的「隐藏摆放 id 泄漏」未找到可从 `location.id` 反推卡面的路径，
  标 unverified 暂不计入（`presentation-state.js` 的 `maskHiddenLocations` 会替换未揭示地点的身份字段，
  仅保留内部实例 id 供引用）。
- **口径统一**：05162/05165/05175b 三张卡与「变体地点」章级 issue 是同一根因的两层表现，§2/§3 与修复计划
  按「章级根因 + 受影响卡」合并计；同文卡簇按「规则是否共享」区分 D5 与 D1。

## 6. 修复优先级（摘要，详细步骤见 fix-plan.md）

**P0（先修：真实路径崩溃/章节核心循环断裂）**
1. 05130 乔的房间候选去重（重复选项 id 崩溃；同型排查 05125/05134 的 `api.choose`-in-`find` 反模式）。
2. 《恶罪报应》幽灵面翻面保留线索（`backFace`/`flipLocation` 口径统一），并核对 05162/05165 目标。
3. 《恶罪报应》变体地点按正/背面卡号共同识别（`LOCATION_VARIANTS`/`locationGroupOf`），恢复 05179/05180
   生成规则与 05175b 两条规则。
4. 05201 幕 1 正面初始化 `infiltrationReactionActive`（或改读幕/议程卡号数据），补真实引擎回归。

**P1（规则正确性/可感知，16 组）**：05246 V4 分支；05072 弃牌堆实体回收；05015 不能取消；05190/05191 criteria；
05230 target 候选；05282 countsAs；05024/05152/05156；05002/05009 牌库底；spawnPrinted 数值丢失；
05095 doomOnSpawn 绕过 canPlaceDoomOn；05103 怨灵生命周期 + 05104 投入费用时机；05311 `breachOnEnter` +
ICC behavior 卡号表/守卫漏检；05201/05045/05043 tokenMeanings 接点；05203/05284/05325/agendaAside/05006
观察投影与前端；R1 51 张与死声明/分派值接线；9 章真实引擎冒烟测试。

**P2（账本/复用/i18n）**：重新生成并人工审阅 4 个冻结账本（scope/mechanism/primitive/migration）与玩家验收；
逐卡账本 clause 逐字化 + 48 条坏证据修正 + 377 条 verdict 重判；4 组同文卡上收共享实现；4 条重印别名补登记；
423 处动态中文 i18n；重复手写规则上收引擎原语（autoSuccess、弃遭遇牌堆顶等）。

## 7. 证据与复现

| 内容 | 路径 / 命令 |
| --- | --- |
| 扫描数据（卡面/实现/账本/测试/场景/分片） | `artifacts/tcu-scan/data/`、`artifacts/tcu-scan/shards/` |
| 逐卡 findings（10 分片） | `artifacts/tcu-scan/findings/*.json` |
| 汇总账本 | `artifacts/tcu-scan/data/findings-summary.json`、`mechanical-summary.json` |
| 真实战役流程（9/9 章） | `node artifacts/tcu-scan/scripts/probe-flow.mjs` → `data/flow-probe.json` |
| P0 崩溃复现 | `node artifacts/tcu-scan/scripts/repro-secretname-crash.mjs` |
| 翻面清零线索 + 观察投影复核 | `node artifacts/tcu-scan/scripts/verify-lead.mjs` |
| 范围/机械审计/分片包 | `node artifacts/tcu-scan/scripts/{extract,screen,build-shards}.mjs` |
| 测试真实性/汇总 | `node artifacts/tcu-scan/scripts/{test-authenticity,aggregate-findings}.cjs` |

**复现约束**：本轮未修改 `games/arkhamhorror` 任何源码；探针均通过公开动作通道（`createGameState`/`applyMove`/
合法 `legalMoves`）执行，不直写状态；`probe-flow.mjs` 的逐章结算使用调试 `endScenario`（flow-only），
章节内是否可玩需按 fix-plan 的逐章真实引擎用例复核。
