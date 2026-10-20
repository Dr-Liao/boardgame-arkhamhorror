import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SCENARIOS, SCENARIO_CARD_IDENTITIES, CAMPAIGN } from '../src/cards/scenarios-data.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { allCardDefs, createGameState, applyMove, validateMove } from '../src/engine/engine.js'
import { getScenarioCardIdentity, resolveCardIdentity, cardIdentityFields } from '../src/cards/card-identity.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { registeredEntry } from '../src/engine/ability.js'
import { weaknessProfile } from '../src/engine/lifecycle.js'

const types = { scenario: 'scenario', locations: 'location', acts: 'act', agendas: 'agenda', enemies: 'enemy', treacheries: 'treachery', storyAssets: 'asset' }

test('NOTZ 全部77手写组件及3场景逐项映射到实际卡号与类型', () => {
  let count = 0
  const originalCodes = new Set()
  for (const [scenarioId, scenario] of Object.entries(SCENARIOS)) {
    for (const [category, type] of Object.entries(types)) {
      const definitions = category === 'scenario' ? { [scenarioId]: scenario }
        : Array.isArray(scenario[category]) ? Object.fromEntries(scenario[category].map(card => [card.id, card])) : scenario[category] || {}
      assert.deepEqual(Object.keys(SCENARIO_CARD_IDENTITIES[scenarioId][category]).sort(), Object.keys(definitions).sort())
      for (const [ruleId, definition] of Object.entries(definitions)) {
        const identity = getScenarioCardIdentity(scenarioId, category, ruleId)
        assert.ok(identity, `${scenarioId}/${category}/${ruleId}`)
        assert.equal(ALL_CARDS[identity.originalCode]?.type, type)
        assert.equal(definition.originalCode, identity.originalCode)
        assert.equal(definition.ruleId, ruleId)
        assert.equal(resolveCardIdentity(definition, { scenarioId, category }).originalCode, identity.originalCode)
        originalCodes.add(identity.originalCode)
        count++
      }
    }
  }
  assert.equal(count, 80)
  assert.equal(originalCodes.size, 78)
})

test('地点变体按具体卡号映射，午夜议程和敌人保留真实关联面', () => {
  assert.equal(SCENARIOS.theMidnightMasks.locations.southside.originalCode, '01126')
  assert.equal(SCENARIOS.theMidnightMasks.locations.downtown.originalCode, '01130')
  const woods = SCENARIOS.theDevourerBelow.woodsPool.map(id => SCENARIOS.theDevourerBelow.locations[id].originalCode)
  assert.deepEqual(woods.sort(), ['01150', '01151', '01152', '01153', '01154', '01155'])
  assert.equal(getScenarioCardIdentity('theMidnightMasks', 'agendas', 'agenda1').originalCode, '01121a')
  assert.equal(resolveCardIdentity('theMaskedHunter').originalCode, '01121b')
  assert.equal(resolveCardIdentity('01121a').linkedOriginalCode, '01121b')
  assert.equal(resolveCardIdentity('01121'), null)
  assert.equal(resolveCardIdentity('01145').linkedOriginalCode, null)
})

test('关键变体和关联编号与只读 Haskell CardDefs 交叉核对', () => {
  const root = new URL('../../../参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/', import.meta.url)
  const read = relative => readFileSync(new URL(relative, root), 'utf8')
  for (const [file, codes] of [
    ['Location/CardDefs/NightOfTheZealot/TheMidnightMasks.hs', ['01126', '01130']],
    ['Location/CardDefs/NightOfTheZealot/TheDevourerBelow.hs', ['01150', '01151', '01152', '01153', '01154', '01155']],
    ['Agenda/CardDefs/NightOfTheZealot/TheMidnightMasks.hs', ['01121a']],
    ['Enemy/CardDefs/NightOfTheZealot/TheMidnightMasks.hs', ['01121b']],
  ]) for (const code of codes) assert.ok(read(file).includes(`"${code}"`), `${file}: ${code}`)
})

test('规则别名、实例ID、美术ID分离，歧义和伪造身份不猜配', () => {
  const enemy = resolveCardIdentity({ id: 'e42', code: 'icyGhoul', art: 'explicit-art' })
  assert.equal(enemy.originalCode, '01119')
  assert.equal(enemy.ruleId, 'icyGhoul')
  assert.equal(enemy.instanceId, 'e42')
  assert.equal(enemy.artId, 'explicit-art')
  assert.equal(resolveCardIdentity('icyGhoul').artId, null)
  assert.equal(resolveCardIdentity('act1'), null)
  assert.equal(resolveCardIdentity('act1', { scenarioId: 'theGathering', category: 'acts' }).originalCode, '01108')
  assert.equal(resolveCardIdentity({ id: 'e42', code: 'icyGhoul', originalCode: '01116' }), null)
  assert.equal(resolveCardIdentity('冰封食尸鬼'), null)
  assert.equal(resolveCardIdentity('__proto__'), null)
  assert.equal(resolveCardIdentity(CAMPAIGN), null)
  assert.equal(getScenarioCardIdentity('__proto__', 'acts', 'act1'), null)
})

