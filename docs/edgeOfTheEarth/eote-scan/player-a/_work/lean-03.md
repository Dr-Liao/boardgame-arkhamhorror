
========================================================================================
## 08039 Unearth the Ancients / 发掘古物 [event|seeker|xp:2|deckLimit:2|cost:0] traits:Insight
EN: Investigate. Choose up to 2 [seeker] assets in your hand. The difficulty of this skill test is equal to the combined cost of the chosen assets. If you succeed, put the chosen assets into play, one at a time. For each [[Relic]] asset put into play by this ability, draw 1 card.
ZH: (与条目注释重复，已省略)
--- entries/08039.js ---
  1| // 08039 发掘古物
  2| // 卡面：调查。选择你手中最多 2 张[seeker]支援。本次技能检定难度等于所选支援费用之和。
  3| //       如果你成功，将所选支援依次放置入场。通过本能力每放置入场一张[[遗物]]支援，抽取 1 张卡牌。
  4| //
  5| // 一张卡一个文件：这张卡的行为只在这里维护。
  6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  7| //
  8| // 口径：从手牌里挑最多 2 张「seeker 阵营的支援」，难度 = 费用合计，用 api.startTest 发起智力检定；
  9| // 成功后按选择顺序 api.putIntoPlay 依次入场，每张有 [[relic]] 特性的支援各抽 1 张。
 10| const isSeekerAsset = (api, code) => api.cardType(code) === 'asset'
 11|   && (api.cardFactions(code) || []).includes('seeker')
 12| const isRelic = (api, code) => api.cardTraits(code).includes('relic')
 13| 
 14| export default {
 15|   code: '08039',
 16|   abilities: [
 17|     {
 18|       kind: 'played',
 19|       label: '调查：选择至多 2 张[seeker]支援，难度=费用和；成功依次入场，每张遗物支援抽 1 张',
 20|       resolve: ({ inv, api }) => {
 21|         const candidates = [...new Set((inv.hand || []).filter(code => isSeekerAsset(api, code)))]
 22|         const chosen = []
 23|         while (chosen.length < 2 && candidates.length) {
 24|           const answer = api.choice({
 25|             kind: 'card', source: '08039', seat: inv.seat, canSkip: true,
 26|             prompt: `发掘古物：选择要放置入场的[seeker]支援（已选 ${chosen.length}/2）。`,
 27|             options: [
 28|               { id: 'done', label: chosen.length ? '开始检定' : '取消' },
 29|               ...candidates.map((code, index) => ({ id: String(index), cardCode: code, label: `${api.cardName(code)}（费用 ${api.cardCost?.(code) ?? 0}）` })),
 30|             ],
 31|           })
 32|           if (answer === 'done' || answer == null) break
 33|           const picked = candidates.splice(Number(answer), 1)[0]
 34|           if (!picked) break
 35|           chosen.push(picked)
 36|         }
 37|         if (!chosen.length) {
 38|           api.info('发掘古物：没有选择任何支援。')
 39|           return
 40|         }
 41|         const difficulty = chosen.reduce((sum, code) => sum + (Number(api.cardCost?.(code)) || 0), 0)
 42|         api.startTest({
 43|           seat: inv.seat, skill: 'intellect', difficulty, source: { label: '发掘古物', code: '08039' },
 44|           resolve: result => {
 45|             if (!result?.success) { api.info('发掘古物：检定失败，所选支援留在手中。'); return }
 46|             let drawn = 0
 47|             for (const code of chosen) {
 48|               if (!inv.hand.includes(code)) continue
 49|               if (api.putIntoPlay(inv.seat, code)) {
 50|                 if (isRelic(api, code)) drawn += 1
 51|               }
 52|             }
 53|             if (drawn) api.drawCards(inv.seat, drawn)
 54|             api.info(`发掘古物：将 ${chosen.length} 张支援依次放置入场${drawn ? `，其中遗物支援抽 ${drawn} 张` : ''}。`)
 55|           },
 56|         })
 57|       },
 58|     },
 59|   ],
 60|   modifiers: [],
 61| }
 62| 

