// 验收 08-a 分片 9（eoec 08698–08738）逐卡证据补充。
//
// 覆盖地球边缘共享遭遇、伙伴和纪念物。旧报告的失败项走真实行动、显现和阶段结算。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { fixture, asset, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { initializeTekeliDeck, tekeliDeckSize } from '../src/engine/eote-tekeli.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'

const here = dirname(fileURLToPath(import.meta.url))
const entryRegistry = new Map()
for (const dir of ['edgeOfTheEarth/_shared/hazards_of_antarctica', 'edgeOfTheEarth/_shared/left_behind', 'edgeOfTheEarth/_shared/nameless_horrors', 'edgeOfTheEarth/_shared/miasma', 'edgeOfTheEarth/_shared/penguins', 'edgeOfTheEarth/_shared/shoggoths', 'edgeOfTheEarth/_shared/silence_and_mystery', 'edgeOfTheEarth/_shared/expedition_team', 'edgeOfTheEarth/_shared/tekelili', 'edgeOfTheEarth/_shared/memorials_of_the_lost']) {
  const full = resolve(here, '../src/cards/encounter-entries', dir)
  for (const name of readdirSync(full).filter(entry => entry.endsWith('.js'))) {
    const module = await import(pathToFileURL(resolve(full, name)).href)
    if (module.default) entryRegistry.set(String(module.default.code), module.default)
  }
}

function makeState(extra = {}) {
  const inv = { seat: 0, name: '调查员', location: 'here', damage: 0, horror: 0, clues: 1, resources: 5,
    assets: [], hand: ['01001', '01002'], deck: ['01003'], discard: [], threat: [], engaged: [], defeated: false, resigned: false }
  const state = {
    investigators: [inv], currentSeat: 0, numInvestigators: 1, round: 1, phase: 'investigation',
    locations: [
      { id: 'here', name: 'Here', revealed: true, clues: 1, shroud: 2, connections: ['near'], attachments: [] },
      { id: 'near', name: 'Near', revealed: true, clues: 1, shroud: 1, connections: ['here'], attachments: [] },
    ],
    enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: {}, scenarioZones: {},
    skillTest: null, campaign: { leadSeat: 0, records: {} },
  }
  if (typeof extra === 'function') extra(state)
  else Object.assign(state, extra)
  return state
}

