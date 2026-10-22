# 卡牌实现修复 TODO（核心包 + 第 1–3 循环）

> **来源**：[卡牌实现保真度审计](card-fidelity-audit.md)（快照 2026-10-22 02:22，1,262 张卡逐张核对）。
> **规模**：审计发现 259 张卡未完全按卡面实现（高 24、中 122、低 113）。本文件按 P0/P1/P2/P3 组织；P0 的 24 张与 P2/P3 的 235 张已修复并勾选，剩余 0 张按 P1 → P3 顺序处理。
> **用法**：每完成一张把 `- [ ]` 改为 `- [x]`。改行为前后必须走下面的“每张卡的门禁”。
> **注意**：这是静态比对结果，不代表运行态一定复现；标“高”的是整卡能力不可达或整段核心规则缺失，已优先修复。

## 进度总览

| 循环 | 未完全实现 / 总数 | 高 | 中 | 低 |
| --- | --- | --- | --- | --- |
| 核心包 | 0 / 185 | 0 | 0 | 0 |
| 敦威治遗产 | 0 / 333 | 0 | 0 | 0 |
| 卡尔克萨之路 | 0 / 383 | 0 | 0 | 0 |
| 失落的时代 | 0 / 361 | 0 | 0 | 0 |

- [x] 全部 P0 清零（24/24，见 `tests/card-fidelity-p0.test.mjs` 与各卡验收用例）
- [x] 全部 P1 机制任务完成（描述子 kind 守卫、campaignRule 守卫、地点进入/离开、双实现收敛、玩家卡高频四类、非玩家卡声明通道全部完成）
- [x] 全部 P2 双实现收敛（5/5，见 `tests/card-fidelity-p1.test.mjs`）
- [ ] P3 剩余卡清零

---

## P0 · 高严重度（24 张，已修复）

> 判据：整卡能力不可达、核心条款整段缺失、或整表规则不符。每张给出全部缺口与代表性证据；完整的 `printed`/`implemented` 在 [审计报告](card-fidelity-audit.md) 与 [card-fidelity-findings.csv](card-fidelity-findings.csv)。

- [x] `02012` **吉姆的小号**（支援，高）— 多目标分支无法执行：只要本地点/连接地点有 2 名以上带恐惧的调查员，触发即抛 ReferenceError: effect is not defined，整次结算中断（单人、或只有 1 名候选人时正常）  
  证据：src/cards/entries/02012.js:14-16；src/engine/harm-threat.js:462-474（第 469 行 source: effect.code 为未定义标识符）
- [x] `03047a` **陌生人（戏中戏·火焰）**（幕，高）— 改为把苍白面具下的男子移动到前厅并留在场上（需要 state.enemies 重新收录，否则既不在场也不进胜利区）  
  证据：content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js:206-241；content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js:39-48
- [x] `03047b` **陌生人（戏中戏·淤泥）**（幕，高）— 改为把苍白面具下的男子移动到前厅并留在场上  
  证据：content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js:224-227；content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js:126-133
- [x] `03047c` **陌生人（戏中戏·洪水）**（幕，高）— 改为把苍白面具下的男子移动到前厅并留在场上；被弃掉（非击败）触发推进时跳过了 2c 背面的三行效果；「每轮仅限一次」应为该能力每轮一次，而不是每位调查员一次  
  证据：content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js:228-233；content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js:136-146
- [x] `03087` **拜亚基的猎杀**（诡计，高）— 从被揭示的拜亚基中选择并抽取1张（真正进入交战/生成，而不是洗回牌库）；揭示的牌对玩家可见（当前无日志）  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:347-362；src/engine/treachery-tokens.js:84（campaignRule 交由剧本 resolveEncounter）
- [x] `03102` **锈蚀**（诡计，高）— X = 所在地点隐藏值，需要按印刷费用合计判定；可以弃多张（场上和/或手牌）直到合计 ≥ X；玩家可以选择弃到刚好够；弃不够时不应算作已弃；只有「本效果没有弃掉任何卡」才涌动  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:451-472
- [x] `03108` **解剖图表**（事件，高）— 卡牌的结算完全不可达：作为事件打出时没有任何效果（应写在 kind:'played' 或 playedDescriptor.resolve）；「快速」未实现（被写成消耗行动 + 横置的能力）；「仅当你剩余神智≥5 才能打出」没有 playCondition；「直到当前调查员回合结束」的实际时长逻辑存在（enemyTestModifier 按 round+turnSeat），但因能力不可达而未生效  
  证据：src/cards/entries/03108.js:12-24；src/engine/actions.js:229-256
- [x] `03121` **埋藏的真相**（密谋，高）— 神话阶段跳过“在当前密谋放置 1 个毁灭标记”（整局 3 张议程都在跳过，直接改变毁灭阈值节奏）；章节级强制“线索放到敌人身上后翻至毁灭面”没有作为规则实现（只被个别卡硬编码为放毁灭，03134 等反向读毁灭时无法区分线索/毁灭来源）  
  证据：src/engine/turn.js:86；src/engine/turn.js:93
- [x] `03122` **洗劫宅邸**（密谋，高）— 神话阶段跳过放毁灭；线索放到敌人后翻成毁灭的章节级强制  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:228-230；content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/definition.js:62-64
- [x] `03123` **不能揭开的秘密**（密谋，高）— 神话阶段跳过放毁灭；线索放到敌人后翻成毁灭的章节级强制  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:231；src/engine/turn.js:86
- [x] `03182a` **丹尼尔·契斯特菲尔德（支援面）**（支援，高）— 强制：受到恐惧且至少 1 点未分配给丹尼尔时，受到 1 点伤害（整条缺失，等于白送一个 3 神智的伤害吸收器）；强制：丹尼尔离场时从游戏中移除（整条缺失）  
  证据：content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:380-386；content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:430-441
- [x] `03200` **真相幻影**（场景参考，高）— skull 应按场上毁灭标记总数计算，简单/普通封顶5；cultist 失败时应将每个未交战[[拜亚基]]朝最近调查员移动一次（不是失去资源）；tablet 应取消投入本次检定的每张技能卡的效果与图标，且数值为 -3/-4；elder_thing 应为 -2/-3，失败时每低于难度1点失去1资源（不是受到恐惧）  
  证据：content/campaigns/thePathToCarcosa/carcosa-chaos.js:33-38；content/campaigns/thePathToCarcosa/carcosa-chaos.js:90-93
- [x] `03221` **风琴手**（敌人，高）— 不能受到伤害；通过猎手关键词移动后未交战时再次结算猎手关键词（每轮1次），且本阶段不能攻击  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:44-66；content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:82
- [x] `03221b` **风琴手**（敌人，高）— 不能受到伤害；敌军阶段结束时：未交战则朝远离最近调查员方向移动1地点（优先无调查员地点）；已交战则解除交战  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:82,163；content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:44-66
- [x] `03234` **.41短口手枪 / .41 Derringer**（支援，高）— 『检定成功且超过难度至少1点：本次攻击造成+1伤害』——数值从未叠加到实际伤害  
  证据：src/cards/entries/03234.js:17-24；src/engine/combat.js:169
- [x] `03240` **苍白面具**（场景参考，高）— skull 应按「到起始地点的地点数」计算并封顶5；cultist 应为 -2/-3 且按攻击期间成功检定减伤（困难侧不造成伤害），不是 0 + 再抽标记；tablet 应为 -2/-3 且触发所在地点重整/重整并攻击的食尸鬼或灵怪；elder_thing 应为 -3/-4 且失败时查找遭遇牌库与弃牌堆抽一张食尸鬼或灵怪  
  证据：content/campaigns/thePathToCarcosa/carcosa-chaos.js:39-44；content/campaigns/thePathToCarcosa/carcosa-chaos.js:94-97
- [x] `03241b` **死亡鬼灵**（敌人，高）— 横置时每次攻击伤害-1；躲避死亡鬼灵的技能检定失败后其攻击你  
  证据：content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:284-293；content/campaigns/thePathToCarcosa/scenarios/thePallidMask/definition.js:14
- [x] `03268` **建议 / Suggestion**（支援，高）— [reaction] 花费1充能取消一个非精英敌人对你的攻击——该反应从未被枚举，完全无法触发  
  证据：src/cards/entries/03268.js:30-33；src/engine/encounter.js:259-263
- [x] `03317` **疯狂漩涡**（密谋，高）— 背面四选一的决定（意志4 / 智识4 / 2 恐惧 / 昏倒+1 毁灭）；检定失败后「必须选择另一个尚未选择过的选项」  
  证据：content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:343-350；content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:452-456（正面：伤害阈值推进）
- [x] `03332` **哈斯塔（黄衣之王）**（敌人，高）— 「除剧情卡牌效果外不能受到伤害」——现在可被武器/法术直接伤害；「强制 - 敌军阶段开始时若重整：按玩家顺序攻击每位调查员，无视所在地点」；「如果哈斯塔的攻击造成的恐惧超出你的神智值，你还受到1点伤害」  
  证据：content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:369-374；content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:392-399
- [x] `03334` **哈斯塔（褴褛之王）**（敌人，高）— 猎物「剩余神智值最高」；攻击造成恐惧超过神智值时额外受到 1 点伤害；无剩余神智值的调查员攻击/躲避哈斯塔时，+1/0/-1/[elder_sign] 视为 [auto_fail]  
  证据：content/campaigns/thePathToCarcosa/card-data.js:94-108；src/engine/card-ops.js:32-46
- [x] `04104` **枪法如神**（事件，高）— 应作为被激活的枪械/远程支援那次攻击的修正（沿用其战斗加值、伤害、弹药消耗），而不是另起一次 1 伤害的通用攻击；未在「激活枪械攻击能力」窗口触发（activateFirearmFight 读点存在但本卡未使用）  
  证据：src/cards/entries/04104.js:12-38；src/engine/combat.js:109-147
- [x] `04156` **挥金如土**（支援，高）— 整条 [free] 能力不可达：资产需要在 kind:'free' 上声明 cost{resources:3, exhaust:true} 与 +2/返资源的 resolve；费用（花费 3 资源、横置）完全不存在，成功返 3 资源也不会发生  
  证据：src/cards/entries/04156.js:13；src/engine/ability.js:561
- [x] `04273` **陈旧猎枪**（支援，高）— 卡膛状态：命中 skull/autofail 后该攻击能力应不可再激活，直到执行解卡能力的 [action]；后续能力「[action]：你解决了卡膛情况」整条不存在；伤害数值：卡面是 +2（合计 3），实现固定 2 点（文件注释也自认「成功造成 2 点伤害」）  
  证据：src/cards/entries/04273.js:8；src/cards/entries/04273.js:25-36

---

## P1 · 机制层（一次修复覆盖一批卡）

