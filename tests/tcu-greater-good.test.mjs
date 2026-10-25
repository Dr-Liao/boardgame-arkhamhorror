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
    // 与引擎 spawnEnemy 同语义：spawnLocation 覆盖生成点；只有生成点等于抽牌者地点且非冷漠才自动交战。
    spawnEngaged: (code, locationId, seat) => {
      const overridden = (typeof fgg.behavior.spawnLocation === 'function'
        ? fgg.behavior.spawnLocation(state, code, locationId, seat, api) : null) || locationId
      const enemy = api.spawn(code, overridden)
      if (enemy && !enemy.aloof && state.investigators[seat]?.location === overridden) {
        enemy.engagedSeat = seat
        const inv = state.investigators[seat]
        inv.engaged ||= []
        if (!inv.engaged.includes(enemy.id)) inv.engaged.push(enemy.id)
      }
      return enemy
    },
    banish: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      state.victoryDisplay.push({ id: `victory:${enemy.id}`, code: enemy.code, originalCode: enemy.originalCode })
      return true
    },
    // 第五轮原语替身：剧情资产附属到敌人（真实 enemy.attachments 实例）。
    attachStoryAssetToEnemy: (code, enemyId, extra = {}) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (!enemy) return null
      enemy.attachments ||= []
      const attachment = { id: `att:${code}:${enemy.attachments.length + 1}`, code, originalCode: code, ...extra }
      enemy.attachments.push(attachment)
      return attachment
    },
    detachEnemyAttachment: (enemyId, attachmentId) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      const index = (enemy?.attachments || []).findIndex(item => item.id === attachmentId)
      if (index < 0) return null
      return enemy.attachments.splice(index, 1)[0]
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
    gainClues: (seat, n) => { state.investigators[seat].clues += n },
    horrorAsset: (seat, assetId, n) => {
      const asset = (state.investigators[seat]?.assets || []).find(entry => entry.id === assetId)
      if (!asset) return null
      asset.horror = (asset.horror || 0) + n
      return asset
    },
    finish: key => calls.push(['finish', key]),
    damageEnemy: (enemyId, n) => {
      const target = state.enemies.find(entry => entry.id === enemyId)
      if (target) target.damageTaken = (target.damageTaken || 0) + n
      return target
    },
    spendClues: (seat, n) => { state.investigators[seat].clues = Math.max(0, state.investigators[seat].clues - n) },
    // 引擎击败读点（05220 陷阱守卫者吞噬类人时走引擎击败结算）。
    checkEnemyDefeat: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index < 0) return false
      state.enemies.splice(index, 1)
      state.victoryDisplay.push({ id: `victory:${enemy.id}`, code: enemy.code, originalCode: enemy.code })
      calls.push(['checkEnemyDefeat', enemy.code])
      return true
    },
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
    // 第七轮引擎原语：幕牌库旁提醒实体（纯提醒载体）。
    addActReminder: (code, actIndex = null) => {
      state.actReminders ||= []
      const reminder = { code, actIndex: Number.isInteger(actIndex) ? actIndex : (state.actIndex ?? 0) }
      state.actReminders.push(reminder)
      return reminder
    },
    actReminders: (actIndex = null) => (state.actReminders || []).filter(item => !Number.isInteger(actIndex) || item.actIndex === actIndex),
    // 第七轮引擎原语：把目标上的毁灭标记翻至线索面（语义等价载体）。
    flipMarker: (target, options = {}) => {
      const amount = Math.max(1, Math.floor(options.amount || 1))
      let flipped = 0
      for (let index = 0; index < amount && (target?.doom || 0) > 0; index += 1) {
        target.doom -= 1
        target.clues = (target.clues || 0) + 1
        flipped += 1
      }
      if (flipped) { target.markers ||= []; target.markers.push(`doomToClue:${flipped}`) }
      return flipped
    },
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
  // 05210：钥匙放在奥古斯特支援上（参考 Lounge.hs:30-34 placeKey augustLindquist），不是地点上。
  const keysHere = fgg.behavior.keysOnAsset(state, august)
  assert.equal(keysHere.length, 1, '随机 1 把钥匙放在奥古斯特支援上')
  assert.equal(fgg.behavior.keysOnLocation(state, 'lounge').length, 0, '地点上不再有该钥匙')
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
  // 第五轮：机关盒是敌人身上的真实附属实例（api.attachStoryAssetToEnemy），不再是 storyAssets 条目。
  assert.deepEqual((nathan.attachments || []).map(item => item.code), ['05228'], '机关盒真实附属在南森身上')
  assert.equal(state.storyAssets.some(asset => asset.code === '05228'), false, '不再用 storyAssets 承载附属')
  assert.equal(state.scenarioZones.setAside.includes('05228'), false, '机关盒离开「放在一边」区')
  assert.equal(state.scenarioZones.setAside.includes('05217b'), false, '南森离开放在一边')
  // 第七轮：卡面「将本卡放到幕牌库旁作为提醒」由引擎提醒实体承载。
  assert.deepEqual(state.actReminders, [{ code: '05201', actIndex: state.actIndex }], '05201 作为幕牌库旁提醒实体登记')
})