function makeApi(state, options = {}) {
  const calls = {}
  const rec = name => (calls[name] ||= [])
  const choices = options.choices ? [...options.choices] : []
  const tekeli = { deck: options.tekeli ? [...options.tekeli] : ['08723', '08724'] }
  const base = {
    calls,
    info: text => rec('info').push(String(text)),
    choice: request => { rec('choice').push(request); return choices.length ? choices.shift() : request.options?.[0]?.id },
    test: (seat, skill, difficulty, options2 = {}) => {
      const resolveFn = typeof options2 === 'function' ? options2 : options2.resolve
      const result = { success: true, value: 99, difficulty, skill, drawn: options2.drawn || [], cancelled: [], ...(options.testResult || {}) }
      rec('test').push({ seat, skill, difficulty })
      resolveFn?.(result)
      return result
    },
    damage: (seat, n) => { state.investigators[seat].damage += n; rec('damage').push([seat, n]) },
    horror: (seat, n) => { state.investigators[seat].horror += n; rec('horror').push([seat, n]) },
    loseActions: (seat, n) => rec('loseActions').push([seat, n]),
    loseResources: (seat, n) => { state.investigators[seat].resources -= n; rec('loseResources').push([seat, n]) },
    discardRandomFromHand: (seat, n) => { const inv = state.investigators[seat]; inv.hand.splice(0, n); rec('discardRandomFromHand').push([seat, n]) },
    returnClueToLocation: (seat, n) => { const inv = state.investigators[seat]; inv.clues -= n; state.locations.find(l => l.id === inv.location).clues += n; rec('returnClueToLocation').push([seat, n]) },
    discardAsset: (seat, asset) => { const inv = state.investigators[seat]; inv.assets.splice(inv.assets.indexOf(asset), 1); rec('discardAsset').push(asset?.id) },
    investigatorTools: { canDiscardAsset: () => true },
    healDamage: (seat, n) => rec('healDamage').push([seat, n]),
    healHorror: (seat, n) => rec('healHorror').push([seat, n]),
    healAsset: (asset, spec) => rec('healAsset').push([asset?.id, spec]),
    placeAssetHarm: (asset, spec) => rec('placeAssetHarm').push([asset?.id, spec]),
    revealChaosTokens: () => { rec('revealChaosTokens').push(true); return ['0'] },
    tokenLabel: token => token,
    exhaust: target => { target.exhausted = true; rec('exhaust').push(target?.id) },
    attachToLocation: (id, card) => { state.locations.find(l => l.id === id)?.attachments.push(card); rec('attachToLocation').push(id) },
    attachToAsset: (seat, assetId, code) => rec('attachToAsset').push([seat, assetId, code]),
    attachEncounterToEnemy: (code, enemyId) => rec('attachEncounterToEnemy').push([code, enemyId]),
    doomOn: (target, n) => { target.doom = (target.doom || 0) + n; rec('doomOn').push([target?.id, n]) },
    removeDoomFromCard: (target, n) => { target.doom = Math.max(0, (target.doom || 0) - n); rec('removeDoomFromCard').push([target?.id, n]) },
    gainClues: (seat, n) => { state.investigators[seat].clues += n; rec('gainClues').push([seat, n]) },
    discardEnemy: enemy => rec('discardEnemy').push(enemy?.id),
    threat: (seat, code) => rec('threat').push([seat, code]),
    removeThreat: source => rec('removeThreat').push(source?.code),
    gainResources: (seat, n) => { state.investigators[seat].resources += n; rec('gainResources').push([seat, n]) },
    discoverClue: (seat, n) => { state.investigators[seat].clues += n; rec('discoverClue').push([seat, n]) },
    spendUses: (source, n) => { source.uses = Math.max(0, (source.uses || 0) - n); rec('spendUses').push(n) },
    moveInvestigator: (seat, id) => { state.investigators[seat].location = id; rec('moveInvestigator').push([seat, id]) },
    autoEvade: enemy => { enemy.exhausted = true; rec('autoEvade').push(enemy?.id) },
    moveCard: spec => rec('moveCard').push(spec),
    lookAt: (...args) => rec('lookAt').push(args),
    phaseTestBonus: (seat, n) => rec('phaseTestBonus').push([seat, n]),
    cardName: code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
    takeEncounterDeckCard: code => { const i = state.encounterDeck.indexOf(code); if (i < 0) return false; state.encounterDeck.splice(i, 1); return true },
    takeEncounterDiscard: code => { const i = state.encounterDiscard.indexOf(code); if (i < 0) return false; state.encounterDiscard.splice(i, 1); return true },
    spawn: (code, location) => { const enemy = { id: 'e-' + code, code, originalCode: code, name: code, location, doom: 0, engagedSeat: null, traits: [] }; state.enemies.push(enemy); rec('spawn').push([code, location]); return enemy },
    scenario: {
      doomOn: (card, n) => { card.doom = (card.doom || 0) + n; rec('scenarioDoomOn').push(card?.id) },
      moveEnemy: (enemy, location) => { enemy.location = location; rec('moveEnemy').push([enemy?.id, location]) },
      damageEnemy: (id, n, seat, source) => rec('damageEnemy').push([id, n]),
      attack: (enemy, inv) => rec('attack').push([enemy?.id, inv?.seat]),
      lookEncounterTop: () => (state.encounterDeck.length ? [state.encounterDeck.at(-1)] : []),
      discardEncounterCard: code => rec('discardEncounterCard').push(code),
    },
    mechanics: {
      tekeli: {
        size: () => tekeli.deck.length,
        draw: () => tekeli.deck.shift() || null,
        shuffleIn: (seat, count) => tekeli.deck.splice(0, count),
        return: (code, spec) => { if (spec?.destination === 'bottom') tekeli.deck.push(code); return code },
      },
    },
    shuffleEncounterDeck: () => rec('shuffleEncounterDeck').push(true),
  }
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol') return undefined
      return (...args) => { rec(prop).push(args); return undefined }
    },
  })
}

fixture()
registerCardAbilities([...entryRegistry.values()].filter(entry => !registeredEntry(entry.code)))

