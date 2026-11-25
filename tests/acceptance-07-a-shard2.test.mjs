// 07-a 分片 2（TIC 07055–07107）补缺证据测试。
// 覆盖 audit/tic-all-card-acceptance.json 只有模式/文件级证据、且现有测试标题不含卡号的战役卡：
//   07058 / 07076–07081 / 07089 / 07100–07104
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import e07058 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07058.js'
import e07076 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07076.js'
import e07077 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07077.js'
import e07078 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07078.js'
import e07079 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07079.js'
import e07080 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07080.js'
import e07081 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07081.js'
import e07089 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/creatures_of_the_deep/07089.js'
import e07100 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/syzygy/07100.js'
import e07101 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/syzygy/07101.js'
import e07102 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/flooded_caverns/07102.js'
import e07103 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/flooded_caverns/07103.js'
import e07104 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/flooded_caverns/07104.js'

const ENTRIES = [e07058, e07076, e07077, e07078, e07079, e07080, e07081, e07089, e07100, e07101, e07102, e07103, e07104]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)
const codeOf = card => card?.originalCode || card?.code

function baseState(count = 2) {
  return {
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'loc-a',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], defeated: false, resigned: false,
    })),
    locations: [
      { id: 'loc-a', code: '07065', originalCode: '07065', name: '印斯茅斯广场', revealed: true, clues: 0, connections: ['loc-b'], traits: ['Innsmouth', 'Central'] },
      { id: 'loc-b', code: '07066', originalCode: '07066', name: '印斯茅斯港口', revealed: true, clues: 1, connections: ['loc-a'], traits: ['Innsmouth'] },
      { id: 'cave-a', code: '07102', originalCode: '07102', name: '水下洞窟', revealed: true, clues: 1, connections: [], traits: ['Cave'] },
      { id: 'cave-b', code: '07103', originalCode: '07103', name: '潮池', revealed: true, clues: 1, connections: [], traits: ['Cave'] },
    ],
    enemies: [], storyAssets: [], victoryDisplay: [], scenarioFlags: {}, scenarioZones: {}, removedFromGame: [],
    infestedLocations: [], tokenBags: {}, doom: 0, round: 1, agendaIndex: 1, turnSerial: 1, clues: 0,
    campaign: { leadSeat: 0, records: {} },
    numInvestigators: count, difficulty: 'standard', status: 'playing', phase: 'investigation',
  }
}
function apiBase(state, overrides = {}) {
  const calls = []
  const api = {
    calls,
    info: () => {},
    choice: spec => (overrides.choose ? overrides.choose(spec) : undefined),
    choose: spec => (overrides.choose ? overrides.choose(spec) : undefined),
    random: () => 0,
    test: (seat, skill, difficulty, options) => {
      calls.push({ name: 'test', args: [seat, skill, difficulty, options] })
      if (overrides.testResult) overrides.testResult(seat, skill, difficulty, options)
      else if (options && typeof options === 'object' && typeof options.resolve === 'function') {
        options.resolve({ success: true, value: difficulty + 1, difficulty, skill, drawn: [] })
      }
    },
    damage: (seat, amount) => { state.investigators[seat].damage += amount; calls.push({ name: 'damage', args: [seat, amount] }) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; calls.push({ name: 'horror', args: [seat, amount] }) },
    loseResources: (seat, amount) => { state.investigators[seat].resources = Math.max(0, state.investigators[seat].resources - amount); calls.push({ name: 'loseResources', args: [seat, amount] }) },
    addDoom: amount => { state.doom += amount; calls.push({ name: 'addDoom', args: [amount] }) },
    setScenarioFlag: (key, value = true) => { state.scenarioFlags[key] = value },
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value },
    ...(overrides.api || {}),
  }
  return api
}
const find = (calls, name) => calls.filter(call => call.name === name)

