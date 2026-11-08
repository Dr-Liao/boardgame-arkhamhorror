# D 分片审阅摘要 5（08696–08707）

====================================================================================================
CODE 08696 | 08696 古老者守卫 / Guardian Elder Thing
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Elder Thing | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/elder_things/08696.js
--- EN TEXT ---
Hunter.
Forced - When you deal damage to Guardian Elder Thing: For each point of damage dealt, discard the top card of your deck. Draw each weakness discarded this way.

--- NUMS ---
{  "health": 4,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "elder_things" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08696 古老者守卫（Elder Thing Guardian）· 敌人 · elder_things
// 卡面：猎手。强制 - 在你对古老者守卫造成伤害时：每造成 1 点伤害，弃掉你牌库顶的 1 张卡牌。
//   抽取所有以此方式弃掉的弱点。
// 读点：forced + trigger 'enemyDamaged'；弃牌/弱点抽取与 08695 同一口径。
import { isWeaknessCode } from '../../../_shared.js'

export default {
  code: '08696', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDamaged',
    label: '古老者守卫受到伤害：每 1 点伤害弃掉牌库顶 1 张并抽取其中的弱点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number.isSafeInteger(context?.seat),
    resolve: ({ context, api }) => {
      const count = Math.max(0, Number(context.amount ?? context.damage) || 0)
      if (!count) return
      const discarded = api.discardTopOfDeck(context.seat, count) || []
      const weaknesses = discarded.filter(code => isWeaknessCode(code))
      for (const code of weaknesses) api.moveCard({ code, from: 'discard', to: 'deckTop', ownerSeat: context.seat })
      if (weaknesses.length) api.drawCards(context.seat, weaknesses.length)
      api.info('「古老者守卫」：弃掉牌库顶 ' + count + ' 张（其中 ' + weaknesses.length + ' 张弱点已抽取）。')
    },
  }],
}
====================================================================================================
CODE 08697 | 08697 古老者崛起 / Rise of the Elder Things
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/elder_things/08697.js
--- EN TEXT ---
Revelation - Find the topmost [[Elder Thing]] enemy in the encounter discard pile and spawn it engaged with you. Each [[Elder Thing]] enemy currently engaged with you gets +1 fight and +1 evade until the end of the round. If Rise of the Elder Things put no enemies into play, it gains surge.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "elder_things" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
MARKER:5: //   api.engageAtInvestigator；临时攻击/躲避修正需要引擎的「敌人临时属性修正」读点，见
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08697 古老者崛起（Rise of the Elder Things）· 诡计 · elder_things
// 卡面：显现 - 找出遭遇弃牌堆最顶部的一张[[古老者]]敌人，并将其生成，与你交战。当前与你交战的
//   每个[[古老者]]敌人得到 +1 攻击和 +1 躲避，直到一轮结束。如果古老者崛起没有放置敌人入场，其获得涌动。
// 读点：encounterResolve（entryRevelation 通道）；检索生成走 api.takeEncounterDiscard / api.spawn /
//   api.engageAtInvestigator；临时攻击/躲避修正需要引擎的「敌人临时属性修正」读点，见
//   artifacts/migration/eote/primitive-requests/p7-08697.json。
import { ALL_CARDS } from '../../../_shared.js'

const isElderThing = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'elder thing')

export default {
  code: '08697', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const pool = [...(state.encounterDiscard || [])]
    let code = null
    for (let index = pool.length - 1; index >= 0; index--) {
      if (isElderThing(pool[index])) { code = pool[index]; break }
    }
    if (!code) code = Object.keys(ALL_CARDS).find(candidate => ALL_CARDS[candidate].type === 'enemy'
      && (ALL_CARDS[candidate].encounterCode === 'elder_things') && isElderThing(candidate)) || null
    const taken = code ? api.takeEncounterDiscard(code) : null
    if (!taken) {
      api.info('「古老者崛起」：遭遇弃牌堆没有古老者敌人，获得涌动。')
      return { gainSurge: true }
    }
    const enemy = api.spawn(code, inv.location)
    if (!enemy) {
      api.info('「古老者崛起」：古老者敌人未能生成，获得涌动。')
      return { gainSurge: true }
    }
    api.engageAtInvestigator(enemy, inv.seat)
    api.info('👹 「古老者崛起」：' + (enemy.name || code) + ' 在「' + (state.locations.find(loc => loc.id === inv.location)?.name || inv.location) + '」生成并交战。')
    return true
  },
  note: '「当前与你交战的每个古老者敌人 +1 攻击/+1 躲避直到一轮结束」需要引擎的临时敌人属性修正读点（primitive-requests/p7-08697.json）；生成与交战已接线。',
}
====================================================================================================
CODE 08698 | 08698 冰缝 / Ice Shaft
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/hazards_of_antarctica/08698.js
--- EN TEXT ---
Revelation - Test [agility] (3). For each [frost] token revealed during this test, take 1 damage. If you fail, take 2 damage.