- [x] **描述子 `kind` 与卡型守卫**：事件必须有 `kind:'played'`（或 `reaction` + `fromHand` 的手牌反应通道），支援不得只有 `kind:'played'`。守卫在 `tests/card-entries.test.mjs`；03108、04156 已在 P0 纠正。
- [x] **非玩家卡特殊文本的统一声明通道**：卡尔克萨/失落的时代敌人目前只从英文文本解析 Hunter/Aloof/Massive/Retaliate/Alert/Peril/Hidden/Surge，其余文本无落点。已补 03332、03334、03221/03221b、03241b、03182a、03067b、03068b、03141、03291。
- [x] **`campaignRule` 未命中不再静默**：新增 `tests/encounter-handler-guard.test.mjs`，逐章断言每个 campaignRule 诡计有条目 handler 或在章节 `implementedEncounterCodes` 登记；顺带补上 01162 的结算。
- [x] **幕/密谋通用钩子**：`skipMythosDoom`（03121/03122/03123）、`agendaAdvanceChoice`（03317）、以及“被击败时改为移动而非弃掉”的敌人去向钩子（03047a/b/c）已在 P0 修复中落地（条目字段 `skipMythosDoom`、`agendaRule.onReveal`、`actRule.onEmissaryDefeated/onEmissaryDiscarded`）。
- [x] **地点进入/离开限制**：`investigatorEntryError` 读 `locationRule.entryError`（并尊重「忽略未揭示面文字」）；`movementError` 读 `cannotLeaveRound`。覆盖 02052、02054、02055、02057、03172（幕 2 解除）、03176、03177、03256。
- [x] **重复实现收敛**：旧 `cardDrawn`/`cluesGained`/`enemyDefeated` 钩子已删，Necronomicon 行动与 04064 的第二次结算已删。见 P2。
- [x] **玩家卡高频细节四类**：上限作用域（01003 每回合 vs 每轮）、`抽取` vs `加入手牌`（01031/01063 走抽牌管线/入场放毁灭）、费用时机（01002 成功后才抽牌）、可选 vs 强制（01117 可选 +1 伤害；01063 必选检索）。

---

## P2 · 双实现/双结算（数值翻倍与重复询问）

- [x] `02061` 沃伦·莱斯教授：条目 `skillModifier` 是唯一来源；剧本 `cluesGained` 钩子已删，+1 不再叠成 +2。
- [x] `02080` 佛朗西斯·摩尔根博士：同上，`combat` +1 不再叠成 +2。
- [x] `02140` 死灵之书：+1 只由条目 modifiers 提供；「[action] 获得 2 资源」只保留条目行动，并补「不能获得资源」条件。
- [x] `02040` 亨利·阿米蒂奇博士：旧 `cardDrawn` 钩子已删；条目反应补 `canGainResources` 条件，抽牌窗口统一由 `reactionWindow` 开启。
- [x] `04064` 华美石室：删除 `afterTest` 的第二次结算，只保留 `investigateResult`（发现线索之前翻面），一次失败不再翻 2 个线索。

---

## P3 · 其余卡（0 张未完成，按循环）

> 结论口径：**部分实现** = 主效果在、至少一条有规则后果的条款缺失；**简化/近似** = 有实现但改变了结果；**数值/规则不符** = 数值、关键词、目标、区域与卡面不一致。每行是缺口摘要，完整缺失列表见 [审计报告](card-fidelity-audit.md) 与 [card-fidelity-findings.csv](card-fidelity-findings.csv)。

### 核心包（23 张：调查员 2、支援 6、事件 2、技能 1、诡计 2、敌人 1、地点 8、密谋 1；本轮已修复 23）

- [x] `01002` **黛西·沃克**（调查员，中）— 「如果你检定成功」这一前提没有实现：检定失败也会按书籍数抽牌（而且现有测试把这个错误行为固定了下来）  
  证据：src/cards/entries/01002.js:12（optionalDraw = countControlled Tome）；src/engine/tests.js:565-594（旧印分支内直接 prompt+drawCards，早于 ST.6 的成败判定）
- [x] `01003` **“倒霉蛋”奥图尔**（调查员，低）— 限额数值与卡面不符：卡面是「每回合仅限一次」，实现是「每轮仅限一次」——同一轮内该调查员若再次获得回合（额外回合类效果），卡面允许再用一次而实现不允许  
  证据：src/cards/card-effects.js:150-153（limit: 'round'）；src/engine/moves.js:243-247（上架条件用 state.round）
- [x] `01009` **死灵之书**（支援，低）— 「死灵之书上有恐惧时不能离场」：威胁区卡没有不可离场检查（removeThreat 无守卫）  
  证据：src/cards/entries/01009.js:15；src/engine/weakness.js:257-272
- [x] `01019` **急救**（支援，低）— 「伤害或恐惧」的选择权归控制者：实现为被治疗者自己选  
  证据：src/cards/entries/01019.js:13-30；src/engine/effects.js:332-343
- [x] `01031` **智慧古书**（支援，低）— 「将其抽取」被实现为「直接加入手牌」：绕过抽牌管线（无 draw 触发）  
  证据：src/cards/entries/01031.js:12-18；src/engine/card-ops.js:193-229
- [x] `01055` **飞贼**（支援，低）— 同一个条目级 noOpportunityAttack 也被 dispatch.js:207-213 的 playFlag() 读成「打出这张卡时不引发借机攻击」；卡面只豁免那个 [action] 行动，打出资产本应正常引发借机攻击  
  证据：src/cards/entries/01055.js:10-17；src/engine/dispatch.js:203-213
- [x] `01063` **新晋术士**（支援，低）— 找到的法术是「加入手牌」而不是「抽取」：card-ops.js:221-227 直接 inv.hand.push，绕过 drawCards，因此不会结算抽到弱点、也不会触发「抽到牌时」的规则；搜索可被跳过：card-ops.js:216 canSkip: !effect.mandatory，而 01063 未声明 mandatory；卡面没有「可以选择不拿」；「入场后」只在 doPlay 里读（actions.js:179/184）；由其它效果直接放入场的路径不会放毁灭标记  
  证据：src/cards/entries/01063.js:10-24；src/engine/actions.js:168-186
- [x] `01117` **丽塔·钱德勒**（支援，低）— 卡面的 +1 伤害是 [reaction]（可选），实现为无提示自动生效，玩家无法拒绝；entries/01117.js:14 的 condition:{ controllerHasNoThreat: '02088' } 把「盟友文本被抹消」硬编码成单一卡号；通用 sourceBlanked 钩子（engine.js:126-132 + card-rules.js:20-26）已覆盖同一情形，是重复且未来会漏的写法（核心战役内行为无差异）  
  证据：src/cards/entries/01117.js:14-16；src/engine/assets.js:40-47
- [x] `01010` **在逃中**（事件，中）— 反击（Retaliate）与警戒（Alert）等非敌人阶段/非借机攻击路径的敌人攻击没有被禁止  
  证据：src/cards/entries/01010.js:15-24；src/engine/effects.js:269-273
- [x] `01068` **记忆抹消**（事件，低）— 额外效果：抹消文本后立刻 autoEngageAt()（harm-threat.js:362 → engine.js:570-581），把该地点所有「可自动交战」的敌人（含刚被抹消的冷漠敌人）直接拉入交战；卡面没有这条，且 'engage' 行动本身并不检查冷漠（moves.js:675-682），因此这段自动交战不是「抹消后能交战」的必要替代实现  
  证据：src/cards/entries/01068.js:11-21；src/engine/harm-threat.js:351-364
- [x] `01081` **求生本能**（技能，中）— 「解除交战」被实现成「自动躲避」：额外把这些敌人横置了（卡面只解除交战，不横置，敌人应保持直立）；提示/日志文案随实现漂移成「躲避所有其他交战敌人」，与卡面「解除交战」不一致；tests/core-special-acceptance.test.mjs:133-138 本意是断言「不会横置敌人」，但选择器写的是 source==='survivalInstinct.disengage'，实际提示 source 是 'survivalInstinct'，settle 回落成 skip，该分支从未被测试覆盖  
  证据：src/cards/entries/01081.js:13；src/engine/combat.js:401-411
- [x] `01011` **医院债务**（诡计，中）— [free] 的时机/费用：实现成花 1 个行动点的行动，且会引发借机攻击；没有行动点时无法付债  
  证据：src/cards/entries/01011.js:15；src/engine/moves.js:382-384
- [x] `01167` **地窖寒风**（诡计，低）— 「如果你不能」的判定依据是「你身上有没有支援」，而不是「你有没有可弃掉的支援」：当调查员只控制无法离场的支援（assetCannotLeavePlay，见 assets.js:233-234）时，弃牌被静默跳过，也不会改为受到 2 点伤害。参考实现用的是 DiscardableAsset 过滤后再决定是否造成伤害（CryptChill.hs:22-28）。  
  证据：content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js:155-159；src/engine/treachery-tokens.js:132-142
- [x] `01121b` **假面猎手**（敌人，低）— 「与假面猎手交战时不能花费线索」对玩家卡描述子的线索费用（cost.clues）不生效：装备/事件能力的线索费用在交战中仍可支付（ability-rules.js:52、57-60 与 219-223 未接 canSpendClues）。可达性：核心牌池里没有任何带 cost.clues 的玩家卡（全库只有 02302、04154 两张，src/cards/entries/02302.js:14、04154.js:14），因此只有用非核心牌池自组卡组时才会被触发，严重度按 low 记。  
  证据：content/campaigns/nightOfTheZealot/scenarios/theMidnightMasks/definition.js:134-139；src/engine/actions-extra.js:357-363
- [x] `01134` **北区**（地点，低）— 关卡重开时未重置 team-game 使用标记：新一局北区能力仍被判为已使用（单次通关内行为正确）  
  证据：content/campaigns/nightOfTheZealot/scenarios/theMidnightMasks/definition.js:99-105；src/engine/actions-extra.js:365-376
- [x] `01150` **阿卡姆密林 · 邪恶之地**（地点，中）— connections 与印刷符号不符：应为 mainPath/cliffside/oldHouse，实际 mainPath/twistingPaths/quietGlade；卡面特性 [Woods] 缺失  
  证据：content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:27-33；content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:29
- [x] `01151` **阿卡姆密林 · 扭曲的道路**（地点，中）— connections 与印刷符号不符：应为 mainPath/oldHouse/tangledThicket，实际 mainPath/unhallowedGround/quietGlade；卡面特性 [Woods] 缺失  
  证据：src/cards/encounter-abilities.js:191-201；src/engine/movement.js:107-115
- [x] `01152` **阿卡姆密林 · 老屋**（地点，中）— connections 与印刷符号不符：应为 mainPath/unhallowedGround/twistingPaths，实际 mainPath/cliffside/tangledThicket；卡面特性 [Woods] 缺失  
  证据：content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:40-46；src/engine/moves.js:258-264
- [x] `01153` **阿卡姆密林 · 悬崖边**（地点，中）— connections 与印刷符号不符：应为 mainPath/quietGlade/unhallowedGround，实际 mainPath/oldHouse/tangledThicket；卡面特性 [Woods] 缺失  
  证据：content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:47-53；content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:52
- [x] `01154` **阿卡姆密林 · 一团乱麻**（地点，中）— connections 与印刷符号不符：应为 mainPath/twistingPaths/quietGlade，实际 mainPath/oldHouse/cliffside；卡面特性 [Woods] 缺失  
  证据：content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:54-60；content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:59
- [x] `01155` **阿卡姆密林 · 静谧空地**（地点，中）— connections 与印刷符号不符：应为 mainPath/tangledThicket/cliffside，实际 mainPath/unhallowedGround/twistingPaths；卡面特性 [Woods] 缺失  
  证据：content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:61-67；src/engine/moves.js:266-269
- [x] `01156` **仪式地**（地点，中）— 印刷连线只有「主道路」一条；quietGlade / tangledThicket 两条多余连线改变了地图可达性与 act 2 的进入路线；卡面特性 [Cave] 未落到 definition / 运行期地点实例  
  证据：content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:68-73；content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js:70
- [x] `01107` **他们爬出来了！**（密谋，低）— 唯一偏差：reveal.js:228 在强制移动之后额外调用 autoEngageAll，把刚走进调查员所在地点的食尸鬼立刻变为交战状态；卡面只写了「移动一个地点」，而交战应在敌军阶段的「敌人交战」步骤结算（该步骤在本强制触发前已结束），因此这些食尸鬼应保持未交战直到下一个敌军阶段。  
  证据：content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js:89-92；src/engine/reveal.js:216-228

