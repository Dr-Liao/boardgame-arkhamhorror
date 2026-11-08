# D 分片审阅摘要 4（08684–08695）

====================================================================================================
CODE 08684 | 08684 巨大坡道 / Titanic Ramp
- partition: eoteCampaign | type: location | status(账本): simplified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08684
- 账本 reason: pending-primitive: p7-08682（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08684.js
--- EN TEXT ---
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (2). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.

--- BACK EN ---
Titanic Ramp is connected to the locations to its left and right.

--- NUMS ---
{  "clues": 1,  "shroud": 3,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.ramp  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js,content/campaigns/edgeOfTheEarth/story-text.js
  locationRule.leaveTestDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
  locationRule.spendClueAutoSucceed  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
SIMPLIFIED: pending-primitive: p7-08682（近似已披露，不阻塞 gate） [p7-08682]
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08684 泰坦坡道（Titanic Ramp）· 深潜组地点
// 卡面：泰坦坡道与左右相邻地点连接。离开泰坦坡道的额外费用：检定 [agility] (2)，失败则取消移动；
// 你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功。
// 读点：locationRule.leaveTestDifficulty / spendClueAutoSucceed → behavior.locationLeaveTest。
export default {
  code: '08684',
  scope: 'location',
  implemented: true,
  locationRule: {
    leaveTestDifficulty: 2,
    spendClueAutoSucceed: true,
  },
  flags: { ramp: true },
}
====================================================================================================
CODE 08685 | 08685 巨大坡道 / Titanic Ramp
- partition: eoteCampaign | type: location | status(账本): simplified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08685
- 账本 reason: pending-primitive: p7-08682（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08685.js
--- EN TEXT ---
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (1). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.

--- BACK EN ---
Titanic Ramp is connected to the locations to its left and right.

--- NUMS ---
{  "clues": 1,  "shroud": 4,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.ramp  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js,content/campaigns/edgeOfTheEarth/story-text.js
  locationRule.leaveTestDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
  locationRule.spendClueAutoSucceed  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
SIMPLIFIED: pending-primitive: p7-08682（近似已披露，不阻塞 gate） [p7-08682]
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08685 泰坦坡道（Titanic Ramp）· 深潜组地点
// 卡面：泰坦坡道与左右相邻地点连接。离开泰坦坡道的额外费用：检定 [agility] (1)，失败则取消移动；
// 你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功。
// 读点：locationRule.leaveTestDifficulty / spendClueAutoSucceed → behavior.locationLeaveTest。
export default {
  code: '08685',
  scope: 'location',
  implemented: true,
  locationRule: {
    leaveTestDifficulty: 1,
    spendClueAutoSucceed: true,
  },
  flags: { ramp: true },
}
====================================================================================================
CODE 08686 | 08686 隐秘隧道 / Hidden Tunnel
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08686
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08686.js
--- EN TEXT ---
Hidden Tunnel is connected to the location to its left.
Objective - If each undefeated investigator is at the Hidden Tunnel, advance the act.

--- BACK EN ---
Hidden Tunnel is connected to the location to its left.

--- NUMS ---
{  "clues": 0,  "shroud": 5,  "quantity": 1,  "encounterCode": "stirring_in_the_deep",  "subname": "A Way Out",  "subnameZh": "出逃之路" }
--- FLAGS DECLARED ---
  flags.hiddenTunnel  read@content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
  flags.objectiveRun  <<UNREAD kind=undefined
  locationRule.objectiveRun  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08686 隐藏隧道（Hidden Tunnel）· 深潜组地点
// 卡面：隐藏隧道与左侧地点连接。目标 - 如果每名未被击败的调查员都在隐藏隧道，推进幕。
export default {
  code: '08686',
  scope: 'location',
  implemented: true,
  locationRule: {
    objectiveRun: true,
  },
  flags: { hiddenTunnel: true, objectiveRun: true },
}
====================================================================================================
CODE 08687 | 08687 原初恶魔 / Primordial Evil
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Eidolon | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/agents_of_the_unknown/08687.js
--- EN TEXT ---
Hunter. Retaliate.
Forced - When you deal any amount of damage to Primordial Evil: Shuffle the top card of the Tekeli-li deck into your deck without looking at it (if you cannot, Primordial Evil attacks you).

--- NUMS ---
{  "health": 5,  "damage": 2,  "horror": 1,  "quantity": 2,  "encounterCode": "agents_of_the_unknown" }
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
// 08687 原初恶魔（Primordial Evil）· 敌人 · agents_of_the_unknown
// 归属：战役共用 · edgeOfTheEarth/_shared。卡面：猎手。反击。
// 强制 - 在你对原初恶魔造成任意数量的伤害时：将忒咳哩-哩牌库顶的 1 张卡牌洗入你的牌库，
//   不要查看内容（如果你不能这么做，原初恶魔攻击你）。
// 读点：abilities 的 forced + trigger 'enemyDamaged'（combat.js 普通攻击与伤害管线都会开窗）；
//   洗入走 P2-E api.mechanics.tekeli.shuffleIn（牌张不足返回 false 即「不能这么做」）。
export default {
  code: '08687', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDamaged',
    label: '原初恶魔受到伤害后：洗入 1 张忒咳哩-哩；不能则它攻击你',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number.isSafeInteger(context?.seat),
    resolve: ({ state, source, context, api }) => {
      const seat = context.seat
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(seat, 1) : false
      if (Array.isArray(shuffled) && shuffled.length) {
        api.info('「原初恶魔」：1 张忒咳哩-哩洗入牌库（不查看内容）。')
        return
      }
      api.info('「原初恶魔」：没有忒咳哩-哩可洗入，它立刻攻击了调查员。')
      api.scenario.attack(source, state.investigators[seat])
    },
  }],
}
====================================================================================================
CODE 08688 | 08688 潜藏的疯狂 / The Madness Within
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/agents_of_the_unknown/08688.js
--- EN TEXT ---
Revelation - Test [willpower] (4). For each point you fail by, shuffle the top card of the Tekeli-li deck into your deck without looking at it (for each card you cannot shuffle, take 1 horror).