test('机关盒转交：从敌人身上摘下真实附属后由调查员控制', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const api = apiFor(state)
  fgg.behavior.actReveal(state, membersAct1, api)
  const nathan = state.enemies.find(entry => entry.code === '05217')
  assert.deepEqual((nathan.attachments || []).map(item => item.code), ['05228'])
  fgg.behavior.enemySpawned(state, nathan, api) // 重复入场回调：先摘旧附属再挂新的，不应重复
  assert.equal(nathan.attachments.filter(item => item.code === '05228').length, 1)
  // 直接走 givePuzzleBoxTo 的内部路径：用幕 2 目标在击败南森后分配。
  state.victoryDisplay.push({ id: 'v', code: '05217', originalCode: '05217' })
  state.actIndex = 1
  fgg.behavior.checkObjectives(state, api)
  assert.equal(fgg.behavior.puzzleBoxHolder(state), 0)
  assert.equal((nathan.attachments || []).some(item => item.code === '05228'), false, '转交后敌人身上不再有附属')
  assert.ok(state.investigators[0].assets.some(asset => asset.code === '05228'))
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

test('教化南森躲避成功 3 点以上：当刻偷走机关盒、钥匙归你、加入胜利区', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const nathan = enemy(state, '05217b')
  nathan.doom = 1
  state.scenarioFlags.puzzleBox = { holder: 'enemy', enemyId: nathan.id, seat: null }
  state.scenarioKeys.cultist.enemyId = nathan.id
  const inv = state.investigators[0]
  fgg.behavior.afterEvade(state, inv, nathan,
    { success: true, value: 7, difficulty: 3 }, apiFor(state))
  assert.equal(state.enemies.includes(nathan), false)
  assert.equal(state.scenarioFlags.nathanDefeated, true)
  assert.equal(state.scenarioKeys.cultist.holder, 0)
  // 卡面「你偷了机关盒」：躲避成功超过难度≥3 当刻就把盒子交给躲避者，
  // 不再等幕 05202 的目标再分配（audit 05217b 修复）。
  assert.equal(fgg.behavior.puzzleBoxHolder(state), 0, '机关盒当刻由躲避者控制')
  assert.ok(inv.assets.some(asset => asset.code === '05228'), '机关盒进入躲避者的控制')
  assert.ok(state.victoryDisplay.some(card => card.code === '05217b'))
})

test('教化南森躲避成功不足 3 点：不偷机关盒', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const nathan = enemy(state, '05217b')
  state.scenarioFlags.puzzleBox = { holder: 'enemy', enemyId: nathan.id, seat: null }
  const inv = state.investigators[0]
  fgg.behavior.afterEvade(state, inv, nathan,
    { success: true, value: 5, difficulty: 3 }, apiFor(state))
  assert.equal(state.enemies.includes(nathan), true, '南森未被驱逐')
  assert.equal(fgg.behavior.puzzleBoxHolder(state), null, '机关盒仍在南森身上')
  assert.equal(inv.assets.some(asset => asset.code === '05228'), false)
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
  // 卡面是「显现：放 1 或 2 个毁灭」：只有由遭遇牌显现时结算（encounterDrawn 记录最近抽到的卡）。
  state.scenarioFlags.lastEncounterDrawn = { code: '05222', round: state.round, seat: 0 }
  const one = apiFor(state, { choose: () => '1' })
  const knight = enemy(state, '05222')
  fgg.behavior.enemySpawned(state, knight, one)
  assert.equal(knight.doom, 1)
  const knight2 = enemy(state, '05222')
  fgg.behavior.enemySpawned(state, knight2, apiFor(state, { choose: () => '2' }))
  assert.equal(knight2.doom, 2)
  // 被其它效果生成（不是显现）时不放毁灭。
  state.scenarioFlags.lastEncounterDrawn = { code: '05095', round: state.round, seat: 0 }
  const knight3 = enemy(state, '05222')
  fgg.behavior.enemySpawned(state, knight3, apiFor(state, { choose: () => '2' }))
  assert.equal(knight3.doom, 0, '非显现生成不放毁灭')
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
  dead.defeatedBy = 0 // 引擎在调查员击败时写入（src/engine/combat.js:359 等）
  fgg.behavior.enemyDefeated(state, dead, api)
  assert.equal(other.doom, 1)
  assert.equal(state.doom, 1)
  // 不是调查员造成的离场（无 defeatedBy）不触发「当你击败」强制。
  const unattributed = enemy(state, '05095', 'lobbyMembers')
  unattributed.traits = ['Humanoid', 'Cultist', 'Silver Twilight']
  unattributed.location = 'lobbyMembers'
  other.doom = 1
  fgg.behavior.enemyDefeated(state, unattributed, api)
  assert.equal(other.doom, 1, '非调查员击败不转移毁灭')
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
  // 05210/05227：钥匙在奥古斯特支援上（assetId），地点上不经过钥匙模型。
  state.scenarioKeys.tablet.assetId = 'story:august'
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
  // 卡面「没有调查员或敌人的地点」：有敌人的地点即使线索最多也不能选。
  enemy(state, '05090', 'library')
  state.encounterDiscard = ['05095', '05095', '05222', '05219']
  const api = apiFor(state)
  fgg.behavior.resolveEncounter(state, state.investigators[0],
    { code: '05223', originalCode: '05223', name: '发号施令' }, api)
  const spawned = state.enemies.filter(entry => ['05095', '05219', '05222'].includes(entry.code))
  assert.equal(spawned.length, 2)
  assert.ok(spawned.every(entry => entry.location === 'lounge'), '有敌人的图书馆不可选，改选休息室')
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
  assert.equal(state.investigators[0].clues, 0, '第一点选择失去线索')
  assert.equal(state.investigators[0].horror, 1, '第二点没有线索，改受恐惧')
  // 卡面「每点失败：失去 1 线索或受 1 恐惧」可选：选择受恐惧时保留线索。
  const keepState = placedState(1, ['lodgeGatesMembers'])
  keepState.investigators[0].clues = 2
  const horrorApi = apiFor(keepState, {
    testResult: { success: false, value: 1, difficulty: 3, drawn: [], cancelledTokens: [] },
    choose: () => 'horror',
  })
  fgg.behavior.resolveEncounter(keepState, keepState.investigators[0],
    { code: '05225', originalCode: '05225', name: '秘社地底' }, horrorApi)
  assert.equal(keepState.investigators[0].clues, 2, '选择受恐惧时保留线索')
  assert.equal(keepState.investigators[0].horror, 2, '2 点失败 → 2 点恐惧')
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

// ---------------------------------------------------------------------------
// P11 修复回归（c3c4 high 条目：05208/05198/05199/05213/05222/05228）
// ---------------------------------------------------------------------------

test('05208 秘社地窖（我们一直在等你）：背面无进入限制，进入/揭示后放 1 把随机钥匙', () => {
  const state = placedState(2, null, { theInvestigatorsAreMembersOfTheLodge: true })
  const cellar = loc(state, 'lodgeCellarWeve')
  assert.ok(cellar, '成员分支布置了 lodgeCellarWeve')
  assert.equal(cellar.revealed, false)
  assert.equal(fgg.behavior.investigatorEntryError(state, cellar), null, '背面为空：没有额外进入限制')
  const api = apiFor(state)
  api.reveal('lodgeCellarWeve')
  assert.equal(cellar.revealed, true)
  assert.equal(fgg.behavior.keysOnLocation(state, 'lodgeCellarWeve').length, 1, '揭示后放 1 把随机钥匙')
})

test('05213 地下墓穴：控制至少 1 把任意钥匙即可进入，揭示时放入圣堂内室与门廊', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs'])
  const catacombs = loc(state, 'lodgeCatacombs')
  assert.match(fgg.behavior.investigatorEntryError(state, catacombs), /钥匙/, '无钥匙仍锁门')
  state.scenarioKeys.skull.holder = 0
  assert.equal(fgg.behavior.investigatorEntryError(state, catacombs), null, '持任意钥匙即放行')
  const api = apiFor(state)
  api.reveal('lodgeCatacombs')
  assert.ok(loc(state, 'innerSanctum'), '圣堂内室入场')
  assert.ok(loc(state, 'sanctumDoorwayCeremonyRoom'), '典礼室门廊入场')
  assert.ok(loc(state, 'sanctumDoorwayHoldingCells'), '拘禁室门廊入场')
})

