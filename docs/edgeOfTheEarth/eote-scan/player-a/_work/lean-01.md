
========================================================================================
## 08019 Geared Up / 全副武装 [asset|guardian|xp:0|deckLimit:1] traits:Talent
EN: Permanent. Limit 1 per deck. Purchase at deck creation.
Forced - When your first turn of the game begins: One at a time, play any number of [[Item]] assets from your hand, reducing the cost of each by 1. During this turn, you have 3 fewer actions to take.
ZH: (与条目注释重复，已省略)
--- entries/08019.js ---
  1| // 08019 全副武装
  2| // 卡面：永久。每套牌库仅限1张。当构建牌库时购买。
  3| // 强制 - 在你游戏的第一个回合开始时：从手中打出任意张数的[[道具]]支援，每张费用-1。
  4| //        你本回合期间少进行三次行动。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // 口径：
 10| //   · 永久卡由引擎 setup 的 permanent 循环自动进场，本条目不写 setup 钩子；
 11| //   · 第一回合开始窗口 = turnBegins（criteria 用 round===1 锁定「你游戏的第一个回合」；
 12| //     多人时只有该调查员自己的回合开始才会拿到 context.seat 匹配）；
 13| //   · 打出道具支援走 api.playCardFromHandFree（noAction，避免再花行动；discount:1 等于费用 -1）；
 14| //   · 少进行三次行动 = api.loseActions(seat, 3)。
 15| const isItemAsset = (api, code) => api.cardType(code) === 'asset'
 16|   && api.cardTraits(code).some(trait => trait === 'item')
 17| 
 18| export default {
 19|   code: '08019',
 20|   abilities: [
 21|     {
 22|       kind: 'forced',
 23|       trigger: 'turnBegins',
 24|       label: '第一回合开始：从手中打出任意张[[道具]]支援（每张费用-1），本回合少 3 个行动',
 25|       criteria: ({ state, inv, context }) => state.round === 1
 26|         && state.currentSeat === inv.seat
 27|         && (context?.seat == null || context.seat === inv.seat)
 28|         && (inv.assets || []).some(card => card.code === '08019'),
 29|       resolve: ({ inv, api }) => {
 30|         for (let guard = 0; guard < 10; guard++) {
 31|           const candidates = (inv.hand || []).filter(code => isItemAsset(api, code))
 32|           if (!candidates.length) break
 33|           const answer = api.choice({
 34|             kind: 'card', source: '08019', seat: inv.seat, canSkip: true,
 35|             prompt: '全副武装：从手中打出任意张数[[道具]]支援（每张费用-1）。',
 36|             options: [
 37|               { id: 'done', label: '完成打出' },
 38|               ...candidates.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) })),
 39|             ],
 40|           })
 41|           if (answer === 'done' || answer == null) break
 42|           const code = candidates[Number(answer)]
 43|           if (!code) break
 44|           api.playCardFromHandFree(inv.seat, code, { noAction: true, discount: 1 })
 45|         }
 46|         api.loseActions(inv.seat, 3)
 47|         api.info('全副武装：本回合少进行三次行动。')
 48|       },
 49|     },
 50|   ],
 51|   modifiers: [],
 52| }
 53| 

