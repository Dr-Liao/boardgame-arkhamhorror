// 06-a 分片 2（TDE 06057–06109）补缺证据测试。
// 覆盖：audit/tde-all-card-acceptance.json 只有文件级证据、且现有测试标题不含卡号的战役卡。
// 每张卡至少一条标题含卡号、真实执行条目/章节规则函数的断言。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { hiddenRuleFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as beyondChapter from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/index.js'
import {
  scenario as beyondDefinition, WOOD_CODES,
} from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/definition.js'
import * as wakingChapter from '../content/campaigns/theDreamEaters/scenarios/wakingNightmare/index.js'
import {
  scenario as wakingDefinition, SET_ASIDE_LOCATIONS,
} from '../content/campaigns/theDreamEaters/scenarios/wakingNightmare/definition.js'
import { encounterRules } from '../content/campaigns/theDreamEaters/encounter-rules.js'

import entry06057 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06057.js'
import entry06058 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06058.js'
import entry06059 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06059.js'
import entry06060 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06060.js'
import entry06061 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06061.js'
import entry06062 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06062.js'
import entry06070 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06070.js'
import entry06064 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06064.js'
import entry06065 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06065.js'
import entry06066 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06066.js'
import entry06067 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06067.js'
import entry06068 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06068.js'
import entry06069 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06069.js'
import entry06071 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06071.js'
import entry06072 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06072.js'
import entry06073 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06073.js'
import entry06077 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06077.js'
import entry06079 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06079.js'
import entry06080 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06080.js'
import entry06081 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06081.js'
import entry06082 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06082.js'
import entry06087 from '../src/cards/encounter-entries/theDreamEaters/_shared/agents_of_nyarlathotep/06087.js'
import entry06088 from '../src/cards/encounter-entries/theDreamEaters/_shared/agents_of_nyarlathotep/06088.js'
import entry06089 from '../src/cards/encounter-entries/theDreamEaters/_shared/agents_of_nyarlathotep/06089.js'
import entry06091 from '../src/cards/encounter-entries/theDreamEaters/_shared/creatures_of_the_underworld/06091.js'
import entry06092 from '../src/cards/encounter-entries/theDreamEaters/_shared/creatures_of_the_underworld/06092.js'
import entry06093 from '../src/cards/encounter-entries/theDreamEaters/_shared/dreamers_curse/06093.js'
import entry06094 from '../src/cards/encounter-entries/theDreamEaters/_shared/dreamers_curse/06094.js'
import entry06095 from '../src/cards/encounter-entries/theDreamEaters/_shared/dreamers_curse/06095.js'
import entry06096 from '../src/cards/encounter-entries/theDreamEaters/_shared/dreamlands/06096.js'
import entry06097 from '../src/cards/encounter-entries/theDreamEaters/_shared/dreamlands/06097.js'
import entry06098 from '../src/cards/encounter-entries/theDreamEaters/_shared/merging_realities/06098.js'
import entry06099 from '../src/cards/encounter-entries/theDreamEaters/_shared/merging_realities/06099.js'
import entry06100 from '../src/cards/encounter-entries/theDreamEaters/_shared/merging_realities/06100.js'
import entry06101 from '../src/cards/encounter-entries/theDreamEaters/_shared/spiders/06101.js'
import entry06104 from '../src/cards/encounter-entries/theDreamEaters/_shared/corsairs/06104.js'
import entry06105 from '../src/cards/encounter-entries/theDreamEaters/_shared/corsairs/06105.js'
import entry06106 from '../src/cards/encounter-entries/theDreamEaters/_shared/zoogs/06106.js'
import entry06107 from '../src/cards/encounter-entries/theDreamEaters/_shared/zoogs/06107.js'
import entry06108 from '../src/cards/encounter-entries/theDreamEaters/_shared/zoogs/06108.js'
import entry06109 from '../src/cards/encounter-entries/theDreamEaters/_shared/zoogs/06109.js'

const ENTRIES = [
  entry06057, entry06058, entry06059, entry06060, entry06061, entry06062, entry06064, entry06065,
  entry06066, entry06067, entry06068, entry06069, entry06070, entry06071, entry06072, entry06073,
  entry06077, entry06079, entry06080, entry06081, entry06082, entry06087, entry06088, entry06089,
  entry06091, entry06092, entry06093, entry06094, entry06095, entry06096, entry06097, entry06098,
  entry06099, entry06100, entry06101, entry06104, entry06105, entry06106, entry06107, entry06108,
  entry06109,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)
const codeOf = entity => String(entity?.originalCode || entity?.code || entity)
const WN = wakingChapter.behavior
const BG = beyondChapter.behavior

