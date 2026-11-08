# D 分片审阅摘要 6（08708–08719）

====================================================================================================
CODE 08708 | 08708 巨型白化企鹅 / Giant Albino Penguin
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Creature | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/penguins/08708.js
--- EN TEXT ---
Aloof.
As an additional cost for you to enter or leave this enemy's location, you must spend 1 action.

--- NUMS ---
{  "health": 3,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "penguins" }
--- FLAGS DECLARED ---
  flags.moveSurchargeAtEnemyLocation  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08708 巨型白化企鹅（Giant Albino Penguin）· 敌人 · penguins
// 卡面：冷漠。作为进入或离开本敌人所在地点的额外费用，你必须花费 1 个行动。
// 读点：冷漠来自卡面数据（aloof）；「进出所在地点额外 1 行动」需要引擎的地点移动附加费读点
//   （primitive-requests/p7-08708.json）。
export default {
  code: '08708', scope: 'enemy', implemented: true,
  flags: { moveSurchargeAtEnemyLocation: 1 },
  note: '「进入/离开本敌人所在地点额外花费 1 行动」需要引擎的地点移动附加费读点（primitive-requests/p7-08708.json）。',
}
====================================================================================================
CODE 08709 | 08709 呜啊！呜啊！呜啊！ / Wuk! Wuk! Wuk!
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/penguins/08709.js
--- EN TEXT ---
Revelation - Find the Giant Albino Penguin enemy farthest from you. You must either move it to your location or place 1 doom on it. If there are no Giant Albino Penguins in play, search the encounter deck and discard pile for a Giant Albino Penguin, draw it, and shuffle the encounter deck.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "penguins" }
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
// 08709 呜啊！呜啊！呜啊！（Awk! Awk! Awk!）· 诡计 · penguins
// 卡面：显现 - 找到离你最远的巨型白化企鹅敌人。你必须将其移动到你所在地点，或在其上放置 1 个毁灭标记。
//   如果场上没有巨型白化企鹅敌人，查找遭遇牌库及弃牌堆，找出并抽取一个巨型白化企鹅，并混洗遭遇牌库。
// 读点：距离 entryDistance；移动 api.scenario.moveEnemy；毁灭 api.doomOn；
//   检索生成走 takeEncounterDeckCard/takeEncounterDiscard/spawn/shuffleEncounterDeck。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '08709'
const PENGUIN = '08708'
const isPenguin = code => {
  const card = ALL_CARDS[code]
  return card?.type === 'enemy' && card.encounterCode === 'penguins'
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    let penguins = state.enemies.filter(enemy => isPenguin(enemy.originalCode || enemy.code) && !enemy.defeated)
    if (!penguins.length) {
      let spawned = null
      if ((state.encounterDeck || []).includes(PENGUIN)) {
        const taken = api.takeEncounterDeckCard(PENGUIN)
        if (taken) spawned = api.spawn(PENGUIN, inv.location)
      } else if ((state.encounterDiscard || []).includes(PENGUIN)) {
        const taken = api.takeEncounterDiscard(PENGUIN)
        if (taken) spawned = api.spawn(PENGUIN, inv.location)
      }
      api.shuffleEncounterDeck()
      if (!spawned) {
        api.info('「呜啊！呜啊！呜啊！」：场上与遭遇牌堆都没有巨型白化企鹅。')
        return false
      }
      api.info('🐧 「呜啊！呜啊！呜啊！」：巨型白化企鹅被找出来并生成。')
      return false
    }
    const scored = penguins.map(enemy => ({ enemy, distance: entryDistance(state, inv.location, enemy.location) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const farthest = Math.max(...scored.map(item => item.distance))
    const candidates = scored.filter(item => item.distance === farthest).map(item => item.enemy)
    const enemy = candidates.length === 1 ? candidates[0] : candidates.find(item => item.id === api.choice({
      kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择离你最远的巨型白化企鹅。',
      options: candidates.map(item => ({ id: item.id, label: item.name || item.id })),
    })) || candidates[0]
    const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '「呜啊！呜啊！呜啊！」：移动企鹅到你所在地点，或在其上放 1 个毁灭标记。',
      options: [{ id: 'move', label: '把它移动到你的地点' }, { id: 'doom', label: '在其上放置 1 个毁灭标记' }] })
    if (pick === 'doom') {
      api.doomOn(enemy, 1)
      api.info('🌑 「呜啊！呜啊！呜啊！」：企鹅上放置 1 个毁灭标记。')
    } else {
      api.scenario.moveEnemy(enemy, inv.location, { ignoreAloof: true })
      api.info('🐧 「呜啊！呜啊！呜啊！」：企鹅移动到你的地点。')
    }
    return false
  },
}
====================================================================================================
CODE 08710 | 08710 失落的修格斯 / Forgotten Shoggoth
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Shoggoth | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/shoggoths/08710.js
--- EN TEXT ---
Hunter.
Forced - After Forgotten Shoggoth engages you: Draw the top card of the Tekeli-li deck (if you cannot, Forgotten Shoggoth attacks you).