test('05198 正面：被弃置的银暮秘社敌人不移动毁灭（只认「击败」）', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const dead = enemy(state, '05095', 'lobbyMembers')
  dead.traits = ['Humanoid', 'Cultist', 'Silver Twilight']
  const other = enemy(state, '05219', 'lobbyMembers')
  other.doom = 2
  fgg.behavior.enemyDiscarded(state, dead, apiFor(state))
  assert.equal(other.doom, 2, '弃置不触发毁灭移动')
  assert.equal(state.doom || 0, 0)
  dead.defeatedBy = 0 // 「当你击败」：引擎在调查员击败时写 defeatedBy（战斗/效果结算）
  fgg.behavior.enemyDefeated(state, dead, apiFor(state))
  assert.equal(other.doom, 1, '调查员击败才触发毁灭移动')
  assert.equal(state.doom, 1)
})

test('05198 背面：抽到的异教徒敌人生成在抽牌者地点并交战，且不重复进弃牌堆', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  state.encounterDeck = ['05223', '05095', '05224', '05096', '05225', '05226']
  const api = apiFor(state, { choose: () => '0' })
  fgg.behavior.agendaReveal(state, state.agendas[0], api)
  const drawn = state.enemies.filter(entry => entry.code === '05095' || entry.code === '05096')
  assert.equal(drawn.length, 2, '两位调查员各抽到 1 个异教徒敌人')
  assert.equal(drawn[0].location, state.investigators[0].location)
  assert.equal(drawn[1].location, state.investigators[1].location)
  assert.equal(drawn[0].engagedSeat, 0, '与抽牌者交战')
  assert.equal(drawn[1].engagedSeat, 1)
  assert.ok(state.investigators[0].engaged.includes(drawn[0].id))
  for (const entry of drawn) {
    assert.equal(state.encounterDiscard.filter(code => code === entry.code).length <= 1, true,
      '同一张牌不能既在场上又在弃牌堆出现副本')
  }
})

test('05199 正面：圣堂地点的银暮秘社敌人失去冷漠；离开圣堂/议程翻面后还原', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs', 'lounge'])
  state.agendaIndex = 1
  const sanctumCultist = enemy(state, '05221', 'lodgeCatacombs')
  sanctumCultist.traits = ['Humanoid', 'Cultist', 'Silver Twilight']
  sanctumCultist.aloof = true
  sanctumCultist.printedAloof = true
  const loungeCultist = enemy(state, '05219', 'lounge')
  loungeCultist.traits = ['Humanoid', 'Cultist', 'Silver Twilight']
  loungeCultist.aloof = true
  fgg.behavior.roundEnded(state, apiFor(state))
  assert.equal(sanctumCultist.aloof, false, '圣堂地点失冷漠')
  assert.equal(loungeCultist.aloof, true, '非圣堂地点不受影响')
  state.agendaIndex = 0
  fgg.behavior.roundEnded(state, apiFor(state))
  assert.equal(sanctumCultist.aloof, true, '议程翻面后还原印刷冷漠')
})

test('05199 背面：响应召唤的怪兽生成在机关盒所在地点（附在敌人身上时取敌人地点）', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs', 'innerSanctum'])
  const carrier = enemy(state, '05217b', 'innerSanctum')
  state.storyAssets.push({ id: 'story:puzzleBox', code: '05228', originalCode: '05228', location: 'innerSanctum' })
  state.scenarioFlags.puzzleBox = { holder: 'enemy', enemyId: carrier.id }
  const api = apiFor(state)
  fgg.behavior.agendaReveal(state, state.agendas[1], api)
  const beast = state.enemies.find(entry => entry.code === '05220')
  assert.ok(beast, '陷阱守卫者生成')
  assert.equal(beast.location, 'innerSanctum', '生成在机关盒所在地点')
  assert.equal(state.scenarioFlags.puzzleBox.removed, true)
})