const entryOf = code => entryRegistry.get(code) || registeredEntry(code)
const owner = state => state.investigators[0]
const codeOf = card => card.originalCode || card.code
const locationOf = state => state.locations.find(location => location.id === owner(state).location)
const attached = (host, code) => host.attachments?.some(card => codeOf(card) === code) ?? false
const optionWith = pattern => pending => pending.options.find(option => pattern.test(String(option.label || '')))?.id

function run(state, resolve, choose = () => null) {
  const execute = draft => resolve(scenarioRuntime(draft, []), draft)
  resolveTransaction(state, 0, { action: 'eoteSharedAcceptance' }, execute)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 120)
    const pending = state.pendingChoice
    const optionId = choose(pending) ?? pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      ?? pending.options[0]?.id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

function reveal(state, code, choose) {
  run(state, runtime => runtime.drawEncounter(0, { code, from: 'search' }), choose)
}

function spawn(state, code, location = owner(state).location) {
  run(state, runtime => runtime.spawn(code, location))
  const enemy = state.enemies.find(candidate => codeOf(candidate) === code)
  assert.ok(enemy, code)
  return enemy
}

function connect(state) {
  const here = locationOf(state)
  const near = { id: 'acceptance-near', name: '相连地点', revealed: true, clues: 0, shroud: 1, connections: [here.id] }
  here.connections.push(near.id)
  state.locations.push(near)
  return near.id
}

function use(state, source, pick = () => true, choose) {
  const command = legalMoves(state).find(option => option.assetId === source.id && option.action === 'ability' && pick(option))
  assert.ok(command, codeOf(source))
  move(state, command)
  settle(state, choose)
}

function buildStateWithEnemies(mods = {}) {
  const state = makeState()
  mods(state)
  return state
}

// ------------------------------------------------------------------ 诡计 08698–08699
test('08698 冰缝：敏捷(3)检定，本次每揭示 1 个 frost 受 1 伤，失败再受 2 伤', () => {
  const state = makeState()
  const api = makeApi(state, { testResult: { success: false, drawn: ['frost', 'frost', '0'] } })
  entryOf('08698').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(api.calls.damage, [[0, 2], [0, 2]])
})

test('08699 穿越冰雪：移动额外敏捷 2 检定，失败停在原位并弃掉附属', () => {
  const state = fixture()
  const start = owner(state).location
  const destination = connect(state)
  reveal(state, '08699')
  assert.ok(attached(locationOf(state), '08699'))
  state.chaosBag = ['autofail']
  move(state, { action: 'move', locationId: destination })
  settle(state)
  assert.equal(state.lastTestResult?.difficulty, 2)
  assert.equal(state.lastTestResult?.skill, 'agility')
  assert.equal(owner(state).location, start)
  assert.equal(owner(state).damage, 1)
  assert.equal(owner(state).horror, 1)
  assert.equal(attached(locationOf(state), '08699'), false)
  assert.ok(state.encounterDiscard.includes('08699'))
})


// ------------------------------------------------------------------ 敌人 08700–08701
test('08700 迷失的研究员：入场带毁灭，谈判翻为线索，击败时将毁灭留在地点', () => {
  const state = fixture()
  owner(state).willpower = 6
  const researcher = spawn(state, '08700')
  assert.equal(researcher.doom, 1)
  const start = owner(state).clues
  const parley = legalMoves(state).find(command => command.action === 'entityAbility' && command.entityId === researcher.id)
  assert.ok(parley)
  move(state, parley)
  settle(state, pending => pending.options.some(option => option.id === 'willpower') ? 'willpower' : null)
  assert.equal(owner(state).clues, start + 1)
  assert.ok(!state.enemies.some(enemy => enemy.id === researcher.id))
  const second = spawn(state, '08700')
  run(state, (runtime, draft) => {
    const enemy = draft.enemies.find(card => card.id === second.id)
    runtime.damageEnemy(enemy.id, 99, 0)
  })
  assert.equal(locationOf(state).doom, 1)
})


test('08701 狂乱的探险家：入场带毁灭，成功躲避达到 2 点可翻为线索', () => {
  const state = fixture()
  const explorer = spawn(state, '08701')
  assert.equal(explorer.doom, 1)
  move(state, { action: 'engage', enemyId: explorer.id })
  settle(state)
  owner(state).agility = 9
  const start = owner(state).clues
  move(state, { action: 'evade', enemyId: explorer.id })
  settle(state, optionWith(/狂乱的探险家|成功躲避且超过难度/))
  assert.equal(owner(state).clues, start + 1)
  assert.ok(!state.enemies.some(enemy => enemy.id === explorer.id))
})


