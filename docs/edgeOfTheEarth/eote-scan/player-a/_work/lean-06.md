
========================================================================================
## 08069 Grounded / 情绪稳定 [asset|mystic|xp:3|deckLimit:2|cost:0] traits:Talent,Composure
EN: Fast. Limit 1 [[Composure]] in play.
You get +1 skill value during skill tests on [[Spell]] cards.
Non-direct damage/horror must be assigned to Grounded before it can be assigned to your investigator card.
[fast] During a skill test on a [[Spell]] card, spend 1 resource: You get +1 skill value for this test.
ZH: (与条目注释重复，已省略)
--- entries/08069.js ---
  1| // 08069 情绪稳定（Grounded）· 秘术师（Mystic）资产 · 3 经验（03113 的升级版）。
  2| //
  3| // 卡面：快速。[[沉稳]]卡牌场上仅限 1 张。
  4| //       你在 [[法术]] 卡牌的技能检定期间得到 +1 技能值。
  5| //       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给情绪稳定。
  6| //       [free] 在 [[法术]] 卡牌的技能检定期间，花费 1 资源：你本次检定得到技能值 +1。
  7| //
  8| // 一卡一文件：这张卡的行为只在这里维护。
  9| // 读点：composure（沉稳：非直接恐惧先分配）+ freeTriggers（法术检定花 1 资源 +1，requireTestTrait）；
 10| // 被动 +1 用 modifier 的条件函数（source 卡面特性含 Spell 的技能检定）。
 11| // 与 08056 相同，非直接伤害分支待 primitive request（composureDamage）。
 12| import { ALL_CARDS } from '../../cards/cards-data.js'
 13| 
 14| const testSourceHasTrait = (state, trait) => {
 15|   const code = state?.skillTest?.source?.code
 16|   if (!code) return false
 17|   return (ALL_CARDS[code]?.traits || []).some(item => String(item).toLowerCase() === String(trait).toLowerCase())
 18| }
 19| 
 20| export default {
 21|   code: '08069',
 22|   fast: true,
 23|   composure: true,
 24|   freeTriggers: [
 25|     { skill: 'any', cost: { resources: 1 }, bonus: 1, requireTestTrait: 'Spell' },
 26|   ],
 27|   abilities: [],
 28|   modifiers: [
 29|     { target: 'skill:*', amount: 1, condition: { when: ({ state }) => testSourceHasTrait(state, 'Spell') } },
 30|   ],
 31| }
 32| 