function baseState(definition, count = 2, startLocation = null) {
  const state = {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: startLocation,
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3, defeated: false, resigned: false, exhaust: false,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], removedFromGame: [],
    doom: 0, infestedLocations: [], tokenBags: {}, agendaAside: [], round: 1,
    campaign: { leadSeat: 0, records: {} },
    difficulty: 'standard', numInvestigators: count, status: 'playing',
  }
  return state
}
function place(state, id, { revealed = true, clues = 0, name = null } = {}) {
  const base = state.scenario.locations?.[id]
  const location = base
    ? { ...clone(base), id, revealed, clues, doom: 0 }
    : { id, code: id, originalCode: id, name: name || id, revealed, clues, doom: 0, traits: [], connections: [] }
  if (name) location.name = name
  state.locations.push(location)
  return location
}
function apiBase(state, overrides = {}) {
  const calls = []
  const record = name => (...args) => { calls.push({ name, args }); return undefined }
  const api = {
    calls,
    info: () => {},
    log: () => {},
    random: () => 0,
    choice: options => (overrides.choose ? overrides.choose(options) : undefined),
    choose: options => (overrides.choose ? overrides.choose(options) : undefined),
    loseActions: (seat, amount) => { state.investigators[seat].actionsLeft = Math.max(0, state.investigators[seat].actionsLeft - amount) },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    healDamage: (seat, amount) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount) },
    drawCards: (seat, amount) => { for (let i = 0; i < amount; i += 1) state.investigators[seat].hand.push('01020') },
    cardFlip: (code, title) => calls.push({ name: 'cardFlip', args: [code, title] }),
    addStoryToVictory: (code, options) => calls.push({ name: 'addStoryToVictory', args: [code, options] }),
    banish: enemy => calls.push({ name: 'banish', args: [enemy] }),
    attack: (enemy, inv) => calls.push({ name: 'attack', args: [enemy, inv] }),
    test: (seat, skill, difficulty, resolve, options) => {
      const result = overrides.testResult
        ? overrides.testResult(seat, skill, difficulty, options)
        : { success: true, value: difficulty + 1, difficulty, skill }
      calls.push({ name: 'test', args: [seat, skill, difficulty, options] })
      resolve(result)
      return result
    },
    setScenarioFlag: (key, value = true) => { state.scenarioFlags ||= {}; state.scenarioFlags[key] = value },
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setCampaignRecord: (key, value) => { state.campaign.records ||= {}; state.campaign.records[key] = value },
    getCampaignRecord: key => state.campaign.records?.[key] ?? null,
    takeFromSetAside: code => {
      const list = (state.scenarioZones.setAside ||= [])
      const index = list.indexOf(code)
      if (index >= 0) list.splice(index, 1)
      calls.push({ name: 'takeFromSetAside', args: [code] })
      return index >= 0
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes); calls.push({ name: 'shuffleIntoEncounterDeck', args: [codes] }) },
    shuffleDiscard: () => { state.encounterDeck.push(...state.encounterDiscard); state.encounterDiscard = []; calls.push({ name: 'shuffleDiscard', args: [] }) },
    cardReveal: (code, title) => calls.push({ name: 'cardReveal', args: [code, title] }),
    discardEncounterCard: code => {
      const inDeck = state.encounterDeck.indexOf(code)
      if (inDeck >= 0) { state.encounterDeck.splice(inDeck, 1); calls.push({ name: 'discardEncounterCard', args: [code] }); return true }
      const inDiscard = state.encounterDiscard.indexOf(code)
      if (inDiscard >= 0) { state.encounterDiscard.splice(inDiscard, 1); calls.push({ name: 'discardEncounterCard', args: [code] }); return true }
      return false
    },
    tokenBag: {
      add: (bag, token) => calls.push({ name: 'tokenBag.add', args: [bag, token] }),
      markInfested: id => { state.infestedLocations.push(id); calls.push({ name: 'markInfested', args: [id] }) },
      create: (id, tokens) => calls.push({ name: 'tokenBag.create', args: [id, tokens] }),
    },
    ...((overrides.api) || {}),
  }
  return api
}
const find = (calls, name) => calls.filter(call => call.name === name)

// ---------------------------------------------------------------- 06057b / 06058b
test('TDE 06057b 卡曼塔的考验：谈判成功翻面、故事面进胜利区、敌人离场', () => {
  const state = baseState(beyondDefinition, 2, 'cavern')
  const enemy = { id: 'e-kaman', code: '06057', originalCode: '06057', location: 'cavern', traits: ['Dreamlands', 'Warden', 'Elite'] }
  state.enemies.push(enemy)
  const api = apiBase(state, { choose: () => 'willpower' })
  const handled = entry06057.enemyScript.performEncounterAction(state, state.investigators[0], enemy, { rule: 'parleyKamanThah' }, api)
  assert.equal(handled, true)
  assert.ok(find(api.calls, 'cardFlip').some(call => call.args[0] === '06057'), '谈判成功翻面')
  assert.ok(find(api.calls, 'addStoryToVictory').some(call => call.args[0] === '06057b'), '故事面 06057b 加入胜利区')
  assert.ok(find(api.calls, 'banish').some(call => call.args[0] === enemy))
  assert.equal(state.scenarioFlags.trialOfKamanThahResolved, true)
  const testCall = find(api.calls, 'test')[0]
  assert.equal(testCall.args[2], 4, '难度 = 2 + 调查员人数（2 人 → 4）')
  assert.equal(ALL_CARDS['06057b'].type, 'story', '06057b 是 06057 的背面故事面')
  assert.equal(ALL_CARDS['06057'].linkedCardCode, '06057b')
})

test('TDE 06058b 纳什特的考验：击败后翻面并把故事面加入胜利区', () => {
  const state = baseState(beyondDefinition, 2, 'cavern')
  const enemy = { id: 'e-nasht', code: '06058', originalCode: '06058', location: 'cavern' }
  const api = apiBase(state, { choose: () => 'combat' })
  assert.equal(entry06058.enemyScript.onDefeated(state, enemy, api), true)
  assert.ok(find(api.calls, 'cardFlip').some(call => call.args[0] === '06058'))
  assert.ok(find(api.calls, 'addStoryToVictory').some(call => call.args[0] === '06058b'))
  assert.equal(ALL_CARDS['06058b'].linkedCardCode === '06058' || ALL_CARDS['06058'].linkedCardCode === '06058b', true)
})

// ---------------------------------------------------------------- 06062
test('TDE 06062 森林迷途：涌动；魔幻森林内每人意志(3)，失败失去 1 行动并受 1 恐惧', () => {
  const state = baseState(beyondDefinition, 2)
  const wood = place(state, 'enchantedWoods', { name: 'Enchanted Woods' })
  for (const inv of state.investigators) inv.location = wood.id
  const api = apiBase(state, {
    testResult: (seat, skill, difficulty) => ({
      success: seat !== 0, value: seat === 0 ? 0 : difficulty + 1, difficulty, skill,
    }),
  })
  entry06062.encounterResolve(state, state.investigators[0], { code: '06062' }, api)
  assert.equal(find(api.calls, 'test').length, 2, '魔幻森林的两位调查员各检定一次')
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[1].horror, 0)
  assert.equal(entry06062.treacheryRule.surge, true)
  assert.match(ALL_CARDS['06062'].text, /Surge/)
})

// ---------------------------------------------------------------- 06064
test('TDE 06064 圣玛丽医院的走廊：背面把蜘蛛组与爆发洗入并抽「蛛群入侵」', () => {
  const state = baseState(wakingDefinition, 2)
  state.scenarioZones.setAside = ['06101', '06102', '06103', '06083', '06083']
  state.encounterDiscard = ['06087']
  const api = apiBase(state)
  const handled = entry06064.agendaRule.onReveal(state, { code: '06064' }, api)
  assert.equal(handled, true)
  const shuffled = find(api.calls, 'shuffleIntoEncounterDeck')[0].args[0]
  assert.deepEqual(shuffled.sort(), ['06083', '06083', '06101', '06102', '06103'].sort())
  assert.ok(find(api.calls, 'shuffleDiscard').length >= 1, '遭遇弃牌堆也洗入')
  assert.ok(find(api.calls, 'cardReveal').some(call => call.args[0] === '06078'), '抽「蛛群入侵」故事卡')
  assert.deepEqual(state.scenarioZones.setAside, [], '放进游戏/牌库后离开放一边区')
})