test('05222 边缘虚空骑士谈判成功：移除 1 个毁灭并获得 1 个线索', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const knight = enemy(state, '05222', 'lodgeGatesMembers')
  knight.doom = 2
  fgg.behavior.performAction(state, state.investigators[0], { rule: 'parleyKnightOuter' }, apiFor(state))
  assert.equal(knight.doom, 1)
  assert.equal(state.investigators[0].clues, 1, '毁灭翻成线索归谈判者')
  assert.equal(knight.clues || 0, 0, '翻出的线索已由谈判者控制（目标上不留线索）')
  assert.ok((knight.markers || []).some(label => String(label).startsWith('doomToClue:')), '走引擎 flipMarker 标记翻面载体')
})

test('05228 机关盒强制：控制者被击败时把控制权交给另一位调查员', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  state.scenarioFlags.puzzleBox = { holder: 'seat', seat: 0 }
  state.investigators[0].assets.push({ id: 'box0', code: '05228', originalCode: '05228' })
  state.investigators[0].defeated = true
  fgg.behavior.investigatorEliminated(state, state.investigators[0], 0, apiFor(state))
  assert.equal(fgg.behavior.puzzleBoxHolder(state), 1)
  assert.equal(state.investigators[0].assets.some(asset => asset.code === '05228'), false)
  assert.equal(state.investigators[1].assets.some(asset => asset.code === '05228'), true)
})

test('05228 机关盒 [action]：熄灭火盆 / 横置看守人 / 对已横置看守人造成 5 伤害，团队每场限一次', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lounge'])
  state.scenarioFlags.puzzleBox = { holder: 'seat', seat: 0 }
  state.investigators[0].location = 'lounge'
  loc(state, 'lounge').flags = { brazier: true }
  const watcher = enemy(state, '05086', 'lodgeGatesMembers')
  watcher.exhausted = false
  // 1) 横置看守人
  const moves = fgg.behavior.actions(state, state.investigators[0])
  const action = moves.find(move => move.rule === 'puzzleBoxAction')
  assert.ok(action, '控制者在场时列出机关盒行动')
  fgg.behavior.performAction(state, state.investigators[0], action, apiFor(state, { choose: () => 'exhaust' }))
  assert.equal(watcher.exhausted, true)
  assert.equal(state.scenarioFlags.puzzleBox.actionUsed, true)
  assert.equal(fgg.behavior.actions(state, state.investigators[0]).some(move => move.rule === 'puzzleBoxAction'), false,
    '团队每场游戏限一次')
  // 2) 已横置 → 5 点伤害
  state.scenarioFlags.puzzleBox.actionUsed = false
  fgg.behavior.performAction(state, state.investigators[0], { rule: 'puzzleBoxAction' },
    apiFor(state, { choose: () => 'damage' }))
  assert.equal(watcher.damageTaken, 5)
  // 3) 熄灭火焰
  state.scenarioFlags.puzzleBox.actionUsed = false
  fgg.behavior.performAction(state, state.investigators[0], { rule: 'puzzleBoxAction' },
    apiFor(state, { choose: () => 'unlight' }))
  assert.equal(loc(state, 'lounge').flags.brazier, false)
})

// ---------------------------------------------------------------------------
// P11 第三批修复回归（05220/05221）
// ---------------------------------------------------------------------------

test('05220 响应召唤的怪兽：敌军阶段开始击败同地点类人敌人并吸收其毁灭（走引擎击败结算）', () => {
  const state = placedState(2, ['lodgeGatesMembers', 'lodgeCatacombs'])
  state.phase = 'enemy'
  const beast = enemy(state, '05220', 'lodgeCatacombs')
  const cultistA = enemy(state, '05218', 'lodgeCatacombs')
  cultistA.traits = ['Humanoid', 'Cultist', 'Silver Twilight']
  cultistA.doom = 2
  const cultistB = enemy(state, '05219', 'lodgeCatacombs')
  cultistB.traits = ['Humanoid', 'Cultist', 'Silver Twilight']
  cultistB.doom = 1
  const api = apiFor(state)
  fgg.behavior.enemyPhaseStart(state, api)
  assert.equal(state.enemies.includes(cultistA), false, '类人敌人被击败（离场）')
  assert.equal(state.enemies.includes(cultistB), false)
  assert.equal(beast.doom, 3, '毁灭全部移动到响应召唤的怪兽身上')
  assert.equal(api.calls.filter(call => call[0] === 'checkEnemyDefeat').length, 2, '不是直接 splice')
  assert.ok(state.victoryDisplay.some(card => card.code === '05218'), '击败结算产生胜利区记录')
})

test('05221 核心圈骑士：骑士进入你所在地点后检定 agility(4)，失败则交战', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lounge'])
  state.investigators[0].location = 'lounge'
  const knight = enemy(state, '05221', 'lounge')
  knight.traits = ['Humanoid', 'Cultist', 'Silver Twilight']
  // 失败：交战。
  fgg.behavior.enemyMoved(state, knight, 'lodgeGatesMembers', apiFor(state, {
    testResult: { success: false, value: 1, difficulty: 4, drawn: [], cancelledTokens: [] },
  }))
  assert.equal(knight.engagedSeat, 0, '检定失败：骑士与你交战')
  assert.ok(state.investigators[0].engaged.includes(knight.id))
  // 成功：不交战。
  knight.engagedSeat = null
  state.investigators[0].engaged = []
  fgg.behavior.enemyMoved(state, knight, 'lodgeGatesMembers', apiFor(state, {
    testResult: { success: true, value: 6, difficulty: 4, drawn: [], cancelledTokens: [] },
  }))
  assert.equal(knight.engagedSeat, null, '检定成功：不交战')
  // 引擎第三参是「移动前地点」：离开你的地点不应再触发检定。
  knight.location = 'lodgeGatesMembers'
  state.investigators[0].location = 'lounge'
  const leaveApi = apiFor(state)
  fgg.behavior.enemyMoved(state, knight, 'lounge', leaveApi)
  assert.equal(leaveApi.calls.filter(call => call[0] === 'test').length, 0, '离开你的地点不触发检定')
})