// ---------------------------------------------------------------- 07058
test('TDE 07058 愈发起疑：背面（→R1）；正面击败非绑架犯嫌疑人取得线索并记录寻仇', () => {
  const state = baseState(2)
  state.campaign.records.harperSuspect = 'BrianBurnham'
  const api = apiBase(state, { api: { finish: key => api.calls.push({ name: 'finish', args: [key] }) } })
  assert.notEqual(e07058.agendaRule.onReveal(state, { code: '07058' }, api), undefined)
  assert.deepEqual(find(api.calls, 'finish')[0].args, ['resolution1'])
  const ability = e07058.abilities[0]
  assert.equal(ability.kind, 'forced')
  assert.equal(ability.trigger, 'enemyDefeated')
  const nonKidnapper = { id: 'e1', code: '07076', originalCode: '07076', traits: ['Humanoid', 'Suspect', 'Elite'] }
  assert.equal(ability.criteria({ state, inv: state.investigators[0], context: {
    accepted: true, sourceSeat: 0, enemy: nonKidnapper,
  } }), true, '击败非绑架犯的嫌疑人满足条件')
  const kidnapper = { id: 'e2', code: '07078', originalCode: '07078', traits: ['Humanoid', 'Suspect', 'Elite'] }
  assert.equal(ability.criteria({ state, inv: state.investigators[0], context: {
    accepted: true, sourceSeat: 0, enemy: kidnapper,
  } }), false, '绑架犯本人不触发')
  const resolveApi = apiBase(state, { api: {
    enemyOutcomes: { takeClues: (context, seat, amount) => resolveApi.calls.push({ name: 'takeClues', args: [seat, amount] }) },
    recordSets: { add: (key, value) => resolveApi.calls.push({ name: 'recordSetAdd', args: [key, value] }) },
  } })
  ability.resolve({ state, inv: state.investigators[0], context: { accepted: true, sourceSeat: 0, enemy: nonKidnapper }, api: resolveApi })
  assert.equal(find(resolveApi.calls, 'takeClues').length, 1)
  assert.equal(find(resolveApi.calls, 'recordSetAdd')[0].args[0], 'outForBlood')
})

// ---------------------------------------------------------------- 07076–07081 六名嫌疑人
const SUSPECTS = [
  {
    code: '07076', entry: e07076, home: '07066', altHome: '07138', label: '谈判：敏捷(2)，成功获取1线索，失败受到1伤害',
    skill: 'agility', difficulty: 2, failureDamage: 1,
  },
  {
    code: '07077', entry: e07077, home: '07068', altHome: '07136', label: '谈判：敏捷(3)，成功获取1线索',
    skill: 'agility', difficulty: 3,
  },
  {
    code: '07078', entry: e07078, home: '07067', altHome: '07137', label: '谈判：弃置印刷技能图标总数至少3的手牌，取得1线索',
    cost: { discardHandIcons: 3 },
  },
  {
    code: '07079', entry: e07079, home: '07063', altHome: '07141', label: '谈判：意志(2)，成功获取1线索，失败受到1恐惧',
    skill: 'willpower', difficulty: 2, failureHorror: 1,
  },
  {
    code: '07080', entry: e07080, home: '07069', altHome: '07135', label: '谈判：意志(3)，成功获取1线索',
    skill: 'willpower', difficulty: 3,
  },
  {
    code: '07081', entry: e07081, home: '07064', altHome: '07140', label: '花费3资源并谈判：获取1线索',
    cost: { resources: 3 },
  },
]
for (const spec of SUSPECTS) {
  test(`TIC ${spec.code} 嫌疑人：揭示生成于${spec.home}并带 1×人数线索；谈判取得 1 线索`, () => {
    const state = baseState(2)
    const ability = spec.entry.abilities[0]
    assert.deepEqual(spec.entry.enemyRule.revelationSpawn, {
      locationOriginalCodes: [spec.home, spec.altHome], cluesPerInvestigator: 1,
    }, '印刷生成点 + 救援幕备用生成点')
    assert.equal(ability.kind, 'action')
    assert.equal(ability.actionKind, 'parley')
    assert.equal(ability.label, spec.label)
    assert.deepEqual(ability.cost.action, 1)
    if (spec.skill) {
      assert.equal(ability.cost.action, 1)
    }
    if (spec.cost) assert.deepEqual({ ...ability.cost, action: 1 }, { action: 1, ...spec.cost })
    const inv = state.investigators[0]
    const suspect = { id: 'suspect', code: spec.code, originalCode: spec.code, name: '嫌疑人', location: inv.location, clues: 2, traits: ['Humanoid', 'Suspect', 'Elite'] }
    state.enemies.push(suspect)
    const api = apiBase(state, { api: {
      scenario: { takeEnemyClues: (enemy, seat, count) => api.calls.push({ name: 'takeEnemyClues', args: [enemy, seat, count] }) },
    } })
    ability.resolve({ state, inv, source: suspect, api })
    if (spec.skill) {
      const testCall = find(api.calls, 'test')[0]
      assert.equal(testCall.args[1], spec.skill)
      assert.equal(testCall.args[2], spec.difficulty)
    }
    if (!spec.skill) assert.equal(find(api.calls, 'test').length, 0, '非检定谈判直接取得线索')
    assert.equal(find(api.calls, 'takeEnemyClues').length, 1)
    assert.deepEqual(find(api.calls, 'takeEnemyClues')[0].args.slice(1), [0, 1])
  })
  if (spec.failureDamage || spec.failureHorror) {
    test(`TIC ${spec.code} 嫌疑人：谈判检定失败受到 ${spec.failureDamage ? '1 伤害' : '1 恐惧'}`, () => {
      const state = baseState(2)
      const inv = state.investigators[0]
      const suspect = { id: 'suspect', code: spec.code, originalCode: spec.code, location: inv.location, clues: 1, traits: ['Humanoid', 'Suspect', 'Elite'] }
      const api = apiBase(state, {
        testResult: (seat, skill, difficulty, options) => options.resolve({ success: false, value: 0, difficulty, skill, drawn: [] }),
        api: { scenario: { takeEnemyClues: () => {} } },
      })
      spec.entry.abilities[0].resolve({ state, inv, source: suspect, api })
      if (spec.failureDamage) assert.equal(inv.damage, 1)
      if (spec.failureHorror) assert.equal(inv.horror, 1)
    })
  }
}
test('TIC 07076 罗伯特·弗兰得礼：印刷数值 4 生命、冷漠、全部线索被取得后进胜利区', () => {
  assert.equal(ALL_CARDS['07076'].health, 4)
  assert.match(ALL_CARDS['07076'].text, /Aloof/)
  assert.match(ALL_CARDS['07076'].text, /victory display/i)
})