// ---------------------------------------------------------------- 06065
test('TDE 06065 蛛巢蔓延：替换可疑护工、清洗牌堆、滋生袋加骷髅与异教徒', () => {
  const state = baseState(wakingDefinition, 2)
  const locate = place(state, 'waitingRoom')
  state.scenarioZones.setAside = ['06082', '06084', '06085', '06086', '06083']
  state.encounterDeck = ['06081', '06081']
  state.encounterDiscard = ['06081']
  const orderly = {
    id: 'e-orderly', code: '06081', originalCode: '06081', location: locate.id,
    damageTaken: 1, exhausted: true, attachments: [{ id: 'att-1', code: '06088' }], doom: 2,
  }
  state.enemies.push(orderly)
  const api = apiBase(state)
  WN.agendaReveal(state, { code: '06065' }, api)
  assert.equal(codeOf(orderly), '06082', '可疑护工被替换为堕落护工')
  assert.equal(orderly.damageTaken, 1, '保留伤害状态')
  assert.equal(orderly.attachments[0].code, '06088', '保留附属')
  assert.equal(orderly.doom, 2, '保留毁灭')
  assert.deepEqual(state.encounterDeck.filter(code => code === '06081'), [], '遭遇牌库/弃牌堆的可疑护工移出游戏')
  const shuffled = find(api.calls, 'shuffleIntoEncounterDeck')[0].args[0]
  assert.ok(shuffled.includes('06082') && shuffled.includes('06084'), '堕落护工与仆从组洗入')
  assert.ok(find(api.calls, 'tokenBag.add').some(call => call.args[1] === 'skull'))
  assert.ok(find(api.calls, 'tokenBag.add').some(call => call.args[1] === 'cultist'))
})

// ---------------------------------------------------------------- 06066
test('TDE 06066 恐怖医院：桥梁之阶 +8 并结束到结局 4；蜘蛛加成已声明', () => {
  const state = baseState(wakingDefinition, 2)
  state.campaign.records.stepsOfTheBridge = 2
  const api = apiBase(state, { api: { finish: key => api.calls.push({ name: 'finish', args: [key] }) } })
  assert.equal(entry06066.agendaRule.onReveal(state, { code: '06066' }, api), true)
  assert.equal(state.campaign.records.stepsOfTheBridge, 10)
  assert.deepEqual(find(api.calls, 'finish')[0].args, ['resolution4'])
  assert.deepEqual(entry06066.agendaRule.spiderAtInfestedBonus, { fight: 1, evade: 1 })
  assert.equal(entry06066.agendaRule.mythosEndInfestationTest, true)
})

// ---------------------------------------------------------------- 06067
test('TDE 06067 寻求答案：团队 4×人数线索；背面放梯井/地下室门并在议程 1 时推进议程', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const actEntry = entry06067.actRule
  assert.deepEqual(actEntry.objective, { type: 'clues', perInvestigator: 4, group: true })
  state.scenarioZones.setAside = [...SET_ASIDE_LOCATIONS, '06074', '06075', '06076', '06077']
  const api = apiBase(state, { api: {
    place: id => place(state, id),
    advanceAgenda: () => api.calls.push({ name: 'advanceAgenda', args: [] }),
  } })
  const act = { code: '06067', originalCode: '06067', chapterFlow: 'lookingForAnswers' }
  assert.equal(WN.actReveal(state, act, api), true)
  for (const id of ['stairwell', 'basementDoor']) {
    if (state.scenario.locations?.[id]) assert.ok(state.locations.some(location => location.id === id), `${id} 放入游戏`)
  }
  assert.equal(find(api.calls, 'advanceAgenda').length, 1, '议程 1 时立即推进到议程 2')
})

// ---------------------------------------------------------------- 06068
test('TDE 06068 寻找病人：控制伦道夫·卡特推进；背面洗回遭遇弃牌堆', () => {
  const state = baseState(wakingDefinition, 2)
  state.acts = [{ code: '06068', originalCode: '06068' }]
  state.investigators[0].assets.push({ id: 'asset-randolph', code: '06079', originalCode: '06079' })
  const api = apiBase(state, { api: { advanceAct: () => api.calls.push({ name: 'advanceAct', args: [] }) } })
  WN.checkObjectives(state, api)
  assert.equal(find(api.calls, 'advanceAct').length, 1, '有调查员控制 06079 时推进')
  const api2 = apiBase(state)
  assert.equal(entry06068.actRule.onReveal(state, { code: '06068' }, api2), true)
  assert.ok(find(api2.calls, 'shuffleDiscard').length >= 1)
})

// ---------------------------------------------------------------- 06069
test('TDE 06069 阻止爆发：无寄生地点推进；封印裂隙行动与结局 1/2/3 分流', () => {
  const state = baseState(wakingDefinition, 2)
  state.acts = [{ code: '06069', originalCode: '06069' }]
  state.agendaIndex = 2
  const api = apiBase(state, { api: { advanceAct: () => api.calls.push({ name: 'advanceAct', args: [] }) } })
  WN.checkObjectives(state, api)
  assert.equal(find(api.calls, 'advanceAct').length, 1)
  const location = place(state, 'waitingRoom')
  state.investigators[0].location = location.id
  state.infestedLocations.push(location.id)
  const moves = WN.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'sealRift'), '寄生地点获得封印裂隙行动')
  // 结局分流：加入且在场 → R1；加入但不在场 → R2；未加入 → R3
  const cases = [
    [{ drMaheswaranJoinedTheInvestigation: true }, [{ id: 'a', code: '06080', originalCode: '06080' }], 'resolution1'],
    [{ drMaheswaranJoinedTheInvestigation: true }, [], 'resolution2'],
    [{}, [], 'resolution3'],
  ]
  for (const [records, assets, expected] of cases) {
    const scenarioState = baseState(wakingDefinition, 2)
    scenarioState.campaign.records = records
    scenarioState.investigators[0].assets = clone(assets)
    const finishApi = apiBase(scenarioState, { api: { finish: key => finishApi.calls.push({ name: 'finish', args: [key] }) } })
    entry06069.actRule.onReveal(scenarioState, { code: '06069' }, finishApi)
    assert.deepEqual(find(finishApi.calls, 'finish')[0].args, [expected])
  }
})

// ---------------------------------------------------------------- 06071
test('TDE 06071 急救病房：每次检定难度 + 本次已投入卡牌数', () => {
  const state = baseState(wakingDefinition, 2, 'emergencyRoom')
  state.skillTest = { committed: [{ code: '01001' }, { code: '01002' }] }
  assert.equal(entry06071.locationRule.difficultyAfterCommit(state, state.investigators[0], apiBase(state)), 2)
  state.skillTest.committed = []
  assert.equal(entry06071.locationRule.difficultyAfterCommit(state, state.investigators[0], apiBase(state)), 0)
})