========================================================================================
## 08040 Scientific Theory / 科学理论 [asset|seeker|xp:3|deckLimit:2|cost:0] traits:Talent,Composure
EN: Fast. Limit 1 [[Composure]] in play.
You get +1 [intellect] and +1 [combat].
Non-direct damage/horror must be assigned to Scientific Theory before it can be assigned to your investigator card.
[fast] Spend 1 resource: You get +1 [intellect] or +1 [combat] for this skill test.
ZH: (与条目注释重复，已省略)
--- entries/08040.js ---
  1| // 08040 科学理论
  2| // 卡面：快速。[[沉稳]]卡牌场上仅限1张。
  3| //       你得到 +1[intellect] 和 +1[combat]。
  4| //       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给科学理论。
  5| //       [free] 花费 1 资源：你本次技能检定得到 +1[intellect] 或 +1[combat]。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // 口径：与 03109 科学理论同构的「沉稳」天赋数据写法：fast / composure / freeTriggers + modifiers。
 11| import { skillModifier } from './_shared.js'
 12| 
 13| export default {
 14|   code: '08040',
 15|   fast: true,
 16|   composure: true,
 17|   freeTriggers: [
 18|     { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
 19|     { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
 20|   ],
 21|   modifiers: [
 22|     skillModifier('intellect', 1),
 23|     skillModifier('combat', 1),
 24|   ],
 25|   abilities: [],
 26| }
 27| 

========================================================================================
## 08041 Archive of Conduits / 通路档案 [asset|seeker|xp:4|deckLimit:1|cost:4] traits:Ritual
EN: Researched. Uses (4 leylines). Limit 1 per deck.
[fast]: Move 1 leyline from this asset to a non-[[Elite]] enemy.
[action]: Choose an investigator, and an enemy with a leyline at a revealed location. That investigator moves to that location. You may remove the leyline to deal 1 damage to that enemy.
ZH: (与条目注释重复，已省略)
--- entries/08041.js ---
  1| // 08041 通路档案
  2| // 卡面：研究完成。使用(4 灵脉)。每套牌库仅限 1 张。
  3| //       [free]：从本支援上移动 1 灵脉到一个非[[精英]]敌人。
  4| //       [action]：选择一位调查员和一个在已揭示地点且带有灵脉的敌人。该调查员移动到该地点。
  5| //       你可以移除该灵脉来对该敌人造成 1 点伤害。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // approximation：没有通用「灵脉」标记原语（请求 m2-1-08033.json）。用支援上的 uses 记灵脉数
 11| // （api.setAssetUses）；移动到敌人身上只扣 uses、不持久化敌人标记，因此行动选择「带有灵脉的敌人」
 12| // 退化为任意已揭示地点的敌人；移除灵脉的伤害/额外效果按 uses 扣除表达。
 13| export default {
 14|   code: '08041',
 15|   abilities: [
 16|     {
 17|       kind: 'entersPlay',
 18|       label: '入场：获得 4 个灵脉（使用次数）',
 19|       resolve: ({ source, api }) => {
 20|         if (source) api.setAssetUses(source, 4)
 21|       },
 22|     },
 23|     {
 24|       kind: 'free',
 25|       label: '从本支援移动 1 灵脉到一个非精英敌人',
 26|       cost: { action: false },
 27|       resolve: ({ state, inv, source, api }) => {
 28|         if (!source || (source.uses || 0) <= 0) return api.info('通路档案：本支援上没有灵脉。')
 29|         const candidates = (state.enemies || []).filter(enemy => !enemy.elite)
 30|         if (!candidates.length) return api.info('通路档案：没有非精英敌人。')
 31|         const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
 32|           kind: 'target', source: '08041', seat: inv.seat,
 33|           prompt: '通路档案：选择要放置灵脉的非精英敌人。',
 34|           options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
 35|         })
 36|         const enemy = candidates.find(item => item.id === chosen) || candidates[0]
 37|         api.setAssetUses(source, (source.uses || 0) - 1)
 38|         api.info(`通路档案：把 1 灵脉移到「${enemy.name}」上（近似：仅扣减灵脉数）。`)
 39|       },
 40|     },
 41|     {
 42|       kind: 'action',
 43|       label: '选择调查员与已揭示地点的敌人：移动该调查员；可移除灵脉造成 1 点伤害',
 44|       cost: { action: true },
 45|       resolve: ({ state, inv, source, api }) => {
 46|         const investigators = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
 47|         const enemies = (state.enemies || []).filter(enemy => {
 48|           const location = (state.locations || []).find(item => item.id === enemy.location)
 49|           return location?.revealed === true
 50|         })
 51|         if (!investigators.length || !enemies.length) return api.info('通路档案：没有合法的调查员/敌人。')
 52|         const chosenInvestigator = investigators.length === 1 ? String(investigators[0].seat) : api.choice({
 53|           kind: 'investigator', source: '08041', seat: inv.seat,
 54|           prompt: '通路档案：选择要移动的调查员。',
 55|           options: investigators.map(person => ({ id: String(person.seat), label: person.name })),
 56|         })
 57|         const person = investigators.find(item => String(item.seat) === String(chosenInvestigator)) || investigators[0]
 58|         const chosenEnemy = enemies.length === 1 ? enemies[0].id : api.choice({
 59|           kind: 'target', source: '08041', seat: inv.seat,
 60|           prompt: '通路档案：选择已揭示地点上的敌人。',
 61|           options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
 62|         })
 63|         const enemy = enemies.find(item => item.id === chosenEnemy) || enemies[0]
 64|         api.moveInvestigator(person.seat, enemy.location)
 65|         api.info(`通路档案：将 ${person.name} 移动到「${api.locName(enemy.location)}」。`)
 66|         if ((source.uses || 0) > 0) {
 67|           const remove = api.choice({
 68|             kind: 'effect', source: '08041', seat: inv.seat, canSkip: true,
 69|             prompt: '通路档案：是否移除 1 灵脉，对该敌人造成 1 点伤害？',
 70|             options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉造成 1 点伤害' }],
 71|           })
 72|           if (remove === 'remove') {
 73|             api.setAssetUses(source, (source.uses || 0) - 1)
 74|             const current = (api.enemiesAt(enemy.location) || []).find(item => item.id === enemy.id)
 75|             if (current) api.damageEnemy(current, 1, inv.seat)
 76|           }
 77|         }
 78|       },
 79|     },
 80|   ],
 81|   modifiers: [],
 82| }
 83| 