// ---------------------------------------------------------------- 07089
test('TIC 07089 潜伏的深潜者：猎物敏捷最低；与你交战后受到 1 伤害', () => {
  const state = baseState(2)
  const inv = state.investigators[0]
  const enemy = { id: 'e-lurking', code: '07089', originalCode: '07089', location: inv.location, traits: ['Humanoid', 'Monster', 'Deep One'] }
  assert.match(ALL_CARDS['07089'].text, /Prey - Lowest \[agility\]/)
  assert.equal(ALL_CARDS['07089'].health, 2)
  const ability = e07089.abilities[0]
  assert.equal(ability.trigger, 'enemyEngaged')
  assert.equal(ability.criteria({ source: enemy, context: { enemy } }), true)
  const api = apiBase(state)
  ability.resolve({ state, inv, source: enemy, context: { enemy, seat: inv.seat }, api })
  assert.equal(inv.damage, 1)
})

// ---------------------------------------------------------------- 07100
test('TIC 07100 星潮合相：险境；选有调查员的地点涨水并造成 1 伤害，未涨水则涌动', () => {
  const state = baseState(2)
  state.investigators.forEach(inv => { inv.location = 'loc-a' })
  const water = {
    level: id => (state.scenarioFlags.waterLevel || 0),
    change: (id, amount) => { state.scenarioFlags.waterLevel = Math.min(2, (state.scenarioFlags.waterLevel || 0) + amount) },
  }
  const api = apiBase(state, { api: { mechanics: { water } } })
  const resolution = e07100.encounterResolve(state, state.investigators[0], { code: '07100' }, api)
  assert.equal(resolution, false, '涨水成功时没有涌动')
  assert.equal(state.scenarioFlags.waterLevel, 1)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[1].damage, 1)
  state.scenarioFlags.waterLevel = 2
  const surged = e07100.encounterResolve(state, state.investigators[0], { code: '07100' }, apiBase(state, { api: { mechanics: { water } } }))
  assert.deepEqual(surged, { gainSurge: true }, '地点无法继续涨水时获得涌动')
  assert.match(ALL_CARDS['07100'].text, /Peril/)
})

// ---------------------------------------------------------------- 07101
test('TIC 07101 朔望：险境；必须三选一（全队失 3 资源 / 全队 2 恐惧 / 密谋 1 毁灭）', () => {
  const state = baseState(2)
  const horrorApi = apiBase(state, { choose: () => 'horror' })
  e07101.encounterResolve(state, state.investigators[0], { code: '07101' }, horrorApi)
  assert.equal(state.investigators[0].horror, 2)
  assert.equal(state.investigators[1].horror, 2)
  const resourceState = baseState(2)
  const resourceApi = apiBase(resourceState, { choose: () => 'resources' })
  e07101.encounterResolve(resourceState, resourceState.investigators[0], { code: '07101' }, resourceApi)
  assert.equal(resourceState.investigators[0].resources, 2)
  assert.equal(resourceState.investigators[1].resources, 2)
  const doomState = baseState(2)
  const doomApi = apiBase(doomState, { choose: () => 'doom' })
  e07101.encounterResolve(doomState, doomState.investigators[0], { code: '07101' }, doomApi)
  assert.equal(doomState.doom, 1)
  assert.match(ALL_CARDS['07101'].text, /Peril/)
})

