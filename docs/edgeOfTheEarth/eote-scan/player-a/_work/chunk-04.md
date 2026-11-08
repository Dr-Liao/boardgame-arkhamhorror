
==========================================================================================
## 08049 Counterespionage / 反间谍活动  [event|rogue|xp:1|deckLimit:2|cost:2] traits:Favor,Service
EN: Fast. Play when you draw a non-weakness treachery.
Cancel that card's revelation effect and draw the top card of the encounter deck.
[reaction] When you play Counterespionage, increase its cost by 2: Change "the encounter deck" to "your deck".
[reaction] When you play Counterespionage, increase its cost by 2: Change "you" to "any investigator".
ZH: 快速。在你抽取一张非弱点的诡计时打出。
取消该卡牌的显现效果并抽取遭遇牌库顶的卡牌。
[reaction]在你打出反间谍活动时，提升其费用2点：将“遭遇牌库”换成“你的牌库”。
[reaction]在你打出反间谍活动时，提升其费用2点：将“你”换成“任意调查员”。
--- src/cards/entries/08049.js (69 lines) ---
  1| // 08049 反间谍活动（Counterespionage）· 游荡者（Rogue）事件 · 1 经验。
  2| //
  3| // 卡面：快速。在你抽取一张非弱点的诡计时打出。
  4| //       取消该卡牌的显现效果并抽取遭遇牌库顶的卡牌。
  5| //       [reaction] 在你打出反间谍活动时，提升其费用 2 点：将"遭遇牌库"换成"你的牌库"。
  6| //       [reaction] 在你打出反间谍活动时，提升其费用 2 点：将"你"换成"任意调查员"。
  7| //
  8| // 一卡一文件：这张卡的行为只在这里维护。
  9| //
 10| // 已实现：「取消显现 + 改抽你的牌库」的升级（beforePlayCost 窗口记 playUpgrades/costIncrease，
 11| // 与 05111/05234/05277 同一口径）。「'你'→任意调查员」的升级需要跨座位快速事件候选：
 12| // 当前引擎的快速事件只在抽取者自己的窗口枚举 → 已写原语请求 m2-2-08049.json，待主进程接线。
 13| export default {
 14|   code: '08049',
 15|   abilities: [
 16|     {
 17|       kind: 'reaction',
 18|       trigger: 'beforePlayCost',
 19|       label: '打出反间谍活动时：提升费用 2 点（遭遇牌库 → 你的牌库）',
 20|       criteria: [({ inv, context }) => context?.cardCode === '08049'
 21|         && !context?.playUpgrades?.yourDeck
 22|         && (inv.resources || 0) >= Number(context?.cost || 0) + Number(context?.costIncrease || 0) + 2],
 23|       resolve: ({ api, context }) => {
 24|         context.playUpgrades = { ...(context.playUpgrades || {}), yourDeck: true }
 25|         context.costIncrease = Number(context.costIncrease || 0) + 2
 26|         api.info('反间谍活动：提升费用 2 点，把「遭遇牌库」换成「你的牌库」。')
 27|       },
 28|     },
 29|     {
 30|       kind: 'reaction',
 31|       trigger: 'beforePlayCost',
 32|       // approximation: 引擎的快速事件候选只在抽牌者自己的窗口枚举，无法把触发范围扩到
 33|       // 「任意调查员」；这里仍允许花 2 点费用记录该升级（主效果不变），跨座位触发待原语。
 34|       label: '打出反间谍活动时：提升费用 2 点（"你"→"任意调查员"，近似：仅记录升级）',
 35|       criteria: [({ inv, context }) => context?.cardCode === '08049'
 36|         && !context?.playUpgrades?.anyInvestigator
 37|         && (inv.resources || 0) >= Number(context?.cost || 0) + Number(context?.costIncrease || 0) + 2],
 38|       resolve: ({ api, context }) => {
 39|         context.playUpgrades = { ...(context.playUpgrades || {}), anyInvestigator: true }
 40|         context.costIncrease = Number(context.costIncrease || 0) + 2
 41|         api.info('反间谍活动：提升费用 2 点，记录「任意调查员」升级（跨座位触发近似）。')
 42|       },
 43|     },
 44|     {
 45|       kind: 'played',
 46|       fast: true,
 47|       trigger: 'treachery',
 48|       label: '取消该诡计的显现，并抽取遭遇牌库顶（升级后改为你的牌库）',
 49|       criteria: [({ context }) => Boolean(context) && context.when === 'treachery'
 50|         && !context.weakness && !context.cancelled && !context.cannotCancel],
 51|       resolve: ({ inv, context, api }) => {
 52|         if (!api.playerTools.cancelRevelation(context)) {
 53|           api.info('「反间谍活动」：这张诡计的效果不能被取消。')
 54|           return
 55|         }
 56|         const upgrades = context?.playCost?.playUpgrades || {}
 57|         if (upgrades.yourDeck) {
 58|           api.drawCards(inv.seat, 1)
 59|           api.info(`「反间谍活动」取消了「${api.cardName(context.cardCode)}」的显现，改为抽取你的牌库顶。`)
 60|         } else {
 61|           api.drawEncounter(inv.seat)
 62|           api.info(`「反间谍活动」取消了「${api.cardName(context.cardCode)}」的显现，并抽取遭遇牌库顶。`)
 63|         }
 64|       },
 65|     },
 66|   ],
 67|   modifiers: [],
 68| }
 69| 
