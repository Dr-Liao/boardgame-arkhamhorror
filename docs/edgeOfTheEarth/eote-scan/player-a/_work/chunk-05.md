
==========================================================================================
## 08059 Down the Rabbit Hole / 掉进兔子洞  [asset|mystic|xp:0|deckLimit:1] traits:Talent
EN: Permanent. Limit 1 per deck. Purchase at deck creation.
After each scenario of a campaign, reduce the experience cost of the first 2 cards you upgrade before the next scenario by 1.
Increase the experience cost for you to purchase new cards by 1.
ZH: 永久。每套牌库仅限1张。当构建牌库时购买。
在一个剧本的每个冒险结束后，在下一场冒险之前，你升级的前2张卡牌经验值费用-1。
你购买新卡牌所需要的经验值加1。
--- src/cards/entries/08059.js (29 lines) ---
  1| // 08059 掉进兔子洞（Down the Rabbit Hole）· 秘术师资产 · 永久（建库时购买，限 1 张）。
  2| //
  3| // 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
  4| //       在一个剧本的每个冒险结束后，在下一场冒险之前，你升级的前 2 张卡牌经验值费用 -1。
  5| //       你购买新卡牌所需要的经验值加 1。
  6| //
  7| // 一卡一文件：这张卡的行为只在这里维护。
  8| // approximation: 这是建库/升级经验计价（hub/campaign 层）的规则；引擎没有计价钩子。这里用
  9| // setup 描述子把身份与两条参数写进场景标记（api.setScenarioFlag('downTheRabbitHole', {...})），
 10| // 供 P7 战役升级层读取；游玩内暂无直接效果。真实计价接线见报告 approximation 清单。
 11| export default {
 12|   code: '08059',
 13|   abilities: [
 14|     {
 15|       kind: 'setup',
 16|       label: '建库身份：记录「前 2 张升级 -1 经验 / 新购卡 +1 经验」参数',
 17|       resolve: ({ api }) => {
 18|         api.setScenarioFlag('downTheRabbitHole', {
 19|           upgradeDiscountFirst: 2,
 20|           upgradeDiscountDelta: -1,
 21|           purchaseCostDelta: 1,
 22|         })
 23|         api.info('🐇 「掉进兔子洞」：已记录升级计价参数（前 2 张升级 -1 经验；新购卡 +1 经验）。')
 24|       },
 25|     },
 26|   ],
 27|   modifiers: [],
 28| }
 29| 
--- test hits (4) ---
eote-player-m2-2.test.mjs:31: import e08059 from '../src/cards/entries/08059.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:640: test('P6 08059 掉进兔子洞：建库身份参数写入场景标记（近似：真实升级计价待 P7）', () => {
eote-player-m2-2.test.mjs:642: runDescriptor(s, '08059', 'setup')

==========================================================================================
## 08060 Dragon Pole / 咏春棍  [asset|mystic|xp:0|deckLimit:2|cost:3] traits:Item,Weapon,Melee
EN: You have 1 additional arcane slot.
[action]: Fight. You get +1 [combat] for this attack for each of your arcane slots that is filled. If at least 2 of your arcane slots are filled, this attack deals +1 damage.
ZH: 你拥有1个额外的法术槽位。
[action]：攻击。你每有一个法术槽位有支援，你本次攻击得到+1[combat]。如果至少有2个法术槽位有支援，本次攻击+1伤害。
--- src/cards/entries/08060.js (35 lines) ---
  1| // 08060 咏春棍（Dragon Pole）· 秘术师（Mystic）资产 · 双手。
  2| //
  3| // 卡面：你拥有 1 个额外的法术槽位。
  4| //       [action]：攻击。你每有一个法术槽位有支援，你本次攻击得到 +1[combat]。
  5| //       如果至少有 2 个法术槽位有支援，本次攻击 +1 伤害。
  6| //
  7| // 一卡一文件：这张卡的行为只在这里维护。
  8| // 读点：add:slot 修正给额外法术槽；主技能检定用 api.fight 的 combatBonus / damageBonus 选项。
  9| import { ALL_CARDS } from '../../cards/cards-data.js'
 10| 
 11| // 「法术槽位有支援」= 你控制的印刷槽位含 Arcane 的支援数（当前无动态占槽原语，按印刷槽位计）。
 12| const filledArcaneSlots = inv => (inv.assets || []).filter(asset => /arcane/i.test(String(ALL_CARDS[asset.code]?.slot || ''))).length
 13| 
 14| export default {
 15|   code: '08060',
 16|   modifiers: [
 17|     { target: 'add:slot', value: 'arcane' },
 18|   ],
 19|   abilities: [
 20|     {
 21|       kind: 'action',
 22|       countsAs: 'fight',
 23|       cost: { action: true },
 24|       target: { kind: 'enemy' },
 25|       label: '攻击：每有一个已填法术槽 +1[combat]；至少 2 个则 +1 伤害',
 26|       resolve: ({ inv, target, api }) => {
 27|         if (!target) return
 28|         const filled = filledArcaneSlots(inv)
 29|         api.fight(inv.seat, target.id, { combatBonus: filled, damageBonus: filled >= 2 ? 1 : 0 })
 30|         api.info(`🥢 咏春棍：${filled} 个法术槽位有支援，本次攻击 +${filled}[combat]${filled >= 2 ? '、+1 伤害' : ''}。`)
 31|       },
 32|     },
 33|   ],
 34| }
 35| 