========================================================================================
## 08042 Archive of Conduits / 通路档案 [asset|seeker|xp:4|deckLimit:1|cost:4] traits:Ritual
EN: Researched. Uses (4 leylines). Limit 1 per deck.
[fast]: Move 1 leyline from this asset to a revealed location.
[action]: Choose an investigator and a revealed location with a leyline. That investigator moves to that location. You may remove the leyline to have them take an investigate action.
ZH: (与条目注释重复，已省略)
--- entries/08042.js ---
  1| // 08042 通路档案
  2| // 卡面：研究完成。使用(4 灵脉)。每套牌库仅限 1 张。
  3| //       [free]：从本支援上移动 1 灵脉到一个已揭示地点。
  4| //       [action]：选择一位调查员和一个带有灵脉的已揭示地点。该调查员移动到该地点。
  5| //       你可以移除该灵脉来让该调查员执行一次调查行动。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // approximation：同 08041——地点上的灵脉用地点特性原语记录（不持久化到敌人/调查员）；此处移动灵脉
 11| // 退化为扣减 uses 并给地点加 [[LeyLine]] 授予；动作的「带灵脉的已揭示地点」按该特性过滤。
 12| const LEY_TRAIT = 'LeyLine'
 13| const SOURCE = '08042'
 14| 
 15| export default {
 16|   code: '08042',
 17|   abilities: [
 18|     {
 19|       kind: 'entersPlay',
 20|       label: '入场：获得 4 个灵脉（使用次数）',
 21|       resolve: ({ source, api }) => {
 22|         if (source) api.setAssetUses(source, 4)
 23|       },
 24|     },
 25|     {
 26|       kind: 'free',
 27|       label: '从本支援移动 1 灵脉到一个已揭示地点',
 28|       cost: { action: false },
 29|       resolve: ({ state, inv, source, api }) => {
 30|         if (!source || (source.uses || 0) <= 0) return api.info('通路档案：本支援上没有灵脉。')
 31|         const candidates = (state.locations || []).filter(location => location.revealed === true)
 32|         if (!candidates.length) return api.info('通路档案：没有已揭示地点。')
 33|         const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
 34|           kind: 'location', source: SOURCE, seat: inv.seat,
 35|           prompt: '通路档案：选择要放置灵脉的已揭示地点。',
 36|           options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
 37|         })
 38|         const target = candidates.find(location => location.id === chosen) || candidates[0]
 39|         api.setAssetUses(source, (source.uses || 0) - 1)
 40|         api.addLocationTrait(target, LEY_TRAIT, { source: SOURCE })
 41|         api.info(`通路档案：在「${api.locName(target.id)}」放置 1 灵脉。`)
 42|       },
 43|     },
 44|     {
 45|       kind: 'action',
 46|       label: '选择调查员与带灵脉的已揭示地点：移动该调查员；可移除灵脉令其调查一次',
 47|       cost: { action: true },
 48|       resolve: ({ state, inv, source, api }) => {
 49|         const investigators = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
 50|         const locations = (state.locations || []).filter(location => location.revealed === true)
 51|         if (!investigators.length || !locations.length) return api.info('通路档案：没有合法的调查员/地点。')
 52|         const chosenInvestigator = investigators.length === 1 ? String(investigators[0].seat) : api.choice({
 53|           kind: 'investigator', source: SOURCE, seat: inv.seat,
 54|           prompt: '通路档案：选择要移动的调查员。',
 55|           options: investigators.map(person => ({ id: String(person.seat), label: person.name })),
 56|         })
 57|         const person = investigators.find(item => String(item.seat) === String(chosenInvestigator)) || investigators[0]
 58|         const chosenLocation = locations.length === 1 ? locations[0].id : api.choice({
 59|           kind: 'location', source: SOURCE, seat: inv.seat,
 60|           prompt: '通路档案：选择带灵脉的已揭示地点。',
 61|           options: locations.map(location => ({ id: location.id, label: api.locName(location.id) })),
 62|         })
 63|         const location = locations.find(item => item.id === chosenLocation) || locations[0]
 64|         api.moveInvestigator(person.seat, location.id)
 65|         api.info(`通路档案：将 ${person.name} 移动到「${api.locName(location.id)}」。`)
 66|         const marked = (location.traitGrants?.[LEY_TRAIT] || []).includes(SOURCE)
 67|         if (marked) {
 68|           const remove = api.choice({
 69|             kind: 'effect', source: SOURCE, seat: inv.seat, canSkip: true,
 70|             prompt: '通路档案：是否移除灵脉，让该调查员执行一次调查行动？',
 71|             options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉并调查一次' }],
 72|           })
 73|           if (remove === 'remove') {
 74|             api.removeLocationTrait(location, LEY_TRAIT, { source: SOURCE })
 75|             api.investigate(person.seat, { locationId: location.id })
 76|           }
 77|         }
 78|       },
 79|     },
 80|   ],
 81|   modifiers: [],
 82| }
 83| 