========================================================================================
## 08020 Toe to Toe / 正面迎击 [event|guardian|xp:0|deckLimit:2|cost:0] traits:Spirit,Tactic
EN: Fight. This attack deals +1 damage and is automatically successful. As an additional cost to perform this attack, the chosen enemy makes an attack against you.
ZH: (与条目注释重复，已省略)
--- entries/08020.js ---
  1| // 08020 正面迎击
  2| // 卡面：攻击。本次攻击造成 +1 伤害并自动成功。作为执行本次攻击的额外费用，所选敌人攻击你。
  3| //
  4| // 一张卡一个文件：这张卡的行为只在这里维护。
  5| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  6| //
  7| // approximation：doFight 只能走混乱标记检定，没有「自动成功」选项。这里用「跳过检定、直接按
  8| // 本次攻击的伤害（基础 1 +1）结算伤害」表达自动成功的核心结果；攻击检定窗口/失败触发不会发生。
  9| // 额外费用（敌人先攻击你）用 api.enemyAttackByCard 先结算，与卡面顺序一致。
 10| import { attackableEnemies } from './_shared.js'
 11| 
 12| export default {
 13|   code: '08020',
 14|   abilities: [
 15|     {
 16|       kind: 'played',
 17|       countsAs: 'fight',
 18|       noOpportunityAttack: true,
 19|       label: '攻击：本次攻击自动成功并 +1 伤害；额外费用：所选敌人先攻击你',
 20|       resolve: ({ state, inv, api }) => {
 21|         const targets = attackableEnemies(state, inv)
 22|         if (!targets.length) {
 23|           api.info('正面迎击：没有可攻击的敌人。')
 24|           return
 25|         }
 26|         const chosen = targets.length === 1 ? targets[0].id : api.choice({
 27|           kind: 'target', source: '08020', seat: inv.seat,
 28|           prompt: '正面迎击：选择攻击目标（它会先攻击你）。',
 29|           options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
 30|         })
 31|         const enemy = targets.find(item => item.id === chosen) || targets[0]
 32|         // 额外费用：所选敌人攻击你。
 33|         api.info(`正面迎击：作为额外费用，「${enemy.name}」攻击 ${inv.name}。`)
 34|         api.enemyAttackByCard(enemy, `${api.cardName('08020')}：额外费用`, inv.seat)
 35|         // 自动成功的攻击：本次攻击造成 2 点伤害（基础 1 + 1）。
 36|         const current = (api.enemiesAt(inv.location) || []).find(item => item.id === enemy.id)
 37|         if (current) {
 38|           api.damageEnemy(current, 2, inv.seat)
 39|           api.info(`正面迎击：「${enemy.name}」自动被击中，受到 2 点伤害。`)
 40|         }
 41|       },
 42|     },
 43|   ],
 44|   modifiers: [],
 45| }
 46| 

========================================================================================
## 08021 "Get behind me!" / “到我身后！” [event|guardian|xp:0|deckLimit:2|cost:0] traits:Spirit,Tactic
EN: Fast. Play during any [fast] window.
Until the end of the phase, whenever an enemy would attack another investigator at your location, it attacks you instead, then engages you. Cancel 1 horror dealt by each attack made in this way.
ZH: (与条目注释重复，已省略)
--- entries/08021.js ---
  1| // 08021 “到我身后！”
  2| // 卡面：快速。可在任何[free]时间段期间打出。
  3| //       直到本阶段结束，每次敌人攻击你所在地点的另一位调查员时，改为攻击你，然后与你交战。
  4| //       取消每次这种攻击造成的 1 点恐惧。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // approximation：引擎没有「持续到阶段结束的攻击改向」读点（08021 原语请求 m2-1-08021.json）。
 10| // 这里退化成与 03106「英勇救援」同构的手牌快速反应：在「同地点另一位调查员被攻击」的 enemyAttack
 11| // 窗口打出一次，取消原攻击 → 敌人改为攻击你并交战 → 结算后治愈 1 点恐惧（等价于取消该次 1 点恐惧，
 12| // 差别是不会触发「取消伤害/恐惧」的窗口）。持续整阶段的多次拦截没有建模。
 13| import { ownSeat } from '../../engine/matcher.js'
 14| 
 15| export default {
 16|   code: '08021',
 17|   abilities: [
 18|     {
 19|       kind: 'played',
 20|       fast: true,
 21|       trigger: 'enemyAttack',
 22|       criteria: [
 23|         ownSeat(),
 24|         ({ inv, context }) => {
 25|           const ctx = context?.context || context || {}
 26|           return Boolean(ctx.enemy) && ctx.seat !== inv.seat && ctx.location === inv.location
 27|         },
 28|       ],
 29|       label: '另一位调查员被攻击时：改为攻击你并交战，取消该次攻击造成的 1 点恐惧',
 30|       resolve: ({ inv, api }) => {
 31|         const raw = api.reactionContext()
 32|         const ctx = raw?.context || raw
 33|         const enemy = ctx?.enemy
 34|         if (!enemy) return
 35|         // 取消原攻击，再让该敌人改为攻击你。
 36|         api.cancelCurrentAttack(ctx)
 37|         api.engage(enemy, inv.seat)
 38|         api.info(`“到我身后！”：${inv.name} 替同地点的调查员承受「${enemy.name}」的攻击。`)
 39|         api.enemyAttackByCard(enemy, api.cardName('08021'), inv.seat)
 40|         // 取消每次这种攻击造成的 1 点恐惧（近似：结算后治愈 1 点恐惧）。
 41|         api.healHorror(inv.seat, 1)
 42|       },
 43|     },
 44|   ],
 45|   modifiers: [],
 46| }
 47| 