### 敦威治遗产（40 张：支援 11、事件 10、地点 13、幕 2、密谋 2、场景参考 2；本轮已修复 40）

- [x] `02006` **佐伊的十字架**（支援，低）— 伤害目标没有锁定为「刚刚与你交战的那个敌人」；同地点有多个交战敌人时可改选另一个，且触发器携带的 context.enemy 被丢弃  
  证据：src/cards/entries/02006.js:12-17；src/engine/effects.js:199-207
- [x] `02036` **弯刀**（支援，中）— 时机错误：卡面是「检定成功后」才可支付这 1 行动；实现改为检定前预付，失败也照样扣行动（可造成多花 1 行动却毫无收益）  
  证据：src/cards/entries/02036.js:14；src/engine/combat.js:95-98
- [x] `02040` **亨利·阿米蒂奇博士 / Dr. Henry Armitage**（支援，低）— 只应保留单一实现（重复询问）；条目版缺少「不能获得资源」时不可触发的门槛（02097 交战中仍可支付成本却拿不到 3 资源）  
  证据：src/cards/entries/02040.js:11-24；content/campaigns/theDunwichLegacy/encounter-rules.js:59-67
- [x] `02061` **沃伦·莱斯教授**（支援，中）— +1[intellect] 被叠加成 +2；同一能力存在两份声明（entries 描述子 + 剧本钩子），只有一份应当保留  
  证据：src/cards/entries/02061.js:15-17；content/campaigns/theDunwichLegacy/encounter-rules.js:47-52
- [x] `02080` **佛朗西斯·摩尔根博士**（支援，中）— +1[combat] 被叠加成 +2；条目与剧本钩子重复声明同一能力  
  证据：src/cards/entries/02080.js:15-17；content/campaigns/theDunwichLegacy/encounter-rules.js:47-52
- [x] `02140` **死灵之书 (The Necronomicon)**（支援，中）— 数值不符：印张 +1[intellect]，实机 +2[intellect]；「[action]：获得2资源」被实现两遍：条目 abilities 里一次（entries/02140.js:17-22，api.gainResources 直加资源，绕过 canGainResources 限制），关卡 actions() 里又一次（later-behaviors.js:986、1147-1149，且尊重「不能获得资源」限制）→ 玩家会看到同名两个行动，且其中一个能在博物馆大门(02126)/绿洲(02097)这类禁止获得资源的状态下照加资源  
  证据：src/cards/entries/02140.js:12-22；content/campaigns/theDunwichLegacy/encounter-rules.js:49
- [x] `02188` **孤狼**（支援，低）— 构筑/在场限制「每位调查员仅限 1 张」未落实（deckLimit=2，无文本解析）  
  证据：src/cards/entries/02188.js:12-18；src/engine/turn.js:299-303
- [x] `02217` **西布伦·沃特雷**（支援，低）— 重印遭遇组（striking_fear / nightgaunts / ancient_evils）的诡计意志检定成功后不触发抽牌（例如 UAU 里的「腐烂的尸体」01163 别名 rottingRemains）  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:684-692（result.source?.type==='encounter' && state.scenario.treacheries[result.source.code]）；src/engine/treachery-tokens.js:84、101（source.code = t.originalCode || t.code）
- [x] `02230` **幸运骰子**（支援，中）— 「非 [auto_fail] 标记」的使用前提未校验（可对 autofail 重抽）；新标记为 [auto_fail] 时应从游戏中移除，实现是进弃牌堆  
  证据：src/cards/entries/02230.js:12-19；src/engine/tests.js:470-489
- [x] `02234` **黑马**（支援，低）— 构筑/在场限制「每位调查员仅限 1 张」未落实  
  证据：src/cards/entries/02234.js:11；src/engine/phases.js:124-137
- [x] `02302` **威廉·T·马尔森博士**（支援，低）— 取消的遭遇卡应混洗回遭遇牌库（现在进遭遇弃牌堆）  
  证据：src/cards/entries/02302.js:12-16；src/engine/encounter.js:78-95
- [x] `02017` **嘲讽**（事件，低）— 「任意数量」被实现成「全部」：无法只交战其中一部分（例如只想交战 1 个、放过带反击/警戒的敌人）  
  证据：src/cards/entries/02017.js:12-16；src/cards/player-effects.js:50-55
- [x] `02018` **团队合作**（事件，中）— 「任意数量」：每次打出只能转移 1 张支援或 1 点资源（不能一次给多张/多点）；「彼此之间/交易」：不能反向索取、不能多边交换（其他调查员之间的互相给与无法表达）  
  证据：src/cards/entries/02018.js:10；src/cards/player-effects.js:56-72
- [x] `02019` **嘲讽（升级版）**（事件，低）— 「任意数量」被实现成「全部」：抽牌数随之固定为该地点全部可交战敌人数，玩家无法选择少交战几个（从而少抽牌）  
  证据：src/cards/entries/02019.js:16-21；src/cards/player-effects.js:50-54
- [x] `02023` **寻找答案**（事件，低）— 没有任何连接地点带线索时，回退成一次普通调查（player-effects.js:77 doInvestigate），成功照旧在本地点发现线索；卡面要求「改为在连接地点发现」，此时应当一个线索都不发现  
  证据：src/cards/entries/02023.js:10；src/cards/player-effects.js:74-86（第 77 行回退）
- [x] `02025` **逃跑本能**（事件，低）— 多人局：敌人若「未交战地在你的地点生成」（engagedSeat 为空）且同地点有 2 名调查员，只有 leadDecisionSeat 那位会被提供这张快速事件；同地点的其他调查员打不出来，与卡面「生成在你的地点」不符  
  证据：src/cards/entries/02025.js:14；src/engine/enemies.js:203-210
- [x] `02031` **困兽之笼**（事件，中）— 失败时的后果被加强：phases.js:107-109 除了弃掉困兽之笼，还让该敌人立刻发动一次攻击（卡面只写「弃掉困兽之笼」，重整后正常进行，不应追打）；只能选择非精英敌人发起（player-effects.js:106 先过滤 !enemy.elite）；卡面是「检定成功后若为非精英才躲避并附属」，对精英本可正常躲避失败/成功但不附属  
  证据：src/cards/entries/02031.js:12；src/cards/player-effects.js:105-123
- [x] `02113` **哎呀！**（事件，低）— 「本次攻击的伤害」被近似为 1 + damageBonus（combat.js:280 → player-effects.js:144），对用 damageOverride/固定伤害的攻击（如某些武器/效果）会算错；未校验被攻击的敌人是「与你交战」的敌人：对与另一名调查员交战的敌人失手时也能打出  
  证据：src/cards/entries/02113.js:12-25；src/engine/combat.js:274-291
- [x] `02184` **最坏的打算**（事件，低）— 找到武器后必须加入手牌（卡面没有「可以放弃」的选项），实现给了 skip 分支  
  证据：src/cards/entries/02184.js:13；src/engine/card-ops.js:193-229
- [x] `02228` **暴露弱点**（事件，低）— 成功差值为 0 时不应降低（卡面是「每超过难度 1 点降 1 点」）  
  证据：src/cards/entries/02228.js:11-16；src/cards/player-effects.js:202-218
- [x] `02266` **杀手锏**（事件，中）— 打出时机限制「只能在你回合期间打出」（缺 playCondition:[ownTurn()]）  
  证据：src/cards/entries/02266.js:10-17；src/engine/play-condition.js:26-73
- [x] `02052` **宿舍**（地点，中）— 未揭示状态下不能移动进入宿舍（这条门禁缺失后，玩家可以在未控制爵士的情况下进宿舍拿 R2，绕开 Act 2 的爵士主线）  
  证据：src/cards/cards-data.js:159138-159139 (backText 印刷文字)；content/campaigns/theDunwichLegacy/card-data.js:30-35 (location() 丢弃 backText)
- [x] `02054` **教师办公室**（地点，中）— 未揭示状态下不能移动进入教师办公室（可在 Act 1 直接进去付 2×人数线索拿 R1，跳过爵士线）  
  证据：content/campaigns/theDunwichLegacy/scenarios/extracurricularActivity/behavior.js:48-60；content/campaigns/theDunwichLegacy/scenarios/extracurricularActivity/behavior.js:178-182, 224-226
- [x] `02055` **教师办公室（另一版）**（地点，低）— 未揭示状态下不能移动进入教师办公室（本变体唯一一条印刷规则）  
  证据：content/campaigns/theDunwichLegacy/scenarios/extracurricularActivity/behavior.js:24-32；src/cards/cards-data.js:159316 (text 为空、backText 为门禁)
- [x] `02057` **炼金实验室**（地点，中）— 未揭示状态下不能移动进入炼金实验室  
  证据：content/campaigns/theDunwichLegacy/scenarios/extracurricularActivity/behavior.js:161-165, 200-211；src/cards/cards-data.js:159435 (02057 backText)
- [x] `02129` **保安室 (Security Office)**（地点，低）— 查看结果缺少 shroud / clues / victory 等卡面数值信息（只泄露名称与规则文字）  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:992-997；content/campaigns/theDunwichLegacy/later-behaviors.js:1139-1146
- [x] `02205` **火灾废墟（版本二）**（地点，中）— 翻面后的毁灭标记不参与密谋推进结算（应计入场上毁灭总数），本卡的惩罚实际无效  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:703-707（clues--; doom++）；src/engine/rules-state.js:33-46（agendaDoom 只返回 state.doom；totalDoom 注释说明「never by the agenda threshold check」）
- [x] `02208` **自治教堂（版本一）**（地点，低）— 卡面只允许从遭遇牌库检索；实现把遭遇弃牌堆也算作可检索范围（弃牌堆里的类人敌人也能被找出并生成）  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:455-478（第 456 行 trait 表、第 459 行同时遍历 encounterDeck/encounterDiscard、第 474-477 行取牌并 spawn 到 location02201）
- [x] `02211` **芦苇屋（版本二）**（地点，低）— 卡面只允许从遭遇牌库检索；实现把遭遇弃牌堆也算作可检索范围  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:455-478（456 行 '02211':'Nightgaunt'，459/474 行含弃牌堆）；src/engine/card-lookup.js:19-29、63-64（别名 huntingNightgaunt 可由 ALL_ENEMIES 解析，生成路径正常）
- [x] `02214` **隐藏密室**（地点，中）— 卡面胜利点 2 被结算成 4（胜利区 2 + 地点区 2 重复计入），每位调查员因此多拿 2 点经验  
  证据：src/engine/locations.js:101（revealLocation 末尾调用 awardLocationVictory）；src/engine/locations.js:212-224（awardLocationVictory：clues<=0 时 state.victory+=victory 且 push 进 victoryDisplay）