========================================================================================
## 08043 Archive of Conduits / 通路档案 [asset|seeker|xp:4|deckLimit:1|cost:4] traits:Ritual
EN: Researched. Uses (4 leylines). Limit 1 per deck.
[fast]: Move 1 leyline from this asset to a non-[[Elite]] enemy.
[action]: Choose an investigator engaged with an enemy with a leyline. That investigator disengages from that enemy and moves to a connecting location. You may remove the leyline to automatically evade that enemy. This action does not provoke attacks of opportunity.
ZH: (与条目注释重复，已省略)
--- entries/08043.js ---
  1| // 08043 通路档案
  2| // 卡面：研究完成。使用(4 灵脉)。每套牌库仅限 1 张。
  3| //       [free]：从本支援上移动 1 灵脉到一个非[[精英]]敌人。
  4| //       [action]：选择一位与带有灵脉的敌人交战的调查员。该调查员与带有灵脉的一个敌人解除交战，
  5| //       并移动至一个连接地点。你可以移除该灵脉来自动躲避该敌人。本行动不会触发趁乱攻击。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // approximation：灵脉不落在敌人实例上（请求 m2-1-08033.json），敌人标记只扣 uses；「与带灵脉敌人
 11| // 交战」退化为任意交战敌人。解除交战用 api.autoEvadeEnemy（会同时横置敌人：卡面只解除交战），
 12| // 之后再移动到所选连接地点；noOpportunityAttack 由描述子声明。
 13| export default {
 14|   code: '08043',
 15|   abilities: [
 16|     {
 17|       kind: 'entersPlay',
 18|       label: '入场：获得 4 个灵脉（使用次数）',
 19|       resolve: ({ source, api }) => {
 20|         if (source) api.setAssetUses(source, 4)
 21|       },
 22|     },
 23|     {
 24|       kind: 'free',
 25|       label: '从本支援移动 1 灵脉到一个非精英敌人',
 26|       cost: { action: false },
 27|       resolve: ({ state, inv, source, api }) => {
 28|         if (!source || (source.uses || 0) <= 0) return api.info('通路档案：本支援上没有灵脉。')
 29|         const candidates = (state.enemies || []).filter(enemy => !enemy.elite)
 30|         if (!candidates.length) return api.info('通路档案：没有非精英敌人。')
 31|         const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
 32|           kind: 'target', source: '08043', seat: inv.seat,
 33|           prompt: '通路档案：选择要放置灵脉的非精英敌人。',
 34|           options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
 35|         })
 36|         const enemy = candidates.find(item => item.id === chosen) || candidates[0]
 37|         api.setAssetUses(source, (source.uses || 0) - 1)
 38|         api.info(`通路档案：把 1 灵脉移到「${enemy.name}」上（近似：仅扣减灵脉数）。`)
 39|       },
 40|     },
 41|     {
 42|       kind: 'action',
 43|       label: '选择与带灵脉敌人交战的调查员：解除交战并移动到连接地点；可移除灵脉自动躲避',
 44|       cost: { action: true },
 45|       noOpportunityAttack: true,
 46|       resolve: ({ state, inv, source, api }) => {
 47|         const investigators = (state.investigators || []).filter(person => !person.defeated && !person.resigned
 48|           && (person.engaged || []).length > 0)
 49|         if (!investigators.length) return api.info('通路档案：没有与敌人交战的调查员。')
 50|         const chosenInvestigator = investigators.length === 1 ? String(investigators[0].seat) : api.choice({
 51|           kind: 'investigator', source: '08043', seat: inv.seat,
 52|           prompt: '通路档案：选择与敌人交战的调查员。',
 53|           options: investigators.map(person => ({ id: String(person.seat), label: person.name })),
 54|         })
 55|         const person = investigators.find(item => String(item.seat) === String(chosenInvestigator)) || investigators[0]
 56|         const enemy = (state.enemies || []).find(item => (person.engaged || []).includes(item.id))
 57|         if (!enemy) return api.info('通路档案：该调查员没有交战的敌人。')
 58|         api.autoEvadeEnemy(enemy)
 59|         const here = (state.locations || []).find(location => location.id === person.location)
 60|         const destinations = (here?.connections || [])
 61|           .map(id => (state.locations || []).find(location => location.id === id))
 62|           .filter(Boolean)
 63|         if (!destinations.length) {
 64|           api.info('通路档案：没有连接地点。')
 65|         } else {
 66|           const chosenLocation = destinations.length === 1 ? destinations[0].id : api.choice({
 67|             kind: 'location', source: '08043', seat: inv.seat,
 68|             prompt: '通路档案：选择要移动到的连接地点。',
 69|             options: destinations.map(location => ({ id: location.id, label: api.locName(location.id) })),
 70|           })
 71|           const target = destinations.find(location => location.id === chosenLocation) || destinations[0]
 72|           api.moveInvestigator(person.seat, target.id)
 73|           api.info(`通路档案：${person.name} 解除与「${enemy.name}」的交战并移动到「${api.locName(target.id)}」。`)
 74|         }
 75|         if ((source.uses || 0) > 0) {
 76|           const remove = api.choice({
 77|             kind: 'effect', source: '08043', seat: inv.seat, canSkip: true,
 78|             prompt: '通路档案：是否移除 1 灵脉来自动躲避该敌人？',
 79|             options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉自动躲避' }],
 80|           })
 81|           if (remove === 'remove') {
 82|             api.setAssetUses(source, (source.uses || 0) - 1)
 83|             api.autoEvadeEnemy(enemy)
 84|           }
 85|         }
 86|       },
 87|     },
 88|   ],
 89|   modifiers: [],
 90| }
 91| 