========================================================================================
## 08022 Gang Up / 成群结队 [event|guardian|xp:1|deckLimit:2|cost:3] traits:Spirit,Synergy
EN: Fight. For each different class among cards you control, you get +1 [combat] and deal +1 damage for this attack.
ZH: (与条目注释重复，已省略)
--- entries/08022.js ---
  1| // 08022 成群结队
  2| // 卡面：攻击。你每控制一张不同职阶的卡牌，你本次攻击得到 +1[combat]，造成 +1 伤害。
  3| //
  4| // 一张卡一个文件：这张卡的行为只在这里维护。
  5| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  6| //
  7| // 口径：「你每控制一张不同职阶的卡牌」= 你控制的卡牌中不同职阶（faction）的数量（中立不计入
  8| // 「职阶」）；用 api.cardFactions 读取每张在场卡牌的职阶，攻击走 api.fight 的临时 combatBonus/
  9| // damageBonus（不产生持续状态）。
 10| import { attackableEnemies } from './_shared.js'
 11| 
 12| export default {
 13|   code: '08022',
 14|   abilities: [
 15|     {
 16|       kind: 'played',
 17|       countsAs: 'fight',
 18|       noOpportunityAttack: true,
 19|       label: '攻击：每控制一张不同职阶的卡牌，+1[combat] 且 +1 伤害',
 20|       resolve: ({ state, inv, api }) => {
 21|         const targets = attackableEnemies(state, inv)
 22|         if (!targets.length) {
 23|           api.info('没有可攻击的敌人。')
 24|           return
 25|         }
 26|         const chosen = targets.length === 1 ? targets[0].id : api.choice({
 27|           kind: 'target', source: '08022', seat: inv.seat,
 28|           prompt: '成群结队：选择攻击目标。',
 29|           options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
 30|         })
 31|         const enemy = targets.find(item => item.id === chosen) || targets[0]
 32|         const classes = new Set((inv.assets || [])
 33|           .flatMap(card => api.cardFactions(card.code))
 34|           .filter(faction => faction && faction !== 'neutral'))
 35|         const bonus = Math.min(5, classes.size)
 36|         api.fight(inv.seat, enemy.id, {
 37|           combatBonus: bonus, damageBonus: bonus, noSpend: true, sourceCode: '08022',
 38|           presentationCardCode: '08022',
 39|         })
 40|       },
 41|     },
 42|   ],
 43|   modifiers: [],
 44| }
 45| 

========================================================================================
## 08023 Sweeping Kick / 扫堂腿 [event|guardian|xp:1|deckLimit:2|cost:1] traits:Spirit,Tactic,Trick
EN: Fight. Add your [agility] to your skill value for this attack. This attack deals +1 damage. If you succeed, automatically evade the attacked enemy.
ZH: (与条目注释重复，已省略)
--- entries/08023.js ---
  1| // 08023 扫堂腿
  2| // 卡面：攻击。本次攻击将你的[agility]加入你的技能值。本次攻击造成 +1 伤害。
  3| //       如果你成功，自动躲避受到本次攻击的敌人。
  4| //
  5| // 一张卡一个文件：这张卡的行为只在这里维护。
  6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  7| //
  8| // 口径：doFight 的 addSkill:'agility' 把敏捷值加到本次攻击技能值；autoEvadeOnSuccessBy:0
  9| // 表示「成功即自动躲避」；伤害 +1 走 damageBonus。
 10| import { attackableEnemies } from './_shared.js'
 11| 
 12| export default {
 13|   code: '08023',
 14|   abilities: [
 15|     {
 16|       kind: 'played',
 17|       countsAs: 'fight',
 18|       noOpportunityAttack: true,
 19|       label: '攻击：加入[agility]，+1 伤害，成功则自动躲避该敌人',
 20|       resolve: ({ state, inv, api }) => {
 21|         const targets = attackableEnemies(state, inv)
 22|         if (!targets.length) {
 23|           api.info('没有可攻击的敌人。')
 24|           return
 25|         }
 26|         const chosen = targets.length === 1 ? targets[0].id : api.choice({
 27|           kind: 'target', source: '08023', seat: inv.seat,
 28|           prompt: '扫堂腿：选择攻击目标。',
 29|           options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
 30|         })
 31|         const enemy = targets.find(item => item.id === chosen) || targets[0]
 32|         api.fight(inv.seat, enemy.id, {
 33|           addSkill: 'agility', damageBonus: 1, autoEvadeOnSuccessBy: 0, noSpend: true,
 34|           sourceCode: '08023', presentationCardCode: '08023',
 35|         })
 36|       },
 37|     },
 38|   ],
 39|   modifiers: [],
 40| }
 41| 