// ---------------------------------------------------------------------------
// task-42 回归：05097 秘社玄仪 → FGG 异教徒谈判难度 +2
// ---------------------------------------------------------------------------
test('05097 秘社玄仪：FGG 谈判（南森/狱卒/边缘虚空骑士）难度 +2', () => {
  const cases = [
    { rule: 'parleyNathan', code: '05217', base: 3 },
    { rule: 'parleyJailor', code: '05218', base: 3 },
    { rule: 'parleyKnightOuter', code: '05222', base: 4 },
  ]
  for (const { rule, code, base } of cases) {
    const state = stateFor(1)
    const inv = state.investigators[0]
    const enemy = {
      id: `enemy-${code}`, code, originalCode: code, name: code, location: inv.location,
      doom: 1, damageTaken: 0, exhausted: false, engagedSeat: null, resources: 0,
      roundFightEvadeBonus: { round: state.round, amount: 2 },
    }
    state.enemies.push(enemy)
    const api = apiFor(state, {
      testResult: { success: false, value: 0, difficulty: base, drawn: [], cancelledTokens: [] },
    })
    fgg.behavior.performAction(state, inv, { rule }, api)
    const tested = api.calls.find(call => call[0] === 'test')
    assert.ok(tested, `${rule} 应进行谈判检定`)
    assert.equal(tested[1].difficulty, base + 2, `${rule} 难度应为 ${base}+2（05097）`)
  }
})

// ===========================================================================
// Wave1 包C 新增回归（05197/05198/05199/05201/05210/05215/05218/05219/05220/05221/05224/05228）
// ===========================================================================

test('05197 普通面 ElderThing：最近的异教徒敌人没有毁灭时不改选更远目标', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lounge'])
  const near = enemy(state, '05095', 'lodgeGatesMembers')
  const far = enemy(state, '05096', 'lounge')
  far.doom = 2
  state.investigators[0].location = 'lodgeGatesMembers'
  const failed = { success: false, value: 1, difficulty: 3, drawn: ['elderthing'], cancelledTokens: [] }
  fgg.behavior.afterTest(state, state.investigators[0], failed, apiFor(state))
  assert.equal(near.doom, 0, '最近的异教徒敌人没有毁灭：不移动')
  assert.equal(far.doom, 2, '不减更远目标的毁灭')
  // 最近目标有毁灭时正常移动。
  near.doom = 1
  fgg.behavior.afterTest(state, state.investigators[0],
    { success: false, value: 1, difficulty: 3, drawn: ['elderthing'], cancelledTokens: [] }, apiFor(state))
  assert.equal(near.doom, 0)
})

test('05198 背面：异教徒敌人按玩家顺序（从队长起）抽取', () => {
  const state = placedState(2, ['lodgeGatesMembers', 'lounge'])
  state.campaign.leadSeat = 1
  state.investigators[0].location = 'lodgeGatesMembers'
  state.investigators[1].location = 'lounge'
  state.encounterDeck = ['05095', '05096']
  const api = apiFor(state)
  fgg.behavior.agendaReveal(state, { code: '05198', originalCode: '05198' }, api)
  const drawn = state.enemies.filter(entry => ['05095', '05096'].includes(entry.code))
  assert.equal(drawn.length, 2)
  assert.equal(drawn[0].engagedSeat, 1, '队长（seat1）先抽')
  assert.equal(drawn[1].engagedSeat, 0)
})

test('05199：银暮秘社敌人移入圣堂地点后失去冷漠，移出后恢复', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs'])
  state.agendas = [{ code: '05199', originalCode: '05199' }]
  state.agendaIndex = 0
  const knight = enemy(state, '05221', 'lodgeGatesMembers')
  knight.aloof = true
  fgg.behavior.enemyMoved(state, knight, 'lodgeGatesMembers', apiFor(state))
  assert.equal(knight.aloof, true, '不在圣堂：保持冷漠')
  knight.location = 'lodgeCatacombs'
  fgg.behavior.enemyMoved(state, knight, 'lodgeGatesMembers', apiFor(state))
  assert.equal(knight.aloof, false, '移入圣堂：失去冷漠')
  knight.location = 'lodgeGatesMembers'
  fgg.behavior.enemyMoved(state, knight, 'lodgeCatacombs', apiFor(state))
  assert.equal(knight.aloof, true, '移出圣堂：恢复冷漠')
})

test('05201 渗透秘社：跨幕持续的反应，且可选择不发动', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const api = apiFor(state)
  fgg.behavior.actReveal(state, { code: '05201', originalCode: '05201' }, api)
  assert.equal(state.scenarioFlags.infiltrationReactionActive, true)
  const enemy1 = enemy(state, '05095', 'lodgeGatesMembers')
  enemy1.doom = 3
  fgg.behavior.afterEvade(state, state.investigators[0], enemy1, { success: true }, apiFor(state))
  assert.equal(enemy1.doom, 0, '选择发动：移除所有毁灭')
  const enemy2 = enemy(state, '05095', 'lodgeGatesMembers')
  enemy2.doom = 2
  fgg.behavior.afterEvade(state, state.investigators[0], enemy2, { success: true }, apiFor(state, { choose: () => 'no' }))
  assert.equal(enemy2.doom, 2, '选择不发动：保留毁灭')
  // 未成功躲避不触发。
  const enemy3 = enemy(state, '05095', 'lodgeGatesMembers')
  enemy3.doom = 2
  fgg.behavior.afterEvade(state, state.investigators[0], enemy3, { success: false }, apiFor(state))
  assert.equal(enemy3.doom, 2)
})