- [x] `02282` **山脚 / Base of the Hill**（地点，中）— 「调查」行动身份：调查专属加值（investigateBonus）不参与本次检定；「成功调查后 / 调查失败后」反应窗口（如米兰·克里斯托弗 01033、搜刮 01073）不触发；调查行动的地点限制/校验（investigationError）不生效  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:1081-1084；content/campaigns/theDunwichLegacy/later-behaviors.js:1293-1302
- [x] `02283` **上山道路 / Ascending Path**（地点，中）— 「调查」行动身份：investigateBonus（放大镜/报纸）不参与本次检定；『成功调查后 / 调查失败后』反应窗口不触发  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:1081-1084；content/campaigns/theDunwichLegacy/later-behaviors.js:1293-1302
- [x] `02287` **被毁的道路 / Destroyed Path**（地点，低）— 「调查」行动身份（调查专属加值与成功后反应不生效）  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:1085-1086；content/campaigns/theDunwichLegacy/later-behaviors.js:1281-1284
- [x] `02324` **空间裂缝 / Tear Through Space**（地点，低）— Surge 触发条件过宽：非抽取（从弃牌堆放入场）路径也会额外抽一张遭遇卡  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:861-875；content/campaigns/theDunwichLegacy/later-behaviors.js:345
- [x] `02123` **博物馆之夜 (Night at the Museum)**（幕，中）— 「放置」时未解除原有交战（应像 relocateEnemy 一样在调查员不在地点时 disengage）；未走地点变更的统一入口，enemyMoved 钩子（如 02096 变异野兽、02329 类卡）不会触发  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:876-884；content/campaigns/theDunwichLegacy/later-behaviors.js:1432-1445
- [x] `02124` **强行闯入 (Breaking and Entering)**（幕，中）— 「放置」时未解除原有交战（同 02123 的共用缺陷）；未走统一的地点变更入口，相关钩子不触发  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:876-884；content/campaigns/theDunwichLegacy/later-behaviors.js:1432-1445
- [x] `02063` **四叶草俱乐部**（密谋，中）— 罪犯敌人移动（含自身狩猎移动）后仍应保持冷漠；现在只有入场那一刻有冷漠  
  证据：content/campaigns/theDunwichLegacy/scenarios/theHouseAlwaysWins/behavior.js:32-41；content/campaigns/theDunwichLegacy/scenarios/theHouseAlwaysWins/behavior.js:115-118
- [x] `02239` **恐惧爆发**（密谋，低）— 位于冷泉幽谷（02244/02245）的异形敌人只吃到 -1 躲避，本密谋的 +1 躲避被吞掉（应为 -1+1=0）  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:537-543（enemyStatModifier 依次 return：02244/02245 的 -1 提前返回）
- [x] `02159` **疯狂列车 (Essex County Express)**（场景参考，低）— 「立刻结束你的回合」被近似为「失去所有剩余行动」，未置 turnEnded  
  证据：content/campaigns/theDunwichLegacy/dunwich-chaos.js:55-68；content/campaigns/theDunwichLegacy/dunwich-chaos.js:149-158
- [x] `02274` **毁灭之地 / Where Doom Awaits（场景卡）**（场景参考，低）— 3–4 名调查员时线索奖励应为 2 个（当前恒为 1 个）  
  证据：content/campaigns/theDunwichLegacy/later-behaviors.js:98；content/campaigns/theDunwichLegacy/story-text.js:90

### 卡尔克萨之路（88 张：调查员 3、支援 14、事件 13、诡计 8、敌人 13、地点 21、幕 8、密谋 8；本轮已修复 88）

- [x] `03002` **潘明**（调查员，低）— 旧印「把投入的技能牌返回其所有者手牌」被限定为检定成功才可发动；卡面没有成功前提（对比 03005 约里克的卡面明写 if successful，同一引擎代码路径被套用到所有 onSuccess 条款）  
  证据：src/cards/entries/03002.js:14（returnCommittedSkill: true）；src/engine/tests.js:780-794（success 前置）
- [x] `03003` **赛菲娜·卢梭**（调查员，中）— 「弃掉其余卡牌」被实现成「洗回牌库」：起始手牌多出来的牌应当进弃牌堆（影响弃牌堆内容与相关效果），现在仍留在牌库；旧印的「抽下方事件」被额外加上「检定成功」前提（失败时不能抽）  
  证据：src/engine/table-decisions.js:296-318（第 316 行把余牌 shuffle 回 deck）；src/engine/setup.js:115-125（起手 13，弱点换抽）
- [x] `03006` **萝拉·海耶斯**（调查员，低）— 旧印的「切换角色」被限定为检定成功才可发动；卡面没有成功前提  
  证据：content/packs/carcosaInvestigators/manifest.js:53-64（elderSign onSuccess、freeAction）；src/cards/entries/03006.js:16（返回 onSuccess）
- [x] `03107` **战斗训练**（支援，低）— 「[[沉稳]] 卡牌场上仅限 1 张」未实现：全仓只有 teamLimit（按同名卡计数）与 playRestriction（仅 04010 的 noReadyEnemy），没有「场上沉稳卡数量」限制  
  证据：src/cards/entries/03107.js:14-19；src/engine/harm-threat.js:125-128
- [x] `03109` **科学理论**（支援，低）— 「[[沉稳]] 卡牌场上仅限 1 张」未实现（引擎无对应读点）  
  证据：src/cards/entries/03109.js:12-17；src/engine/harm-threat.js:125-128
- [x] `03111` **刚毅果敢**（支援，低）— 「[[沉稳]] 卡牌场上仅限 1 张」未实现（引擎无对应读点）  
  证据：src/cards/entries/03111.js:12-17；src/engine/harm-threat.js:125-128
- [x] `03112` **大卫·伦费尔德**（支援，低）— 「你可以」被实现成必须放置：卡面允许不放毁灭，且即使不放也应结算「每有 1 毁灭得 1 资源」  
  证据：src/cards/entries/03112.js:12-26；src/engine/modifiers.js:189
- [x] `03113` **情绪稳定**（支援，低）— 「[[沉稳]] 卡牌场上仅限 1 张」未实现（引擎无对应读点）  
  证据：src/cards/entries/03113.js:10-15；src/engine/treachery-tokens.js:234-241
- [x] `03115` **有胆有识**（支援，低）— 「[[沉稳]] 卡牌场上仅限 1 张」未实现（引擎无对应读点）  
  证据：src/cards/entries/03115.js:10-17；src/engine/harm-threat.js:125-128
- [x] `03141` **皮博迪先生**（支援，中）— 被选地点直到皮博迪重整为止获得 -1 隐藏值（整条效果缺失）  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:303-316；content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:190-194
- [x] `03147` **双刃短刀**（支援，中）— 「你执行的交战行动不会触发趁乱攻击」完全没有实现：全仓没有交战行动免趁乱攻击的字段/读点，engage 行动在 actionKind 里仍返回 'engage'（会引发趁乱攻击）  
  证据：src/cards/entries/03147.js:12-25；src/engine/table-decisions.js:236（engage 未被豁免）
- [x] `03149` **查尔斯·罗斯大人**（支援，中）— 被动付款被错误地绑定在「横置折扣标记」上：charlesPayCandidate 要求对方资产存在 itemDiscountAtLocation（即必须先用过 [free] 能力）才会代付，卡面两段能力互相独立；代付没有校验卡型：actions.js 的 payer 选择对任意类型卡都生效，卡面只允许代付 [[道具]] 支援；代付不是可选（资源不足时自动由查尔斯支付）  
  证据：src/cards/entries/03149.js:12-18；src/engine/turn-flow.js:394-423
- [x] `03151` **达里奥·埃尔阿明 / Dario El-Amin**（支援，中）— 『如果你所在地点没有敌人』这一前置条件完全未实现  
  证据：src/cards/entries/03151.js:10-16；src/engine/modifiers.js:341-346
- [x] `03193` **古代雕文（预言 / Archaic Glyphs）**（支援，低）— 『你可以』的选择权：自动躲避被实现为强制  
  证据：src/cards/entries/03193.js:14-18；src/engine/actions.js:377-384
- [x] `03195` **扒窃 / Pickpocketing**（支援，中）— 『检定成功且超过难度至少2点：改为执行以上两项』——上下文没有 successBy，分支永不进入  
  证据：src/cards/entries/03195.js:16-25；src/engine/combat.js:381-385
- [x] `03266` **奥术洞察 / Arcane Insight**（支援，低）— 上限口径：perRound 而非 perTurn  
  证据：src/cards/entries/03266.js:16-18；src/engine/limits.js:31-47
- [x] `03271` **新晋术士 / Arcane Initiate**（支援，中）— 『强制』关键字：入场后必须放 1 毁灭或 2 恐惧，现在可拒绝  
  证据：src/cards/entries/03271.js:14-27；src/engine/ability-rules.js:89-99
- [x] `03012` **画中世界**（事件，中）— 以 resolve-only 描述子实现的事件（如 03026 殚精竭虑、03033 解锢灵魂、03034 星界旅行）不出现在复制候选中，卡面「任意非卓越事件」被缩窄；同一原因：非快速、只用 resolve 实现的事件永远无法被复制  
  证据：src/cards/entries/03012.js:13；src/engine/moves.js:164-174
- [x] `03022` **“放着我来！”**（事件，中）— 「结算该卡显现效果时你每项技能 +2」完全没落地：encounter.js 读 redrawContext.redirectBonus，但全仓没有任何代码写 redirectBonus（03022 的 resolve 只调用 redirectEncounter 并打日志），handlingEncounter.bonus 恒为 0；额外限制：反应窗口要求 inv.location === context.location（encounter.js:201，卡面没有位置限制），异地的调查员无法接手  
  证据：src/cards/entries/03022.js:14-19；src/engine/encounter.js:78-99
- [x] `03029` **障眼戏法**（事件，低）— 用「以 0 费打出」近似「放置入场」：会触发打出类效果/日志算作打出，卡面并非打出；卡面「快速。只能在你回合期间打出」没有 playCondition（同批 03018 有，03029 漏）  
  证据：src/cards/entries/03029.js:14-24；src/engine/api-clue.js:99-105
- [x] `03038` **藏身地点**（事件，中）— 「每个非精英敌人获得冷漠」不是持续效果：只对之后生成/移入该地点的敌人生效；打出时已经在场的敌人不会获得 aloof（turn-flow.js 只在 enemy spawn/relocate 调用）；附属目标被缩窄为「已揭示的地点」，卡面是任意地点  
  证据：src/cards/entries/03038.js:16-21；src/cards/entries/_shared.js:36-47
- [x] `03148` **埋伏**（事件，低）— 「被附属地点没有调查员就弃掉」是持续条件，实现只在敌军阶段结束时检查一次（玩家在调查阶段离开地点时不会立刻弃掉）  
  证据：src/cards/entries/03148.js:15-21；src/engine/turn-flow.js:156-163
- [x] `03150` **预先警告 / Forewarned**（事件，低）— 『你』抽到——缺少 selfOnly 限定，同地点队友也会被允许打出  
  证据：src/cards/entries/03150.js:15-16；src/engine/encounter.js:201-202
- [x] `03153` **灵力风暴 / Storm of Spirits**（事件，中）— 攻击目标的选择（自动锁定第一个交战敌人）；storm 分支不写 enemy.defeatedBy、不触发 scenarioBehavior.enemyDamaged  
  证据：src/cards/entries/03153.js:13-19；src/engine/combat.js:147
- [x] `03189` **“同归于尽！” / "I'll see you in hell!"**（事件，中）— 1点肉体创伤没有真正入账（写入 dead field，不进战役创伤）  
  证据：src/cards/entries/03189.js:15-21；src/engine/api-card.js:199-207
- [x] `03199` **诱捕陷阱 / Snare Trap**（事件，低）— 『每个地点仅限1张』的限制  
  证据：src/cards/entries/03199.js:17-23；src/cards/entries/_shared.js:38-47
- [x] `03238` **不期而遇 / A Chance Encounter**（事件，中）— X 费用（按所选盟友印刷费用支付）被当成 0  
  证据：src/cards/entries/03238.js:13-15；src/engine/api-misc.js:298-312
- [x] `03239` **应急物品 / Emergency Cache**（事件，低）— 补给标记无法拆分到多个支援（只能全部给一张）  
  证据：src/cards/entries/03239.js:13-32