========================================================================================
## 08044 Archive of Conduits / 通路档案 [asset|seeker|xp:4|deckLimit:1|cost:4] traits:Ritual
EN: Researched. Uses (4 leylines). Limit 1 per deck.
[fast]: Move 1 leyline from this asset to an investigator.
[action]: Choose an investigator with a leyline. That investigator draws 1 card and heals 1 damage or 1 horror. You may remove the leyline to have them instead draw 2 cards and heal 2 damage or 2 horror.
ZH: (与条目注释重复，已省略)
--- entries/08044.js ---
  1| // 08044 通路档案
  2| // 卡面：研究完成。使用(4 灵脉)。每套牌库仅限 1 张。
  3| //       [free]：从本支援上移动 1 灵脉到一位调查员上。
  4| //       [action]：选择一位带有灵脉的调查员。该调查员抽取 1 张卡牌并治愈 1 点伤害或恐惧。
  5| //       你可以移除该灵脉来使该调查员改为抽取 2 张卡牌并治愈 2 点伤害或恐惧。
  6| //
  7| // 一张卡一个文件：这张卡的行为只在这里维护。
  8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  9| //
 10| // approximation：灵脉不落在调查员实例上（请求 m2-1-08033.json）；移动灵脉只扣 uses，动作的
 11| // 「带有灵脉的调查员」退化为任意存活调查员（由玩家选择）；「治愈 1 点伤害或恐惧」按玩家选择分支。
 12| export default {
 13|   code: '08044',
 14|   abilities: [
 15|     {
 16|       kind: 'entersPlay',
 17|       label: '入场：获得 4 个灵脉（使用次数）',
 18|       resolve: ({ source, api }) => {
 19|         if (source) api.setAssetUses(source, 4)
 20|       },
 21|     },
 22|     {
 23|       kind: 'free',
 24|       label: '从本支援移动 1 灵脉到一位调查员',
 25|       cost: { action: false },
 26|       resolve: ({ state, inv, source, api }) => {
 27|         if (!source || (source.uses || 0) <= 0) return api.info('通路档案：本支援上没有灵脉。')
 28|         const candidates = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
 29|         if (!candidates.length) return api.info('通路档案：没有调查员。')
 30|         const chosen = candidates.length === 1 ? String(candidates[0].seat) : api.choice({
 31|           kind: 'investigator', source: '08044', seat: inv.seat,
 32|           prompt: '通路档案：选择要放置灵脉的调查员。',
 33|           options: candidates.map(person => ({ id: String(person.seat), label: person.name })),
 34|         })
 35|         const person = candidates.find(item => String(item.seat) === String(chosen)) || candidates[0]
 36|         api.setAssetUses(source, (source.uses || 0) - 1)
 37|         api.info(`通路档案：把 1 灵脉放到 ${person.name} 上（近似：仅扣减灵脉数）。`)
 38|       },
 39|     },
 40|     {
 41|       kind: 'action',
 42|       label: '选择一位调查员：抽 1 并治愈 1 点伤害/恐惧；可移除灵脉改为抽 2 治愈 2',
 43|       cost: { action: true },
 44|       resolve: ({ state, inv, source, api }) => {
 45|         const candidates = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
 46|         if (!candidates.length) return api.info('通路档案：没有调查员。')
 47|         const chosen = candidates.length === 1 ? String(candidates[0].seat) : api.choice({
 48|           kind: 'investigator', source: '08044', seat: inv.seat,
 49|           prompt: '通路档案：选择带有灵脉的调查员。',
 50|           options: candidates.map(person => ({ id: String(person.seat), label: person.name })),
 51|         })
 52|         const person = candidates.find(item => String(item.seat) === String(chosen)) || candidates[0]
 53|         let amount = 1
 54|         if ((source.uses || 0) > 0) {
 55|           const remove = api.choice({
 56|             kind: 'effect', source: '08044', seat: inv.seat, canSkip: true,
 57|             prompt: '通路档案：是否移除 1 灵脉，改为抽 2 张并治愈 2 点？',
 58|             options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉（抽 2 治愈 2）' }],
 59|           })
 60|           if (remove === 'remove') {
 61|             api.setAssetUses(source, (source.uses || 0) - 1)
 62|             amount = 2
 63|           }
 64|         }
 65|         api.drawCards(person.seat, amount)
 66|         const kind = api.choice({
 67|           kind: 'effect', source: '08044', seat: person.seat,
 68|           prompt: '通路档案：治愈伤害还是恐惧？',
 69|           options: [{ id: 'damage', label: '治愈伤害' }, { id: 'horror', label: '治愈恐惧' }],
 70|         })
 71|         if (kind === 'horror') api.healHorror(person.seat, amount)
 72|         else api.healDamage(person.seat, amount)
 73|         api.info(`通路档案：${person.name} 抽 ${amount} 张并治愈 ${amount} 点${kind === 'horror' ? '恐惧' : '伤害'}。`)
 74|       },
 75|     },
 76|   ],
 77|   modifiers: [],
 78| }
 79| 