--- NUMS ---
{  "health": 6,  "damage": 1,  "horror": 2,  "quantity": 2,  "encounterCode": "shoggoths" }
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
// 08710 失落的修格斯（Lost Shoggoth）· 敌人 · shoggoths
// 卡面：猎手。强制 - 失落的修格斯与你交战后：抽取忒咳哩-哩牌库顶的 1 张卡牌（如果你不能这么做，
//   失落的修格斯攻击你）。
// 读点：forced + trigger 'enemyEngaged'（enemies.js#engageEnemy 开窗）；tekeliDraw 取牌。
//   「抽到后按弱点结算」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08710.json）。
export default {
  code: '08710', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged',
    label: '与失落的修格斯交战后：抽取忒咳哩-哩牌库顶 1 张；不能则它攻击你',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, context, api }) => {
      const code = api.mechanics.tekeli.draw()
      if (code) {
        api.info('👁️ 「失落的修格斯」：抽出忒咳哩-哩「' + (api.cardName?.(code) || code) + '」（按弱点结算）。')
        return
      }
      const seat = Number.isSafeInteger(context?.seat) ? context.seat : state.currentSeat
      api.info('「失落的修格斯」：没有忒咳哩-哩可抽，它攻击了你。')
      api.scenario.attack(source, state.investigators[seat])
    },
  }],
  note: '「抽到后立即按弱点结算」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08710.json）。',
}
====================================================================================================
CODE 08711 | 08711 狂暴的修格斯 / Rampaging Shoggoth
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Shoggoth,Elite | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/shoggoths/08711.js
--- EN TEXT ---
Hunter. Massive.
Rampaging Shoggoth gets +2 [per_investigator] health.
Forced - At the end of the enemy phase: Deal 2 damage to each investigator and non-[[Shoggoth]] enemy at Rampaging Shoggoth's location. Each of those investigators draws the top card of the Tekeli-li deck.