========================================================================================
## 08024 Defensive Stance / 防御姿态 [skill|guardian|xp:1|deckLimit:2] traits:Practiced,Expert
EN: While Defensive Stance is in your hand or committed to a skill test, it gains [combat] icons equal to your [agility], and [agility] icons equal to your [combat].
ZH: (与条目注释重复，已省略)
--- entries/08024.js ---
  1| // 08024 防御姿态
  2| // 卡面：防御姿态在你手中或投入到技能检定中时，其获得等于你[agility]的[combat]图标，
  3| //       以及等于你[combat]的[agility]图标。
  4| //
  5| // 一张卡一个文件：这张卡的行为只在这里维护。
  6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  7| //
  8| // approximation：commit 描述符的 iconBonus 上下文没有 getStat（原语请求 m2-1-08024.json），
  9| // 这里用调查员印刷基值（ALL_CARDS）计算两向图标——无属性修正/装备加值时与有效值一致；
 10| // 有修正时图标不会随之变化。获得的两组图标都按当前检定的技能计入 commitIcons。
 11| import { ALL_CARDS } from '../../cards/cards-data.js'
 12| 
 13| const baseStat = (inv, skill) => Number(ALL_CARDS[inv?.code]?.[skill]) || 0
 14| 
 15| export default {
 16|   code: '08024',
 17|   abilities: [
 18|     {
 19|       kind: 'commit',
 20|       label: '手中/投入时：获得等于[agility]的[combat]图标、等于[combat]的[agility]图标',
 21|       skill: {
 22|         // 投入战斗检定时提供「等于敏捷」的图标；投入敏捷检定时提供「等于战斗」的图标。
 23|         // 引擎在真实检定管线里传入 skillList 数组，这里同时兼容字符串（印刷基值近似仍保留）。
 24|         iconBonus: ({ inv, skill }) => {
 25|           const skills = Array.isArray(skill) ? skill : [skill]
 26|           return skills.includes('combat') ? baseStat(inv, 'agility')
 27|             : skills.includes('agility') ? baseStat(inv, 'combat') : 0
 28|         },
 29|       },
 30|     },
 31|   ],
 32|   modifiers: [],
 33| }
 34| 

========================================================================================
## 08025 Butterfly Swords / 蝴蝶对剑 [asset|guardian|xp:2|deckLimit:2|cost:3] traits:Item,Weapon,Melee
EN: [action]: Fight. You get +1 [combat] for this attack. After this attack, you may exhaust Butterfly Swords to fight again, adding your [agility] to your skill value for that attack. That attack deals +1 damage.
ZH: (与条目注释重复，已省略)
--- entries/08025.js ---
  1| // 08025 蝴蝶对剑（等级 2）
  2| // 卡面：[action]：攻击。本次攻击你得到 +1[combat]。本次攻击后，你可以横置蝴蝶对剑再次
  3| //       进行攻击，这次攻击将你的[agility]加入你的技能值。这次攻击造成 +1 伤害。
  4| //
  5| // 一张卡一个文件：这张卡的行为只在这里维护。
  6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  7| //
  8| // 口径：第一次攻击用 api.fight（战斗 +1，skillBonus 走 combatBonus）；结算后询问是否横置
  9| // 进行第二次攻击（noSpend 不再花行动），第二次把敏捷加入技能值并 +1 伤害。敌人若在第一次
 10| // 攻击中被击败则跳过第二次。
 11| import { attackableEnemies } from './_shared.js'
 12| 
 13| export default {
 14|   code: '08025',
 15|   abilities: [
 16|     {
 17|       kind: 'action',
 18|       countsAs: 'fight',
 19|       label: '攻击（+1[combat]）；可横置再次攻击（加入[agility]，+1 伤害）',
 20|       cost: { action: true },
 21|       resolve: ({ state, inv, source, api }) => {
 22|         const targets = attackableEnemies(state, inv)
 23|         if (!targets.length) {
 24|           api.info('没有可攻击的敌人。')
 25|           return
 26|         }
 27|         const chosen = targets.length === 1 ? targets[0].id : api.choice({
 28|           kind: 'target', source: source.id, seat: inv.seat,
 29|           prompt: '蝴蝶对剑：选择攻击目标。',
 30|           options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
 31|         })
 32|         const enemy = targets.find(item => item.id === chosen) || targets[0]
 33|         api.fight(inv.seat, enemy.id, { assetId: source.id, combatBonus: 1, noSpend: true, sourceCode: '08025' })
 34|         if (!state.enemies.includes(enemy)) return
 35|         const again = api.choice({
 36|           kind: 'effect', source: source.id, seat: inv.seat, canSkip: true,
 37|           prompt: '本次攻击后：是否横置蝴蝶对剑再次攻击？',
 38|           options: [{ id: 'skip', label: '不再次攻击' }, { id: 'again', label: '横置并再次攻击（加入[agility]，+1 伤害）' }],
 39|         })
 40|         if (again !== 'again') return
 41|         api.exhaust(source)
 42|         api.fight(inv.seat, enemy.id, {
 43|           assetId: source.id, addSkill: 'agility', damageBonus: 1, noSpend: true, sourceCode: '08025',
 44|         })
 45|       },
 46|     },
 47|   ],
 48|   modifiers: [],
 49| }
 50| 

