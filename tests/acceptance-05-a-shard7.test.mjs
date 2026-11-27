// 验收测试：05-a 万象无终 · 分片 7（icc 05273–05312）
// 覆盖 17 张既有测试标题不含卡号的卡（05286a/05286b/05287/05288a/05288b/05289、
// 05291/05293/05295/05296/05297/05298/05301/05302/05303/05304/05305）：
// 每个用例标题含卡号，走内容层真实行为钩子/地点条目并断言可观察状态。
import test from 'node:test'
import assert from 'node:assert/strict'
// 地点规则已迁回单卡条目：先加载引擎装配点，locationRuleFor(code) 才能读到条目。
import { scenarioRuntime } from '../src/engine/engine.js'
import * as clutches from '../content/campaigns/theCircleUndone/scenarios/inTheClutchesOfChaos/index.js'
import { scenario as definition } from '../content/campaigns/theCircleUndone/scenarios/inTheClutchesOfChaos/definition.js'
import { addBreach, removeBreach, breachOf } from '../src/engine/location-state.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const clone = value => structuredClone(value)
const actBreaches = state => Number(state.acts?.[state.actIndex]?.breaches || 0)
const setActBreaches = (state, value) => {
  const act = state.acts?.[state.actIndex]
  if (act) act.breaches = Math.max(0, Math.floor(value))
  return actBreaches(state)
}

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
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'southsideA',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    doom: 0,
    campaign: {
      leadSeat: 0,
      records: { ...records },
      investigators: Array.from({ length: count }, (_, seat) => ({
        id: `inv${seat}`, deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 },
      })),
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

function placeLocations(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    assert.ok(base, `缺少地点定义 ${id}`)
    if (state.locations.some(location => location.id === id)) continue
    state.locations.push({
      ...clone(base), id, revealed: true, doom: 0, breaches: 0, attachments: [],
      clues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
    })
  }
}

const loc = (state, id) => state.locations.find(location => location.id === id)
const byCode = (state, code) => state.locations.find(location =>
  (location.originalCode || location.code) === code)

function setup(state, { seed = 41 } = {}) {
  const rng = setupApi(seed)
  const placed = clutches.behavior.setupLocations(state, [], rng)
  placeLocations(state, placed)
  clutches.behavior.afterDeckSetup(state, [], {
    randomValue: rng.randomValue, shuffle: rng.shuffle, info: () => {},
  })
  return state
}

// 手动放入指定卡号地点（六对同名地点只随机放一版；对另一版单独验收时直接放入）。
// 同时清掉布置阶段的初始裂口，让每个地点用例从确定状态开始。
function withLocation(state, id) {
  placeLocations(state, [id])
  const location = loc(state, id)
  if (location) delete location.breaches
  return location
}