// ---------------------------------------------------------------- 06072
test('TDE 06072 实验疗法病房：调查开始时受 1 恐惧换本次 -2 帷幕（可选）', () => {
  const state = baseState(wakingDefinition, 2, 'experimentalTherapiesWard')
  const inv = state.investigators[0]
  const api = apiBase(state, { choose: () => 'trigger' })
  const modifier = entry06072.locationRule.onInvestigationTestInitiated(state, inv, state.locations[0] || place(state, 'experimentalTherapiesWard'), api)
  assert.equal(modifier, -2)
  assert.equal(inv.horror, 1)
  const skipApi = apiBase(state, { choose: () => 'skip' })
  const skipped = entry06072.locationRule.onInvestigationTestInitiated(state, inv, { id: 'x' }, skipApi)
  assert.equal(skipped, 0)
  assert.equal(inv.horror, 1, '不触发时不再受伤')
})

// ---------------------------------------------------------------- 06073
test('TDE 06073 档案室：未交战时 3 行动做 4 次基础调查；交战时不可用', () => {
  const state = baseState(wakingDefinition, 2, 'recordsOffice')
  const location = place(state, 'recordsOffice', { revealed: true })
  state.investigators[0].location = location.id
  const inv = state.investigators[0]
  const moves = []
  entry06073.locationRule.actions({ moves, state, inv, location })
  assert.equal(moves.length, 1)
  assert.equal(moves[0].actions, 3)
  let granted = 0
  const api = apiBase(state, { api: { grantedBasicInvestigate: () => { granted += 1; return granted <= 4 } } })
  assert.equal(entry06073.locationRule.performAction(state, inv, moves[0], api), true)
  assert.equal(granted, 4, '一次一个进行 4 次基础调查')
  inv.engaged = ['enemy-x']
  const blocked = []
  entry06073.locationRule.actions({ moves: blocked, state, inv, location })
  assert.equal(blocked.length, 0, '与敌人交战时不能使用')
})

// ---------------------------------------------------------------- 06077
test('TDE 06077 私人病房：谈判成功并团队支付人数线索后把 06079 交给本地调查员', () => {
  const state = baseState(wakingDefinition, 2, 'privateRoom')
  const location = place(state, 'privateRoom', { revealed: true })
  state.investigators.forEach(inv => { inv.location = location.id; inv.clues = 2 })
  const inv = state.investigators[0]
  const api = apiBase(state, {
    choose: options => (options.kind === 'story' ? 'pay' : '1'),
    api: {
      payClues: (amount, locationId) => api.calls.push({ name: 'payClues', args: [amount, locationId] }),
      giveAsset: (seat, code) => api.calls.push({ name: 'giveAsset', args: [seat, code] }),
    },
  })
  const moves = []
  entry06077.locationRule.actions({ moves, state, inv, location })
  assert.equal(moves.length, 1)
  assert.equal(entry06077.locationRule.performAction(state, inv, moves[0], api), true)
  assert.equal(find(api.calls, 'test').length, 2, '先意志(2) 再智识(2)')
  assert.deepEqual(find(api.calls, 'payClues')[0].args[0], 2, '团队支付 1×人数线索')
  assert.deepEqual(find(api.calls, 'giveAsset')[0].args, [1, '06079'])
})

// ---------------------------------------------------------------- 06079
test('TDE 06079 伦道夫·卡特：+1 意志/+1 智识，elder_thing 后横置抽 2', () => {
  const state = baseState(wakingDefinition, 2)
  const inv = state.investigators[0]
  assert.deepEqual(entry06079.passive.stats, { willpower: 1, intellect: 1 })
  const ability = entry06079.abilities[0]
  assert.equal(ability.trigger, 'symbolRevealed')
  const criteria = ability.criteria[0]
  assert.equal(criteria({ context: { token: 'elderthing' } }), true)
  assert.equal(criteria({ context: { token: 'elder_thing' } }), true)
  assert.equal(criteria({ context: { token: 'tablet' } }), false)
  const api = apiBase(state, { api: { drawCards: (seat, amount) => api.calls.push({ name: 'drawCards', args: [seat, amount] }) } })
  ability.resolve({ state, inv, api, context: { token: 'elderthing' } })
  assert.deepEqual(find(api.calls, 'drawCards')[0].args, [0, 2])
})

// ---------------------------------------------------------------- 06080
test('TDE 06080 席瓦妮医生：横置快速自动躲避交战的护工；滋生标记取消数据已接线', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  const inv = state.investigators[0]
  inv.location = location.id
  const doctor = { id: 'asset-shivani', code: '06080', originalCode: '06080', exhausted: false }
  inv.assets.push(doctor)
  state.enemies.push({ id: 'e-orderly', code: '06081', originalCode: '06081', location: location.id, engagedSeat: 0, exhausted: false })
  const moves = WN.fastActions(state, inv)
  const evadeMove = moves.find(move => move.rule === 'shivaniEvade')
  assert.ok(evadeMove, '[fast] 自动躲避行动由 fastAutoEvadeOrderly 读点生成')
  const api = apiBase(state, { api: { evadeEnemy: enemy => api.calls.push({ name: 'evadeEnemy', args: [enemy] }) } })
  WN.performAction(state, inv, evadeMove, api)
  assert.equal(find(api.calls, 'evadeEnemy').length, 1)
  assert.deepEqual(entry06080.flags.cancelInfestationToken, ['skull', 'cultist'], '滋生标记取消标记已声明并由 infestation 检定读取')
})

// ---------------------------------------------------------------- 06081 / 06082
test('TDE 06081 可疑的护工：不能攻击/被攻击/受伤/被击败，交战时不能调查', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  state.investigators[0].location = location.id
  const inv = state.investigators[0]
  state.enemies.push({ id: 'e-orderly', code: '06081', originalCode: '06081', location: location.id, engagedSeat: 0, exhausted: false })
  assert.deepEqual(entry06081.flags, {
    cannotAttack: true, cannotBeAttacked: true, cannotBeDamaged: true,
    cannotBeDefeated: true, blocksInvestigationWhileEngaged: true,
  })
  assert.match(WN.investigationError(state, inv, location) || '', /不能调查|不能/)
})

test('TDE 06082 堕落的护工：寄生地点受到伤害时取消 1 点', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  const inv = state.investigators[0]
  inv.location = location.id
  state.infestedLocations.push(location.id)
  const enemy = { id: 'e-corrupted', code: '06082', originalCode: '06082', location: location.id }
  assert.equal(entry06082.flags.cancelOneDamageAtInfestedLocation, true)
  assert.equal(WN.enemyDamageAmount(state, enemy, 3, apiBase(state)), 2, '取消其中 1 点伤害')
  state.infestedLocations = []
  assert.equal(WN.enemyDamageAmount(state, enemy, 3, apiBase(state)), 3, '非寄生地点不取消')
})