--- NUMS ---
{  "quantity": 2,  "encounterCode": "agents_of_the_unknown" }
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
// 08688 潜藏的疯狂（Latent Madness）· 诡计 · agents_of_the_unknown
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 检定[willpower](4)。你检定失败且每低于难度 1 点，将忒咳哩-哩牌库顶的 1 张卡牌
//   洗入你的牌库，不要查看内容（每有 1 张卡牌不能洗入你的牌库，受到 1 点恐惧）。
// 读点：entryRevelation + encounterResolve（treachery-tokens.js 的条目通道）。
export default {
  code: '08688', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      const failedBy = Math.max(0, 4 - Number(result.value || 0))
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = failedBy > 0 && size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, Math.min(failedBy, size)) : false
      const done = Array.isArray(shuffled) ? shuffled.length : 0
      const missing = failedBy - done
      api.info('「潜藏的疯狂」：洗入 ' + done + ' 张忒咳哩-哩' + (missing > 0 ? '，' + missing + ' 张无法洗入。' : '。'))
      if (missing > 0) api.horror(inv.seat, missing)
    })
    return false
  },
}
====================================================================================================
CODE 08689 | 08689 实体疯狂 / Manifestation of Madness
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Eidolon | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/creatures_in_the_ice/08689.js
--- EN TEXT ---
Hunter.
Forced - When Manifestation of Madness attacks you: Shuffle the top 2 cards of the Tekeli-li deck into your deck without looking at them (for each card you cannot shuffle, Manifestation of Madness deals +1 damage and +1 horror for this attack).