test('05210 休息室揭示：钥匙挂在奥古斯特支援（assetId），地点上没有钥匙', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lounge'])
  const api = apiFor(state)
  fgg.behavior.locationRevealed(state, loc(state, 'lounge'), api)
  const august = state.storyAssets.find(asset => asset.code === '05227')
  assert.ok(august)
  const onAsset = fgg.behavior.keysOnAsset(state, august)
  assert.equal(onAsset.length, 1)
  assert.equal(fgg.behavior.keysOnLocation(state, 'lounge').length, 0)
  // 取地点钥匙行动不应把支援上的钥匙列出。
  state.investigators[0].location = 'lounge'
  assert.equal(fgg.behavior.actions(state, state.investigators[0]).some(move => move.rule === 'takeKeyAtLocation'), false)
})

test('05215 拘禁室：搜索候选由玩家选择（牌库/弃牌堆）', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'sanctumDoorwayHoldingCells'])
  state.encounterDeck = ['05095', '05096']
  state.encounterDiscard = ['05103']
  const api = apiFor(state, { choose: () => '1' })
  fgg.behavior.locationRevealed(state, loc(state, 'sanctumDoorwayHoldingCells'), api)
  const spawned = state.enemies.filter(entry => ['05095', '05096', '05103'].includes(entry.code))
  assert.equal(spawned.length, 1)
  assert.equal(spawned[0].code, '05096', '选择的是第二张候选（05096）')
  assert.deepEqual(state.encounterDeck, ['05095'], '选中的卡从牌库移除')
})

test('05218/05219：生成 - 任意圣堂地点，由玩家选择', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs', 'innerSanctum'])
  state.campaign.leadSeat = 0
  const api = apiFor(state, { choose: request => request.options[request.options.length - 1]?.id })
  const jailorLoc = fgg.behavior.spawnLocation(state, '05218', 'lodgeGatesMembers', null, api)
  assert.ok(['lodgeCatacombs', 'innerSanctum'].includes(jailorLoc))
  assert.equal(jailorLoc, 'innerSanctum', '选择最后一个圣堂地点')
})

test('05219 牢房看门人：躲过 2 点或更多才拿走钥匙', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const inv = state.investigators[0]
  const keeper = enemy(state, '05219', inv.location)
  state.scenarioKeys.skull.enemyId = keeper.id
  state.scenarioKeys.tablet.enemyId = keeper.id
  fgg.behavior.afterEvade(state, inv, keeper, { success: true, value: 5, difficulty: 4 }, apiFor(state))
  assert.equal(state.scenarioKeys.skull.holder, null, '只超过 1 点：不拿钥匙')
  fgg.behavior.afterEvade(state, inv, keeper, { success: true, value: 6, difficulty: 4 }, apiFor(state))
  assert.equal(state.scenarioKeys.skull.holder, 0, '超过 2 点：拿走钥匙')
  assert.equal(state.scenarioKeys.tablet.holder, 0)
})

test('05220 陷阱守卫者被击败：入胜利区后才结算结局 3（胜利点入账）', () => {
  const state = placedState(1, ['lodgeGatesMembers'])
  const beast = enemy(state, '05220', 'lodgeCatacombs')
  const api = apiFor(state)
  fgg.behavior.enemyDefeated(state, beast, api)
  assert.ok(state.victoryDisplay.some(card => card.id === beast.id), '胜利区包含陷阱守卫者')
  assert.equal(state.victoryDisplay.find(card => card.id === beast.id).victory, 2)
  assert.ok(api.calls.some(call => call[0] === 'finish' && call[1] === 'r3'))
})

test('05221 猎物 - 控制最多钥匙：自动命中钥匙最多的调查员', () => {
  const state = placedState(2, ['lodgeGatesMembers'])
  state.scenarioKeys.skull.holder = 0
  state.scenarioKeys.tablet.holder = 0
  state.scenarioKeys.cultist.holder = 1
  const knight = enemy(state, '05221', 'lodgeGatesMembers')
  const pool = fgg.behavior.preyRank(state, knight, [0, 1])
  assert.deepEqual(pool, [0], '钥匙多的调查员是唯一猎物候选')
  // 并列时返回并列集合（由引擎的猎物选择窗口处理）。
  state.scenarioKeys.cultist.holder = 1
  state.scenarioKeys.elderthing.holder = 1
  const tie = fgg.behavior.preyRank(state, knight, [0, 1])
  assert.deepEqual(tie.sort(), [0, 1])
  // 非 05221 敌人不受该钩子影响。
  assert.equal(fgg.behavior.preyRank(state, enemy(state, '05218', 'lodgeGatesMembers'), [0, 1]), null)
})

test('05224 除籍：沿最短路径逐步移动（每步 1 个地点）', () => {
  const state = placedState(2, ['lodgeGatesMembers', 'lodgeCellarMembers', 'lobbyMembers', 'lounge'])
  state.investigators[0].location = 'lodgeGatesMembers'
  const cultist = enemy(state, '05095', 'lounge')
  fgg.behavior.resolveEncounter(state, state.investigators[0],
    { code: '05224', originalCode: '05224', name: '除籍' }, apiFor(state))
  assert.equal(cultist.location, 'lodgeGatesMembers', '沿连接逐步移动到你的地点')
  assert.equal(cultist.engagedSeat, 0)
})