--- NUMS ---
{  "health": 4,  "damage": 2,  "horror": 1,  "victory": 1,  "quantity": 1,  "encounterCode": "shoggoths" }
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
// 08711 狂暴的修格斯（Rampaging Shoggoth）· 敌人 · shoggoths
// 卡面：猎手。庞大。狂暴的修格斯得到 +2[per_investigator] 生命值。强制 - 当敌军阶段结束时：
//   对其所在地点的每位调查员和每个非[[修格斯]]敌人造成 2 点伤害。这些调查员各自抽取忒咳哩-哩
//   牌库顶的 1 张卡牌。
// 读点：生命修正走 modifiers 的 enemyHealth（entityModifierTotal 读点）；敌军阶段结束走
//   forced + trigger 'enemyPhaseEnds'；伤害 api.damage / api.scenario.damageEnemy。
export default {
  code: '08711', scope: 'enemy', implemented: true,
  modifiers: [{ target: 'enemyHealth', amount: ({ state }) => 2 * Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1) }],
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '敌军阶段结束：本地点每位调查员与非修格斯敌人各受 2 伤害，调查员各抽 1 张忒咳哩-哩',
    criteria: ({ source }) => source && !source.defeated,
    resolve: ({ state, source, api }) => {
      if (!state.locations.some(loc => loc.id === source.location)) return
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === source.location)
      for (const other of mates) {
        api.damage(other.seat, 2)
        api.info('💥 「狂暴的修格斯」：' + (other.name || '调查员') + ' 受到 2 点伤害。')
      }
      for (const enemy of [...state.enemies]) {
        if (enemy === source || enemy.defeated || enemy.location !== source.location) continue
        if ((enemy.traits || []).some(trait => String(trait).toLowerCase() === 'shoggoth')) continue
        api.scenario.damageEnemy(enemy.id, 2, null, '08711')
      }
      for (const other of mates) {
        const code = api.mechanics.tekeli.draw()
        if (!code) continue
        api.info('👁️ 「狂暴的修格斯」：' + (other.name || '调查员') + ' 抽出忒咳哩-哩「' + (api.cardName?.(code) || code) + '」。')
      }
    },
  }],
}
====================================================================================================
CODE 08712 | 08712 极地幻景 / Polar Mirage
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/silence_and_mystery/08712.js
--- EN TEXT ---
Revelation - Attach to the nearest location with at least 1 clue, and without a copy of Polar Mirage attached.
Forced - After you discover or take control of 1 or more clues at attached location: Discard each non-weakness card in your hand. Discard Polar Mirage.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "silence_and_mystery" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.clueDiscoveryDiscardNonWeakness  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08712 极地幻景（Polar Mirage）· 诡计 · silence_and_mystery
// 卡面：显现 - 附属到最近的有线索且没有附属极地幻景的地点。强制 - 你发现附属地点的线索，或控制
//   附属地点的线索后：弃掉你手中所有非弱点卡牌。弃掉极地幻景。
// 读点：显现附走 api.attachToLocation；「发现/控制附属地点线索后弃手牌」需要引擎的地点附属强制窗口
//   （primitive-requests/p7-08712.json）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08712'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, clueDiscoveryDiscardNonWeakness: true },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => (loc.clues || 0) > 0
      && !(loc.attachments || []).some(attachment => (attachment.originalCode || attachment.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近的有线索且没有附属「极地幻景」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('🌌 「极地幻景」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '「发现/控制附属地点线索后弃掉手中所有非弱点卡牌并弃掉本卡」需要引擎的地点附属强制读点（primitive-requests/p7-08712.json）。',
}
====================================================================================================
CODE 08713 | 08713 黑暗极光 / Dark Aurora
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/silence_and_mystery/08713.js
--- EN TEXT ---
Revelation - Test [willpower] (3). For each [frost] token revealed during this test, take 1 horror. If you fail, take 2 horror.

--- NUMS ---
{  "quantity": 3,  "encounterCode": "silence_and_mystery" }
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
// 08713 黑暗极光（Dark Aurora）· 诡计 · silence_and_mystery
// 卡面：显现 - 检定[willpower](3)。本次检定期间每揭示一个[frost]标记，受到 1 点恐惧。
//   如果你检定失败，受到 2 点恐惧。
// 读点：encounterResolve；result.drawn 是本次检定揭示的标记数组。
export default {
  code: '08713', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 3, result => {
      const frosts = (result.drawn || []).filter(token => token === 'frost').length
      if (frosts > 0) api.horror(inv.seat, frosts)
      if (!result.success) api.horror(inv.seat, 2)
    })
    return false
  },
}
====================================================================================================
CODE 08714 | 08714 威廉·戴尔教授 / Professor William Dyer
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Miskatonic | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08714.js
--- EN TEXT ---
Partner. Uses (3 secrets).
[action] Spend 1 secret and exhaust Professor William Dyer: Heal 2 horror from an investigator or another [[Ally]] asset at your location.

--- NUMS ---
{  "health": 1,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Professor of Geology",  "subnameZh": "地质学教授" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.heal2Horror  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-interactions.browser.mjs","tests/eote-interactions.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08714 威廉·戴尔教授（Professor William Dyer） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：治愈你所在地点的一位调查员或另一个[[盟友]]支援 2 点恐惧。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08714'
const isAlly = card => (ALL_CARDS[card?.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'heal2Horror' } },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '花费 1 秘密并横置：治愈同地点调查员或另一个盟友支援 2 点恐惧',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      const allies = mates.flatMap(owner => (owner.assets || []).filter(asset => asset !== source && isAlly(asset))
        .map(asset => ({ owner, asset })))
      const options = [
        ...mates.map(other => ({ id: 'inv:' + other.seat, label: (other.name || '调查员') + '（恐惧）' })),
        ...allies.map(item => ({ id: 'asset:' + item.asset.id, label: (ALL_CARDS[item.asset.code]?.nameZh || item.asset.code) + '（恐惧）' })),
      ]
      if (!options.length) return
      const pick = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择治愈 2 点恐惧的目标（同地点调查员或盟友支援）。', options })
      if (String(pick).startsWith('inv:')) return api.healHorror(Number(String(pick).slice(4)), 2)
      const found = allies.find(item => item.asset.id === String(pick).slice(6))
      if (found) api.healAsset(found.asset, { horror: 2, ownerSeat: found.owner.seat })
    },
  }],
}
====================================================================================================
CODE 08715 | 08715 丹佛斯 / Danforth
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Miskatonic | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08715.js
--- EN TEXT ---
Partner. Uses (5 secrets).
[reaction] After an investigator at your location resolves a Tekeli-li weakness, exhaust Danforth and spend 1 secret: That investigator draws 2 cards.