function apiFor(state, options = {}) {
  const calls = {
    info: [], damage: [], horror: [], drawn: [], spawned: [], traits: [], shuffled: 0,
    finished: [], discardedHand: [], discardedAssets: [], replay: [], attached: [],
  }
  const choices = [...(options.choices || [])]
  const testResult = options.testResult || { success: true, value: 3, difficulty: 3 }
  const api = {
    addCluesToLocation: scenarioRuntime(state, []).addCluesToLocation,
    calls,
    info: text => calls.info.push(String(text)),
    random: options.random || (() => 0.37),
    shuffle: list => [...list],
    choose: request => (choices.length ? choices.shift() : (request?.options?.[0]?.id ?? 'skip')),
    test: (seat, skill, difficulty, resolve) => {
      const result = { ...testResult, difficulty, skill }
      if (result.value == null) result.value = difficulty
      resolve(result)
      return result
    },
    breach: (id, amount = 1) => { addBreach(state, id, amount); return breachOf(loc(state, id)) },
    removeBreach: (id, amount = 1) => removeBreach(state, id, amount),
    moveBreachesToAct: (locationId, amount = 1) => {
      const location = loc(state, locationId)
      if (!location) return 0
      const moved = Math.min(Number(location.breaches || 0), Math.max(0, Number(amount) || 0))
      if (moved <= 0) return 0
      removeBreach(state, locationId, moved)
      setActBreaches(state, actBreaches(state) + moved)
      return moved
    },
    randomLocationIds: count => state.locations.map(location => location.id)
      .slice(0, Math.max(0, Math.min(count, state.locations.length))),
    spawn: (code, locationId) => {
      const enemy = { id: `enemy-${state.enemies.length}`, code, originalCode: code, location: locationId, doom: 0 }
      state.enemies.push(enemy)
      calls.spawned.push({ code, location: locationId })
      return enemy
    },
    damage: (seat, amount) => { state.investigators[seat].damage += amount; calls.damage.push([seat, amount]) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; calls.horror.push([seat, amount]) },
    finish: key => { state.scenarioFlags.finishedKey = key; calls.finished.push(key) },
    payClues: count => { calls.paid = count },
    advanceAct: () => { calls.advanced = (calls.advanced || 0) + 1 },
    drawEncounter: seat => {
      const code = state.encounterDeck.pop()
      if (code) state.encounterDiscard.push(code)
      calls.drawn.push({ seat, code })
      return code
    },
    drawEncounterByTrait: (trait, seat) => {
      calls.traits.push(String(trait))
      const wanted = String(trait || '').toLowerCase()
      const index = (state.encounterDeck || []).findIndex(code => {
        const def = ALL_CARDS[code]
        return def?.type === 'enemy' && (def.traits || []).some(value => String(value).toLowerCase() === wanted)
      })
      if (index < 0) return null
      const [code] = state.encounterDeck.splice(index, 1)
      state.encounterDiscard.push(code)
      calls.drawn.push({ seat, code })
      return code
    },
    shuffleEncounterDeck: () => { calls.shuffled += 1 },
    discardOneFromHand: (seat, options2 = {}) => {
      const owner = state.investigators[seat]
      if (!(owner.hand || []).length) return null
      const [code] = owner.hand.splice(0, 1)
      ;(owner.discard ||= []).push(code)
      calls.discardedHand.push({ seat, code, source: options2.source })
      return code
    },
    discardOneAsset: (seat, options2 = {}) => {
      const owner = state.investigators[seat]
      const asset = (owner.assets || [])[0]
      if (!asset) return null
      owner.assets = owner.assets.filter(entry => entry !== asset)
      ;(owner.discard ||= []).push(asset.code)
      calls.discardedAssets.push({ seat, code: asset.code, source: options2.source })
      return asset.code
    },
    discardTop: (seat, count = 1) => {
      const owner = state.investigators[seat]
      const discarded = []
      for (let index = 0; index < count && (owner.deck || []).length; index++) {
        const code = owner.deck.pop()
        ;(owner.discard ||= []).push(code)
        discarded.push(code)
      }
      return discarded
    },
    discardEncounterTop: (count = 1) => {
      const discarded = []
      for (let index = 0; index < count && (state.encounterDeck || []).length; index++) {
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      return discarded
    },
    loseResources: (seat, amount) => {
      const owner = state.investigators[seat]
      const lost = Math.min(owner.resources || 0, Number(amount) || 0)
      owner.resources -= lost
      return lost
    },
    replayEncounterRevelation: (seat, code) => { calls.replay.push({ seat, code }) },
    attachEncounterToLocation: (code, locationId) => {
      const location = loc(state, locationId)
      if (!location) return null
      location.attachments ||= []
      const attachment = { id: `locatt-${location.id}-${location.attachments.length + 1}`, code }
      location.attachments.push(attachment)
      calls.attached.push({ code, locationId })
      return attachment
    },
    detachLocationAttachment: (locationId, attachmentId) => {
      const location = loc(state, locationId)
      if (!location?.attachments) return null
      const index = location.attachments.findIndex(item => item.id === attachmentId)
      if (index < 0) return null
      return location.attachments.splice(index, 1)[0]
    },
    resign: seat => { state.investigators[seat].resigned = true },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    place: id => placeLocations(state, [id]),
    remove: id => { state.locations = state.locations.filter(location => location.id !== id) },
    exhaust: enemy => { enemy.exhausted = true },
    doomOn: (card, amount = 1) => { card.doom = (Number(card.doom) || 0) + amount },
    ...(options.api || {}),
  }
  return api
}

function findCard(predicate) {
  return Object.keys(ALL_CARDS).find(code => predicate(ALL_CARDS[code]))
}

// ===========================================================================
// 批次 B：幕 / 首领 05286a–05289
// ===========================================================================

test('05286a 黑暗知识(一)：全队 3×人数线索必须立即花费推进；背面生成安妮特并把幕裂口带到下一幕', () => {
  const state = setup(stateFor(2, { anetteMasonIsPossessedByEvil: true }))
  assert.deepEqual(state.acts.map(act => act.originalCode), ['05286a', '05287'])
  assert.equal(state.acts[0].objective.type, 'clues')
  assert.equal(state.acts[0].objective.perInvestigator, 3)
  const inv = state.investigators[0]
  inv.location = state.scenarioFlags.startLocation
  // [free]：移除本幕 3 个裂口 → 在一个随机地点放置 1 个线索。
  setActBreaches(state, 3)
  const actApi = apiFor(state)
  const freeMove = clutches.behavior.fastActions(state, inv).find(move => move.rule === 'removeActBreaches')
  assert.ok(freeMove, '幕上裂口 ≥3 时应出现 [free] 行动')
  assert.equal(freeMove.actions, 0)
  const cluesBefore = state.locations.reduce((sum, location) => sum + (location.clues || 0), 0)
  clutches.behavior.performAction(state, inv, freeMove, actApi)
  assert.equal(actBreaches(state), 0)
  assert.equal(state.locations.reduce((sum, location) => sum + (location.clues || 0), 0), cluesBefore + 1)
  // 目标：线索合计未达标不推进；达标后立即花费并推进。
  const api = apiFor(state)
  state.investigators[0].clues = 3
  state.investigators[1].clues = 2
  clutches.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanced || 0, 0)
  state.investigators[1].clues = 3
  clutches.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanced, 1, '6 个线索达标后立即推进')
  assert.equal(api.calls.paid, 6, '必须立即花费所需线索')
  // 背面：生成安妮特·梅森于绞刑者山丘（05302）。
  clutches.behavior.actReveal(state, state.acts[0], apiFor(state))
  const boss = state.enemies.find(enemy => enemy.originalCode === '05286b')
  assert.ok(boss, '幕背面生成安妮特·梅森')
  assert.equal(boss.location, byCode(state, '05302').id)
})