--- test hits (11) ---
eote-player-m2-2.test.mjs:1: // P6 M2-2（08049–08078）一般玩家卡 Node 验收。
eote-player-m2-2.test.mjs:21: import e08049 from '../src/cards/entries/08049.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:125: test('P6 08049 反间谍活动：取消诡计显现并由「遭遇牌库→你的牌库」升级改抽自己牌库', () => {
eote-player-m2-2.test.mjs:129: inv.hand = ['08049']
eote-player-m2-2.test.mjs:134: runDescriptor(s, '08049', 'played', { context })
eote-player-m2-2.test.mjs:147: runDescriptor(upgraded, '08049', 'played', { context: context2 })
eote-player-m2-2.test.mjs:153: const costContext = { cardCode: '08049', cost: 2, costIncrease: 0 }

==========================================================================================
## 08050 Cheat the System / 欺骗制度  [event|rogue|xp:1|deckLimit:2|cost:0] traits:Trick,Synergy
EN: Fast. Play during any [fast] window.
Gain 1 resource for each different class among cards you control.
ZH: 快速。可在任意[free]时间段期间打出。
你每控制一张不同职阶的卡牌，获得1资源。
--- src/cards/entries/08050.js (40 lines) ---
  1| // 08050 欺骗制度（Cheat the System）· 游荡者（Rogue）事件 · 1 经验。
  2| //
  3| // 卡面：快速。可在任意 [fast] 时间段期间打出。
  4| //       你每控制一张不同职阶的卡牌，获得 1 资源。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // 「不同职阶」按你控制的支援（asset）的卡面职业去重计数；职阶从 cards-data 读取（与
  8| // 05279 读取卡面数据同一口径）。本事件本身打出时还在手牌，不计入。
  9| import { ALL_CARDS } from '../../cards/cards-data.js'
 10| 
 11| const distinctClassCount = inv => {
 12|   const classes = new Set()
 13|   for (const asset of inv.assets || []) {
 14|     const klass = ALL_CARDS[asset.code]?.klass
 15|     if (klass) classes.add(String(klass).toLowerCase())
 16|   }
 17|   return classes.size
 18| }
 19| 
 20| export default {
 21|   code: '08050',
 22|   abilities: [
 23|     {
 24|       kind: 'played',
 25|       fast: true,
 26|       label: '快速打出：你每控制一种不同职阶的卡牌，获得 1 资源',
 27|       resolve: ({ inv, api }) => {
 28|         const count = distinctClassCount(inv)
 29|         if (count <= 0) {
 30|           api.info('「欺骗制度」：你没有控制任何卡牌，未获得资源。')
 31|           return
 32|         }
 33|         api.gainResources(inv.seat, count)
 34|         api.info(`「欺骗制度」：你控制了 ${count} 种不同职阶的卡牌，获得 ${count} 资源。`)
 35|       },
 36|     },
 37|   ],
 38|   modifiers: [],
 39| }
 40| 
--- test hits (5) ---
eote-player-m2-2.test.mjs:22: import e08050 from '../src/cards/entries/08050.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:164: test('P6 08050 欺骗制度：每控制一种不同职阶获得 1 资源；无卡牌时不获得', () => {
eote-player-m2-2.test.mjs:170: runDescriptor(s, '08050', 'played')
eote-player-m2-2.test.mjs:175: runDescriptor(empty, '08050', 'played')