--- NUMS ---
{  "health": 3,  "damage": 1,  "horror": 1,  "quantity": 3,  "encounterCode": "creatures_in_the_ice" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-iceAndDeathPart1.test.mjs","tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08689 实体疯狂（Manifest Madness）· 敌人 · creatures_in_the_ice
// 卡面：猎手。强制 - 在实体疯狂攻击你时：将忒咳哩-哩牌库顶的 2 张卡牌洗入你的牌库（每有 1 张
//   卡牌不能洗入你的牌库，实体疯狂该次攻击造成 +1 伤害和 +1 恐惧）。
// 读点：forced + trigger 'enemyAttacked'（enemies.js#enemyAttack 在攻击结算后开窗）。
export default {
  code: '08689', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyAttacked',
    label: '实体疯狂攻击后：洗入 2 张忒咳哩-哩；每张不能洗入则本次攻击 +1 伤害/+1 恐惧',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id
      && Number.isSafeInteger(context?.seat) && context?.attackCancelled !== true,
    resolve: ({ state, context, api }) => {
      const seat = context.seat
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(seat, Math.min(2, size)) : false
      const done = Array.isArray(shuffled) ? shuffled.length : 0
      const missing = 2 - done
      if (missing <= 0) return
      api.info('「实体疯狂」：' + missing + ' 张忒咳哩-哩无法洗入，该次攻击额外 +' + missing + ' 伤害和 +' + missing + ' 恐惧。')
      api.damage(seat, missing)
      api.horror(seat, missing)
    },
  }],
}
====================================================================================================
CODE 08690 | 08690 冰川幻影 / Glacial Phantasm
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Eidolon | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/creatures_in_the_ice/08690.js
--- EN TEXT ---
Forced - At the end of the enemy phase, if Glacial Phantasm is ready: Move it once toward the location with the most investigators. In player order, each investigator at Glacial Phantasm's location or a connecting location shuffles the top card of the Tekeli-li deck into their deck without looking at it (each investigator who cannot takes 1 horror).

