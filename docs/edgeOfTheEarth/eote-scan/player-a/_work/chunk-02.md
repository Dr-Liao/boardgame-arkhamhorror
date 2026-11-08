
==========================================================================================
## 08029 Fang of Tyr'thrha / 提尔斯哈之牙  [event|guardian|xp:4|deckLimit:2|cost:3] traits:Spell
EN: Fight. Choose an enemy at any revealed location as the target for this attack. Before resolving this attack, you may move to that enemy's location. Add your [agility] to your [combat] for this attack. This attack deals +3 damage.
ZH: 攻击。选择任何已揭示地点的一个敌人作为本次攻击的目标。在结算本次攻击前，你可以移动到该敌人的地点。本次攻击你的[combat]加上你的[agility]。本次攻击造成+3伤害。
--- src/cards/entries/08029.js (53 lines) ---
  1| // 08029 提尔斯哈之牙
  2| // 卡面：攻击。选择任何已揭示地点的一个敌人作为本次攻击的目标。在结算本次攻击前，
  3| //       你可以移动到该敌人的地点。本次攻击你的[combat]加上你的[agility]。本次攻击造成 +3 伤害。
  4| //
  5| // 一张卡一个文件：这张卡的行为只在这里维护。
  6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  7| //
  8| // 口径与偏差：doFight 只允许攻击同地点（或声明连接地点）的敌人，因此这里按「选择任意已揭示
  9| // 地点的敌人 → 若不同地点则移动到该地点 → addSkill:'agility'、damageBonus:3 攻击」实现。
 10| // 卡面的「可以移动」在本实现中是强制的（不移动则无法完成远程攻击）；作为 approximation 记录。
 11| import { attackableEnemies } from './_shared.js'
 12| 
 13| export default {
 14|   code: '08029',
 15|   abilities: [
 16|     {
 17|       kind: 'played',
 18|       countsAs: 'fight',
 19|       noOpportunityAttack: true,
 20|       label: '攻击任意已揭示地点的一个敌人；攻击前可移动到其地点；加入[agility]，+3 伤害',
 21|       resolve: ({ state, inv, api }) => {
 22|         const targets = (state.enemies || []).filter(enemy => {
 23|           const location = (state.locations || []).find(item => item.id === enemy.location)
 24|           return location?.revealed === true
 25|         })
 26|         if (!targets.length) {
 27|           api.info('没有已揭示地点上的敌人可攻击。')
 28|           return
 29|         }
 30|         const chosen = targets.length === 1 ? targets[0].id : api.choice({
 31|           kind: 'target', source: '08029', seat: inv.seat,
 32|           prompt: '提尔斯哈之牙：选择任何已揭示地点的一个敌人。',
 33|           options: targets.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${api.locName(enemy.location)}）` })),
 34|         })
 35|         const enemy = targets.find(item => item.id === chosen) || targets[0]
 36|         if (enemy.location !== inv.location) {
 37|           api.moveInvestigator(inv.seat, enemy.location)
 38|           // api.moveInvestigator 无返回值；用移动后的实际位置确认是否到达。
 39|           if (inv.location !== enemy.location) {
 40|             api.info('无法移动到该敌人的地点。')
 41|             return
 42|           }
 43|         }
 44|         api.fight(inv.seat, enemy.id, {
 45|           addSkill: 'agility', damageBonus: 3, noSpend: true,
 46|           sourceCode: '08029', presentationCardCode: '08029',
 47|         })
 48|       },
 49|     },
 50|   ],
 51|   modifiers: [],
 52| }
 53| 
--- test hits (6) ---
eote-player-m2-1.test.mjs:9: //   08029 任意已揭示地点敌人（doFight 不支持远程攻击，改为必先移动到敌人地点）
eote-player-m2-1.test.mjs:43: import card08029 from '../src/cards/entries/08029.js'
eote-player-m2-1.test.mjs:65: card08027, card08028, card08029, card08030, card08031, card08032, card08033, card08034, card08035,
eote-player-m2-1.test.mjs:242: // ── 08029 提尔斯哈之牙 ──────────────────────────────────────────────────────
eote-player-m2-1.test.mjs:243: test('P6 08029 提尔斯哈之牙 攻击已揭示地点敌人：移动至其地点，加入[agility]，+3 伤害', () => {
eote-player-m2-1.test.mjs:257: resolvePlayed(state, '08029', {

==========================================================================================
## 08030 Butterfly Swords / 蝴蝶对剑  [asset|guardian|xp:5|deckLimit:2|cost:3] traits:Item,Weapon,Melee
EN: [action]: Fight. You get +2 [combat] for this attack. After this attack, you may fight again, adding your [agility] to your skill value for that attack. If both attacks are successful, you may exhaust Butterfly Swords to have the second attack deal +1 damage.
ZH: [action]：攻击。本次攻击你得到+2[combat]。本次攻击后，你可以再次攻击，这次攻击将你的[agility]加入你的技能值。如果两次攻击都成功，你可以横置蝴蝶对剑，使第二次攻击造成+1伤害。
--- src/cards/entries/08030.js (70 lines) ---
  1| // 08030 蝴蝶对剑（等级 5）
  2| // 卡面：[action]：攻击。本次攻击你得到 +2[combat]。本次攻击后，你可以再次攻击，
  3| //       这次攻击将你的[agility]加入你的技能值。如果两次攻击都成功，你可以横置蝴蝶对剑，
  4| //       使第二次攻击造成 +1 伤害。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // 口径：第一次攻击 combatBonus 2；随后可再次攻击（addSkill:'agility'，+1 伤害）。
 10| // 「两次都成功才可以横置使第二次 +1 伤害」：用两次攻击的 onSuccess 记录成功，再在结算后补 1 点伤害
 11| // 并横置（approximation：这是 post-hoc 追加伤害，不是把 +1 并入第二次攻击的伤害结算；若第二次攻击
 12| // 已击败敌人则不再补）。第二次攻击本身不额外花行动（noSpend）。
 13| import { attackableEnemies } from './_shared.js'
 14| 
 15| export default {
 16|   code: '08030',
 17|   abilities: [
 18|     {
 19|       kind: 'action',
 20|       countsAs: 'fight',
 21|       label: '攻击（+2[combat]）；可再次攻击（加入[agility]）；两次都成功可横置使第二次 +1 伤害',
 22|       cost: { action: true },
 23|       resolve: ({ state, inv, source, api }) => {
 24|         const targets = attackableEnemies(state, inv)
 25|         if (!targets.length) {
 26|           api.info('没有可攻击的敌人。')
 27|           return
 28|         }
 29|         const chosen = targets.length === 1 ? targets[0].id : api.choice({
 30|           kind: 'target', source: source.id, seat: inv.seat,
 31|           prompt: '蝴蝶对剑：选择攻击目标。',
 32|           options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
 33|         })
 34|         const enemy = targets.find(item => item.id === chosen) || targets[0]
 35|         let firstSuccess = false
 36|         let secondSuccess = false
 37|         api.fight(inv.seat, enemy.id, {
 38|           assetId: source.id, combatBonus: 2, noSpend: true, sourceCode: '08030',
 39|           onSuccess: () => { firstSuccess = true },
 40|         })
 41|         if (!state.enemies.includes(enemy)) return
 42|         const again = api.choice({
 43|           kind: 'effect', source: source.id, seat: inv.seat, canSkip: true,
 44|           prompt: '本次攻击后：是否再次攻击（加入[agility]）？',
 45|           options: [{ id: 'skip', label: '不再攻击' }, { id: 'again', label: '再次攻击（加入[agility]）' }],
 46|         })
 47|         if (again !== 'again') return
 48|         api.fight(inv.seat, enemy.id, {
 49|           assetId: source.id, addSkill: 'agility', noSpend: true, sourceCode: '08030',
 50|           onSuccess: () => { secondSuccess = true },
 51|         })
 52|         if (firstSuccess && secondSuccess && state.enemies.some(item => item.id === enemy.id)) {
 53|           const exhaust = api.choice({
 54|             kind: 'effect', source: source.id, seat: inv.seat, canSkip: true,
 55|             prompt: '两次攻击都成功：是否横置蝴蝶对剑，使第二次攻击 +1 伤害？',
 56|             options: [{ id: 'skip', label: '不横置' }, { id: 'exhaust', label: '横置：第二次攻击 +1 伤害' }],
 57|           })
 58|           if (exhaust === 'exhaust') {
 59|             api.exhaust(source)
 60|             // 事务克隆/嵌套检定后敌人对象会换新：从 api 读点按 id 重取再结算这次追加伤害。
 61|             const current = (api.enemiesAt(inv.location) || []).find(item => item.id === enemy.id)
 62|             if (current) api.damageEnemy(current, 1, inv.seat)
 63|           }
 64|         }
 65|       },
 66|     },
 67|   ],
 68|   modifiers: [],
 69| }
 70| 
--- test hits (7) ---
eote-player-m2-1.test.mjs:10: //   08030 两次都成功横置使第二次 +1 伤害（post-hoc 补 1 伤害）
eote-player-m2-1.test.mjs:44: import card08030 from '../src/cards/entries/08030.js'
eote-player-m2-1.test.mjs:65: card08027, card08028, card08029, card08030, card08031, card08032, card08033, card08034, card08035,
eote-player-m2-1.test.mjs:265: // ── 08030 蝴蝶对剑（等级 5）─────────────────────────────────────────────────
eote-player-m2-1.test.mjs:266: test('P6 08030 蝴蝶对剑 第一次 +2[combat]；可再次攻击；两次都成功横置使第二次 +1 伤害', () => {
eote-player-m2-1.test.mjs:269: const blade = asset(state, '08030')
eote-player-m2-1.test.mjs:276: assert.equal(me(state).assets.find(card => card.code === '08030').exhausted, true, '横置蝴蝶对剑')

==========================================================================================
## 08031 Forced Learning / 强制学习  [asset|seeker|xp:0|deckLimit:1] traits:Talent,Ritual
EN: Permanent. Limit 1 per deck. Purchase at deck creation.
Increase your deck size by 15.
During each upkeep phase, instead of drawing 1 card, draw 2 cards and discard 1 of them.
ZH: 永久。每套牌库仅限1张。当构建牌库时购买。
你的牌库卡牌张数+15。
补给阶段期间，不抽取一张卡牌，改为抽取两张并弃掉其中一张。
--- src/cards/entries/08031.js (43 lines) ---
  1| // 08031 强制学习
  2| // 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
  3| //       你的牌库卡牌张数 +15。
  4| //       补给阶段期间，不抽取一张卡牌，改为抽取两张并弃掉其中一张。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // approximation：
 10| //   · 牌库 +15：条目 deckConstruction.sizeBonus（构筑层 read point，web/deck-rules + deckbuilding 已读）；
 11| //   · 补给阶段抽牌替换：玩家支援没有 upkeepDraw 读点（请求 m2-1-08031.json）。这里用 upkeepEnd
 12| //     强制能力「再抽 1 张并弃 1 张」表达替换：正常补给抽 1 后共抽 2 弃 1，最终手牌净变化与卡面
 13| //     相同（都是 +1），差别是第二张在重整末尾才抽、弃牌时机晚于正常抽牌步骤。
 14| export default {
 15|   code: '08031',
 16|   deckConstruction: {
 17|     sizeBonus: 15,
 18|   },
 19|   abilities: [
 20|     {
 21|       kind: 'forced',
 22|       trigger: 'upkeepEnd',
 23|       label: '补给阶段：抽 2 弃 1（近似：重整结束再抽 1 弃 1；牌库 +15 由构筑层结算）',
 24|       criteria: ({ inv }) => (inv.assets || []).some(card => card.code === '08031'),
 25|       resolve: ({ inv, api }) => {
 26|         if (!(inv.deck || []).length) return
 27|         api.drawCards(inv.seat, 1)
 28|         const hand = [...new Set(inv.hand || [])]
 29|         if (!hand.length) return
 30|         const answer = hand.length === 1 ? hand[0] : api.choice({
 31|           kind: 'card', source: '08031', seat: inv.seat,
 32|           prompt: '强制学习：弃掉一张手牌。',
 33|           options: hand.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
 34|         })
 35|         const code = hand.includes(answer) ? answer : hand[0]
 36|         api.discardFromHand(inv.seat, code)
 37|         api.info('强制学习：补给阶段额外抽 1 张并弃掉 1 张手牌。')
 38|       },
 39|     },
 40|   ],
 41|   modifiers: [],
 42| }
 43| 
--- test hits (7) ---
eote-player-m2-1.test.mjs:11: //   08031 补给阶段抽 2 弃 1（改为重整结束再抽 1 弃 1；牌库 +15 走 deckConstruction）
eote-player-m2-1.test.mjs:45: import card08031 from '../src/cards/entries/08031.js'
eote-player-m2-1.test.mjs:65: card08027, card08028, card08029, card08030, card08031, card08032, card08033, card08034, card08035,
eote-player-m2-1.test.mjs:522: // ── 08031 强制学习（approximation）──────────────────────────────────────────
eote-player-m2-1.test.mjs:523: test('P6 08031 强制学习 牌库 +15；补给阶段抽 2 弃 1（approximation：重整末尾再抽 1 弃 1）', () => {
eote-player-m2-1.test.mjs:526: asset(state, '08031')
eote-player-m2-1.test.mjs:528: const builtRules = deckRules(me(state), ['08031'], {})

==========================================================================================
## 08032 Jeremiah Kirby / 耶利米·科尔比  [asset|seeker|xp:0|deckLimit:2|cost:4] traits:Ally,Miskatonic,Wayfarer
EN: You get +1 [intellect].
[reaction] After Jeremiah Kirby enters play, choose "even" or "odd:" Reveal the top 5 cards of your deck. Draw each card with a cost that matches the chosen option. Shuffle the remaining cards into your deck.
ZH: 你得到+1[intellect]。
[reaction]在耶利米·科尔比入场后，选择“偶数”或“奇数”：揭示你牌库顶的5张卡牌。抽取每张费用符合你选择的卡牌。将剩下的卡牌洗入你的牌库。
--- src/cards/entries/08032.js (50 lines) ---
  1| // 08032 耶利米·科尔比
  2| // 卡面：你得到 +1[intellect]。
  3| //       [reaction] 在耶利米·科尔比入场后，选择“偶数”或“奇数”：揭示你牌库顶的 5 张卡牌。
  4| //       抽取每张费用符合你选择的卡牌。将剩下的卡牌洗入你的牌库。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // 口径：入场反应 = assetEnteredPlay（criteria 只认本卡入场）；牌库顶 5 张用 api.topDeckCodes
 10| // 读取，符合费用奇偶的用 api.moveCard(deck→hand) 加入手牌，其余洗回（api.shuffleDeck）。
 11| import { ownSeat } from '../../engine/matcher.js'
 12| import { skillModifier } from './_shared.js'
 13| 
 14| const costParity = (api, code) => {
 15|   const cost = Number(api.cardCost?.(code))
 16|   return Number.isFinite(cost) ? (cost % 2 === 0 ? 'even' : 'odd') : null
 17| }
 18| 
 19| export default {
 20|   code: '08032',
 21|   modifiers: [
 22|     skillModifier('intellect', 1),
 23|   ],
 24|   abilities: [
 25|     {
 26|       kind: 'reaction',
 27|       trigger: 'assetEnteredPlay',
 28|       id: 'jeremiahParity',
 29|       criteria: [ownSeat(), ({ context }) => context?.assetCode === '08032'],
 30|       label: '入场后：选择偶数/奇数，揭示牌库顶 5 张，抽取费用符合的卡牌',
 31|       resolve: ({ inv, api }) => {
 32|         const parity = api.choice({
 33|           kind: 'effect', source: '08032', seat: inv.seat,
 34|           prompt: '耶利米·科尔比：选择“偶数”或“奇数”。',
 35|           options: [{ id: 'even', label: '偶数费用' }, { id: 'odd', label: '奇数费用' }],
 36|         })
 37|         const top = api.topDeckCodes(inv.seat, 5)
 38|         if (!top.length) {
 39|           api.info('耶利米·科尔比：牌库是空的。')
 40|           return
 41|         }
 42|         const picked = top.filter(code => costParity(api, code) === parity)
 43|         for (const code of picked) api.moveCard({ code, from: 'deck', to: 'hand' })
 44|         api.shuffleDeck(inv.seat)
 45|         api.info(`耶利米·科尔比：揭示牌库顶 ${top.length} 张，抽取 ${picked.length} 张${parity === 'even' ? '偶数' : '奇数'}费用卡牌，其余洗回牌库。`)
 46|       },
 47|     },
 48|   ],
 49| }
 50| 
--- test hits (7) ---
eote-player-m2-1.test.mjs:46: import card08032 from '../src/cards/entries/08032.js'
eote-player-m2-1.test.mjs:65: card08027, card08028, card08029, card08030, card08031, card08032, card08033, card08034, card08035,
eote-player-m2-1.test.mjs:280: // ── 08032 耶利米·科尔比 ─────────────────────────────────────────────────────
eote-player-m2-1.test.mjs:281: test('P6 08032 耶利米·科尔比 +1[intellect]；入场后揭示牌库顶 5 张，按费用奇偶抽牌并洗回其余', () => {
eote-player-m2-1.test.mjs:284: asset(state, '08032')
eote-player-m2-1.test.mjs:290: resolveAbility(state, '08032', {
eote-player-m2-1.test.mjs:291: kind: 'reaction', context: { assetCode: '08032' },

==========================================================================================
## 08033 Archive of Conduits / 通路档案  [asset|seeker|xp:0|deckLimit:1|cost:2] traits:Item,Tome,Occult
EN: Limit 1 per deck. As an additional cost to play this asset, place 1 resource on 4 different locations, as leylines.
[reaction] After you successfully investigate a location with a leyline, exhaust this asset: Move that leyline onto this asset. Then, if there are 4 leylines on it, discard it, take its leylines as resources, and record in your Campaign Log that "you have identified the gateway."
ZH: 每套牌库仅限1张。作为打出本支援的额外费用，在4个不同地点放置1个资源，作为灵脉。
[reaction]在你成功调查了一个带有灵脉的地点后，横置本支援：将该灵脉移动至本支援上。然后，如果本卡牌上有4个灵脉，将其弃掉，拿取本卡牌的灵脉作为资源，并在剧本日志里记录“你已经确认了前行道路”。
--- src/cards/entries/08033.js (79 lines) ---
  1| // 08033 通路档案
  2| // 卡面：每套牌库仅限 1 张。作为打出本支援的额外费用，在 4 个不同地点放置 1 个资源，作为灵脉。
  3| //       [reaction] 在你成功调查了一个带有灵脉的地点后，横置本支援：将该灵脉移动至本支援上。
  4| //       然后，如果本卡牌上有 4 个灵脉，将其弃掉，拿取本卡牌的灵脉作为资源，并在剧本日志里记录
  5| //       “你已经确认了前行道路”。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // approximation：没有通用「灵脉」标记原语（请求 m2-1-08033.json）。这里用已登记的地点特性原语
 11| // api.addLocationTrait(location,'LeyLine',{source:'08033'}) 记地点上的灵脉、用 api.addUses(asset,1)
 12| // 记本卡上的灵脉数；「本卡牌上有 4 个灵脉 → 弃掉并拿取 4 资源」按使用次数阈值实现；剧本日志记录用
 13| // api.setScenarioFlag('eoteConfirmedPath',true) 近似（替代剧本日志文本）。
 14| const LEY_TRAIT = 'LeyLine'
 15| const SOURCE = '08033'
 16| const hasLeyLine = location => (location?.traitGrants?.[LEY_TRAIT] || []).includes(SOURCE)
 17| 
 18| export default {
 19|   code: '08033',
 20|   abilities: [
 21|     {
 22|       kind: 'entersPlay',
 23|       label: '额外费用：在 4 个不同地点各放置 1 个资源作为灵脉',
 24|       resolve: ({ state, inv, source, api }) => {
 25|         if (!source) return
 26|         if ((inv.resources || 0) < 4) {
 27|           api.info('通路档案：资源不足 4，无法在 4 个地点放置灵脉。')
 28|           return
 29|         }
 30|         const chosenLocations = []
 31|         for (let i = 0; i < 4; i++) {
 32|           const candidates = (state.locations || []).filter(location => !chosenLocations.includes(location.id))
 33|           if (!candidates.length) break
 34|           const answer = candidates.length === 1 ? candidates[0].id : api.choice({
 35|             kind: 'location', source: SOURCE, seat: inv.seat,
 36|             prompt: `通路档案：选择放置灵脉的地点（${i + 1}/4）。`,
 37|             options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
 38|           })
 39|           const target = candidates.find(location => location.id === answer) || candidates[0]
 40|           if (api.spendResources(inv.seat, 1)) {
 41|             api.addLocationTrait(target, LEY_TRAIT, { source: SOURCE })
 42|             chosenLocations.push(target.id)
 43|             api.info(`通路档案：在「${api.locName(target.id)}」放置 1 个灵脉。`)
 44|           }
 45|         }
 46|         if (chosenLocations.length < 4) api.info('通路档案：地点不足以放置 4 个灵脉。')
 47|       },
 48|     },
 49|     {
 50|       kind: 'reaction',
 51|       trigger: 'investigateSuccess',
 52|       label: '横置：把已调查地点上的灵脉移到本卡；集齐 4 个则弃卡并获得 4 资源',
 53|       criteria: ({ state, context }) => {
 54|         const location = (state.locations || []).find(item => item.id === context?.location)
 55|         return Boolean(location && hasLeyLine(location))
 56|       },
 57|       cost: { exhaust: true },
 58|       resolve: ({ state, inv, source, api }) => {
 59|         if (!source) return
 60|         const location = (state.locations || []).find(item => item.id === inv.location)
 61|           || (state.locations || []).find(item => hasLeyLine(item))
 62|         if (location && hasLeyLine(location)) {
 63|           api.removeLocationTrait(location, LEY_TRAIT, { source: SOURCE })
 64|           api.addUses(source, 1)
 65|           api.info(`通路档案：把「${api.locName(location.id)}」的灵脉移到本卡（${source.uses || 0}/4）。`)
 66|         }
 67|         if ((source.uses || 0) >= 4) {
 68|           const resources = source.uses || 4
 69|           api.discardAsset(inv.seat, source)
 70|           api.gainResources(inv.seat, resources)
 71|           api.setScenarioFlag('eoteConfirmedPath', true)
 72|           api.info(`通路档案：集齐 ${resources} 个灵脉，弃掉本卡并获得 ${resources} 资源；记录“你已经确认了前行道路”。`)
 73|         }
 74|       },
 75|     },
 76|   ],
 77|   modifiers: [],
 78| }
 79| 
--- test hits (11) ---
eote-player-m2-1.test.mjs:12: //   08033/08041/08042/08043/08044 「灵脉」标记（地点用 trait 记账、支援用 uses；敌人/调查员标记不持久化）
eote-player-m2-1.test.mjs:47: import card08033 from '../src/cards/entries/08033.js'
eote-player-m2-1.test.mjs:65: card08027, card08028, card08029, card08030, card08031, card08032, card08033, card08034, card08035,
eote-player-m2-1.test.mjs:538: // ── 08033 通路档案（等级 0，approximation）──────────────────────────────────
eote-player-m2-1.test.mjs:539: test('P6 08033 通路档案 额外费用在 4 地点放灵脉；调查带灵脉地点后移到本卡，满 4 弃卡得资源（approximation）', () => {
eote-player-m2-1.test.mjs:544: const prophecy = asset(state, '08033')
eote-player-m2-1.test.mjs:545: resolveAbility(state, '08033', { kind: 'entersPlay', source: { id: prophecy.id, code: '08033' } })
eote-player-m2-1.test.mjs:546: const marked = state.locations.filter(location => (location.traitGrants?.LeyLine || []).includes('08033'))

==========================================================================================
## 08034 Written in the Stars / 繁星密语  [event|seeker|xp:0|deckLimit:2|cost:1] traits:Insight
EN: Fast. Play only during your turn.
Discard the top card of your deck. If that card is a weakness, shuffle it back into your deck. Otherwise, for the remainder of your turn, while that card is in your discard pile, commit it to each eligible skill test you perform.
ZH: 快速。只可在你的回合期间打出。
弃掉你牌库顶的1张卡牌。如果该卡牌是一张弱点，将它重新洗回你的牌库。否则在你回合剩余时间内，该卡牌在你的弃牌堆时，将它投入到你执行的每个符合条件的技能检定中。
--- src/cards/entries/08034.js (56 lines) ---
  1| // 08034 繁星密语
  2| // 卡面：快速。只可在你的回合期间打出。
  3| //       弃掉你牌库顶的 1 张卡牌。如果该卡牌是一张弱点，将它重新洗回你的牌库。否则在你回合剩余
  4| //       时间内，该卡牌在你的弃牌堆时，将它投入到你执行的每个符合条件的技能检定中。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // approximation：引擎没有「弃牌堆中的牌可投入每个检定」的枚举（请求 m2-1-08034.json）。这里等价
 10| // 折算为：非弱点时给本回合的每次技能检定按其图标总数加值（相当于把该牌投入每个检定）；卡面要求在
 11| // 弃牌堆持续存在、每次投入只影响一次检定——加值效果不会产生逐次投入的卡牌移动/触发。
 12| import { ownTurn } from '../../engine/matcher.js'
 13| import { ALL_CARDS } from '../../cards/cards-data.js'
 14| 
 15| const iconTotal = code => Object.values(ALL_CARDS[code]?.icons || {})
 16|   .reduce((sum, value) => sum + (Number(value) || 0), 0)
 17| const isWeakness = code => ALL_CARDS[code]?.subtype === 'weakness'
 18|   || ALL_CARDS[code]?.subtype === 'basicweakness'
 19| 
 20| export default {
 21|   code: '08034',
 22|   playCondition: [ownTurn()],
 23|   abilities: [
 24|     {
 25|       kind: 'played',
 26|       fast: true,
 27|       label: '弃牌库顶 1 张：弱点洗回；否则本回合每个技能检定获得其图标',
 28|       resolve: ({ inv, api }) => {
 29|         if (!(inv.deck || []).length) {
 30|           api.info('繁星密语：牌库是空的。')
 31|           return
 32|         }
 33|         const code = inv.deck[inv.deck.length - 1]
 34|         api.discardTopOfDeck(inv.seat, 1)
 35|         if (isWeakness(code)) {
 36|           api.moveCard({ code, from: 'discard', to: 'deckTop' })
 37|           api.shuffleDeck(inv.seat)
 38|           api.info(`繁星密语：弃到弱点「${api.cardName(code)}」，将它洗回牌库。`)
 39|           return
 40|         }
 41|         const icons = iconTotal(code)
 42|         if (icons > 0) {
 43|           api.addEffect({
 44|             duration: 'endOfTurn',
 45|             sourceCode: '08034',
 46|             label: `繁星密语：本回合每次技能检定获得「${api.cardName(code)}」的 ${icons} 个图标`,
 47|             modifiers: [{ target: 'skill:*', amount: icons }],
 48|           })
 49|         }
 50|         api.info(`繁星密语：弃掉「${api.cardName(code)}」；本回合你执行的每个技能检定获得其图标（${icons}）。`)
 51|       },
 52|     },
 53|   ],
 54|   modifiers: [],
 55| }
 56| 
--- test hits (9) ---
eote-player-m2-1.test.mjs:13: //   08034 弃牌堆中的牌可投入每个检定（折算为本回合每次检定获得其图标）
eote-player-m2-1.test.mjs:48: import card08034 from '../src/cards/entries/08034.js'
eote-player-m2-1.test.mjs:65: card08027, card08028, card08029, card08030, card08031, card08032, card08033, card08034, card08035,
eote-player-m2-1.test.mjs:563: // ── 08034 繁星密语（approximation）──────────────────────────────────────────
eote-player-m2-1.test.mjs:564: test('P6 08034 繁星密语 弃牌库顶：弱点洗回，非弱点本回合每次检定获得其图标（approximation）', () => {
eote-player-m2-1.test.mjs:572: resolvePlayed(state, '08034')
eote-player-m2-1.test.mjs:573: const effect = state.effects.find(item => item.sourceCode === '08034')
eote-player-m2-1.test.mjs:582: resolvePlayed(fresh, '08034')

==========================================================================================
## 08035 Hiking Boots / 登山靴  [asset|seeker|xp:1|deckLimit:2|cost:2] traits:Item,Clothing,Footwear
EN: Limit 1 [[Footwear]] per investigator.
You get +1 [agility].
[reaction] After the last clue is discovered from your location, exhaust Hiking Boots: Move to a connecting location with at least 1 clue, or to a connecting unrevealed location.
ZH: 每位调查员仅限1张[[鞋子]]。
你得到+1[agility]。
[reaction]你所在地点的最后一个线索被发现后，横置登山靴：移动到一个至少有1个线索，或未揭示的连接地点。
--- src/cards/entries/08035.js (48 lines) ---
  1| // 08035 登山靴
  2| // 卡面：每位调查员仅限 1 张[[鞋子]]。
  3| //       你得到 +1[agility]。
  4| //       [reaction] 你所在地点的最后一个线索被发现后，横置登山靴：移动到一个至少有 1 个线索，
  5| //       或未揭示的连接地点。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // 口径：clueDiscovered 窗口上下文的 location / lastClue 是唯一读点；候选目的地 = 当前地点的
 11| // 连接地点里「至少有 1 个线索」或「未揭示」的地点；移动走 api.moveInvestigator（横置为费用）。
 12| import { ownSeat } from '../../engine/matcher.js'
 13| import { skillModifier } from './_shared.js'
 14| 
 15| export default {
 16|   code: '08035',
 17|   modifiers: [
 18|     skillModifier('agility', 1),
 19|   ],
 20|   abilities: [
 21|     {
 22|       kind: 'reaction',
 23|       trigger: 'clueDiscovered',
 24|       label: '横置：移动到一个有线索或未揭示的连接地点',
 25|       criteria: [ownSeat(), ({ inv, context }) => context?.location === inv.location && context?.lastClue === true],
 26|       cost: { exhaust: true },
 27|       resolve: ({ state, inv, api }) => {
 28|         const here = (state.locations || []).find(location => location.id === inv.location)
 29|         const candidates = (here?.connections || [])
 30|           .map(id => (state.locations || []).find(location => location.id === id))
 31|           .filter(location => location && (location.clues > 0 || location.revealed !== true))
 32|         if (!candidates.length) {
 33|           api.info('登山靴：没有符合条件的连接地点。')
 34|           return
 35|         }
 36|         const answer = candidates.length === 1 ? candidates[0].id : api.choice({
 37|           kind: 'location', source: '08035', seat: inv.seat,
 38|           prompt: '登山靴：选择要移动到的连接地点。',
 39|           options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
 40|         })
 41|         const target = candidates.find(location => location.id === answer) || candidates[0]
 42|         api.moveInvestigator(inv.seat, target.id)
 43|         api.info(`登山靴：移动到「${api.locName(target.id)}」。`)
 44|       },
 45|     },
 46|   ],
 47| }
 48| 
--- test hits (8) ---
eote-player-m2-1.test.mjs:49: import card08035 from '../src/cards/entries/08035.js'
eote-player-m2-1.test.mjs:65: card08027, card08028, card08029, card08030, card08031, card08032, card08033, card08034, card08035,
eote-player-m2-1.test.mjs:300: // ── 08035 登山靴 ────────────────────────────────────────────────────────────
eote-player-m2-1.test.mjs:301: test('P6 08035 登山靴 +1[agility]；最后一个线索被发现后横置移动到有线索/未揭示的连接地点', () => {
eote-player-m2-1.test.mjs:304: const boots = asset(state, '08035')
eote-player-m2-1.test.mjs:313: const descriptor = pending.options.find(option => String(option.id).startsWith('desc:08035'))
eote-primitives-travel.test.mjs:48: assets: [{ id: 'asset-1', code: '08035' }, { id: 'asset-2', code: '08036' }],
eote-primitives-travel.test.mjs:192: assert.deepEqual(records, [{ assetId: 'asset-1', code: '08035', location: 'peak-0', seat: 0 }])

==========================================================================================
## 08036 Join the Caravan / 加入马队  [event|seeker|xp:1|deckLimit:2|cost:5] traits:Insight,Synergy
EN: Fast. Play only during your turn. Reduce the cost of this card by 1 for each different class among cards you control.
Move to any revealed location.
ZH: 快速。只可在你的回合期间打出。你每控制一张不同职阶的卡牌，本卡牌的费用减1。
移动到任意一个已揭示的地点。
--- src/cards/entries/08036.js (55 lines) ---
  1| // 08036 加入马队
  2| // 卡面：快速。只可在你的回合期间打出。你每控制一张不同职阶的卡牌，本卡牌的费用减 1。
  3| //       移动到任意一个已揭示的地点。
  4| //
  5| // 一张卡一个文件：这张卡的行为只在这里维护。
  6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  7| //
  8| // 口径：
  9| //   · 减费：条目级 playCostModifier（turn-flow 的 playCost 对「本卡自己」读取），按你控制的卡牌里
 10| //     不同职阶（faction）数量减费（下限 0 由 playCost 统一 Math.max）；
 11| //   · 只能自己回合打出：playCondition [ownTurn()]；
 12| //   · 移动：api.moveInvestigator 到任意已揭示地点。
 13| import { ownTurn } from '../../engine/matcher.js'
 14| import { ALL_CARDS } from '../../cards/cards-data.js'
 15| 
 16| const distinctClasses = (state, inv) => {
 17|   const factions = new Set()
 18|   for (const card of inv?.assets || []) {
 19|     const def = ALL_CARDS[card.code] || null
 20|     const list = def?.factions || [def?.klass, def?.klass2, def?.klass3].filter(Boolean)
 21|     for (const faction of list || []) if (faction !== 'neutral') factions.add(faction)
 22|   }
 23|   return factions.size
 24| }
 25| 
 26| export default {
 27|   code: '08036',
 28|   playCostModifier: ({ state, inv }) => -distinctClasses(state, inv),
 29|   playCondition: [ownTurn()],
 30|   abilities: [
 31|     {
 32|       kind: 'played',
 33|       fast: true,
 34|       label: '移动到任意一个已揭示的地点（每控制一张不同职阶的卡牌费用 -1）',
 35|       resolve: ({ state, inv, api }) => {
 36|         const candidates = (state.locations || []).filter(location => location.revealed === true
 37|           && location.id !== inv.location)
 38|         if (!candidates.length) {
 39|           api.info('加入马队：没有其他已揭示的地点。')
 40|           return
 41|         }
 42|         const answer = candidates.length === 1 ? candidates[0].id : api.choice({
 43|           kind: 'location', source: '08036', seat: inv.seat,
 44|           prompt: '加入马队：选择要移动到的已揭示地点。',
 45|           options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
 46|         })
 47|         const target = candidates.find(location => location.id === answer) || candidates[0]
 48|         api.moveInvestigator(inv.seat, target.id)
 49|         api.info(`加入马队：移动到「${api.locName(target.id)}」。`)
 50|       },
 51|     },
 52|   ],
 53|   modifiers: [],
 54| }
 55| 
--- test hits (9) ---
eote-player-m2-1.test.mjs:50: import card08036 from '../src/cards/entries/08036.js'
eote-player-m2-1.test.mjs:66: card08036, card08037, card08038, card08039, card08040, card08041, card08042, card08043, card08044,
eote-player-m2-1.test.mjs:321: // ── 08036 加入马队 ──────────────────────────────────────────────────────────
eote-player-m2-1.test.mjs:322: test('P6 08036 加入马队 每控制一张不同职阶的卡牌费用 -1；快速移动到任意已揭示地点', () => {
eote-player-m2-1.test.mjs:326: const def = ALL_CARDS['08036']
eote-player-m2-1.test.mjs:327: assert.equal(registeredEntry('08036').playCostModifier({ state, inv: me(state), card: def }), -3, '三种不同职阶 → 费用 -3')
eote-player-m2-1.test.mjs:329: assert.equal(registeredEntry('08036').playCondition.length, 1, '只可在自己回合打出（playCondition）')
eote-player-m2-1.test.mjs:331: resolvePlayed(state, '08036', {

==========================================================================================
## 08037 Survey the Area / 地区勘测  [skill|seeker|xp:1|deckLimit:2] traits:Practiced,Expert
EN: While Survey the Area is in your hand or committed to a skill test, it gains [intellect] icons equal to your [agility], and [agility] icons equal to your [intellect].
ZH: 地区探测在你手中或投入到技能检定中时，其获得等于你[agility]的[intellect]图标，以及等于你[intellect]的[agility]图标。
--- src/cards/entries/08037.js (32 lines) ---
  1| // 08037 地区勘测
  2| // 卡面：地区探测在你手中或投入到技能检定中时，其获得等于你[agility]的[intellect]图标，
  3| //       以及等于你[intellect]的[agility]图标。
  4| //
  5| // 一张卡一个文件：这张卡的行为只在这里维护。
  6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  7| //
  8| // approximation：同 08024 —— commit iconBonus 拿不到 getStat（原语请求 m2-1-08024.json），
  9| // 用调查员印刷基值计算两向图标；有属性修正时图标不会随之变化。
 10| import { ALL_CARDS } from '../../cards/cards-data.js'
 11| 
 12| const baseStat = (inv, skill) => Number(ALL_CARDS[inv?.code]?.[skill]) || 0
 13| 
 14| export default {
 15|   code: '08037',
 16|   abilities: [
 17|     {
 18|       kind: 'commit',
 19|       label: '手中/投入时：获得等于[agility]的[intellect]图标、等于[intellect]的[agility]图标',
 20|       skill: {
 21|         // 引擎在真实检定管线里传入 skillList 数组，这里同时兼容字符串。
 22|         iconBonus: ({ inv, skill }) => {
 23|           const skills = Array.isArray(skill) ? skill : [skill]
 24|           return skills.includes('intellect') ? baseStat(inv, 'agility')
 25|             : skills.includes('agility') ? baseStat(inv, 'intellect') : 0
 26|         },
 27|       },
 28|     },
 29|   ],
 30|   modifiers: [],
 31| }
 32| 
--- test hits (7) ---
eote-player-m2-1.test.mjs:7: //   08024/08037 动态 commit 图标（iconBonus 无 getStat，按印刷基值）
eote-player-m2-1.test.mjs:51: import card08037 from '../src/cards/entries/08037.js'
eote-player-m2-1.test.mjs:66: card08036, card08037, card08038, card08039, card08040, card08041, card08042, card08043, card08044,
eote-player-m2-1.test.mjs:587: // ── 08037 地区勘测（approximation）──────────────────────────────────────────
eote-player-m2-1.test.mjs:588: test('P6 08037 地区勘测 手中/投入时获得等于敏捷的智力图标、等于智力的敏捷图标（approximation）', () => {
eote-player-m2-1.test.mjs:591: assert.equal(commitIcons(state, me(state), '08037', 'intellect'), base.agility, '智力检定：等于敏捷的智力图标')
eote-player-m2-1.test.mjs:592: assert.equal(commitIcons(state, me(state), '08037', 'agility'), base.intellect, '敏捷检定：等于智力的敏捷图标')

==========================================================================================
## 08038 Medical Texts / 医学教科书  [asset|seeker|xp:2|deckLimit:2|cost:2] traits:Item,Tome
EN: [action]: Choose an investigator at your location and test [intellect] (2). If you succeed, heal 1 damage from that investigator (2 damage instead if you succeed by 2 or more). If you fail, you must either exhaust Medical Texts or deal 1 damage to that investigator.
ZH: [action]：选择你所在地点的一位调查员并检定[intellect](2)。如果你成功，治愈该调查员1点伤害(如果你成功并超过难度至少2点，改为治愈2点伤害)。如果你失败，你必须横置医学教科书或对该调查员造成1点伤害。
--- src/cards/entries/08038.js (56 lines) ---
  1| // 08038 医学教科书
  2| // 卡面：[action]：选择你所在地点的一位调查员并检定[intellect](2)。如果你成功，治愈该调查员
  3| //       1 点伤害（如果你成功并超过难度至少 2 点，改为治愈 2 点伤害）。如果你失败，你必须横置
  4| //       医学教科书或对该调查员造成 1 点伤害。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // 口径：选择同地点调查员用 api.investigatorsAt(inv.location)；检定用 api.startTest（intellect 2），
 10| // 成功差值 >=2 时治愈 2；失败时必须二选一（横置本卡 / 对该调查员 1 点伤害）。
 11| export default {
 12|   code: '08038',
 13|   abilities: [
 14|     {
 15|       kind: 'action',
 16|       label: '选择同地点一位调查员：检定[智力](2)，成功治愈 1（超过 2 点则 2）；失败横置或对其造成 1 伤害',
 17|       cost: { action: true },
 18|       resolve: ({ inv, source, api }) => {
 19|         const candidates = api.investigatorsAt(inv.location)
 20|         if (!candidates.length) {
 21|           api.info('医学教科书：这里没有调查员。')
 22|           return
 23|         }
 24|         const answer = candidates.length === 1 ? String(candidates[0].seat) : api.choice({
 25|           kind: 'investigator', source: source.id, seat: inv.seat,
 26|           prompt: '医学教科书：选择你所在地点的一位调查员。',
 27|           options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
 28|         })
 29|         const targetSeat = Number(answer)
 30|         api.startTest({
 31|           seat: inv.seat, skill: 'intellect', difficulty: 2, source: { label: '医学教科书', code: '08038' },
 32|           resolve: result => {
 33|             if (result?.success) {
 34|               const amount = (result.value - result.difficulty) >= 2 ? 2 : 1
 35|               api.healDamage(targetSeat, amount)
 36|               api.info(`医学教科书：治愈 ${api.investigatorsAt(inv.location).find(other => other.seat === targetSeat)?.name || '调查员'} ${amount} 点伤害。`)
 37|               return
 38|             }
 39|             const answerFail = api.choice({
 40|               kind: 'effect', source: source.id, seat: inv.seat,
 41|               prompt: '医学教科书：检定失败 —— 横置医学教科书，或对该调查员造成 1 点伤害。',
 42|               options: [
 43|                 { id: 'exhaust', label: '横置医学教科书' },
 44|                 { id: 'damage', label: `对「${api.investigatorsAt(inv.location).find(other => other.seat === targetSeat)?.name || '调查员'}」造成 1 点伤害` },
 45|               ],
 46|             })
 47|             if (answerFail === 'damage') api.damage(targetSeat, 1)
 48|             else api.exhaust(source)
 49|           },
 50|         })
 51|       },
 52|     },
 53|   ],
 54|   modifiers: [],
 55| }
 56| 
--- test hits (5) ---
eote-player-m2-1.test.mjs:52: import card08038 from '../src/cards/entries/08038.js'
eote-player-m2-1.test.mjs:66: card08036, card08037, card08038, card08039, card08040, card08041, card08042, card08043, card08044,
eote-player-m2-1.test.mjs:337: // ── 08038 医学教科书 ────────────────────────────────────────────────────────
eote-player-m2-1.test.mjs:338: test('P6 08038 医学教科书 行动：智力(2)成功治愈 1（超 2 点则 2）；失败必须横置或造成 1 伤害', () => {
eote-player-m2-1.test.mjs:341: const textbook = asset(state, '08038')
