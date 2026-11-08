// player-auditor-a：生成 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/findings.json
// 证据格式：相对 mod 根（games/arkhamhorror/）的 path:line
import fs from 'node:fs'

const C = (text, status, evidence, note = '') => ({ text, status, evidence, ...(note ? { note } : {}) })
const I = (severity, dimension, summary, evidence, suggestion) => ({ severity, dimension, summary, evidence, suggestion })
const P = (status, evidence, note = '') => ({ status, evidence, ...(note ? { note } : {}) })
const T = (status, evidence, note = '') => ({ status, evidence, ...(note ? { note } : {}) })

const E = n => `src/cards/entries/${n}.js`

const cards = []
const add = (code, name, nameZh, verdict, clauses, perceivability, tests, issues = []) =>
  cards.push({ code, name, nameZh, verdict, accepted: verdict === 'match' && !issues.some(i => i.severity === 'high'), clauses, perceivability, tests, issues })

// ── 08019 Geared Up ─────────────────────────────────────────────────────────
add('08019', 'Geared Up', '全副武装', 'match', [
  C('Permanent. Limit 1 per deck. Purchase at deck creation.', 'implemented',
    'src/cards/cards-data.js: 08019 permanent:true, deckLimit:1；src/engine/setup.js:339（permanent 循环开局自动入场）；src/engine/deckbuilding.js:82（deckLimit 计入 cardLimit）。购入时机为构筑层概念，无运行时行为。'),
  C('Forced - When your first turn of the game begins: ...', 'implemented',
    `${E('08019')}:22-28（kind forced + trigger turnBegins + round===1 && currentSeat===inv.seat && 本卡在场）；引擎窗口 src/engine/turn.js:532（context 带 seat）。`),
  C('One at a time, play any number of [[Item]] assets from your hand, reducing the cost of each by 1.', 'implemented',
    `${E('08019')}:15-16,30-45（逐张 api.choice + api.playCardFromHandFree{noAction:true,discount:1}）；api: src/engine/api-misc.js:836-843（discount 传给 doPlay 支付）。`),
  C('During this turn, you have 3 fewer actions to take.', 'implemented',
    `${E('08019')}:46-47（api.loseActions(seat,3)）；api: src/engine/api-misc.js:303。`),
], P('perceivable', `${E('08019')}:33-40 逐张 api.choice+prompt；每张打出有日志；loseActions 后 actionsLeft 在 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:152-171 真实 turnBegins 窗口触发，断言两张道具免费入场 + actionsLeft 5→2。'),
[
  I('low', 'impl-vs-text', '“any number” 被 for(guard<10) 硬上限 10 张截断；手牌超 10 张[[道具]]时第 11 张无法打出。',
    `${E('08019')}:30`, '把 guard 上限改为手牌数或 while(candidates.length) 并保留防死循环计数（>手牌上限）。'),
  I('low', 'perceivability', '若某张道具因资源不足 playCardFromHandFree 返回 false，循环不跳过多余候选，只是重复同一选择；日志未说明失败原因。',
    `${E('08019')}:44`, '检查 playCardFromHandFree 返回值，失败时从候选移除并记录原因。'),
])

// ── 08020 Toe to Toe ────────────────────────────────────────────────────────
add('08020', 'Toe to Toe', '正面迎击', 'approximation', [
  C('Fight.', 'implemented', `${E('08020')}:16-19（played + countsAs:'fight' + noOpportunityAttack）；引擎反击/趁乱攻击读点 src/engine/dispatch.js:331。`),
  C('This attack deals +1 damage and is automatically successful.', 'approximation',
    `${E('08020')}:35-39（跳过检定，直接 api.damageEnemy(current,2)）；注释 :7-8 明示。缺：其它 +伤害来源（武器/事件加值）不会叠加到 2 之上，也不产生攻击检定窗口/失败触发。`,
    '卡面“自动成功”≠硬编码 2 伤害；伤害应为 1+1+其它加值。'),
  C('As an additional cost to perform this attack, the chosen enemy makes an attack against you.', 'implemented',
    `${E('08020')}:31-34（先 api.enemyAttackByCard 再结算伤害，顺序与卡面一致）；api: src/engine/api-card.js:374。`),
], P('perceivable', `${E('08020')}:26-30 目标 choice+prompt；:33/:39 两次 api.info；敌人先攻击的伤害在 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:461-475 断言目标敌人 damageTaken=2 且本人 damage=1。'),
[
  I('medium', 'impl-vs-text', '自动成功改为“跳过检定直接 2 点伤害”，不叠加其它伤害加值、不触发攻击检定窗口；“自动成功”的近似在注释披露。',
    `${E('08020')}:7-8,35-39`, '用 api.fight + 临时 autoSuccess（引擎已有 state.skillTest.autoSuccess 读点 api-test.js:162-167）或新增 api.fight options.autoSuccess，让伤害公式走 1+damageBonus。'),
])

// ── 08021 Get behind me! ────────────────────────────────────────────────────
add('08021', '"Get behind me!"', '“到我身后！”', 'approximation', [
  C('Fast. Play during any [fast] window.', 'approximation',
    `${E('08021')}:19-27（played+fast，只在 enemyAttack 窗口枚举）；“任何 fast 窗口”实际只在同地点他人被攻击窗口可打出，注释 :9-12 明示。`),
  C('Until the end of the phase, whenever an enemy would attack another investigator at your location, it attacks you instead, then engages you.', 'approximation',
    `${E('08021')}:35-39（取消一次攻击→api.engage→api.enemyAttackByCard 改打你）；持续整阶段的多次拦截未建模（注释 :11-12 明示）。`),
  C('Cancel 1 horror dealt by each attack made in this way.', 'approximation',
    `${E('08021')}:40-41（攻击结算后 api.healHorror(inv.seat,1)）；若该次攻击本来没有恐惧，会凭空治愈 1 恐惧（注释 :40 明示“结算后治愈”）。`),
], P('perceivable', `${E('08021')}:38 日志说明替同地点调查员承受攻击；改为交战/伤害/恐惧在 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:472-485 断言敌人改为与本人交战、本人吃伤害、horror=0。'),
[
  I('medium', 'impl-vs-text', '“持续到阶段结束的每次攻击改向”退化为一次性手牌反应；“取消 1 恐惧”退化为结算后治愈 1 恐惧（无恐惧时凭空治愈）。',
    `${E('08021')}:9-12,40-41`, '优先实现原语请求 m2-1-08021（持续改向 effect/攻击目标前后拦截）；最低限度让治愈量取 min(1, 本次实际恐惧)。'),
])

// ── 08022 Gang Up ───────────────────────────────────────────────────────────
add('08022', 'Gang Up', '成群结队', 'match', [
  C('Fight.', 'implemented', `${E('08022')}:16-19 + api.fight（src/engine/api-misc.js:1356 → combat.js:79）。`),
  C('For each different class among cards you control, you get +1 [combat] and deal +1 damage for this attack.', 'implemented',
    `${E('08022')}:32-35（api.cardFactions 去重、排除 neutral）；:36-39 api.fight({combatBonus,damageBonus,noSpend})；读点 src/engine/api-misc.js:844-846、combat.js:236-296。`),
], P('perceivable', `${E('08022')}:26-30 目标 choice+prompt；+:39 的 presentationCardCode；攻击结果 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:171-182 五职阶在场 → 技能值+5、伤害 6。'),
[
  I('low', 'impl-vs-text', '只统计 inv.assets 的职阶；“cards you control”是否含调查员卡/其它受控卡未与规则书裁决对齐（本卡用 api.cardFactions，与 08036/08050/08062/08077 口径不同）。',
    `${E('08022')}:32-35`, '在 docs/card-model.md 裁决“class among cards you control”的口径，并上收为共享读点（见 D5 组）。'),
])

// ── 08023 Sweeping Kick ─────────────────────────────────────────────────────
add('08023', 'Sweeping Kick', '扫堂腿', 'match', [
  C('Fight. Add your [agility] to your skill value for this attack.', 'implemented',
    `${E('08023')}:32-35 api.fight({addSkill:'agility'})；读点 src/engine/combat.js:237（getStat(inv, opts.addSkill) 并入 skillBonus）。`),
  C('This attack deals +1 damage.', 'implemented', `${E('08023')}:33 damageBonus:1；公式 combat.js:293-296。`),
  C('If you succeed, automatically evade the attacked enemy.', 'implemented',
    `${E('08023')}:33 autoEvadeOnSuccessBy:0；读点 src/engine/combat.js:494-499。`),
], P('perceivable', `${E('08023')}:26-30 choice+prompt；自动躲避/横置在 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:185-198 断言技能值=combat+agility+标记、伤害 2、敌人 exhausted/解除交战。'),
[])

// ── 08024 Defensive Stance ──────────────────────────────────────────────────
add('08024', 'Defensive Stance', '防御姿态', 'approximation', [
  C('While Defensive Stance is in your hand or committed to a skill test, it gains [combat] icons equal to your [agility], and [agility] icons equal to your [combat].', 'approximation',
    `${E('08024')}:8-10,24-28（kind commit + skill.iconBonus，用 cards-data 印刷基值）；读点 src/engine/stats.js:267-271（ctx 含 state/inv/skill/test 但无 getStat）、:327-338。注释明示近似。`),
], P('perceivable', '投入窗口的图标数由 commitIcons 计算并用于投入移动枚举（src/engine/commit-rules.js:53、ai-context.js:237）；但手牌卡面本身不显示动态图标（web 无 iconBonus 读点），screen 的 silent 标记属机械误报。',
  '技能卡动态图标在“投入选择”时才可见，建议 UI 在投入面板显示。'),
T('covered', 'tests/eote-player-m2-1.test.mjs:487-496 断言两个方向图标=对方印刷值、其他技能为 0。'),
[
  I('medium', 'impl-vs-text', '图标数读印刷基值，属性修正（如 +1[agility] 支援、临时加值）不会改变图标数；已登记原语请求 m2-1-08024（status rejected），注释披露。',
    `${E('08024')}:8-10`, 'stats.js:271 的 iconBonus ctx 已含 state；可提供只读 getStat 或让条目改用 ctx.state 内的有效属性读点。'),
  I('low', 'impl-vs-text', '多技能检定（skill 为数组且同时含 combat+agility）时三元表达式只取第一个方向，另一方向图标漏算。',
    `${E('08024')}:24-28`, '改为两个 if 独立累加（与 08065/08078 写法统一）。'),
  I('low', 'duplication', '与 08037/08065/08078 同模板“手中/投入时双向图标交换”四份手写；08024/08037 用三元、08065/08078 用两 if，口径不一。',
    `${E('08024')}:24-28`, '上收为 commit iconBonus 共享 helper（参数：A→B 图标映射）。'),
])

// ── 08025 Butterfly Swords (2) ──────────────────────────────────────────────
add('08025', 'Butterfly Swords', '蝴蝶对剑', 'match', [
  C('[action]: Fight. You get +1 [combat] for this attack.', 'implemented',
    `${E('08025')}:20,33（cost.action + api.fight combatBonus:1）；读点 src/engine/combat.js:237。`),
  C('After this attack, you may exhaust Butterfly Swords to fight again, adding your [agility] to your skill value for that attack. That attack deals +1 damage.', 'implemented',
    `${E('08025')}:34-44（敌人未被击败则 api.choice 询问，api.exhaust + api.fight({addSkill:'agility',damageBonus:1,noSpend:true})）；:34 防止第一次即击败后二次攻击。`),
], P('perceivable', `${E('08025')}:27-30 目标 choice；:35-39 二次攻击 choice+prompt；横置/伤害在 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:202-215 走真实 legalMoves→move→act，断言横置与敌人 3 点伤害。'),
[])

// ── 08026 Dodge ─────────────────────────────────────────────────────────────
add('08026', 'Dodge', '闪躲', 'match', [
  C('Fast. Play when an enemy attacks an investigator at your location.', 'implemented',
    `${E('08026')}:14-18（played+fast+trigger enemyAttack）；窗口 src/engine/enemies.js（攻击结算）与 api.reactionContext（api-misc.js:1159）。`),
  C('Cancel that attack.', 'implemented', `${E('08026')}:23 api.cancelCurrentAttack(context)；api: src/engine/api-misc.js:1177。`),
  C('Then, test [agility] (1). If you succeed, deal 1 damage to that enemy.', 'implemented',
    `${E('08026')}:25-32（api.startTest(skill:'agility',difficulty:1,resolve)）；api: src/engine/api-misc.js:1108-1117。`),
], P('perceivable', `${E('08026')}:24 取消日志 + api.startTest 产生真实检定 UI；伤害日志/敌人状态可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:217-228 断言取消后敏捷(1)成功造成 1 伤害。'),
[])

// ── 08027 Combat Training ───────────────────────────────────────────────────
add('08027', 'Combat Training', '战斗训练', 'approximation', [
  C('Fast. Limit 1 [[Composure]] in play.', 'approximation',
    `${E('08027')}:18-19（fast+composure 条目字段）；“Limit 1 [[Composure]] in play”在引擎无读点（grep footwear/composure limit 无命中，composure 仅用于伤害分配读点）。`),
  C('You get +1 [combat] and +1 [agility].', 'implemented',
    `${E('08027')}:24-27 skillModifier；读点 src/engine/stats.js / modifiers.js:45-51（skill:combat/agility）。`),
  C('Non-direct damage/horror must be assigned to Combat Training before it can be assigned to your investigator card.', 'approximation',
    `${E('08027')}:19 composure → 仅恐惧分支生效（src/engine/stats.js:55, src/engine/harm-threat.js:163）；伤害分支读点是 src/engine/harm-threat.js:160-165 的 flags.composureDamage，但本卡未声明。`),
  C('[fast] Spend 1 resource: You get +1 [combat] or +1 [agility] for this skill test.', 'implemented',
    `${E('08027')}:20-23 freeTriggers；读点 src/engine/stats.js:82-89、应用 src/engine/treachery-tokens.js:289-296。`),
], P('perceivable', 'modifiers 面板显示 +1/+1；freeTrigger 在检定前询问（treachery-tokens.js:289-296）。'),
T('weak', 'tests/eote-player-m2-1.test.mjs:229-241 断言 getStat +1 与 entry.fast/entry.freeTriggers 字段，未测试伤害/恐惧强制分配行为。'),
[
  I('medium', 'impl-vs-text', '沉稳的“非直接伤害必须先分配给本卡”未实现（仅恐惧分支生效），条目也未披露；引擎已有 flags.composureDamage 读点（harm-threat.js:160-165）。',
    `${E('08027')}:19; src/engine/harm-threat.js:162-165`, '声明 flags: { composureDamage: true }（08027/08040/08069/08081 同批）；并补行为测试。'),
  I('medium', 'impl-vs-text', '“Limit 1 [[Composure]] in play”无引擎读点（与 08040/08056/08069 同缺口），场上可叠放多张沉稳。',
    `${E('08027')}:19; src/engine/stats.js:55`, '新增通用 trait 限 1 在场读点（类似 sharedSlotGroup），5 张沉稳卡共用。'),
])

// ── 08028 On the Hunt ───────────────────────────────────────────────────────
add('08028', 'On the Hunt', '追猎行动', 'gap', [
  C('Fast. Play when you would draw an encounter card during the mythos phase. Instead, search the encounter deck for an enemy, spawn it engaged with you...', 'missing',
    `${E('08028')}:25,27-44（触发 mythosEncounterStep、api.spawnEncounterEnemy 生成并交战），但未调用 api.playerTools.skipEncounterStep(context)；引擎在窗口后仍抽遭遇：src/engine/turn.js:144-146（判断 !encounterStep.skip 后才抽牌）；该 API 存在且被 07269 使用（src/cards/entries/07269.js:4, src/engine/player-mechanics.js:106-110）。`,
    '实际效果 = 多生成一个交战敌人 + 仍照常抽遭遇卡（严格变差），与卡面 “Instead” 不等价。'),
  C('...attach On the Hunt to it, and shuffle the encounter deck.', 'missing',
    `${E('08028')}:13-14 明示无“事件附属到敌人”原语，只以持续效果 sourceInstanceId 记账；敌人实体上不可见（原语请求 m2-1-08028 status rejected）。`),
  C('[reaction] When you defeat attached enemy: Gain 3 resources.', 'approximation',
    `${E('08028')}:45-58（addEffect duration endOfRound + defeatEnemy 反应）；会因任意敌人被击败触发且本轮结束失效，非“被附属敌人”整局有效。`),
], P('partial', `${E('08028')}:44 生成日志；但“附属”无投影、遭遇是否被替代也无提示（实际仍抽遭遇对玩家不可见）。`),
T('weak', 'tests/eote-player-m2-1.test.mjs:496-521 断言生成敌人/交战/击败得 3 资源，但未断言“不抽遭遇卡”（正是缺陷所在）。'),
[
  I('high', 'impl-vs-text', '卡面“改为查找敌人生成”没有替代神话阶段遭遇抽取：打出后仍会照常抽遭遇卡（多抽 1 张）。',
    `${E('08028')}:27-58（无 skip）；src/engine/turn.js:144-146；对照 src/cards/entries/07269.js:4`, '结算时调用 api.playerTools.skipEncounterStep(api.reactionContext())（至少单调查员场景），或等专用“替代本次遭遇抽取”原语；补测试断言 encounter 未被抽。'),
  I('medium', 'impl-vs-text', '“附属到该敌人 + 击败被附属敌人获得 3 资源”退化为持续效果 sourceInstanceId + 任意敌人击败触发 + 本轮失效；无任何附属可视化。',
    `${E('08028')}:13-16,45-58`, '实现“结算后事件留在敌人身上”的原语或改为敌人实例字段 + projection；奖励按 sourceInstanceId 精确匹配并在敌人离场时清理。'),
])

// ── 08029 Fang of Tyr'thrha ─────────────────────────────────────────────────
add('08029', 'Fang of Tyr\'thrha', '提尔斯哈之牙', 'approximation', [
  C('Fight. Choose an enemy at any revealed location as the target for this attack.', 'implemented',
    `${E('08029')}:22-35（任意 revealed 地点敌人 + choice）；api.fight src/engine/api-misc.js:1356。`),
  C('Before resolving this attack, you may move to that enemy\'s location.', 'approximation',
    `${E('08029')}:36-43（不同地点时强制 api.moveInvestigator 再攻击）；注释 :8-10 明示“可以移动”退化为强制移动。`),
  C('Add your [agility] to your [combat] for this attack. This attack deals +3 damage.', 'implemented',
    `${E('08029')}:44-47（addSkill:'agility', damageBonus:3）；读点 combat.js:237,296。`),
], P('perceivable', `${E('08029')}:30-34 目标 choice 带地点名；移动/攻击日志与检定 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:243-264 断言移动到远端地点、技能值 combat+agility、伤害 4。'),
[
  I('medium', 'impl-vs-text', '“may move”被实现为强制移动，玩家无法选择不移动（远端攻击必须移动，可能踩入危险地点）。',
    `${E('08029')}:8-10,36-43`, '在移动前 api.choice 询问是否移动；不移动时按卡面允许远程攻击（api.fight 需支持跨地点目标或先移后攻两种分支）。'),
])

// ── 08030 Butterfly Swords (5) ──────────────────────────────────────────────
add('08030', 'Butterfly Swords', '蝴蝶对剑', 'approximation', [
  C('[action]: Fight. You get +2 [combat] for this attack.', 'implemented', `${E('08030')}:20-22,37-40（combatBonus:2）。`),
  C('After this attack, you may fight again, adding your [agility] to your skill value for that attack.', 'implemented',
    `${E('08030')}:41-51（choice + api.fight addSkill:'agility', noSpend:true）。`),
  C('If both attacks are successful, you may exhaust Butterfly Swords to have the second attack deal +1 damage.', 'approximation',
    `${E('08030')}:35-36,52-63（两次 onSuccess 记成功 → 再询问 → api.exhaust + post-hoc api.damageEnemy 1）；注释 :9-12 明示“事后追加伤害，不并入第二次攻击结算”。`),
], P('perceivable', `${E('08030')}:29-32/43-46/54-57 三次 choice+prompt；横置与伤害 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:266-279 断言横置后总伤害 3（1+1+追加 1）。'),
[
  I('medium', 'impl-vs-text', '+1 伤害为事后补刀（api.damageEnemy），不进入第二次攻击的伤害结算，因此不受“攻击加成/成功差值/击杀触发”顺序影响；已注释披露。',
    `${E('08030')}:9-12,58-62`, '若 api.fight 支持 onSuccess 修改伤害（combat.js:257 已有 onSuccess 回调），改为在第二次攻击结算前 +1 damageBonus。'),
  I('low', 'duplication', '与 08025 同卡不同等级，第二次攻击/成功判定骨架两处手写（约 80% 同构）。',
    `${E('08030')}:37-63`, '抽共享 helper（普通攻击 + 追加攻击 + 成功分支）。'),
])

// ── 08031 Forced Learning ───────────────────────────────────────────────────
add('08031', 'Forced Learning', '强制学习', 'approximation', [
  C('Permanent. Limit 1 per deck. Purchase at deck creation.', 'implemented',
    'src/cards/cards-data.js: 08031 permanent:true, deckLimit:1；src/engine/setup.js:339。'),
  C('Increase your deck size by 15.', 'implemented',
    `${E('08031')}:16-18 deckConstruction.sizeBonus:15；读点 src/web/deck-rules.js:46、src/engine/campaign/campaign.js:198。`),
  C('During each upkeep phase, instead of drawing 1 card, draw 2 cards and discard 1 of them.', 'approximation',
    `${E('08031')}:21-38（forced trigger upkeepEnd：额外 drawCards(1) + discardFromHand(1)）；读点 src/engine/phases.js:186（正常抽 1）、:222（upkeepEnd 窗口）。注释 :9-13 明示：第二张在重整末尾才抽、弃牌时机晚于正常抽牌步骤。`),
], P('perceivable', `${E('08031')}:30-37 弃牌 choice+prompt+info；抽 2 弃 1 的净结果可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:523-537 断言 deckRules size +15，upkeepEnd 后 deck-1/discard+1/手牌净 0。'),
[
  I('medium', 'impl-vs-text', '补给阶段抽牌替换退化为“正常抽 1 后再抽 1 弃 1”：两张牌不是同时抽、弃牌发生在重整末尾（会错过“抽牌时”窗口，且手牌上限处理顺序不同）。',
    `${E('08031')}:9-13,21-38`, '实现玩家支援级 upkeepDraw 读点（与 investigatorRule(code).upkeepDraw 同口径，phases.js:171-187），让“抽 2 弃 1”发生在正常抽牌点。'),
])

// ── 08032 Jeremiah Kirby ────────────────────────────────────────────────────
add('08032', 'Jeremiah Kirby', '耶利米·科尔比', 'approximation', [
  C('You get +1 [intellect].', 'implemented', `${E('08032')}:21-23 skillModifier；读点 modifiers.js。`),
  C('[reaction] After Jeremiah Kirby enters play, choose "even" or "odd": Reveal the top 5 cards of your deck. Draw each card with a cost that matches the chosen option. Shuffle the remaining cards into your deck.', 'approximation',
    `${E('08032')}:25-47（assetEnteredPlay reaction + parity choice + api.topDeckCodes(5) + api.moveCard deck→hand + api.shuffleDeck）。近似点：无“揭示”投影（只记录数量），且 api.cardCost 为 undefined 的无费用卡（技能卡/弱点）不进入任何 parity（:14-17），是否符合“no cost”裁决未核。`,
    '核心流程正确；感知与无费用卡裁定待确认。'),
], P('partial', `${E('08032')}:45 只记录“揭示 N 张、抽 M 张”，未列出被揭示/被抽的卡名；“Reveal”应为公开信息。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:281-299 断言 +1 智力、顶 5 张按偶数抽 3 张、奇数留库。'),
[
  I('medium', 'perceivability', '“Reveal the top 5 cards”没有把 5 张牌面公开（日志只有数量/张数），其他玩家看不到被揭示的牌。',
    `${E('08032')}:37-45`, '用 info(..., { kind: "reveal", cards: top }) 或 lookAt 的公开揭示通道逐张公开牌名。'),
  I('low', 'impl-vs-text', '无费用卡（技能/弱点等 cost undefined）被 costParity 归为 null，奇偶都不抽；需按官方裁定声明口径（若视作 0 则应算 even）。',
    `${E('08032')}:14-17`, '在 docs/card-model.md 裁决并要求 cards-data 提供统一 printedCost 读点。'),
])

// ── 08033 Archive of Conduits (0) ───────────────────────────────────────────
add('08033', 'Archive of Conduits', '通路档案', 'approximation', [
  C('Limit 1 per deck.', 'implemented', 'src/cards/cards-data.js: 08033 deckLimit:1；src/engine/deckbuilding.js:82。'),
  C('As an additional cost to play this asset, place 1 resource on 4 different locations, as leylines.', 'approximation',
    `${E('08033')}:22-47（entersPlay 时循环 4 次 api.choice + api.spendResources(1) + api.addLocationTrait('LeyLine')）。近似：附加费用不在打出时校验（无 playCondition），资源不足 4 时资产仍可入场且只放部分灵脉（:26-28 只记日志）；灵脉以地点特性记账，无独立标记。`),
  C('[reaction] After you successfully investigate a location with a leyline, exhaust this asset: Move that leyline onto this asset. Then, if there are 4 leylines on it, discard it, take its leylines as resources, and record in your Campaign Log that "you have identified the gateway."', 'approximation',
    `${E('08033')}:49-74；调查成功窗口 src/engine/actions.js:645；集齐 4 个后 discardAsset+gainResources（:67-72）；Campaign Log 用 api.setScenarioFlag('eoteConfirmedPath') 近似（:71），但该 flag 在 src+content 中无任何读取点（grep 仅本条目与测试命中）→ 实际写不进剧本日志。`),
], P('partial', '灵脉只投射为地点授予特性 [[LeyLine]]，不是“资源放在地点上”的可见标记；“已确认前行道路”的剧本日志记录为无效 flag（无读取点/无日志 UI）。'),
T('covered', 'tests/eote-player-m2-1.test.mjs:539-562 断言 4 地点获灵脉、付 4 资源、集齐后弃卡得 4 资源、scenarioFlags.eoteConfirmedPath=true（只断言 flag 被写，不保证被消费）。'),
[
  I('medium', 'impl-vs-text', '“As an additional cost to play this asset”未在打出时强制：无 playCondition 校验 4 资源/4 可放地点，资源不足时资产照样入场（非法可打出）。',
    `${E('08033')}:22-47`, '加 playCondition（资源≥4 且存在 4 个不同地点）或把附加费用实现为打出前 cost 步骤；不足时取消打出。'),
  I('medium', 'docs', 'Campaign Log “you have identified the gateway” 以 api.setScenarioFlag("eoteConfirmedPath") 近似，但该 flag 无任何消费点（src+content grep 仅本条与测试），campaign log/后续剧本都读不到。',
    `${E('08033')}:71`, '要么接到 campaign 记录层（campaign.records/campaign log 展示），要么在账本标注“未接线”而非 verified。'),
])

// ── 08034 Written in the Stars ──────────────────────────────────────────────
add('08034', 'Written in the Stars', '繁星密语', 'approximation', [
  C('Fast. Play only during your turn.', 'implemented', `${E('08034')}:22 playCondition:[ownTurn()]；读点 src/engine/matcher.js。`),
  C('Discard the top card of your deck. If that card is a weakness, shuffle it back into your deck.', 'implemented',
    `${E('08034')}:33-40（inv.deck 末位=牌库顶，与 api.topDeckCodes 口径一致 api-misc.js:887-891；discardTopOfDeck api-clue.js:78；弱点 moveCard discard→deckTop+shuffle）；弱点判定用 cards-data subtype。`),
  C('Otherwise, for the remainder of your turn, while that card is in your discard pile, commit it to each eligible skill test you perform.', 'approximation',
    `${E('08034')}:41-50（addEffect duration endOfTurn + modifiers target skill:* amount=图标总数）。近似：不真正“投入”（无卡牌移动/无每检定一次），等价为每次检定固定加图标总数；且“eligible”（图标匹配当前检定）被忽略。注释 :9-11 明示。`),
], P('perceivable', `${E('08034')}:38/50 日志说明弃到哪张卡与加值；效果记录可在 panel 看到（label）。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:564-586 断言非弱点产生 amount=图标总数的效果、弱点洗回且无效果。'),
[
  I('medium', 'impl-vs-text', '“将该牌投入每个符合条件的技能检定”退化为“每次检定固定 +图标总数”：不检查 eligibility（例如只给意志图标的牌也会被算进战斗检定），也不产生逐次投入/弃牌堆卡牌状态变化。',
    `${E('08034')}:9-11,41-50`, '实现 discard 来源的 commit 通道（原语请求 m2-1-08034 若可做）或至少按每个检定的 skill 计算匹配图标并校验 eligible。'),
])

// ── 08035 Hiking Boots ──────────────────────────────────────────────────────
add('08035', 'Hiking Boots', '登山靴', 'approximation', [
  C('Limit 1 [[Footwear]] per investigator.', 'missing',
    `${E('08035')}:10-11 只写注释；引擎无“Limit 1 [[trait]] in play”读点（grep footwear/composure limit 无命中；src/engine/stats.js:55 的 composure 只用于伤害分配）。场上可叠放多双 [[Footwear]]。`),
  C('You get +1 [agility].', 'implemented', `${E('08035')}:17-19 skillModifier；读点 modifiers.js:45-51。`),
  C('[reaction] After the last clue is discovered from your location, exhaust Hiking Boots: Move to a connecting location with at least 1 clue, or to a connecting unrevealed location.', 'implemented',
    `${E('08035')}:21-46（clueDiscovered + context.lastClue/location 校验 + cost.exhaust + 连接地点过滤 + api.moveInvestigator）；窗口 src/engine/locations.js:436-440，移动 api-misc.js:486。`),
], P('perceivable', `${E('08035')}:36-40 目的地 choice+prompt；:43 移动日志。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:301-331 走真实 clueDiscovered 窗口，断言 +1 敏捷、移动、横置。'),
[
  I('medium', 'impl-vs-text', '“Limit 1 [[Footwear]] per investigator”未实现（引擎无通用 trait 限 1 在场读点），可同时控制多双鞋子。',
    `${E('08035')}:10-11`, '新增通用 limit-1-trait 读点（与沉稳的 Limit 1 [[Composure]] 共用），在 canEquip/play 校验。'),
])

// ── 08036 Join the Caravan ──────────────────────────────────────────────────
add('08036', 'Join the Caravan', '加入马队', 'match', [
  C('Fast. Play only during your turn.', 'implemented', `${E('08036')}:29 playCondition:[ownTurn()]；:33 fast:true。`),
  C('Reduce the cost of this card by 1 for each different class among cards you control.', 'implemented',
    `${E('08036')}:16-28（playCostModifier 数据驱动 class 去重，排除 neutral）；读点 src/engine/turn-flow.js:469（对正在打出的卡自身应用）。`),
  C('Move to any revealed location.', 'implemented', `${E('08036')}:35-49（revealed 地点 choice 排除当前地点 + api.moveInvestigator）。`),
], P('perceivable', '打出费用在打出确认界面显示折后值（turn-flow.js:444-469 是费用唯一读点）；目的地 choice+prompt。'),
T('covered', 'tests/eote-player-m2-1.test.mjs:322-349 断言 3 职阶→费用 -3、playCondition、移动到 attic。'),
[
  I('low', 'duplication', '“不同职阶数量”与 08022/08050/08062/08077 各自手写（本卡用 ALL_CARDS.factions，08050/08062/08077 用 ALL_CARDS.klass、08022 用 api.cardFactions），neutral 处理不一致。',
    `${E('08036')}:16-24`, '上收为共享 helper 或引擎读点（见 notes.md D5 清单）。'),
])

// ── 08037 Survey the Area ───────────────────────────────────────────────────
add('08037', 'Survey the Area', '地区勘测', 'approximation', [
  C('While Survey the Area is in your hand or committed to a skill test, it gains [intellect] icons equal to your [agility], and [agility] icons equal to your [intellect].', 'approximation',
    `${E('08037')}:8-9,22-26（commit iconBonus，读 cards-data 印刷基值）；读点 src/engine/stats.js:267-271,327-338；原语请求 m2-1-08024（rejected）与 08024 共用同一近似。`),
], P('perceivable', '投入窗口图标数由 commitIcons 计算（src/engine/commit-rules.js:53）；手牌卡面不显示动态图标（机械 silent 标记）。'),
T('covered', 'tests/eote-player-m2-1.test.mjs:588-594 断言智力检定=敏印刷值、敏捷检定=智力印刷值。'),
[
  I('medium', 'impl-vs-text', '图标数读印刷基值，属性修正不会改变图标数（近似已在注释披露）。',
    `${E('08037')}:8-9`, '同 08024：提供 iconBonus 的有效属性读点。'),
  I('low', 'duplication', '与 08024/08065/08078 同模板四份手写；三元写法在多技能检定时漏算一个方向。',
    `${E('08037')}:22-26`, '统一共享 helper。'),
])

// ── 08038 Medical Texts ─────────────────────────────────────────────────────
add('08038', 'Medical Texts', '医学教科书', 'match', [
  C('[action]: Choose an investigator at your location and test [intellect] (2).', 'implemented',
    `${E('08038')}:18-32（api.investigatorsAt + choice + api.startTest(intellect,2)）；api: api-misc.js:1340 / :1108。`),
  C('If you succeed, heal 1 damage from that investigator (2 damage instead if you succeed by 2 or more).', 'implemented',
    `${E('08038')}:33-37（result.value-result.difficulty>=2 → 2；api.healDamage）。`),
  C('If you fail, you must either exhaust Medical Texts or deal 1 damage to that investigator.', 'implemented',
    `${E('08038')}:38-49（失败二选一 choice；damage→api.damage，或 api.exhaust(source)）。`),
], P('perceivable', `${E('08038')}:24-28 目标 choice；:39-46 失败二选一 choice+prompt；治愈/伤害 UI 可见。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:338-358 断言成功超 2 点治愈 2、失败选伤害后 damage+1。'),
[])

// ── 08039 Unearth the Ancients ──────────────────────────────────────────────
add('08039', 'Unearth the Ancients', '发掘古物', 'match', [
  C('Investigate. Choose up to 2 [seeker] assets in your hand. The difficulty of this skill test is equal to the combined cost of the chosen assets.', 'implemented',
    `${E('08039')}:10-11,20-42（手牌 seeker 支援循环 choice≤2、难度=费用和、api.startTest(intellect,难度)）；api.cardFactions api-misc.js:844。`),
  C('If you succeed, put the chosen assets into play, one at a time.', 'implemented',
    `${E('08039')}:44-52（成功分支 api.putIntoPlay 依次入场）；api: api-card.js:409。`),
  C('For each [[Relic]] asset put into play by this ability, draw 1 card.', 'implemented',
    `${E('08039')}:12,49-53（api.cardTraits(...) 返回小写特性（api-misc.js:1100 覆盖实现），'relic' 判定成立）。`),
], P('perceivable', `${E('08039')}:24-31 选择支援 choice+prompt+费用；:45/:54 结果日志。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:360-378 断言难度=费用和、两张支援入场、遗物支援抽 1（手牌收尾断言为 1 张，含一定歧义）。'),
[
  I('low', 'impl-vs-text', '候选用 Set 去重卡号：手里有两张同名 seeker 支援时无法两张都选（卡面允许“至多 2 张支援”，同名副本是两张卡）。',
    `${E('08039')}:21`, '按手牌下标而非 code 去重/选择。'),
])

// ── 08040 Scientific Theory ─────────────────────────────────────────────────
add('08040', 'Scientific Theory', '科学理论', 'approximation', [
  C('Fast. Limit 1 [[Composure]] in play.', 'approximation',
    `${E('08040')}:15-16（fast+composure 字段）；“Limit 1 [[Composure]] in play”无引擎读点（同 08027）。`),
  C('You get +1 [intellect] and +1 [combat].', 'implemented', `${E('08040')}:21-24 skillModifier。`),
  C('Non-direct damage/horror must be assigned to Scientific Theory before it can be assigned to your investigator card.', 'approximation',
    `${E('08040')}:16 composure → 仅恐惧分支（src/engine/harm-threat.js:163）；伤害分支读点 flags.composureDamage（harm-threat.js:160-165）未声明。`),
  C('[fast] Spend 1 resource: You get +1 [intellect] or +1 [combat] for this skill test.', 'implemented',
    `${E('08040')}:17-20 freeTriggers；读点 stats.js:82-89 / treachery-tokens.js:289-296。`),
], P('perceivable', 'modifiers 面板 + freeTrigger 检定前询问。'),
T('weak', 'tests/eote-player-m2-1.test.mjs:380-391 仅断言 getStat +1 与 entry.fast/freeTriggers 字段，未测伤害/恐惧分配行为。'),
[
  I('medium', 'impl-vs-text', '沉稳的“非直接伤害必须先分配”未实现且未披露；引擎已有 flags.composureDamage 读点。',
    `${E('08040')}:16; src/engine/harm-threat.js:162-165`, '声明 flags: { composureDamage: true } 并补测试。'),
  I('medium', 'impl-vs-text', '“Limit 1 [[Composure]] in play”无读点，可与另一张沉稳叠放。',
    `${E('08040')}:16`, '通用 limit-1-trait 读点（5 张沉稳共用）。'),
])

// ── 08041-08044 Archive of Conduits (4) ────────────────────────────────────
for (const [code, label, freeText, actionText, extraLine] of [
  ['08041', '移动到非精英敌人', 'Move 1 leyline from this asset to a non-[[Elite]] enemy.', 'Choose an investigator, and an enemy with a leyline at a revealed location. That investigator moves to that location. You may remove the leyline to deal 1 damage to that enemy.', 29],
  ['08042', '移动灵脉到已揭示地点', 'Move 1 leyline from this asset to a revealed location.', 'Choose an investigator and a revealed location with a leyline. That investigator moves to that location. You may remove the leyline to have them take an investigate action.', 31],
  ['08043', '解除交战并移动', 'Move 1 leyline from this asset to a non-[[Elite]] enemy.', 'Choose an investigator engaged with an enemy with a leyline. That investigator disengages from that enemy and moves to a connecting location. You may remove the leyline to automatically evade that enemy. This action does not provoke attacks of opportunity.', 47],
  ['08044', '抽牌治愈', 'Move 1 leyline from this asset to an investigator.', 'Choose an investigator with a leyline. That investigator draws 1 card and heals 1 damage or 1 horror. You may remove the leyline to have them instead draw 2 cards and heal 2 damage or 2 horror.', 45],
]) {
  add(code, 'Archive of Conduits', '通路档案', 'approximation', [
    C('Researched. Uses (4 leylines). Limit 1 per deck.', 'approximation',
      `src/cards/cards-data.js: ${code} deckLimit:1；uses 未在数据中（条目 usesType 由引擎初始化：src/engine/card-defs.js:310-321）。Researched 关键字无任何引擎/构筑读点（grep researched 仅命中 cards-data 文本与 04230/04231），牌库构筑仍按普通 4 级卡可购。`),
    C(freeText, 'approximation',
      `${E(code)}:${extraLine}-${extraLine + 15}（free 能力 api.setAssetUses 扣 1；灵脉不落到目标身上，只扣使用次数——08041/08043 明示“仅扣减灵脉数”）。`),
    C(actionText, 'approximation',
      `${E(code)}:${extraLine + 16}-${extraLine + 40}（action 选择调查员/地点/敌人 + api.moveInvestigator/autoEvadeEnemy/investigate + 可移除灵脉追加效果）。由于目标身上没有灵脉记录，“带有灵脉的敌人/地点/调查员”退化为按地点/任意目标过滤（08042 用地点特性过滤，08041/08043/08044 退化）。`),
  ], P('partial', '灵脉只有资产上的 uses 计数可见；08042 额外投射地点 [[LeyLine]] 特性；08041/08043/08044 的神/地点/调查员灵脉无投影（玩家无法看出谁带灵脉）。'),
  T('covered', `tests/eote-player-m2-1.test.mjs:596-666 覆盖 ${code} 的 entersPlay uses=4 与 free 扣减/地点特性（各卡断言入口不同，08043 只断言 noOpportunityAttack 字段）。`),
  [
    I('medium', 'impl-vs-text', '“灵脉”没有落在敌人/调查员/地点实例上的通用记录：08041/08043/08044 的“带灵脉的目标”无法判定，退化为任意目标；08042 仅借地点特性记账。',
      `${E(code)}:10-12`, '实现通用 leyline 标记原语（CARD_COUNTER_IDS 或 location/enemy/investigator 上的 counter + projection），4 张卡共用。'),
    I('medium', 'duplication', '08041-08044 四张同模板卡各自手写 free/action/entersPlay 骨架（每份 80+ 行），应共享 leyline 原语/helper。',
      `${E(code)}:15-${extraLine + 40}`, '上收共享实现（如 createArchiveOfConduits(mode)）。'),
    I('low', 'docs', '“Researched”关键字（战役研究获得、不可正常经验购买）未建模；构筑层仍可按 4 经验购买。',
      `${E(code)}:2`, '在构筑/战役层声明 researched 关键字读点。'),
  ])
}

// ── 08045 Prophesiae Profana ────────────────────────────────────────────────
add('08045', 'Prophesiae Profana', '亵渎预言', 'approximation', [
  C('While you are not at the locus, you get +1 [intellect], +1 [agility], and you may ignore attacks of opportunity.', 'implemented',
    `${E('08045')}:19-34（location trait Coordinate 记账 + 3 条 modifiers，含 target 'ignore:opportunityAttack' condition.when）；读点 src/engine/modifiers.js:102-107（IGNORABLE_RULES）、src/engine/modifiers.js:162-169（condition.when）、采用点 src/engine/dispatch.js:331 ruleIgnored。`),
  C('[reaction] After Prophesiae Profana enters play: Choose a revealed location. That location is "the locus" until Prophesiae Profana leaves play.', 'implemented',
    `${E('08045')}:37-67（entersPlay + choice；leavesPlay 撤销地点特性）；leavesPlay 读点 src/engine/assets.js:379-388 / lifecycle.js:54-56。最近似：locus 以地点授予特性 [[Coordinate]] 表示（注释 :13-15 披露）。`),
  C('[action]: Move any investigator to the locus.', 'implemented', `${E('08045')}:68-87（choice + api.moveInvestigator）。`),
], P('perceivable', `${E('08045')}:47-54 选择坐标点 choice+prompt+info；:54 坐标点信息；:79-86 移动 choice+日志。坐标点以地点特性展示，不是专用标记（已在注释披露）。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:393-420 断言坐标点=阁楼、+1/+1、ignore 修正声明、移动到坐标点、离场撤销。'),
[
  I('low', 'perceivability', '“the locus”投射为地点 [[Coordinate]] 特性，UI 上不是独立坐标点标记，玩家可能看不出哪条是坐标点（除非特性栏可见）。',
    `${E('08045')}:13-15`, '若地点特性投影不显示，考虑用地点专用 marker/面板。'),
])

// ── 08046 Underworld Support ────────────────────────────────────────────────
add('08046', 'Underworld Support', '地下支持', 'approximation', [
  C('Permanent. Limit 1 per deck. Purchase at deck creation.', 'implemented',
    'src/cards/cards-data.js: 08046 permanent:true, deckLimit:1；setup.js:339；deckbuilding.js:82。'),
  C('Your deck cannot include more than 1 copy of each non-weakness, non-signature card (by title).', 'missing',
    `${E('08046')}:9-11 明示“无该限制”（原语请求 m2-1-08046 status rejected）；构筑层 deckConstruction 只有 factions/level/limit 筛选（web/deck-rules.js 的 options）。`),
  C('Reduce your deck size by 5.', 'implemented', `${E('08046')}:14-16 sizeBonus:-5；读点 src/web/deck-rules.js:46、src/engine/campaign/campaign.js:198。`),
], P('perceivable', '牌库尺寸在构筑 UI 生效（deck-rules.js:46）；同名唯一限制没有任何 UI/校验反馈。'),
T('weak', 'tests/eote-player-m2-1.test.mjs:668-676 只断言 deckRules size -5 与 entry.deckConstruction.sizeBonus，未测同名限制。'),
[
  I('medium', 'impl-vs-text', '核心构筑限制“每张非弱点/非署名卡最多 1 张（按卡名）”完全未实现，构筑 UI 也不提示；卡目前只是牌库 -5。',
    `${E('08046')}:9-11`, '实现 deckConstruction.uniquenessByTitle 读点（构筑校验 + UI 错误提示），或明确标注为 blocked。'),
])

// ── 08047 Scout Ahead ───────────────────────────────────────────────────────
add('08047', 'Scout Ahead', '提前侦察', 'approximation', [
  C('Move. Move up to 3 times.', 'implemented', `${E('08047')}:14-16,17-43（countsAs:'move'；循环 3 次，每次连接地点 choice + api.moveInvestigator）。`),
  C('Enemies do not engage you during this movement.', 'approximation',
    `${E('08047')}:38-41（每次移动后 api.disengageAll(inv.seat)）；注释 :7-9 明示差异：移动瞬间的入场交战窗口仍打开，且会解除移动前已存在的交战（超出卡面范围）。`),
], P('perceivable', `${E('08047')}:27-34 每次移动 choice+prompt；:41 移动日志。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:677-700 断言 3 次移动后未与敌人交战。'),
[
  I('medium', 'impl-vs-text', '用“移动后解除所有交战”近似“移动期间不与你交战”：会额外解除移动前已存在的交战，且移动瞬间仍可能触发交战反应（近似已注释披露）。',
    `${E('08047')}:7-9,38-41`, '实现“本次移动忽略交战”临时标记（原语请求 m2-1-08047），只屏蔽移动期间的自动交战、不动已有交战。'),
])

// ── 08048 21 or Bust ────────────────────────────────────────────────────────
add('08048', '21 or Bust', '21点', 'match', [
  C('One at a time, reveal random tokens from the chaos bag until you choose to stop.', 'implemented',
    `${E('08048')}:41-57（循环 choice 继续/停下 + api.revealChaosTokens(1)）；api: src/engine/api-card.js:194-199；token 归还读点 src/engine/chaos-bag.js:85-105。`),
  C('Treat each [skull], [cultist], [tablet], or [elder_thing] as a 5; the [auto_fail] as a 10; and the [elder_sign] as either a 1 or an 11.', 'implemented',
    `${E('08048')}:15-30（SYMBOL_VALUES 键 skull/cultist/tablet/elderthing/autofail 与引擎 token face 命名一致，见 content/campaigns/theDreamEaters/tde-chaos.js:47-56；eldersign 每枚询问）。`),
  C('If the combined value of those tokens (ignoring +/-) is... 18 or less gain 4 / 19 gain 5 / 20 gain 6 / 21 gain 9.', 'implemented',
    `${E('08048')}:62-71（22+ 无奖励；数值 token 取 Math.abs）。`),
], P('perceivable', `${E('08048')}:44 每次询问带当前总和；:56 每枚 token 的 face/数值日志；奖励资源日志。`),
T('covered', 'tests/eote-player-m2-1.test.mjs:425-458 断言总和 19→5 资源、[elder_sign]视作 11 总和 21→9 资源。'),
[])

// ── 08049 Counterespionage ──────────────────────────────────────────────────
add('08049', 'Counterespionage', '反间谍活动', 'approximation', [
  C('Fast. Play when you draw a non-weakness treachery. Cancel that card\'s revelation effect and draw the top card of the encounter deck.', 'implemented',
    `${E('08049')}:44-64（played+fast+trigger treachery；api.playerTools.cancelRevelation(context) → context.cancelled；随后 drawEncounter/drawCards）；引擎：src/engine/treachery-tokens.js:87-97（cancel 后跳过显现）、src/engine/player-mechanics.js:101-105、src/engine/api-clue.js:64/113。`),
  C('[reaction] When you play Counterespionage, increase its cost by 2: Change "the encounter deck" to "your deck".', 'implemented',
    `${E('08049')}:16-27（beforePlayCost reaction 写 context.playUpgrades.yourDeck + costIncrease+=2）；读点 src/engine/actions.js:199-219（costIncrease 生效、:195-196 窗口对象作为 played context.playCost 传入）、主效果 :56-59 读取 context.playCost.playUpgrades。`),
  C('[reaction] When you play Counterespionage, increase its cost by 2: Change "you" to "any investigator".', 'approximation',
    `${E('08049')}:29-43（只记录 playUpgrades.anyInvestigator + costIncrease，行为不变）；注释 :32-33 明示近似；原语请求 m2-2-08049 status rejected。玩家花 2 资源买升级却没有任何效果（仅日志）。`),
], P('perceivable', `${E('08049')}:26/:28/:41/:59/:62 均有日志；升级只有日志提示、无 UI 效果差异。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:125-162 断言取消显现、yourDeck 升级改抽自己牌库、两条 beforePlayCost 升级写入 costIncrease/playUpgrades。'),
[
  I('medium', 'impl-vs-text', '第二条升级（“你”→“任意调查员”）只收 2 资源并记录标志，实际行为完全不变（无跨座位触发）；玩家会为无效果付费。',
    `${E('08049')}:29-43`, '实现跨座位快速事件候选原语（m2-2-08049）后再接入；在此之前禁止购买该升级（不提供 option），避免付费无效果。'),
])

// ── 08050 Cheat the System ──────────────────────────────────────────────────
add('08050', 'Cheat the System', '欺骗制度', 'approximation', [
  C('Fast. Play during any [fast] window.', 'implemented', `${E('08050')}:24-26（played+fast）；快速事件窗口枚举 src/engine/encounter.js:291-333。`),
  C('Gain 1 resource for each different class among cards you control.', 'approximation',
    `${E('08050')}:11-18（ALL_CARDS.klass 去重，但未排除 neutral；neutral 支援（如 10005 Flux Stabilizer klass=neutral）会被当成第 6 个“职阶”）。`),
], P('perceivable', `${E('08050')}:30-34 日志说明种类数与获得资源量。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:164-177 断言两种职阶 +2 资源、无卡牌不获得。'),
[
  I('medium', 'impl-vs-text', '把 neutral 当成一个“职阶”参与计数：控制任何中立支援会多获得 1 资源（卡面“不同职阶”不含中立）。',
    `${E('08050')}:11-18`, '过滤 klass !== "neutral"（与 08022/08036 对齐）。'),
  I('low', 'duplication', '与 08036/08062/08077 的职阶计数实现不同源、neutral 口径不一致（本卡与 08062/08077 同用 ALL_CARDS.klass）。',
    `${E('08050')}:11-18`, '上收共享 helper/引擎读点。'),
])

// ── 08051 Untimely Transaction ──────────────────────────────────────────────
add('08051', 'Untimely Transaction', '不当交易', 'approximation', [
  C('Reveal an [[Item]] asset in your hand. Another investigator at your location may play that asset as if it were in their hand.', 'approximation',
    `${E('08051')}:7-9 明示近似：用 api.putIntoPlay(我方) + api.giveAsset 转移控制权；实际未让另一位调查员支付该支援费用（免费获得），且“另一位调查员的决定”由打出者代选（:47-51）。api: api-card.js:409 / api-misc.js:690-698。`),
  C('If they do, draw 1 card and gain resources equal to that asset\'s printed cost.', 'implemented',
    `${E('08051')}:62-65（api.drawCards + gainResources(printedCost=ALL_CARDS.cost)）。`),
  C('Reveal', 'approximation', `${E('08051')}:34 只有日志揭示；无“揭示”公开投影/UI 通道。`),
], P('partial', `${E('08051')}:31-34 选择+揭示日志；:49-54 另一位调查员决定由打出者代选（非该座位 UI）。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:545-564 断言道具转移到另一位调查员控制、自己抽 1 并得印刷费用资源（未断言支付费用）。'),
[
  I('medium', 'impl-vs-text', '近似实现让另一位调查员“免费”打出该支援（未收打牌费用），并让打出者代替该座位做决定；费用差额未在游戏内补偿。',
    `${E('08051')}:7-9,56-61`, '用跨座位代打通道（playCardFromOtherHand/play-channels，08016 已有跨座位支付）让目标座位支付费用；决定交给目标座位 choice。'),
])

// ── 08052 Savant ────────────────────────────────────────────────────────────
add('08052', 'Savant', '行业专家', 'approximation', [
  C('Savant gains [wild] icons equal to your lowest skill other than the skill being tested.', 'approximation',
    `${E('08052')}:6-9,22-29（commit iconBonus 取四技能印刷值最小值，排除被检定技能）；读点 src/engine/stats.js:267-271；原语请求 m2-2-08052 status rejected（ctx 无 getStat，注释披露）。`),
], P('perceivable', '投入窗口图标数由 commitIcons 计算（src/engine/commit-rules.js:53）；手牌卡面不显示动态图标（机械 silent 标记）。'),
T('covered', 'tests/eote-player-m2-2.test.mjs:179-189 断言意志检定=其余三项印刷最低值（含印刷 wild 图标）。'),
[
  I('medium', 'impl-vs-text', '“lowest skill”读印刷基值，属性修正/临时加值不会改变图标数（已注释披露）。',
    `${E('08052')}:6-9`, '为 commit iconBonus 提供有效属性读点（m2-2-08052）。'),
])

// ── 08053 The Red Clock (2) ─────────────────────────────────────────────────
add('08053', 'The Red Clock', '红色闹钟', 'gap', [
  C('Exceptional. Uses (0 charges).', 'implemented',
    `${E('08053')}:17-18（uses:0/usesType:'charges'；引擎初始化 src/engine/card-defs.js:310-321）；Exceptional 经验翻倍 src/engine/deckbuilding.js:294,307；deckLimit:1 数据。`),
  C('Forced - After your turn begins: Either place 1 charge here, or take all charges here, as resources.', 'implemented',
    `${E('08053')}:20-40（forced trigger turnBegins + criteria context.seat + choice 放/取 + api.addUses/gainResources）；窗口 src/engine/turn.js:532。`),
  C('Then, if it has exactly... 1 charge +3 next test / 2 charges may move up to 2 times / 3 charges take an additional action this turn.', 'approximation',
    `${E('08053')}:41-60（1→addEffect endOfTest skill:* +3，读点 src/engine/tests.js:1533 过期；3→api.gainAction(1)；2→移动循环）。移动分支缺陷：here 在循环外固定为回合开始地点（:47），第二次移动仍从原地点连接枚举 → 可移动到与当前位置不相连的地点（api.moveInvestigator/relocateInvestigator 不校验连接，src/engine/hidden-rules.js:121-162；src/engine/movement.js:186-196）。`),
], P('perceivable', `${E('08053')}:31-32 放/取 choice+prompt；:36/:39/:45/:56/:60 日志；+3 效果 label 可在效果面板看到。`),
T('weak', 'tests/eote-player-m2-2.test.mjs:566-604 用 runDescriptor 断言三分支；2 充能分支只选“不移动”，未覆盖移动目的地的合法性/连续性。'),
[
  I('high', 'impl-vs-text', '2 充能分支“移动最多 2 次”用固定起始地点的连接枚举：第一次移动后第二次仍出现原地点邻居，且引擎位移不校验相邻 → 可实际移动到与当前位置不相连的地点（非法移动），同时漏掉当前位置的合法连接。',
    `${E('08053')}:47-57; src/engine/movement.js:186-196; src/engine/hidden-rules.js:121-162`, '每次移动前按 inv.location 重新计算连接；并在 api.moveInvestigator/relocateInvestigator 增加相邻校验（或新增 effect-move 原语）。'),
])

// ── 08054 Money Talks ───────────────────────────────────────────────────────
add('08054', 'Money Talks', '金钱万能', 'approximation', [
  C('Fast. Play when an investigator at any location initiates a skill test.', 'approximation',
    `${E('08054')}:14-19（played+fast+trigger testBegins）；窗口 src/engine/tests.js:273-274。近似/缺陷：快速事件候选受“同地点”过滤（src/engine/encounter.js:326 的 !reaction.anyLocation && inv.location !== context.location 判定），本卡未声明 anyLocation → 只能在与你同地点的调查员发起检定时打出，与“any location”不符。`),
  C('Instead of the skill type indicated for this test, this is a resource skill test. The performing investigator\'s base skill value for this test is equal to half the number of resources in your resource pool (rounded down).', 'implemented',
    `${E('08054')}:21-27（api.convertTestToResourceSkill(inv.seat) 用打出者资源池）；读点 src/engine/api-test.js:169-183（base=floor(resources/2)）。`),
  C('Draw 1 card.', 'implemented', `${E('08054')}:26 api.drawCards(inv.seat,1)。`),
], P('perceivable', `${E('08054')}:23/:27 日志说明改为资源检定与基础值；检定总值 UI 用 baseValue 刷新。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:191-203 断言 resourceSkill=true、base=floor(8/2)、抽 1 张。'),
[
  I('medium', 'impl-vs-text', '“an investigator at any location”被同地点窗口过滤，跨地点他人的检定无法用本卡响应。',
    `${E('08054')}:14-19; src/engine/encounter.js:326`, '给 trigger 增加 anyLocation 声明（其它卡已有该字段读点），或把 testBegins 的快速事件候选扩为全桌。'),
])

// ── 08055 Black Market ──────────────────────────────────────────────────────
add('08055', 'Black Market', '黑市', 'approximation', [
  C('Fast. Play at the start of the investigation phase. One at a time, reveal cards from the top of any investigator deck(s) until exactly 5 cards have been revealed. Set those cards aside, out of play.', 'approximation',
    `${E('08055')}:9-13 明示近似：用 moveCard deck→discard 代替 setAside（引擎 deck-ops.js:509-512 其实支持 to:'setAside'，但 play-channels 没有“从 setAside 打出”通道）；揭示牌名有日志。`),
  C('While set aside, any investigator may play any of those cards as if they were in their hand.', 'approximation',
    `${E('08055')}:43-53（仅“其所有者现在可以立即从弃牌堆打出一次”）；任意调查员/整阶段可用未实现。`),
  C('At the start of the next investigation phase, shuffle each of those cards still set aside into its owner\'s deck.', 'missing',
    `${E('08055')}:11-12 明示“未打出的牌留在弃牌堆”（需要跨阶段收尾，原语请求 m2-2-08055 status rejected）；实际这些牌永久进弃牌堆，可能被弃牌堆递归利用。`),
], P('partial', `${E('08055')}:37 逐张日志揭示牌名；但“(放在一边)”无实际场外可视区域，牌实际在弃牌堆（其他玩家可见的位置错误）。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:596-605 断言牌库 -5、弃牌堆 +5（正是近似口径，未测跨阶段洗回）。'),
[
  I('medium', 'impl-vs-text', '“放一边/场外”落成弃牌堆且没有“下个调查阶段洗回”：未打出的牌永久留在弃牌堆（可用性/弃牌堆状态错误）。',
    `${E('08055')}:9-13; src/engine/deck-ops.js:509-512`, '用 moveCard to:"setAside" + 新增 setAside 打出通道/阶段收尾原语（m2-2-08055）。'),
])

// ── 08056 Moxie ─────────────────────────────────────────────────────────────
add('08056', 'Moxie', '刚毅果敢', 'approximation', [
  C('Fast. Limit 1 [[Composure]] in play.', 'approximation', `${E('08056')}:15-16（fast+composure）；“Limit 1 [[Composure]] in play”无引擎读点（同 08027）。`),
  C('You get +1 [willpower] and +1 [agility].', 'implemented', `${E('08056')}:25-28 modifiers。`),
  C('Non-direct damage/horror must be assigned to Moxie before it can be assigned to your investigator card.', 'approximation',
    `${E('08056')}:9-12,22-24（恐惧走 composure：src/engine/harm-threat.js:163；伤害用旧 assetRule.redirectOneDamageToSelf 仅转移 1 点：src/engine/enemies.js:916-921）。原语 m2-2-08056 status implemented（flags.composureDamage 读点已在 harm-threat.js:160-165），但本卡仍用旧近似。`),
  C('[fast] Spend 1 resource: You get +1 [willpower] or +1 [agility] for this skill test.', 'implemented',
    `${E('08056')}:17-20 freeTriggers；读点 stats.js:82-89。`),
], P('perceivable', 'modifiers 面板 + freeTrigger 检定前询问；伤害转移/恐惧分配在 UI 可见（1 点近似）。'),
T('covered', 'tests/eote-player-m2-2.test.mjs:205-237 断言 +1/+1、freeTrigger 花 1 资源 +1、恐惧先分配到本卡、伤害 2 点中 1 点转移（近似口径）。'),
[
  I('medium', 'impl-vs-text', '沉稳伤害分支仍用 redirectOneDamageToSelf（每次只转移 1 点），而引擎已有 flags.composureDamage 完整分配读点（m2-2-08056 implemented）未接线。',
    `${E('08056')}:22-24; src/engine/harm-threat.js:160-165`, '改为 flags: { composureDamage: true }，删除 assetRule 近似；补“非直接伤害全部先分配”测试。'),
  I('medium', 'impl-vs-text', '“Limit 1 [[Composure]] in play”无读点。', `${E('08056')}:16`, '通用 limit-1-trait 读点。'),
])

// ── 08057 The Black Fan ─────────────────────────────────────────────────────
add('08057', 'The Black Fan', '黑色扇子', 'approximation', [
  C('Exceptional.', 'implemented', 'src/cards/cards-data.js: 08057 exceptional:true/deckLimit:1；src/engine/deckbuilding.js:294,307（经验×2）、:82（deckLimit）。'),
  C('While you have 10+ resources, you get +1 health and +1 sanity.', 'approximation',
    `${E('08057')}:16-18（passive:{healthBonus:1,sanityBonus:1} 常驻无条件）；读点 src/engine/stats.js:178（assetPassiveBonus）。注释 :16-17 明示“资源条件在引擎接线前无法读取”→ 资源不足 10 也 +1（严格变强）。原语请求 m2-2-08057 status rejected。`),
  C('While you have 15+ resources, you may take one additional action during your turn.', 'implemented',
    `${E('08057')}:20-31（free 能力 + criteria resources>=15 + perTurn limit + api.gainAction）；api-misc.js:727。`),
  C('While you have 20+ resources, you get +1 to each of your skills.', 'implemented',
    `${E('08057')}:33-35（modifier skill:* condition resourcesAtLeast:20）；读点 src/engine/modifiers.js:192。`),
], P('perceivable', `${E('08057')}:29 日志；法条化加值在 stat 面板显示；生命/神智上限 UI 显示 +1（无条件）。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:239-264 断言 15+ 额外行动每回合一次、20+ 技能 +1、生命/神智 +1 常驻（测试明确接受近似）。'),
[
  I('medium', 'impl-vs-text', '“10+ 资源才有 +1 生命/神智”被实现为常驻无条件加成（注释披露；资源<10 时仍 +1，违反卡面）。',
    `${E('08057')}:16-18`, '给 getMaxHealth/getMaxSanity 增加 modifiers 读点（maxHealth/maxSanity 目标已在 modifiers.js:45-51 列出但无消费点），带上 resourcesAtLeast:10。'),
])

// ── 08058 The Red Clock (5) ─────────────────────────────────────────────────
add('08058', 'The Red Clock', '红色闹钟', 'gap', [
  C('Exceptional. Uses (0 charges).', 'implemented', `${E('08058')}:14-15；引擎初始化 src/engine/card-defs.js:310-321；Exceptional xp 翻倍 deckbuilding.js:294。`),
  C('Forced - After your turn begins: You may take all charges here, as resources. Place 1 charge here.', 'implemented',
    `${E('08058')}:17-35（order 与卡面一致：先可拿取、后放置；turnBegins 窗口 turn.js:532）。`),
  C('If it has exactly... 1 charge +4 next test / 2 charges may move up to 3 times / 3 charges take 2 additional actions this turn.', 'approximation',
    `${E('08058')}:36-56（1→addEffect endOfTest +4；3→api.gainAction(2)；2→移动循环）。同 08053 移动分支缺陷：here 在循环外固定（:42），第二次起仍从原起始地点枚举连接，且 api.moveInvestigator 不校验相邻（hidden-rules.js:121-162）→ 可非法移动/漏合法目的地。`),
], P('perceivable', `${E('08058')}:26-28 拿取 choice+prompt；:32/:34/:39/:45/:51/:55 日志。`),
T('weak', 'tests/eote-player-m2-2.test.mjs:606-639 用 runDescriptor 断言三分支与“先取后放”；2 充能分支只选“不移动”，未覆盖移动目的地合法性。'),
[
  I('high', 'impl-vs-text', '“移动最多 3 次”分支用固定起始地点的连接枚举（第二次起目的地错误），且引擎位移不校验相邻 → 可移动到不相连地点（非法移动）。',
    `${E('08058')}:42-52; src/engine/movement.js:186-196; src/engine/hidden-rules.js:121-162`, '每次移动前按当前位置重算连接；位移入口加相邻校验或专用 effect-move 原语。'),
])

// ── 08059 Down the Rabbit Hole ──────────────────────────────────────────────
add('08059', 'Down the Rabbit Hole', '掉进兔子洞', 'gap', [
  C('Permanent. Limit 1 per deck. Purchase at deck creation.', 'implemented',
    'src/cards/cards-data.js: 08059 permanent:true, deckLimit:1；src/engine/setup.js:339。'),
  C('After each scenario of a campaign, reduce the experience cost of the first 2 cards you upgrade before the next scenario by 1.', 'missing',
    `${E('08059')}:8-10,14-26（只把参数写入 api.setScenarioFlag('downTheRabbitHole')）；该 flag 在 src+content 中无任何读取点（grep 仅本条与测试）→ 升级计价无任何实际效果。`),
  C('Increase the experience cost for you to purchase new cards by 1.', 'missing',
    `${E('08059')}:8-10,14-26；构筑/战役层无 XP 计价钩子（原语请求 m2-2-08059 status rejected）。`),
], P('partial', `${E('08059')}:22 只有一条 info 日志“已记录计价参数”；玩家在升级界面看不到经验折扣/加价。`),
T('weak', 'tests/eote-player-m2-2.test.mjs:640-647 只断言 setup 写入 scenarioFlags 的参数，未验证任何经验计价效果。'),
[
  I('high', 'impl-vs-text', '卡片全部效果（升级前 2 张 -1 经验、新购卡 +1 经验）未实现，只写了一个无人读取的 scenarioFlag：实战/战役升级层零效果。',
    `${E('08059')}:8-10,14-26`, '在战役 XP 计价层接入读点（campaign upgrade/purchase 定价），并让 flag 被消费；否则账本标 blocked/未实现而非 verified。'),
])

// ── 08060 Dragon Pole ───────────────────────────────────────────────────────
add('08060', 'Dragon Pole', '咏春棍', 'match', [
  C('You have 1 additional arcane slot.', 'implemented',
    `${E('08060')}:16-18 modifier target add:slot value 'arcane'；读点 src/engine/modifiers.js:428-443 slotBonus、容量计算 src/engine/assets.js:221-222（与 01070 同原语）。`),
  C('[action]: Fight. You get +1 [combat] for this attack for each of your arcane slots that is filled. If at least 2 of your arcane slots are filled, this attack deals +1 damage.', 'implemented',
    `${E('08060')}:11-12,20-32（印刷槽位含 arcane 的受控支援计数 → combatBonus；>=2 时 damageBonus:1）；api.fight api-misc.js:1356 → combat.js:237/296。`),
], P('perceivable', `${E('08060')}:23-25 目标 target 描述子；:30 日志显示已填槽数与加值。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:266-291 断言 2 个已填法术槽→伤害 2、无已填槽→伤害 1（未断言额外法术槽容量，槽位读点另有 01070 同原语覆盖）。'),
[
  I('low', 'docs', '测试未断言“额外 1 个法术槽”本身（依赖 add:slot 同原语在 01070/02158 的既有验证），槽位容量回归风险未被本卡测试锁定。',
    `${E('08060')}:16-18; tests/eote-player-m2-2.test.mjs:266`, '补一条 slotBonus("arcane") +1 的断言。'),
])

// ── 08061 Meditative Trance ─────────────────────────────────────────────────
add('08061', 'Meditative Trance', '冥想放空', 'match', [
  C('For each of your arcane slots that is filled, either heal 1 damage or 1 horror.', 'implemented',
    `${E('08061')}:10,18-41（按已填法术槽数循环，每次 choice 伤害/恐惧并 api.healDamage/healHorror；无可治愈时提前结束）。`),
], P('perceivable', `${E('08061')}:30-34 每次治愈 choice+prompt；:40 总结日志。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:293-308 断言每槽治愈 1 点（伤害+恐惧各一）、无槽不治愈。'),
[])

// ── 08062 Close the Circle ──────────────────────────────────────────────────
add('08062', 'Close the Circle', '闭环', 'gap', [
  C('Uses (1 charge for each class among cards you control, including this one).', 'approximation',
    `${E('08062')}:13-20,24-25,28-37（uses:1 + entersPlay setAssetUses(classCount)，count 含 neutral、只数 assets）；近似：classCount 使用 ALL_CARDS.klass 未排除 neutral。`),
  C('[fast] Spend 1 charge and exhaust Close the Circle: Take a basic action.', 'implemented',
    `${E('08062')}:39-52（free + cost{exhaust,uses:1} + api.beginImmediateAction(inv.seat,{source,basicOnly:true})）；读点 src/engine/api-misc.js:720、src/engine/engine.js:3211-3249；cost.uses 读点 src/engine/ability-rules.js:97/114。`),
  C('For each skill test performed during that action, you may use your [willpower] instead of the skill indicated for that action.', 'missing',
    `${E('08062')}:9-10 明示“暂未接线”；但引擎已为本卡实现专属原语 api.playerTools.takeBasicActionWithSubstitution(seat,{from,to})（src/engine/api-misc.js:1470-1489，注释点名 08062；原语请求 m2-2-08062 status implemented）。条目未调用 → 实际无替代效果。`),
], P('partial', `${E('08062')}:34-35 入场充能日志；:47/:50 行动选择与日志；但“检定改用 willpower”没有任何 UI/日志/行为。`),
T('weak', 'tests/eote-player-m2-2.test.mjs:648-659 断言充能=职阶数、行动选择发生、横置+扣充能；未断言 willpower 替代（正是缺失点）。'),
[
  I('high', 'impl-vs-text', '卡面核心“该行动期间每次技能检定可改用 willpower”完全未实现；引擎已实现专用原语 takeBasicActionWithSubstitution（m2-2-08062 implemented），条目仍走 beginImmediateAction → 功能缺失且注释过时。',
    `${E('08062')}:9-10,45; src/engine/api-misc.js:1470-1489`, '把调用改为 api.playerTools.takeBasicActionWithSubstitution(inv.seat,{source,from:["combat","intellect","agility"],to:"willpower"})；补测试断言替代生效。'),
  I('medium', 'impl-vs-text', '充能数把 neutral 当成“职阶”（classCount 未过滤 neutral），控制中立支援时充能多 1。',
    `${E('08062')}:13-20`, '过滤 neutral，与 08022/08036 对齐。'),
])

// ── 08063 Winds of Power ────────────────────────────────────────────────────
add('08063', 'Winds of Power', '力量之风', 'approximation', [
  C('Place 2 charges on an asset you control.', 'approximation',
    `${E('08063')}:11-29（canHoldCharges 只允许“可持有充能的支援”，api.addUses 2）。卡面为“a asset you control”无持有充能限制（充能可放在任意支援上，无用途则无效）；当前过滤排除了大量合法目标。`),
  C('[reaction] After you draw Winds of Power during your turn: Play it.', 'implemented',
    `${E('08063')}:39-48（reaction+fromHand+quickEvent+trigger cardDrawn + currentSeat 校验）；抽牌后窗口 src/engine/deck-ops.js:600-609（putInHand 之后开窗，fromHand 候选可枚举 src/engine/encounter.js:291-298,316-322）；打出付费/结算走 playReactionCard。`),
], P('perceivable', `${E('08063')}:23-25 充能目标 choice+prompt；:28 日志。`),
T('weak', 'tests/eote-player-m2-2.test.mjs:310-328 用 runDescriptor 断言 played 放 2 充能与 quickEvent 描述子字段，未走真实 cardDrawn 窗口。'),
[
  I('medium', 'impl-vs-text', '充能目标被限制为“可持充能的支援”，卡面允许任意“你控制的支援”；大量合法目标不可选。',
    `${E('08063')}:11-14`, '移除 canHoldCharges 过滤，允许任意受控支援（充能在无 uses 支援上无效即符合规则）。'),
])

// ── 08064 Foresight ─────────────────────────────────────────────────────────
add('08064', 'Foresight', '先见', 'approximation', [
  C('Fast. Play when an investigator at your location would draw a card from their deck or from the encounter deck. Name a card.', 'approximation',
    `${E('08064')}:8-11 明示近似：挂在抽牌后窗口（cardDrawn/encounterDrawn）而非“would draw”，命名候选限制为该调查员手牌+牌库（:27-39）。`),
  C('If the drawn card is the named card, that investigator may either: Cancel that card\'s effects and discard it. / Immediately play that card at -2 cost.', 'approximation',
    `${E('08064')}:40-63（命中→choice；玩家牌取消=discardFromHand，遭遇牌取消=context.cancelled；打出=api.playCard({discount:2,noAction:true})）。近似：玩家牌“取消效果并弃掉”在结算后执行（揭露效果已部分结算的风险由窗口时机决定）。`),
], P('partial', `${E('08064')}:41-42/:53/:59/:62 日志充分；但“命名”需要在候选列表选择（含整副牌库牌名，暴露牌库内容）；无自由命名。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:672-698 断言玩家牌命中→弃掉、遭遇命中→context.cancelled。'),
[
  I('medium', 'impl-vs-text', '“would draw”改为“抽到后命名比对”：无法在抽牌前阻止/替换抽牌，命名范围被限制为手牌/牌库现有卡（非任意卡名）。',
    `${E('08064')}:8-11,27-39`, '若无法实现 would-draw 窗口，至少在主报告维持 approximation 并限制提示文案；原语请求 m2-2-08064 status rejected。'),
])

// ── 08065 Occult Theory ─────────────────────────────────────────────────────
add('08065', 'Occult Theory', '密教理论', 'approximation', [
  C('While Occult Theory is in your hand or committed to a skill test, it gains [willpower] icons equal to your [intellect], and [intellect] icons equal to your [willpower].', 'approximation',
    `${E('08065')}:7-9,20-26（commit iconBonus 读印刷基值）。读点 src/engine/stats.js:267-271；原语请求 m2-2-08052 rejected，注释披露。`),
], P('perceivable', '投入窗口图标数由 commitIcons 计算；手牌卡面不显示动态图标。'),
T('covered', 'tests/eote-player-m2-2.test.mjs:330-338 断言意志检定=智力印刷值、智力检定=意志印刷值。'),
[
  I('medium', 'impl-vs-text', '图标数读印刷基值，属性修正不影响（已披露）。', `${E('08065')}:7-9`, '为 commit iconBonus 提供有效属性读点。'),
  I('low', 'duplication', '与 08024/08037/08078 同模板四份手写。', `${E('08065')}:20-26`, '统一共享 helper。'),
])

// ── 08066 Parallel Fates ────────────────────────────────────────────────────
add('08066', 'Parallel Fates', '平行命运', 'match', [
  C('Look at the top 6 cards of an investigator\'s deck or the encounter deck. You may either return them to the top of that deck in any order, or shuffle them into that deck.', 'implemented',
    `${E('08066')}:30-49（api.lookAt count=6 arrange:true returnStrategy top|shuffle；api: api-test.js:194 → deck-ops.js:202）。任意顺序实现已支持 >4 张：src/engine/deck-ops.js:273-305（线性逐张询问，注释点名 08066），look.js:31-32 接受 arrange。原语请求 m2-2-08066 status implemented —— 条目注释 :8-9 的“只支持 ≤4 张”已过时。`),
  C('If you looked at an investigator\'s deck, that investigator may draw 1 card.', 'implemented',
    `${E('08066')}:49-60（zone.kind==='investigator' 时询问 viewer 是否抽 1；api.drawCards）。`),
], P('perceivable', `${E('08066')}:30-39 zone 与放回方式 choice+prompt；:54-56 抽牌 choice；lookAt 自带看牌/排列 UI。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:340-364 断言 top 分支抽 1 张、shuffle 分支全部回牌库。'),
[
  I('low', 'docs', '条目注释与 primitive-request 已 implemented 的事实不符（:8-9 仍称 arrange 只支持 ≤4 张，“待主进程放宽”），审计账本/请求状态不一致，易被误判为未实现。',
    `${E('08066')}:8-9; src/engine/deck-ops.js:273-305`, '更新注释并关闭 primitive request 表述。'),
])

// ── 08067 Astronomical Atlas ────────────────────────────────────────────────
add('08067', 'Astronomical Atlas', '天文地图集', 'approximation', [
  C('[fast] Exhaust Astronomical Atlas: Look at the top card of your deck. If it is not a weakness, attach it facedown to Astronomical Atlas (max 5 cards attached).', 'implemented',
    `${E('08067')}:29-53（cost.exhaust + 牌库顶判定 + api.moveCard deck→attached facedown；attachments/5 上限）；moveCard attached 读点 src/engine/deck-ops.js:487-497；弱点判定 api.isNonWeakness。`),
  C('[fast]: Commit a card attached to Astronomical Atlas to an eligible skill test. If that test succeeds, add that card to your hand instead of discarding it. (Limit once per test.)', 'approximation',
    `${E('08067')}:9-13,55-98（把附属牌标记 uses=1 当“已投入”，按图标数 api.addPendingTestBonus；testEnds reaction 成功→moveCard attached→hand，失败→discard）。近似：不真正进入投入区/不产生投入触发，图标按 cards-data icons 计数；注释披露。`),
], P('partial', `${E('08067')}:52/:77/:92/:95 日志充分；但“已投入”标记写在附属实例 uses 上，UI 可能把附属牌显示为带计数（非标准投入区）。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:366-412 断言附属/弱点不附属/能力2 加图标与成功后回手。'),
[
  I('medium', 'impl-vs-text', '能力2 未真正“投入附属牌”：用 uses 标记 + pendingBonus 近似，放弃 eligible 校验与投入触发的结算顺序（已注释披露）。',
    `${E('08067')}:9-13,63-77`, '实现 from:attached 的 commit 通道（原语请求 m2-2-08067 rejected）或把标记改为专用实例字段以免与 uses UI 混淆。'),
])

// ── 08068 Healing Words ─────────────────────────────────────────────────────
add('08068', 'Healing Words', '治愈真言', 'match', [
  C('Uses (4 charges).', 'implemented',
    `${E('08068')}:11-13 uses:4/usesType:'charges'/discardWhenEmpty；引擎初始化 src/engine/card-defs.js:310-321；耗尽弃置读点 src/engine/ability-exec.js:204。`),
  C('[action] Spend 1 charge: Heal 2 damage from among investigators at your location.', 'implemented',
    `${E('08068')}:15-34（cost{action,uses:1}；循环 2 次按同地点有伤害调查员 choice + api.healDamage）。同名低阶 06163 单独实现（不同效果，属正常升级卡）。`),
], P('perceivable', `${E('08068')}:25-27 目标 choice+prompt；:31 每次治愈日志。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:414-426 断言治愈 2 点、花费 1 充能。'),
[])

// ── 08069 Grounded ──────────────────────────────────────────────────────────
add('08069', 'Grounded', '情绪稳定', 'approximation', [
  C('Fast. Limit 1 [[Composure]] in play.', 'approximation', `${E('08069')}:22-23（fast+composure）；Limit 1 [[Composure]] 无引擎读点（同 08027）。`),
  C('You get +1 skill value during skill tests on [[Spell]] cards.', 'implemented',
    `${E('08069')}:14-18,28-30（modifier skill:* condition.when 检查 state.skillTest.source.code 的 [[Spell]] 特性）；读点 modifiers.js:162-169、test 已验证。`),
  C('Non-direct damage/horror must be assigned to Grounded before it can be assigned to your investigator card.', 'approximation',
    `${E('08069')}:23 composure → 仅恐惧分支（harm-threat.js:163）；伤害分支读点 flags.composureDamage（harm-threat.js:160-165）未声明。`),
  C('[fast] During a skill test on a [[Spell]] card, spend 1 resource: You get +1 skill value for this test.', 'implemented',
    `${E('08069')}:24-26 freeTriggers requireTestTrait:'Spell'；读点 src/engine/treachery-tokens.js:289-296。`),
], P('perceivable', 'modifiers 面板 + freeTrigger 在法术检定前询问；法术检定 +1 在 stat 面板可见。'),
T('covered', 'tests/eote-player-m2-2.test.mjs:428-445 断言沉稳先吃恐惧、法术检定 +1、非法术无加值。'),
[
  I('medium', 'impl-vs-text', '沉稳伤害分支未实现（只用恐惧分支），且未披露；引擎已有 flags.composureDamage。',
    `${E('08069')}:23; src/engine/harm-threat.js:162-165`, '声明 flags.composureDamage 并补测试。'),
  I('medium', 'impl-vs-text', '“Limit 1 [[Composure]] in play”无读点。', `${E('08069')}:23`, '通用 limit-1-trait 读点。'),
])

// ── 08070 True Magick ───────────────────────────────────────────────────────
add('08070', 'True Magick', '真法魔典', 'gap', [
  C('Uses (1 charge). Replenish this charge at the start of each round.', 'missing',
    `${E('08070')}:21-22 仅声明 uses:1/usesType:'charges'（引擎初始化 src/engine/card-defs.js:310-321），但条目没有任何消耗该充能的费用、也没有 roundBegins/补满能力；引擎无通用“每轮补满”读点（grep replenish 仅 playerTools.replenishResources，player-mechanics.js）。→ 1 充能限制与每轮补满均无效果。`),
  C('You may resolve abilities on [[Spell]] assets in your hand by revealing them from your hand.', 'implemented',
    `${E('08070')}:23-52（free 能力 api.cardAbilityOptions + api.resolveCardAbility(inv.seat, code,{ignoreCosts:false})）；api: src/engine/api-card.js:116-140（fromHand 时设置 state._revealedAbility）。`),
  C('Treat True Magick as if it were the revealed asset (to pay its costs, spend charges, perform its effect, etc).', 'missing',
    `${E('08070')}:8-10 明示近似；实际费用/充能由手牌法术实例承担而非魔典（注释自述），且本能力无 action/耗尽/次数限制（:24-54）→ 可无限次免费触发（每次仅日志），实现强度显著高于卡面。`),
], P('partial', `${E('08070')}:39/:52 日志；但玩家看不到“充能/每轮补满”的限制，也没有每轮使用次数反馈 → 可重复点用。`),
T('weak', 'tests/eote-player-m2-2.test.mjs:700-708 只断言“代理结算了一个技能检定能力（lastTestResult 存在）”，未测试充能消耗/每轮补满/使用限制/费用转移。'),
[
  I('high', 'impl-vs-text', '“Uses (1 charge) + 每轮开始补满”完全未实现：能力是 free、无 cost/exhaust/limit，可无限次代理结算手牌法术能力；费用/充能也未转移到 True Magick 上。',
    `${E('08070')}:8-10,21-54`, '把 free 能力改为行动/限制使用（cost:{uses:1} 或 exhaust+uses），并加 roundBegins 补满（或引擎通用 replenish 读点）；费用/充能按“如同魔典”从魔典扣除。'),
])

// ── 08071 Short Supply ──────────────────────────────────────────────────────
add('08071', 'Short Supply', '补给匮乏', 'match', [
  C('Permanent. Limit 1 per deck. Purchase at deck creation.', 'implemented',
    'src/cards/cards-data.js: 08071 permanent:true, deckLimit:1；src/engine/setup.js:339；deckbuilding.js:82。'),
  C('Forced - When your first turn of the game begins: Discard the top 10 cards of your deck.', 'implemented',
    `${E('08071')}:12-23（forced trigger turnBegins + limit perGame + round===1 + context.seat 校验 + api.discardTopOfDeck(seat,10)）；api: src/engine/api-clue.js:78；窗口 turn.js:532。`),
], P('perceivable', `${E('08071')}:20 日志说明弃牌数量（含牌库不足提示）；弃牌堆 UI 可见。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:447-465 断言牌库 15→5、弃牌 10、同局第二次不触发。'),
[])

// ── 08072 Schoffner's Catalogue ─────────────────────────────────────────────
add('08072', 'Schoffner\'s Catalogue', '沙夫纳的目录', 'approximation', [
  C('Uses (5 secrets). If Schoffner\'s Catalogue has no secrets, discard it.', 'implemented',
    `${E('08072')}:11-14 uses:5/usesType:'secrets'/discardWhenEmpty；引擎初始化 card-defs.js:310-321；耗尽弃置 ability-exec.js:204（测试已验证）。`),
  C('You may spend secrets on Schoffner\'s Catalogue as resources to pay for [[Item]] assets played by any investigator at your location.', 'approximation',
    `${E('08072')}:7-9,16-26（free：花 1 秘密→得 1 资源）。近似：不限制“仅用于支付同地点[[道具]]支援”，资源可留存作任何用途；注释披露。`),
], P('perceivable', `${E('08072')}:24 日志说明花费秘密与获得资源；秘密数在卡面 uses 显示。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:711-723 断言花 1 秘密得 1 资源、耗尽弃卡。'),
[
  I('medium', 'impl-vs-text', '“秘密只能当资源支付同地点[[道具]]支援”的用途限制丢失：可换成通用资源囤积，用于任意支付/资源阈值（如黑色扇子 15+）。',
    `${E('08072')}:7-9`, '实现“用途当资源支付”通道（支付时从目录扣秘密，且限定 Item 且同地点），或把换资源限制为“紧接着的 Item 支付”并披露。'),
])

// ── 08073 Bandages ──────────────────────────────────────────────────────────
add('08073', 'Bandages', '绷带', 'match', [
  C('Uses (3 supplies). If Bandages has no supplies, discard it.', 'implemented',
    `${E('08073')}:14-16 uses:3/usesType:'supplies'/discardWhenEmpty；引擎 card-defs.js:310-321、ability-exec.js:204。`),
  C('[reaction] After an investigator or [[Ally]] asset at your location takes 1 or more damage, spend 1 supply: Heal 1 damage from that card.', 'implemented',
    `${E('08073')}:17-49（reaction trigger harmAssigned 医师；reaction trigger assetHarmPlaced 盟友；cost uses:1；api.healDamage/healAsset）。读点 src/engine/enemies.js:1020（harmAssigned）、:984-987（assetHarmPlaced）、api-misc.js:759（healAsset）。`),
], P('perceivable', '两个反应窗口都会询问（kind reaction + prompt 由引擎生成）；治愈日志可见。'),
T('covered', 'tests/eote-player-m2-2.test.mjs:467-492 用 descriptor 级双分支断言调查员/盟友各治愈 1 点并花 1 补给。'),
[
  I('low', 'docs', '调查员分支日志用了空模板 `${context.seat != null ? "" : ""}`，日志不显示被治愈者名字（纯文案缺陷）。',
    `${E('08073')}:29`, '改为读取 state.investigators[context.seat]?.name 输出。'),
])

// ── 08074 Jury-Rig ──────────────────────────────────────────────────────────
add('08074', 'Jury-Rig', '应急装备', 'gap', [
  C('Uses (3 durability). Attach to an [[Item]] asset controlled by an investigator at your location.', 'missing',
    `${E('08074')}:23-49（played resolve 里 api.moveCard({code:'08074',from:'hand',to:'attached'}））。真实打出管线在结算 played 描述子之前已把事件从手牌移除（src/engine/actions.js:159），而 moveCard 的 from:'hand' 只在手牌查找（src/engine/card-ops.js:196-220）→ 实牌打出时 moveCard 返回 null，日志“无法附属”，事件随后进弃牌堆：附属完全不发生。测试用 runDescriptor 直接调用（手牌未被移除）所以通过（tests/eote-player-m2-2.test.mjs:726-...）。引擎已有声明式附属通道 attachTo + 附属事件 uses 初始化（src/engine/actions.js:302-341，注释点名 08074）。`),
  C('[fast] During a skill test on attached asset, spend 1 durability: You get +2 skill value for this test.', 'missing',
    `${E('08074')}:51-64（free + cost uses:1 + criteria 比较 source.hostAssetId 与 state.skillTest.source.assetId / 私有 state._resolvingAssetId）。因附属从不建立，hostAssetId 不存在 → 能力永不出现；另读取私有字段而非引擎已提供的 api.playerTools.testAssetSource（src/engine/api-misc.js:1527-1533）。`),
], P('partial', '打出的结果只有“无法附属”日志；没有附属投影/耐久指示（因为附属从未发生）。'),
T('weak', 'tests/eote-player-m2-2.test.mjs:726-744 用低层 runDescriptor（手牌未被移除、手动 source=attachment）断言附属成功+耐久3+检定+2；恰好绕过了真实打出路径，掩盖了 from=hand 失败缺陷。'),
[
  I('high', 'impl-vs-text', '真实打出路径下事件已离开手牌，moveCard from:"hand" 失败 → “附属到道具支援”永不发生，卡牌实际只是花 0 费进弃牌堆；能力2 也随之永不生效。',
    `${E('08074')}:41; src/engine/actions.js:159; src/engine/card-ops.js:196-220; src/engine/actions.js:302-341`, '改用条目级 attachTo 声明（引擎会完成附属并按条目 uses/usesType 初始化耐久，actions.js:336-341），删除手写 moveCard；能力2 用 api.playerTools.testAssetSource() 判定宿主检定。补一条走真实 playCard 管线的测试。'),
  I('medium', 'primitive', '条目读取引擎私有字段 state._resolvingAssetId 而非公开读点 testAssetSource()（api-misc.js:1530），实现脆弱且被引擎注释点名不应直读。',
    `${E('08074')}:58; src/engine/api-misc.js:1527-1533`, '改用 api.playerTools.testAssetSource()。'),
])

// ── 08075 Bangle of Jinxes ──────────────────────────────────────────────────
add('08075', 'Bangle of Jinxes', '厄运手镯', 'match', [
  C('Uses (1 charge).', 'implemented', `${E('08075')}:11-13 uses:1/usesType:'charges'；引擎初始化 card-defs.js:310-321。`),
  C('[fast] Spend 1 charge: You get +2 skill value for this test. (Limit once per test.)', 'implemented',
    `${E('08075')}:15-25（free + cost uses:1 + limit perTest + api.addPendingTestBonus(2)）；读点 src/engine/ability-rules.js:97、api-test.js:204-208；limit perTest 测试已验证。`),
  C('[reaction] After an enemy attacks you: Place 1 charge on Bangle of Jinxes.', 'implemented',
    `${E('08075')}:26-36（reaction trigger enemyAttacked criteria context.seat===inv.seat + api.addUses）；窗口 src/engine/enemies.js:242-247、:332-333。`),
], P('perceivable', `${E('08075')}:23 检定加值日志；:34 充能放置日志。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:494-518 断言检定 +2、扣充能、每检定仅一次、被攻击后 +1 充能。'),
[
  I('low', 'impl-vs-text', 'enemyAttacked 窗口在“攻击被取消”时也会触发（enemies.js:242-247 注释明确），与“After an enemy attacks you”在取消场景是否触发存在裁定空间；条目未注释说明。',
    `${E('08075')}:8; src/engine/enemies.js:242-247`, '在 docs 裁决“取消的攻击是否算 attacks”；若否，条目 criteria 需加 context.cancelled 判断。'),
])

// ── 08076 Burn After Reading ────────────────────────────────────────────────
add('08076', 'Burn After Reading', '阅后即焚', 'match', [
  C('Exile a level 0-5 card in your hand.', 'implemented',
    `${E('08076')}:12-17,26-40（levelOf 用 cards-data xp 0-5，排除 weakness/基本弱点；moveCard hand→discard + api.exileFromDiscard）；api: api-card.js:227-236；0 级事件 xp=0 数据可用（测试 01088 通过）。`),
  C('Discover 2 clues at your location.', 'implemented', `${E('08076')}:41 api.discoverClue(inv.seat,2)；api: api-misc.js:417。`),
  C('If the exiled card was level 2 or higher, remove 1 doom from the current agenda.', 'implemented', `${E('08076')}:42-45 api.removeDoom(1)；api: api-enemy.js:155。`),
  C('Exile Burn After Reading.', 'implemented', `${E('08076')}:24 exileAfterPlay:true；读点 src/engine/actions.js:465。`),
], P('perceivable', `${E('08076')}:33-35 放逐目标 choice+prompt（带等级）；:40/:44 日志。`),
T('covered', 'tests/eote-player-m2-2.test.mjs:744-782 断言 0 级放逐/发现 2 线索/不移毁灭、2 级卡移除 1 毁灭。'),
[])

// ── 08077 Strength in Numbers ───────────────────────────────────────────────
add('08077', 'Strength in Numbers', '人多力量大', 'approximation', [
  C('Strength in Numbers gains a [wild] icon for each different class among cards you control.', 'approximation',
    `${E('08077')}:9-16,22-26（commit iconBonus 用 ALL_CARDS.klass 去重，未排除 neutral）；读点 src/engine/stats.js:267-271。neutral 支援会被当作一个“职阶”多给 1 图标。`),
], P('perceivable', '投入窗口图标数由 commitIcons 计算（src/engine/commit-rules.js:53）；手牌卡面不显示动态图标。'),
T('covered', 'tests/eote-player-m2-2.test.mjs:520-528 断言两种职阶→印刷 wild + 2。'),
[
  I('medium', 'impl-vs-text', 'neutral 被算作“职阶”：控制中立支援时多获得 1 个 wild 图标（卡面“不同职阶”不含中立）。',
    `${E('08077')}:9-16`, '过滤 neutral，与 08022/08036 对齐。'),
  I('low', 'duplication', '与 08050/08062 同一份 klass 计数代码手写三遍（08036 又是另一份 factions 版）。',
    `${E('08077')}:9-16`, '上收共享 helper（见 notes.md D5）。'),
])

// ── 08078 Dauntless Spirit ──────────────────────────────────────────────────
add('08078', 'Dauntless Spirit', '无畏精神', 'approximation', [
  C('While Dauntless Spirit is in your hand or committed to a skill test, it gains [willpower] icons equal to your [combat], and [combat] icons equal to your [willpower].', 'approximation',
    `${E('08078')}:7-9,20-26（commit iconBonus 读印刷基值）。读点 src/engine/stats.js:267-271；原语请求 m2-2-08052 rejected，注释披露。`),
], P('perceivable', '投入窗口图标数由 commitIcons 计算；手牌卡面不显示动态图标。'),
T('covered', 'tests/eote-player-m2-2.test.mjs:530-538 断言意志检定=战斗印刷值、战斗检定=意志印刷值。'),
[
  I('medium', 'impl-vs-text', '图标数读印刷基值，属性修正不影响（已披露）。', `${E('08078')}:7-9`, '为 commit iconBonus 提供有效属性读点。'),
  I('low', 'duplication', '与 08024/08037/08065 同模板四份手写。', `${E('08078')}:20-26`, '统一共享 helper。'),
])

// ── 汇总与落盘 ──────────────────────────────────────────────────────────────
const issues = cards.flatMap(c => c.issues.map(i => ({ code: c.code, ...i })))
const bySev = { high: 0, medium: 0, low: 0 }
for (const i of issues) bySev[i.severity]++
const byVerdict = { match: 0, approximation: 0, gap: 0, blocked: 0, 'not-applicable': 0 }
for (const c of cards) byVerdict[c.verdict]++

const findings = {
  area: 'player-a',
  auditor: 'player-auditor-a',
  method: '逐卡逐子句：cards-data 卡面中英 vs src/cards/entries/<code>.js 条目 + 引擎读点（api-*/combat/ability/actions/deck-ops/…）+ 测试断言；D2 选择/日志/投影；D4 声明是否被消费/越界读；D5 同模板对比与重印别名。机械线索取自 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/*.json 并按 08019–08078 过滤。',
  generatedAt: '2026-11-08',
  scope: { codes: cards.map(c => c.code), count: cards.length },
  summary: {
    cards: cards.length,
    ...byVerdict,
    issuesBySeverity: bySev,
    tests: { covered: cards.filter(c => c.tests.status === 'covered').length, weak: cards.filter(c => c.tests.status === 'weak').length },
  },
  cards,
  crossCutting: {
    highFindings: [
      { code: '08028', summary: '神话遭遇替代未实现：打出后仍照常抽遭遇卡（多 1 张遭遇）', evidence: 'src/cards/entries/08028.js:27-58 vs src/engine/turn.js:144-146' },
      { code: '08070', summary: 'True Magick 的 1 充能/每轮补满未实现，代理能力 free 无限制可无限次使用', evidence: 'src/cards/entries/08070.js:21-54' },
      { code: '08074', summary: '真实打出路径下事件已离手 → moveCard from:"hand" 失败，附属永不发生', evidence: 'src/cards/entries/08074.js:41 + src/engine/actions.js:159 + src/engine/card-ops.js:196-220' },
      { code: '08053/08058', summary: '红色闹钟“移动最多 N 次”分支使用固定起始地点的连接枚举且位移不校验相邻 → 非法移动/漏目的地', evidence: 'src/cards/entries/08053.js:47-57, src/cards/entries/08058.js:42-52, src/engine/movement.js:186-196, src/engine/hidden-rules.js:121-162' },
      { code: '08062', summary: 'willpower 替代未接线（引擎已实现 takeBasicActionWithSubstitution，请求 m2-2-08062 implemented）', evidence: 'src/cards/entries/08062.js:9-10,45 vs src/engine/api-misc.js:1470-1489' },
      { code: '08059', summary: '掉进兔子洞全部效果未实现：只写无人读取的 scenarioFlag', evidence: 'src/cards/entries/08059.js:8-10,14-26' },
    ],
    staleOrFalseDisclosures: [
      { code: '08066', claim: '注释称 lookAt arrange 只支持 ≤4 张、顺序能力待接线', reality: 'src/engine/deck-ops.js:273-305 已支持 >4 张逐张询问且注释点名 08066；primitive request m2-2-08066 status=implemented', evidence: 'src/cards/entries/08066.js:8-9 vs src/engine/deck-ops.js:273-305' },
      { code: '08062', claim: '注释称缺少 ctx.api 级 substituteSkill 绑定', reality: 'api.playerTools.takeBasicActionWithSubstitution（api-misc.js:1470-1489，注释点名 08062）已实现，请求 implemented，但条目未接线', evidence: 'src/cards/entries/08062.js:9-10 vs src/engine/api-misc.js:1470-1489' },
      { code: '08056/08027/08040/08069', claim: '沉稳伤害分支缺原语/未实现', reality: 'flags.composureDamage 读点已在 harm-threat.js:160-165（原语请求 m2-2-08056 implemented），无任何 EOTE 条目声明它', evidence: 'src/engine/harm-threat.js:160-165' },
      { code: '08074', claim: '注释称引擎 attachTo 附属事件不初始化 uses、无宿主检定读点', reality: 'actions.js:336-341 已按条目 uses/usesType 初始化附属事件（注释点名 08074）；api.playerTools.testAssetSource 已提供宿主检定读点（api-misc.js:1527-1533）；请求 m2-2-08074 status=partial', evidence: 'src/engine/actions.js:336-341; src/engine/api-misc.js:1527-1533' },
    ],
    unconsumedDeclarations: [
      { code: '08033', field: "api.setScenarioFlag('eoteConfirmedPath')", evidence: 'src/cards/entries/08033.js:71（src+content 无读取点）' },
      { code: '08059', field: "api.setScenarioFlag('downTheRabbitHole')", evidence: 'src/cards/entries/08059.js:18（src+content 无读取点）' },
      { code: '08074', field: 'state._resolvingAssetId（引擎私有字段直读）', evidence: 'src/cards/entries/08074.js:58' },
      { code: '08027/08040/08056/08069', field: 'Limit 1 [[Composure]] in play', evidence: 'src/cards/entries/08027.js:19 等（引擎无 trait 限 1 在场读点）' },
      { code: '08035', field: 'Limit 1 [[Footwear]] per investigator', evidence: 'src/cards/entries/08035.js:10-11' },
      { code: '08041-08044', field: 'Researched 关键字', evidence: 'src/cards/entries/08041.js:2 等（grep researched 仅在 cards-data 文本命中）' },
    ],
    duplicationGroups: [
      { group: '职阶计数（cards you control 的不同 class）', codes: ['08022', '08036', '08050', '08062', '08077'], evidence: '08022.js:32-35（api.cardFactions+neutral 过滤）/08036.js:16-24（ALL_CARDS.factions+neutral 过滤）/08050.js:11-18、08062.js:13-20、08077.js:9-16（ALL_CARDS.klass 未过滤 neutral）', suggestion: '上收共享 helper/引擎读点，统一 neutral 口径（应排除）。' },
      { group: '手中/投入时双向技能图标交换', codes: ['08024', '08037', '08065', '08078'], evidence: '08024.js:24-28/08037.js:22-26（三元）/08065.js:20-26/08078.js:20-26（两 if）', suggestion: '共享 iconBonus helper（A↔B 映射），统一在多技能检定下的行为。' },
      { group: '沉稳天赋模板（+1/+1 + freeTriggers + 伤害分配）', codes: ['08027', '08040', '08056', '08069'], evidence: '08027.js:18-28/08040.js:15-25/08056.js:15-28（额外 assetRule）/08069.js:22-30（requireTestTrait）', suggestion: '统一 flags.composureDamage 声明；限 1 沉稳读点上收引擎。' },
      { group: '通路档案灵脉（5 张：08033+08041-44）', codes: ['08033', '08041', '08042', '08043', '08044'], evidence: '08033.js:10-13/08041-44.js 各自 leyline helper', suggestion: '实现通用 leyline 标记原语与 shared helper（原语请求 m2-1-08033 pending/rejected）。' },
      { group: '红色闹钟两等级', codes: ['08053', '08058'], evidence: '08053.js:41-60 与 08058.js:36-56 结构近同', suggestion: '抽共享分支 helper，顺带修移动重算 bug。' },
      { group: '重印（正确实现）', codes: ['08057', '08058', '08073'], evidence: 'cards-data: 60379.duplicateOfCode=08057、60384.duplicateOfCode=08058、12073.duplicateOfCode=08073；运行时别名读点 src/engine/stats.js:124-133；未重复建条目', suggestion: '无需修改（D5 通过样例）。' },
    ],
  },
}

fs.mkdirSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a', { recursive: true })
fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/findings.json', JSON.stringify(findings, null, 1), 'utf8')
console.log('cards', cards.length, 'verdicts', JSON.stringify(byVerdict), 'issues', JSON.stringify(bySev))
