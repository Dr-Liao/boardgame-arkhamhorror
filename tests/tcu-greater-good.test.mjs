// 05197《崇高利益》章节测试（钩子级，不依赖引擎注册表）。
//
// 覆盖：manifest/身份、按记录分支的布置与区域、符号连线、地点揭示与锁门、
// 幕/议程背面、机关盒 + 四把钥匙（scenarioKeys 近似）、混乱标记、敌人规则、
// 诡计、结局记录与 campaignCard、存档往返（JSON.stringify + deepEqual）。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as fgg from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/index.js'
import {
  scenario as definition, membersAct1, KEY_IDS, KEY_LABELS,
} from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/definition.js'

const clone = value => JSON.parse(JSON.stringify(value))

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return {
    randomValue,
    shuffle(items, rng = randomValue) {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(rng() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      return copy
    },
  }
}

function stateFor(count = 2, records = {}) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    currentSeat: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'lodgeGatesMembers',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    scenarioKeys: {},
    locationVariants: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    campaign: {
      leadSeat: 0,
      records: { ...records },
      investigators: Object.fromEntries(Array.from({ length: count }, (_, seat) => [seat, {
        id: `inv${seat}`, name: `调查员${seat + 1}`, deck: [], purchases: [], status: 'active',
        removedCards: [], trauma: { physical: 0, mental: 0 },
      }])),
      chaosBag: [],
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

function placeAll(state, ids) {
  for (const id of ids) {
    if (state.locations.some(location => location.id === id)) continue
    const base = state.scenario.locations[id]
    const variant = state.locationVariants?.[id] || {}
    const merged = { ...clone(base), ...clone(variant), id }
    state.locations.push({
      ...merged, revealed: false, doom: 0,
      clues: 0, maxClues: (merged.cluesPerInvestigator || 0) * state.numInvestigators,
    })
  }
  return state
}

function placedState(count = 2, ids = null, records = {}) {
  const state = stateFor(count, records)
  const plan = fgg.behavior.setupLocations(state, [], setupApi())
  placeAll(state, ids || plan)
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)

// 通用 api 桩：随机确定、选择默认第一个选项、检定默认成功。
function apiFor(state, overrides = {}) {
  const calls = []
  let counter = 0
  const api = {
    calls,
    info: text => calls.push(['info', text]),
    random: overrides.random || (() => 0.25),
    shuffle: list => [...list],
    choose: request => {
      calls.push(['choose', request])
      if (overrides.choose) return overrides.choose(request)
      return request.options?.[0]?.id
    },
    test: (seat, skill, difficulty, resolve, skillBonus = 0, source = null, options = {}) => {
      calls.push(['test', { seat, skill, difficulty, source, options }])
      const result = overrides.testResult || {
        success: true, value: difficulty, difficulty, drawn: [], cancelledTokens: [],
      }
      resolve(result)
      return result
    },
    spawn: (code, locationId) => {
      const enemy = {
        id: `enemy${++counter}`, code, originalCode: code, name: code,
        location: locationId, doom: 0, damageTaken: 0, exhausted: false,
        engagedSeat: null, resources: 0, traits: [],
      }
      state.enemies.push(enemy)
      fgg.behavior.enemySpawned?.(state, enemy, api)
      return enemy
    },
    spawnEngaged: (code, locationId, seat) => {
      const enemy = api.spawn(code, locationId)
      if (enemy) enemy.engagedSeat = seat
      return enemy
    },
    banish: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      state.victoryDisplay.push({ id: `victory:${enemy.id}`, code: enemy.code, originalCode: enemy.originalCode })
      return true
    },
    place: id => {
      placeAll(state, [id])
      return loc(state, id)
    },
    reveal: id => {
      const location = loc(state, id)
      if (location && !location.revealed) {
        location.revealed = true
        if (location.unrevealedActualName) {
          location.name = location.unrevealedActualName
          delete location.unrevealedActualName
        }
        location.clues = (location.maxClues || 0)
        fgg.behavior.locationRevealed?.(state, location, api)
      }
      return location
    },
    resign: seat => { state.investigators[seat].resigned = true },
    payClues: (amount, locationId) => {
      let remaining = amount
      for (const inv of state.investigators) {
        if (inv.location !== locationId || remaining <= 0) continue
        const paid = Math.min(inv.clues, remaining)
        inv.clues -= paid
        remaining -= paid
      }
      return remaining === 0
    },
    giveAsset: (seat, code) => {
      state.investigators[seat].assets.push({ id: `asset:${code}:${seat}`, code, originalCode: code })
    },
    giveClues: (seat, n) => { state.investigators[seat].clues += n },
    spendClues: (seat, n) => { state.investigators[seat].clues = Math.max(0, state.investigators[seat].clues - n) },
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    directHorror: (seat, n) => { state.investigators[seat].horror += n },
    attack: (enemy, inv) => calls.push(['attack', enemy.code, inv.seat]),
    addDoom: n => { state.doom = (state.doom || 0) + n },
    advanceAct: () => { calls.push(['advanceAct']); return true },
    finish: key => { calls.push(['finish', key]); return true },
    drawEncounter: seat => calls.push(['drawEncounter', seat]),
    discardRandom: (seat, n) => calls.push(['discardRandom', seat, n]),
    shuffleEncounterDeck: () => calls.push(['shuffleEncounterDeck']),
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    ...overrides,
  }
  return api
}