test('05286b 安妮特·梅森：生成在绞刑者山丘、每线索生命-2；其地点放裂口后每位调查员受伤或恐惧', () => {
  const state = setup(stateFor(2, { anetteMasonIsPossessedByEvil: true }))
  clutches.behavior.actReveal(state, state.acts[0], apiFor(state))
  const boss = state.enemies.find(enemy => enemy.originalCode === '05286b')
  assert.equal(boss.location, byCode(state, '05302').id)
  state.investigators[0].clues = 2
  state.investigators[1].clues = 1
  assert.equal(clutches.behavior.enemyStatModifier(state, boss, 'health'), -6, '每有 1 个线索生命 -2')
  const bossLocation = loc(state, boss.location)
  delete bossLocation.breaches
  const api = apiFor(state)
  clutches.behavior.placeBreachesAt(state, api, boss.location, 1)
  assert.equal(bossLocation.breaches, 1)
  assert.deepEqual(api.calls.damage, [[0, 1], [1, 1]], '每位调查员受到 1 点伤害（默认选伤害）')
})

test('05287 坟墓彼端：目标是击败安妮特·梅森，背面进入结局 1', () => {
  const state = setup(stateFor(2, { anetteMasonIsPossessedByEvil: true }))
  assert.equal(state.acts[1].objective.type, 'defeatEnemy')
  assert.equal(state.acts[1].objective.enemy, '05286b')
  clutches.behavior.actReveal(state, state.acts[1], apiFor(state))
  assert.equal(state.scenarioFlags.finishedKey, 'r1')
})