// ------------------------------------------------------------------ 08702–08705
test('08702 身陷疯狂：附属附身敌人并增加攻击、躲避和谈判的检定难度', () => {
  const state = fixture()
  const researcher = spawn(state, '08700')
  reveal(state, '08702')
  const enemy = state.enemies.find(card => card.id === researcher.id)
  assert.ok(attached(enemy, '08702'))
  assert.equal(enemy.doom, 2)
  owner(state).combat = 0
  move(state, { action: 'engage', enemyId: enemy.id })
  settle(state)
  move(state, { action: 'fight', enemyId: enemy.id })
  settle(state)
  assert.equal(state.lastTestResult.difficulty, enemy.fight + 1)
  owner(state).agility = 8
  move(state, { action: 'evade', enemyId: enemy.id })
  settle(state)
  assert.equal(state.lastTestResult.difficulty, enemy.evade + 1)
  owner(state).willpower = 8
  const parley = legalMoves(state).find(command => command.action === 'entityAbility' && command.entityId === enemy.id)
  assert.ok(parley)
  move(state, parley)
  settle(state, pending => pending.options.some(option => option.id === 'willpower') ? 'willpower' : null)
  assert.equal(state.lastTestResult.difficulty, 4)
})


test('08703 渎神幻象：把忒咳哩-哩洗入牌库并令该弱点结算两次', () => {
  const state = fixture()
  initializeTekeliDeck(state, { cards: ['08726'], copies: [1] })
  reveal(state, '08703')
  assert.ok(owner(state).threat.some(card => codeOf(card) === '08703'))
  assert.equal(tekeliDeckSize(state), 0)
  assert.ok(owner(state).deck.includes('08726'))
  owner(state).deck = ['01088', '08726']
  const pool = owner(state).resources
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(owner(state).resources, pool - 4)
  assert.equal(tekeliDeckSize(state), 1)
})


test('08704 窥看不可说之事：先结算忒咳哩-哩，再洗进选定调查员牌库', () => {
  const state = fixture('01001', 2)
  initializeTekeliDeck(state, { cards: ['08726'], copies: [1] })
  const pool = owner(state).resources
  const otherPool = state.investigators[1].resources
  reveal(state, '08704', pending => pending.source === '08704' ? '1' : null)
  assert.equal(owner(state).resources, pool - 2)
  assert.equal(state.investigators[1].resources, otherPool)
  assert.ok(state.investigators[1].deck.includes('08726'))
  assert.equal(tekeliDeckSize(state), 0)
})


test('08705 噩梦烟气：二选一——失去 2 行动，或把 2 张忒咳哩-哩洗入牌库', () => {
  const state = makeState()
  const api = makeApi(state, { choices: ['tekeli'] })
  entryOf('08705').encounterResolve(state, state.investigators[0], {}, api)
  assert.equal(api.calls.loseActions, undefined)
  const state2 = makeState()
  const api2 = makeApi(state2, { choices: ['actions'] })
  entryOf('08705').encounterResolve(state2, state2.investigators[0], {}, api2)
  assert.deepEqual(api2.calls.loseActions, [[0, 2]])
})

// ------------------------------------------------------------------ 08706–08707
test('08706 瘴气折磨：横置伙伴，在回合末伤害伙伴并阻止重整', () => {
  const state = fixture()
  const partner = asset(state, '08716', { partner: true })
  reveal(state, '08706')
  const current = () => owner(state).assets.find(card => card.id === partner.id)
  assert.ok(attached(current(), '08706'))
  assert.equal(current().exhausted, true)
  move(state, { action: 'endTurn' })
  settle(state, pending => pending.source === '08706' ? 'damage' : null)
  assert.equal(current().damage, 1)
  assert.equal(current().exhausted, true)

  owner(state).willpower = 8
  const infection = current().attachments.find(card => codeOf(card) === '08706')
  const clear = legalMoves(state).find(command => command.action === 'entityAbility' && command.entityId === infection.id)
  assert.ok(clear)
  move(state, clear)
  settle(state, pending => pending.source === '08706' ? 'willpower' : null)
  assert.equal(state.lastTestResult.difficulty, 3)
  assert.equal(attached(current(), '08706'), false)
  assert.ok(state.encounterDiscard.includes('08706'))
})