test('近似身份明确解释，不冒充规则等价；查询不修改共享映射', () => {
  const entries = Object.values(SCENARIO_CARD_IDENTITIES).flatMap(categories => Object.values(categories).flatMap(Object.values))
  const approximations = entries.filter(identity => identity.approximation)
  assert.deepEqual(approximations.map(i=>i.originalCode).sort(), ['01104','01120','01142'])
  assert.ok(approximations.every(identity => identity.identityStatus === 'approximation' && identity.identityReason))
  const agenda = getScenarioCardIdentity('theDevourerBelow', 'agendas', 'agenda3')
  assert.equal(agenda.originalCode, '01145')
  assert.match(agenda.identityReason, /不能虚构01145b/)
  agenda.originalCode = 'changed'
  assert.equal(getScenarioCardIdentity('theDevourerBelow', 'agendas', 'agenda3').originalCode, '01145')
})

test('遭遇堆、异教徒堆、使者组及实际开局地点都可解析', () => {
  for (const scenario of Object.values(SCENARIOS)) {
    for (const code of [...(scenario.encounterDeck || []), ...(scenario.cultistDeck || []), ...Object.values(scenario.agentSets || {}).flat()]) {
      assert.ok(resolveCardIdentity(code), `${scenario.id}: ${code}`)
    }
  }
  const state = createGameState({ playerInvestigator: '01001' }, [{ seat: 0, name: 'Player' }])
  for (const location of state.locations) assert.ok(resolveCardIdentity(location, { scenarioId: state.scenario.id, category: 'locations' }))
  const defs = allCardDefs({ runtimeOnly: true })
  for (const code of Object.keys(defs)) assert.ok(resolveCardIdentity(code), code)
  assert.equal(defs.icyGhoul.originalCode, '01119')
  assert.equal(defs['01117'].originalCode, '01117')
})

function finishOptionalChoices(state) {
  let steps = 0
  while (state.pendingChoice) {
    assert.ok(steps++ < 40, '可选回答应在有限步内结束')
    const move = state.legalMoves.find(move => ['keep', 'done', 'skip', 'confirm'].includes(move.optionId))
    assert.ok(move, `身份夹具必须明确回答：${state.pendingChoice.kind}`)
    const seat = state.pendingChoice.seat
    assert.equal(validateMove(state, seat, move), null)
    applyMove(state, seat, move)
  }
}

function instanceFixture() {
  const state = createGameState({ playerInvestigator: '01001' }, [{ seat: 0, name: 'Player' }])
  finishOptionalChoices(state)
  state.investigators[0].hand = []
  state.investigators[0].deck = ['01016']
  state.chaosBag = ['0']
  return state
}

function execute(state, action) {
  assert.equal(validateMove(state, 0, action), null)
  applyMove(state, 0, action)
  finishOptionalChoices(state)
}

function assertInstance(instance, ruleId, originalCode) {
  assert.ok(instance, ruleId)
  assert.equal(instance.code, ruleId)
  assert.equal(instance.ruleId, ruleId)
  assert.equal(instance.originalCode, originalCode)
  assert.ok(['mapped', 'approximation'].includes(instance.identityStatus))
  assert.notEqual(instance.id, ruleId)
  const restored = JSON.parse(JSON.stringify(instance))
  assert.equal(restored.originalCode, originalCode)
  assert.equal(resolveCardIdentity(restored).instanceId, instance.id)
}

test('身份投影保留身份及显式美术字段，不复制实例ID或规则状态', () => {
  const def = { ...SCENARIOS.theMidnightMasks.agendas[0], variant: 'explicit-variant', artId: 'explicit-art', id: 'do-not-copy', counters: 3 }
  const fields = cardIdentityFields(def)
  assert.equal(fields.originalCode, '01121a')
  assert.equal(fields.haskellCardCode, '01121a')
  assert.equal(fields.linkedOriginalCode, '01121b')
  assert.equal(fields.variant, 'explicit-variant')
  assert.equal(fields.artId, 'explicit-art')
  assert.equal(cardIdentityFields({ code: 'icyGhoul', art: 'legacy-art' }).artId, 'legacy-art')
  assert.equal(Object.hasOwn(fields, 'id'), false)
  assert.equal(Object.hasOwn(fields, 'counters'), false)
  assert.equal(cardIdentityFields(ALL_CARDS['01016']).ruleId, '01016')
  assert.deepEqual(cardIdentityFields(null), {})
})