test('05288a 黑暗知识(二)：全队线索目标与背面生成卡尔于银暮秘社终焉之地', () => {
  const state = setup(stateFor(2))
  assert.equal(state.scenarioFlags.variant, 'secrets')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['05288a', '05289'])
  assert.equal(state.acts[0].objective.perInvestigator, 3)
  const api = apiFor(state)
  state.investigators[0].clues = 4
  state.investigators[1].clues = 2
  clutches.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanced, 1)
  assert.equal(api.calls.paid, 6)
  clutches.behavior.actReveal(state, state.acts[0], apiFor(state))
  const boss = state.enemies.find(enemy => enemy.originalCode === '05288b')
  assert.ok(boss, '幕背面生成卡尔·桑福德')
  assert.equal(boss.location, byCode(state, '05305').id, '生成于银暮秘社（宇宙之秘线 05305）')
})

test('05288b 卡尔·桑福德：每线索生命-2；幕裂口被移除后把 1 个裂口放到其所在地点', () => {
  const state = setup(stateFor(2))
  clutches.behavior.actReveal(state, state.acts[0], apiFor(state))
  const carl = state.enemies.find(enemy => enemy.originalCode === '05288b')
  assert.ok(carl)
  state.investigators[0].clues = 1
  state.investigators[1].clues = 2
  assert.equal(clutches.behavior.enemyStatModifier(state, carl, 'health'), -6)
  setActBreaches(state, 3)
  const carlLocation = loc(state, carl.location)
  delete carlLocation.breaches
  const api = apiFor(state)
  const removed = clutches.behavior.removeActBreaches(state, api, 2)
  assert.equal(removed, 2)
  assert.equal(actBreaches(state), 1)
  assert.equal(carlLocation.breaches, 1, '移除的裂口之一放到卡尔所在地点')
})

test('05289 世界新秩序：目标是击败卡尔·桑福德，背面进入结局 2', () => {
  const state = setup(stateFor(2))
  assert.equal(state.acts[1].objective.type, 'defeatEnemy')
  assert.equal(state.acts[1].objective.enemy, '05288b')
  clutches.behavior.actReveal(state, state.acts[1], apiFor(state))
  assert.equal(state.scenarioFlags.finishedKey, 'r2')
})

// ===========================================================================
// 批次 C：地点 05291/05293/05295/05296/05297/05298/05301/05302/05303/05304/05305
// ===========================================================================

test('05291 法兰西山（检定版）：意志(2)成功且每超出 1 点，把 1 个裂口移到当前幕', () => {
  const state = setup(stateFor(1))
  const location = withLocation(state, 'frenchHillB')
  assert.equal(location.originalCode, '05291')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 3)
  const move = clutches.behavior.actions(state, inv).find(m => m.rule === 'locWillpowerBreach')
  assert.ok(move)
  // 恰好成功（差值 0）不移裂口。
  clutches.behavior.performAction(state, inv, move,
    apiFor(state, { testResult: { success: true, value: 2, difficulty: 2 } }))
  assert.equal(location.breaches, 3)
  // 超出 2 点 → 移 2 个裂口到当前幕。
  clutches.behavior.performAction(state, inv, move,
    apiFor(state, { testResult: { success: true, value: 4, difficulty: 2 } }))
  assert.equal(location.breaches, 1)
  assert.equal(actBreaches(state), 2)
})

test('05293 河岸城（检定版）：智识(2)成功且每超出 1 点，把 1 个裂口移到当前幕', () => {
  const state = setup(stateFor(1))
  const location = withLocation(state, 'rivertownB')
  assert.equal(location.originalCode, '05293')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 2)
  const move = clutches.behavior.actions(state, inv).find(m => m.rule === 'locIntellectBreach')
  assert.ok(move)
  clutches.behavior.performAction(state, inv, move,
    apiFor(state, { testResult: { success: true, value: 3, difficulty: 2 } }))
  assert.equal(location.breaches, 1)
  assert.equal(actBreaches(state), 1)
})