==========================================================================================
## 08051 Untimely Transaction / 不当交易  [event|rogue|xp:1|deckLimit:2|cost:0] traits:Favor
EN: Reveal an [[Item]] asset in your hand. Another investigator at your location may play that asset as if it were in their hand. If they do, draw 1 card and gain resources equal to that asset's printed cost.
ZH: 揭示你手中的一张[[道具]]支援。你所在地点的另一位调查员可以打出该支援，如同其是自己手牌。如果该调查员选择打出，你抽取一张卡牌并获得该支援印刷费用的资源。
--- src/cards/entries/08051.js (71 lines) ---
  1| // 08051 不当交易（Untimely Transaction）· 游荡者事件 · 1 经验。
  2| //
  3| // 卡面：揭示你手中的一张 [[道具]] 支援。你所在地点的另一位调查员可以打出该支援，如同其是自己手牌。
  4| //       如果该调查员选择打出，你抽取一张卡牌并获得该支援印刷费用的资源。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // approximation: 引擎没有「把一张手牌交给他人并按如同自己手牌打出」的通道（playCardFromOtherHand
  8| // 以当前行动者为主角、playCard 只取本人手牌）。这里用「先置入自己控制、再 api.giveAsset 移交给
  9| // 该调查员」近似，且不代收打出费用（费用差额记在报告）。主效果（揭示/另一方决定/抽1/得费用资源）正确。
 10| import { ALL_CARDS } from '../../cards/cards-data.js'
 11| 
 12| const isItemAsset = code => {
 13|   const def = ALL_CARDS[code]
 14|   return Boolean(def) && def.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
 15| }
 16| 
 17| export default {
 18|   code: '08051',
 19|   abilities: [
 20|     {
 21|       kind: 'played',
 22|       label: '揭示一张手牌[[道具]]支援：另一位调查员可以打出它；若打出，你抽 1 张并获得其印刷费用资源',
 23|       resolve: ({ state, inv, api }) => {
 24|         const items = [...new Set(inv.hand || [])].filter(isItemAsset)
 25|         if (!items.length) {
 26|           api.info('「不当交易」：你手中没有可以揭示的[[道具]]支援。')
 27|           return
 28|         }
 29|         const picked = items.length === 1 ? items[0]
 30|           : api.choice({ kind: 'card', source: '08051', seat: inv.seat,
 31|             prompt: '选择要揭示的手牌[[道具]]支援。',
 32|             options: items.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
 33|         if (!items.includes(picked)) return
 34|         api.info(`🤝 「不当交易」：${inv.name} 揭示了手牌中的「${api.cardName(picked)}」。`)
 35|         const others = state.investigators.filter(other => other.seat !== inv.seat
 36|           && !other.defeated && !other.resigned && other.location === inv.location)
 37|         if (!others.length) {
 38|           api.info('「不当交易」：同地点没有其他调查员可以打出这张支援。')
 39|           return
 40|         }
 41|         const otherSeat = others.length === 1 ? others[0].seat
 42|           : Number(api.choice({ kind: 'investigator', source: '08051', seat: inv.seat,
 43|             prompt: '由同地点的哪位调查员决定是否打出？',
 44|             options: others.map(other => ({ id: String(other.seat), label: other.name })) }))
 45|         const other = state.investigators[otherSeat]
 46|         if (!other) return
 47|         // approximation：AI 座位的选择由引擎自动决定，测试/单机环境下改为由打出者确认
 48|         // （「另一位调查员的决定」在多人真人局仍应由该座位选择，见报告 approximation）。
 49|         const answer = api.choice({ kind: 'reaction', source: '08051', seat: inv.seat, canSkip: true,
 50|           prompt: `是否让 ${other.name} 打出你揭示的「${api.cardName(picked)}」（如同其手牌）？`,
 51|           options: [{ id: 'play', label: `让 ${other.name} 打出` }, { id: 'skip', label: '不打出' }] })
 52|         if (answer !== 'play') {
 53|           api.info(`「不当交易」：${other.name} 选择不打出「${api.cardName(picked)}」。`)
 54|           return
 55|         }
 56|         const asset = api.putIntoPlay(inv.seat, picked)
 57|         if (!asset) {
 58|           api.info(`「不当交易」：「${api.cardName(picked)}」未能置入场上。`)
 59|           return
 60|         }
 61|         api.giveAsset(asset, otherSeat)
 62|         api.drawCards(inv.seat, 1)
 63|         const printedCost = Number(ALL_CARDS[picked]?.cost) || 0
 64|         if (printedCost) api.gainResources(inv.seat, printedCost)
 65|         api.info(`🤝 「不当交易」：${other.name} 打出了「${asset ? api.cardName(picked) : ''}」；${inv.name} 抽取 1 张并获得 ${printedCost} 资源。`)
 66|       },
 67|     },
 68|   ],
 69|   modifiers: [],
 70| }
 71| 
--- test hits (4) ---
eote-player-m2-2.test.mjs:23: import e08051 from '../src/cards/entries/08051.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:545: test('P6 08051 不当交易：揭示手牌道具，另一位调查员打出后你抽 1 并获得其印刷费用资源', () => {
eote-player-m2-2.test.mjs:553: runDescriptor(s, '08051', 'played', { select: choice => {

==========================================================================================
## 08052 Savant / 行业专家  [skill|rogue|xp:1|deckLimit:2] traits:Innate,Developed
EN: Savant gains [wild] icons equal to your lowest skill other than the skill being tested.
ZH: 行业专家获得等于你最低技能值的[wild]图标(除正在检定的技能外)。
--- src/cards/entries/08052.js (34 lines) ---
  1| // 08052 行业专家（Savant）· 游荡者（Rogue）技能 · 1 经验。
  2| //
  3| // 卡面：行业专家获得等于你最低技能值(除正在检定的技能外)的 [wild] 图标。
  4| //
  5| // 一卡一文件：这张卡的行为只在这里维护。
  6| // 读点：commit 档案的 `iconBonus`（src/engine/stats.js#conditionalCommitIcons）——动态图标
  7| // 按"未参与本次检定的技能里最低的印刷技能值"给。注意：iconBonus 的 ctx 没有 getStat/api，
  8| // 因此这里读 cards-data 的印刷技能值（近似；已登记 primitive request 让主进程把修正后属性
  9| // 或 api 读点传进 iconBonus，接线后本卡自动可改成修正值）。
 10| import { ALL_CARDS } from '../../cards/cards-data.js'
 11| 
 12| const SKILLS = ['willpower', 'intellect', 'combat', 'agility']
 13| 
 14| const printedSkill = (inv, skill) => Number(ALL_CARDS[inv?.code]?.[skill] ?? 0)
 15| 
 16| export default {
 17|   code: '08052',
 18|   abilities: [
 19|     {
 20|       kind: 'commit',
 21|       label: '行业专家：获得等于你最低技能值（除正在检定的技能外）的万能图标',
 22|       skill: {
 23|         iconBonus: ({ inv, skill }) => {
 24|           const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
 25|           const remaining = SKILLS.filter(name => !tested.has(name))
 26|           if (!remaining.length) return 0
 27|           return Math.min(...remaining.map(name => printedSkill(inv, name)))
 28|         },
 29|       },
 30|     },
 31|   ],
 32|   modifiers: [],
 33| }
 34| 
--- test hits (8) ---
eote-player-fixture.mjs:19: export const COMMIT_SKILL_CODE = '08052'
eote-player-m2-2.test.mjs:24: import e08052 from '../src/cards/entries/08052.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:179: test('P6 08052 行业专家：获得等于最低（未检定）技能值的万能图标', () => {
eote-player-m2-2.test.mjs:186: assert.equal(commitIcons(s, inv, '08052', 'willpower'), (ALL_CARDS['08052'].icons?.wild || 0) + expected, 'willpower 检定：取其余三项最低值')
eote-player-m2-2.test.mjs:188: assert.equal(commitIcons(s, inv, '08052', 'agility'), (ALL_CARDS['08052'].icons?.wild || 0) + Math.min(stats.willpower, stats.intellect, stats.combat))
eote-player.browser.mjs:21: const COMMIT_SKILL_CODE = '08052' // 行业专家（技能：印刷 [wild] 图标，真实投入窗口的可投入证据）
eote-player.browser.mjs:230: // 08052 完成真实投入证据，并记录 08024 的缺口 annotation。

==========================================================================================
## 08053 The Red Clock / 红色闹钟  [asset|rogue|xp:2|EXCEPTIONAL|deckLimit:1|cost:2] traits:Item,Relic
EN: Exceptional. Uses (0 charges).
Forced - After your turn begins: Either place 1 charge here, or take all charges here, as resources. Then, if it has exactly...
- 1 charge, you get +3 skill value for your next skill test.
- 2 charges, you may move up to 2 times.
- 3 charges, you may take an additional action this turn.
ZH: 卓越。使用(0充能)。
强制 - 在你的回合开始后：在此放置1充能，或拿取此处所有充能作为资源。然后，如果它恰好拥有……
- 1充能，下次技能检定中你得到技能值+3。
- 2充能，你可以移动最多2次。
- 3充能，你本回合可以进行1次额外行动。
--- src/cards/entries/08053.js (67 lines) ---
  1| // 08053 红色闹钟（The Red Clock）· 游荡者资产 · 饰品 · 2 经验 · 卓越。
  2| //
  3| // 卡面：卓越。使用(0 充能)。
  4| //       强制 - 在你的回合开始后：在此放置 1 充能，或拿取此处所有充能作为资源。然后，如果它恰好拥有……
  5| //       - 1 充能，下次技能检定中你得到技能值 +3。
  6| //       - 2 充能，你可以移动最多 2 次。
  7| //       - 3 充能，你本回合可以进行 1 次额外行动。
  8| //
  9| // 一卡一文件：这张卡的行为只在这里维护。
 10| // approximation:
 11| //   · 「下次技能检定 +3」用 api.addEffect({duration:'endOfTest', modifiers:[{target:'skill:*',amount:3}]})
 12| //     （Lead 指定的 08013a 已验证模式；效果在下一次技能检定结束时过期）。
 13| //   · 「移动最多 2 次」用 api.moveInvestigator 近似（不经过移动行动/借机攻击结算）。
 14| //   · 「额外行动」用 api.gainAction。
 15| export default {
 16|   code: '08053',
 17|   uses: 0,
 18|   usesType: 'charges',
 19|   abilities: [
 20|     {
 21|       kind: 'forced',
 22|       trigger: 'turnBegins',
 23|       label: '回合开始：放置 1 充能或拿取全部充能作为资源；按充能数触发 1/2/3 效果',
 24|       criteria: [({ inv, context, source }) => Boolean(source) && context?.seat === inv.seat],
 25|       resolve: ({ state, inv, source, api }) => {
 26|         if (!source) return
 27|         const charges = Number(source.uses) || 0
 28|         const options = [{ id: 'place', label: '在此放置 1 充能' }]
 29|         if (charges > 0) options.push({ id: 'take', label: `拿取此处 ${charges} 充能作为资源` })
 30|         const choice = options.length === 1 ? 'place'
 31|           : api.choice({ kind: 'effect', source: '08053', seat: inv.seat,
 32|             prompt: '红色闹钟：放置充能，还是拿取充能作为资源？', options })
 33|         if (choice === 'take') {
 34|           api.addUses(source, -charges)
 35|           api.gainResources(inv.seat, charges)
 36|           api.info(`⏰ 「红色闹钟」：拿取 ${charges} 充能作为资源。`)
 37|         } else {
 38|           api.addUses(source, 1)
 39|           api.info(`⏰ 「红色闹钟」：放置 1 充能（当前 ${source.uses || 0}）。`)
 40|         }
 41|         const total = Number(source.uses) || 0
 42|         if (total === 1) {
 43|           api.addEffect({ duration: 'endOfTest', sourceCode: '08053', sourceInstanceId: source.id,
 44|             label: '红色闹钟：下一次技能检定 +3 技能值', modifiers: [{ target: 'skill:*', amount: 3 }] })
 45|           api.info('⏰ 「红色闹钟」：下一次技能检定 +3 技能值。')
 46|         } else if (total === 2) {
 47|           const here = state.locations.find(location => location.id === inv.location)
 48|           for (let moved = 0; moved < 2; moved++) {
 49|             const destinations = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
 50|             const answers = [{ id: 'skip', label: '不移动' }, ...destinations.map(id => ({ id, label: api.locationName(id) }))]
 51|             if (answers.length === 1) break
 52|             const target = api.choice({ kind: 'move', source: '08053', seat: inv.seat, canSkip: true,
 53|               prompt: `红色闹钟：是否移动一次（还可移动 ${2 - moved} 次）？`, options: answers })
 54|             if (target === 'skip') break
 55|             api.moveInvestigator(inv.seat, target)
 56|             api.info(`⏰ 「红色闹钟」：移动到「${api.locationName(target)}」。`)
 57|           }
 58|         } else if (total === 3) {
 59|           api.gainAction(inv.seat, 1)
 60|           api.info('⏰ 「红色闹钟」：本回合额外 1 次行动。')
 61|         }
 62|       },
 63|     },
 64|   ],
 65|   modifiers: [],
 66| }
 67| 
--- test hits (9) ---
eote-player-m2-2.test.mjs:25: import e08053 from '../src/cards/entries/08053.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:566: test('P6 08053 红色闹钟（2经验）：回合开始放充能/拿资源，1/2/3 充能分支', () => {
eote-player-m2-2.test.mjs:569: const clock = asset(s, '08053')
eote-player-m2-2.test.mjs:571: runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 } })
eote-player-m2-2.test.mjs:578: runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })
eote-player-m2-2.test.mjs:583: runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })
eote-player-m2-2.test.mjs:589: const takeClock = asset(takeState, '08053')