test('08707 朦胧瘴气：回合结束给调查员和支援各 1 直接恐惧，轮末弃除自身', () => {
  const state = fixture()
  const ally = asset(state, '08716', { partner: true })
  reveal(state, '08707')
  assert.ok(attached(locationOf(state), '08707'))
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(owner(state).horror, 1)
  assert.equal(owner(state).assets.find(card => card.id === ally.id).horror, 1)
  assert.equal(attached(locationOf(state), '08707'), false)
  assert.ok(state.encounterDiscard.includes('08707'))
})


// ------------------------------------------------------------------ 08708–08711
test('08708 巨型白化企鹅：冷漠，进入或离开企鹅所在地额外花费 1 行动', () => {
  const state = fixture()
  const start = owner(state).location
  const destination = connect(state)
  const penguin = spawn(state, '08708', destination)
  assert.equal(penguin.engagedSeat, null)
  for (const locationId of [destination, start]) {
    owner(state).actionsLeft = 1
    assert.notEqual(validateMove(state, 0, { action: 'move', locationId }), null)
    owner(state).actionsLeft = 2
    move(state, { action: 'move', locationId })
    settle(state)
    assert.equal(owner(state).actionsLeft, 0)
    assert.equal(owner(state).location, locationId)
  }
})


test('08709 呜啊！呜啊！呜啊！：离你最远的企鹅移动到你处或放 1 毁灭', () => {
  const state = buildStateWithEnemies(s => { s.enemies.push({ id: 'p1', code: '08708', originalCode: '08708', location: 'near', defeated: false }) })
  const api = makeApi(state, { choices: ['doom'] })
  entryOf('08709').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(api.calls.doomOn, [['p1', 1]])
})

test('08710 失落的修格斯：交战立即结算弱点并还到底，空牌库时改为攻击', () => {
  const state = fixture()
  initializeTekeliDeck(state, { cards: ['08724'], copies: [1] })
  const shoggoth = spawn(state, '08710')
  move(state, { action: 'engage', enemyId: shoggoth.id })
  settle(state)
  assert.equal(state.enemies.find(card => card.id === shoggoth.id).engagedSeat, 0)
  assert.equal(owner(state).damage, 1)
  assert.equal(tekeliDeckSize(state), 1)

  const empty = fixture()
  assert.equal(tekeliDeckSize(empty), 0)
  const attacking = spawn(empty, '08710')
  move(empty, { action: 'engage', enemyId: attacking.id })
  settle(empty)
  assert.equal(owner(empty).damage, attacking.damage)
  assert.equal(owner(empty).horror, attacking.horror)
})


test('08711 狂暴的修格斯：+2/人生命；敌军阶段结束本地调查员与非修格斯敌人各 2 伤', () => {
  const state = buildStateWithEnemies(s => {
    s.numInvestigators = 2
    s.enemies.push({ id: 'sh', code: '08711', originalCode: '08711', location: 'here' })
    s.enemies.push({ id: 'other', code: '08708', originalCode: '08708', location: 'here' })
    s.investigators.push({ ...s.investigators[0], seat: 1, name: '二号', engaged: [] })
  })
  const api = makeApi(state)
  const entry = entryOf('08711')
  assert.equal(entry.modifiers[0].amount({ state }), 4)
  const forced = entry.abilities.find(a => a.trigger?.includes('enemyPhaseEnds'))
  forced.resolve({ state, inv: state.investigators[0], source: state.enemies[0], api })
  assert.deepEqual(api.calls.damage, [[0, 2], [1, 2]])
  assert.deepEqual(api.calls.damageEnemy, [['other', 2]])
})

// ------------------------------------------------------------------ 08712–08713
test('08712 极地幻景：调查附属地点并发现线索后，仅弃掉非弱点手牌并弃除幻景', () => {
  const state = fixture()
  owner(state).intellect = 8
  owner(state).hand = ['01088', '01016', '08130']
  locationOf(state).clues = 2
  reveal(state, '08712')
  assert.ok(attached(locationOf(state), '08712'))
  move(state, { action: 'investigate' })
  settle(state)
  assert.deepEqual(owner(state).hand, ['08130'])
  assert.ok(owner(state).discard.includes('01088'))
  assert.ok(owner(state).discard.includes('01016'))
  assert.equal(attached(locationOf(state), '08712'), false)
  assert.ok(state.encounterDiscard.includes('08712'))
})