--- NUMS ---
{  "quantity": 3,  "encounterCode": "hazards_of_antarctica" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08698 冰缝（Crevasse）· 诡计 · hazards_of_antarctica
// 卡面：显现 - 检定[agility](3)。本次检定期间每揭示一个[frost]标记，受到 1 点伤害。
//   如果你检定失败，受到 2 点伤害。
// 读点：encounterResolve；result.drawn 是本次检定揭示的标记数组（与 07296 同一契约）。
export default {
  code: '08698', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 3, result => {
      const frosts = (result.drawn || []).filter(token => token === 'frost').length
      if (frosts > 0) api.damage(inv.seat, frosts)
      if (!result.success) api.damage(inv.seat, 2)
    })
    return false
  },
}
====================================================================================================
CODE 08699 | 08699 穿越冰雪 / Through the Ice
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/hazards_of_antarctica/08699.js
--- EN TEXT ---
Revelation - Attach to the nearest location without a copy of Through the Ice attached.
As an additional cost for you to enter or leave attached location (except by a scenario card effect), test [agility] (2). If you fail, cancel the effects of the move, take 1 damage and 1 horror, and discard Through the Ice.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "hazards_of_antarctica" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.moveEntryTest  <<UNREAD kind=undefined
  flags.agility  read@src/ai/ai-context.js,src/ai/ai-dialogue.js,src/cards/card-catalog.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08699 穿越冰雪（Crossing the Ice）· 诡计 · hazards_of_antarctica
// 卡面：显现 - 附属到最近且没有附属穿越冰雪的地点。作为进入或离开附属地点（除因冒险卡牌效果外）
//   的额外费用，检定[agility](2)。如果你检定失败，取消本次移动的效果，受到 1 点伤害和 1 点恐惧，
//   并弃掉穿越冰雪。
// 读点：显现附走 api.attachToLocation；移动进出检定需要「地点附属移动检定」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08699.json（不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08699'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, moveEntryTest: { skill: 'agility', difficulty: 2, cancelMove: true, damage: 1, horror: 1, discardOnFail: true } },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「穿越冰雪」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('❄️ 「穿越冰雪」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '「进入/离开附属地点的额外敏捷(2)检定」需要引擎的地点附属移动检定读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08699.json。',
}
====================================================================================================
CODE 08700 | 08700 迷失的研究员 / Lost Researcher
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Humanoid,Possessed | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/left_behind/08700.js
--- EN TEXT ---
Spawn - Any location (empty, if able).
Lost Researcher enters play with 1 doom on it.
Forced - When Lost Researcher is defeated: Move each doom on it to its location.
[action]: Parley. Test [willpower] or [intellect] (3). If you succeed, take control of 1 doom on Lost Researcher and flip it to its clue side. Then, if there is no doom on Lost Researcher, discard it.