--- NUMS ---
{  "health": 4,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "creatures_in_the_ice" }
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
// 08690 冰川幻影（Glacial Phantom）· 敌人 · creatures_in_the_ice
// 卡面：强制 - 当敌军阶段结束时，如果冰川幻影处于重整状态：将其向调查员最多的地点移动一次。
//   按玩家顺序，每位在冰川幻影所在地点或连接地点的调查员，将忒咳哩-哩牌库顶的 1 张卡牌洗入
//   自己的牌库，不要查看内容（每位不能这么做的调查员受到 1 点恐惧）。
// 读点：forced + trigger 'enemyPhaseEnds'（turn.js 敌军阶段结束）；移动走 api.scenario.moveEnemyToward。
export default {
  code: '08690', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '敌军阶段结束：冰川幻影向调查员最多的地点移动，相邻调查员各洗入 1 张忒咳哩-哩',
    criteria: ({ source }) => source && source.exhausted !== true && !source.defeated,
    resolve: ({ state, source, api }) => {
      const alive = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
      const counts = new Map()
      for (const inv of alive) counts.set(inv.location, (counts.get(inv.location) || 0) + 1)
      let target = null
      for (const [locationId, count] of counts) {
        if (!state.locations.some(loc => loc.id === locationId)) continue
        if (target == null || count > (counts.get(target) || 0)) target = locationId
      }
      if (target && target !== source.location) api.scenario.moveEnemyToward(source, target, { ignoreAloof: true })
      const here = state.locations.find(loc => loc.id === source.location)
      const spots = new Set([source.location, ...(here?.connections || [])])
      const size = Number(api.mechanics.tekeli.size())
      for (const inv of alive) {
        if (!spots.has(inv.location)) continue
        const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, 1) : false
        if (Array.isArray(shuffled) && shuffled.length) continue
        api.info('「冰川幻影」：' + (inv.name || '调查员') + ' 无法洗入忒咳哩-哩，受到 1 点恐惧。')
        api.horror(inv.seat, 1)
      }
    },
  }],
}
====================================================================================================
CODE 08691 | 08691 同源迷雾 / Kindred Mist
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/creatures_in_the_ice/08691.js
--- EN TEXT ---
Revelation - Attach to the nearest location without a copy of Kindred Mist attached.
Forced - When 1 or more cards from the Tekeli-li deck would be shuffled into your deck while you are at attached location: Draw them instead, placing them on the bottom of your deck instead of the bottom of the Tekeli-li deck. Discard Kindred Mist at the end of this round.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "creatures_in_the_ice" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.replacesTekeliShuffleAtLocation  <<UNREAD kind=undefined
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
// 08691 同源迷雾（Kindred Mist）· 诡计 · creatures_in_the_ice
// 卡面：显现 - 附属到最近且没有附属同源迷雾的地点。
// 强制 - 你在附属地点时，在忒咳哩-哩牌库的卡牌将要混洗入你的牌库时：改为抽取那些卡牌，不要
//   将它们放在忒咳哩-哩牌库底，改为放在你的牌库底。当一轮结束时弃掉同源迷雾。
// 读点：显现附走 api.attachToLocation（location-attachments.js 唯一写入口）；
//   洗入替代与轮末强制需要「地点附属强制窗口」这个引擎读点，见
//   artifacts/migration/eote/primitive-requests/p7-08691.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08691'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, replacesTekeliShuffleAtLocation: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「同源迷雾」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('🌫️ 「同源迷雾」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的忒咳哩-哩洗入替代与轮末弃掉需要引擎的地点附属强制读点；本条目只落数据与附属，读点请求见 primitive-requests/p7-08691.json。',
}
====================================================================================================
CODE 08692 | 08692 南极寒风 / Antarctic Wind
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/deadly_weather/08692.js
--- EN TEXT ---
Revelation - Attach to the nearest location without a copy of Antarctic Wind attached.
Investigators at attached location cannot play cards or draw cards from their deck.
Forced - At the end of the round: Discard Antarctic Wind.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "deadly_weather" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.weather  read@content/campaigns/edgeOfTheEarth/story-text.js,content/campaigns/theInnsmouthConspiracy/story-text.js
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
// 08692 南极寒风（Antarctic Wind） · 诡计 · deadly_weather
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 附属到最近且没有附属本卡的地点。
//   位于附属地点的调查员不能打出卡牌，或从自己的牌库抽取卡牌。强制 - 当一轮结束时：弃掉南极寒风。
// 读点：显现附走 api.attachToLocation；附属地点的持续/强制限制需要「地点附属规则」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08692.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08692'

function nearestLocation(state, fromId) {
  const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
  const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, fromId, loc.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.loc)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, weather: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    let chosen = null
    if (true) {
      const options = nearestLocation(state, inv.location)
      if (!options.length) return false
      chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「南极寒风（Antarctic Wind）」的地点。',
        options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || options[0]
    } else {
      chosen = state.locations.find(loc => loc.id === inv.location)
      if (!chosen) return false
    }
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('「南极寒风（Antarctic Wind）」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的持续限制与轮末弃掉需要引擎的地点附属规则读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08692.json。',
}
====================================================================================================
CODE 08693 | 08693 雪盲危机 / Whiteout
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/deadly_weather/08693.js
--- EN TEXT ---
Revelation - Attach to your location.
Each investigator at attached location gets -1 [willpower], -1 [intellect], -1 [combat], and -1 [agility].
Forced - At the end of the round: Discard Whiteout.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "deadly_weather" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.weather  read@content/campaigns/edgeOfTheEarth/story-text.js,content/campaigns/theInnsmouthConspiracy/story-text.js
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
// 08693 雪盲危机（Snow Blindness） · 诡计 · deadly_weather
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 附属到你所在地点。
//   位于附属地点的每位调查员得到 -1[willpower]、-1[intellect]、-1[combat]、-1[agility]。强制 - 当一轮结束时：弃掉雪盲危机。
// 读点：显现附走 api.attachToLocation；附属地点的持续/强制限制需要「地点附属规则」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08693.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08693'

