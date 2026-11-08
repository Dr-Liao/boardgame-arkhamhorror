// player-auditor-b findings.json generator (55 cards 08079-08133)
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-b'
const cards = JSON.parse(fs.readFileSync(path.join(OUT, '_cards.json'), 'utf8'))
const byCode = Object.fromEntries(cards.map(c => [c.code, c]))

const E = (rel, a, b) => `${rel}:${a}${b != null ? '-' + b : ''}`
const ins = (summary, dimension, evidence, suggestion, severity) => ({ severity, dimension, summary, evidence, suggestion })

const find = (code, verdict, clauses, perceivability, tests, issues = []) => {
  const c = byCode[code]
  return {
    code,
    name: c.name,
    nameZh: c.nameZh,
    type: c.type,
    klass: c.klass,
    xp: c.xp ?? null,
    verdict,
    accepted: verdict === 'match' && !issues.some(i => i.severity === 'high'),
    clauses,
    perceivability,
    tests,
    issues,
  }
}
const cl = (text, status, evidence, note = '') => ({ text, status, evidence, note })
const P = (status, evidence, note = '') => ({ status, evidence, note })
const T = (status, evidence, note = '') => ({ status, evidence, note })

const out = []

// ── 08079 Blood Will Have Blood ────────────────────────────────────────────
out.push(find('08079', 'gap', [
  cl('Fast. Play after an enemy attacks you.', 'implemented', 'src/cards/entries/08079.js:14-17；窗口 harmAssigned 由 src/engine/enemies.js:1020-1022 开', ''),
  cl('Max 1 per attack.', 'missing', 'src/cards/entries/08079.js:14-22 无 per-attack 上限声明；引擎 limit 读点 ability.js:187 未用',
    '同一攻击可重复打出多张（牌组 2 张）→ 抽牌翻倍。'),
  cl('Damage/horror from this attack cannot be assigned to [[Ally]] assets.', 'missing', 'src/cards/entries/08079.js:6-7 自述缺读点；同批 08130 已有 threatDamageSink 但本卡攻击分配限制仍无原语（audit/eote-player-queue.json: m2-3-08079 rejected）',
    '整句未实现：玩家仍可把该攻击伤害分配给盟友，且因此多抽牌。'),
  cl('For each point of damage and/or horror you took from this attack, draw 1 card.', 'implemented', 'src/cards/entries/08079.js:18-22', ''),
], P('partial', 'src/cards/entries/08079.js:18-22；仅 api.drawCards，无 api.info 日志/选择；打出横幅由 executeDescriptor 统一写日志', '自动效果无显式日志，抽牌数量只能靠手牌数推断（screen perceivability 命中 silent-ability-no-choice-no-log）。'),
  T('covered', 'tests/eote-player-m2-3.test.mjs:328-334', '真实 executeDescriptor + 合成 harmAssigned context；未测「每攻击上限」与「不能分配给盟友」两条缺失子句。'),
  [
    ins('「该攻击的伤害/恐惧不能分配给盟友支援」整句未实现，主效果（按受到点数抽牌）反而因此变强；prior 账本记 verified。', 'impl-vs-text', 'src/cards/entries/08079.js:6-7,14-22；src/engine/harm-threat.js assignHarm 无「本次攻击不能分配给盟友」读点', '补 harm 分配限制原语（按 attack 上下文禁止 Ally 槽），或至少在条目声明并写成 gap/approximation 账本。', 'high'),
    ins('「Max 1 per attack」未实现。', 'impl-vs-text', 'src/cards/entries/08079.js:14-22', '用描述子 limit.perAttack 或 context.attack 去重。', 'medium'),
    ins('自动效果无 api.info，D2 只能靠手牌变化感知。', 'perceivability', 'src/cards/entries/08079.js:18-22', '抽牌后补 api.info（含张数）。', 'low'),
  ]))