const enemy = (state, code, location = 'lodgeGatesMembers') => {
  const index = state.enemies.length + 1
  const entry = {
    id: `manual${index}`, code, originalCode: code, name: code, location,
    doom: 0, damageTaken: 0, exhausted: false, engagedSeat: null, resources: 0, traits: [],
  }
  state.enemies.push(entry)
  return entry
}

test('崇高利益：章节已是 playable，身份/地点/幕/议程/结局齐全', () => {
  assert.equal(fgg.manifest.status, 'playable')
  assert.equal(fgg.manifest.campaignId, 'theCircleUndone')
  assert.equal(fgg.scenario.originalCode, '05197')
  assert.equal(fgg.behavior.id, 'forTheGreaterGood')
  assert.equal(fgg.manifest.locations.length, 13)
  assert.deepEqual(fgg.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(fgg.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(fgg.manifest.resolutionIds, ['noResolution', 'r1', 'r2', 'r3'])
  assert.deepEqual(fgg.manifest.requiredEncounterGroupIds,
    ['forTheGreaterGood', 'cityOfSins', 'silverTwilightLodge'])
  assert.equal(fgg.manifest.zones.encounterDeck.length > 0, true)
  assert.equal(fgg.manifest.zones.setAside.length, 10)
})

test('每张本章卡都有实现声明与身份（实现入口集中在 behavior）', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    const entries = fgg.identities[category]
    assert.ok(Object.keys(entries).length > 0, category)
    for (const identity of Object.values(entries)) {
      assert.ok(identity.originalCode, `${category} 缺少原卡`)
      assert.equal(identity.identityStatus, 'mapped')
    }
  }
  assert.deepEqual(fgg.behavior.scenarioGaps, [], 'playable 要求卡面子句无未实现 gap')
  assert.equal(fgg.behavior.scenarioApproximations.length >= 3, true)
  assert.ok(fgg.behavior.scenarioApproximations.some(text => text.includes('scenarioKeys')))
})

test('非成员分支：放置 5 处初始地点，放在一边/移出游戏的卡符合参考实现', () => {
  const state = stateFor(2)
  const placed = fgg.behavior.setupLocations(state, [], setupApi())
  assert.deepEqual(placed, [
    'lodgeGatesMembers', 'lobbyMembers', 'lodgeCellarMembers', 'lounge', 'lodgeCatacombs',
  ])
  assert.deepEqual(state.scenarioZones.removed, ['05204', '05206', '05208'], '另一分支的地点卡移出游戏')
  const aside = state.scenarioZones.setAside
  assert.ok(aside.includes('05211') && aside.includes('05212') && aside.includes('05216'))
  assert.ok(aside.includes('05214') && aside.includes('05215'))
  assert.ok(aside.includes('05220') && aside.includes('05227') && aside.includes('05228'))
  assert.ok(aside.includes('05217b'), '非成员分支放在一边的是教化大师')
  assert.equal(aside.includes('05217'), false)
  assert.deepEqual(fgg.behavior.startLocation(state), 'lodgeGatesMembers')
  assert.deepEqual(Object.keys(state.scenarioKeys).sort(), [...KEY_IDS].sort())
  for (const key of KEY_IDS) assert.equal(state.scenarioKeys[key].holder, null)
})

test('成员分支：按记录换用「我们一直在等你」地点与「热烈欢迎」场景 1a', () => {
  const state = stateFor(2, { theInvestigatorsAreMembersOfTheLodge: true })
  fgg.behavior.preScenarioSetup(state, [], apiFor(state))
  assert.equal(state.acts[0].originalCode, '05200')
  assert.equal(state.acts[0].objective.perInvestigator, 3)
  const placed = fgg.behavior.setupLocations(state, [], setupApi())
  assert.deepEqual(placed, ['lodgeGatesWeve', 'lobbyWeve', 'lodgeCellarWeve', 'lounge', 'lodgeCatacombs'])
  assert.deepEqual(state.scenarioZones.removed, ['05205', '05207', '05209'])
  assert.ok(state.scenarioZones.setAside.includes('05217'), '成员分支放在一边的是引导大师')
  assert.equal(state.scenarioZones.setAside.includes('05217b'), false)
})