========================================================================================
## 08045 Prophesiae Profana / 亵渎预言 [asset|seeker|xp:5|deckLimit:2|cost:4] traits:Item,Relic,Tome
EN: While you are not at the locus, you get +1 [intellect], +1 [agility], and you may ignore attacks of opportunity.
[reaction] After Prophesiae Profana enters play: Choose a revealed location. That location is "the locus" until Prophesiae Profana leaves play.
[action]: Move any investigator to the locus.
ZH: (与条目注释重复，已省略)
--- entries/08045.js ---
  1| // 08045 亵渎预言
  2| // 卡面：你不在坐标点时，你得到 +1[intellect] 和 +1[agility]，并且你可以忽略趁乱攻击。
  3| //       [reaction] 在亵渎预言入场后：选择一个已揭示地点。该地点是“坐标点”，直到亵渎预言离场。
  4| //       [action]：移动任意一位调查员至坐标点。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // 口径：「坐标点」不新建单卡状态字段，而是用已登记的地点特性原语 api.addLocationTrait 授予
 10| // [[Coordinate]] 特性（来源记 08045），离场时 api.removeLocationTrait 撤销。修正与忽略趁乱攻击的
 11| // condition 都读同一个地点特性来源。行动选择任意存活调查员（不限于同地点）移动到坐标点。
 12| //
 13| // approximation：没有通用的「地点标记」原语，这里借用地点特性记账；「坐标点」会以被授予的地点特性
 14| // 出现在地点特性投影里（投射为 Coordinate 特性而不是独立的坐标点标记）。卡面其余效果（+1/+1、
 15| // 忽略趁乱攻击、移动到坐标点、离场撤销）均按现有读点正确接线。
 16| const COORDINATE_TRAIT = 'Coordinate'
 17| const SOURCE = '08045'
 18| 
 19| const coordinateLocationId = state => {
 20|   const location = (state?.locations || []).find(item =>
 21|     (item.traitGrants?.[COORDINATE_TRAIT] || []).includes(SOURCE))
 22|   return location?.id || null
 23| }
 24| const awayFromCoordinate = ({ state, inv }) => {
 25|   const id = coordinateLocationId(state)
 26|   return Boolean(id) && inv?.location !== id
 27| }
 28| 
 29| export default {
 30|   code: '08045',
 31|   modifiers: [
 32|     { target: 'skill:intellect', amount: 1, condition: { when: awayFromCoordinate } },
 33|     { target: 'skill:agility', amount: 1, condition: { when: awayFromCoordinate } },
 34|     { target: 'ignore:opportunityAttack', amount: 1, condition: { when: awayFromCoordinate } },
 35|   ],
 36|   abilities: [
 37|     {
 38|       kind: 'entersPlay',
 39|       label: '入场：选择一个已揭示地点作为“坐标点”',
 40|       resolve: ({ state, inv, source, api }) => {
 41|         if (!source) return
 42|         const candidates = (state.locations || []).filter(location => location.revealed === true)
 43|         if (!candidates.length) {
 44|           api.info('亵渎预言：没有已揭示地点可选为坐标点。')
 45|           return
 46|         }
 47|         const answer = candidates.length === 1 ? candidates[0].id : api.choice({
 48|           kind: 'location', source: SOURCE, seat: inv.seat,
 49|           prompt: '亵渎预言：选择一个已揭示地点作为“坐标点”。',
 50|           options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
 51|         })
 52|         const target = candidates.find(location => location.id === answer) || candidates[0]
 53|         if (!api.addLocationTrait(target, COORDINATE_TRAIT, { source: SOURCE })) return
 54|         api.info(`亵渎预言：「${api.locName(target.id)}」成为坐标点，直到亵渎预言离场。`)
 55|       },
 56|     },
 57|     {
 58|       kind: 'leavesPlay',
 59|       label: '离场：撤销“坐标点”',
 60|       resolve: ({ state, api }) => {
 61|         for (const location of state.locations || []) {
 62|           if ((location.traitGrants?.[COORDINATE_TRAIT] || []).includes(SOURCE)) {
 63|             api.removeLocationTrait(location, COORDINATE_TRAIT, { source: SOURCE })
 64|           }
 65|         }
 66|       },
 67|     },
 68|     {
 69|       kind: 'action',
 70|       label: '移动任意一位调查员至坐标点',
 71|       cost: { action: true },
 72|       resolve: ({ state, inv, api }) => {
 73|         const coordinateId = coordinateLocationId(state)
 74|         if (!coordinateId) {
 75|           api.info('亵渎预言：还没有坐标点。')
 76|           return
 77|         }
 78|         const candidates = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
 79|         const answer = candidates.length === 1 ? String(candidates[0].seat) : api.choice({
 80|           kind: 'investigator', source: SOURCE, seat: inv.seat,
 81|           prompt: '亵渎预言：选择要移动到坐标点的调查员。',
 82|           options: candidates.map(person => ({ id: String(person.seat), label: person.name })),
 83|         })
 84|         const target = candidates.find(person => String(person.seat) === String(answer)) || candidates[0]
 85|         api.moveInvestigator(target.seat, coordinateId)
 86|         api.info(`亵渎预言：将 ${target.name} 移动到坐标点「${api.locName(coordinateId)}」。`)
 87|       },
 88|     },
 89|   ],
 90| }
 91| 