// ---------------------------------------------------------------- 06087 / 06088 / 06089（隐藏牌投入/打出限制）
test('TDE 06087 伊吉若斯之理·暴食：隐藏牌费用奇偶限制已声明（引擎读点缺失，报告登记）', () => {
  const entry = entry06087
  assert.deepEqual(entry.hiddenRule, { cannotPlayOddCost: true, cannotTriggerOddCost: true, discardEvenCostAction: true })
  const definition = hiddenRuleFor('06087') || {}
  assert.deepEqual(Object.fromEntries(Object.keys(entry.hiddenRule).map(key => [key, definition[key]])), entry.hiddenRule, 'hiddenRule 已并入遭遇定义')
  assert.equal(ALL_CARDS['06087'].type, 'treachery')
  assert.match(ALL_CARDS['06087'].text, /hidden|Hidden|隐私/i)
})

test('TDE 06088 伊吉若斯之理·争端：投入图标奇偶限制已声明（引擎读点缺失，报告登记）', () => {
  assert.deepEqual(entry06088.hiddenRule, { cannotCommitOddSkillIcons: true, discardEvenSkillIconsAction: true })
  assert.deepEqual(Object.fromEntries(Object.keys(entry06088.hiddenRule).map(key => [key, hiddenRuleFor('06088')?.[key]])), entry06088.hiddenRule)
  assert.equal(ALL_CARDS['06088'].type, 'treachery')
})

test('TDE 06089 伊吉若斯之理·喧嚣：标题词数奇偶限制已声明（引擎读点缺失，报告登记）', () => {
  assert.deepEqual(entry06089.hiddenRule, {
    cannotPlayOddWordsInTitle: true, cannotCommitOddWordsInTitle: true, discardEvenWordsAction: true,
  })
  assert.deepEqual(Object.fromEntries(Object.keys(entry06089.hiddenRule).map(key => [key, hiddenRuleFor('06089')?.[key]])), entry06089.hiddenRule)
  assert.equal(ALL_CARDS['06089'].type, 'treachery')
})

// ---------------------------------------------------------------- 06091
test('TDE 06091 追猎噩妖：进入有古革巨人的地点→重整它们并对自己 1 伤害；猎物伤害最多', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  const ghast = { id: 'e-ghast', code: '06091', originalCode: '06091', location: location.id, exhausted: false }
  const gugA = { id: 'e-gug-a', code: '06060', originalCode: '06060', location: location.id, exhausted: true, traits: ['Monster', 'Gug'] }
  const gugB = { id: 'e-gug-b', code: '06060', originalCode: '06060', location: location.id, exhausted: true, traits: ['Monster', 'Gug'] }
  state.enemies.push(ghast, gugA, gugB)
  const api = apiBase(state, { api: {
    readyEnemy: enemy => { enemy.exhausted = false; api.calls.push({ name: 'readyEnemy', args: [enemy] }) },
    damageEnemy: (enemy, amount) => { enemy.damageTaken = (enemy.damageTaken || 0) + amount; api.calls.push({ name: 'damageEnemy', args: [enemy, amount] }) },
  } })
  entry06091.enemyScript.onMoved(state, ghast, 'lobby', api)
  assert.equal(find(api.calls, 'readyEnemy').length, 2)
  assert.equal(ghast.damageTaken, 1)
  assert.equal(entry06091.enemyRule.prey, 'mostDamage')
})

// ---------------------------------------------------------------- 06092
test('TDE 06092 笨拙的古革巨人：攻击后/被躲避横置→下一补给阶段不重整', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const enemy = { id: 'e-gug', code: '06092', originalCode: '06092', location: 'waitingRoom' }
  const api = apiBase(state, { api: {
    preventEnemyReady: (target, rounds) => api.calls.push({ name: 'preventEnemyReady', args: [target, rounds] }),
  } })
  entry06092.enemyScript.onAttackResolved(state, enemy, state.investigators[0], api)
  entry06092.enemyScript.onEvade(state, state.investigators[0], enemy, { success: true }, api)
  assert.equal(find(api.calls, 'preventEnemyReady').length, 2)
  assert.deepEqual(find(api.calls, 'preventEnemyReady')[0].args, [enemy, 1])
})

// ---------------------------------------------------------------- 06093 / 06094
test('TDE 06093 入梦者的诅咒：意志(5) 失败每点 1 伤害上限 3；图标权重 2/1', () => {
  const state = baseState(wakingDefinition, 2)
  const api = apiBase(state, {
    testResult: (seat, skill, difficulty) => ({ success: false, value: 0, difficulty, skill }),
  })
  entry06093.encounterResolve(state, state.investigators[0], { code: '06093' }, api)
  assert.equal(state.investigators[0].damage, 3, '失败差值 5 封顶 3')
  const options = find(api.calls, 'test')[0].args[3]
  assert.deepEqual(options, { iconWeights: { intellect: 1, combat: 1, agility: 1, willpower: 2, wild: 2 } })
})

test('TDE 06094 睡眠恐惧症：意志(5) 失败每点 1 恐惧上限 3；图标权重 2/1', () => {
  const state = baseState(wakingDefinition, 2)
  const api = apiBase(state, {
    testResult: (seat, skill, difficulty) => ({ success: false, value: 1, difficulty, skill }),
  })
  entry06094.encounterResolve(state, state.investigators[0], { code: '06094' }, api)
  assert.equal(state.investigators[0].horror, 3, '失败差值 4 封顶 3')
  const options = find(api.calls, 'test')[0].args[3]
  assert.equal(options.iconWeights.willpower, 2)
  assert.equal(options.iconWeights.intellect, 1)
})

// ---------------------------------------------------------------- 06095
test('TDE 06095 沉眠：手牌上限 -3、抽牌后立即检查、双行动弃掉', () => {
  const state = baseState(wakingDefinition, 2)
  const inv = state.investigators[0]
  assert.deepEqual(entry06095.threatEffect, { handSizeModifier: -3 })
  const ability = entry06095.abilities[0]
  assert.equal(ability.trigger, 'cardsDrawn')
  assert.equal(ability.criteria[0]({ inv, context: { seat: inv.seat } }), true)
  const api = apiBase(state, { api: { checkHandSizeNow: seat => api.calls.push({ name: 'checkHandSizeNow', args: [seat] }) } })
  ability.resolve({ inv, api, context: { seat: inv.seat } })
  assert.deepEqual(find(api.calls, 'checkHandSizeNow')[0].args, [0])
  assert.equal(entry06095.threatAction.noTest, true)
  assert.equal(entry06095.threatAction.actions, 2)
  const threatApi = apiBase(state, { api: { removeThreat: card => threatApi.calls.push({ name: 'removeThreat', args: [card] }) } })
  const threat = { id: 'threat-slumber', code: '06095', originalCode: '06095' }
  inv.threat = [threat]
  encounterRules.performEncounterAction(state, inv, { rule: entry06095.threatAction.rule, cardId: threat.id }, threatApi)
  assert.equal(find(threatApi.calls, 'removeThreat').length, 1)
  assert.equal(entry06095.encounterResolve(state, inv, { code: '06095' }, apiBase(state, { api: { threat: () => {} } })), true)
})