--- NUMS ---
{  "health": 1,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "left_behind" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08700 迷失的研究员（Lost Researcher）· 敌人 · left_behind
// 卡面：生成 - 任意地点（如可能，则生成在无人地点）。入场时带有 1 个毁灭标记。
//   强制 - 被击败时：将其上的所有毁灭标记移动到其所在地点。
//   [action]：谈判。检定[willpower]或[intellect](3)。成功：控制其上的 1 个毁灭标记并将其翻至
//   线索面。然后，如果其上没有毁灭标记，将其弃掉。
// 读点：谈判行动走 abilities（actionKind:'parley'）；毁灭/线索走 api.scenario.doomOn / api.gainClues；
//   入场毁灭数据放 enemySpawnRule.doomOnSpawn（enemies.js#spawnEnemy 通用读点）。
const CODE = '08700'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '迷失的研究员被击败：将其毁灭标记移到所在地点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, source, context, api }) => {
      const doom = Math.max(0, Number(context.enemy?.doom) || 0)
      if (!doom) return
      const location = state.locations.find(loc => loc.id === context.enemy.location)
      if (location) api.scenario.doomOn(location, doom)
      api.info('「迷失的研究员」：' + doom + ' 个毁灭标记留在其所在地点。')
    },
  }, {
    kind: 'action', actionKind: 'parley', label: '谈判 意志/智力(3)：控制 1 个毁灭标记翻为线索；清空后弃掉本敌人',
    resolve: ({ state, inv, source, api }) => {
      if (!(Number(source.doom) > 0)) return
      const skill = api.choice({ kind: 'skill', source: CODE, seat: inv.seat, prompt: '选择谈判检定技能。',
        options: [{ id: 'willpower', label: '意志(3)' }, { id: 'intellect', label: '智力(3)' }] })
      if (!['willpower', 'intellect'].includes(skill)) return
      api.test(inv.seat, skill, 3, { source: { type: 'enemy', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.removeDoomFromCard(source, 1)
        api.gainClues(inv.seat, 1)
        api.info('🔍 「迷失的研究员」：1 个毁灭标记翻为线索。')
        if (!(Number(source.doom) > 0)) api.discardEnemy?.(source)
      } })
    },
  }],
}
====================================================================================================
CODE 08701 | 08701 狂乱的探险家 / Frenzied Explorer
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Humanoid,Possessed | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/left_behind/08701.js
--- EN TEXT ---
Frenzied Explorer enters play with 1 doom on it.
Forced - When Frenzied Explorer is defeated: Move each doom on it to its location.
[reaction] After you successfully evade Frenzied Explorer by 2 or more: Take control of 1 doom on Frenzied Explorer and flip it to its clue side. Then, if there is no doom on Frenzied Explorer, discard it.

--- NUMS ---
{  "health": 2,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "left_behind" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08701 狂乱的探险家（Frenzied Explorer）· 敌人 · left_behind
// 卡面：入场时带有 1 个毁灭标记。强制 - 被击败时：将其上的所有毁灭标记移动到其所在地点。
//   [reaction]在你成功躲避狂乱的探险家、且超过难度至少 2 点后：控制其上的 1 个毁灭标记并翻至线索面；
//   然后，如果其上没有毁灭标记，将其弃掉。
// 读点：入场毁灭放 enemySpawnRule.doomOnSpawn；被躲避后走 evadeSuccess 窗口（combat.js 开窗，context.successBy）。
const CODE = '08701'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '狂乱的探险家被击败：毁灭标记留在所在地点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, context, api }) => {
      const doom = Math.max(0, Number(context.enemy?.doom) || 0)
      if (!doom) return
      const location = state.locations.find(loc => loc.id === context.enemy.location)
      if (location) api.scenario.doomOn(location, doom)
      api.info('「狂乱的探险家」：' + doom + ' 个毁灭标记留在其所在地点。')
    },
  }, {
    kind: 'reaction', trigger: 'evadeSuccess',
    label: '成功躲避且超过难度至少 2 点：控制 1 个毁灭标记翻为线索，清空后弃掉本敌人',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number(context?.successBy) >= 2
      && Number(source.doom) > 0,
    resolve: ({ source, context, api }) => {
      api.removeDoomFromCard(source, 1)
      api.gainClues(context.seat, 1)
      api.info('🔍 「狂乱的探险家」：1 个毁灭标记翻为线索。')
      if (!(Number(source.doom) > 0)) api.discardEnemy?.(source)
    },
  }],
}
====================================================================================================
CODE 08702 | 08702 身陷疯狂 / Abandoned to Madness
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/left_behind/08702.js
--- EN TEXT ---
Revelation - Attach to the nearest [[Possessed]] enemy and place 1 doom on that enemy. If there are no [[Possessed]] enemies in play, search the encounter deck and discard pile for a [[Possessed]] enemy, draw it, and attach Abandoned to Madness to it (shuffle the encounter deck).
Increase the difficulty to fight, evade, or parley with attached enemy by 1.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "left_behind" }
--- FLAGS DECLARED ---
  flags.attachToPossessedEnemy  <<UNREAD kind=undefined
  flags.difficultyBonus  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08702 身陷疯狂（Lost in Madness）· 诡计 · left_behind
// 卡面：显现 - 附属到最近的[[附身]]敌人，并在该敌人上放置 1 个毁灭标记。如果场上没有[[附身]]敌人，
//   查找遭遇牌库及弃牌堆，找出并抽取一个[[附身]]敌人，并将身陷疯狂附属到该敌人（混洗遭遇牌库）。
//   与该敌人进行的攻击、躲避或谈判的难度增加 1。
// 读点：附属走 api.attachEncounterToEnemy；毁灭走 api.doomOn；难度 +1 需要引擎的「附属敌人难度修正」
//   读点（primitive-requests/p7-08702.json）。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '08702'
const isPossessed = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'possessed')