==========================================================================================
## 08054 Money Talks / 金钱万能  [event|rogue|xp:2|deckLimit:2|cost:0] traits:Favor,Gambit
EN: Fast. Play when an investigator at any location initiates a skill test.
Instead of the skill type indicated for this test ([willpower], [intellect], [combat], or [agility]), this is a resource skill test. The performing investigator's base skill value for this test is equal to half the number of resources in your resource pool (rounded down). Draw 1 card.
ZH: 快速。在任意地点一位调查员发动技能检定时打出。
本次检定不是其标识的技能类型([willpower]、[intellect]、[combat]或[agility])，而是改为资源技能检定。执行检定的调查员的基础技能值等于你资源池内资源数的一半(向下取整)。抽取1张卡牌。
--- src/cards/entries/08054.js (33 lines) ---
  1| // 08054 金钱万能（Money Talks）· 游荡者（Rogue）事件 · 2 经验（05029 的升级版）。
  2| //
  3| // 卡面：快速。在任意地点一位调查员发动技能检定时打出。
  4| //       本次检定不是其标识的技能类型，而是改为资源技能检定。执行检定的调查员的基础技能值
  5| //       等于你资源池内资源数的一半(向下取整)。抽取 1 张卡牌。
  6| //
  7| // 一卡一文件：这张卡的行为只在这里维护。
  8| // 读点：api.convertTestToResourceSkill(seat)（testBegins 窗口，与 05029 同一原语；传自己座位
  9| // 表示基础值取自己的资源池），随后 api.drawCards 抽 1。跨地点/他人的检定选择由快速事件窗口
 10| // 归属决定（见 primitive request m2-2-08054.json：多座位 testBegins 候选归属待主进程确认）。
 11| export default {
 12|   code: '08054',
 13|   abilities: [
 14|     {
 15|       kind: 'played',
 16|       fast: true,
 17|       trigger: 'testBegins',
 18|       label: '金钱万能：本次检定改为资源技能检定，基础值 = 你资源的一半；抽 1 张牌',
 19|       criteria: [({ state }) => Boolean(state.skillTest)],
 20|       resolve: ({ inv, api }) => {
 21|         const converted = api.convertTestToResourceSkill(inv.seat)
 22|         if (!converted) {
 23|           api.info('「金钱万能」：当前没有进行中的技能检定。')
 24|           return
 25|         }
 26|         api.drawCards(inv.seat, 1)
 27|         api.info(`💰 ${inv.name} 打出「金钱万能」：本次检定改为资源技能检定，基础值 ${converted.base}（资源 ${inv.resources} 的一半），并抽取 1 张牌。`)
 28|       },
 29|     },
 30|   ],
 31|   modifiers: [],
 32| }
 33| 