test('05295 南区（弃手牌版）：每弃 1 张手牌把 1 个裂口移到当前幕', () => {
  const state = setup(stateFor(1))
  const location = withLocation(state, 'southsideB')
  assert.equal(location.originalCode, '05295')
  const inv = state.investigators[0]
  inv.location = location.id
  inv.hand = ['01025', '01026', '01027']
  addBreach(state, location.id, 3)
  const move = clutches.behavior.fastActions(state, inv).find(m => m.rule === 'locSouthsideHandBreaches')
  assert.ok(move)
  assert.equal(move.actions, 0)
  const api = apiFor(state, { choices: ['2'] })
  clutches.behavior.performAction(state, inv, move, api)
  assert.equal(api.calls.discardedHand.length, 2, '弃 2 张')
  assert.equal(inv.hand.length, 1)
  assert.equal(location.breaches, 1)
  assert.equal(actBreaches(state), 2)
})

test('05296 住宅区（弃牌版）：只按敏捷图标计数，wild 图标不算', () => {
  const agility2 = findCard(card => card.type === 'event' && (card.icons?.agility || 0) >= 2)
  assert.ok(agility2, '需要一张带 ≥2 敏捷图标的事件卡')
  const wild = findCard(card => card.type === 'event' && (card.icons?.wild || 0) > 0 && !(card.icons?.agility > 0))
  assert.ok(wild, '需要一张只有 wild 图标的事件卡')
  const state = setup(stateFor(1))
  const location = withLocation(state, 'uptownA')
  assert.equal(location.originalCode, '05296')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 3)
  inv.hand = [wild]
  const move = clutches.behavior.actions(state, inv).find(m => m.rule === 'locDiscardIconBreach')
  assert.ok(move)
  const wildApi = apiFor(state)
  clutches.behavior.performAction(state, inv, move, wildApi)
  assert.equal(wildApi.calls.discardedHand.length, 1)
  assert.equal(location.breaches, 2, 'wild 图标不算：只移 1 个')
  inv.hand = [agility2]
  clutches.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal(location.breaches || 0, 0, '1 + 2 个敏捷图标 = 移 3 个（上限为地点裂口数）')
  assert.equal(actBreaches(state), 3)
})

test('05297 住宅区（检定版）：敏捷(2)成功且每超出 1 点，把 1 个裂口移到当前幕', () => {
  const state = setup(stateFor(1))
  const location = withLocation(state, 'uptownB')
  assert.equal(location.originalCode, '05297')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 3)
  const move = clutches.behavior.actions(state, inv).find(m => m.rule === 'locAgilityBreach')
  assert.ok(move)
  clutches.behavior.performAction(state, inv, move,
    apiFor(state, { testResult: { success: true, value: 4, difficulty: 2 } }))
  assert.equal(location.breaches, 1)
  assert.equal(actBreaches(state), 2)
})

test('05298 南区教堂（抽遭遇版）：抽 1 张遭遇牌后把所有裂口移到当前幕；另有撤退行动', () => {
  const state = setup(stateFor(1))
  const location = withLocation(state, 'southChurchA')
  assert.equal(location.originalCode, '05298')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 2)
  state.encounterDeck = ['05090', '05091']
  const move = clutches.behavior.actions(state, inv).find(m => m.rule === 'locSouthChurchDraw')
  assert.ok(move)
  const api = apiFor(state)
  clutches.behavior.performAction(state, inv, move, api)
  assert.equal(api.calls.drawn.length, 1, '抽取 1 张遭遇牌')
  assert.equal(location.breaches || 0, 0)
  assert.equal(actBreaches(state), 2)
  // 撤退。
  const resign = clutches.behavior.actions(state, inv).find(m => m.rule === 'locResign')
  assert.ok(resign)
  clutches.behavior.performAction(state, inv, resign, apiFor(state))
  assert.equal(inv.resigned, true)
})