test('08713 黑暗极光：意志(3)，本次每揭示 1 个 frost 受 1 恐，失败再受 2 恐', () => {
  const state = makeState()
  const api = makeApi(state, { testResult: { success: false, drawn: ['frost', '0'] } })
  entryOf('08713').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(api.calls.horror, [[0, 1], [0, 2]])
})

// ------------------------------------------------------------------ 伙伴 08714–08722
test('08714 威廉·戴尔教授：花 1 秘密横置治愈同地点调查员 2 恐惧', () => {
  const state = makeState()
  const source = { id: 'dyer', code: '08714', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state)
  entryOf('08714').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.healHorror, [[0, 2]])
})

test('08715 丹佛斯：真实结算忒咳哩-哩后横置并花秘密让结算者抽两张', () => {
  const state = fixture()
  const partner = asset(state, '08715')
  owner(state).deck = ['01016', '01088', '08726']
  const pool = owner(state).resources
  move(state, { action: 'draw' })
  settle(state, optionWith(/丹佛斯/))
  const current = owner(state).assets.find(card => card.id === partner.id)
  assert.equal(current.exhausted, true)
  assert.equal(current.uses, 4)
  assert.equal(owner(state).resources, pool - 2)
  assert.deepEqual(owner(state).hand, ['01088', '01016'])
})


test('08716 伊里亚·阿什瓦克：花 1 秘密横置，以基础 5 敏捷躲避并可移动', () => {
  const state = makeState(s => { s.enemies.push({ id: 'e3', code: '08708', originalCode: '08708', location: 'here', evade: 3 }) })
  const source = { id: 'eliyah', code: '08716', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['skip'] })
  entryOf('08716').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.equal(api.calls.test[0].skill, 'agility')
  assert.deepEqual(api.calls.autoEvade, ['e3'])
})

test('08717 玛拉·辛哈医生：花 1 补给横置治愈同地点调查员 2 伤害', () => {
  const state = makeState()
  const source = { id: 'sinha', code: '08717', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state)
  entryOf('08717').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.healDamage, [[0, 2]])
})

test('08718 艾弗里·克莱普尔：察觉 frost 时花补给取消并改揭新标记', () => {
  const state = makeState(s => { s.skillTest = { seat: 0 } })
  const source = { id: 'avery', code: '08718', uses: 5, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state)
  const context = { when: 'tokenReveal', token: 'frost' }
  const ability = entryOf('08718').abilities[0]
  assert.equal(ability.criteria({ state, inv: state.investigators[0], context }), true)
  ability.resolve({ context, api })
  assert.equal(context.replacementToken, '0')
  assert.equal(api.calls.revealChaosTokens.length, 1)
})

test('08719 “曲奇”·弗雷德里克斯：实际攻击以基础战斗 5，非精英本轮无法借机攻击', () => {
  const state = fixture()
  const partner = asset(state, '08719')
  const enemy = spawn(state, '08701')
  move(state, { action: 'engage', enemyId: enemy.id })
  settle(state)
  use(state, partner, command => command.targetId === enemy.id)
  assert.equal(state.lastTestResult.baseValue, 5)
  const ready = state.enemies.find(card => card.id === enemy.id)
  assert.equal(ready.damageTaken, 1)
  assert.equal(owner(state).assets.find(card => card.id === partner.id).uses, 2)
  assert.equal(ready.engagedSeat, 0)
  assert.equal(ready.attackProtection[0], state.round)
  move(state, { action: 'resource' })
  settle(state)
  assert.equal(owner(state).damage, 0)
  assert.equal(owner(state).horror, 0)
})