- [x] `03263` **追猎行动 / On the Hunt**（事件，中）— 『改为』的替代关系：原本抽到的遭遇卡不应再结算（现在会额外结算一张遭遇）  
  证据：src/cards/entries/03263.js:15-27；src/engine/encounter.js:85-99
- [x] `03306` **遗觉记忆 / Eidetic Memory**（事件，低）— 多出来的 fast 关键字（卡面没有快速，实际不消耗行动）  
  证据：src/cards/entries/03306.js:15；src/engine/lifecycle.js:64-70
- [x] `03090` **黑星升起**（诡计，低）— 放置毁灭后立即检查当前密谋的毁灭阈值（可能立即推进）  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:363-379；src/engine/act-agenda.js:264-277
- [x] `03097` **黄衣之王之舞**（诡计，中）— 应选距离调查员最近的[[附身]]敌人（相同时才由玩家选）；逐地点移动（经过的地点/途经触发会不同）  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:414-429；content/campaigns/thePathToCarcosa/encounter-rules.js:28-40（distance 工具已存在但未用于 03097）
- [x] `03100` **王之法令**（诡计，低）— 无论本次是否移动线索，本轮内每个异教徒都按身上的线索+毁灭获得 +1 攻击  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:430-444；content/campaigns/thePathToCarcosa/encounter-rules.js:80-86
- [x] `03105` **苍白面具的呼唤**（诡计，中）— 苍白面具下的男子不在场时：搜索其承受者的牌库与弃牌堆，找出并抽取他；然后混洗其承受者的牌库（承受者已退场时也要在全部场外区域里搜索）  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:480-485；content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js:31-37
- [x] `03146` **邪教的搜查**（诡计，中）— 查找范围少了“遭遇弃牌堆”；毁灭搬到密谋后没有立即检查议程推进（绕过 addDoom/checkAgenda）  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:369-386；src/engine/act-agenda.js:304-312（addDoom→checkAgenda）
- [x] `03224` **致命运数**（诡计，低）— 攻击你的应是刚弃掉的那张敌人（当前可从弃牌堆任选）  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:486-518；content/campaigns/thePathToCarcosa/encounter-rules.js:509-516
- [x] `03261` **身后暗影**（诡计，低）— [action]只应由该威胁区的控制者本人执行（当前同地点其他调查员也能代为执行）  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:249-254；content/campaigns/thePathToCarcosa/encounter-rules.js:321-325
- [x] `03338` **疯狂领域**（诡计，低）— X=0 时不提供「可以弃牌以避免 2 点恐惧」的选择  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:611-641
- [x] `03017` **墓地食尸鬼**（敌人，中）— 锁定只覆盖 searchDiscard、弃牌堆洗回、弃牌堆顶打出（温蒂护身符）与约里克从弃牌堆打支援；「技能检定成功从弃牌堆取回卡牌」（如本分片的 03039 急中生智）与 recruitAllyFromDiscard 等路径完全不检查 discardLocked，交战时仍能把牌拿出弃牌堆；因此与同一分片 03039 形成直接矛盾：与墓地食尸鬼交战时急中生智仍可从弃牌堆回手  
  证据：src/cards/entries/03017.js:13；src/engine/card-lookup.js:63-88
- [x] `03059` **苍白面具下的男子**（敌人，低）— 「生成-距离所有调查员最远的地点」没有通用实现：三处出现都由剧本脚本指定生成点（curtainCall behavior.js:176、thePallidMask behavior.js:264、dimCarcosa behavior.js:321），若将来由通用效果生成会退化为默认地点  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:235-239；content/campaigns/thePathToCarcosa/encounter-rules.js:285-295
- [x] `03067b` **石丸春子（附身）**（敌人，中）— 非攻击效果对石丸春子造成伤害后抽取遭遇牌库顶 1 张  
  证据：content/campaigns/thePathToCarcosa/scenarios/theLastKing/definition.js:19；content/campaigns/thePathToCarcosa/scenarios/theLastKing/behavior.js:279-291
- [x] `03068b` **塞巴斯蒂安·莫罗（附身）**（敌人，低）— 该敌人的攻击不能被取消  
  证据：content/campaigns/thePathToCarcosa/scenarios/theLastKing/definition.js:20；src/engine/enemies.js:112-119
- [x] `03086` **迅捷的拜亚基**（敌人，中）— 移动终点应为猎物所在地点（当前是任意调查员所在地点）  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:179-190；src/engine/turn.js:133-157（hunterMove 调用点与 skipAttackRound 消费点）
- [x] `03088` **毕宿五的野兽**（敌人，中）— 攻击伤害/恐惧的“先填满单张卡再分给下一张”强制分配限制  
  证据：content/campaigns/thePathToCarcosa/card-data.js:87-121；src/engine/enemies.js:189
- [x] `03140` **附身宣誓者**（敌人，中）— 免伤条件应为 actIndex < 2（幕 1/幕 2），实现成了 agendaIndex < 2（议程 1/议程 2）  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:149-151；content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:162-175
- [x] `03144` **卡尔克萨探求者**（敌人，中）— 强制时机应为“神话阶段结束”，实现在回合末；生成应为“任意无人历史协会地点”由玩家选择，实现为随机限定上层楼并固定数量；线索被直接吞掉而不是放到敌人身上（当前因议程翻面规则未实现而结果恰好等价）  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:176-182；content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:128-143
- [x] `03182b` **丹尼尔·契斯特菲尔德（敌人面）**（敌人，低）— Prey - Highest [combat] 未被登记（definition 没有 prey 字段，引擎 preyTarget 拿不到规则）  
  证据：content/campaigns/thePathToCarcosa/card-data.js:22-26；content/campaigns/thePathToCarcosa/card-data.js:87-121
- [x] `03184` **阴魂不散的病人**（敌人，中）— Prey - 剩余神智最高（未配置）；“攻击时”改为“造成伤害时”才触发恐惧  
  证据：content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:302-306；content/campaigns/thePathToCarcosa/card-data.js:22-26
- [x] `03258` **地下墓穴讲师**（敌人，低）— 「查看揭示面」应包含该地点的帷幕/线索/卡面效果（当前只有名字与卡号）  
  证据：content/campaigns/thePathToCarcosa/encounter-rules.js:303-320；content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:344-355（03252 的完整版本，对照）
- [x] `03300` **潮汐骇物**（敌人，中）— 生成地点「晋升之门或圣奥伯特礼拜堂」（二选一）  
  证据：content/campaigns/thePathToCarcosa/card-data.js:87-121（无 spawn 字段）；content/campaigns/thePathToCarcosa/encounter-rules.js:87-123
- [x] `03333` **哈斯塔（卡尔克萨领主）**（敌人，中）— 猎物「剩余神智值最高」；攻击造成恐惧超过神智值时额外受到 1 点伤害；无剩余神智值时 +1/0/-1/[elder_sign] 视为 [auto_fail]  
  证据：content/campaigns/thePathToCarcosa/card-data.js:101-108；src/engine/enemies.js:176-197（prey 只来自 def.prey，这条卡没有）
- [x] `03052` **后台**（地点，中）— 位于后台时，手牌中的每张隐私（Hidden）遭遇卡按 3 张计算手牌上限  
  证据：content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js:91-99；content/campaigns/thePathToCarcosa/scenarios/curtainCall/definition.js:34
- [x] `03134` **历史协会（阅览室）**（地点，中）— 「团队每轮仅限一次」限制缺失（每轮可无限次把敌人毁灭换线索，直接绕过 03121-03123 的毁灭压力）  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:254-257；content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:288-302
- [x] `03139` **隐藏的图书馆**（地点，低）— 条件（仅当敌人移动时）被去掉，改成了常驻连接  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/definition.js:26；content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/definition.js:51
- [x] `03172` **厨房**（地点，中）— 未揭示时“不能进入厨房”的禁令（及幕 2 之后“忽略未揭示面文字”的解除）  
  证据：content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:187-193；content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/definition.js:58
- [x] `03174` **医务室**（地点，低）— 「每轮仅限一次」限制缺失  
  证据：content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:359；content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:402-413
- [x] `03175` **后院**（地点，中）— 调查后院时的隐藏值 +1/每点恐惧（整条缺失）  
  证据：content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:337-389（无 locationShroudModifier）；src/engine/actions.js:321
- [x] `03176` **花园**（地点，中）— 未揭示时“不能进入花园”的禁令  
  证据：content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:187-193；content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:364-368
- [x] `03177` **地下室走廊**（地点，中）— 未揭示时“不能进入地下室走廊”的禁令  
  证据：content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:187-193；content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js:194-206
- [x] `03211` **大木偶剧场**（地点，中）— 洗牌这一步（当前抽回同样的牌）；只洗入非弱点手牌（当前连弱点也一起洗）  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:265-281；src/engine/deck-ops.js:345-357（牌库顶 = pop()）
- [x] `03215` **拉雪兹神父公墓**（地点，低）— 多名调查员同一轮成功调查时各自被锁（当前只有一个槽位）；效果性移动也应被禁止（引擎只在调查阶段查询 movementError）  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:187-190；content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:192-197
- [x] `03216` **圣马丁运河**（地点，低）— 每轮上限应按调查员各自计算（当前全队共一次）  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:209-222；content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:386-391（03208 按 seat 计数的对照写法）
- [x] `03218` **玛黑区**（地点，低）— 多名调查员同一轮进入时各自被锁（当前只有一个槽位）；效果性移动也应被禁止  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:198-208；content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:282-287
- [x] `03219` **巴黎圣母院**（地点，中）— 位于巴黎圣母院的每个敌人 -1 攻击、+1 躲避  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/definition.js:21；content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:410-413
- [x] `03250` **埋骨洞窟**（地点，中）— 手部槽位 -1 只应作用于「调查该地点时」（当前是站在该地点期间常驻）  
  证据：content/campaigns/thePathToCarcosa/scenarios/thePallidMask/definition.js:20-22；src/engine/movement.js:177
- [x] `03254` **狭窄竖井**（地点，中）— 检定只应在目的地是未揭示地点时触发（当前对任何移动都触发）  
  证据：content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:235-241；content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:19-20（方向上/右）
- [x] `03256` **堵塞通道**（地点，中）— 本轮不能离开堵塞通道  
  证据：content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:253-257；content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:400-407（03246 忽略该强制）
- [x] `03257` **暗影坟墓**（地点，低）— 「位于暗影坟墓时」应为持续判定（当前只在生成时结算一次，离开不撤销、之后进场不补）  
  证据：content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:242-248；content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:294-304
- [x] `03284` **环山大道**（地点，低）— 「毁灭标记数量相等时，选择其中一个」——并列时固定选 a 牌堆  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:432-442；src/engine/actions.js:336（investigate 的 source.label='调查'）
- [x] `03288` **北部塔楼**（地点，低）— 「技能检定」范围：只降了调查（帷幕）难度，其它技能检定不降  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:400-404；src/engine/actions.js:321
- [x] `03290` **垮塌的台阶**（地点，中）— 第一个选项应是「弃掉一个你控制的支援」（现在被换成「失去 1 个行动」且不弃支援）  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:408-417；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:418-430
- [x] `03291` **修道院教堂**（地点，中）— 场上有两张编号不同的密谋时 +2 隐藏值；进入修道院教堂需在垮塌的台阶共同支付 3[per_investigator] 线索  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:199-203；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:204-209（无 abbeyChurch 线索费用）
- [x] `03124` **追寻答案**（幕，中）— 「增加 1[per_investigator] 个线索」被实现为「设为至少 N」，上限误用 N 而非地点线索值（03133/03136/03137 的 2/人 线索值被少给）  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:195-199；content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/definition.js:53-61
- [x] `03125` **昔日恶果**（幕，中）— 同样的线索加法/上限错误（见 03124）  
  证据：content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js:196-210