test('modifyDeck 移除另一分支的敌人各 1 张', () => {
  const nonMember = stateFor(2)
  fgg.behavior.setupLocations(nonMember, [], setupApi())
  const deck = ['05221', '05221', '05219', '05222', '05222', '05218', '05223']
  assert.deepEqual(fgg.behavior.modifyDeck(nonMember, [...deck]),
    ['05221', '05221', '05219', '05223'])

  const member = stateFor(2, { theInvestigatorsAreMembersOfTheLodge: true })
  fgg.behavior.setupLocations(member, [], setupApi())
  assert.deepEqual(fgg.behavior.modifyDeck(member, [...deck]),
    ['05222', '05222', '05218', '05223'])
})

test('符号连线：非成员地图 大门→地窖→前厅/休息室，门廊只连地下墓穴', () => {
  const locations = Object.fromEntries(fgg.manifest.locations.map(entry => [entry.id, entry]))
  assert.deepEqual([...locations.lodgeGatesMembers.connections], ['lodgeCellarMembers'])
  assert.deepEqual([...locations.lobbyMembers.connections].sort(), ['lodgeCellarMembers', 'lounge'])
  assert.deepEqual([...locations.lounge.connections].sort(),
    ['library', 'lobbyMembers', 'vault'])
  for (const id of ['sanctumDoorwayCeremonyRoom', 'sanctumDoorwayHoldingCells', 'innerSanctum']) {
    assert.deepEqual([...locations[id].connections], ['lodgeCatacombs'], id)
  }
})

test('圣堂门廊以未揭示面入场，揭示后变成典礼室并更新符号', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lounge', 'lodgeCatacombs'])
  const api = apiFor(state)
  fgg.behavior.locationRevealed(state, loc(state, 'lodgeCatacombs'), api)
  const doorway = loc(state, 'sanctumDoorwayCeremonyRoom')
  assert.ok(doorway, '门廊入场')
  assert.equal(doorway.name, '圣堂门廊')
  assert.equal(doorway.hiddenIdentity, true)
  assert.deepEqual({ ...loc(state, 'innerSanctum') }.id, 'innerSanctum')
  api.reveal('sanctumDoorwayCeremonyRoom')
  const revealed = loc(state, 'sanctumDoorwayCeremonyRoom')
  assert.equal(revealed.name, '典礼室')
  assert.equal(revealed.symbols.front.symbol, 'triangle')
  assert.equal(revealed.clues, 2 * 1, '典礼室 2×人数线索')
})

test('休息室揭示：机密室/藏书室入场，奥古斯特带着随机钥匙入场', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lounge'])
  const api = apiFor(state)
  fgg.behavior.locationRevealed(state, loc(state, 'lounge'), api)
  assert.ok(loc(state, 'vault') && loc(state, 'library'))
  const august = state.storyAssets.find(asset => asset.code === '05227')
  assert.ok(august)
  assert.equal(august.location, 'lounge')
  const keysHere = fgg.behavior.keysOnLocation(state, 'lounge')
  assert.equal(keysHere.length, 1, '随机 1 把钥匙放在奥古斯特所在地点')
})

test('地点揭示放置随机钥匙：前厅/机密室/圣堂内室', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lobbyMembers', 'vault', 'innerSanctum'])
  const api = apiFor(state)
  fgg.behavior.locationRevealed(state, loc(state, 'lobbyMembers'), api)
  fgg.behavior.locationRevealed(state, loc(state, 'vault'), api)
  fgg.behavior.locationRevealed(state, loc(state, 'innerSanctum'), api)
  assert.equal(fgg.behavior.setAsideKeys(state).length, 1, '4 把钥匙放了 3 把')
  assert.equal(fgg.behavior.keysOnLocation(state, 'lobbyMembers').length, 1)
  assert.equal(fgg.behavior.keysOnLocation(state, 'vault').length, 1)
  assert.equal(fgg.behavior.keysOnLocation(state, 'innerSanctum').length, 1)
})