function possessedEnemies(state) {
  return (state.enemies || []).filter(enemy => isPossessed(enemy.originalCode || enemy.code) && !enemy.defeated)
}
function takePossessedFromPiles(state, api) {
  for (const pile of ['encounterDeck', 'encounterDiscard']) {
    const list = pile === 'encounterDeck' ? state.encounterDeck : state.encounterDiscard
    if (!Array.isArray(list)) continue
    for (let offset = 1; offset <= list.length; offset++) {
      const code = list[list.length - offset]
      if (!isPossessed(code)) continue
      const taken = pile === 'encounterDeck' ? api.takeEncounterDeckCard(code) : api.takeEncounterDiscard(code)
      if (taken) { api.shuffleEncounterDeck(); return code }
    }
  }
  return null
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { attachToPossessedEnemy: true, difficultyBonus: 1 },
  encounterResolve(state, inv, card, api) {
    const inPlay = possessedEnemies(state)
    let enemy = null
    if (inPlay.length) {
      const nearestDistance = Math.min(...inPlay.map(item => entryDistance(state, inv.location, item.location)))
      const nearest = inPlay.filter(item => entryDistance(state, inv.location, item.location) === nearestDistance)
      enemy = nearest.length === 1 ? nearest[0] : nearest.find(item => item.id === api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择最近的[[附身]]敌人，将「身陷疯狂」附属到它。',
        options: nearest.map(item => ({ id: item.id, label: item.name || item.id })),
      })) || nearest[0]
    } else {
      const code = takePossessedFromPiles(state, api)
      if (code) enemy = api.spawn(code, inv.location)
      if (!enemy) {
        api.info('「身陷疯狂」：遭遇牌库与弃牌堆里没有[[附身]]敌人。')
        return false
      }
    }
    api.attachEncounterToEnemy(CODE, enemy.id)
    api.doomOn(enemy, 1)
    api.info('😵 「身陷疯狂」附属到「' + (enemy.name || enemy.id) + '」并放置 1 个毁灭标记。')
    return true
  },
  note: '「与该敌人进行的攻击、躲避或谈判难度 +1」需要引擎的附属敌人难度修正读点（primitive-requests/p7-08702.json）。',
}
====================================================================================================
CODE 08703 | 08703 渎神幻象 / Blasphemous Visions
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/nameless_horrors/08703.js
--- EN TEXT ---
Revelation - Shuffle the top card of the Tekeli-li deck into your deck without looking at it. Then, put Blasphemous Visions into play in your threat area.
Resolve the effects of each Tekeli-li weakness you draw an additional time.
[action]: Test [willpower] (3). If you succeed, discard Blasphemous Visions.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "nameless_horrors" }
--- FLAGS DECLARED ---
  flags.threat  read@src/ai/ai-context.js,src/cards/campaign-plugin.js,src/cards/card-effects.js
  flags.tekeliliDoubleResolution  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08703 渎神幻象（Blasphemous Visions）· 诡计 · nameless_horrors
// 卡面：显现 - 将忒咳哩-哩牌库顶的 1 张卡牌洗入你的牌库，不要查看内容。然后将渎神幻象放置入场，
//   放到你的威胁区域。你抽取的每张忒咳哩-哩弱点的效果额外结算一次。
//   [action]：检定[willpower](3)。如果你检定成功，弃掉渎神幻象。
// 读点：威胁区放置 api.threat；「弱点效果额外结算一次」需要引擎的弱点重复结算读点
//   （primitive-requests/p7-08703.json）；[action] 走威胁区条目 abilities。
const CODE = '08703'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { threat: true, tekeliliDoubleResolution: true },
  encounterResolve(state, inv, card, api) {
    const size = Number(api.mechanics.tekeli.size())
    const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, 1) : false
    if (!Array.isArray(shuffled) || !shuffled.length) api.info('「渎神幻象」：没有忒咳哩-哩可洗入。')
    api.threat(inv.seat, CODE)
    api.info('🌀 「渎神幻象」进入 ' + (inv.name || '调查员') + ' 的威胁区域。')
    return true
  },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '意志(3)：成功弃掉渎神幻象',
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', 3, { source: { type: 'treachery', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.removeThreat(source)
        api.info('🌀 「渎神幻象」消散了。')
      } })
    },
  }],
  note: '「抽取的每张忒咳哩-哩弱点额外结算一次」需要引擎的弱点重复结算读点（primitive-requests/p7-08703.json）。',
}
====================================================================================================
CODE 08704 | 08704 窥看不可说之事 / Glimpse the Unspeakable
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/nameless_horrors/08704.js
--- EN TEXT ---
Peril.
Revelation - Draw the top card of the Tekeli-li deck (and resolve its effects). Shuffle it into any investigator's deck instead of placing it on the bottom of the Tekeli-li deck. If no Tekeli-li weakness is drawn by this effect, Glimpse the Unspeakable gains surge.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "nameless_horrors" }
--- FLAGS DECLARED ---
  flags.peril  read@src/cards/campaign-plugin.js,src/engine/api-misc.js,src/engine/encounter.js
  flags.drawTekeliliAndResolveThenShuffle  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08704 窥看不可说之事（Peering Into the Unspeakable）· 诡计 · nameless_horrors