test('08720 艾米·肯斯勒博士：基础 5 智力调查成功后查看顶牌并可弃掉', () => {
  const state = makeState()
  const source = { id: 'kensler', code: '08720', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  state.encounterDeck.push('08723')
  const api = makeApi(state, { choices: ['encounter', 'discard'] })
  entryOf('08720').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.equal(api.calls.test[0].skill, 'intellect')
  assert.deepEqual(api.calls.discoverClue, [[0, 1]])
  assert.deepEqual(api.calls.discardEncounterCard, ['08723'])
})

test('08721 罗尔德·埃尔斯沃思：横置花补给，令选定地点附属在本回合失效', () => {
  const state = fixture()
  const destination = connect(state)
  const partner = asset(state, '08721')
  reveal(state, '08699')
  use(state, partner)
  const source = owner(state).assets.find(card => card.id === partner.id)
  assert.equal(source.uses, 4)
  assert.equal(source.exhausted, true)
  const start = locationOf(state)
  assert.equal(start.attachments.find(card => codeOf(card) === '08699').textBlankTurn, state.turnSerial)
  state.chaosBag = ['autofail']
  move(state, { action: 'move', locationId: destination })
  settle(state)
  assert.equal(owner(state).location, destination)
  assert.equal(owner(state).damage, 0)
  assert.equal(owner(state).horror, 0)
  assert.ok(attached(state.locations.find(location => location.id === start.id), '08699'))
})


test('08722 高田弘子：横置把最多 3 资源移入调查员资源池', () => {
  const state = makeState()
  const source = { id: 'takada', code: '08722', uses: 9, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['3'] })
  entryOf('08722').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.equal(source.uses, 6)
  assert.deepEqual(api.calls.gainResources, [[0, 3]])
})

// ------------------------------------------------------------------ Tekeli-li 08723–08729
for (const [code, kind, amount] of [['08723', 'horror', 1], ['08724', 'damage', 1], ['08725', 'hand', 1], ['08726', 'resources', 2]]) {
  test(`${code} 忒咳哩-哩：显现效果后回到忒咳哩-哩牌库底`, () => {
    const state = makeState()
    const api = makeApi(state)
    const entry = entryOf(code)
    const weakness = entry.abilities.find(a => a.kind === 'weakness')
    weakness.resolve({ state, inv: state.investigators[0], api })
    const key = kind === 'hand' ? 'discardRandomFromHand' : kind === 'resources' ? 'loseResources' : kind
    const call = api.calls[key] || []
    assert.equal(call.length, 1)
    assert.equal(entry.flags.returnToTekeliliDeckBottom, true)
  })
}

test('08727 忒咳哩-哩：当前自己回合或下一自己回合失去 1 行动', () => {
  const state = fixture()
  owner(state).deck = ['08727']
  const actions = owner(state).actionsLeft
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(owner(state).actionsLeft, actions - 2)

  const later = fixture()
  owner(later).deck = ['01088', '08727']
  move(later, { action: 'endTurn' })
  settle(later)
  assert.equal(owner(later).actionsLeft, 2, '重整阶段抽弱点让下一个回合的行动从 3 降到 2')
})


test('08728 忒咳哩-哩：真实抽取的弱点把调查员的 1 个线索移到所在地', () => {
  const state = fixture()
  owner(state).clues = 1
  owner(state).deck = ['08728']
  const before = locationOf(state).clues
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(locationOf(state).clues, before + 1)
  assert.equal(owner(state).clues, 0)
})


test('08729 忒咳哩-哩：弃掉 1 张受控支援后回牌库底', () => {
  const state = makeState()
  state.investigators[0].assets.push({ id: 'a1', code: '01020' })
  const api = makeApi(state)
  entryOf('08729').abilities[0].resolve({ state, inv: state.investigators[0], api })
  assert.deepEqual(api.calls.discardAsset, ['a1'])
})

// ------------------------------------------------------------------ 纪念物 08730–08738
test('08730 克莱普尔的皮草：察觉 frost 时受伤 1 点取消并改揭新标记', () => {
  const state = makeState(s => { s.skillTest = { seat: 0 } })
  const source = { id: 'furs', code: '08730' }
  state.investigators[0].assets.push(source)
  const api = makeApi(state)
  const context = { when: 'tokenReveal', token: 'frost' }
  const ability = entryOf('08730').abilities[0]
  assert.equal(ability.criteria({ state, inv: state.investigators[0], source, context }), true)
  ability.resolve({ source, context, api })
  assert.deepEqual(api.calls.placeAssetHarm, [[source.id, { damage: 1 }]])
  assert.equal(context.replacementToken, '0')
})