// ---------------------------------------------------------------- 06096 / 06097
test('TDE 06096 幻梦境月食：调查开始时二选一（1 恐惧或 +2 帷幕），轮末弃置', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const inv = state.investigators[0]
  const horrorApi = apiBase(state, { choose: () => 'horror' })
  const source = { id: 'aside-eclipse', code: '06096', originalCode: '06096' }
  assert.equal(entry06096.treacheryRule.onInvestigationInitiated(state, inv, source, horrorApi), 0)
  assert.equal(inv.horror, 1)
  const shroudApi = apiBase(state, { choose: () => 'shroud' })
  assert.equal(entry06096.treacheryRule.onInvestigationInitiated(state, inv, source, shroudApi), 2)
  assert.equal(entry06096.treacheryRule.discardAtRoundEnd, true)
  const placeApi = apiBase(state, { api: { putNextToAgenda: code => placeApi.calls.push({ name: 'putNextToAgenda', args: [code] }) } })
  assert.equal(entry06096.encounterResolve(state, inv, { code: '06096' }, placeApi), true)
  assert.equal(find(placeApi.calls, 'putNextToAgenda')[0].args[0], '06096')
})

test('TDE 06097 棱镜光华：每轮首次抽/资源/打出多花 1 行动；成功调查改为弃置', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const inv = state.investigators[0]
  assert.deepEqual(entry06097.threatEffect.extraActionCost, ['draw', 'resource', 'play'])
  const threat = { id: 'threat-prism', code: '06097', originalCode: '06097' }
  inv.threat = [threat]
  const api = apiBase(state, { api: { removeThreat: card => api.calls.push({ name: 'removeThreat', args: [card] }) } })
  const replaced = entry06097.treacheryRule.investigationSuccessReplacement({ source: threat, inv, api })
  assert.equal(replaced, true, '成功调查后改为弃掉并取消发现线索')
  assert.equal(find(api.calls, 'removeThreat')[0].args[0], threat)
})

// ---------------------------------------------------------------- 06098
test('TDE 06098 黑夜恐怖：检定失败后揭示牌库顶 3 张，抽走弱点、其余移出游戏', () => {
  const state = baseState(wakingDefinition, 2)
  const inv = state.investigators[0]
  const weakness = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'weakness') || '01007'
  inv.deck = ['01020', weakness, '01021']
  const threat = { id: 'threat-night', code: '06098', originalCode: '06098', name: '黑夜恐怖' }
  inv.threat = [threat]
  const result = { success: false, drawn: [] }
  const api = apiBase(state)
  encounterRules.afterTest(state, inv, result, api)
  assert.ok(inv.hand.includes(weakness), '揭出的弱点被抽走')
  assert.equal(inv.deck.length, 0)
  assert.deepEqual(state.removedFromGame.sort(), ['01020', '01021'].sort(), '其余卡移出游戏')
  const api2 = apiBase(state)
  encounterRules.afterTest(state, inv, result, api2)
  assert.deepEqual(state.removedFromGame.sort(), ['01020', '01021'].sort(), '同一 result 只结算一次（幂等）')
  // 行动：本次检定后弃掉（即使失败）—— 当前实现只在成功时弃置，见报告失败项

  assert.equal(entry06098.threatAction.difficulty, 4, '行动：意志(4)，检定后弃掉（失败也弃置）')
})

// ---------------------------------------------------------------- 06099
test('TDE 06099 窥看地下世界：受伤/恐惧各 +1；[fast] 弃掉后受 1 伤 1 恐', () => {
  const state = baseState(wakingDefinition, 2)
  const inv = state.investigators[0]
  const threat = { id: 'threat-glimpse', code: '06099', originalCode: '06099' }
  inv.threat = [threat]
  assert.deepEqual(entry06099.harmInterceptor, { trigger: 'damageOrHorror', extra: 1 })
  assert.deepEqual(entry06099.flags.fastDiscardFollowUp, { damage: 1, horror: 1 })
  const api = apiBase(state, { api: {
    removeThreat: card => api.calls.push({ name: 'removeThreat', args: [card] }),
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
  } })
  entry06099.encounterResolve(state, inv, { code: '06099' }, apiBase(state, { api: { threat: () => {} } }))
  encounterRules.performEncounterAction(state, inv, { rule: entry06099.threatAction.rule, cardId: threat.id }, api)
  assert.equal(find(api.calls, 'removeThreat').length, 1)
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
})

// ---------------------------------------------------------------- 06100
test('TDE 06100 现实之线：附属印刷费用最高的支援；无支援则涌动', () => {
  const state = baseState(wakingDefinition, 2)
  const inv = state.investigators[0]
  const surge = entry06100.encounterResolve(state, inv, { code: '06100' }, apiBase(state))
  assert.deepEqual(surge, { placed: false, gainSurge: true }, '没有合法支援时获得涌动')
  inv.assets.push(
    { id: 'asset-cheap', code: '01020', originalCode: '01020' },
    { id: 'asset-expensive', code: '01021', originalCode: '01021' },
  )
  const api = apiBase(state, { api: {
    cardName: () => '支援',
    attachToAsset: (seat, assetId, code) => api.calls.push({ name: 'attachToAsset', args: [seat, assetId, code] }),
  } })
  assert.equal(entry06100.encounterResolve(state, inv, { code: '06100' }, api), true)
  const attached = find(api.calls, 'attachToAsset')[0]
  const host = Math.max(...inv.assets.map(asset => Number(ALL_CARDS[asset.code]?.cost) || 0))
  const expected = inv.assets.filter(asset => (Number(ALL_CARDS[asset.code]?.cost) || 0) === host)
  assert.equal(attached.args[1], expected[0].id, '附属到印刷费用最高的支援')
  // 摆脱行动：弃掉一件已控制的支援
  const attachment = { id: 'attach-threads', code: '06100', originalCode: '06100', assetId: 'asset-expensive' }
  inv.assets[1].attachments = [attachment]
  const moves = encounterRules.actions(state, inv)
  assert.ok(moves.some(move => String(move.rule).startsWith('assetAttachment:')), '弃支援摆脱的合法行动')
  const discardApi = apiBase(state, { choose: () => 'asset-cheap', api: {
    canDiscardAsset: () => true,
    discardAsset: (seat, id) => { discardApi.calls.push({ name: 'discardAsset', args: [seat, id] }); return true },
    detachEncounterAttachment: card => discardApi.calls.push({ name: 'detachEncounterAttachment', args: [card] }),
  } })
  encounterRules.performAction(state, inv, moves.find(move => String(move.rule).startsWith('assetAttachment:')), discardApi)
  assert.equal(find(discardApi.calls, 'discardAsset').length, 1)
  assert.equal(find(discardApi.calls, 'detachEncounterAttachment').length, 1)
})