function nearestLocation(state, fromId) {
  const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
  const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, fromId, loc.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.loc)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, weather: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    let chosen = null
    if (false) {
      const options = nearestLocation(state, inv.location)
      if (!options.length) return false
      chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「雪盲危机（Snow Blindness）」的地点。',
        options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || options[0]
    } else {
      chosen = state.locations.find(loc => loc.id === inv.location)
      if (!chosen) return false
    }
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('「雪盲危机（Snow Blindness）」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的持续限制与轮末弃掉需要引擎的地点附属规则读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08693.json。',
}
====================================================================================================
CODE 08694 | 08694 极地旋涡 / Polar Vortex
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/deadly_weather/08694.js
--- EN TEXT ---
Revelation - Attach to your location.
Forced - When you end your turn at attached location: Each card you control with health (including your investigator) takes 1 direct damage.
Forced - At the end of the round: Discard Polar Vortex.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "deadly_weather" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.weather  read@content/campaigns/edgeOfTheEarth/story-text.js,content/campaigns/theInnsmouthConspiracy/story-text.js
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
// 08694 极地旋涡（Polar Vortex） · 诡计 · deadly_weather
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 附属到你所在地点。
//   强制 - 你在附属地点结束你的回合时：你控制的每张有生命值的卡牌（包括你的调查员）受到 1 点直接伤害。强制 - 当一轮结束时：弃掉极地旋涡。
// 读点：显现附走 api.attachToLocation；附属地点的持续/强制限制需要「地点附属规则」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08694.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08694'

function nearestLocation(state, fromId) {
  const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
  const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, fromId, loc.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.loc)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, weather: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    let chosen = null
    if (false) {
      const options = nearestLocation(state, inv.location)
      if (!options.length) return false
      chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「极地旋涡（Polar Vortex）」的地点。',
        options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || options[0]
    } else {
      chosen = state.locations.find(loc => loc.id === inv.location)
      if (!chosen) return false
    }
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('「极地旋涡（Polar Vortex）」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的持续限制与轮末弃掉需要引擎的地点附属规则读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08694.json。',
}
====================================================================================================
CODE 08695 | 08695 古老者清道夫 / Elder Thing Scavenger
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Elder Thing | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/elder_things/08695.js
--- EN TEXT ---
Hunter.
Forced - After Elder Thing Scavenger attacks you: Discard the top 3 cards of your deck. Draw each weakness discarded this way.

--- NUMS ---
{  "health": 3,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "elder_things" }
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
// 08695 古老者清道夫（Elder Thing Scavenger）· 敌人 · elder_things
// 卡面：猎手。强制 - 在古老者清道夫攻击你后：弃掉你牌库顶 3 张卡牌。抽取所有以此方式弃掉的弱点。
// 读点：forced + trigger 'enemyAttacked'；弃牌走 api.discardTopOfDeck，弱点经 api.moveCard 放回
//   牌库顶后用 api.drawCards 抽取（走引擎真正的弱点揭示结算）。
import { isWeaknessCode } from '../../../_shared.js'

function discardAndDrawWeaknesses(seat, count, api) {
  const discarded = api.discardTopOfDeck(seat, count) || []
  const weaknesses = discarded.filter(code => isWeaknessCode(code))
  for (const code of weaknesses) api.moveCard({ code, from: 'discard', to: 'deckTop', ownerSeat: seat })
  if (weaknesses.length) api.drawCards(seat, weaknesses.length)
  return discarded
}

export default {
  code: '08695', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyAttacked',
    label: '古老者清道夫攻击后：弃掉牌库顶 3 张并抽取其中的弱点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id
      && Number.isSafeInteger(context?.seat) && context?.attackCancelled !== true,
    resolve: ({ context, api }) => {
      const discarded = discardAndDrawWeaknesses(context.seat, 3, api)
      api.info('「古老者清道夫」：' + (context.seat + 1) + ' 号调查员弃掉牌库顶 ' + discarded.length + ' 张。')
    },
  }],
}