test('05228 机关盒行动声明只豁免幽灵看守人的借机攻击', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs'])
  const inv = state.investigators[0]
  inv.location = 'lodgeCatacombs'
  state.storyAssets.push({ id: 'story:puzzleBox', code: '05228', originalCode: '05228', location: 'lodgeCatacombs' })
  state.scenarioFlags.puzzleBox = { holder: 'seat', seat: 0 }
  state.enemies.push({
    id: 'watcher', code: '05086', originalCode: '05086', name: '幽灵看守人',
    location: 'lodgeCatacombs', traits: [], engagedSeat: null,
  })
  const move = fgg.behavior.actions(state, inv).find(entry => entry.rule === 'puzzleBoxAction')
  assert.ok(move)
  assert.deepEqual(move.noOpportunityAttackFrom, ['05086'])
})

test('05204/05205：秘社大门禁止生成敌人（引擎 spawnForbiddenAt 读点）', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lounge'])
  assert.equal(fgg.behavior.spawnForbiddenAt(state, '05095', 'lodgeGatesMembers'), true)
  assert.equal(fgg.behavior.spawnForbiddenAt(state, '05095', 'lounge'), false)
  assert.equal(fgg.behavior.spawnForbiddenAt(state, '05095', null), false)
})

// ---------------------------------------------------------------------------
// campaign-flow 级回归（第三轮审计后补，Lead 允许）：finishScenario 已从 engine 导出。
// ---------------------------------------------------------------------------
test('05220 结局 3 campaign-flow：击败陷阱守卫者后胜利区重算并发放 2 XP', async () => {
  const engine = await import('../src/engine/engine.js')
  const state = engine.createGameState(
    { campaignId: 'theCircleUndone', seed: 'fgg-r3-xp', playerInvestigator: '01001' },
    [{ seat: 0, role: 'human' }],
  )
  // 直接跳到《崇高利益》（战役第 6 关）并让 campaign flow 指向对应节点。
  state.campaign.scenarioIndex = 5
  state.campaign.flow.nodeId = 'forTheGreaterGood'
  state.campaign.flow.visits = { ...state.campaign.flow.visits, forTheGreaterGood: 1 }
  engine.startScenario(state, 5, [])
  assert.equal(state.scenario.id, 'forTheGreaterGood')
  const beast = {
    id: 'beast:1', code: '05220', originalCode: '05220', name: '陷阱守卫者',
    traits: ['Monster', 'Silver Twilight', 'Elite'], location: state.locations[0]?.id,
  }
  const api = {
    info: () => {},
    finish: key => engine.finishScenario(state, key, []),
    spawn: () => null,
    checkEnemyDefeat: () => {},
    addDoom: () => {},
    damageEnemy: () => {},
    moveEnemy: () => {},
  }
  let ended = null
  try { fgg.behavior.enemyDefeated(state, beast, api) } catch (error) { ended = error }
  assert.ok(ended, 'finishScenario 抛 ScenarioEnded 结束本关')
  assert.match(String(ended.message || ''), /剧本结算完成/)
  // 击败当刻先把陷阱守卫者写入胜利区（行为层修复），再由 finishScenario 从 display 重算。
  assert.deepEqual(state.victoryDisplay.find(card => card.id === beast.id),
    { id: 'beast:1', code: '05220', originalCode: '05220', victory: 2 })
  assert.equal(state.victory, 2, 'finishScenario 从 victoryDisplay 重算胜利点')
  const result = state.campaign.scenarioResults[0]
  assert.equal(result.resolution, 'r3')
  assert.equal(result.victory, 2)
  assert.equal(result.investigators[0].xpAwarded, 2, '胜利点 2 → 每位调查员 2 XP')
  assert.equal(state.campaign.investigators[0].earnedXp, 2, 'campaign 记录同步入账')
  assert.equal(state.campaign.victory, 2)
})

// ---------------------------------------------------------------------------
// 第三轮收口修复回归（05198 生成规则 / 05218+05221+05227 谈判与猎物）
// ---------------------------------------------------------------------------

test('05198 背面：抽到带「生成 - 任意圣堂地点」规则的异教徒敌人时按印刷生成规则生成', () => {
  const state = placedState(2, ['lodgeGatesMembers', 'lodgeCatacombs', 'innerSanctum'])
  state.investigators[0].location = 'lodgeGatesMembers'
  state.investigators[1].location = 'lodgeGatesMembers'
  state.encounterDeck = ['05218']
  const api = apiFor(state, { choose: request => (request.options?.[0]?.id ?? '0') })
  fgg.behavior.agendaReveal(state, { code: '05198', originalCode: '05198' }, api)
  const jailor = state.enemies.find(entry => entry.code === '05218')
  assert.ok(jailor, '抽到的秘社狱卒已生成')
  assert.ok(['lodgeCatacombs', 'innerSanctum'].includes(jailor.location),
    '按卡面「生成 - 任意圣堂地点」生成，而不是抽牌者地点')
  assert.equal(jailor.engagedSeat, null, '不与被抽牌者强制交战')
})

test('05218/05227（以及 05217/05222）谈判行动声明 actionKind=parley（不引发借机攻击）', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lounge'])
  const inv = state.investigators[0]
  inv.location = 'lounge'
  state.enemies.push({ id: 'jailor', code: '05218', originalCode: '05218', name: '秘社狱卒', location: 'lounge', traits: [], doom: 0 })
  state.enemies.push({ id: 'nathan', code: '05217', originalCode: '05217', name: '南森·威克', location: 'lounge', traits: [], doom: 0 })
  state.enemies.push({ id: 'knight', code: '05222', originalCode: '05222', name: '边缘虚空骑士', location: 'lounge', traits: [], doom: 0 })
  state.storyAssets.push({ id: 'story:august', code: '05227', originalCode: '05227', location: 'lounge' })
  const parley = fgg.behavior.actions(state, inv).filter(move => ['parleyNathan', 'parleyJailor', 'parleyKnightOuter', 'parleyAugust'].includes(move.rule))
  assert.equal(parley.length, 4, '四个谈判行动都被列出')
  for (const move of parley) assert.equal(move.actionKind, 'parley', `${move.rule} 必须声明 actionKind=parley`)
})