--- test hits (5) ---
eote-player-m2-2.test.mjs:32: import e08060 from '../src/cards/entries/08060.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:266: test('P6 08060 咏春棍：额外法术槽；每个已填槽 +1 战斗，至少 2 个则 +1 伤害', () => {
eote-player-m2-2.test.mjs:269: asset(s, '08060')
eote-player-m2-2.test.mjs:284: const barePole = asset(bare, '08060')

==========================================================================================
## 08061 Meditative Trance / 冥想放空  [event|mystic|xp:0|deckLimit:2|cost:2] traits:Insight,Spirit
EN: For each of your arcane slots that is filled, either heal 1 damage or 1 horror.
ZH: 你每有一个法术槽位有支援，治愈1点伤害或1点恐惧。
--- src/cards/entries/08061.js (46 lines) ---
  1| // 08061 冥想放空（Meditative Trance）· 秘术师（Mystic）事件。
  2| //
  3| // 卡面：你每有一个法术槽位有支援，治愈 1 点伤害或 1 点恐惧。
  4| //
  5| // 一卡一文件：这张卡的行为只在这里维护。
  6| // 读点：法术槽位按你控制的、印刷槽位含 Arcane 的支援数（同 08060 口径）；
  7| // 每次治愈由 api.healDamage / api.healHorror 结算。
  8| import { ALL_CARDS } from '../../cards/cards-data.js'
  9| 
 10| const filledArcaneSlots = inv => (inv.assets || []).filter(asset => /arcane/i.test(String(ALL_CARDS[asset.code]?.slot || ''))).length
 11| 
 12| export default {
 13|   code: '08061',
 14|   abilities: [
 15|     {
 16|       kind: 'played',
 17|       label: '每有一个已填法术槽，治愈 1 点伤害或恐惧',
 18|       resolve: ({ inv, api }) => {
 19|         let remaining = filledArcaneSlots(inv)
 20|         if (remaining <= 0) {
 21|           api.info('「冥想放空」：你没有已填的法术槽位，没有可治愈的伤害/恐惧。')
 22|           return
 23|         }
 24|         while (remaining > 0) {
 25|           const canDamage = (inv.damage || 0) > 0
 26|           const canHorror = (inv.horror || 0) > 0
 27|           if (!canDamage && !canHorror) break
 28|           let choice = canDamage && canHorror ? null : canDamage ? 'damage' : 'horror'
 29|           if (choice == null) {
 30|             choice = api.choice({
 31|               kind: 'effect', source: '08061', seat: inv.seat,
 32|               prompt: `「冥想放空」：治愈 1 点伤害还是 1 点恐惧？（还可治愈 ${remaining} 次）`,
 33|               options: [{ id: 'damage', label: '治愈 1 点伤害' }, { id: 'horror', label: '治愈 1 点恐惧' }],
 34|             })
 35|           }
 36|           if (choice === 'damage') api.healDamage(inv.seat, 1)
 37|           else api.healHorror(inv.seat, 1)
 38|           remaining -= 1
 39|         }
 40|         api.info(`🧘 「冥想放空」结算完成（已填法术槽 ${filledArcaneSlots(inv)} 个）。`)
 41|       },
 42|     },
 43|   ],
 44|   modifiers: [],
 45| }
 46| 
--- test hits (5) ---
eote-player-m2-2.test.mjs:33: import e08061 from '../src/cards/entries/08061.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:293: test('P6 08061 冥想放空：每个已填法术槽治愈 1 点伤害或恐惧', () => {
eote-player-m2-2.test.mjs:300: runDescriptor(s, '08061', 'played', { select: choice => (choice.options.some(option => option.id === 'damage') ? 'damage' : null) })
eote-player-m2-2.test.mjs:306: runDescriptor(none, '08061', 'played')