// 卡面：险境。显现 - 抽取忒咳哩-哩牌库顶的 1 张卡牌（并结算其效果）。不要将其放到忒咳哩-哩牌库底，
//   改为混洗入任意一位调查员的牌库。如果没有以此效果抽取忒咳哩-哩弱点，窥看不可说之事获得涌动。
// 读点：tekeliDraw 取牌；去向 tekeliReturn(destination:'anyDeck')。单独结算一张忒咳哩-哩弱点需要
//   引擎的「按卡号结算弱点」读点（primitive-requests/p7-08704.json）；当前实现先完成抽牌与去向。
const CODE = '08704'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { peril: true, drawTekeliliAndResolveThenShuffle: true },
  encounterResolve(state, inv, card, api) {
    const code = api.mechanics.tekeli.draw()
    if (!code) {
      api.info('「窥看不可说之事」：忒咳哩-哩牌库为空，获得涌动。')
      return { gainSurge: true }
    }
    const candidates = state.investigators.filter(other => !other.defeated && !other.resigned)
    const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choice({ kind: 'target', source: CODE, seat: inv.seat,
      prompt: '选择把这张忒咳哩-哩弱点洗入哪位调查员的牌库。',
      options: candidates.map(other => ({ id: String(other.seat), label: other.name || '调查员 ' + (other.seat + 1) })) }))
    const target = candidates.find(other => other.seat === seat) || candidates[0]
    api.mechanics.tekeli.return(code, { destination: 'anyDeck', seat: target.seat })
    api.info('👁️ 「窥看不可说之事」：忒咳哩-哩弱点洗入 ' + (target.name || '调查员') + ' 的牌库。')
    return true
  },
  note: '「抽出后立即结算该弱点」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08704.json）；抽牌与去向已接线。',
}
====================================================================================================
CODE 08705 | 08705 噩梦烟气 / Nightmarish Vapors
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/nameless_horrors/08705.js
--- EN TEXT ---
Peril.
Revelation - You must either (choose one):
- Lose 2 actions.
- Shuffle the top 2 cards of the Tekeli-li deck into your deck without looking at them.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "nameless_horrors" }
--- FLAGS DECLARED ---
  flags.peril  read@src/cards/campaign-plugin.js,src/engine/api-misc.js,src/engine/encounter.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08705 噩梦烟气（Nightmare Smoke）· 诡计 · nameless_horrors
// 卡面：险境。显现 - 你必须选择一项：失去 2 个行动；或将忒咳哩-哩牌库顶的 2 张卡牌洗入你的牌库，
//   不要查看内容。
export default {
  code: '08705', scope: 'treachery', implemented: true,
  flags: { peril: true },
  encounterResolve(state, inv, card, api) {
    const pick = api.choice({ kind: 'effect', source: '08705', seat: inv.seat,
      prompt: '「噩梦烟气」：选择一项。',
      options: [{ id: 'actions', label: '失去 2 个行动' }, { id: 'tekeli', label: '将忒咳哩-哩牌库顶 2 张洗入你的牌库' }] })
    if (pick !== 'tekeli') {
      api.loseActions(inv.seat, 2)
      return false
    }
    const size = Number(api.mechanics.tekeli.size())
    const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, Math.min(2, size)) : false
    api.info('「噩梦烟气」：洗入 ' + (Array.isArray(shuffled) ? shuffled.length : 0) + ' 张忒咳哩-哩。')
    return false
  },
}
====================================================================================================
CODE 08706 | 08706 瘴气折磨 / Miasmatic Torment
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/miasma/08706.js
--- EN TEXT ---
Revelation - If you control a partner asset, exhaust them and attach Miasmatic Torment to them. Otherwise, Miasmatic Torment gains surge.
Attached asset cannot ready.
Forced - At the end of your turn: Attached asset takes 1 damage or 1 horror.
[action]: Test [willpower] or [intellect] (3). If you succeed, discard Miasmatic Torment.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "miasma" }
--- FLAGS DECLARED ---
  flags.peril  read@src/cards/campaign-plugin.js,src/engine/api-misc.js,src/engine/encounter.js
  flags.attachToPartnerAsset  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08706 瘴气折磨（Miasma 的折磨）· 诡计 · miasma