--- test hits (4) ---
eote-player-m2-2.test.mjs:26: import e08054 from '../src/cards/entries/08054.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:191: test('P6 08054 金钱万能：把进行中的检定改为资源技能检定并抽 1 张', () => {
eote-player-m2-2.test.mjs:198: runDescriptor(s, '08054', 'played')

==========================================================================================
## 08055 Black Market / 黑市  [event|rogue|xp:2|deckLimit:2|cost:1] traits:Favor
EN: Fast. Play at the start of the investigation phase.
One at a time, reveal cards from the top of any investigator deck(s) until exactly 5 cards have been revealed. Set those cards aside, out of play. While set aside, any investigator may play any of those cards as if they were in their hand. At the start of the next investigation phase, shuffle each of those cards still set aside into its owner's deck.
ZH: 快速。当调查阶段开始时打出。
从任意位调查员的牌库顶依次揭示卡牌，直到正好揭示5张卡牌。将这些卡牌放在一边，位于场外。这些卡牌放在一边时，任意调查员可以将其打出，如同是自己手牌。当下个调查阶段开始时，将这些卡牌中仍放在一边的洗回其所有者的牌库。
--- src/cards/entries/08055.js (59 lines) ---
  1| // 08055 黑市（Black Market）· 游荡者事件 · 1 经验。
  2| //
  3| // 卡面：快速。当调查阶段开始时打出。
  4| //       从任意位调查员的牌库顶依次揭示卡牌，直到正好揭示 5 张卡牌。将这些卡牌放在一边，位于场外。
  5| //       这些卡牌放在一边时，任意调查员可以将其打出，如同是自己手牌。
  6| //       当下个调查阶段开始时，将这些卡牌中仍放在一边的洗回其所有者的牌库。
  7| //
  8| // 一卡一文件：这张卡的行为只在这里维护。
  9| // approximation:
 10| //   · 「放一边」用「移入原所有者弃牌堆 + api.playCardFromDiscard」近似（引擎没有 setAside 的
 11| //     「如同手牌」通道）；打出后按正常弃牌/结算。
 12| //   · 未在本次结算中打出的牌留在弃牌堆（「下个调查阶段开始时洗回牌库」需要跨阶段效果读点，
 13| //     待 P7/原语接线）。
 14| export default {
 15|   code: '08055',
 16|   abilities: [
 17|     {
 18|       kind: 'played',
 19|       fast: true,
 20|       trigger: 'investigationPhaseStarts',
 21|       label: '快速：从任意调查员牌库顶揭示共 5 张「放在一边」；这些牌可被其所有者立即打出',
 22|       resolve: ({ state, inv, api }) => {
 23|         const revealed = []
 24|         for (let i = 0; i < 5; i++) {
 25|           const candidates = state.investigators.filter(owner => !owner.defeated && !owner.resigned
 26|             && Array.isArray(owner.deck) && owner.deck.length > 0)
 27|           if (!candidates.length) break
 28|           const seatId = candidates.length === 1 ? String(candidates[0].seat)
 29|             : api.choice({ kind: 'investigator', source: '08055', seat: inv.seat,
 30|               prompt: `选择从哪位调查员的牌库顶揭示第 ${i + 1} 张「放在一边」的卡牌？`,
 31|               options: candidates.map(owner => ({ id: String(owner.seat), label: owner.name })) })
 32|           const owner = state.investigators[Number(seatId)] || candidates[0]
 33|           const code = owner.deck[owner.deck.length - 1]
 34|           if (!code) continue
 35|           api.moveCard({ code, from: 'deck', to: 'discard', ownerSeat: owner.seat })
 36|           revealed.push({ seat: owner.seat, code, name: api.cardName(code) })
 37|           api.info(`🕳️ 「黑市」：揭示 ${owner.name} 牌库顶的「${api.cardName(code)}」，放在一边（近似：置入其弃牌堆）。`)
 38|         }
 39|         if (!revealed.length) {
 40|           api.info('「黑市」：没有可以揭示的牌库。')
 41|           return
 42|         }
 43|         // 近似：把「放在一边期间可以打出」落成「其所有者现在可以立即从弃牌堆打出一次」。
 44|         for (const item of revealed) {
 45|           const owner = state.investigators[item.seat]
 46|           if (!owner || owner.defeated || owner.resigned) continue
 47|           const answer = api.choice({ kind: 'reaction', source: '08055', seat: item.seat, canSkip: true,
 48|             prompt: `「黑市」：是否打出放在一边的「${item.name}」，如同其在你手牌中？`,
 49|             options: [{ id: 'play', label: '打出' }, { id: 'skip', label: '留在一边' }] })
 50|           if (answer !== 'play') continue
 51|           api.playCardFromDiscard(item.seat, item.code, { noAction: true })
 52|           api.info(`🕳️ 「黑市」：${owner.name} 从放在一边的牌中打出了「${item.name}」。`)
 53|         }
 54|       },
 55|     },
 56|   ],
 57|   modifiers: [],
 58| }
 59| 