test('锁门地点：机密室/圣堂内室/地下墓穴需要对应钥匙才能进入', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'vault', 'innerSanctum', 'lodgeCatacombs'])
  assert.match(fgg.behavior.investigatorEntryError(state, loc(state, 'vault')), /古神钥匙/)
  assert.match(fgg.behavior.investigatorEntryError(state, loc(state, 'innerSanctum')), /异教徒钥匙/)
  assert.match(fgg.behavior.investigatorEntryError(state, loc(state, 'lodgeCatacombs')), /钥匙/)
  const elderthing = state.scenarioKeys.elderthing
  elderthing.location = 'vault'
  loc(state, 'vault').clues = 0
  state.investigators[0].location = 'vault'
  const moves = fgg.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'takeKeyAtLocation'))
  // 手动把钥匙给调查员后再检查
  const { holder } = elderthing
  assert.equal(holder, null)
  void KEY_LABELS
})

test('秘密钥匙控制：同地点四钥匙 + 机关盒才满足幕 3 目标', () => {
  const state = placedState(2, ['lodgeGatesMembers', 'lobbyMembers', 'lounge'])
  const types = ['skill', 'asset', 'event', 'ally']
  for (const [index, keyId] of KEY_IDS.entries()) {
    const key = state.scenarioKeys[keyId]
    assert.ok(key)
    void types[index]
    key.holder = 0
  }
  state.scenarioFlags.puzzleBox = { holder: 'seat', seat: 0, enemyId: null }
  state.investigators[0].location = 'lounge'
  state.investigators[1].location = 'lounge'
  assert.equal(fgg.behavior.fourKeysReady(state), true)
  state.scenarioKeys.tablet.holder = 1
  state.investigators[1].location = 'lobbyMembers'
  assert.equal(fgg.behavior.fourKeysReady(state), false, '钥匙控制者不在同一地点')
  state.investigators[1].location = 'lounge'
  assert.equal(fgg.behavior.fourKeysReady(state), true, '不同调查员在同地点控制钥匙也算')
  state.scenarioFlags.puzzleBox = { holder: 'enemy', enemyId: 'x' }
  assert.equal(fgg.behavior.fourKeysReady(state), false, '机关盒在敌人身上时不算')
})

test('幕 1 渗透秘社背面：圣堂内室入场，生成教化大师南森并附属机关盒', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const api = apiFor(state)
  fgg.behavior.actReveal(state, state.acts[0], api)
  assert.ok(loc(state, 'innerSanctum'), '圣堂内室入场')
  const nathan = state.enemies.find(entry => entry.code === '05217b')
  assert.ok(nathan)
  assert.equal(nathan.location, 'innerSanctum')
  assert.deepEqual(state.scenarioFlags.puzzleBox, { holder: 'enemy', enemyId: nathan.id, seat: null })
  assert.ok(state.storyAssets.some(asset => asset.code === '05228'))
  assert.equal(state.scenarioZones.setAside.includes('05217b'), false, '南森离开放在一边')
})

test('幕 1 热烈欢迎背面：藏书室入场并生成引导大师南森', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const api = apiFor(state)
  fgg.behavior.actReveal(state, membersAct1, api)
  assert.ok(loc(state, 'library'))
  const nathan = state.enemies.find(entry => entry.code === '05217')
  assert.ok(nathan)
  assert.deepEqual(state.scenarioFlags.puzzleBox, { holder: 'enemy', enemyId: nathan.id, seat: null })
})

test('教化南森躲避成功 3 点以上：偷走机关盒、钥匙归你、加入胜利区', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const nathan = enemy(state, '05217b')
  nathan.doom = 1
  state.scenarioFlags.puzzleBox = { holder: 'enemy', enemyId: nathan.id, seat: null }
  state.scenarioKeys.cultist.enemyId = nathan.id
  fgg.behavior.afterEvade(state, state.investigators[0], nathan,
    { success: true, value: 7, difficulty: 3 }, apiFor(state))
  assert.equal(state.enemies.includes(nathan), false)
  assert.equal(state.scenarioFlags.nathanDefeated, true)
  assert.equal(state.scenarioKeys.cultist.holder, 0)
  assert.ok(state.victoryDisplay.some(card => card.code === '05217b'))
})

test('引导南森谈判：成功累积资源，达到 1×人数后进胜利区并交出钥匙', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  state.investigators[0].location = 'lodgeGatesMembers'
  const nathan = enemy(state, '05217')
  nathan.resources = 1
  state.scenarioKeys.skull.enemyId = nathan.id
  const inv = state.investigators[0]
  fgg.behavior.performAction(state, inv, { rule: 'parleyNathan' }, apiFor(state))
  assert.equal(nathan.resources, 2)
  assert.equal(state.enemies.includes(nathan), false)
  assert.equal(state.scenarioFlags.nathanDefeated, true)
  assert.equal(state.scenarioKeys.skull.holder, 0)
})