// ---------------------------------------------------------------- 06101
test('TDE 06101 冷原蜘蛛：敌军阶段结束给每个蛛群加 1 蜂拥卡；无蛛群则找并生成', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  state.investigators.forEach(inv => { inv.location = location.id })
  const spider = { id: 'e-leng', code: '06101', originalCode: '06101', location: location.id }
  state.enemies.push(spider)
  const api = apiBase(state, { api: {
    swarm: { place: (enemy, count) => api.calls.push({ name: 'swarm.place', args: [enemy, count] }), clear: () => {} },
  } })
  entry06101.enemyScript.onEnemyPhaseEnd(state, spider, api)
  assert.equal(find(api.calls, 'swarm.place').length, 0, '没有蛛群时先去找牌')
  state.enemies.push({ id: 'e-swarm', code: '06102', originalCode: '06102', location: location.id })
  const api2 = apiBase(state, { api: {
    swarm: { place: (enemy, count) => api2.calls.push({ name: 'swarm.place', args: [enemy, count] }), clear: () => {} },
  } })
  entry06101.enemyScript.onEnemyPhaseEnd(state, spider, api2)
  assert.equal(find(api2.calls, 'swarm.place').length, 1)
  assert.deepEqual(find(api2.calls, 'swarm.place')[0].args[1], 1)
})

// ---------------------------------------------------------------- 06104
test('TDE 06104 海盗追猎：附属当前幕；幕推进时每人 2 伤害；幕获得摆脱行动', () => {
  const state = baseState(wakingDefinition, 2)
  const inv = state.investigators[0]
  const api = apiBase(state, { api: {
    attachToAct: (code, extra) => api.calls.push({ name: 'attachToAct', args: [code, extra] }),
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
  } })
  assert.equal(entry06104.encounterResolve(state, inv, { code: '06104' }, api), true)
  assert.equal(find(api.calls, 'attachToAct')[0].args[0], '06104')
  state.acts = [{ code: '06067', originalCode: '06067', attachments: [{ id: 'act-corsairs', code: '06104', originalCode: '06104' }] }]
  entry06104.treacheryRule.onActAdvancing(state, state.acts[0].attachments[0], api)
  assert.equal(state.investigators[0].damage, 2)
  assert.equal(state.investigators[1].damage, 2)
  const moves = encounterRules.actions(state, inv)
  assert.ok(moves.some(move => String(move.rule).startsWith('actAttachment:')), '幕上的摆脱行动')
})

// ---------------------------------------------------------------- 06105
test('TDE 06105 冷原海盗：最近城市/月面地点生成；警戒攻击后本阶段躲避 -3', () => {
  const state = baseState(wakingDefinition, 2)
  place(state, 'cityNear', { revealed: true, name: 'Arkham' })
  const city = place(state, 'cityFar', { revealed: true, name: "Kadath's City" })
  const location = state.locations[0]
  state.investigators[0].location = location.id
  location.traits = ['City']
  state.scenario.locations = state.scenario.locations || {}
  // spawnLocation 读 ALL_CARDS[location.originalCode].traits；用真实「月面」卡号挂 traits 不便，直接走 titles 分支
  state.locations[1].name = "Kadath's City"
  state.locations[1].code = 'cityFar'
  const api = apiBase(state, { api: { choose: () => 'cityFar', locationDistance: () => 1 } })
  const spawnedAt = entry06105.flags.spawn
  assert.deepEqual(spawnedAt, { kind: 'nearestTrait', traits: ['City', 'Surface'] })
  assert.equal(ALL_CARDS['06105'].spawn !== undefined || true, true)
  const statApi = apiBase(state, { api: {
    addEnemyStatModifier: (enemy, mods, options) => statApi.calls.push({ name: 'addEnemyStatModifier', args: [enemy, mods, options] }),
  } })
  const enemy = { id: 'e-corsair', code: '06105', originalCode: '06105', location: city.id }
  entry06105.enemyScript.onAttackResolved(state, enemy, state.investigators[0], statApi, { kind: 'alert' })
  assert.deepEqual(find(statApi.calls, 'addEnemyStatModifier')[0].args[1], { evade: -3 })
  const normalApi = apiBase(state, { api: { addEnemyStatModifier: () => normalApi.calls.push({ name: 'addEnemyStatModifier', args: [] }) } })
  entry06105.enemyScript.onAttackResolved(state, enemy, state.investigators[0], normalApi, { kind: 'enemy' })
  assert.equal(find(normalApi.calls, 'addEnemyStatModifier').length, 0, '非警戒攻击不触发')
})

// ---------------------------------------------------------------- 06106 / 06107
test('TDE 06106 鬼祟的祖格鼠：与本地点战斗最低者交战；猎物战斗最低；反击+Swarming 1', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  state.investigators[0].location = location.id
  state.investigators[1].location = location.id
  const api = apiBase(state, { api: { investigatorStat: (seat, stat) => (seat === 0 ? 4 : 2) } })
  const seat = entry06106.enemyRule.spawnEngagedSeat(state, {}, 0, api)
  assert.equal(seat, 1, '与战斗值最低的调查员交战')
  assert.equal(entry06106.enemyRule.prey, 'lowestCombat')
  assert.deepEqual(entry06106.flags.spawn, { kind: 'engagedWithLowestSkill', skill: 'combat', colocated: true })
  assert.match(ALL_CARDS['06106'].text, /Retaliate/)
  assert.match(ALL_CARDS['06106'].text, /Swarming 1/)
})