// ── 08080 Fire Extinguisher ────────────────────────────────────────────────
out.push(find('08080', 'match', [
  cl('[action]: Fight. You get +1 [combat] and deal +1 damage for this attack.', 'implemented', 'src/cards/entries/08080.js:11-12'),
  cl('[action] Discard Fire Extinguisher: Evade. Automatically evade all enemies engaged with you.', 'implemented', 'src/cards/entries/08080.js:13-20；api.autoEvadeEnemy 见 api-misc.js:503-504'),
  cl('You may exile Fire Extinguisher instead of discarding it to discard each non-[[Elite]] enemy evaded by this effect.', 'implemented', 'src/cards/entries/08080.js:22-32（exileSelf 费用 + defeatEnemy 仅非精英）'),
], P('perceivable', 'src/cards/entries/08080.js:11-32 label 齐全；三条能力在 legalMoves 中各为独立选项（moves.js:472-542），引擎日志写「使用「灭火器」…」', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:83-95', '真实 move 驱动攻击与弃牌躲避。')))

// ── 08081 Plucky ───────────────────────────────────────────────────────────
out.push(find('08081', 'gap', [
  cl('Fast. Limit 1 [[Composure]] in play.', 'implemented', 'src/cards/entries/08081.js:18-19；composure 关键字读点 src/engine/moves.js:148, src/engine/ability.js:889'),
  cl('You get +1 [willpower] and +1 [intellect].', 'implemented', 'src/cards/entries/08081.js:25-28'),
  cl('Non-direct damage/horror must be assigned to Plucky before it can be assigned to your investigator card.', 'approximation',
    'src/cards/entries/08081.js:17-19；恐惧侧读点 src/engine/harm-threat.js:163-165（assetEffect.composure）**已生效**，但伤害侧读点是 flags.composureDamage（harm-threat.js:160-162,165，primitives test:104），本卡未声明该 flag（probe：分配选项仍含「由调查员承受」）',
    '伤害侧未强制：玩家仍可直接把非直接伤害分给调查员；引擎 P6 原语已就绪（audit/eote-player-queue.json m2-3-08081 = done），条目未接线。'),
  cl('[fast] Spend 1 resource: You get +1 [willpower] or +1 [intellect] for this skill test.', 'implemented', 'src/cards/entries/08081.js:20-23（freeTriggers）'),
], P('perceivable', 'src/cards/entries/08081.js:20-23 freeTriggers 由引擎询问档位；资源/属性在 UI 可见', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:96-104', '只测 composure 字段与属性；伤害强制分配无测试。'),
  [
    ins('印刷「非直接伤害必须先分配给有胆有识」未实现：条目缺 flags.composureDamage。', 'primitive', 'src/cards/entries/08081.js:17-19 vs src/engine/harm-threat.js:160-165', '在条目加 flags: { composureDamage: true }（并补伤害侧测试），或明确降级为 approximation 并从 verified 账本移除。', 'high'),
    ins('prior 账本 simplified=false/verified 与原语队列 done 均未反映该缺口。', 'docs', 'audit/eote-player-acceptance.json status=verified；audit/eote-player-queue.json m2-3-08081 done', '账本应记录本卡伤害侧近似。', 'low'),
  ]))

// ── 08082 Fend Off ─────────────────────────────────────────────────────────
out.push(find('08082', 'approximation', [
  cl('Fast. Play when a non-[[Elite]] enemy spawns at your location.', 'implemented', 'src/cards/entries/08082.js:19-24；窗口 enemySpawn 见 src/engine/enemies.js:583-584'),
  cl('That enemy attacks you. Then, automatically evade that enemy and attach Fend Off to it.', 'approximation',
    'src/cards/entries/08082.js:25-42；附属改在 eventPlayed 窗口用「刚被自动躲避、未附属的非精英敌人」定位（条目注释 10-11 已披露）',
    '打出的瞬间事件卡不在弃牌堆，附属目标靠启发式选择；多个同类敌人时可能附属错目标。'),
  cl('Attached enemy cannot ready.', 'implemented', 'src/cards/entries/08082.js:17 restrainsReady；读点 src/engine/phases.js 敌人重整段（grep restrainsReady）'),
], P('perceivable', 'src/cards/entries/08082.js:19-42；打出为快速事件窗口选择、附属写入敌人 attachments，牌桌可见', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:336-348', '真实窗口探针 + 附属断言。'),
  [
    ins('附属目标用启发式（横置未附属非精英）而非 context.enemy 直接定位，属已披露近似。', 'impl-vs-text', 'src/cards/entries/08082.js:31-42', '改用 window context.enemy 或附属窗口原语，减少多敌人误差。', 'medium'),
  ]))

// ── 08083 Medical Student ──────────────────────────────────────────────────
out.push(find('08083', 'gap', [
  cl('[reaction] After Medical Student enters play: Heal 1 damage and 1 horror from an investigator or [[Ally]] asset at your location.', 'approximation',
    'src/cards/entries/08083.js:12-40。调查员目标：api.healDamage/api.healHorror 正确；盟友支援目标：src/cards/entries/08083.js:38 调 api.healAsset(target, 1)（第二参应是 spec 对象，api-misc.js:759-768），**伤害治疗 0 点**，仅 addAssetHorror(target,-1) 治恐惧（且可把 horror 减成负数）。real-path probe：ally damage 1→1、horror 1→0',
    '印刷的一半效果（治愈盟友支援 1 点伤害）在真实引擎路径无效；只有调查员目标完全正确。'),
], P('perceivable', 'src/cards/entries/08083.js:26-30 api.choice + prompt（同地点调查员/盟友支援选项）', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:106-114', '只测调查员目标；盟友支援分支（含 healAsset 签名）无断言。'),
  [
    ins('盟友支援目标的「治愈 1 点伤害」不生效（api.healAsset 第二参传了数字而非 spec）。', 'impl-vs-text', 'src/cards/entries/08083.js:38 vs src/engine/api-misc.js:759-769', '改成 api.healAsset(target, { damage: 1, owner: ownerOfTarget }) 或 api.healAsset(target, { horror: 1, owner })，并补盟友目标测试。', 'high'),
    ins('addAssetHorror(target, -1) 可把支援 horror 写成 -1（目标本来 0 恐惧时）。', 'primitive', 'src/cards/entries/08083.js:38；src/engine/api-clue.js:67-71 无下限', '改用 api.healAsset(target,{horror:1,owner}) 走统一治疗入口。', 'medium'),
  ]))

// ── 08084 On the Trail (1) ─────────────────────────────────────────────────
out.push(find('08084', 'approximation', [
  cl('Choose an enemy at any location other than yours.', 'approximation',
    'src/cards/entries/08084.js:33-38 过滤 `!enemy.elite`：印刷与参考实现无精英排除（参考资源 Event/Events/OnTheTrail1.hs:26 `EnemyAt (not_ locationWithInvestigator)`）；probe：只有精英敌人时打出后日志「没有可选的其他地点敌人」',
    '未印的精英限制：场上有精英敌人时该卡无法选它。'),
  cl('Either move twice toward that enemy, or discover 1 clue at any empty location between you and the chosen enemy, along the shortest path to reach that enemy.', 'approximation',
    'src/cards/entries/08084.js:39-58；BFS 最短路径 + api.canMoveTo/api.moveInvestigator；「empty = 无调查员且无敌人」与参考实现 EmptyLocation 一致（参考 Game.hs `EmptyLocation -> investigatorAt/enemyAt 均为空`）',
    '路径/线索语义与参考一致；仅 enemy 过滤不等价。'),
], P('perceivable', 'src/cards/entries/08084.js:36-45,56-57 api.choice + prompt；移动结果牌桌可见', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:116-133', '测移动与线索分支；未测精英敌人（被错误排除的路径）。'),
  [
    ins('未印的「非精英」过滤：印刷为 any enemy。', 'impl-vs-text', 'src/cards/entries/08084.js:33-34', '删除 `!enemy.elite`（参考实现无此限制），并补精英目标测试。', 'medium'),
  ]))

// ── 08085 On the Trail (3) ─────────────────────────────────────────────────
out.push(find('08085', 'approximation', [
  cl('Choose an enemy at any location other than yours.', 'approximation', 'src/cards/entries/08085.js:32-38 同样过滤 `!enemy.elite`；参考 OnTheTrail3.hs:34 无精英排除', '未印的精英限制，同 08084。'),
  cl('Move twice toward that enemy. Discover 1 clue at each location you entered by this effect.', 'implemented', 'src/cards/entries/08085.js:39-44（逐次移动后 api.discoverClue）', '未先判 canDiscoverClueAt，无可发现线索时静默不发现（可接受）。'),
], P('perceivable', 'src/cards/entries/08085.js:35-43 api.choice/prompt + 移动日志', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:135-146', '未测精英敌人排除路径。'),
  [
    ins('同 08084：未印的精英排除。', 'impl-vs-text', 'src/cards/entries/08085.js:32-34', '与 08084 同步修正。', 'medium'),
    ins('08084/08085 各自复制一份 pathTo BFS（src/cards/entries/08084.js:10-26 与 08085.js:9-25），应上收为共享原语。', 'duplication', 'src/cards/entries/08084.js:10-26；src/cards/entries/08085.js:9-25', '抽到 entries/_shared 或引擎 map-graph 原语。', 'low'),
  ]))

// ── 08086 Michael Leigh ────────────────────────────────────────────────────
out.push(find('08086', 'approximation', [
  cl('You get +1 [intellect] and +1 [combat].', 'implemented', 'src/cards/entries/08086.js:34-37'),
  cl('[reaction] After you successfully investigate: Place 1 resource (from the token pool) on Michael Leigh, as evidence (to a maximum of 3 evidence).', 'implemented', 'src/cards/entries/08086.js:23-27（uses 当证据，上限 3）', '用 uses 表示 evidence，未新造字段。'),
  cl('[reaction] When you initiate an attack, exhaust Michael Leigh and spend 1 evidence: You deal +1 damage for this attack.', 'approximation',
    'src/cards/entries/08086.js:28-32 用 api.addExtraOnSuccess({type:\'dealDamage\'})，成功后追加 1 伤害而不是并入本次攻击伤害；引擎 P6 原语 api.playerTools.addAttackDamageBonus（src/engine/api-misc.js:1490-1497，消费点 combat.js:276-281，primitives test:238；queue m2-3-08086=done）未被使用',
    '与「本次攻击 +1 伤害」不等价（攻击伤害被别的效果放大/引用时不同），且现成读点未接线。'),
], P('perceivable', 'src/cards/entries/08086.js:23-32 label/成本；额外伤害无 api.info，靠战斗日志', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:148-158,396-406', '两条测试都只断言 extraOnSuccess 登记、未在真实战斗里验证追加伤害；且未使用已就绪原语。'),
  [
    ins('P6 原语 addAttackDamageBonus 已实现并测试，但条目仍用 addExtraOnSuccess 近似（账本 verified/simplified=false 与 queue done 未反映）。', 'primitive', 'src/cards/entries/08086.js:32 vs src/engine/api-misc.js:1490-1497；src/engine/combat.js:276-281；tests/eote-player-primitives.test.mjs:238', '改为 api.playerTools.addAttackDamageBonus(1)，并把近似从注释/账本移除。', 'medium'),
    ins('D2：额外伤害无 api.info 日志。', 'perceivability', 'src/cards/entries/08086.js:32', '追加 api.info（+1 伤害）。', 'low'),
  ]))

// ── 08087 Snipe ────────────────────────────────────────────────────────────
out.push(find('08087', 'approximation', [
  cl('During the next fight action you perform this turn using a [[Ranged]] or [[Firearm]] asset, treat each [skull], [cultist], [tablet], [elder_thing], or [auto_fail] token you reveal as a "0" token.', 'approximation',
    'src/cards/entries/08087.js:19-30（addEffect tokenEffectWouldResolve + cancelSymbolToken）；probe：本回合任意检定揭示 skull 都会被取消符号效果（值按 0 计入），不限于「下一个远程/枪械攻击行动」',
    '作用域过宽（本条注释 9-11 已披露）；另外仅取消符号修正、[auto_fail] 不在 cancelSymbolToken 覆盖内。'),
  cl('This action does not provoke attacks of opportunity.', 'missing', 'src/cards/entries/08087.js:12 自述无延迟 noOpportunityAttack 读点（queue m2-3-08087 rejected）', '整句未实现。'),
], P('perceivable', 'src/cards/entries/08087.js:24 效果 label；无 choice/info', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:350-358', '只断言 effect 数据结构，未跑真实检定验证「视为 0」；未测不引发借机攻击（未实现）。'),
  [
    ins('「本行动不引发借机攻击」未实现，且作用域是「本回合所有检定」而非「下一个远程/枪械攻击」。', 'impl-vs-text', 'src/cards/entries/08087.js:9-12,19-30', '补延迟 noOpportunityAttack 读点；用「下一次匹配攻击」的效果作用域。', 'medium'),
  ]))

// ── 08088 Old Shotgun ──────────────────────────────────────────────────────
out.push(find('08088', 'gap', [
  cl('Uses (0 ammo).', 'implemented', 'src/cards/entries/08088.js:16-17'),
  cl('While playing an event, treat Old Shotgun\'s uses value as 2.', 'approximation',
    'src/cards/entries/08088.js:22-24：eventPlayed 窗口把 uses 永久 setAssetUses(2)，且 criteria 未限定打牌者/同地点。probe：其他座位打出事件也触发；触发后 uses 停在 2、不恢复（0→2→2）',
    '与印刷「打出事件期间视为 2」不等价：变为事件后永久 2 发可花弹药（可反复触发事件刷新），且跨座位触发。条目无 note 披露。'),
  cl('[action] Spend 1 ammo: Fight. You get +3 [combat] for this attack.', 'implemented', 'src/cards/entries/08088.js:19-21（combatBonus:3）'),
  cl('Instead of its standard damage, this attack\'s damage is equal to the amount you succeed by, or fail by if you fail and would damage another investigator (to a minimum of 1, to a maximum of 3).', 'implemented',
    'src/cards/entries/08088.js:20-21 successDamage/minDamage/maxDamage/failByAmountToEngaged；读点 src/engine/combat.js:292-296,518-519'),
], P('perceivable', 'src/cards/entries/08088.js:19-24 legalMoves 标签显示 uses/费用；攻击结果走战斗日志', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:160-172', '断言事件后 uses=2 与伤害上限；未覆盖「不该永久 2」「其他座位事件」的反向断言。'),
  [
    ins('eventPlayed 反应把 uses 永久设为 2 且不限打牌者，等价于事件后永续 2 发弹药（未披露的规则偏差）。', 'impl-vs-text', 'src/cards/entries/08088.js:22-24 vs src/engine/actions.js:520-523', '改为「打出事件的费用/结算窗口内视为 2」的作用域（或用 modifiers playCost 无关字段），至少加 criteria 限自身且结算后恢复 0；并补 note。', 'high'),
  ]))

// ── 08089 Quickdraw Holster ────────────────────────────────────────────────
out.push(find('08089', 'approximation', [
  cl('[fast]: Choose a [[Firearm]] asset taking up only 1 hand slot in your play area. Attach it to Quickdraw Holster, or switch it with the attached asset.', 'approximation',
    'src/cards/entries/08089.js:19-31；`api.attachOrSwapControlledAsset`（src/engine/api-card.js:75-91）；条目注释 10-11 披露未校验「只占 1 手槽」', '双手枪械也能被附属。'),
  cl('The attached asset takes up no hand slots. (Limit 1 attached asset.)', 'implemented', 'src/cards/entries/08089.js:30；槽位豁免读点 src/engine/assets.js（attachedToAsset 不占槽）', ''),
  cl('[fast] Exhaust Quickdraw Holster: Perform a fight action on the attached asset without paying its [action] cost.', 'approximation',
    'src/cards/entries/08089.js:32-41：固定取「第一条含攻击/开火/射击的 action」；注释 12 已披露', '多攻击能力枪械可能取错。'),
], P('perceivable', 'src/cards/entries/08089.js:27-30 api.choice+prompt；执行能力走 resolveCardAbility 原生流程', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:360-370', '真实 move 驱动附属+免费攻击。'),
  [
    ins('未校验「只占 1 个手部槽位」，双手武器也可附属（已披露近似）。', 'impl-vs-text', 'src/cards/entries/08089.js:22-25', '用槽位查询原语（normalizedSlots/slotUsage）过滤 handx2。', 'medium'),
  ]))

// ── 08090 Brand of Cthugha (1) ─────────────────────────────────────────────
out.push(find('08090', 'match', [
  cl('Uses (6 charges).', 'implemented', 'src/cards/entries/08090.js:15-16'),
  cl('[action]: Fight. For this attack, you may use [willpower] instead of [combat], and you get +1 skill value.', 'implemented', 'src/cards/entries/08090.js:22-26 api.choice 技能 + combatBonus:1'),
  cl('If you succeed, spend 1 or 2 charges. Instead of its standard damage, this attack deals 1 damage for each charge spent.', 'implemented', 'src/cards/entries/08090.js:27-35 onSuccess api.choice/ spendUses / damageOverride'),
  cl('If you succeed by 0, lose 1 action.', 'implemented', 'src/cards/entries/08090.js:36；api.loseActions 见 api-misc.js:303-317'),
], P('perceivable', 'src/cards/entries/08090.js:22-35 两个 api.choice+prompt；花费/伤害日志', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:174-184', '真实能力 move + 充能/伤害断言。'),
  [ins('0 充能时仍可发起攻击并在成功后 0 伤害（印刷需成功时花 1/2 充能，应不能发起）。', 'impl-vs-text', 'src/cards/entries/08090.js:18-28', '加 criteria (source.uses||0)>0。', 'low')]))

// ── 08091 Nkosi Mabati ─────────────────────────────────────────────────────
out.push(find('08091', 'gap', [
  cl('[reaction] After Nkosi Mabati enters play: Name a non-[elder_sign] chaos token with a symbol. Until this card leaves play, the named symbol is your "sigil."', 'approximation',
    'src/cards/entries/08091.js:25-45 用 api.addEffect({duration:\'untilLeavesPlay\'}) 记录，未写支援实例；引擎已有专用原语 api.playerTools.setSigilToken（src/engine/api-misc.js:1418-1431，primitives test:197）', '记录方式可用但与既有原语不同（D5），且未接线。'),
  cl('[reaction] When an investigator at your location reveals a [cultist], [tablet], or [elder_thing] symbol, exhaust Nkosi Mabati: Search the chaos bag for your sigil and reveal it, instead.', 'missing',
    'src/cards/entries/08091.js:14-16 自述省略该子句（queue m2-3-08091=done）；引擎原语 api.playerTools.replaceRevealedToken（src/engine/api-misc.js:1432-1442，tokenReveal 窗口）与 setSigilToken 均已实现并有测试（tests/eote-player-primitives.test.mjs:197-216）',
    '整条能力缺失。'),
], P('perceivable', 'src/cards/entries/08091.js:31-34 api.choice+prompt、44 api.info', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:372-382', '只测第一子句（addEffect 记录），第二子句无测试（未实现）。'),
  [
    ins('第二子句（符号揭示改为查找并揭示咒印）整条缺失，而引擎专用原语已实现并测试（queue 也标 done）。', 'impl-vs-text', 'src/cards/entries/08091.js:14-16,25-45 vs src/engine/api-misc.js:1418-1442；tests/eote-player-primitives.test.mjs:197', '把两条子句改接 setSigilToken + replaceRevealedToken（tokenReveal 窗口），删掉 primitive request 说法并更新账本。', 'high'),
    ins('prior 账本 verified/simplified=false，与条目自述「省略该子句」矛盾。', 'docs', 'audit/eote-player-acceptance.json（08091 verified）；audit/eote-player-queue.json m2-3-08091 done', '账本改记 gap/approximation。', 'medium'),
  ]))

// ── 08092 Brand of Cthugha (4) ─────────────────────────────────────────────
out.push(find('08092', 'match', [
  cl('Uses (9 charges).', 'implemented', 'src/cards/entries/08092.js:13-14'),
  cl('[action]: Fight ... +2 skill value ... may use [willpower] instead of [combat].', 'implemented', 'src/cards/entries/08092.js:20-24'),
  cl('If you succeed, spend 1, 2, or 3 charges; 1 damage per charge spent.', 'implemented', 'src/cards/entries/08092.js:25-33'),
  cl('If you succeed by 0, lose 2 actions.', 'implemented', 'src/cards/entries/08092.js:34'),
], P('perceivable', 'src/cards/entries/08092.js:20-33 api.choice+prompt', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:186-196', ''),
  [ins('同 08090：0 充能时仍可发起（成功后 0 伤害）。', 'impl-vs-text', 'src/cards/entries/08092.js:16-26', '加 criteria。', 'low')]))

// ── 08093 Cyclopean Hammer ─────────────────────────────────────────────────
out.push(find('08093', 'approximation', [
  cl('[action]: Fight. Add your [willpower] to your skill value for this attack. You deal +1 damage for this attack.', 'implemented', 'src/cards/entries/08093.js:22（addSkill:willpower, damageBonus:1）'),
  cl('If you succeed and the enemy is non-[[Elite]], you may move it one location away from you.', 'approximation',
    'src/cards/entries/08093.js:26-36：非精英才可移动 ✓，但「may」被强制（只有一个目的地时直接移动，无 skip 选项）；且每一步只排除 inv.location，第二次移动可能横向/回调近你',
    '可选被强制 + 连移两格时「away」判定不严格。'),
  cl('(If you succeed by 3 or more, you instead deal +2 damage and may move the enemy up to two locations away from you.)', 'implemented', 'src/cards/entries/08093.js:24-27'),
], P('perceivable', 'src/cards/entries/08093.js:31-34 api.choice+prompt', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:198-208', '伤害+击退断言。'),
  [
    ins('卡面「你可以」被实现为必移（单目的地时不经询问），且两格击退的「away」每步只排除原地点。', 'impl-vs-text', 'src/cards/entries/08093.js:26-36', '加 canSkip/先问，并按「距离你不减」过滤后续目的地。', 'medium'),
  ]))

// ── 08094 / 08096 Sledgehammer ─────────────────────────────────────────────
out.push(find('08094', 'match', [
  cl('[action]: Fight. You get -1 [combat] and deal +1 damage for this attack.', 'implemented', 'src/cards/entries/08094.js:10-11'),
  cl('[action] [action]: Fight. You get +2 [combat] and deal +2 damage for this attack.', 'implemented', 'src/cards/entries/08094.js:12-13（cost.action:2）'),
], P('perceivable', 'src/cards/entries/08094.js:10-13 legalMoves 两条标签', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:210-221', ''),
  [ins('与 08096 同模板复制（仅数值不同），可抽共享模板。', 'duplication', 'src/cards/entries/08094.js:10-13；src/cards/entries/08096.js:10-13', '低优先。', 'low')]))

out.push(find('08095', 'match', [
  cl('[reaction] When you draw a [[Hazard]] treachery, deal 1 damage and 1 horror to Protective Gear: Cancel that card\'s revelation effect.', 'implemented',
    'src/cards/entries/08095.js:12-21：费用 cost.assetDamage:1（ability-exec.js:159-167）+ api.addAssetHorror + api.playerTools.cancelRevelation（player-mechanics.js:101-105）；real-path probe：真实 treachery 窗口提供该反应，gear damage/horror 各 1'),
], P('perceivable', 'src/cards/entries/08095.js:12-21 反应窗口选项 label；受伤害在支援上可见', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:222-234', '危险/非危险 + 取消分支。')))

out.push(find('08096', 'match', [
  cl('[action]: Fight. You get +1 [combat] and deal +1 damage for this attack.', 'implemented', 'src/cards/entries/08096.js:10-11'),
  cl('[action] [action] [action]: Fight. You get +5 [combat] and deal +5 damage for this attack.', 'implemented', 'src/cards/entries/08096.js:12-13（cost.action:3）'),
], P('perceivable', 'src/cards/entries/08096.js:10-13 legalMoves 两条标签', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:210-221', '')))

console.log('part1', out.length)
fs.writeFileSync(path.join(OUT, '_findings-part1.json'), JSON.stringify(out, null, 1))