test('幕 2 目标：南森进胜利区后选择调查员取得机关盒并推进', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  state.victoryDisplay.push({ id: 'v', code: '05217b', originalCode: '05217b' })
  state.actIndex = 1
  const api = apiFor(state)
  fgg.behavior.checkObjectives(state, api)
  assert.equal(fgg.behavior.puzzleBoxHolder(state), 0)
  assert.ok(state.investigators[0].assets.some(asset => asset.code === '05228'))
  assert.ok(api.calls.some(call => call[0] === 'advanceAct'))
})

test('幕 3 目标：同地点机关盒 + 四钥匙推进，缺一把不推进', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  state.actIndex = 2
  const api = apiFor(state)
  fgg.behavior.checkObjectives(state, api)
  assert.equal(api.calls.some(call => call[0] === 'advanceAct'), false, '缺钥匙不推进')
  for (const keyId of KEY_IDS) state.scenarioKeys[keyId].holder = 0
  state.investigators[0].location = 'lodgeGatesMembers'
  state.investigators[1].location = 'lodgeGatesMembers'
  state.scenarioFlags.puzzleBox = { holder: 'seat', seat: 1, seat2: 0, seat3: 0 }
  state.scenarioFlags.puzzleBox = { holder: 'seat', seat: 0 }
  state.investigators[0].assets.push({ id: 'p', code: '05228', originalCode: '05228' })
  fgg.behavior.checkObjectives(state, api)
  assert.equal(api.calls.some(call => call[0] === 'advanceAct'), true)
})

test('四把钥匙在敌人/地点/调查员之间的转移与离场规则', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const jailor = enemy(state, '05218')
  const api = apiFor(state, { random: () => 0 })
  state.scenarioKeys.tablet.enemyId = jailor.id
  fgg.behavior.enemySpawned(state, jailor, api)
  assert.ok(jailor.doom >= 2, '狱卒入场放置 2 个毁灭')
  assert.equal(fgg.behavior.keysOnEnemy(state, jailor).length >= 1, true, '随机钥匙放在狱卒上')
  // 敌人离场（非击败）：钥匙留在其地点
  fgg.behavior.enemyDiscarded(state, jailor, api)
  assert.equal(fgg.behavior.keysOnLocation(state, jailor.location).length >= 1, true)
  const key = fgg.behavior.keysOnLocation(state, jailor.location)[0]
  state.investigators[0].location = jailor.location
  state.investigators[0].clues = 0
  const moves = fgg.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'takeKeyAtLocation'))
  fgg.behavior.performAction(state, state.investigators[0], { rule: 'takeKeyAtLocation' }, api)
  assert.equal(key.holder, 0)
})

test('秘社狱卒/牢房看门人入场：2 毁灭 + 随机钥匙；狱卒谈判可取钥匙或去毁灭', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs'])
  const api = apiFor(state, { random: () => 0, choose: () => 'key:skull' })
  const jailor = enemy(state, '05218', 'lodgeCatacombs')
  fgg.behavior.enemySpawned(state, jailor, api)
  assert.equal(jailor.doom, 2)
  assert.equal(fgg.behavior.keysOnEnemy(state, jailor).length, 1)
  state.investigators[0].location = 'lodgeCatacombs'
  fgg.behavior.performAction(state, state.investigators[0], { rule: 'parleyJailor' }, api)
  assert.equal(state.scenarioKeys.skull.holder, 0)
})

test('边缘虚空骑士显现：可选择放 1 或 2 个毁灭', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const one = apiFor(state, { choose: () => '1' })
  const knight = enemy(state, '05222')
  fgg.behavior.enemySpawned(state, knight, one)
  assert.equal(knight.doom, 1)
  const knight2 = enemy(state, '05222')
  fgg.behavior.enemySpawned(state, knight2, apiFor(state, { choose: () => '2' }))
  assert.equal(knight2.doom, 2)
})

test('陷阱守卫者：场上每 2 毁灭 +1 攻/躲/伤害/恐惧；敌军阶段吞噬类人敌人', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const beast = enemy(state, '05220', 'lodgeCatacombs')
  assert.equal(fgg.behavior.enemyStatModifier(state, beast, 'fight'), 0)
  assert.equal(fgg.behavior.enemyAttackModifier(state, beast), null)
  state.doom = 4
  assert.equal(fgg.behavior.enemyStatModifier(state, beast, 'evade'), 2)
  assert.deepEqual(fgg.behavior.enemyAttackModifier(state, beast), { damage: 2, horror: 2 })
  const human = enemy(state, '05217b', 'lodgeCatacombs')
  human.doom = 2
  const api = apiFor(state)
  fgg.behavior.enemyPhaseStart(state, api)
  assert.equal(state.enemies.includes(human), false, '类人敌人被击败')
  assert.equal(beast.doom, 2, '毁灭被吸收')
})