test('05301 商人区（付资源版）：支付 2 资源把 1 个裂口移到当前幕', () => {
  const state = setup(stateFor(1))
  const location = withLocation(state, 'merchantDistrictB')
  assert.equal(location.originalCode, '05301')
  const inv = state.investigators[0]
  inv.location = location.id
  inv.resources = 5
  addBreach(state, location.id, 2)
  const move = clutches.behavior.fastActions(state, inv).find(m => m.rule === 'locMerchantPay')
  assert.ok(move)
  assert.equal(move.actions, 0)
  clutches.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal(inv.resources, 3)
  assert.equal(location.breaches, 1)
  assert.equal(actBreaches(state), 1)
})

test('05302 绞刑者山丘（受诅咒的歌）：查找遭遇牌库/弃牌堆的女巫敌人并抽取，然后把裂口移到当前幕', () => {
  const state = setup(stateFor(1, { anetteMasonIsPossessedByEvil: true }))
  const location = withLocation(state, 'hangmansHillMusic')
  assert.equal(location.originalCode, '05302')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 2)
  const witch = findCard(card => card.type === 'enemy'
    && (card.traits || []).some(trait => String(trait).toLowerCase() === 'witch'))
  state.encounterDeck = ['05306', witch]
  const move = clutches.behavior.actions(state, inv).find(m => m.rule === 'locHangmansHillSearch')
  assert.ok(move)
  const api = apiFor(state)
  clutches.behavior.performAction(state, inv, move, api)
  assert.deepEqual(api.calls.traits, ['Witch'], '按 [[女巫]] 特性查找敌人')
  assert.equal(api.calls.drawn.at(-1).code, witch, '抽取找出的女巫敌人')
  assert.equal(location.breaches || 0, 0)
  assert.equal(actBreaches(state), 2)
  assert.equal(api.calls.shuffled, 1, '混洗遭遇牌库')
})

test('05303 银暮秘社（受诅咒的歌）：受到 1 点恐惧把 1 个裂口移到当前幕', () => {
  const state = setup(stateFor(1, { anetteMasonIsPossessedByEvil: true }))
  const location = withLocation(state, 'silverTwilightMusic')
  assert.equal(location.originalCode, '05303')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 1)
  const move = clutches.behavior.fastActions(state, inv).find(m => m.rule === 'locLodgeHorror')
  assert.ok(move)
  assert.equal(move.actions, 0)
  clutches.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal(inv.horror, 1)
  assert.equal(location.breaches || 0, 0)
  assert.equal(actBreaches(state), 1)
})

test('05304 绞刑者山丘（宇宙之秘）：受到 1 点伤害把 1 个裂口移到当前幕', () => {
  const state = setup(stateFor(1))
  const location = withLocation(state, 'hangmansHillSecrets')
  assert.equal(location.originalCode, '05304')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 1)
  const move = clutches.behavior.fastActions(state, inv).find(m => m.rule === 'locHangmansDamage')
  assert.ok(move)
  clutches.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal(inv.damage, 1)
  assert.equal(location.breaches || 0, 0)
  assert.equal(actBreaches(state), 1)
})

test('05305 银暮秘社（宇宙之秘）：查找遭遇牌库/弃牌堆的银暮秘社敌人并抽取，然后把裂口移到当前幕', () => {
  const state = setup(stateFor(1))
  const location = withLocation(state, 'silverTwilightSecrets')
  assert.equal(location.originalCode, '05305')
  const inv = state.investigators[0]
  inv.location = location.id
  addBreach(state, location.id, 2)
  const lodge = findCard(card => card.type === 'enemy'
    && (card.traits || []).some(trait => String(trait).toLowerCase() === 'silver twilight'))
  state.encounterDeck = ['05306', lodge]
  const move = clutches.behavior.actions(state, inv).find(m => m.rule === 'locLodgeSearch')
  assert.ok(move)
  const api = apiFor(state)
  clutches.behavior.performAction(state, inv, move, api)
  assert.deepEqual(api.calls.traits, ['Silver Twilight'])
  assert.equal(api.calls.drawn.at(-1).code, lodge)
  assert.equal(location.breaches || 0, 0)
  assert.equal(actBreaches(state), 2)
  assert.equal(api.calls.shuffled, 1)
})