test('05221 猎物 - 控制最多钥匙：猎人移动并列时由引擎 hunterStep 按 preyRank 裁决', async () => {
  const engine = await import('../src/engine/engine.js')
  const state = engine.createGameState(
    { campaignId: 'theCircleUndone', seed: 'fgg-hunter-preyrank', playerInvestigator: '01001' },
    [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }],
  )
  state.campaign.scenarioIndex = 5
  state.campaign.flow.nodeId = 'forTheGreaterGood'
  engine.startScenario(state, 5, [])
  // 两个调查员与骑士等距（各 1 步），只有猎物排序能区分：座位 0 控制 3 把钥匙、座位 1 控制 1 把。
  state.locations = [
    { id: 'knightHome', code: '05213', originalCode: '05213', name: '骑士所在地', connections: ['north', 'south'], revealed: true, clues: 0, traits: [] },
    { id: 'north', code: '05253', originalCode: '05253', name: '北侧', connections: ['knightHome'], revealed: true, clues: 0, traits: [] },
    { id: 'south', code: '05253', originalCode: '05253', name: '南侧', connections: ['knightHome'], revealed: true, clues: 0, traits: [] },
  ]
  state.investigators[0].location = 'north'
  state.investigators[1].location = 'south'
  const empty = { location: null, enemyId: null, assetId: null }
  state.scenarioKeys = {
    skull: { id: 'skull', label: '骷髅钥匙', holder: 0, ...empty },
    tablet: { id: 'tablet', label: '石板钥匙', holder: 0, ...empty },
    cultist: { id: 'cultist', label: '异教徒钥匙', holder: 0, ...empty },
    elderthing: { id: 'elderthing', label: '古神钥匙', holder: 1, ...empty },
  }
  const knight = {
    id: 'knight:tiebreak', code: '05221', originalCode: '05221', name: '核心圈骑士',
    location: 'knightHome', traits: ['Humanoid', 'Cultist', 'Silver Twilight'],
    health: 9, damageTaken: 0, exhausted: false, engagedSeat: null, hunter: true,
  }
  state.enemies = [knight]
  // preyRank 对两种入参形状（调查员对象 / 座位号）都要返回同形状的过滤结果。
  const objects = [state.investigators[0], state.investigators[1]]
  assert.deepEqual(fgg.behavior.preyRank(state, knight, objects).map(inv => inv.seat), [0])
  assert.deepEqual(fgg.behavior.preyRank(state, knight, [0, 1]), [0])
  assert.equal(engine.hunterStep(state, knight), 'north', '朝控制最多钥匙的 seat0 移动')
})

test('05199 正面：议程翻到 05199 当刻立即同步圣堂银暮秘社敌人的冷漠', () => {
  const state = placedState(2, ['lodgeCatacombs', 'lodgeGatesMembers'])
  state.agendas = [{ code: '05198', originalCode: '05198' }, { code: '05199', originalCode: '05199' }]
  state.agendaIndex = 0
  const knight = {
    id: 'knight', code: '05221', originalCode: '05221', name: '核心圈骑士',
    location: 'lodgeCatacombs', traits: ['Humanoid', 'Cultist', 'Silver Twilight'],
    health: 9, damageTaken: 0, exhausted: false, engagedSeat: null, aloof: true, printedAloof: true,
  }
  state.enemies.push(knight)
  const api = apiFor(state)
  // 议程 1 期间：圣堂地点上的银暮秘社敌人仍保持冷漠。
  fgg.behavior.agendaChain(state, { code: '05198', originalCode: '05198' }, api)
  assert.equal(knight.aloof, true)
  // 翻到 05199 正面当刻（引擎 src/engine/act-agenda.js:206-216 会调 agendaChain）：立即失去冷漠。
  state.agendaIndex = 1
  fgg.behavior.agendaChain(state, { code: '05199', originalCode: '05199' }, api)
  assert.equal(knight.aloof, false, '议程翻面当刻即失去冷漠（不等下一个同步时点）')
  // 离开圣堂后由 enemyMoved 恢复冷漠。
  knight.location = 'lodgeGatesMembers'
  fgg.behavior.enemyMoved(state, knight, 'lodgeCatacombs', api)
  assert.equal(knight.aloof, true)
})

test('05224 除籍：移动走引擎 moveEnemy 并派发 enemyMoved（圣堂银暮秘社敌人即时失去冷漠）', () => {
  const state = placedState(1, ['lodgeGatesMembers', 'lodgeCatacombs', 'innerSanctum'])
  state.agendas = [{ code: '05198', originalCode: '05198' }, { code: '05199', originalCode: '05199' }]
  state.agendaIndex = 1
  const inv = state.investigators[0]
  inv.location = 'innerSanctum'
  const cultist = enemy(state, '05218', 'lodgeCatacombs')
  cultist.aloof = true
  cultist.printedAloof = true
  const api = apiFor(state, {
    // 与引擎 relocateEnemy 同语义：写 location → 派发 behavior.enemyMoved（src/engine/movement.js:317-330）。
    moveEnemy: (target, destination) => {
      const previous = target.location
      api.calls.push(['moveEnemy', target.code, destination])
      target.location = destination
      fgg.behavior.enemyMoved?.(state, target, previous, api)
    },
  })
  fgg.behavior.resolveEncounter(state, inv, { code: '05224', originalCode: '05224', name: '除籍' }, api)
  assert.equal(cultist.location, 'innerSanctum', '逐地移动到你的地点')
  assert.ok(api.calls.some(call => call[0] === 'moveEnemy'), '移动经引擎 api.moveEnemy 派发')
  assert.equal(cultist.aloof, false, '移动到圣堂地点后当刻失去冷漠（enemyMoved 同步）')
  assert.equal(cultist.engagedSeat, 0)
})