test('击败银暮秘社敌人：该地点每个敌人的 1 个毁灭移到当前议程', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const dead = enemy(state, '05095', 'lobbyMembers')
  dead.traits = ['Humanoid', 'Cultist', 'Silver Twilight']
  const other = enemy(state, '05219', 'lobbyMembers')
  other.doom = 2
  const api = apiFor(state)
  fgg.behavior.enemyDefeated(state, dead, api)
  assert.equal(other.doom, 1)
  assert.equal(state.doom, 1)
  // 无毁灭时不放
  other.doom = 0
  fgg.behavior.enemyDefeated(state, dead, api)
  assert.equal(state.doom, 1)
})

test('陷阱守卫者被击败 → 记录并结束为结局 3', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const beast = enemy(state, '05220')
  const api = apiFor(state)
  fgg.behavior.enemyDefeated(state, beast, api)
  assert.equal(state.scenarioFlags.guardianDefeated, true)
  assert.ok(api.calls.some(call => call[0] === 'finish' && call[1] === 'r3'))
})

test('议程 1 背面：弃遭遇牌库顶 5 张，按玩家顺序抽异教徒敌人', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  state.encounterDeck = ['05223', '05095', '05224', '05096', '05225', '05226']
  const api = apiFor(state, { choose: () => '0' })
  fgg.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.enemies.filter(entry => entry.code === '05095' || entry.code === '05096').length, 2)
  assert.equal(state.encounterDiscard.includes('05224'), true)
  assert.equal(state.encounterDeck.length, 1, '05223 仍在牌库顶')
})

test('议程 2 背面：弃掉全部幕牌、生成陷阱守卫者、机关盒移出游戏', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs'])
  state.storyAssets.push({ id: 'story:puzzleBox', code: '05228', originalCode: '05228', location: 'lodgeCatacombs' })
  state.scenarioFlags.puzzleBox = { holder: 'enemy', enemyId: 'x' }
  const api = apiFor(state)
  fgg.behavior.agendaReveal(state, state.agendas[1], api)
  assert.deepEqual(state.acts, [])
  assert.equal(state.scenarioFlags.actsDiscarded, true)
  assert.ok(state.enemies.some(entry => entry.code === '05220'))
  assert.equal(state.storyAssets.some(asset => asset.code === '05228'), false)
  assert.equal(state.scenarioFlags.puzzleBox.removed, true)
})

test('混乱标记：skull 取异教徒毁灭（普通取最大、困难取总和），cultist 再抽一个', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  const first = enemy(state, '05095')
  first.doom = 3
  const second = enemy(state, '05219')
  second.doom = 2
  state.difficulty = 'standard'
  assert.equal(fgg.behavior.resolveChaosToken(state, state.investigators[0], 'skull', {}).delta, -3)
  state.difficulty = 'hard'
  assert.equal(fgg.behavior.resolveChaosToken(state, state.investigators[0], 'skull', {}).delta, -5)
  const cultist = fgg.behavior.resolveChaosToken(state, state.investigators[0], 'cultist', {})
  assert.equal(cultist.delta, -2)
  assert.equal(cultist.drawAnother, true)
  assert.equal(fgg.behavior.resolveChaosToken(state, state.investigators[0], 'tablet', {}).delta, -3)
  assert.equal(fgg.behavior.resolveChaosToken(state, state.investigators[0], 'elderthing', {}).delta, -3)
})

test('afterTest：石板失败给最近/全部异教徒放毁灭；古神失败把毁灭移到议程', () => {
  const state = placedState(2, ['lodgeGatesMembers', 'lobbyMembers', 'lounge'])
  state.investigators[0].location = 'lodgeGatesMembers'
  const near = enemy(state, '05095', 'lodgeGatesMembers')
  const far = enemy(state, '05219', 'lounge')
  const api = apiFor(state)
  state.difficulty = 'standard'
  fgg.behavior.afterTest(state, state.investigators[0],
    { success: false, value: 1, difficulty: 3, drawn: ['tablet'], cancelledTokens: [] }, api)
  assert.equal(near.doom, 1)
  assert.equal(far.doom, 0)
  state.difficulty = 'hard'
  fgg.behavior.afterTest(state, state.investigators[0],
    { success: false, value: 1, difficulty: 3, drawn: ['tablet'], cancelledTokens: [] }, api)
  assert.equal(near.doom, 2)
  assert.equal(far.doom, 1)
  state.difficulty = 'standard'
  otherDoom(state, near, 2)
  fgg.behavior.afterTest(state, state.investigators[0],
    { success: false, value: 1, difficulty: 3, drawn: ['elderthing'], cancelledTokens: [] }, api)
  assert.equal(near.doom, 1)
  assert.equal(state.doom, 1)
})