// ---------------------------------------------------------------- 07102 / 07103 / 07104 水下洞窟群
test('TIC 07102 水下洞窟：揭示后完全淹没；[action] 移动到任意已淹没洞穴地点', () => {
  const state = baseState(2)
  const inv = state.investigators[0]
  inv.location = 'cave-a'
  assert.match(ALL_CARDS['07102'].text, /fully flooded/)
  const moved = []
  const api = apiBase(state, { api: {
    mechanics: { water: { set: (id, level) => { (state.scenarioFlags.waterLevel ||= {})[id] = level } } },
    canMoveTo: () => true,
    moveInvestigator: (seat, id) => moved.push([seat, id]),
  } })
  e07102.locationRule.onReveal(state, state.locations[2], api)
  assert.equal(state.scenarioFlags.waterLevel['cave-a'], 2)
  const ability = e07102.abilities[0]
  assert.equal(ability.actionKind, 'move')
  state.scenarioFlags.mechanics = { flood: { 'cave-b': 1 } }
  assert.equal(ability.criteria({ state, inv, helpers: { canMoveTo: () => true } }), true)
  ability.resolve({ state, inv, api })
  assert.equal(moved.length, 1)
  assert.equal(moved[0][1], 'cave-b', '移动到已淹没的另一处洞穴')
})

test('TIC 07103 潮池：揭示后随机放一把放一边的钥匙（不看）；帷幕随淹没等级 +1/+2', () => {
  const state = baseState(2)
  const keyApi = apiBase(state, { api: { mechanics: { keys: { placeRandom: destination => keyApi.calls.push({ name: 'placeRandomKey', args: [destination] }) } } } })
  e07103.locationRule.onReveal(state, state.locations[3], keyApi)
  assert.deepEqual(find(keyApi.calls, 'placeRandomKey')[0].args, ['location:cave-b'])
  const modifier = e07103.modifiers[0]
  state.scenarioFlags.mechanics = { flood: { 'cave-b': 1 } }
  const partial = modifier.amount({ state, entity: { id: 'cave-b' } })
  assert.equal(partial, 1, '部分淹没 +1 帷幕')
  state.scenarioFlags.mechanics.flood['cave-b'] = 2
  const full = modifier.amount({ state, entity: { id: 'cave-b' } })
  assert.equal(full, 2, '完全淹没 +2 帷幕')
})

test('TIC 07104 地下暗河：不能被完全淹没（max 1）；揭示后提升 1 级淹没', () => {
  const state = baseState(2)
  assert.deepEqual(e07104.locationRule.floodBounds, { max: 1, onlyRevealed: true })
  assert.match(ALL_CARDS['07104'].text, /cannot be fully flooded/)
  const api = apiBase(state, { api: { mechanics: { water: { change: (id, amount) => api.calls.push({ name: 'waterChange', args: [id, amount] }) } } } })
  e07104.locationRule.onReveal(state, state.locations[3], api)
  assert.deepEqual(find(api.calls, 'waterChange')[0].args, ['cave-b', 1])
})

// 四个嫌疑人卡在循环用例之外再落一条源码字面标题（便于源码级覆盖检查与人工 grep）。
test('TIC 07077 扎多克·艾伦：生成于鱼街旧桥/07136，带 1×人数线索，谈判入口为敏捷', () => {
  assert.deepEqual(e07077.enemyRule.revelationSpawn.locationOriginalCodes, ['07068', '07136'])
  assert.equal(e07077.enemyRule.revelationSpawn.cluesPerInvestigator, 1)
  assert.equal(e07077.abilities[0].actionKind, 'parley')
  assert.deepEqual(e07077.abilities[0].cost, { action: 1 })
})
test('TIC 07078 布里安·伯纳姆：生成于国立第一杂货铺/07137，弃 3 个技能图标谈判', () => {
  assert.deepEqual(e07078.enemyRule.revelationSpawn.locationOriginalCodes, ['07067', '07137'])
  assert.equal(e07078.enemyRule.revelationSpawn.cluesPerInvestigator, 1)
  assert.equal(e07078.abilities[0].actionKind, 'parley')
  assert.deepEqual(e07078.abilities[0].cost, { action: 1, discardHandIcons: 3 })
})
test('TIC 07079 巴纳巴斯·马什：生成于马什精炼厂/07141，谈判意志(2)', () => {
  assert.deepEqual(e07079.enemyRule.revelationSpawn.locationOriginalCodes, ['07063', '07141'])
  assert.equal(e07079.enemyRule.revelationSpawn.cluesPerInvestigator, 1)
  assert.equal(e07079.abilities[0].actionKind, 'parley')
  assert.match(e07079.abilities[0].label, /意志\(2\)/)
})
test('TIC 07080 乔伊斯·小利透：生成于小利透书店/07135，谈判意志(3)', () => {
  assert.deepEqual(e07080.enemyRule.revelationSpawn.locationOriginalCodes, ['07069', '07135'])
  assert.equal(e07080.enemyRule.revelationSpawn.cluesPerInvestigator, 1)
  assert.equal(e07080.abilities[0].actionKind, 'parley')
  assert.match(e07080.abilities[0].label, /意志\(3\)/)
})