--- NUMS ---
{  "health": 2,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Brilliant Student",  "subnameZh": "杰出学生" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.draw2AfterTekeliliResolved  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08715 丹佛斯（Danforth） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(5秘密)。[reaction]你所在地点的调查员结算忒咳哩-哩弱点后，横置丹佛斯并花费 1 秘密：该调查员抽取 2 张卡牌。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

export default {
  code: '08715', scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { reaction: 'draw2AfterTekeliliResolved' } },
  uses: 5, usesType: 'secrets',
  note: '「结算忒咳哩-哩弱点后」需要引擎的弱点结算后窗口（P7 读点请求 primitive-requests/p7-08715.json）；条目先声明伙伴数据与能力条件。',
}
====================================================================================================
CODE 08716 | 08716 伊里亚·阿什瓦克 / Eliyah Ashevak
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js
--- EN TEXT ---
Partner. Uses (3 secrets).
[action] Spend 1 secret and exhaust Eliyah Ashevak: Evade. Attempt to evade with a base [agility] skill of 5. If you succeed, you may move to a connecting location.

--- NUMS ---
{  "health": 3,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Dog Handler",  "subnameZh": "驯犬师" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.evadeBase5ThenMayMove  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08716 伊里亚·阿什瓦克（Eliyah Ashevak） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：躲避。以基础值为 5 的[agility]尝试躲避。成功后可移动到连接地点。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08716'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'evadeBase5ThenMayMove' } },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'action', actionKind: 'evade', label: '花费 1 秘密并横置：以基础值 5 的敏捷躲避，成功后移动到连接地点',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => !enemy.defeated && enemy.location === inv.location)
      if (!enemies.length) {
        api.info('「伊里亚·阿什瓦克」：所在地点没有可躲避的敌人。')
        return
      }
      const target = enemies.length === 1 ? enemies[0] : enemies.find(enemy => enemy.id === api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择要躲避的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
      })) || enemies[0]
      const difficulty = Number(target.evade ?? 0)
      api.test(inv.seat, 'agility', difficulty, {
        baseValue: 5,
        source: { type: 'asset', code: CODE, name: ALL_CARDS[CODE]?.nameZh || CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.autoEvade(target)
              const destinations = (here?.connections || []).filter(id => state.locations.some(loc => loc.id === id))
          if (!destinations.length) return
          const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '躲避成功：是否移动到一个连接地点？',
            options: [{ id: 'skip', label: '不移动' }, ...destinations.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id }))] })
          if (destinations.includes(pick)) api.moveInvestigator(inv.seat, pick)
        },
      })
    },
  }],
}
====================================================================================================
CODE 08717 | 08717 玛拉·辛哈医生 / Dr. Mala Sinha
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08717.js
--- EN TEXT ---
Partner. Uses (3 supplies).
[action] Spend 1 supply and exhaust Dr. Mala Sinha: Heal 2 damage from an investigator or another [[Ally]] asset at your location.

--- NUMS ---
{  "health": 4,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Daring Physician",  "subnameZh": "无畏医师" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.heal2Damage  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08717 玛拉·辛哈医生（Dr. Mala Sinha） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3补给)。[action]花费 1 补给并横置：治愈你所在地点的一位调查员或另一个[[盟友]]支援 2 点伤害。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08717'
const isAlly = card => (ALL_CARDS[card?.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'heal2Damage' } },
  uses: 3, usesType: 'supplies',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '花费 1 补给并横置：治愈同地点调查员或盟友支援 2 点伤害',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      const allies = mates.flatMap(owner => (owner.assets || []).filter(asset => asset !== source && isAlly(asset))
        .map(asset => ({ owner, asset })))
      const options = [
        ...mates.map(other => ({ id: 'inv:' + other.seat, label: (other.name || '调查员') + '（伤害）' })),
        ...allies.map(item => ({ id: 'asset:' + item.asset.id, label: (ALL_CARDS[item.asset.code]?.nameZh || item.asset.code) + '（伤害）' })),
      ]
      if (!options.length) return
      const pick = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择治愈 2 点伤害的目标（同地点调查员或盟友支援）。', options })
      if (String(pick).startsWith('inv:')) return api.healDamage(Number(String(pick).slice(4)), 2)
      const found = allies.find(item => item.asset.id === String(pick).slice(6))
      if (found) api.healAsset(found.asset, { damage: 2, ownerSeat: found.owner.seat })
    },
  }],
}
====================================================================================================
CODE 08718 | 08718 艾弗里·克莱普尔 / Avery Claypool
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08718.js
--- EN TEXT ---
Partner. Uses (5 supplies).
[reaction] When an investigator at your location reveals a [frost] token during a skill test, exhaust Avery Claypool and spend 1 supply: Cancel that token and reveal a new one.