test('抽取弱点的真实执行路径保留威胁与敌人身份、计数器和实例ID', () => {
  for (const code of ['01007', '01009', '01011', '01098', '01099', '01100', '01101', '01102', '01103']) {
    const state = instanceFixture()
    state.investigators[0].deck = [code]
    execute(state, { action: 'draw' })
    if (ALL_CARDS[code].type === 'enemy') {
      assertInstance(state.enemies.find(enemy => enemy.code === code), code, code)
    } else {
      const threat = state.investigators[0].threat.find(card => card.code === code)
      assertInstance(threat, code, code)
      // Phase 5：弱点档案的唯一读点（描述子优先、旧 DSL 回落）。
      const profile = weaknessProfile(code)
      assert.equal(threat.counters, profile.clues ?? profile.horror)
    }
  }
})

test('神话阶段抽取持续诡计后，威胁实例直接携带原号而不只保留别名', () => {
  for (const [ruleId, code] of [['frozenInFear', '01164'], ['dissonantVoices', '01165']]) {
    const state = instanceFixture()
    state.encounterDeck = [ruleId]
    state.encounterDiscard = []
    execute(state, { action: 'endTurn' })
    assertInstance(state.investigators[0].threat.find(card => card.code === ruleId), ruleId, code)
  }
})

test('正常打出资产保留身份、费用、使用次数及未耗竭状态', () => {
  const state = instanceFixture()
  state.investigators[0].hand = ['01016']
  const resources = state.investigators[0].resources
  execute(state, { action: 'play', cardId: '01016' })
  const asset = state.investigators[0].assets.find(card => card.code === '01016')
  assertInstance(asset, '01016', '01016')
  assert.equal(asset.exhausted, false)
  assert.equal(asset.uses, registeredEntry('01016').uses)
  assert.equal(state.investigators[0].resources, resources - ALL_CARDS['01016'].cost)
})

test('幕推进局部夹具生成丽塔和首领时，实例保留原号及近似说明', () => {
  const state = instanceFixture()
  state.actIndex = 1
  state.encounterDeck = ['dissonantVoices']
  state.encounterDiscard = []
  state.clues = 3
  state.investigators[0].clues = 3
  state.locations = ['hallway', 'parlor'].map(id => ({ ...SCENARIOS.theGathering.locations[id], clues: 0 }))
  state.investigators[0].location = 'hallway'
  assert.equal(validateMove(state, 0, { action: 'endTurn' }), null)
  applyMove(state, 0, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'act')
  applyMove(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'advance' })
  assert.equal(state.pendingChoice.kind, 'payment')
  applyMove(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: '3' })
  finishOptionalChoices(state)
  assert.ok(!state.investigators[0].assets.some(card => card.code === '01117'))
  const lita = state.storyAssets.find(card => card.code === '01117')
  assertInstance(lita, '01117', '01117')
  assert.equal(lita.exhausted, false)
  assert.ok(!lita.approximation)
  assert.equal(lita.identityReason, SCENARIOS.theGathering.storyAssets['01117'].identityReason)
  assertInstance(state.enemies.find(enemy => enemy.code === 'ghoulPriest'), 'ghoulPriest', '01116')
})

test('谈判取得丽塔的独立路径保留身份和近似说明', () => {
  const state = instanceFixture()
  state.locations.push({ ...SCENARIOS.theGathering.locations.parlor, clues: 0 })
  state.investigators[0].location = 'parlor'
  state.investigators[0].intellect = 6
  state.actIndex = 2
  state.enemies = [{ id: 'priest', code: 'ghoulPriest', location: 'hallway', health: 5, damageTaken: 0 }]
  state.storyAssets = [{ id: 'lita-test', code: '01117', ...cardIdentityFields(SCENARIOS.theGathering.storyAssets['01117']), location: 'parlor', controllerSeat: null, exhausted: false }]
  execute(state, { action: 'parleyLita' })
  const lita = state.investigators[0].assets.find(card => card.code === '01117')
  assertInstance(lita, '01117', '01117')
  assert.equal(lita.exhausted, false)
  assert.equal(lita.identityStatus, 'mapped')
  assert.equal(lita.identityReason, SCENARIOS.theGathering.storyAssets['01117'].identityReason)
})