==========================================================================================
## 08062 Close the Circle / 闭环  [asset|mystic|xp:1|deckLimit:2|cost:2] traits:Ritual,Synergy
EN: Uses (1 charge for each class among cards you control, including this one).
[fast] Spend 1 charge and exhaust Close the Circle: Take a basic action. For each skill test performed during that action, you may use your [willpower] instead of the skill indicated for that action.
ZH: 使用(充能数等于你控制卡牌的职阶数，包含本卡牌)。
[free]花费1充能并横置闭环：执行一次基础行动。该行动期间执行的每次技能检定中，你可以不使用原本指示的技能，改为使用[willpower]。
--- src/cards/entries/08062.js (56 lines) ---
  1| // 08062 闭环（Close the Circle）· 秘术师资产 · 奥术 · 1 经验。
  2| //
  3| // 卡面：使用(充能数等于你控制卡牌的职阶数，包含本卡牌)。
  4| //       [fast] 花费 1 充能并横置闭环：执行一次基础行动。该行动期间执行的每次技能检定中，
  5| //       你可以不使用原本指示的技能，改为使用 [willpower]。
  6| //
  7| // 一卡一文件：这张卡的行为只在这里维护。
  8| // approximation: 「额外充能数 = 职阶数」用 entersPlay + api.setAssetUses 动态初值；
  9| // 「执行一次基础行动」用 api.beginImmediateAction({ basicOnly: true })。
 10| // 「技能检定改用 willpower」缺少 ctx.api 级的 substituteSkill 绑定时长，暂未接线（条目与报告标注）。
 11| import { ALL_CARDS } from '../../cards/cards-data.js'
 12| 
 13| const classCount = inv => {
 14|   const classes = new Set()
 15|   for (const asset of inv.assets || []) {
 16|     const klass = ALL_CARDS[asset.code]?.klass
 17|     if (klass) classes.add(String(klass).toLowerCase())
 18|   }
 19|   return classes.size
 20| }
 21| 
 22| export default {
 23|   code: '08062',
 24|   uses: 1,
 25|   usesType: 'charges',
 26|   abilities: [
 27|     {
 28|       kind: 'entersPlay',
 29|       label: '入场：充能数 = 你控制卡牌的职阶数（含本卡牌）',
 30|       resolve: ({ inv, source, api }) => {
 31|         if (!source) return
 32|         // 入场时机较晚：按当前受控资产职阶数（含本卡）设置。
 33|         const count = Math.max(1, classCount(inv))
 34|         api.setAssetUses(source, count)
 35|         api.info(`⭕ 「闭环」：入场时拥有 ${count} 充能（控制的职阶数）。`)
 36|       },
 37|     },
 38|     {
 39|       kind: 'free',
 40|       cost: { exhaust: true, uses: 1 },
 41|       label: '花 1 充能并横置：执行一次基础行动',
 42|       criteria: [({ state, inv }) => state.currentSeat === inv.seat],
 43|       resolve: ({ inv, source, api }) => {
 44|         if (!source) return
 45|         const started = api.beginImmediateAction(inv.seat, { source, basicOnly: true })
 46|         if (!started) {
 47|           api.info('「闭环」：当前没有可以执行的基础行动。')
 48|           return
 49|         }
 50|         api.info('⭕ 「闭环」：执行一次基础行动。')
 51|       },
 52|     },
 53|   ],
 54|   modifiers: [],
 55| }
 56| 
--- test hits (6) ---
eote-player-m2-2.test.mjs:34: import e08062 from '../src/cards/entries/08062.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:648: test('P6 08062 闭环：入场充能数=职阶数；花 1 充能横置执行一次基础行动', () => {
eote-player-m2-2.test.mjs:651: const circle = asset(s, '08062')
eote-player-m2-2.test.mjs:654: runDescriptor(s, '08062', 'entersPlay', { source: circle })
eote-player-m2-2.test.mjs:659: runDescriptor(s, '08062', 'free', {

==========================================================================================
## 08063 Winds of Power / 力量之风  [event|mystic|xp:1|deckLimit:2|cost:2] traits:Spirit
EN: Place 2 charges on an asset you control.
[reaction] After you draw Winds of Power during your turn: Play it.
ZH: 在你控制的一张支援上放置2充能。
[reaction]在你回合期间抽取力量之风后：将其打出。
--- src/cards/entries/08063.js (52 lines) ---
  1| // 08063 力量之风（Winds of Power）· 秘术师（Mystic）事件 · 1 经验。
  2| //
  3| // 卡面：在你控制的一张支援上放置 2 充能。
  4| //       [reaction] 在你回合期间抽取力量之风后：将其打出。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // 读点：api.addUses 放置充能；正常打出走 played；抽到时打出走 fromHand + quickEvent 反应
  8| // （与 07020 同一快速事件通道，抽牌窗口是 cardDrawn）。
  9| import { ALL_CARDS } from '../../cards/cards-data.js'
 10| 
 11| const canHoldCharges = asset => {
 12|   const def = ALL_CARDS[asset.code]
 13|   return Boolean(asset.uses != null || def?.uses != null || def?.usesType === 'charges' || asset.usesType === 'charges')
 14| }
 15| 
 16| function placeTwoCharges ({ inv, api }) {
 17|   const candidates = (inv.assets || []).filter(canHoldCharges)
 18|   if (!candidates.length) {
 19|     api.info('「力量之风」：你没有可以放置充能的支援。')
 20|     return
 21|   }
 22|   const answer = candidates.length === 1 ? candidates[0].id
 23|     : api.choice({ kind: 'target', source: '08063', seat: inv.seat,
 24|       prompt: '选择一张支援，在其上放置 2 充能。',
 25|       options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })) })
 26|   const asset = candidates.find(item => item.id === answer) || candidates[0]
 27|   api.addUses(asset, 2)
 28|   api.info(`💨 「力量之风」在「${api.cardName(asset.code)}」上放置 2 充能（当前 ${asset.uses || 0}）。`)
 29| }
 30| 
 31| export default {
 32|   code: '08063',
 33|   abilities: [
 34|     {
 35|       kind: 'played',
 36|       label: '在你控制的一张支援上放置 2 充能',
 37|       resolve: placeTwoCharges,
 38|     },
 39|     {
 40|       kind: 'reaction',
 41|       fromHand: true,
 42|       quickEvent: true,
 43|       trigger: 'cardDrawn',
 44|       label: '在你回合期间抽到力量之风后：打出它',
 45|       criteria: [({ state, inv, context }) => context?.cardCode === '08063'
 46|         && state.currentSeat === inv.seat],
 47|       resolve: placeTwoCharges,
 48|     },
 49|   ],
 50|   modifiers: [],
 51| }
 52| 