--- NUMS ---
{  "health": 3,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Antarctic Guide",  "subnameZh": "南极向导" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.cancelFrostRevealNewToken  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08718 艾弗里·克莱普尔（Avery Claypool） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(5补给)。[reaction]你所在地点的一位调查员在技能检定期间揭示了[frost]标记时，横置并花费 1 补给：取消该标记并揭示一个新的标记。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

const CODE = '08718'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { reaction: 'cancelFrostRevealNewToken' } },
  uses: 5, usesType: 'supplies',
  abilities: [{
    kind: 'reaction', trigger: 'tokenReveal',
    label: '花费 1 补给并横置：取消本次 [frost] 标记，改为揭示一个新标记',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, inv, context }) => context?.when === 'tokenReveal' && context?.token === 'frost'
      && state.investigators?.[state.skillTest?.seat]?.location === inv.location,
    resolve: ({ context, api }) => {
      const revealed = api.revealChaosTokens(1)[0]
      if (revealed == null) {
        api.info('「艾弗里·克莱普尔」：混乱袋里没有可替代的标记。')
        return
      }
      context.replacementToken = revealed
      api.info('「艾弗里·克莱普尔」：取消 [frost]，改为揭示「' + api.tokenLabel(revealed) + '」。')
    },
  }],
}
====================================================================================================
CODE 08719 | 08719 詹姆斯·“曲奇”·弗雷德里克斯 / James "Cookie" Fredericks
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Veteran,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08719.js
--- EN TEXT ---
Partner. Uses (3 ammo).
[action] Spend 1 ammo and exhaust James "Cookie" Fredericks: Fight. Fight with a base [combat] skill of 5. If you succeed and the attacked enemy is non-[[Elite]], it cannot attack for the remainder of the round.

--- NUMS ---
{  "health": 5,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Dubious Choice",  "subnameZh": "不可靠人选" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.fightBase5NonEliteCannotAttackThisRound  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
MARKER:30: // 「直到本轮结束不能攻击」需要引擎的敌人临时攻击禁用读点（primitive-requests/p7-08719.json）。
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08719 詹姆斯·「曲奇」·弗雷德里克斯（James "Cookie" Fredericks） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3子弹)。[action]花费 1 子弹并横置：攻击。以基础值为 5 的[combat]攻击。成功且敌人非[[精英]]时，直到本轮结束其不能攻击。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08719'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'fightBase5NonEliteCannotAttackThisRound' } },
  uses: 3, usesType: 'ammo',
  abilities: [{
    kind: 'action', actionKind: 'fight', label: '花费 1 子弹并横置：以基础值 5 的战斗攻击；成功且非精英则本轮不能攻击',
    cost: { action: 1, exhaust: true, uses: 1 },
    target: { kind: 'enemy' },
    resolve: ({ state, inv, ctx, api }) => {
      const targetId = ctx?.target?.id ?? ctx?.targetId
      const enemy = state.enemies.find(item => item.id === targetId && !item.defeated)
      if (!enemy) return
      api.test(inv.seat, 'combat', Number(enemy.fight ?? 0), {
        baseValue: 5,
        source: { type: 'asset', code: CODE, name: ALL_CARDS[CODE]?.nameZh || CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.damageEnemy(enemy.id, 1, inv.seat, CODE)
          if (enemy.elite) return
          // 「直到本轮结束不能攻击」需要引擎的敌人临时攻击禁用读点（primitive-requests/p7-08719.json）。
          api.info('「曲奇」：' + (enemy.name || enemy.id) + ' 本轮无法攻击（数据已声明，读点待接）。')
        },
      })
    },
  }],
}