========================================================================================
## 08046 Underworld Support / 地下支持 [asset|rogue|xp:0|deckLimit:1] traits:Favor,Illicit
EN: Permanent. Limit 1 per deck. Purchase at deck creation.
Your deck cannot include more than 1 copy of each non-weakness, non-signature card (by title).
Reduce your deck size by 5.
ZH: (与条目注释重复，已省略)
--- entries/08046.js ---
  1| // 08046 地下支持
  2| // 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
  3| //       你的牌库中每张非弱点、非署名卡牌最多只能有一张(以卡牌名称区别)。
  4| //       你的牌库卡牌张数减 5。
  5| //
  6| // 一张卡一个文件：这张卡的行为只在这里维护。
  7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  8| //
  9| // approximation：牌库 −5 由 deckConstruction.sizeBonus 表达（构筑层已读）。「每张非弱点/非署名卡
 10| // 最多 1 张」是构筑层全局限制，现有 deckConstruction.options 只能按阵营/等级筛选，没有按卡名唯一的
 11| // 字段（请求 m2-1-08046.json）；本卡先按「无该限制」参与构筑，条款待 P7 战役/构筑层接线。
 12| export default {
 13|   code: '08046',
 14|   deckConstruction: {
 15|     sizeBonus: -5,
 16|   },
 17|   abilities: [],
 18|   modifiers: [],
 19| }
 20| 

========================================================================================
## 08047 Scout Ahead / 提前侦察 [event|rogue|xp:0|deckLimit:2|cost:1] traits:Insight,Trick
EN: Move. Move up to 3 times. Enemies do not engage you during this movement.
ZH: (与条目注释重复，已省略)
--- entries/08047.js ---
  1| // 08047 提前侦察
  2| // 卡面：移动。移动最多 3 次。该移动期间敌人不会与你交战。
  3| //
  4| // 一张卡一个文件：这张卡的行为只在这里维护。
  5| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  6| //
  7| // approximation：引擎没有「移动期间不触发交战」的临时标记（请求 m2-1-08047.json）。这里每次
  8| // api.moveInvestigator 之后立刻 api.disengageAll(inv.seat)，使本次移动结束时没有敌人与你交战；
  9| // 移动瞬间的「入场交战」窗口仍会打开（可能触发敌人交战反应），是主要差异。最多 3 次由循环上限表达。
 10| export default {
 11|   code: '08047',
 12|   abilities: [
 13|     {
 14|       kind: 'played',
 15|       countsAs: 'move',
 16|       label: '移动最多 3 次（近似：每次移动后立即解除交战）',
 17|       resolve: ({ state, inv, api }) => {
 18|         for (let moved = 0; moved < 3; moved++) {
 19|           const here = (state.locations || []).find(location => location.id === inv.location)
 20|           const destinations = (here?.connections || [])
 21|             .map(id => (state.locations || []).find(location => location.id === id))
 22|             .filter(Boolean)
 23|           if (!destinations.length) {
 24|             if (moved === 0) api.info('提前侦察：没有可移动的连接地点。')
 25|             return
 26|           }
 27|           const answer = api.choice({
 28|             kind: 'location', source: '08047', seat: inv.seat, canSkip: true,
 29|             prompt: `提前侦察：移动第 ${moved + 1}/3 次。`,
 30|             options: [
 31|               { id: 'stop', label: '停止移动' },
 32|               ...destinations.map(location => ({ id: location.id, label: api.locName(location.id) })),
 33|             ],
 34|           })
 35|           if (answer === 'stop' || answer == null) return
 36|           const target = destinations.find(location => location.id === answer)
 37|           if (!target) return
 38|           api.moveInvestigator(inv.seat, target.id)
 39|           // 该移动期间敌人不会与你交战（近似：移动后立即解除所有交战）。
 40|           api.disengageAll(inv.seat)
 41|           api.info(`提前侦察：移动到「${api.locName(target.id)}」，本次移动期间不与敌人交战。`)
 42|         }
 43|       },
 44|     },
 45|   ],
 46|   modifiers: [],
 47| }
 48| 