- [x] `03206` **闻风追影**（幕，低）— 可以由同地点的另一位调查员放置他/她自己的线索（当前只允许攻击者本人）  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:361-380；src/engine/combat.js:263（enemyAttackedSuccessfully 调用点）
- [x] `03245` **逃出生天**（幕，中）— 以真实的地狱之门(03247)所在地点为基准（醒来开局时基准错误）；「如果地狱之门在场」的前置判定  
  证据：content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:138-153（醒来开局把 03247 洗入牌库、catacomb0 为随机码）；content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js:168-209（catacomb0 = plan.startCode）
- [x] `03321a` **搜寻陌生人(版本一)**（幕，中）— 「每位调查员均不能发现线索」  
  证据：src/engine/locations.js:162-163（钩子存在）；content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:351-364（只有 confrontStranger）
- [x] `03322a` **搜寻陌生人(版本二)**（幕，中）— 「每位调查员均不能发现线索」；背面「哈斯塔视为在场但不在任何地点」（现在被放到王之宫殿）  
  证据：content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:329-332；content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:422-430
- [x] `03323a` **搜寻陌生人(版本三)**（幕，中）— 「每位调查员均不能发现线索」；「除因伤害外不能被击败」（版本三分支缺失，[action] 能力可击败）  
  证据：content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:422-430；content/campaigns/thePathToCarcosa/encounter-rules.js:285-294
- [x] `03324` **褴褛之王**（幕，中）— 翻面能力只在幕 3（03324）在场时可用（现在幕 1/2 就能用）  
  证据：content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:376-388；content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js:401-411
- [x] `03203` **第三夜**（密谋，低）— 「推进到场景2b」应直接结算场景2背面（当前等价于推进当前幕，场景1未完成时会走错）  
  证据：content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:347-350；src/engine/act-agenda.js:38-63（advanceAct 翻当前幕背面后 actIndex++）
- [x] `03275` **浪潮汹涌**（密谋，中）— 确认/疑惑阈值：卡面 ≥3 毁灭记疑惑，实现为 ≥4；「当前 c 密谋不是 1c → 不记任何确信和疑惑」；「团队每轮仅限一次」上限  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:105-112；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:295-304
- [x] `03276a` **风暴肆虐**（密谋，中）— 「将放在一边的场景 3a 卡牌从游戏中移除」；「你的目标在其他密谋牌库中」（wrongRoute 标志为死代码，走错路线无法完成幕3）  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:113-123；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:91-97
- [x] `03276b` **风暴肆虐**（密谋，低）— 「将本密谋牌库从游戏中移除」（未移除，密谋仍可推进到 3a 并触发 R3）  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:113-123；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:124-126
- [x] `03278` **仪式开始**（密谋，中）— 确认/疑惑阈值（≥3 应为疑惑，实现为 ≥4）；「当前 a 密谋不是 1a → 不记任何确信和疑惑」；「团队每轮仅限一次」  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:105-112；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:295-304
- [x] `03279a` **悬空之物**（密谋，中）— 「每个[[怪物]]敌人得到+1攻击」对 c 牌堆密谋永不生效；「团队每轮仅限一次」上限；背面「将放在一边的场景 3c 卡牌从游戏中移除」；背面「你的目标在其他密谋牌库中」（wrongRoute 为死代码，走错路线无法完成幕3）  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:387-393；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:295-304
- [x] `03279b` **悬空之物**（密谋，中）— 怪物敌人 +1 攻击（c 牌堆密谋读点缺失）；团队每轮仅限一次；背面「将本密谋牌库从游戏中移除」（未移除，密谋仍可推进到 3c 并触发 R3）  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:387-393；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:295-304
- [x] `03280` **天空失陷**（密谋，中）— 「每个[[怪物]]敌人得到+1攻击」  
  证据：content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:387-393；content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js:124-126

### 失落的时代（84 张：调查员 2、支援 21、事件 11、技能 3、诡计 11、敌人 11、地点 11、幕 2、密谋 9、场景参考 1、故事 2；本轮已修复 84）

- [x] `04002` **厄休拉·唐斯**（调查员，低）— 旧印的「检定结束后可移动到连接地点」被限定为检定成功；卡面写的是「after this test ends」，失败也应能移动  
  证据：src/cards/entries/04002.js:14（mayMoveAfterTest: true）；src/engine/tests.js:758-767（success 前置）
- [x] `04244` **伊斯人身体**（调查员，中）— 印刷的神智 7 未应用：调查员仍用自己人类卡的神智上限（例如黛西 9、罗兰 5），而生命已按要求改成 7；content/campaigns/theForgottenAge 下没有任何 maxSanity/baseSanity 赋值，剧本也没有别处补这个数值；「[reaction] …」被实现成强制且无选择：固定翻倍本次检定第一张被投入的牌，玩家不能选择翻倍哪一张，也没有反应窗口；盟友的[[伊斯]]特性只在 assetEntered 时补写，已在场的盟友不会获得（本关开局会清场，实际影响很小）  
  证据：content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js:209-221（盟友特性 / 旧印 +2 抽 1）；content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js:246-262（四属性 2、maxHealth/baseHealth=7，无 maxSanity）
- [x] `04008` **杰克·威廉斯**（支援，中）— 免借机攻击只应有一次（移动或调查二选一，不是各一次）  
  证据：src/cards/entries/04008.js:11；src/cards/entries/04008.js:14-15
- [x] `04017` **求生匕首**（支援，低）— 反应的时机限制（仅敌军阶段）  
  证据：src/cards/entries/04017.js:13-27；src/engine/enemies.js:349-376
- [x] `04022` **古代巨石**（支援，中）— 记录的是检定结果值，不是检定难度  
  证据：src/cards/entries/04022.js:14-17；src/engine/actions.js:362-376
- [x] `04026` **彩饰骷髅**（支援，中）— 「你所在地点的调查员被击败」触发；「你所在地点的盟友支援被击败」触发；触发被实现为「你击败的敌人」且不校验敌人是否在你所在地点；卡面没有的 oncePerPhase 上限  
  证据：src/cards/entries/04026.js:17-31；src/engine/enemies.js:306-311
- [x] `04029` **拉莱耶迷雾**（支援，中）— 本次躲避尝试揭示符号或 auto_fail 时，从手牌选择并弃掉 1 张卡  
  证据：src/cards/entries/04029.js:17-28；src/engine/combat.js:339-377
- [x] `04051` **亚历山卓·维拉（Alejandro Vela）**（支援，中）— +1 技能的适用面被放大：卡面只限「调查[[古代]]地点」，实现覆盖战斗/躲避/意志等所有检定  
  证据：src/cards/entries/04051.js:9；src/cards/entries/04051.js:17
- [x] `04107` **幸运烟盒**（支援，中）— 触发范围：任意技能检定成功超出 2 点（实现只在调查成功时）  
  证据：src/cards/entries/04107.js:13-16；src/engine/encounter.js:280
- [x] `04108` **销赃贩子**（支援，低）— 反应的可选性：无法选择不横置销赃贩子  
  证据：src/cards/entries/04108.js:11；src/cards/campaign-plugin.js:410-444
- [x] `04147` **伊塔卡**（支援，中）— 「攻击带有胜利X的敌人时改为 +2[combat]」没有任何实现：modifiers.js 的 conditionalStats 只支持 doomAtLeast / resourcesAtLeast / remainingSanityAtMost，没有按目标敌人的 victory 提高属性的路径；「尝试躲避带有复仇X的敌人时改为 +2[agility]」同样没有实现  
  证据：src/cards/entries/04147.js:9-19（只有被动 +1/+1 与一个标记字段，modifiers 为空）；src/engine/modifiers.js:320-351（可用的条件修正维度清单：doom/resources/剩余神智/资产数/连接数）
- [x] `04191` **古代遗物**（支援，低）— [fast]（快速触发）的时机没有实现：现在只能在行动阶段当行动用，神话/敌人阶段等玩家窗口里无法使用（真正的 [fast] 应可在任意玩家窗口触发）  
  证据：src/cards/entries/04191.js:11-44（kind: 'action' + cost.action:false）；src/engine/ability.js:360-365（只有 kind 'free' 匹配 player 窗口）
- [x] `04235` **远古印记结晶**（支援，中）— 封印选择：只能封印 [elder_sign]，没有「+1」选项  
  证据：src/cards/entries/04235.js:10-11；src/cards/cards-data.js:212576（卡面：Seal (+1 or [elder_sign])）
- [x] `04267` **养神术**（支援，中）— 技能图标错误：实现检定意志，卡面检定智识（影响能否用本卡、成功概率与联动卡）；卡面没有「没有秘密就弃掉」，实现的 discardWhenEmpty 是额外条款  
  证据：src/cards/entries/04267.js:8；src/cards/entries/04267.js:14
- [x] `04270` **骷髅钥匙**（支援，中）— 「已经附属在你所在地点 → 解除附属并放回游戏区域」整条分支；由此导致卡牌一旦附属就永久留在该地点  
  证据：src/cards/entries/04270.js:10-11；src/cards/entries/04270.js:20-24
- [x] `04271` **拉莱耶迷雾**（支援，中）— 本次躲避尝试 +3 [willpower]；揭示 skull/cultist/tablet/elder_thing/auto_fail 时从手牌弃 1 张  
  证据：src/cards/entries/04271.js:19-27；src/engine/combat.js:329-341
- [x] `04276` **古旧锈剑**（支援，中）— 蓄力斩伤害数值：应为 4（1+3），实现为 3  
  证据：src/cards/entries/04276.js:22；src/cards/cards-data.js:214981（卡面：This attack deals +3 damage）
- [x] `04303` **古代遗物 / Relic of Ages**（支援，中）— [fast] 被实现成消耗 1 个行动（卡面只需横置，不花行动）；检定技能只有意志，缺「或智识」的二选一；「移除场上任一卡牌上的 1 个毁灭」只能选密谋或地点，敌人/支援/附属上的毁灭不可选  
  证据：content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:349-356（actions 里无 actions 字段）；content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:376-388（api.test(..., 'willpower', 4, ...)，无技能选择）
- [x] `04304` **煤油**（支援，中）— 没有限定只能治疗 [[盟友]] 支援（非盟友支援也会出现在选项里）；只能单目标任务治愈 2 点，不能把 2 点拆分到多个目标  
  证据：src/cards/entries/04304.js:18-38；src/engine/api-clue.js:54-57
- [x] `04305` **火焰喷射器**（支援，中）— 伤害分配由引擎轮流 1 点，玩家无法自行分配（含分配上限 4 点）；「任意额外伤害加到总额」未实现（额外伤害被丢弃）  
  证据：src/cards/entries/04305.js:16-22；src/engine/combat.js:227-248
- [x] `04307` **纳克特手稿**（支援，中）— 行动费用：[action] 被实现为免费能力；目标：不能选择同地点其他调查员（只作用于自己）  
  证据：src/cards/entries/04307.js:16-21；src/engine/turn-flow.js:462-470
- [x] `04308` **时间借取**（支援，低）— 「本行动不会触发趁乱攻击」未声明（玩这个动作会被交战敌人打）  
  证据：src/cards/entries/04308.js:15；src/engine/turn-flow.js:462-470