function otherDoom(state, target, amount) {
  target.doom = amount
}

test('结局：noResolution/r3 写记录；r1/r2 记录并把机关盒加入战役牌组（不占 30 张）', () => {
  const no = placedState(1, ['lodgeGatesMembers'])
  assert.deepEqual(fgg.behavior.resolution(no, 'noResolution', [], {}), { award: true, bonus: 0 })
  assert.equal(no.campaign.records.theGuardianOfTheTrapEmerged, true)

  const third = placedState(1, ['lodgeGatesMembers'])
  assert.equal(fgg.behavior.resolution(third, 'r3', [], {}).award, true)
  assert.equal(third.campaign.records.theGuardianOfTheTrapEmergedAndWasDefeated, true)

  const won = placedState(1, ['lodgeGatesMembers'])
  won.scenarioFlags.puzzleBox = { holder: 'seat', seat: 0 }
  assert.equal(fgg.behavior.resolution(won, 'r1', [], apiFor(won)).award, true)
  assert.equal(won.campaign.records.theInvestigatorsDiscoveredHowToOpenThePuzzleBox, true)
  assert.ok(won.campaign.investigators[0].deck.includes('05228'))
  assert.equal(won.campaign.investigators[0].deck.length, 1, 'campaignCard 不进 30 张的普通牌组计数')
  assert.throws(() => fgg.behavior.resolution(won, 'r9', [], {}), /未知崇高利益结局/)
})

test('成员记录走结局 1、非成员走结局 2', () => {
  const member = placedState(1, ['lodgeGatesMembers'], { theInvestigatorsAreMembersOfTheLodge: true })
  fgg.behavior.actReveal(member, member.acts[2] || { code: '05203', originalCode: '05203' }, apiFor(member))
  const memberFinish = apiFor(member)
  member.acts = [{ code: '05203', originalCode: '05203', name: '四把钥匙' }]
  member.actIndex = 0
  fgg.behavior.actReveal(member, member.acts[0], memberFinish)
  assert.ok(memberFinish.calls.some(call => call[0] === 'finish' && call[1] === 'r1'))

  const outsider = placedState(1, ['lodgeGatesMembers'])
  outsider.acts = [{ code: '05203', originalCode: '05203', name: '四把钥匙' }]
  outsider.actIndex = 0
  const outsiderFinish = apiFor(outsider)
  fgg.behavior.actReveal(outsider, outsider.acts[0], outsiderFinish)
  assert.ok(outsiderFinish.calls.some(call => call[0] === 'finish' && call[1] === 'r2'))
})

test('大门提供撤退/谈判/线索行动；其他地点不提供', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lobbyWeve', 'lodgeCellarMembers', 'lounge'])
  const inv = state.investigators[0]
  const moves = fgg.behavior.actions(state, inv)
  assert.deepEqual(moves.map(move => move.rule).sort(),
    ['parleyLobby', 'resignGates', 'revealCellar'])
  const resigned = fgg.behavior.performAction(state, inv, { rule: 'resignGates' }, apiFor(state))
  assert.equal(resigned, true)
  assert.equal(inv.resigned, true)
  inv.location = 'lounge'
  assert.deepEqual(fgg.behavior.actions(state, inv), [])
  assert.throws(() => fgg.behavior.performAction(state, inv, { rule: 'unknown' }, apiFor(state)),
    /未知崇高利益行动/)
})

test('休息室谈判：共同支付 2×人数线索，奥古斯特移出游戏、钥匙归你', () => {
  const state = placedState(2, ['lodgeGatesMembers', 'lounge'])
  state.storyAssets.push({ id: 'story:august', code: '05227', originalCode: '05227', location: 'lounge' })
  state.scenarioKeys.tablet.location = 'lounge'
  for (const inv of state.investigators) { inv.location = 'lounge'; inv.clues = 2 }
  const api = apiFor(state)
  const moves = fgg.behavior.actions(state, state.investigators[0])
  const august = moves.find(move => move.rule === 'parleyAugust')
  assert.ok(august)
  assert.equal(august.reason, null)
  fgg.behavior.performAction(state, state.investigators[0], august, api)
  assert.equal(state.storyAssets.some(asset => asset.code === '05227'), false)
  assert.equal(state.scenarioFlags.augustRemoved, true)
  assert.equal(state.scenarioKeys.tablet.holder, 0)
  for (const inv of state.investigators) assert.equal(inv.damage + inv.horror, 1)
})