========================================================================================
## 08026 Dodge / 闪躲 [event|guardian|xp:2|deckLimit:2|cost:0] traits:Tactic
EN: Fast. Play when an enemy attacks an investigator at your location.
Cancel that attack. Then, test [agility] (1). If you succeed, deal 1 damage to that enemy.
ZH: (与条目注释重复，已省略)
--- entries/08026.js ---
  1| // 08026 闪躲
  2| // 卡面：快速。在一个敌人攻击你所在地点的一位调查员时打出。
  3| //       取消该次攻击。然后，检定[agility](1)。如果你成功，对该敌人造成 1 点伤害。
  4| //
  5| // 一张卡一个文件：这张卡的行为只在这里维护。
  6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  7| //
  8| // 口径：快速事件挂在 enemyAttack 窗口（played + fast + trigger）；取消写回窗口上下文的
  9| // cancelled（api.cancelCurrentAttack）；随后的一次敏捷(1)检定用 api.startTest（performTest），
 10| // 成功后的伤害在 resolve 回调里执行。
 11| export default {
 12|   code: '08026',
 13|   abilities: [
 14|     {
 15|       kind: 'played',
 16|       fast: true,
 17|       trigger: 'enemyAttack',
 18|       label: '取消该次攻击；敏捷(1)：成功则对该敌人造成 1 点伤害',
 19|       resolve: ({ inv, api }) => {
 20|         const raw = api.reactionContext()
 21|         const context = raw?.context || raw
 22|         const enemyId = context?.enemy?.id || null
 23|         api.cancelCurrentAttack(context)
 24|         api.info(`闪躲：取消了「${context?.enemy?.name || '敌人'}」的这次攻击。`)
 25|         api.startTest({
 26|           seat: inv.seat, skill: 'agility', difficulty: 1, source: { label: '闪躲', code: '08026' },
 27|           resolve: result => {
 28|             if (!result?.success || !enemyId) return
 29|             const target = (api.enemiesAt(inv.location) || []).find(item => item.id === enemyId)
 30|             if (target) api.damageEnemy(target, 1, inv.seat)
 31|           },
 32|         })
 33|       },
 34|     },
 35|   ],
 36|   modifiers: [],
 37| }
 38| 