- [x] `04310` **虚空碎裂**（支援，低）— 「花费 1 充能 或 释放一个封印标记」被实现成固定优先级，玩家无法二选一；无目标时先付费后报错  
  证据：src/cards/entries/04310.js:21-39；src/engine/combat.js:184-194
- [x] `04010` **走私货物**（事件，中）— 若查找了牌库，结算后应将走私货物洗回牌库（而不是进弃牌堆）  
  证据：src/cards/entries/04010.js:13；src/cards/entries/04010.js:17-34
- [x] `04028` **“交给你了！”**（事件，低）— 目标范围：只要同地点有人，就不能把遭遇卡交给别处的调查员  
  证据：src/cards/entries/04028.js:14-30；src/engine/api-misc.js:358-366
- [x] `04038` **黑暗契约**（事件，中）— 强制条款：游戏结束或你退场时，若黑暗契约仍在手牌，则从牌库移除并加入失败的代价  
  证据：src/cards/entries/04038.js:11-20；src/engine/weakness.js:99-108
- [x] `04105` **劝服**（事件，低）— 精英分支跳过 [intellect] 检定（应检定成功后才自动躲避）  
  证据：src/cards/entries/04105.js:14-36；tests/tfa-player-acceptance.test.mjs:484-493
- [x] `04111` **坚韧不拔**（事件，低）— 打出前提：该次伤害/恐惧必须足以击败你  
  证据：src/cards/entries/04111.js:13-25；src/engine/enemies.js:349-357
- [x] `04152` **去伪存真**（事件，低）— 目标应为可承载秘密的支援；不应把秘密当通用 uses 加到只有充能的支援上  
  证据：src/cards/entries/04152.js:12-27；src/engine/matcher.js:172-174
- [x] `04193` **特制弹药**（事件，低）— 只能附属自己控制的枪械，不能选同地点其他调查员的枪械；「只能在你回合期间打出」未声明（引擎只允许当前回合玩家打牌，实践上等价，但无显式限制）  
  证据：src/cards/entries/04193.js:11-15；src/engine/actions.js:110-125
- [x] `04195` **暴露弱点**（事件，中）— 「将该敌人的攻击值视为0」被近似成「减去成功点数」；成功后抽取 1 张卡牌（整条缺失）  
  证据：src/cards/entries/04195.js:15；src/cards/player-effects.js:202-218
- [x] `04232` **悄然遁去**（事件，中）— 触发条件「成功且超过难度至少 2 点」未实现（任何成功都生效）；「非精英」限制未实现（精英敌人也会被阻止重整）  
  证据：src/cards/entries/04232.js:20；src/engine/combat.js:366-367
- [x] `04233` **收获日**（事件，低）— 多出未印刷的「不引发趁乱攻击」  
  证据：src/cards/entries/04233.js:13；src/engine/dispatch.js:207-213
- [x] `04306` **有利位置**（事件，中）— 效果目标错误：应作用于刚入场/被揭示的地点，而不是打出者所在地点；缺少「地点入场或被揭示后」的时机限制（任何时间都能打）  
  证据：src/cards/entries/04306.js:10-26；src/engine/api-clue.js:77-80
- [x] `04153` **参透真谛**（技能，中）— 可投入范围过窄：非「遭遇诡计」的冒险卡能力检定不能投入；成功后的「发现 1 个线索」只在调查检定里生效，其它检定成功不产生线索  
  证据：src/cards/entries/04153.js:14；src/engine/tests.js:188-189
- [x] `04155` **职业杀手**（技能，低）— 只有攻击伤害会 +1，「下次受到伤害（任意来源）」未覆盖；有效期按 round 而非 turn  
  证据：src/cards/entries/04155.js:13；src/engine/combat.js:221-222
- [x] `04157` **如痴如醉**（技能，低）— 缺少「调查期间」限制：战斗/躲避/冒险能力检定成功也会给充能或秘密  
  证据：src/cards/entries/04157.js:13；src/engine/skill-effects.js:124-161
- [x] `04007` **血的代价**（诡计，中）— 二选一的玩家选择权：只要场上有盟友，就再也不能选「弃光手牌盟友」  
  证据：src/cards/entries/04007.js:10；src/engine/weakness.js:157-186
- [x] `04040` **厄运降临**（诡计，低）— 剧本日志记录（改为调查员内部计数器）  
  证据：src/cards/entries/04040.js:11；src/engine/weakness.js:130-137
- [x] `04041` **被诅咒的命运**（诡计，低）— 剧本日志记录（改为调查员内部计数器）  
  证据：src/cards/entries/04041.js:10；src/engine/weakness.js:139-145
- [x] `04090` **时间裂缝（A Tear in Time）**（诡计，低）— 0 行动时被强制改为受恐惧（卡面允许选失去行动）  
  证据：content/campaigns/theForgottenAge/encounter-rules.js:592-611
- [x] `04091` **困于时间（Lost in Time）**（诡计，低）— 伤害/恐惧被当成直接伤害/恐惧结算（应可正常分配到其它支援）  
  证据：content/campaigns/theForgottenAge/encounter-rules.js:613-630；src/engine/scenario-runtime.js:127-128,176-183
- [x] `04094` **一片漆黑（Deep Dark）**（诡计，低）— 上限不是硬上限：单次多线索发现不受 1 个/地点/轮的裁剪  
  证据：content/campaigns/theForgottenAge/encounter-rules.js:310-327；content/campaigns/theForgottenAge/encounter-rules.js:791-806
- [x] `04096` **阴影笼罩**（诡计，低）— X 用的是敌人卡面的基础攻击值（`target.fight`），而不是结算时的攻击值；例如刚被放上毁灭的 04095（每毁灭 +1 战斗）应当是 3 而不是 2，引擎里已存在 enemyFightValue 但此处没用  
  证据：content/campaigns/theForgottenAge/encounter-rules.js:670-684（difficulty = target.fight）；src/cards/encounter-abilities.js:162-165（04095 战斗值随毁灭变化）
- [x] `04100` **毒蛇召来（Serpent's Call）**（诡计，低）— 中毒的目标被改成任意调查员（卡面固定是「你的威胁区域」）  
  证据：content/campaigns/theForgottenAge/encounter-rules.js:697-714；src/engine/treachery-tokens.js:70-117（resolveEncounter 入口，inv 就是抽卡者）
- [x] `04144` **密不可泄**（诡计，低）— 「险境」没有落到这次意志检定上：其他调查员仍可为它投入卡牌/使用协助能力（险境要求只能由抽到它的调查员独自结算，且不能使用快速反应事件）  
  证据：content/campaigns/theForgottenAge/scenarios/threadsOfFate/behavior.js:909-922（04144 结算，api.test 未传 peril）；src/engine/scenario-runtime.js:184（test: (seat, skill, difficulty, resolve, skillBonus, source) —— 无 peril 通道）
- [x] `04228` **无路可退 / No Turning Back**（诡计，低）— 【近似替代】「你带有鹤嘴锄」按同地点任一调查员拥有判定（应为本人补给）  
  证据：content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js:269-316（附属与弃卡）；content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js:310（checkSupplies 作用域）
- [x] `04342` **黑暗隐伏 / Creeping Darkness**（诡计，低）— 「你带有火把」按「同地点任一调查员有火把」判定；两张以上黑暗隐伏时，后生成的无形之子只获得一份 +1[每名调查员] 生命（应每副本各一份）  
  证据：content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:811-830（显现）、:947-962（952-957 生成时只加一次）、:860-899（火把判定 890）；content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:656-680（scenarioAction 版的火把判定 671）
- [x] `04052` **伊塔卡（Ichtaca）**（敌人，低）— 多了一条未印刷的「猎物：线索最多」数据，影响她与谁交战  
  证据：content/campaigns/theForgottenAge/card-data.js:172；src/engine/enemies.js:189
- [x] `04079` **蟒蛇（Boa Constrictor）**（敌人，中）— 禁重整的时机整体晚一轮（「下一个补给阶段」应是同轮 upkeep，而不是下一轮 upkeep）  
  证据：content/campaigns/theForgottenAge/encounter-rules.js:267-269；src/engine/phases.js:78-79
- [x] `04084` **幽嘶蛇人（Serpent from Yoth）**（敌人，中）— 三条条件只在生成瞬间求值，之后胜利区复仇变化不更新（反击/猎手/减伤会漏或错）；减伤对非攻击伤害也生效（卡面限定 each attack made against it）  
  证据：content/campaigns/theForgottenAge/encounter-rules.js:217-222；src/cards/campaign-state.js:79-80
- [x] `04086` **埃兹特里的守卫者（Eztli Guardian）**（敌人，中）— 生成时的[[古代]]地点优先约束（有古代无人地点时不得选其他地点）  
  证据：src/engine/encounter.js:118-135；src/cards/cards-data.js 对应的定义入口 content/campaigns/theForgottenAge/card-data.js:179
- [x] `04095` **兄弟会异教徒**（敌人，中）— 攻击未命中（或伤害被取消/为 0）时不放毁灭——而卡面是「发动一次攻击时」就放；毁灭应在发动攻击时放置，从而本次攻击的战斗值就 +1（难度提高 1）；现在延到伤害结算之后才放，本次攻击不吃这项修正；同一阶段内两次独立攻击只放 1 个毁灭（去重键是「轮次+阶段」，不是「每一次攻击」）  
  证据：src/cards/encounter-abilities.js:155-166（每毁灭 +1 战斗/躲避，由引擎通用读取）；content/campaigns/theForgottenAge/encounter-rules.js:241-255（enemyDamageAllowed 里放毁灭 + round/phase 去重）
- [x] `04186` **帕德玛·阿姆丽塔**（敌人，中）— 帕德玛重整时，古代地点卡自己的「发现线索」效果仍可发现线索：04174 的击败/躲避反应（behavior.js:536-544）、04175/04177/04178/04184 的行动（behavior.js:565-615）都直接搬线索，不查 canDiscoverClues  
  证据：content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/behavior.js:771-775（canDiscoverClues：只在这里挡帕德玛）；content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/behavior.js:426-433（discoverAt 直改 location.clues + api.gainClues）
- [x] `04188` **兄弟会之手**（敌人，低）— [reaction] 能力没有被挡住：04174 的「击败/躲避蛇族后发现 1 线索」（behavior.js:536-544、845-854）、04179 的「抽到巫术卡牌后发现 1 线索」（behavior.js:836-842）在兄弟会之手重整时仍会触发；「最后一个线索被发现」只在引擎的调查发现路径上触发（src/engine/locations.js:157-203 -> notifyCluesRemoved）；古代地点自己用 discoverAt 搬线索时不发通知，所以由 04174/04175/04177/04178/04184 的效果取走最后一枚线索时不会放毁灭  
  证据：content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/behavior.js:777-802（actions 里 readyHandAt 直接返回空表，只挡 [action]）；content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/behavior.js:836-854（04179 / 04174 的反应路径没有 readyHandAt 检查）
- [x] `04219` **绝命噬藤 / Apex Strangleweed**（敌人，低）— 【近似替代】「你没有折叠小刀」按「同地点任一调查员有折叠小刀」判定（应为本人补给）；多人分头携带补给时结果不同  
  证据：content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js:361-371（enemyAttackResolved + checkSupplies）；src/cards/campaign-plugin.js:86-90（checkSupplies = 同地点任一调查员）
- [x] `04220` **蛇怪 / Basilisk**（敌人，中）— 「猎物 - 距离昆扬之口最近的调查员」：引擎不认这个猎物，实际退化为「任意/最近调查员由队长选择」，与卡面的固定目标不同（对多调查员局的交战对象与猎手路线有实际影响）  
  证据：content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js:343-349（写入 enemy.preySeat）；content/campaigns/theForgottenAge/card-data.js:189-190（04219/04220 的 ENEMY_RULES）