========================================================================================
## 08048 21 or Bust / 21点 [event|rogue|xp:0|deckLimit:2|cost:2] traits:Fortune,Gambit
EN: One at a time, reveal random tokens from the chaos bag until you choose to stop. Treat each [skull], [cultist], [tablet], or [elder_thing] as a 5; the [auto_fail] as a 10; and the [elder_sign] as either a 1 or an 11. If the combined value of those tokens (ignoring +/-) is...
- ...18 or less, gain 4 resources.
- ...19, gain 5 resources.
- ...20, gain 6 resources.
- ...21, gain 9 resources.
ZH: (与条目注释重复，已省略)
--- entries/08048.js ---
  1| // 08048 21点
  2| // 卡面：依次随机揭示任意个混乱标记，直到你自己选择停下。[skull]、[cultist]、[tablet] 或
  3| //       [elder_thing] 视作 5；[auto_fail] 视作 10；[elder_sign] 可视作 1 或 11。
  4| //       如果这些标记的总和(忽视 +/-)是……
  5| //       - ……18 或更少，获得 4 资源。
  6| //       - ……19，获得 5 资源。
  7| //       - ……20，获得 6 资源。
  8| //       - ……21，获得 9 资源。
  9| //
 10| // 一张卡一个文件：这张卡的行为只在这里维护。
 11| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
 12| //
 13| // 口径：逐枚 api.revealChaosTokens(1)；每枚后询问「继续 / 停下」。数值按绝对值相加
 14| // （「忽视 +/-」），符号标记按卡面固定值，[elder_sign] 每枚询问 1 或 11；总和 22+ 没有奖励。
 15| const SYMBOL_VALUES = Object.freeze({ skull: 5, cultist: 5, tablet: 5, elderthing: 5, autofail: 10 })
 16| const SYMBOL_LABELS = Object.freeze({ skull: '[skull]', cultist: '[cultist]', tablet: '[tablet]', elderthing: '[elder_thing]', autofail: '[auto_fail]', eldersign: '[elder_sign]' })
 17| 
 18| const tokenValue = (face, api, inv) => {
 19|   if (face === 'eldersign') {
 20|     const answer = api.choice({
 21|       kind: 'effect', source: '08048', seat: inv.seat,
 22|       prompt: '21点：[elder_sign] 视作 1 还是 11？',
 23|       options: [{ id: '1', label: '视作 1' }, { id: '11', label: '视作 11' }],
 24|     })
 25|     return answer === '11' ? 11 : 1
 26|   }
 27|   if (Object.hasOwn(SYMBOL_VALUES, face)) return SYMBOL_VALUES[face]
 28|   const numeric = Number(face)
 29|   return Number.isFinite(numeric) ? Math.abs(numeric) : 0
 30| }
 31| 
 32| export default {
 33|   code: '08048',
 34|   abilities: [
 35|     {
 36|       kind: 'played',
 37|       label: '依次揭示混乱标记直到停下，按总和获得资源（18 以下 4 / 19 5 / 20 6 / 21 9）',
 38|       resolve: ({ inv, api }) => {
 39|         const revealed = []
 40|         let total = 0
 41|         for (let guard = 0; guard < 100; guard++) {
 42|           const answer = api.choice({
 43|             kind: 'effect', source: '08048', seat: inv.seat,
 44|             prompt: `21点：当前已揭示 ${revealed.length} 枚（总和 ${total}）。继续揭示，还是停下？`,
 45|             options: [{ id: 'stop', label: '停下' }, { id: 'continue', label: '继续揭示' }],
 46|           })
 47|           if (answer !== 'continue') break
 48|           const face = api.revealChaosTokens(1)[0]
 49|           if (face == null) {
 50|             api.info('21点：混乱袋里没有标记了。')
 51|             break
 52|           }
 53|           const value = tokenValue(face, api, inv)
 54|           revealed.push(face)
 55|           total += value
 56|           api.info(`21点：揭示 ${SYMBOL_LABELS[face] || api.tokenLabel(face)}（视作 ${value}），当前总和 ${total}。`)
 57|         }
 58|         if (!revealed.length) {
 59|           api.info('21点：没有揭示任何混乱标记。')
 60|           return
 61|         }
 62|         const reward = total >= 22 ? 0
 63|           : total === 21 ? 9
 64|             : total === 20 ? 6
 65|               : total === 19 ? 5 : 4
 66|         if (!reward) {
 67|           api.info(`21点：总和 ${total} 没有奖励。`)
 68|           return
 69|         }
 70|         api.gainResources(inv.seat, reward)
 71|         api.info(`21点：总和 ${total}，获得 ${reward} 资源。`)
 72|       },
 73|     },
 74|   ],
 75|   modifiers: [],
 76| }
 77| 