========================================================================================
## 08070 True Magick / 真法魔典 [asset|mystic|xp:5|deckLimit:2|cost:4] traits:Item,Relic,Tome
EN: Uses (1 charge). Replenish this charge at the start of each round.
You may resolve abilities on [[Spell]] assets in your hand by revealing them from your hand. Treat True Magick as if it were the revealed asset (to pay its costs, spend charges, perfom its effect, etc).
ZH: (与条目注释重复，已省略)
--- entries/08070.js ---
  1| // 08070 真法魔典（True Magick）· 秘术师资产 · 手部+奥术 · 5 经验。
  2| //
  3| // 卡面：使用(1 充能)。当每轮开始时重新补满本充能。
  4| //       你可以通过揭示手牌中的 [[法术]] 支援来结算卡牌上的能力。如同真法魔典是已揭示的支援。
  5| //       (以支付费用、花费充能、执行效果等)。
  6| //
  7| // 一卡一文件：这张卡的行为只在这里维护。
  8| // approximation: 引擎没有「代理来源（把魔典当作被揭示法术卡来执行其能力）」的原语。这里用
  9| // 「揭示手牌中的一张法术支援 → api.resolveCardAbility 结算其能力」近似；费用/充能/效果由该
 10| // 法术卡实例承担，未真正转移到魔典上。
 11| import { ALL_CARDS } from '../../cards/cards-data.js'
 12| 
 13| const isSpellAsset = code => {
 14|   const def = ALL_CARDS[code]
 15|   return Boolean(def) && def.type === 'asset'
 16|     && (def.traits || []).some(trait => String(trait).toLowerCase() === 'spell')
 17| }
 18| 
 19| export default {
 20|   code: '08070',
 21|   uses: 1,
 22|   usesType: 'charges',
 23|   abilities: [
 24|     {
 25|       kind: 'free',
 26|       label: '揭示手牌中的一张[[法术]]支援，并结算它的一个能力',
 27|       criteria: [({ inv }) => [...new Set(inv.hand || [])].some(isSpellAsset)],
 28|       resolve: ({ inv, api }) => {
 29|         const spells = [...new Set(inv.hand || [])].filter(isSpellAsset)
 30|         if (!spells.length) {
 31|           api.info('「真法魔典」：你手中没有[[法术]]支援。')
 32|           return
 33|         }
 34|         const picked = spells.length === 1 ? spells[0]
 35|           : api.choice({ kind: 'card', source: '08070', seat: inv.seat,
 36|             prompt: '选择要揭示的手牌[[法术]]支援。',
 37|             options: spells.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
 38|         if (!spells.includes(picked)) return
 39|         api.info(`📖 「真法魔典」：揭示手牌中的「${api.cardName(picked)}」（近似代理其能力）。`)
 40|         const options = (api.cardAbilityOptions?.(inv.seat, picked) || []).filter(option => option.actionKind == null || option.actionKind === 'action')
 41|         if (!options.length) {
 42|           api.info('「真法魔典」：这张法术卡当前没有可结算的能力。')
 43|           return
 44|         }
 45|         const abilityIndex = options.length === 1 ? options[0].index
 46|           : Number(api.choice({ kind: 'effect', source: '08070', seat: inv.seat,
 47|             prompt: '选择要结算的能力。',
 48|             options: options.map((option, index) => ({ id: String(index), label: option.label || `能力 ${index + 1}` })) }))
 49|         const ability = options[Number.isInteger(abilityIndex) && abilityIndex >= 0 && abilityIndex < options.length
 50|           ? abilityIndex : 0]
 51|         api.resolveCardAbility(inv.seat, picked, { abilityIndex: ability.index, ignoreCosts: false })
 52|         api.info(`📖 「真法魔典」：结算「${api.cardName(picked)}」的能力。`)
 53|       },
 54|     },
 55|   ],
 56|   modifiers: [],
 57| }
 58| 

========================================================================================
## 08071 Short Supply / 补给匮乏 [asset|survivor|xp:0|deckLimit:1] traits:Talent
EN: Permanent. Limit 1 per deck. Purchase at deck creation.
Forced - When your first turn of the game begins: Discard the top 10 cards of your deck.
ZH: (与条目注释重复，已省略)
--- entries/08071.js ---
  1| // 08071 补给匮乏（Short Supply）· 幸存者（Survivor）资产 · 永久（建库时购买，限 1 张）。
  2| //
  3| // 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
  4| //       强制 - 在你游戏的第一个回合开始时：弃掉你牌库顶 10 张卡牌。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // 读点：卡面数据 permanent:true，开局由 setup.js 的永久卡循环自动入场；强制效果挂 turnBegins
  8| // 窗口，limit perGame 保证整局一次，api.discardTopOfDeck 弃牌。
  9| export default {
 10|   code: '08071',
 11|   abilities: [
 12|     {
 13|       kind: 'forced',
 14|       trigger: 'turnBegins',
 15|       label: '你游戏的第一个回合开始时：弃掉牌库顶 10 张卡牌',
 16|       limit: { scope: 'perGame', owner: 'player' },
 17|       criteria: [({ state, inv, context }) => context?.seat === inv.seat && state.round === 1],
 18|       resolve: ({ inv, api }) => {
 19|         const discarded = api.discardTopOfDeck(inv.seat, 10)
 20|         api.info(`📦 「补给匮乏」：${inv.name} 弃掉了牌库顶 10 张卡牌${discarded ? '' : '（牌库不足 10 张，弃到空为止）'}。`)
 21|       },
 22|     },
 23|   ],
 24|   modifiers: [],
 25| }
 26| 

========================================================================================
## 08072 Schoffner's Catalogue / 沙夫纳的目录 [asset|survivor|xp:0|deckLimit:2|cost:2] traits:Item,Tome
EN: Uses (5 secrets). If Schoffner's Catalogue has no secrets, discard it.
You may spend secrets on Schoffner's Catalogue as resources to pay for [[Item]] assets played by any investigator at your location.
ZH: (与条目注释重复，已省略)
--- entries/08072.js ---
  1| // 08072 沙夫纳的目录（Schoffner's Catalogue）· 幸存者资产 · 道具 · 0 经验。
  2| //
  3| // 卡面：使用(5 秘密)。如果沙夫纳的目录没有秘密，将其弃掉。
  4| //       你可以将沙夫纳的目录的秘密作为资源花费，来支付你所在地点任意调查员打出的 [[道具]] 支援。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // approximation: 引擎没有「把支援用途当资源直接支付」的付费来源通道。这里用 free 能力
  8| // 「花费 1 秘密 → 获得 1 资源」近似（资源可用于后续支付[[道具]]支援），并把「仅限同地点
  9| // [[道具]]支援」的限制记在报告里。discardWhenEmpty 由条目级字段处理。
 10| export default {
 11|   code: '08072',
 12|   uses: 5,
 13|   usesType: 'secrets',
 14|   discardWhenEmpty: true,
 15|   abilities: [
 16|     {
 17|       kind: 'free',
 18|       cost: { uses: 1 },
 19|       label: '花费 1 秘密：获得 1 资源（近似「秘密当资源支付同地点[[道具]]支援」）',
 20|       criteria: [({ source }) => (source?.uses || 0) > 0],
 21|       resolve: ({ inv, source, api }) => {
 22|         if (!source) return
 23|         api.gainResources(inv.seat, 1)
 24|         api.info(`📒 「沙夫纳的目录」：花费 1 秘密获得 1 资源（当前秘密 ${source.uses || 0}）。`)
 25|       },
 26|     },
 27|   ],
 28|   modifiers: [],
 29| }
 30| 

========================================================================================
## 08073 Bandages / 绷带 [asset|survivor|xp:0|deckLimit:2|cost:2] traits:Item
EN: Uses (3 supplies). If Bandages has no supplies, discard it.
[reaction] After an investigator or [[Ally]] asset at your location takes 1 or more damage, spend 1 supply: Heal 1 damage from that card.
ZH: (与条目注释重复，已省略)
--- entries/08073.js ---
  1| // 08073 绷带（Bandages）· 幸存者（Survivor）资产 · 0 经验。
  2| //
  3| // 卡面：使用(3 补给)。如果绷带没有补给，将其弃掉。
  4| //       [reaction] 在你所在地点的调查员或 [[盟友]] 支援受到 1 点或更多伤害后，花费 1 补给：
  5| //       治愈该卡牌 1 点伤害。
  6| //
  7| // 一卡一文件：这张卡的行为只在这里维护。
  8| // 读点：
  9| //   · 调查员受伤窗口 = harmAssigned（context.seat / damage，enemies.js#applyHarm 末尾）；
 10| //   · 盟友支援受伤窗口 = assetHarmPlaced（context.assetId / damage / seat=控制者）。
 11| // 费用 uses:1 由引擎扣补给；治愈用 api.healDamage / api.healAsset。
 12| export default {
 13|   code: '08073',
 14|   uses: 3,
 15|   usesType: 'supplies',
 16|   discardWhenEmpty: true,
 17|   abilities: [
 18|     {
 19|       kind: 'reaction',
 20|       trigger: 'harmAssigned',
 21|       label: '同地点调查员受伤后：花费 1 补给，治愈其 1 点伤害',
 22|       cost: { uses: 1 },
 23|       criteria: [({ state, inv, context }) => Boolean(context)
 24|         && (context.damage || 0) > 0
 25|         && Number.isInteger(context.seat)
 26|         && state.investigators[context.seat]?.location === inv.location],
 27|       resolve: ({ context, api }) => {
 28|         api.healDamage(Number(context.seat), 1)
 29|         api.info(`🩹 「绷带」治愈了 ${context.seat != null ? '' : ''}同地点调查员 1 点伤害。`)
 30|       },
 31|     },
 32|     {
 33|       kind: 'reaction',
 34|       trigger: 'assetHarmPlaced',
 35|       label: '同地点盟友支援受伤后：花费 1 补给，治愈该支援 1 点伤害',
 36|       cost: { uses: 1 },
 37|       criteria: [({ state, inv, context }) => {
 38|         if (!context || (context.damage || 0) <= 0 || !context.assetId) return false
 39|         const owner = state.investigators.find(person => (person.assets || []).some(asset => asset.id === context.assetId))
 40|         return Boolean(owner) && owner.location === inv.location
 41|       }],
 42|       resolve: ({ state, context, api }) => {
 43|         const owner = state.investigators.find(person => (person.assets || []).some(asset => asset.id === context.assetId))
 44|         const asset = owner?.assets.find(item => item.id === context.assetId)
 45|         if (!asset) return
 46|         api.healAsset(asset, { damage: 1 })
 47|         api.info(`🩹 「绷带」治愈了「${api.cardName(asset.code)}」1 点伤害。`)
 48|       },
 49|     },
 50|   ],
 51|   modifiers: [],
 52| }
 53| 

========================================================================================
## 08074 Jury-Rig / 应急装备 [event|survivor|xp:0|deckLimit:2|cost:0] traits:Upgrade
EN: Uses (3 durability).
Attach to an [[Item]] asset controlled by an investigator at your location.
[fast] During a skill test on attached asset, spend 1 durability: You get +2 skill value for this test.
ZH: (与条目注释重复，已省略)
--- entries/08074.js ---
  1| // 08074 应急装备（Jury-Rig）· 幸存者事件 · 升级 · 0 经验。
  2| //
  3| // 卡面：使用(3 耐久)。附属到你所在地点的一位调查员控制的 [[道具]] 支援上。
  4| //       [free] 被附属支援的技能检定期间，花费 1 耐久：你本次检定得到 +2 技能值。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // approximation: 引擎的 attachTo 事件通道不会按条目 uses 初始化附属实例，所以这里在 played
  8| // resolve 里手动 api.moveCard 到 attached 并用 api.setAssetUses 设置 3 耐久；「被附属支援的
  9| // 技能检定期间」用 state.skillTest.source.assetId 或 state._resolvingAssetId 与宿主 id 比对
 10| // （仅对通过支援能力发起的检定可靠，见报告）。
 11| import { ALL_CARDS } from '../../cards/cards-data.js'
 12| 
 13| const isItemAsset = code => {
 14|   const def = ALL_CARDS[code]
 15|   return Boolean(def) && def.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
 16| }
 17| 
 18| export default {
 19|   code: '08074',
 20|   uses: 3,
 21|   usesType: 'durability',
 22|   abilities: [
 23|     {
 24|       kind: 'played',
 25|       label: '附属到你所在地点一位调查员控制的[[道具]]支援（3 耐久）',
 26|       resolve: ({ state, inv, api }) => {
 27|         const hosts = state.investigators
 28|           .filter(owner => !owner.defeated && !owner.resigned && owner.location === inv.location)
 29|           .flatMap(owner => (owner.assets || []).map(asset => ({ owner, asset })))
 30|           .filter(({ asset }) => isItemAsset(asset.code))
 31|         if (!hosts.length) {
 32|           api.info('「应急装备」：同地点没有可以附属的[[道具]]支援。')
 33|           return
 34|         }
 35|         const answer = hosts.length === 1 ? '0'
 36|           : api.choice({ kind: 'target', source: '08074', seat: inv.seat,
 37|             prompt: '选择要附属的[[道具]]支援。',
 38|             options: hosts.map(({ owner, asset }, index) => ({ id: String(index), label: `${api.cardName(asset.code)}（${owner.name}）` })) })
 39|         const target = hosts[Number(answer)] || hosts[0]
 40|         if (!target) return
 41|         const moved = api.moveCard({ code: '08074', from: 'hand', to: 'attached', attachTo: target.asset.id })
 42|         if (!moved) {
 43|           api.info('「应急装备」：无法附属到该支援。')
 44|           return
 45|         }
 46|         const attachment = (target.asset.attachments || []).at(-1)
 47|         if (attachment) api.setAssetUses(attachment, 3)
 48|         api.info(`🧰 「应急装备」：附属到「${api.cardName(target.asset.code)}」（3 耐久）。`)
 49|       },
 50|     },
 51|     {
 52|       kind: 'free',
 53|       cost: { uses: 1 },
 54|       label: '被附属支援的技能检定期间：花 1 耐久，本次检定 +2 技能值',
 55|       criteria: [({ state, source }) => {
 56|         const hostId = source?.hostAssetId
 57|         if (!hostId || !state.skillTest) return false
 58|         return state.skillTest.source?.assetId === hostId || state._resolvingAssetId === hostId
 59|       }],
 60|       resolve: ({ inv, api }) => {
 61|         api.addPendingTestBonus(2)
 62|         api.info(`🧰 「应急装备」：${inv.name} 本次技能检定 +2 技能值。`)
 63|       },
 64|     },
 65|   ],
 66|   modifiers: [],
 67| }
 68| 

========================================================================================
## 08075 Bangle of Jinxes / 厄运手镯 [asset|survivor|xp:1|deckLimit:2|cost:2] traits:Item,Charm,Cursed
EN: Uses (1 charge).
[fast] Spend 1 charge: You get +2 skill value for this test. (Limit once per test.)
[reaction] After an enemy attacks you: Place 1 charge on Bangle of Jinxes.
ZH: (与条目注释重复，已省略)
--- entries/08075.js ---
  1| // 08075 厄运手镯（Bangle of Jinxes）· 幸存者（Survivor）资产 · 饰品 · 1 经验。
  2| //
  3| // 卡面：使用(1 充能)。
  4| //       [free] 花费 1 充能：你本次技能检定得到技能值 +2。(每次检定仅限一次。)
  5| //       [reaction] 一个敌人攻击你后：在厄运手镯上放置 1 充能。
  6| //
  7| // 一卡一文件：这张卡的行为只在这里维护。
  8| // 读点：检定中加值 = api.addPendingTestBonus；反应的攻击窗口 = enemyAttacked（含被取消的攻击，
  9| // 与 07027/08001 同一窗口）；充能读写 = api.addUses。
 10| export default {
 11|   code: '08075',
 12|   uses: 1,
 13|   usesType: 'charges',
 14|   abilities: [
 15|     {
 16|       kind: 'free',
 17|       cost: { uses: 1 },
 18|       limit: { scope: 'perTest', owner: 'player' },
 19|       label: '花费 1 充能：本次技能检定 +2（每次检定限一次）',
 20|       criteria: [({ state }) => Boolean(state.skillTest)],
 21|       resolve: ({ inv, api }) => {
 22|         api.addPendingTestBonus(2)
 23|         api.info(`📿 「厄运手镯」：${inv.name} 本次技能检定 +2 技能值。`)
 24|       },
 25|     },
 26|     {
 27|       kind: 'reaction',
 28|       trigger: 'enemyAttacked',
 29|       label: '敌人攻击你后：在厄运手镯上放置 1 充能',
 30|       criteria: [({ inv, context }) => context?.seat === inv.seat],
 31|       resolve: ({ source, api }) => {
 32|         if (!source) return
 33|         api.addUses(source, 1)
 34|         api.info(`📿 「厄运手镯」：放置 1 充能（当前 ${source.uses || 0}）。`)
 35|       },
 36|     },
 37|   ],
 38|   modifiers: [],
 39| }
 40| 

========================================================================================
## 08076 Burn After Reading / 阅后即焚 [event|survivor|xp:1|deckLimit:2|cost:1] traits:Insight
EN: Exile a level 0-5 card in your hand. Discover 2 clues at your location. If the exiled card was level 2 or higher, remove 1 doom from the current agenda. Exile Burn After Reading.
Card designed by the Council-in-Exile at Gen Con 2020
ZH: (与条目注释重复，已省略)
--- entries/08076.js ---
  1| // 08076 阅后即焚（Burn After Reading）· 幸存者事件 · 1 经验。
  2| //
  3| // 卡面：放逐你手中一张等级 0-5 的卡牌。发现你所在地点的 2 个线索。
  4| //       如果被放逐的卡牌为等级 2 或更高，移除当前密谋上的 1 个毁灭印记。放逐阅后即焚。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // approximation: 引擎没有直接的「放逐任意手牌」ctx.api。这里先把该手牌移入弃牌堆，再用
  8| // api.exileFromDiscard 记账放逐（state.removedFromGame 与引擎放逐读点一致）；事件自身用
  9| // played 描述子的 exileAfterPlay 放逐。
 10| import { ALL_CARDS } from '../../cards/cards-data.js'
 11| 
 12| const levelOf = code => {
 13|   const def = ALL_CARDS[code]
 14|   if (!def || def.subtype === 'weakness' || def.subtype === 'basicweakness') return null
 15|   const xp = Number(def.xp)
 16|   return Number.isSafeInteger(xp) && xp >= 0 && xp <= 5 ? xp : null
 17| }
 18| 
 19| export default {
 20|   code: '08076',
 21|   abilities: [
 22|     {
 23|       kind: 'played',
 24|       exileAfterPlay: true,
 25|       label: '放逐一张 0-5 级手牌：发现 2 个线索；等级≥2 时移除 1 毁灭；放逐本卡',
 26|       resolve: ({ inv, api }) => {
 27|         const candidates = [...new Set(inv.hand || [])].filter(code => levelOf(code) != null && code !== '08076')
 28|         if (!candidates.length) {
 29|           api.info('「阅后即焚」：你手中没有 0-5 级的卡牌可以放逐。')
 30|           return
 31|         }
 32|         const picked = candidates.length === 1 ? candidates[0]
 33|           : api.choice({ kind: 'card', source: '08076', seat: inv.seat,
 34|             prompt: '选择要放逐的手牌（等级 0-5）。',
 35|             options: candidates.map(code => ({ id: code, cardCode: code, label: `${api.cardName(code)}（${levelOf(code)} 级）` })) })
 36|         if (!candidates.includes(picked)) return
 37|         const level = levelOf(picked)
 38|         api.moveCard({ code: picked, from: 'hand', to: 'discard' })
 39|         api.exileFromDiscard(inv.seat, picked)
 40|         api.info(`🔥 「阅后即焚」：放逐了「${api.cardName(picked)}」（${level} 级）。`)
 41|         api.discoverClue(inv.seat, 2)
 42|         if (level >= 2) {
 43|           const removed = api.removeDoom(1)
 44|           api.info(removed > 0 ? '🔥 「阅后即焚」：移除了当前密谋上的 1 个毁灭印记。' : '「阅后即焚」：当前密谋没有可移除的毁灭印记。')
 45|         }
 46|       },
 47|     },
 48|   ],
 49|   // 事件自身放逐：played 描述子读点见 src/engine/actions.js#_playDisposal。
 50|   modifiers: [],
 51| }
 52| 

========================================================================================
## 08077 Strength in Numbers / 人多力量大 [skill|survivor|xp:1|deckLimit:2] traits:Innate,Synergy
EN: Strength in Numbers gains a [wild] icon for each different class among cards you control.
ZH: (与条目注释重复，已省略)
--- entries/08077.js ---
  1| // 08077 人多力量大（Strength in Numbers）· 幸存者（Survivor）技能 · 1 经验。
  2| //
  3| // 卡面：你控制的卡牌中每有一个不同的职阶，人多力量大获得一个 [wild] 图标。
  4| //
  5| // 一卡一文件：这张卡的行为只在这里维护。
  6| // 读点：commit 档案的 iconBonus（动态图标）；职阶从 cards-data 的卡面数据读取（与 05279 同口径）。
  7| import { ALL_CARDS } from '../../cards/cards-data.js'
  8| 
  9| const distinctClassCount = inv => {
 10|   const classes = new Set()
 11|   for (const asset of inv?.assets || []) {
 12|     const klass = ALL_CARDS[asset.code]?.klass
 13|     if (klass) classes.add(String(klass).toLowerCase())
 14|   }
 15|   return classes.size
 16| }
 17| 
 18| export default {
 19|   code: '08077',
 20|   abilities: [
 21|     {
 22|       kind: 'commit',
 23|       label: '人多力量大：你控制的卡牌每有一种不同职阶，获得 1 个万能图标',
 24|       skill: {
 25|         iconBonus: ({ inv }) => distinctClassCount(inv),
 26|       },
 27|     },
 28|   ],
 29|   modifiers: [],
 30| }
 31| 

========================================================================================
## 08078 Dauntless Spirit / 无畏精神 [skill|survivor|xp:1|deckLimit:2] traits:Innate,Developed
EN: While Dauntless Spirit is in your hand or committed to a skill test, it gains [willpower] icons equal to your [combat], and [combat] icons equal to your [willpower].
ZH: (与条目注释重复，已省略)
--- entries/08078.js ---
  1| // 08078 无畏精神（Dauntless Spirit）· 幸存者（Survivor）技能 · 1 经验。
  2| //
  3| // 卡面：无畏精神在你手中或投入到技能检定中时，其获得等于你 [combat] 的 [willpower] 图标，
  4| //       以及等于你 [willpower] 的 [combat] 图标。
  5| //
  6| // 一卡一文件：这张卡的行为只在这里维护。
  7| // 读点：commit 档案的 iconBonus（动态图标）。ctx 没有 getStat/api，读 cards-data 的印刷属性
  8| // （近似；primitive request 已登记，主进程把修正值读点接进 iconBonus 后改一行即可）。
  9| import { ALL_CARDS } from '../../cards/cards-data.js'
 10| 
 11| const printed = (inv, name) => Number(ALL_CARDS[inv?.code]?.[name] ?? 0)
 12| 
 13| export default {
 14|   code: '08078',
 15|   abilities: [
 16|     {
 17|       kind: 'commit',
 18|       label: '无畏精神：获得等于你[战斗]的[意志]图标与等于你[意志]的[战斗]图标',
 19|       skill: {
 20|         iconBonus: ({ inv, skill }) => {
 21|           const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
 22|           let icons = 0
 23|           if (tested.has('willpower')) icons += printed(inv, 'combat')
 24|           if (tested.has('combat')) icons += printed(inv, 'willpower')
 25|           return icons
 26|         },
 27|       },
 28|     },
 29|   ],
 30|   modifiers: [],
 31| }
 32| 