test('08731 爱伦·坡作品集：支付行动和充能，将顶 6 张中的忒咳哩-哩归还并抽一张', () => {
  const state = fixture()
  initializeTekeliDeck(state, { cards: ['08723'], copies: [1] })
  const book = asset(state, '08731')
  owner(state).deck = ['01027', '01088', '01016', '01020', '08724', '01022', '01010']
  use(state, book)
  const current = owner(state).assets.find(card => card.id === book.id)
  assert.equal(current.uses, 2)
  assert.equal(owner(state).hand.length, 1)
  assert.equal(tekeliDeckSize(state), 2)
  assert.ok(!owner(state).deck.includes('08724'))
})


test('08732 曲奇的特制 .32：真实枪击基础战斗 5，消耗一枚子弹且造成 2 伤害', () => {
  const state = fixture()
  const gun = asset(state, '08732')
  const enemy = spawn(state, '08701')
  use(state, gun, command => command.targetId === enemy.id,
    pending => pending.source === '08732' ? 'base5' : null)
  assert.equal(state.lastTestResult.baseValue, 5)
  assert.equal(state.enemies.some(card => card.id === enemy.id), false)
  assert.ok(state.encounterDiscard.includes('08701'))
  assert.equal(owner(state).assets.find(card => card.id === gun.id).uses, 1)
})


test('08733 戴尔的素描：场景快速事件抽 3 张牌', () => {
  const state = fixture()
  state.investigators[0].hand = ['08733']
  state.campaign.investigators[0].deck.push('08733')
  state.investigators[0].deck = ['01088', '01016', '01020', '01022']
  state.investigators[0].actionsLeft = 0
  const play = legalMoves(state).find(command => command.action === 'play' && command.cardId === '08733')
  assert.ok(play)
  move(state, play)
  settle(state)
  const inv = state.investigators[0]
  assert.deepEqual(inv.hand, ['01022', '01020', '01016'])
  assert.deepEqual(inv.deck, ['01088'])
  assert.ok(inv.discard.includes('08733'))
  assert.equal(inv.actionsLeft, 0)
})

test('08734 埃尔斯沃思的靴子：本地最后一个线索被发现后横置移动或弃卡移动', () => {
  const state = makeState()
  const source = { id: 'boots', code: '08734', exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['move:near'] })
  const ability = entryOf('08734').abilities[0]
  assert.equal(ability.criteria({ state, inv: state.investigators[0], source, context: { lastClue: true, location: 'here' } }), true)
  ability.resolve({ state, inv: state.investigators[0], source, api })
  assert.equal(state.investigators[0].location, 'near')
  assert.equal(source.exhausted, true)
})

test('08735 肯斯勒的日志：基础 5 或 +2 智力调查，成功后额外 1 线索', () => {
  const state = makeState()
  const source = { id: 'log', code: '08735', uses: 2, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['base5'] })
  entryOf('08735').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.discoverClue, [[0, 1], [0, 1]])
})

test('08736 辛哈的医药箱：花 1 补给横置治愈同地点调查员 1 伤害或 1 恐惧', () => {
  const state = makeState()
  const source = { id: 'kit', code: '08736', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['damage'] })
  entryOf('08736').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.healDamage, [[0, 1]])
})

test('08737 高田的物品：快速获得 3 资源并抽 1 张牌，然后移出本场游戏', () => {
  const state = fixture()
  state.investigators[0].hand = ['08737']
  state.campaign.investigators[0].deck.push('08737')
  state.investigators[0].deck = ['01016', '01088']
  state.investigators[0].resources = 0
  state.investigators[0].actionsLeft = 0
  const play = legalMoves(state).find(command => command.action === 'play' && command.cardId === '08737')
  assert.ok(play)
  move(state, play)
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.resources, 3)
  assert.deepEqual(inv.hand, ['01088'])
  assert.deepEqual(inv.deck, ['01016'])
  assert.equal(inv.actionsLeft, 0)
  assert.equal(inv.discard.includes('08737'), false)
  assert.ok(state.removedFromGame.includes('08737'))
})

test('08738 安雨：横置选择移动 / 本轮下次检定 +2 / 基础 4 敏捷躲避', () => {
  const state = makeState()
  const source = { id: 'anyu', code: '08738', exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['bonus'] })
  entryOf('08738').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.phaseTestBonus, [[0, 2]])
})