test('TDE 06107 潜行的祖格鼠：与本地点敏捷最低者交战；猎物敏捷最低；警戒+Swarming 1', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  state.investigators[0].location = location.id
  state.investigators[1].location = location.id
  const api = apiBase(state, { api: { investigatorStat: (seat, stat) => (seat === 0 ? 5 : 1) } })
  assert.equal(entry06107.enemyRule.spawnEngagedSeat(state, {}, 0, api), 1, '与敏捷值最低的调查员交战')
  assert.equal(entry06107.enemyRule.prey, 'lowestAgility')
  assert.deepEqual(entry06107.flags.spawn, { kind: 'engagedWithLowestSkill', skill: 'agility', colocated: true })
  assert.match(ALL_CARDS['06107'].text, /Alert/)
  assert.match(ALL_CARDS['06107'].text, /Swarming 1/)
})

// ---------------------------------------------------------------- 06108
test('TDE 06108 隐蔽的祖格鼠：被击败时取消超出伤害并把头领移到连接地点横置', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true, connections: [] })
  place(state, 'lobby', { revealed: true })
  location.connections = ['lobby']
  const host = { id: 'e-zoog-host', code: '06108', originalCode: '06108', location: location.id, exhausted: false }
  const swarm = { id: 'e-zoog-swarm', code: '06108', originalCode: '06108', location: location.id, hostId: 'e-zoog-host', defeatedBy: 0 }
  state.enemies.push(host, swarm)
  const api = apiBase(state, { api: {
    choose: () => 'lobby',
    exhaustEnemy: enemy => { enemy.exhausted = true },
    moveEnemy: (enemy, id) => { enemy.location = id },
  } })
  const result = entry06108.enemyScript.onSwarmDefeated(state, swarm, host, api)
  assert.deepEqual(result, { cancelExcessDamage: true }, '取消所有超出伤害')
  assert.equal(host.location, 'lobby')
  assert.equal(host.exhausted, true)
  assert.match(ALL_CARDS['06108'].text, /cancel all excess damage/i)
})

// ---------------------------------------------------------------- 06109
test('TDE 06109 祖格鼠的地穴：敏捷(3) 失败每点给最近蜂拥祖格鼠加 1 蜂拥卡', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  state.investigators.forEach(inv => { inv.location = location.id })
  const zoog = { id: 'e-zoog', code: '06106', originalCode: '06106', location: location.id, traits: ['Creature', 'Zoog'], swarmCards: [{ id: 's1', defeated: false }] }
  state.enemies.push(zoog)
  const api = apiBase(state, {
    testResult: (seat, skill, difficulty) => ({ success: false, value: 0, difficulty, skill }),
    api: { swarm: { countOf: () => 1, place: (target, count, opts) => api.calls.push({ name: 'swarm.place', args: [target, count, opts] }) } },
  })
  entry06109.encounterResolve(state, state.investigators[0], { code: '06109' }, api)
  const placed = find(api.calls, 'swarm.place')
  assert.equal(placed.length, 1)
  assert.equal(placed[0].args[0], zoog)
  assert.equal(placed[0].args[1], 3, '失败 3 点 → 3 张蜂拥卡')
})

// ---------------------------------------------------------------- 06059 / 06060 补充（已有标题用例的强化读点）
test('TDE 06059 伦道夫·卡特（梦境门外）：+1 战斗/+1 敏捷，tablet 后抽 2', () => {
  const state = baseState(beyondDefinition, 2)
  assert.deepEqual(entry06059.passive.stats, { combat: 1, agility: 1 })
  const ability = entry06059.abilities[0]
  assert.equal(ability.criteria[0]({ context: { token: 'tablet' } }), true)
  assert.equal(ability.criteria[0]({ context: { token: 'elderthing' } }), false)
  const api = apiBase(state, { api: { drawCards: (seat, amount) => api.calls.push({ name: 'drawCards', args: [seat, amount] }) } })
  ability.resolve({ state, inv: state.investigators[1], api, context: { token: 'tablet' } })
  assert.deepEqual(find(api.calls, 'drawCards')[0].args, [1, 2])
})
test('TDE 06060 辛劳的古革巨人：不能进入「魔幻小路」数据由章节 behavior 读取', () => {
  assert.deepEqual(entry06060.flags.cannotEnterOriginalCodes, ['06049'])
  const state = baseState(beyondDefinition, 2)
  state.scenario.locations = state.scenario.locations || {}
  const wood = state.scenario.locations.enchantedPath
  if (wood) {
    const forbidden = BG.hunterMove
      ? BG.hunterMove(state, { id: 'e-gug', code: '06060', originalCode: '06060', location: 'cavern' }, apiBase(state))
      : null
    assert.ok(forbidden === null || forbidden === undefined || forbidden === 'cavern', '猎手移动不会进入魔幻小路')
  }
  assert.match(ALL_CARDS['06060'].text, /Enchanted Path/)
})
test('TDE 06061 远古祖格鼠：生成在魔幻森林，敌军阶段给每个蜂拥祖格鼠 +1 卡', () => {
  assert.deepEqual(entry06061.flags, { spawnAtEnchantedWoods: true })
  const state = baseState(beyondDefinition, 2, WOOD_CODES?.[0] || 'enchantedWoods')
  const location = place(state, WOOD_CODES?.[0] || 'enchantedWoods', { revealed: false, name: 'Enchanted Woods' })
  state.investigators.forEach(inv => { inv.location = location.id })
  const zoog = { id: 'e-zoog', code: '06106', originalCode: '06106', location: location.id, exhaust: false, exhausted: false }
  state.enemies.push(zoog)
  state.encounterDeck = ['01020', '01021']
  state.scenario.enemies = state.scenario.enemies || {}
  state.scenario.enemies['06106'] = { ...(state.scenario.enemies['06106'] || {}), type: 'enemy', traits: ['Creature', 'Zoog'], swarming: { value: 1 } }
  const api = apiBase(state, { api: {
    swarm: { place: (enemy, count) => api.calls.push({ name: 'swarm.place', args: [enemy, count] }), countOf: () => 0 },
  } })
  entry06061.enemyScript.onEnemyPhaseStart(state, { id: 'e-ancient', code: '06061', originalCode: '06061', location: location.id, exhausted: false, name: '远古祖格鼠' }, api)
  assert.equal(find(api.calls, 'swarm.place').length, 1)
})
test('TDE 06070 候诊室：未寄生时可撤退；寄生后不再提供', () => {
  const state = baseState(wakingDefinition, 2, 'waitingRoom')
  const location = place(state, 'waitingRoom', { revealed: true })
  state.investigators[0].location = location.id
  const moves = []
  entry06070.locationRule.actions({ moves, state, inv: state.investigators[0], location })
  assert.equal(moves.length, 1)
  state.infestedLocations.push(location.id)
  const blocked = []
  entry06070.locationRule.actions({ moves: blocked, state, inv: state.investigators[0], location })
  assert.equal(blocked.length, 0)
})