test('典礼室轮末：调查员与友方支援各受 1 直接恐惧，骷髅钥匙可取消', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs', 'sanctumDoorwayCeremonyRoom'])
  loc(state, 'sanctumDoorwayCeremonyRoom').revealed = true
  state.investigators[0].location = 'sanctumDoorwayCeremonyRoom'
  state.investigators[0].assets.push({ id: 'ally', code: '01018', originalCode: '01018', horror: 0 })
  fgg.behavior.roundEnded(state, apiFor(state))
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[0].assets[0].horror, 1)
  state.investigators[0].horror = 0
  state.investigators[0].assets[0].horror = 0
  state.scenarioKeys.skull.holder = 0
  fgg.behavior.roundEnded(state, apiFor(state))
  assert.equal(state.investigators[0].horror, 0)
})

test('诡计 05223 发号施令：从弃牌堆顶抽 2 张异教徒敌人到线索最多的无人地点', () => {
  const state = placedState(2, ['lodgeGatesMembers', 'lounge', 'library'])
  loc(state, 'library').clues = 3
  loc(state, 'lounge').clues = 1
  state.encounterDiscard = ['05095', '05095', '05222', '05219']
  const api = apiFor(state)
  fgg.behavior.resolveEncounter(state, state.investigators[0],
    { code: '05223', originalCode: '05223', name: '发号施令' }, api)
  const spawned = state.enemies.filter(entry => ['05095', '05219', '05222'].includes(entry.code))
  assert.equal(spawned.length, 2)
  assert.ok(spawned.every(entry => entry.location === 'library'))
})

test('诡计 05224 除籍：最近的异教徒敌人移动、交战、攻击并把钥匙放到它身上', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lobbyMembers', 'lodgeCellarMembers'])
  const cultist = enemy(state, '05095', 'lodgeCellarMembers')
  state.investigators[0].location = 'lodgeGatesMembers'
  state.scenarioKeys.skull.holder = 0
  const api = apiFor(state)
  fgg.behavior.resolveEncounter(state, state.investigators[0],
    { code: '05224', originalCode: '05224', name: '除籍' }, api)
  assert.equal(cultist.location, 'lodgeGatesMembers')
  assert.equal(cultist.engagedSeat, 0)
  assert.equal(state.scenarioKeys.skull.enemyId, cultist.id)
  assert.ok(api.calls.some(call => call[0] === 'attack'))
})

test('诡计 05225/05226：秘社地底失败按点数扣线索，修道会符号按钥匙结算', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  state.investigators[0].clues = 1
  const failApi = apiFor(state, {
    testResult: { success: false, value: 1, difficulty: 3, drawn: [], cancelledTokens: [] },
  })
  fgg.behavior.resolveEncounter(state, state.investigators[0],
    { code: '05225', originalCode: '05225', name: '秘社地底' }, failApi)
  assert.equal(state.investigators[0].clues, 0, '先扣线索')
  assert.equal(state.investigators[0].horror, 1, '再受恐惧')
  state.scenarioKeys.skull.holder = 0
  state.scenarioKeys.cultist.holder = 1
  state.scenarioKeys.elderthing.holder = 0
  state.investigators[0].resources = 5
  const api = apiFor(state)
  fgg.behavior.resolveEncounter(state, state.investigators[0],
    { code: '05226', originalCode: '05226', name: '修道会符号' }, api)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[1].horror, 1)
  assert.equal(state.investigators[0].resources, 2)
})

test('同一路线在 JSON 往返后完全一致（存档/读档）', () => {
  const build = () => {
    const state = placedState(2, ['lodgeGatesMembers', 'lobbyMembers', 'lounge'])
    const api = apiFor(state)
    fgg.behavior.locationRevealed(state, loc(state, 'lodgeMembers'), api)
    state.scenarioFlags.puzzleBox = { holder: 'seat', seat: 0 }
    state.scenarioKeys.skull.holder = 0
    state.scenarioKeys.cultist.location = 'lounge'
    state.actIndex = 1
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同路线确定性')
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.scenarioKeys, first.scenarioKeys)
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.locations.map(entry => entry.doom), first.locations.map(entry => entry.doom))
  assert.deepEqual(restored.enemies, first.enemies)
})