--- test hits (7) ---
eote-player-m2-2.test.mjs:35: import e08063 from '../src/cards/entries/08063.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:310: test('P6 08063 力量之风：打出时放置 2 充能；回合中抽到时自动打出', () => {
eote-player-m2-2.test.mjs:315: runDescriptor(s, '08063', 'played')
eote-player-m2-2.test.mjs:319: const quick = registeredEntry('08063').abilities.find(ability => ability.quickEvent === true)
eote-player-m2-2.test.mjs:325: drawn.investigators[0].hand = ['08063']
eote-player-m2-2.test.mjs:326: runDescriptor(drawn, '08063', 'reaction', { index: 0 })

==========================================================================================
## 08064 Foresight / 先见  [event|mystic|xp:1|deckLimit:2|cost:0] traits:Augury
EN: Fast. Play when an investigator at your location would draw a card from their deck or from the encounter deck.
Name a card. If the drawn card is the named card, that investigator may either (choose one):
- Cancel that card's effects and discard it.
- Immediately play that card at -2 cost.
ZH: 快速。在你所在地点的调查员将要从其牌库或遭遇牌库抽取卡牌时打出。
指定一张卡牌。如果抽取的卡牌是指定的卡牌，该调查员可以(选择一项)：
- 取消该卡牌的效果并将其弃掉。
- 立刻打出该卡牌且其费用-2。
--- src/cards/entries/08064.js (69 lines) ---
  1| // 08064 先见（Foresight）· 秘术师事件 · 1 经验。
  2| //
  3| // 卡面：快速。在你所在地点的调查员将要从其牌库或遭遇牌库抽取卡牌时打出。
  4| //       指定一张卡牌。如果抽取的卡牌是指定的卡牌，该调查员可以(选择一项)：
  5| //       - 取消该卡牌的效果并将其弃掉。- 立刻打出该卡牌且其费用 -2。
  6| //
  7| // 一卡一文件：这张卡的行为只在这里维护。
  8| // approximation: 引擎没有「抽牌前指定卡名并在抽牌管线里按卡名匹配」的读点。这里挂在
  9| // cardDrawn / encounterDrawn 窗口上，按「先指定（从该调查员手牌与该牌库可见候选中选名）→ 再比对
 10| // 刚抽到的卡」近似；「打出且费用 -2」用 api.playCard({discount:2})，取消玩家牌=弃掉该卡，
 11| // 取消遭遇牌=把 context.cancelled 置真（显现被取消）。
 12| export default {
 13|   code: '08064',
 14|   abilities: [
 15|     {
 16|       kind: 'played',
 17|       fast: true,
 18|       trigger: ['cardDrawn', 'encounterDrawn'],
 19|       label: '快速：指定一张卡牌；若抽到的就是它，取消其效果并弃掉，或立刻以 -2 费打出',
 20|       criteria: [({ state, inv, context }) => Boolean(context) && Number.isInteger(context.seat)
 21|         && state.investigators[context.seat]?.location === inv.location],
 22|       resolve: ({ state, inv, context, api }) => {
 23|         if (!context) return
 24|         const drawer = state.investigators[context.seat]
 25|         if (!drawer) return
 26|         const drawnCode = context.cardCode || null
 27|         const candidateCodes = [...new Set([
 28|           ...(drawnCode ? [drawnCode] : []),
 29|           ...(Array.isArray(drawer.hand) ? drawer.hand : []),
 30|           ...(Array.isArray(drawer.deck) ? drawer.deck : []),
 31|         ])]
 32|         if (!candidateCodes.length) {
 33|           api.info('「先见」：没有可以指定的卡牌。')
 34|           return
 35|         }
 36|         const named = candidateCodes.length === 1 ? candidateCodes[0]
 37|           : api.choice({ kind: 'card', source: '08064', seat: inv.seat,
 38|             prompt: '指定一张卡牌（抽到的若是它，就可以取消/以 -2 费打出）。',
 39|             options: candidateCodes.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
 40|         if (!drawnCode || named !== drawnCode) {
 41|           api.info(`🔮 「先见」：指定了「${api.cardName(named)}」，但抽到的不是它。`)
 42|           return
 43|         }
 44|         const options = [{ id: 'cancel', label: '取消该卡牌的效果并将其弃掉' }]
 45|         if (context.when === 'cardDrawn') options.push({ id: 'play', label: '立刻打出该卡牌（费用 -2）' })
 46|         const answer = options.length === 1 ? 'cancel'
 47|           : api.choice({ kind: 'effect', source: '08064', seat: inv.seat,
 48|             prompt: `「先见」：抽到了指定的「${api.cardName(named)}」，选择一项。`, options })
 49|         if (answer === 'play') {
 50|           if (!api.playCard(drawer.seat, drawnCode, { discount: 2, noAction: true })) {
 51|             api.info(`「先见」：「${api.cardName(drawnCode)}」当前不能打出。`)
 52|           } else {
 53|             api.info(`🔮 「先见」：以 -2 费用打出「${api.cardName(drawnCode)}」。`)
 54|           }
 55|           return
 56|         }
 57|         if (context.when === 'encounterDrawn') {
 58|           context.cancelled = true
 59|           api.info(`🔮 「先见」：取消遭遇牌「${api.cardName(drawnCode)}」的效果。`)
 60|           return
 61|         }
 62|         api.discardFromHand(drawer.seat, drawnCode)
 63|         api.info(`🔮 「先见」：将抽到的「${api.cardName(drawnCode)}」弃掉。`)
 64|       },
 65|     },
 66|   ],
 67|   modifiers: [],
 68| }
 69| 
--- test hits (5) ---
eote-player-m2-2.test.mjs:36: import e08064 from '../src/cards/entries/08064.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:672: test('P6 08064 先见：指定卡牌与抽到的卡相同 → 取消/弃掉；遭遇牌可取消显现', () => {
eote-player-m2-2.test.mjs:676: runDescriptor(s, '08064', 'played', {
eote-player-m2-2.test.mjs:689: runDescriptor(encounter, '08064', 'played', {

==========================================================================================
## 08065 Occult Theory / 密教理论  [skill|mystic|xp:1|deckLimit:2] traits:Practiced,Expert
EN: While Occult Theory is in your hand or committed to a skill test, it gains [willpower] icons equal to your [intellect], and [intellect] icons equal to your [willpower].
ZH: 密教理论在你手中或投入到技能检定中时，其获得等于你[intellect]的[willpower]图标，以及等于你[willpower]的[intellect]图标。
--- src/cards/entries/08065.js (32 lines) ---
  1| // 08065 密教理论（Occult Theory）· 秘术师（Mystic）技能 · 1 经验。
  2| //
  3| // 卡面：密教理论在你手中或投入到技能检定中时，其获得等于你 [intellect] 的 [willpower] 图标，
  4| //       以及等于你 [willpower] 的 [intellect] 图标。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // 读点：commit 档案的 iconBonus（动态图标）。ctx 没有 getStat/api，因此读 cards-data 的印刷
  8| // 属性（近似；已写 primitive request，待主进程把修正值读点接进 iconBonus 后改一行即可）。
  9| import { ALL_CARDS } from '../../cards/cards-data.js'
 10| 
 11| const printed = (inv, name) => Number(ALL_CARDS[inv?.code]?.[name] ?? 0)
 12| 
 13| export default {
 14|   code: '08065',
 15|   abilities: [
 16|     {
 17|       kind: 'commit',
 18|       label: '密教理论：获得等于你[智慧]的[意志]图标与等于你[意志]的[智慧]图标',
 19|       skill: {
 20|         iconBonus: ({ inv, skill }) => {
 21|           const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
 22|           let icons = 0
 23|           if (tested.has('willpower')) icons += printed(inv, 'intellect')
 24|           if (tested.has('intellect')) icons += printed(inv, 'willpower')
 25|           return icons
 26|         },
 27|       },
 28|     },
 29|   ],
 30|   modifiers: [],
 31| }
 32| 
--- test hits (5) ---
eote-player-m2-2.test.mjs:37: import e08065 from '../src/cards/entries/08065.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:330: test('P6 08065 密教理论：投入时获得等于[智慧]的[意志]图标与等于[意志]的[智慧]图标', () => {
eote-player-m2-2.test.mjs:335: assert.equal(commitIcons(s, inv, '08065', 'willpower'), printed.intellect, '意志检定：等于智慧的意志图标')
eote-player-m2-2.test.mjs:337: assert.equal(commitIcons(s, inv, '08065', 'intellect'), printed.willpower, '智慧检定：等于意志的智慧图标')

==========================================================================================
## 08066 Parallel Fates / 平行命运  [event|mystic|xp:2|deckLimit:2|cost:0] traits:Augury
EN: Look at the top 6 cards of an investigator's deck or the encounter deck. You may either return them to the top of that deck in any order, or shuffle them into that deck. If you looked at an investigator's deck, that investigator may draw 1 card.
ZH: 查看一位调查员的牌库顶或遭遇牌库顶6张卡牌，你可以将那些卡牌以任何顺序放回该牌库顶，或将他们洗回该牌库。如果你查看了一位调查员的牌库，该调查员可以抽取1张卡牌。
--- src/cards/entries/08066.js (66 lines) ---
  1| // 08066 平行命运（Parallel Fates）· 秘术师（Mystic）事件 · 2 经验。
  2| //
  3| // 卡面：查看一位调查员的牌库顶或遭遇牌库顶 6 张卡牌，你可以将那些卡牌以任何顺序放回该牌库顶，
  4| //       或将它们洗回该牌库。如果你查看了一位调查员的牌库，该调查员可以抽取 1 张卡牌。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // 读点：api.lookAt（B5：count/arrange/returnStrategy/targetSeat）。任意顺序放回走 arrange + 放回顶部，
  8| // 洗回走 returnStrategy:'shuffle'。注意引擎的任意排列枚举当前只支持 ≤4 张（lookAt 实现限制），
  9| // 6 张时按放回顶部处理 —— 已写 primitive request m2-2-08066.json 请主进程放宽。
 10| const ALIVE = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
 11| 
 12| export default {
 13|   code: '08066',
 14|   abilities: [
 15|     {
 16|       kind: 'played',
 17|       label: '查看 6 张牌：任意顺序放回牌库顶或洗回；查看调查员牌库时其可抽 1 张',
 18|       resolve: ({ state, inv, api }) => {
 19|         const zones = [
 20|           ...ALIVE(state).map(owner => ({
 21|             id: `seat:${owner.seat}`, kind: 'investigator', seat: owner.seat,
 22|             label: `${owner.name} 的牌库`, pile: owner.deck,
 23|           })),
 24|           { id: 'encounter', kind: 'encounter', seat: null, label: '遭遇牌库', pile: state.encounterDeck },
 25|         ].filter(zone => Array.isArray(zone.pile) && zone.pile.length)
 26|         if (!zones.length) {
 27|           api.info('「平行命运」：没有可以查看的牌库。')
 28|           return
 29|         }
 30|         const zoneId = zones.length === 1 ? zones[0].id
 31|           : api.choice({ kind: 'deck', source: '08066', seat: inv.seat,
 32|             prompt: '选择要查看牌库顶 6 张的牌库。',
 33|             options: zones.map(zone => ({ id: zone.id, label: zone.label })) })
 34|         const zone = zones.find(item => item.id === zoneId) || zones[0]
 35|         const reorder = api.choice({
 36|           kind: 'effect', source: '08066', seat: inv.seat,
 37|           prompt: `查看「${zone.label}」顶 ${Math.min(6, zone.pile.length)} 张后，如何放回？`,
 38|           options: [{ id: 'top', label: '以任意顺序放回牌库顶' }, { id: 'shuffle', label: '洗回该牌库' }],
 39|         })
 40|         api.lookAt(inv.seat, {
 41|           zone: zone.kind === 'encounter' ? 'encounterDeck' : 'deck',
 42|           targetSeat: zone.seat ?? null,
 43|           count: Math.min(6, zone.pile.length),
 44|           arrange: reorder === 'top',
 45|           returnStrategy: reorder === 'top' ? 'top' : 'shuffle',
 46|           prompt: reorder === 'top' ? '选择放回牌库顶的顺序（从上到下）。' : null,
 47|           source: '08066',
 48|         })
 49|         if (zone.kind !== 'investigator') return
 50|         const viewer = state.investigators[zone.seat]
 51|         if (!viewer || viewer.defeated || viewer.resigned) return
 52|         const draw = api.choice({
 53|           kind: 'reaction', source: '08066', seat: viewer.seat, canSkip: true,
 54|           prompt: `${viewer.name} 是否抽取 1 张卡牌？`,
 55|           options: [{ id: 'draw', label: '抽取 1 张卡牌' }, { id: 'skip', label: '不抽' }],
 56|         })
 57|         if (draw === 'draw') {
 58|           api.drawCards(viewer.seat, 1)
 59|           api.info(`🌌 「平行命运」：${viewer.name} 抽取 1 张卡牌。`)
 60|         }
 61|       },
 62|     },
 63|   ],
 64|   modifiers: [],
 65| }
 66| 
--- test hits (5) ---
eote-player-m2-2.test.mjs:38: import e08066 from '../src/cards/entries/08066.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:340: test('P6 08066 平行命运：查看 6 张后放回且可抽取 1 张；洗回分支来自同一读点', () => {
eote-player-m2-2.test.mjs:345: runDescriptor(s, '08066', 'played', { select: choice => {
eote-player-m2-2.test.mjs:358: runDescriptor(shuffleState, '08066', 'played', { select: choice => {

==========================================================================================
## 08067 Astronomical Atlas / 天文地图集  [asset|mystic|xp:3|deckLimit:2|cost:3] traits:Item,Tome
EN: [fast] Exhaust Astronomical Atlas: Look at the top card of your deck. If it is not a weakness, attach it facedown to Astronomical Atlas (max 5 cards attached).
[fast]: Commit a card attached to Astronomical Atlas to an eligible skill test. If that test succeeds, add that card to your hand instead of discarding it. (Limit once per test.)
ZH: [free]横置天文地图集：查看你牌库顶1张卡牌。如果它不是弱点，将它正面朝下附属到天文地图集上(最多附属5张)。
[free]：将一张附属在天文地图集上的卡牌投入到一个符合条件的技能检定中。如果该检定成功，不弃掉该卡牌，改为将其加入你的手牌。(每次检定仅限一次。)
--- src/cards/entries/08067.js (103 lines) ---
  1| // 08067 天文地图集（Astronomical Atlas）· 秘术师（Mystic）资产 · 手部 · 3 经验。
  2| //
  3| // 卡面：[fast] 横置天文地图集：查看你牌库顶 1 张卡牌。如果它不是弱点，将它正面朝下附属到
  4| //       天文地图集上(最多附属 5 张)。
  5| //       [fast]：将一张附属在天文地图集上的卡牌投入到一个符合条件的技能检定中。如果该检定成功，
  6| //       不弃掉该卡牌，改为将其加入你的手牌。(每次检定仅限一次。)
  7| //
  8| // 一卡一文件：这张卡的行为只在这里维护。
  9| // approximation: 能力 2 没有「from attached 投入 + 成功后回手」的原语。这里用最接近的等价实现：
 10| //   ① free 描述子把一张附属牌标记为「已投入」（api.addUses(attachment, 1) 当标记）并按该牌的
 11| //      技能图标数 api.addPendingTestBonus（每次检定一次）；
 12| //   ② reaction testEnds 读点：本次检定成功后把标记过的附属牌加入手牌，失败则弃掉。
 13| //   与「真正进入投入区」的差别记录在 P6 报告 approximation 清单。
 14| import { ALL_CARDS } from '../../cards/cards-data.js'
 15| 
 16| const iconCountFor = (code, skill) => {
 17|   const icons = ALL_CARDS[code]?.icons || {}
 18|   const skills = Array.isArray(skill) ? skill : [skill]
 19|   let total = 0
 20|   for (const [name, amount] of Object.entries(icons)) {
 21|     if (name === 'wild' || skills.includes(name)) total += Number(amount) || 0
 22|   }
 23|   return total
 24| }
 25| 
 26| export default {
 27|   code: '08067',
 28|   abilities: [
 29|     {
 30|       kind: 'free',
 31|       cost: { exhaust: true },
 32|       label: '横置：查看牌库顶 1 张，非弱点则正面朝下附属到天文地图集',
 33|       criteria: [({ state, inv, source }) => Boolean(source)
 34|         && (source.attachments || []).length < 5
 35|         && Array.isArray(inv.deck) && inv.deck.length > 0],
 36|       resolve: ({ state, inv, source, api }) => {
 37|         if (!source) return
 38|         if ((source.attachments || []).length >= 5) {
 39|           api.info('「天文地图集」：已附属 5 张卡牌。')
 40|           return
 41|         }
 42|         const code = inv.deck[inv.deck.length - 1]
 43|         if (!code) {
 44|           api.info('「天文地图集」：你的牌库是空的。')
 45|           return
 46|         }
 47|         if (!api.isNonWeakness(code)) {
 48|           api.info(`「天文地图集」：牌库顶是弱点「${api.cardName(code)}」，不能附属。`)
 49|           return
 50|         }
 51|         api.moveCard({ code, from: 'deck', to: 'attached', attachTo: source.id, facedown: true })
 52|         api.info(`🗺️ 「天文地图集」：将牌库顶一张卡牌正面朝下附属到其上（共 ${(source.attachments || []).length} 张）。`)
 53|       },
 54|     },
 55|     {
 56|       kind: 'free',
 57|       limit: { scope: 'perTest', owner: 'player' },
 58|       label: '把一张附属牌投入当前技能检定（成功后加入手牌）',
 59|       criteria: [({ state, source }) => Boolean(state.skillTest) && Boolean(source)
 60|         && (source.attachments || []).length > 0],
 61|       resolve: ({ state, inv, source, api }) => {
 62|         if (!source || !state.skillTest) return
 63|         const candidates = (source.attachments || []).filter(attachment => !attachment.uses)
 64|         if (!candidates.length) {
 65|           api.info('「天文地图集」：没有可投入的附属牌。')
 66|           return
 67|         }
 68|         const chosen = candidates.length === 1 ? candidates[0].id
 69|           : api.choice({ kind: 'target', source: '08067', seat: inv.seat,
 70|             prompt: '选择要投入技能检定的附属牌。',
 71|             options: candidates.map(attachment => ({ id: attachment.id, label: api.cardName(attachment.code) })) })
 72|         const attachment = candidates.find(item => item.id === chosen) || candidates[0]
 73|         if (!attachment) return
 74|         const icons = iconCountFor(attachment.code, state.skillTest.skill)
 75|         api.addUses(attachment, 1)
 76|         if (icons > 0) api.addPendingTestBonus(icons)
 77|         api.info(`🗺️ 「天文地图集」：将「${api.cardName(attachment.code)}」投入本次检定（+${icons} 图标）。`)
 78|       },
 79|     },
 80|     {
 81|       kind: 'reaction',
 82|       trigger: 'testEnds',
 83|       label: '投入的附属牌：检定成功则加入手牌，失败则弃掉',
 84|       criteria: [({ source }) => Boolean(source)
 85|         && (source.attachments || []).some(attachment => attachment.uses)],
 86|       resolve: ({ state, inv, source, context, api }) => {
 87|         if (!source) return
 88|         const success = context?.success === true
 89|         for (const attachment of (source.attachments || []).filter(item => item.uses)) {
 90|           if (success) {
 91|             api.moveCard({ id: attachment.id, from: 'attached', to: 'hand' })
 92|             api.info(`🗺️ 「天文地图集」：「${api.cardName(attachment.code)}」检定成功，加入手牌。`)
 93|           } else {
 94|             api.moveCard({ id: attachment.id, from: 'attached', to: 'discard' })
 95|             api.info(`🗺️ 「天文地图集」：「${api.cardName(attachment.code)}」检定失败，弃掉。`)
 96|           }
 97|         }
 98|       },
 99|     },
100|   ],
101|   modifiers: [],
102| }
103| 
--- test hits (8) ---
eote-player-m2-2.test.mjs:39: import e08067 from '../src/cards/entries/08067.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:366: test('P6 08067 天文地图集：横置看顶 1 张，非弱点则正面朝下附属（最多 5 张）', () => {
eote-player-m2-2.test.mjs:369: const atlas = asset(s, '08067')
eote-player-m2-2.test.mjs:385: const weakAtlas = asset(weak, '08067')
eote-player-m2-2.test.mjs:396: const investAtlas = asset(invest, '08067')
eote-player-m2-2.test.mjs:400: runDescriptor(invest, '08067', 'free', {
eote-player-m2-2.test.mjs:407: runDescriptor(invest, '08067', 'reaction', {

==========================================================================================
## 08068 Healing Words / 治愈真言  [asset|mystic|xp:3|deckLimit:2|cost:2] traits:Spell
EN: Uses (4 charges).
[action] Spend 1 charge: Heal 2 damage from among investigators at your location.
ZH: 使用(4充能)。
[action]花费1充能：治愈你所在地点调查员总计2点伤害。
--- src/cards/entries/08068.js (39 lines) ---
  1| // 08068 治愈真言（Healing Words）· 秘术师（Mystic）资产 · 奥术 · 3 经验（06163 的升级版）。
  2| //
  3| // 卡面：使用(4 充能)。
  4| //       [action] 花费 1 充能：治愈你所在地点调查员总计 2 点伤害。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // 读点：条目级 uses/usesType；目标走同地点调查员循环，治愈用 api.healDamage，
  8| // 与 04304「煤油」的两点分配循环同口径。
  9| export default {
 10|   code: '08068',
 11|   uses: 4,
 12|   usesType: 'charges',
 13|   discardWhenEmpty: true,
 14|   abilities: [
 15|     {
 16|       kind: 'action',
 17|       label: '花费 1 充能：治愈你所在地点调查员总计 2 点伤害',
 18|       cost: { action: true, uses: 1 },
 19|       resolve: ({ state, inv, api }) => {
 20|         let remaining = 2
 21|         while (remaining > 0) {
 22|           const targets = api.investigatorsAt(inv.location).filter(owner => (owner.damage || 0) > 0)
 23|           if (!targets.length) break
 24|           const chosen = targets.length === 1 ? String(targets[0].seat)
 25|             : api.choice({ kind: 'investigator', source: '08068', seat: inv.seat,
 26|               prompt: `选择要治愈 1 点伤害的调查员（还可治愈 ${remaining} 点）。`,
 27|               options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })) })
 28|           const seat = Number(chosen)
 29|           if (!Number.isInteger(seat)) break
 30|           api.healDamage(seat, 1)
 31|           api.info(`🙏 「治愈真言」治愈了 ${state.investigators[seat]?.name || '调查员'} 1 点伤害。`)
 32|           remaining -= 1
 33|         }
 34|       },
 35|     },
 36|   ],
 37|   modifiers: [],
 38| }
 39| 
--- test hits (4) ---
eote-player-m2-2.test.mjs:40: import e08068 from '../src/cards/entries/08068.js'
eote-player-m2-2.test.mjs:53: e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
eote-player-m2-2.test.mjs:414: test('P6 08068 治愈真言：花费 1 充能治愈同地点调查员总计 2 点伤害', () => {
eote-player-m2-2.test.mjs:417: const words = asset(s, '08068')