// 卡面：险境。显现 - 如果你控制伙伴支援，将其横置，并将瘴气折磨附属到该支援。否则获得涌动。
//   被附属的支援不能重整。强制 - 当你的回合结束时：被附属的支援受到 1 点伤害或 1 点恐惧。
//   [action]：检定[willpower]或[intellect](3)。成功则弃掉瘴气折磨。
// 读点：附属走 api.attachCardTo（support 附属）；「不能重整/回合结束伤害」需要引擎的支援附属强制
//   读点（primitive-requests/p7-08706.json）。
const CODE = '08706'

function partnerAssets(state, inv) {
  return (inv.assets || []).filter(asset => (asset.partner === true)
    || (state.cards?.[asset.code]?.flags?.partner === true))
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { peril: true, attachToPartnerAsset: true },
  encounterResolve(state, inv, card, api) {
    const partners = partnerAssets(state, inv)
    if (!partners.length) {
      api.info('「瘴气折磨」：你没有控制伙伴支援，获得涌动。')
      return { gainSurge: true }
    }
    const target = partners.length === 1 ? partners[0] : partners.find(asset => asset.id === api.choice({
      kind: 'asset', source: CODE, seat: inv.seat, prompt: '选择要附属「瘴气折磨」的伙伴支援。',
      options: partners.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
    })) || partners[0]
    if (typeof api.exhaust === 'function') api.exhaust(target)
    api.attachToAsset(inv.seat, target.id, CODE)
    api.info('🦠 「瘴气折磨」附属到伙伴支援「' + (target.name || target.code) + '」。')
    return true
  },
  note: '「被附属支援不能重整 / 回合结束受到 1 伤害或恐惧 / 行动摆脱」需要引擎的支援附属强制与行动读点（primitive-requests/p7-08706.json）。',
}
====================================================================================================
CODE 08707 | 08707 朦胧瘴气 / Nebulous Miasma
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse,Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/miasma/08707.js
--- EN TEXT ---
Revelation - Attach to your location.
Forced - When you end your turn at attached location: Each card you control with sanity (including your investigator) takes 1 direct horror.
Forced - At the end of the round: Discard Nebulous Miasma.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "miasma" }
--- FLAGS DECLARED ---
  flags.peril  read@src/cards/campaign-plugin.js,src/engine/api-misc.js,src/engine/encounter.js
  flags.locationAttachment  read@src/engine/parley.js
  flags.turnEndDirectHorror  <<UNREAD kind=undefined
  flags.discardAtRoundEnd  read@src/engine/ability.js,src/engine/phases.js,src/engine/stats.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08707 朦胧瘴气（Miasmic Fog）· 诡计 · miasma
// 卡面：险境。显现 - 附属到你所在地点。强制 - 你在附属地点结束你的回合时：你控制的每张有神智值
//   的卡牌（包括你的调查员）受到 1 点直接恐惧。强制 - 当一轮结束时：弃掉朦胧瘴气。
// 读点：显现附走 api.attachToLocation；范围恐惧与轮末弃掉需要「地点附属强制窗口」引擎读点，
//   见 primitive-requests/p7-08707.json。
const CODE = '08707'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { peril: true, locationAttachment: true, turnEndDirectHorror: 1, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    const location = state.locations.find(loc => loc.id === inv.location)
    if (!location) return false
    api.attachToLocation(location.id, { code: CODE, originalCode: CODE, id: CODE + ':' + location.id })
    api.info('🌫️ 「朦胧瘴气」附属到「' + (location.name || location.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的回合结束直接恐惧与轮末弃掉需要引擎的地点附属强制读点（primitive-requests/p7-08707.json）。',
}