========================================================================================
## 08027 Combat Training / 战斗训练 [asset|guardian|xp:3|deckLimit:2|cost:0] traits:Talent,Composure
EN: Fast. Limit 1 [[Composure]] in play.
You get +1 [combat] and +1 [agility].
Non-direct damage/horror must be assigned to Combat Training before it can be assigned to your investigator card.
[fast] Spend 1 resource: You get +1 [combat] or +1 [agility] for this skill test.
ZH: (与条目注释重复，已省略)
--- entries/08027.js ---
  1| // 08027 战斗训练
  2| // 卡面：快速。[[沉稳]]卡牌场上仅限1张。
  3| //       你得到 +1[combat] 和 +1[agility]。
  4| //       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给战斗训练。
  5| //       [free] 花费 1 资源：你本次技能检定得到 +1[combat] 或 +1[agility]。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // 口径：这是「沉稳」天赋的通用数据写法（与 03107 战斗训练同构）：
 11| //   · fast / composure 条目字段提供「快速」「沉稳场上仅限 1 张」「伤害必须优先分配」三个读点；
 12| //   · +1/+1 走 modifiers；
 13| //   · 每次技能检定花 1 资源 +1 走 freeTriggers。
 14| import { skillModifier } from './_shared.js'
 15| 
 16| export default {
 17|   code: '08027',
 18|   fast: true,
 19|   composure: true,
 20|   freeTriggers: [
 21|     { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
 22|     { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
 23|   ],
 24|   modifiers: [
 25|     skillModifier('combat', 1),
 26|     skillModifier('agility', 1),
 27|   ],
 28|   abilities: [],
 29| }
 30| 

========================================================================================
## 08028 On the Hunt / 追猎行动 [event|guardian|xp:3|deckLimit:2|cost:0] traits:Tactic
EN: Fast. Play when you would draw an encounter card during the mythos phase.
Instead, search the encounter deck for an enemy, spawn it engaged with you (instead of its normal spawn location), attach On the Hunt to it, and shuffle the encounter deck.
[reaction] When you defeat attached enemy: Gain 3 resources.
ZH: (与条目注释重复，已省略)
--- entries/08028.js ---
  1| // 08028 追猎行动
  2| // 卡面：快速。在神话阶段期间你将抽取遭遇卡牌时打出。
  3| //       改为从遭遇牌库中查找一个敌人，将其生成并与你交战(而非在本来的位置生成它)，
  4| //       将追猎行动附属到该敌人上，并混洗遭遇牌库。
  5| //       [reaction] 在你击败被附属的敌人时：获得 3 资源。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // approximation：
 11| //   · 遭遇牌库「查找」用只读 state.encounterDeck 枚举敌人 code + api.spawnEncounterEnemy（生成/交战/混洗
 12| //     都在该入口内完成）；
 13| //   · 没有「结算后的事件卡附到敌人」原语（请求 m2-1-08028.json），本实现不生成实体附属卡：用持续效果
 14| //     记录的 sourceInstanceId 指向被追猎的敌人来标记归属（敌人实体上没有 attached 卡，存档/投影里不可见）；
 15| //   · 击败奖励用该持续效果上的 defeatEnemy 反应（effect DSL gainResource 3）表达——效果有效期内任意
 16| //     敌人被击败都可触发一次（近似为「被附属敌人被击败」；duration endOfRound + oncePerGame 限制滥触发）。
 17| const isEnemy = (api, code) => api.cardType(code) === 'enemy'
 18| 
 19| export default {
 20|   code: '08028',
 21|   abilities: [
 22|     {
 23|       kind: 'played',
 24|       fast: true,
 25|       trigger: 'mythosEncounterStep',
 26|       label: '神话阶段抽遭遇前：从遭遇牌库查找一个敌人生成并与你交战，附属本卡；击败被附属敌人获得 3 资源',
 27|       resolve: ({ state, inv, api }) => {
 28|         const candidates = [...new Set((state.encounterDeck || []).filter(code => isEnemy(api, code)))]
 29|         if (!candidates.length) {
 30|           api.info('追猎行动：遭遇牌库中没有敌人。')
 31|           return
 32|         }
 33|         const chosen = candidates.length === 1 ? candidates[0] : api.choice({
 34|           kind: 'encounter', source: '08028', seat: inv.seat,
 35|           prompt: '追猎行动：从遭遇牌库中查找一个敌人。',
 36|           options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
 37|         })
 38|         const code = candidates.includes(chosen) ? chosen : candidates[0]
 39|         const spawned = api.spawnEncounterEnemy(inv.seat, code)
 40|         if (!spawned) {
 41|           api.info('追猎行动：无法生成该敌人。')
 42|           return
 43|         }
 44|         api.info(`追猎行动：「${api.cardName(code)}」在 ${inv.name} 的地点生成并交战；遭遇牌库已混洗。`)
 45|         api.addEffect({
 46|           duration: 'endOfRound',
 47|           sourceCode: '08028',
 48|           sourceInstanceId: spawned.id,
 49|           label: '追猎行动：击败被追猎的敌人获得 3 资源',
 50|           modifiers: [],
 51|           abilities: [{
 52|             kind: 'reaction',
 53|             trigger: 'defeatEnemy',
 54|             label: '击败被追猎的敌人：获得 3 资源',
 55|             limit: 'oncePerGame',
 56|             effect: { type: 'gainResource', amount: 3 },
 57|           }],
 58|         })
 59|       },
 60|     },
 61|   ],
 62|   modifiers: [],
 63| }
 64| 