- [x] `04298` **深渊吞噬者 / Eater of the Depths**（敌人，中）— 生命值被额外 +当前深度（印刷生命 6；卡面的 X 只对应躲避值）  
  证据：content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/definition.js:19-28（'04298': { evade: 0 }）；content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:475-484（481 evade += depth、482 health += depth）
- [x] `04337` **无形之子 / Formless Spawn**（敌人，中）— 生命值随联结点的毁灭标记增加（卡面只加攻击值/躲避值，印刷生命 10）  
  证据：content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:975-979（未按 stat 过滤）；content/campaigns/theForgottenAge/card-data.js:192-193（'04337': { immobile: true }）
- [x] `04064` **华美石室（Grand Chamber）**（地点，中）— 「翻 1 个线索」实际翻 2 个（线索≥2 时），毁灭标记数量与卡面不符  
  证据：content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/behavior.js:309-316；content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/behavior.js:345-353
- [x] `04070` **河流峡谷（River Canyon）**（地点，中）— 无法治愈同在河流峡谷的其他调查员（治疗目标被限制为行动者本人）  
  证据：content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js:248-254；content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js:196-198
- [x] `04073` **曲折小道（Circuitous Trail）**（地点，中）— 「调查」时的额外费用（无指南针必须花 3 资源）完全没实现  
  证据：content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js:107-114；content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js:263-274（对照：另一章实现了调查侧）
- [x] `04126b` **阿卡姆警察局**（地点，低）— 卡面要求「混洗你的牌库」（整副牌），现在只把搜索过的牌洗过、牌库其余部分顺序不变  
  证据：content/campaigns/theForgottenAge/scenarios/threadsOfFate/behavior.js:1049-1073；src/engine/deck-ops.js:357（牌库顶 = 数组末尾，故 slice(-6) 的取法本身正确）
- [x] `04206` **昆扬之口 / Mouth of K'n-yan**（地点，低）— 【近似替代】「如果你带有指南针」按同地点任一调查员拥有判定（应为本人补给）  
  证据：content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js:460-463,500-539（两条行动与牌序处理）；content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js:501（checkSupplies 作用域）
- [x] `04206b` **昆扬之口（深藏其下）/ Mouth of K'n-yan**（地点，低）— 【近似替代】「如果你带有地图」按同地点任一调查员拥有判定（应为本人补给）  
  证据：content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js:553-561,596-615；content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js:597（checkSupplies 作用域）
- [x] `04227` **深入幽嘶 / Descent to Yoth**（地点，中）— 【近似替代】[reaction]「成功调查后，可不发现线索，改为把 1 个毁灭翻到线索面」→ 实现为额外的 1 行动 + 再次智识检定，时机、花费与「替换发现线索」的语义都不符  
  证据：content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js:551-553（注释承认替代）；content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js:562-568（actions: 1 的 flipDescentDoom）
- [x] `04286` **幽嘶的阶梯 / Steps of Yoth**（地点，中）— 补给判定按「同地点任一调查员有绳索」而不是「该调查员自己带着绳索」，导致选出的持有者可能没有绳索；crossOffSupply 失败时不会改选真正持有人（反应被白白浪费，深度不增加）  
  证据：content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:204-241（211-213 选 holder、227 crossOffSupply、232-234 失败分支）；src/cards/campaign-plugin.js:59-61（hasSupply 才是「本人」）、86-90（checkSupplies = 同地点任一调查员）
- [x] `04291` **分岔路 / Forked Path**（地点，低）— 「继续抽直到抽出 2 个连接地点」被近似为「只补抽 1 张」；首次探索翻到诡计时不再继续抽牌（卡面要求继续抽到 2 个连接地点）；地图按「同地点任一调查员」判定，不是本人补给  
  证据：content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:286-305（afterExplore 的 forkedPath 分支）；content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:291（kind !== 'location' 先 return）、:921-947（只翻 1 处）
- [x] `04293` **坍塌的通道 / Broken Passage**（地点，低）— 「如果你没有鹤嘴锄」按「同地点任一调查员有鹤嘴锄」判定（应为探索者本人）  
  证据：content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:264-284（269-276）；src/cards/campaign-plugin.js:86-90（checkSupplies 作用域）
- [x] `04295` **光耀峡谷 / Bright Canyon**（地点，低）— 「如果你带有双筒望远镜」按队友（甚至异地的队友）持有来开门，而不是本人补给  
  证据：content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:339-347（全队任意位置检查）、:360-375（checkSupplies 同地点检查）；src/cards/campaign-plugin.js:86-90（checkSupplies 作用域）
- [x] `04119` **来到展厅**（幕，中）— 额外 1[per_investigator] 线索的条件写反：应为「场上有 2 本或更少的场景牌库」（length <= 2），现在是「2 本或更多」（>= 2），三本幕牌库俱在时也加  
  证据：content/campaigns/theForgottenAge/scenarios/threadsOfFate/behavior.js:362-368（04119 的 reveal）；content/campaigns/theForgottenAge/scenarios/threadsOfFate/behavior.js:381（04120 用 <= 2）
- [x] `04243` **回归自我 / Repossession**（幕，低）— 【近似替代】追加抽牌的条件在抽牌前判定（卡面是先抽 2 张、再按当时手牌是否超上限 +1）  
  证据：content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js:439-447,549-557（抽取行动与顺序）；content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js:128-138,715-719（观测者猎手/不再冷漠）
- [x] `04044` **荒野探险（Expedition into the Wild）**（密谋，中）— 伊格之子第 2、3 张与伊格的诅咒第 2 张从未进入「放在一边」，也不会被洗入遭遇牌库（遭遇牌库少 3 张）  
  证据：content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js:341-345；content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js:59-61
- [x] `04045` **入侵者（Intruders）**（密谋，低）— 额外把中毒弱点放进威胁区域（卡面只写「加入牌库」）；被击败者的创伤被丢弃（defeatCause=null），与同一措辞的 04056 处理不一致  
  证据：content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js:358-372；src/engine/campaign-flow.js:242-252
- [x] `04055` **暗起波澜（Something Stirs…）**（密谋，低）— 强制条款没有实现（依赖一个未实现的引擎基础规则才碰巧得到卡面结果）  
  证据：src/engine/act-agenda.js:174-205（尤其 :184-187）；content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/behavior.js:265-273
- [x] `04207` **丛林之心 / The Jungle's Heart**（密谋，低）— 【近似替代】「瞭望员带有双筒望远镜」按同地点任一调查员拥有判定（应为瞭望员本人补给）  
  证据：content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js:591-616（背面结算）；content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js:604（checkSupplies 作用域）
- [x] `04238` **伟大种族之城 / City of the Great Race**（密谋，低）— 【近似替代】「不能将[[道具]]支援放置入场」只覆盖「打出」与剧本 playAsset 两条路径，其它直接放入场（giveAsset / 技能或剧情效果）以及道具弱点进场未拦截  
  证据：content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js:361-365（canPlayCard）；content/campaigns/theForgottenAge/scenarios/theCityOfArchives/definition.js:142-145（isItemAsset：type=asset 且 traits 含 Item）
- [x] `04239` **失去的记忆 / Lost Memories**（密谋，低）— 【近似替代】「每位带有挂坠的调查员」按同地点共享判定，会把效果发给同地点没有挂坠的调查员  
  证据：content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js:735-746（2b 结算）；content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js:739（checkSupplies 作用域）
- [x] `04280` **无尽洞窟 / Endless Caverns**（密谋，低）— 「该侦查员检查自己的补给品」按「同地点任一调查员有绳索」判定（应为侦查员本人）  
  证据：content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:601-627（612 行判定、617-625 检定与创伤）；src/cards/campaign-plugin.js:59-61（hasSupply 才是「本人」）、86-90（checkSupplies = 同地点任一调查员）
- [x] `04283` **赤红深渊 / The Red Depths**（密谋，中）— 持久效果「直到本场冒险结束，当前密谋获得：放置毁灭后 → 放出最高躲避的追击敌人」在 04283 推进后失效（04284 上每次放毁灭都不再触发）；「将本卡牌放到追击区域，本面朝上，作为提醒」未实现（追击区没有这张提醒卡）  
  证据：content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:666-680（doomPlaced 只认 04282/04283）；content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js:686-702（roundEnded 注释自认 04283 的强制已只由 doomPlaced 逐次结算）
- [x] `04316` **垂下的丝线 / Pendulous Threads**（密谋，低）— 胜利区里的无形之子被放到遭遇牌库顶而不是洗入（下一次遭遇必定抽到它）  
  证据：content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:1169-1175（append 到 encounterDeck）；src/engine/encounter.js:76（state.encounterDeck.pop() 抽牌，尾部=牌库顶）
- [x] `04113` **命运之线**（场景参考，中）— 困难/专家面 [skull] 的 X 漏算当前密谋上的毁灭（state.doom）与威胁区域卡牌上的毁灭，与「场上的毁灭标记总数」不符  
  证据：content/campaigns/theForgottenAge/tfa-chaos.js:44-47（doomInPlay 的统计范围）；content/campaigns/theForgottenAge/tfa-chaos.js:82-90（threadsOfFate 标记表）
- [x] `04325b` **伊格的宽恕 / Yig's Mercy**（故事，低）— 「[[蛇族]]敌人不与你交战，也不攻击你」近似为「之后生成的蛇族带 aloof」，已落场的蛇族与交战后的攻击都不受限制  
  证据：content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:1322-1366（parley 剧情分支）；content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:947-962（enemySpawned 里用 aloof 近似）
- [x] `04326b` **另有他法 / Another Way**（故事，低）— 「[[异教徒]]敌人不与你交战，也不攻击你」近似为「之后生成的异教徒带 aloof」  
  证据：content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:1367-1392；content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:947-962（:960 cultistPassive → aloof）

---

## 每张卡的门禁（AGENTS.md 固定流程）

```bash
# 改行为前
node tools/replay-fixtures.mjs --baseline artifacts/card-before.json
# 改卡/改行为
npm run cards:check
node tools/replay-fixtures.mjs --compare artifacts/card-before.json   # 证明行为零变化（非行为改动则应全绿）
npm run test:fast
node tools/audit-abilities.mjs --write
```

- 行为改动若要改变结果（修 bug 而不是重构），先更新/新增对应断言，再重采 golden replay：`npm run replay:fixtures:write`，并在 PR 说明里写清行为差异。
- 修完后回到本文件勾选，并同步 [审计报告](card-fidelity-audit.md) 的“结论速览”计数（或重跑大厅的 `artifacts/card-fidelity-audit/report.mjs` 与 `write-docs.mjs` 覆盖本文件与报告）。

## 统计口径

- 范围：核心包 185 + 敦威治 333 + 卡尔克萨 383 + 失落时代 361 = 1,262 张（含玩家卡、调查员、弱点、敌人、诡计、地点、幕/密谋、场景参考、故事卡）。
- 审计原始结论：259 张未完全实现（部分实现 118 / 简化近似 101 / 数值规则不符 39 / 整卡不可达 1）；P0 的 24 张与本轮 P2/P3 的 235 张已修复，本文件剩余 0 张。
- 已剔除 2 条误报：03329a/03329c（`/\bFast[. ]/` 实际匹配卡表 299 处 `Fast.`）。
- 主进程已复核 27 条高/中严重度发现（卡号见报告 §2.2）；其余以子任务证据为准，建议修前先抽查。