--- test hits (4) ---
eote-player-m2-2.test.mjs:27: import e08055 from '../src/cards/entries/08055.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:596: test('P6 08055 黑市：从任意调查员牌库顶揭示共 5 张放在一边（近似：置入弃牌堆）', () => {
eote-player-m2-2.test.mjs:601: runDescriptor(s, '08055', 'played', { select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })

==========================================================================================
## 08056 Moxie / 刚毅果敢  [asset|rogue|xp:3|deckLimit:2|cost:0] traits:Talent,Composure
EN: Fast. Limit 1 [[Composure]] in play.
You get +1 [willpower] and +1 [agility].
Non-direct damage/horror must be assigned to Moxie before it can be assigned to your investigator card.
[fast] Spend 1 resource: You get +1 [willpower] or +1 [agility] for this skill test.
ZH: 快速。[[沉稳]]卡牌场上仅限1张。
你得到+1[willpower]和+1[agility]。
非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给刚毅果敢。
[free]花费1资源：你本次技能检定得到+1[willpower]或+1[agility]。
--- src/cards/entries/08056.js (30 lines) ---
  1| // 08056 刚毅果敢（Moxie）· 游荡者（Rogue）资产 · 3 经验（03111 的升级版）。
  2| //
  3| // 卡面：快速。[[沉稳]]卡牌场上仅限 1 张。
  4| //       你得到 +1[willpower] 和 +1[agility]。
  5| //       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给刚毅果敢。
  6| //       [free] 花费 1 资源：你本次技能检定得到 +1[willpower] 或 +1[agility]。
  7| //
  8| // 一卡一文件：这张卡的行为只在这里维护。
  9| // 读点：`fast + composure + freeTriggers + modifiers`（assetEffect 合并处，与 03107/03111 同口径）。
 10| // 「非直接恐惧必须先分配给沉稳」由引擎 composure 读点处理；「非直接伤害」目前只有
 11| // redirectOneDamageToSelf 的单点转移，没有同口径的强制先分配 —— 已写 primitive request
 12| // m2-2-08056.json（请求 composureDamage 读点），接线后本卡自动覆盖伤害分支。
 13| export default {
 14|   code: '08056',
 15|   fast: true,
 16|   composure: true,
 17|   freeTriggers: [
 18|     { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
 19|     { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
 20|   ],
 21|   abilities: [],
 22|   // approximation: 沉稳关键字只覆盖「非直接恐惧必须先分配」。非直接伤害用旧读点
 23|   // assetRule.redirectOneDamageToSelf 近似（每次伤害结算把 1 点转移到本卡，而非全部）。
 24|   assetRule: { redirectOneDamageToSelf: true },
 25|   modifiers: [
 26|     { target: 'skill:willpower', amount: 1 },
 27|     { target: 'skill:agility', amount: 1 },
 28|   ],
 29| }
 30| 
--- test hits (10) ---
eote-player-m2-2.test.mjs:28: import e08056 from '../src/cards/entries/08056.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:205: test('P6 08056 刚毅果敢：+1 意志/+1 敏捷、沉稳先吃非直接恐惧、花 1 资源 +1 档位', () => {
eote-player-m2-2.test.mjs:208: asset(s, '08056')
eote-player-m2-2.test.mjs:209: assert.equal(registeredEntry('08056').composure, true, '沉稳关键字')
eote-player-m2-2.test.mjs:210: assert.deepEqual(registeredEntry('08056').freeTriggers.map(trigger => trigger.skill), ['willpower', 'agility'])
eote-player-m2-2.test.mjs:227: const stillThere = s.investigators[0].assets.find(item => item.code === '08056')
eote-player-m2-2.test.mjs:228: const inDiscard = (s.investigators[0].discard || []).includes('08056')

==========================================================================================
## 08057 The Black Fan / 黑色扇子  [asset|rogue|xp:3|EXCEPTIONAL|deckLimit:1|cost:3] traits:Item,Relic
EN: Exceptional.
While you have...
- ...10+ resources, you get +1 health and +1 sanity.
- ...15+ resources, you may take one additional action during your turn.
- ...20+ resources, you get +1 to each of your skills.
ZH: 卓越。
你拥有……(时)
- ……10+资源，你得到+1生命和+1神智。
- ……15+资源，在你回合期间你可以额外执行一次行动。
- ……20+资源，你得到每项技能值+1。
--- src/cards/entries/08057.js (37 lines) ---
  1| // 08057 黑色扇子（The Black Fan）· 游荡者（Rogue）资产 · 3 经验 · 卓越 · 手部。
  2| //
  3| // 卡面：卓越。
  4| //       你拥有……时：
  5| //       - 10+ 资源：你得到 +1 生命和 +1 神智。
  6| //       - 15+ 资源：在你回合期间，你可以额外执行一次行动。
  7| //       - 20+ 资源：你得到每项技能值 +1。
  8| //
  9| // 一卡一文件：这张卡的行为只在这里维护。
 10| // 读点：
 11| //   · 生命/神智/技能用 modifiers 的 resourcesAtLeast 条件（statPipeline 统一读点）；
 12| //   · 「15+ 资源：本回合额外一次行动」用 free 能力（每回合一次）+ api.gainAction 落实——
 13| //     引擎没有「条件性常驻 extraAction」的读点；free 触发需在自己回合，等价于本回合多一次行动。
 14| export default {
 15|   code: '08057',
 16|   // approximation: 引擎 getMaxHealth/getMaxSanity 不读 modifiers，因此「10+ 资源 +1 生命/神智」
 17|   // 用被动数据通道常驻实现（资源条件在引擎接线前无法读取）。
 18|   passive: { healthBonus: 1, sanityBonus: 1 },
 19|   abilities: [
 20|     {
 21|       kind: 'free',
 22|       label: '15+ 资源：本回合额外执行一次行动（每回合一次）',
 23|       limit: { scope: 'perTurn', owner: 'player' },
 24|       criteria: [
 25|         ({ state, inv }) => state.currentSeat === inv.seat && (inv.resources || 0) >= 15,
 26|       ],
 27|       resolve: ({ inv, api }) => {
 28|         api.gainAction(inv.seat, 1)
 29|         api.info(`🪭 「黑色扇子」：${inv.name} 本回合额外执行一次行动。`)
 30|       },
 31|     },
 32|   ],
 33|   modifiers: [
 34|     { target: 'skill:*', amount: 1, condition: { resourcesAtLeast: 20 } },
 35|   ],
 36| }
 37| 
--- test hits (5) ---
eote-player-m2-2.test.mjs:29: import e08057 from '../src/cards/entries/08057.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:239: test('P6 08057 黑色扇子：资源阈值 15/20 的每回合额外行动与技能修正（10+ 生命/神智待引擎读点）', () => {
eote-player-m2-2.test.mjs:242: const fan = asset(s, '08057')
eote-player-m2-2.test.mjs:261: asset(statState, '08057')

==========================================================================================
## 08058 The Red Clock / 红色闹钟  [asset|rogue|xp:5|EXCEPTIONAL|deckLimit:1|cost:2] traits:Item,Relic
EN: Exceptional. Uses (0 charges).
Forced - After your turn begins: You may take all charges here, as resources. Place 1 charge here. If it has exactly...
- 1 charge, you get +4 skill value for your next skill test.
- 2 charges, you may move up to 3 times.
- 3 charges, you may take 2 additional actions this turn.
ZH: 卓越。使用(0充能)。
强制 - 在你的回合开始后：你可以拿取此处所有充能，作为资源。在此放置1充能。如果它恰好拥有……
- 1充能，下次技能检定中你得到技能值+4。
- 2充能，你可以移动最多3次。
- 3充能，你本回合可以进行2次额外行动。
--- src/cards/entries/08058.js (62 lines) ---
  1| // 08058 红色闹钟（The Red Clock）· 游荡者资产 · 饰品 · 5 经验 · 卓越。
  2| //
  3| // 卡面：卓越。使用(0 充能)。
  4| //       强制 - 在你的回合开始后：你可以拿取此处所有充能，作为资源。在此放置 1 充能。如果它恰好拥有……
  5| //       - 1 充能，下次技能检定中你得到技能值 +4。
  6| //       - 2 充能，你可以移动最多 3 次。
  7| //       - 3 充能，你本回合可以进行 2 次额外行动。
  8| //
  9| // 一卡一文件：这张卡的行为只在这里维护。
 10| // approximation（与 08053 同口径）：「下次技能检定 +4」用 api.addEffect({duration:'endOfTest'})；
 11| // 移动用 api.moveInvestigator 近似；额外行动用 api.gainAction。注意升级版是「先可以拿取，再放置」。
 12| export default {
 13|   code: '08058',
 14|   uses: 0,
 15|   usesType: 'charges',
 16|   abilities: [
 17|     {
 18|       kind: 'forced',
 19|       trigger: 'turnBegins',
 20|       label: '回合开始：可先拿取全部充能作为资源，再放置 1 充能；按充能数触发 1/2/3 效果',
 21|       criteria: [({ inv, context, source }) => Boolean(source) && context?.seat === inv.seat],
 22|       resolve: ({ state, inv, source, api }) => {
 23|         if (!source) return
 24|         const charges = Number(source.uses) || 0
 25|         if (charges > 0) {
 26|           const answer = api.choice({ kind: 'effect', source: '08058', seat: inv.seat, canSkip: true,
 27|             prompt: `「红色闹钟」：是否拿取此处 ${charges} 充能作为资源？`,
 28|             options: [{ id: 'take', label: `拿取 ${charges} 资源` }, { id: 'skip', label: '不拿取' }] })
 29|           if (answer === 'take') {
 30|             api.addUses(source, -charges)
 31|             api.gainResources(inv.seat, charges)
 32|             api.info(`⏰ 「红色闹钟」：拿取 ${charges} 充能作为资源。`)
 33|           }
 34|         }
 35|         api.addUses(source, 1)
 36|         const total = Number(source.uses) || 0
 37|         if (total === 1) {
 38|           api.addEffect({ duration: 'endOfTest', sourceCode: '08058', sourceInstanceId: source.id,
 39|             label: '红色闹钟：下一次技能检定 +4 技能值', modifiers: [{ target: 'skill:*', amount: 4 }] })
 40|           api.info('⏰ 「红色闹钟」：下一次技能检定 +4 技能值。')
 41|         } else if (total === 2) {
 42|           const here = state.locations.find(location => location.id === inv.location)
 43|           for (let moved = 0; moved < 3; moved++) {
 44|             const destinations = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
 45|             const answers = [{ id: 'skip', label: '不移动' }, ...destinations.map(id => ({ id, label: api.locationName(id) }))]
 46|             if (answers.length === 1) break
 47|             const target = api.choice({ kind: 'move', source: '08058', seat: inv.seat, canSkip: true,
 48|               prompt: `「红色闹钟」：是否移动一次（还可移动 ${3 - moved} 次）？`, options: answers })
 49|             if (target === 'skip') break
 50|             api.moveInvestigator(inv.seat, target)
 51|             api.info(`⏰ 「红色闹钟」：移动到「${api.locationName(target)}」。`)
 52|           }
 53|         } else if (total === 3) {
 54|           api.gainAction(inv.seat, 2)
 55|           api.info('⏰ 「红色闹钟」：本回合额外 2 次行动。')
 56|         }
 57|       },
 58|     },
 59|   ],
 60|   modifiers: [],
 61| }
 62| 
--- test hits (8) ---
eote-player-m2-2.test.mjs:30: import e08058 from '../src/cards/entries/08058.js'
eote-player-m2-2.test.mjs:52: const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
eote-player-m2-2.test.mjs:606: test('P6 08058 红色闹钟（5经验）：先拿取再放充能，1/2/3 充能分支', () => {
eote-player-m2-2.test.mjs:609: const clock = asset(s, '08058')
eote-player-m2-2.test.mjs:611: runDescriptor(s, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 } })
eote-player-m2-2.test.mjs:619: runDescriptor(s, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => {
eote-player-m2-2.test.mjs:629: const takeClock = asset(takeState, '08058')
eote-player-m2-2.test.mjs:632: runDescriptor(takeState, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => {
