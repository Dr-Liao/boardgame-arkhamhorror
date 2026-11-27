// 08-a 地球边缘 · 分片 6（08573b–08607）独立验收证据。
//
// 覆盖 fatalMirage（08573b–08595）与 toTheForbiddenPeaks（08596–08607）全部 45 张：
//   · 地点与剧情翻面、记忆敌人与猎物、坚毅伙伴能力、山峰爬升；
//   · 旧报告缺口通过角色行动、显现或强制结算复验。
import test from 'node:test'
import assert from 'node:assert/strict'

import { scenarioRuntime } from '../src/engine/engine.js'
import { contentRegistry } from '../content/registered.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { asset, enemy, fixture, legalMoves, move, settle } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'
import {
  actRuleFor, agendaRuleFor, entryFlags, locationRuleFor,
} from '../src/cards/card-rules.js'
import { setLocationLevel, locationLevel } from '../src/engine/vertical-chain.js'
import { initializeTekeliDeck, tekeliDeckSize } from '../src/engine/eote-tekeli.js'
import * as fatalMirage from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js'
import * as fmDef from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js'
import * as peaks from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/index.js'
import * as peaksDef from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js'

const fm = fatalMirage.behavior
const tp = peaks.behavior

const clone = value => JSON.parse(JSON.stringify(value))
function stateFor(count = 1, records = {}, flags = {}) {
  return {
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, location: 'prisonOfMemories', damage: 0, horror: 0, clues: 0,
      resources: 5, assets: [], engaged: [], deck: [], discard: [], hand: [], threat: [], defeated: false, resigned: false,
    })),
    locations: [], enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: { ...flags },
    scenarioZones: { setAside: [], setAsideLocations: [] },
    campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], scenarioResults: [], partners: {},
      trauma: {}, investigators: {}, resolutePartners: [] },
    victoryDisplay: [], doom: 0, chaosBag: [], difficulty: 'standard', numInvestigators: count,
    phase: 'investigation', round: 1, status: 'playing',
  }
}
const entryOf = code => registeredEntry(code)
const hasStoryVictory = (state, code) => (state.victoryDisplay || []).some(item => String(item?.code ?? item) === code)

// ---------------------------------------------------------------------------
// 08573b–08583b 记忆剧情卡（11）
// ---------------------------------------------------------------------------
for (const code of ['08573b', '08574b']) {
  test(`${code} 地点记忆剧情：伙伴活着时生成放一边的记忆敌人，伙伴被划掉时放逐记忆并允许推进`, () => {
    const entry = entryOf(code)
    assert.ok(entry, `${code} 条目已注册`)
    assert.equal(entry.implemented, true)
    const flip = entry.flags.storyFlip
    assert.ok(flip.memoryEnemy, '条目声明 storyFlip.memoryEnemy')
    // 伙伴活着：生成放一边的记忆敌人。
    const alive = stateFor()
    alive.encounters = []
    alive.locations = [{ id: 'here', code: '08573', revealed: true, clues: 0 }]
    alive.investigators[0].location = 'here'
    alive.scenarioZones.setAside = [flip.memoryEnemy]
    alive.campaign.partners[flip.partner] = { code: flip.partner, status: 'alive' }
    const result = fm.flipStoryFace(alive, code, {}, { location: 'here', inv: alive.investigators[0] })
    assert.equal(result.spawnEnemy, flip.memoryEnemy, '伙伴活着：生成记忆敌人')
    assert.equal(alive.enemies.length, 1)
    assert.equal(alive.scenarioZones.setAside.includes(flip.memoryEnemy), false, '从放一边区取出')
    // 伙伴被划掉：搬回记忆囚笼、剧情卡进胜利区、允许推进。
    const dead = stateFor()
    dead.locations = [{ id: 'here', code: '08573', revealed: true, clues: 0 }]
    dead.investigators[0].location = 'here'
    dead.scenarioZones.setAside = [flip.memoryEnemy]
    dead.campaign.partners[flip.partner] = { code: flip.partner, status: 'crossedOut' }
    const banished = fm.flipStoryFace(dead, code, {}, { location: 'here', inv: dead.investigators[0] })
    assert.equal(banished.banished, true, '伙伴被划掉：放逐记忆')
    assert.equal(dead.investigators[0].location, 'prisonOfMemories', '调查员回到记忆囚笼')
    assert.ok(hasStoryVictory(dead, code), '剧情卡进胜利区')
    assert.equal(dead.scenarioFlags.fatalMirageMayAdvance, true, '允许推进当前幕')
  })
}
for (const code of fmDef.MEMORY_STORY_CODES || []) {
  test(`${code} 记忆敌人剧情：记录直面内心恶魔、伙伴切换坚毅、进胜利区并允许推进`, () => {
    const entry = entryOf(code)
    assert.ok(entry)
    assert.ok(entry.flags.storyFlip.resolutePartner, '声明坚毅伙伴卡号')
    const state = stateFor()
    state.locations = [{ id: 'here', code: '08573', revealed: true, clues: 0 }]
    const result = fm.flipStoryFace(state, code, {}, { location: 'here', inv: state.investigators[0] })
    assert.ok(result.confronted, '返回直面内心恶魔结果')
    assert.ok(hasStoryVictory(state, code), '记忆剧情卡进胜利区')
    assert.equal(state.scenarioFlags.fatalMirageMayAdvance, true)
    assert.ok((state.campaign.resolutePartners || []).includes(entry.flags.storyFlip.resolutePartner))
    const recordKey = Object.entries(fmDef && {} ).length // placeholder to keep eslint happy
    assert.ok(recordKey === 0)
    const recordKeys = ['dyerHasConfrontedHisDemons', 'danforthHasConfrontedHisDemons', 'eliyahHasConfrontedHisDemons',
      'drSinhaHasConfrontedHerDemons', 'claypoolHasConfrontedHisDemons', 'cookieHasConfrontedHisDemons',
      'drKenslerHasConfrontedHerDemons', 'ellsworthHasConfrontedHisDemons', 'takadaHasConfrontedHerDemons']
    assert.ok(recordKeys.some(key => state.campaign.records[key] === true), '写入战役日志布尔记录')
  })
}


function mirageGame(count = 1, id = 'theBlackStone') {
  const state = fixture('01001', count)
  state.scenario = structuredClone(contentRegistry.getScenarioData('fatalMirage'))
  state.acts = structuredClone(state.scenario.acts)
  state.agendas = structuredClone(state.scenario.agendas)
  state.actIndex = state.agendaIndex = 0
  state.locations = []
  state.scenarioFlags = {}
  state.scenarioZones = { setAside: [] }
  state.campaign.id = 'edgeOfTheEarth'
  const location = fm.placeLocation(state, id)
  Object.assign(location, { shroud: 4, clues: 4 })
  for (const inv of state.investigators) inv.location = location.id
  return { state, location }
}

const takeReaction = choice => choice.kind === 'reaction'
  ? choice.options.find(option => option.id !== 'skip')?.id : null

function execute(state, effect, select = takeReaction) {
  const invoke = draft => effect(draft, scenarioRuntime(draft, []))
  resolveTransaction(state, 0, { action: '08-a6-evidence' }, invoke)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 40, '验收选择必须在有限步数内完成')
    const choice = state.pendingChoice
    const optionId = select(choice) ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, invoke)
  }
}

function activate(state, entityId, select = takeReaction) {
  const action = legalMoves(state, 0).find(candidate =>
    ['entityAbility', 'ability'].includes(candidate.action) && (candidate.entityId || candidate.assetId) === entityId
    && !candidate.reason)
  assert.ok(action, entityId + ' 应有可提交的特殊能力')
  move(state, action)
  settle(state, select)
}

test('08574 黑色岩石：克莱普尔降低帷幕 2，添加寒霜取得 2 线索且团队仅可一次', () => {
  const { state, location } = mirageGame()
  const shroud = () => scenarioRuntime(state, []).locationShroud(location.id, 0, { includeLocationState: true })
  assert.equal(shroud(), 4)
  asset(state, '08718')
  assert.equal(shroud(), 2)
  const actions = state.investigators[0].actionsLeft
  activate(state, location.id)
  assert.equal(state.chaosBag.filter(token => token === 'frost').length, 1)
  assert.equal(state.investigators[0].clues, 2)
  assert.equal(state.investigators[0].actionsLeft, actions)
  assert.equal(legalMoves(state, 0).some(candidate => candidate.entityId === location.id && !candidate.reason), false)
})

for (const code of fmDef.MEMORY_ENEMY_CODES) {
  test(code + ' 记忆敌人：真实击败翻面，背面进入胜利区', () => {
    const { state } = mirageGame()
    const target = enemy(state, { code, originalCode: code, health: 8 })
    execute(state, (draft, api) => api.damageEnemy(target.id, 12, 0))
    assert.equal(state.enemies.some(card => card.id === target.id), false)
    assert.ok(hasStoryVictory(state, code + 'b'))
  })
}

for (const [code, companion] of Object.entries({
  '08575': '08716', '08576': '08717', '08577': '08722', '08578': '08719', '08579': '08714',
  '08580': '08715', '08581': '08718', '08582': '08721', '08583': '08720',
})) {
  test(code + ' 记忆敌人：有两个同地点调查员时优先交战对应伙伴的控制者', () => {
    const { state } = mirageGame(2)
    asset(state, companion, {}, 1)
    execute(state, (draft, api) => {
      const target = api.spawn(code, draft.investigators[0].location)
      api.resolveEnemyPhaseOf(target)
    })
    const target = state.enemies.find(card => (card.originalCode || card.code) === code)
    assert.ok(target)
    assert.equal(target.engagedSeat, 1)
  })
}

const memoryEffects = {
  '08575': [3, ({ state, target }) => {
    state.investigators[0].agility = 8
    move(state, { action: 'evade', enemyId: target.id })
    settle(state, takeReaction)
  }],
  '08576': [2, ({ state }) => {
    state.investigators[0].damage = 2
    const doctor = asset(state, '08590')
    activate(state, doctor.id)
  }],
  '08577': [1, ({ state }) => {
    move(state, { action: 'resource' })
    settle(state, takeReaction)
  }],
  '08578': [1, ({ state, target }) => {
    execute(state, (draft, api) => api.attack(draft.enemies.find(card => card.id === target.id), draft.investigators[0]))
  }],
  '08579': [2, ({ state }) => execute(state, (draft, api) => api.drawCards(0, 2))],
  '08580': [3, ({ state, target }) => {
    initializeTekeliDeck(state, { cards: ['08723', '08724', '08725', '08726', '08727', '08728', '08729'] })
    const before = tekeliDeckSize(state)
    const actions = state.investigators[0].actionsLeft
    activate(state, target.id)
    assert.equal(tekeliDeckSize(state), before - 3)
    assert.equal(state.investigators[0].actionsLeft, actions - 2)
  }],
  '08581': [4, ({ state, target }) => {
    const actions = state.investigators[0].actionsLeft
    activate(state, target.id)
    assert.equal(state.chaosBag.filter(token => token === 'frost').length, 1)
    assert.equal(state.investigators[0].actionsLeft, actions - 1)
  }],
  '08582': [4, ({ state, target, location }) => {
    scenarioRuntime(state, []).attachEncounterToLocation('08585', location.id)
    execute(state, (draft, api) => api.exhaustEnemy(draft.enemies.find(card => card.id === target.id)))
  }],
  '08583': [2, ({ state, location }) => execute(state, (draft, api) => api.discoverClue(0, 2, location.id))],
}
for (const [code, [damage, activateEffect]] of Object.entries(memoryEffects)) {
  test(code + ' 记忆敌人：真实专属反应或谈判对敌人造成 ' + damage + ' 伤害', () => {
    const { state, location } = mirageGame()
    const target = enemy(state, { code, originalCode: code, health: 10, fight: 2, evade: 2, damage: 1,
      exhausted: ['08576', '08577', '08579'].includes(code) })
    activateEffect({ state, location, target })
    assert.equal(state.enemies.find(card => card.id === target.id)?.damageTaken, damage)
  })
}

test('08584 恐怖阴影：幻景破除前冷漠，发现或取得线索各放等量毁灭', () => {
  const { state, location } = mirageGame()
  state.scenarioZones.setAside = ['08581']
  const target = enemy(state, { code: '08584', originalCode: '08584', aloof: true, hunter: true, engagedSeat: null })
  const mayFight = () => legalMoves(state, 0).some(action => action.action === 'fight' && action.enemyId === target.id && !action.reason)
  assert.equal(mayFight(), false)
  state.investigators[0].clues = fm.mirageFlipCost(state, location.id)
  const flip = legalMoves(state, 0).find(candidate => candidate.rule === 'mirageFlip:' + location.id && !candidate.reason)
  assert.ok(flip)
  move(state, flip)
  settle(state)
  assert.equal(fm.isClearedOfMirages(state, location.id), true)
  assert.equal(mayFight(), true)
  execute(state, (draft, api) => api.discoverClue(0, 2, location.id))
  execute(state, (draft, api) => api.takeControlOfClues(0, 1, location.id))
  assert.equal(state.enemies.find(card => card.id === target.id).doom, 3)
})

test('08585 易散之雾：实际显现附属并增加 2 线索，破除幻景时付额外线索后弃置', () => {
  const { state, location } = mirageGame()
  state.scenarioZones.setAside = ['08581']
  const before = location.clues
  state.encounterDeck = ['08585']
  execute(state, (draft, api) => api.drawEncounter(0))
  const current = () => state.locations.find(card => card.id === location.id)
  assert.equal(current().clues, before + 2)
  assert.ok(current().attachments.some(card => card.code === '08585'))
  const cost = fm.mirageFlipCost(state, location.id)
  state.investigators[0].clues = cost + 2
  const flip = legalMoves(state, 0).find(candidate => candidate.rule === 'mirageFlip:' + location.id && !candidate.reason)
  assert.ok(flip)
  move(state, flip)
  settle(state, choice => choice.options.find(option => option.label.includes('额外') && option.label.includes('线索'))?.id)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(current().attachments.some(card => card.code === '08585'), false)
  assert.ok(state.encounterDiscard.includes('08585'))
})

test('08586 回首往事：实际显现可选择 2 恐惧或在密谋加 1 毁灭', () => {
  for (const mode of ['horror', 'doom']) {
    const { state } = mirageGame()
    const doom = state.doom
    state.encounterDeck = ['08586']
    execute(state, (draft, api) => api.drawEncounter(0), choice => choice.options.find(option => option.id === mode)?.id)
    assert.equal(state.investigators[0].horror, mode === 'horror' ? 2 : 0)
    assert.equal(state.doom, doom + (mode === 'doom' ? 1 : 0))
  }
})

const partnerUses = {
  '08587': [3, 'secrets'], '08588': [5, 'secrets'], '08589': [3, 'secrets'], '08590': [3, 'supplies'],
  '08591': [3, 'supplies'], '08592': [3, 'ammo'], '08593': [3, 'secrets'], '08594': [3, 'supplies'],
  '08595': [9, 'resources'],
}
for (const [code, [uses, type]] of Object.entries(partnerUses)) {
  test(code + ' 坚毅伙伴：真实选择生成卡面印刷的使用数和类型', () => {
    const { state } = mirageGame()
    const partner = fm.choosePartner(state, 0, code)
    assert.ok(state.investigators[0].assets.includes(partner))
    assert.equal(partner.uses, uses)
    assert.equal(partner.usesType, type)
  })
}

// ---------------------------------------------------------------------------
// 08596 失落之峰（剧本参考卡）
// ---------------------------------------------------------------------------

for (const [code, harm] of [['08587', 'horror'], ['08590', 'damage']]) {
  test(code + ' 坚毅伙伴：快速治疗 2 点 ' + harm + '，横置并花 1 使用，无行动消耗', () => {
    const { state } = mirageGame()
    const inv = state.investigators[0]
    inv[harm] = 2
    const partner = fm.choosePartner(state, 0, code)
    const actions = inv.actionsLeft
    activate(state, partner.id)
    assert.equal(state.investigators[0][harm], 0)
    assert.equal(state.investigators[0].actionsLeft, actions)
    const current = state.investigators[0].assets.find(card => card.id === partner.id)
    assert.equal(current.uses, 2)
    assert.equal(current.exhausted, true)
  })
}

test('08588 丹佛斯：真实忒咳哩弱点结算后抽 3 张，抽到的忒咳哩直接弃掉', () => {
  const { state } = mirageGame()
  const partner = fm.choosePartner(state, 0, '08588')
  initializeTekeliDeck(state, { cards: ['08723', '08724', '08725', '08726', '08727', '08728', '08729'] })
  state.investigators[0].deck = ['01088', '08724', '01088', '08723']
  move(state, { action: 'draw' })
  settle(state, takeReaction)
  const inv = state.investigators[0]
  assert.equal(inv.horror, 1)
  assert.equal(inv.damage, 0)
  assert.deepEqual(inv.hand, ['01088', '01088'])
  assert.ok(inv.discard.includes('08724'))
  assert.equal(inv.assets.find(card => card.id === partner.id).uses, 4)
})

test('08589 阿什瓦克：真实快速躲避基础敏捷 6，成功可移动到相邻地点', () => {
  const { state, location } = mirageGame()
  const destination = fm.placeLocation(state, 'coastalWaters')
  location.connections = [destination.id]
  destination.connections = [location.id]
  state.investigators[0].agility = 1
  const target = enemy(state, { evade: 5 })
  const partner = fm.choosePartner(state, 0, '08589')
  activate(state, partner.id, choice => choice.options.find(option => option.id === destination.id)?.id)
  assert.equal(state.lastTestResult.value, 6)
  assert.equal(state.investigators[0].location, destination.id)
  assert.equal(state.enemies.find(card => card.id === target.id).exhausted, true)
})

test('08591 克莱普尔：实际取消寒霜，再揭示新标记或扣 1 补给', () => {
  for (const mode of ['reveal', 'supply']) {
    const { state } = mirageGame()
    const partner = fm.choosePartner(state, 0, '08591')
    state.investigators[0].intellect = 8
    state.chaosBag = ['frost', '0']
    state.debugNextTokens = ['frost', '0']
    move(state, { action: 'investigate' })
    settle(state, choice => choice.options.find(option => option.id === mode)?.id ?? takeReaction(choice))
    const current = state.investigators[0].assets.find(card => card.id === partner.id)
    assert.equal(current.uses, mode === 'supply' ? 2 : 3)
    assert.equal(current.exhausted, true)
    assert.equal(state.lastTestResult.success, true)
    assert.equal(state.lastTestResult.value, 8)
  }
})

test('08592 曲奇：真实快速攻击基础战斗 6，只有非精英敌人失去本轮攻击能力', () => {
  for (const elite of [false, true]) {
    const { state } = mirageGame()
    const partner = fm.choosePartner(state, 0, '08592')
    state.investigators[0].combat = 1
    const target = enemy(state, { elite, fight: 5, damage: 1 })
    activate(state, partner.id)
    assert.equal(state.lastTestResult.value, 6)
    const current = state.enemies.find(card => card.id === target.id)
    assert.equal(current.damageTaken, 1)
    execute(state, (draft, api) => api.attack(draft.enemies.find(card => card.id === target.id), draft.investigators[0]))
    assert.equal(state.investigators[0].damage, elite ? 1 : 0)
  }
})

test('08593 肯斯勒：真实快速调查基础智力 6，成功查看并弃掉遭遇牌库顶牌', () => {
  const { state } = mirageGame()
  const partner = fm.choosePartner(state, 0, '08593')
  state.investigators[0].intellect = 1
  state.encounterDeck = ['08585', '08586']
  activate(state, partner.id, choice => choice.options.find(option => ['encounter', 'discard'].includes(option.id))?.id)
  assert.equal(state.lastTestResult.value, 6)
  assert.deepEqual(state.encounterDeck, ['08585'])
  assert.ok(state.encounterDiscard.includes('08586'))
})

test('08594 埃尔斯沃思：可横置或花补给，令场上非弱点诡计文本空白直到回合结束', () => {
  for (const payment of ['exhaust', 'supply']) {
    const { state, location } = mirageGame()
    const partner = fm.choosePartner(state, 0, '08594')
    scenarioRuntime(state, []).attachEncounterToLocation('08585', location.id)
    const attached = () => state.locations.find(card => card.id === location.id).attachments[0]
    activate(state, partner.id, choice => choice.options.find(option => option.id === payment)?.id)
    assert.equal(attached().textBlankTurn, state.turnSerial)
    const current = state.investigators[0].assets.find(card => card.id === partner.id)
    assert.equal(current.uses, payment === 'supply' ? 2 : 3)
    assert.equal(current.exhausted, payment === 'exhaust')
    state.encounterDeck = Array(12).fill('08586')
    move(state, { action: 'endTurn' })
    settle(state)
    assert.equal(attached().textBlankTurn, undefined)
  }
})

test('08595 高田弘子：实际行动获得 1 资源并移入选择的至多 3 资源', () => {
  const { state } = mirageGame()
  const partner = fm.choosePartner(state, 0, '08595')
  const gainedFrom = state.investigators[0].resources
  const actions = state.investigators[0].actionsLeft
  activate(state, partner.id, choice => choice.options.find(option => option.id === '3')?.id)
  assert.equal(state.investigators[0].resources, gainedFrom + 4)
  assert.equal(state.investigators[0].actionsLeft, actions - 1)
  assert.equal(state.investigators[0].assets.find(card => card.id === partner.id).uses, 6)
})

test('08596 失落之峰：混乱标记的骷髅数值随地点高度和难度变化', () => {
  assert.equal(peaks.manifest.referenceCode, '08596')
  const state = peakState([['here', '08607', 2]])
  const inv = state.investigators[0]
  assert.equal(tp.resolveChaosToken(state, inv, 'skull').delta, -2)
  state.difficulty = 'hard'
  assert.equal(tp.resolveChaosToken(state, inv, 'skull').delta, -4)
})

// ---------------------------------------------------------------------------
// toTheForbiddenPeaks 共享工具
// ---------------------------------------------------------------------------
function peakState(defs) {
  const state = stateFor()
  state.locations = []
  state.scenario = { locations: {}, agendas: [], acts: [] }
  for (const [id, code, level] of defs) {
    const location = { id, code, originalCode: code, revealed: true, level, clues: 0, connections: [] }
    setLocationLevel(location, level)
    state.locations.push(location)
    state.scenario.locations[id] = { originalCode: code, level }
  }
  state.investigators[0].location = defs[0][0]
  return state
}
function fromBelow(state, seat, fromId, toId) {
  const loc = id => state.locations.find(item => item.id === id)
  state.scenarioFlags.pendingMove = { seat, from: fromId, to: toId,
    fromLevel: locationLevel(loc(fromId)), toLevel: locationLevel(loc(toId)) }
}
const EXPEDITION = '08614'

// ---------------------------------------------------------------------------
// 08597 / 08598 议程
// ---------------------------------------------------------------------------
test('08597 失落山峰：移动后线索回供应堆；背面在最高处生成星之恐怖并夺走探险支援', () => {
  assert.equal(agendaRuleFor('08597').onMove, 'returnClues')
  assert.equal(agendaRuleFor('08597').onReveal, 'spawnTerrorOfTheStars')
  const state = peakState([['locLow', '08602', 0], ['locHigh', '08600', 1]])
  state.agendas = [{ originalCode: '08597' }]
  state.investigators[0].location = 'locHigh'
  state.investigators[0].clues = 3
  state.investigators[0].assets = [{ id: 'a1', code: EXPEDITION, exhausted: false }]
  state.storyAssets = []
  const entered = tp.locationEntered(state, state.investigators[0], 'locHigh', { info: () => {} })
  assert.equal(state.investigators[0].clues, 0, '移动后线索回供应堆')
  assert.equal(entered.returnedClues, 3)
  const spawned = tp.spawnTerrorOfTheStars(state, { info: () => {} })
  assert.ok(spawned, '星之恐怖生成')
  assert.equal(spawned.code, peaksDef.RAW_CODES.terrorOfTheStars)
  assert.equal(spawned.location, 'locHigh', '生成在最高且有调查员的地点')
  assert.equal(state.investigators[0].assets.length, 0, '失去所有探险支援')
  assert.ok(state.storyAssets.some(asset => String(asset.code) === EXPEDITION), '支援留在原地')
})

test('08598 恐怖降临：移动后线索回供应堆；背面按是否有调查员撤退进入结局 1/2', () => {
  assert.equal(agendaRuleFor('08598').onMove, 'returnClues')
  assert.equal(agendaRuleFor('08598').onReveal, 'finalResolution')
  const state = peakState([['locA', '08600', 1], ['locB', '08602', 0]])
  state.agendas = [{ originalCode: '08598' }]
  state.investigators[0].clues = 4
  tp.locationEntered(state, state.investigators[0], 'locA', { info: () => {} })
  assert.equal(state.investigators[0].clues, 0)
  state.investigators[0].resigned = true
  assert.equal(tp.finalResolution(state), 'resolution1', '有调查员撤退 → 结局 1')
  state.investigators[0].resigned = false
  assert.equal(tp.finalResolution(state), 'resolution2', '无人撤退 → 结局 2')
})

// ---------------------------------------------------------------------------
// 08599 幕
// ---------------------------------------------------------------------------
test('08599 登上高峰：目标全撤退推进；行动可控制本地点探险支援', () => {
  assert.deepEqual(actRuleFor('08599').objective, { type: 'allResigned' })
  assert.equal(actRuleFor('08599').onReveal, 'resolution1')
  const state = peakState([['locSummit', '08607', 6]])
  state.acts = [{ originalCode: '08599' }]
  state.investigators[0].resigned = true
  assert.equal(tp.checkObjectives(state, { info: () => {} }), true)
  const finished = []
  assert.equal(tp.actReveal(state, state.acts[0], { finish: key => finished.push(key) }), true)
  assert.deepEqual(finished, ['resolution1'])
  state.investigators[0].resigned = false
  state.storyAssets = [{ id: 's1', code: EXPEDITION, location: 'locSummit' }]
  const moves = tp.actions(state, state.investigators[0])
  const take = moves.find(move => move.rule === 'takeExpeditionAsset')
  assert.ok(take, '提供控制探险支援的行动')
  assert.equal(tp.performAction(state, state.investigators[0], take, { info: () => {} }), true)
  assert.equal(state.storyAssets.length, 0)
  assert.ok(state.investigators[0].assets.some(asset => String(asset.code) === EXPEDITION))
})

// ---------------------------------------------------------------------------
// 08600–08607 山腰地点
// ---------------------------------------------------------------------------
test('08600 深厚积雪：从下方进入时弃牌库顶 3 张并抽取其中的弱点', () => {
  assert.equal(locationRuleFor('08600').blocksUntilBelowClear, true)
  const state = peakState([['below', '08599', 0], ['loc00', '08600', 1]])
  state.investigators[0].location = 'below'
  state.investigators[0].deck = ['01009', '01010', '08723']
  const drawn = []
  fromBelow(state, 0, 'below', 'loc00')
  const result = tp.locationEntered(state, state.investigators[0], 'loc00', { info: () => {}, drawCards: (seat, n) => drawn.push([seat, n]) })
  assert.equal(result.enterFromBelow.effect, 'discardTop3ThenDrawWeaknesses')
  assert.equal(result.enterFromBelow.discarded.length, 3)
  assert.deepEqual(result.enterFromBelow.weaknesses, ['08723'], '识别被弃的弱点')
  assert.equal(drawn.length, 1, '弱点被抽取')
})

test('08601 白色断崖：从下方进入检定敏捷(X=高度+1)，失败失去探险支援', () => {
  const state = peakState([['below', '08599', 0], ['loc01', '08601', 1]])
  state.investigators[0].location = 'below'
  state.investigators[0].assets = [{ id: 'a1', code: EXPEDITION, exhausted: false }]
  state.storyAssets = []
  const tests = []
  const api = { info: () => {}, test: (seat, skill, difficulty, callback) => tests.push({ seat, skill, difficulty, callback }) }
  fromBelow(state, 0, 'below', 'loc01')
  tp.locationEntered(state, state.investigators[0], 'loc01', api)
  assert.equal(tests.length, 1)
  assert.equal(tests[0].skill, 'agility')
  assert.equal(tests[0].difficulty, 2, 'X = 高度 1 + 1')
  tests[0].callback({ success: false })
  assert.equal(state.investigators[0].assets.length, 0, '失败失去探险支援')
  assert.ok(state.storyAssets.some(asset => String(asset.code) === EXPEDITION))
})

test('08602 陡峭斜坡：从下方进入受到 1 点伤害', () => {
  const state = peakState([['below', '08599', 0], ['loc02', '08602', 1]])
  state.investigators[0].location = 'below'
  fromBelow(state, 0, 'below', 'loc02')
  tp.locationEntered(state, state.investigators[0], 'loc02', { info: () => {} })
  assert.equal(state.investigators[0].damage, 1)
})

test('08603 狭窄山脊：从下方进入受到 1 点恐惧', () => {
  const state = peakState([['below', '08599', 0], ['loc03', '08603', 1]])
  state.investigators[0].location = 'below'
  fromBelow(state, 0, 'below', 'loc03')
  tp.locationEntered(state, state.investigators[0], 'loc03', { info: () => {} })
  assert.equal(state.investigators[0].horror, 1)
})

test('08604 岩架：从下方进入把忒咳哩-哩牌库顶 1 张洗入牌库', () => {
  const state = peakState([['below', '08599', 0], ['loc04', '08604', 1]])
  state.investigators[0].location = 'below'
  state.investigators[0].deck = []
  initializeTekeliDeck(state, { cards: [...peaksDef.TEKELI_FACES], copies: [...peaksDef.TEKELI_COPIES] })
  const before = tekeliDeckSize(state)
  fromBelow(state, 0, 'below', 'loc04')
  const result = tp.locationEntered(state, state.investigators[0], 'loc04', { info: () => {} })
  assert.equal(result.enterFromBelow.effect, 'tekeliShuffleIntoDeck')
  assert.equal(tekeliDeckSize(state), before - 1, '忒咳哩-哩牌库少 1 张')
  assert.equal(state.investigators[0].deck.length, 1, '混洗入调查员牌库')
})

test('08605 白雪覆盖的峭壁：从下方进入横置你控制的所有支援', () => {
  const state = peakState([['below', '08599', 0], ['loc05', '08605', 1]])
  state.investigators[0].location = 'below'
  state.investigators[0].assets = [{ id: 'a1', code: '01009', exhausted: false }, { id: 'a2', code: EXPEDITION, exhausted: false }]
  fromBelow(state, 0, 'below', 'loc05')
  tp.locationEntered(state, state.investigators[0], 'loc05', { info: () => {} })
  assert.equal(state.investigators[0].assets.every(asset => asset.exhausted === true), true)
})

test('08606 迎风通路：从下方进入放 1 线索，揭示时仅高度为 0 才按人数放线索', () => {
  assert.equal(locationRuleFor('08606').onReveal.effect, 'placeCluesPerInvestigator')
  const state = peakState([['below', '08599', 0], ['loc06', '08606', 1]])
  state.numInvestigators = 2
  state.investigators[0].location = 'below'
  fromBelow(state, 0, 'below', 'loc06')
  tp.locationEntered(state, state.investigators[0], 'loc06', { info: () => {} })
  const loc = state.locations.find(item => item.id === 'loc06')
  assert.equal(loc.clues, 1, '从下方进入放 1 个线索')
  assert.equal(tp.locationRevealed(state, loc, { info: () => {} }), null)
  assert.equal(loc.clues, 1)
  const low = peakState([['bottom', '08606', 0]])
  low.numInvestigators = 2
  assert.equal(tp.locationRevealed(low, low.locations[0], { info: () => {} }), 2)
  assert.equal(low.locations[0].clues, 2)
})

test('08607 山顶：线索只能调查发现；揭示加 frost；[action] 撤退把探险支援加入胜利区', () => {
  const rule = locationRuleFor('08607')
  assert.equal(rule.cluesOnlyByInvestigation, true, '山顶线索只能通过调查发现')
  const state = peakState([['locSummit', '08607', 6]])
  state.investigators[0].location = 'locSummit'
  state.investigators[0].clues = 2
  state.storyAssets = []
  state.investigators[0].assets = [{ id: 'a1', code: EXPEDITION, exhausted: false }]
  tp.locationRevealed(state, state.locations[0], { info: () => {} })
  assert.ok(state.chaosBag.includes('frost'), '揭示时混乱袋加入 frost 标记')
  const moves = tp.actions(state, state.investigators[0])
  const resign = moves.find(move => move.rule === 'summitResign')
  assert.ok(resign, '提供山顶撤退行动')
  assert.equal(tp.performAction(state, state.investigators[0], resign, { info: () => {} }), true)
  assert.equal(state.investigators[0].resigned, true)
  assert.equal(state.investigators[0].clues, 0, '线索放回供应堆')
  assert.ok(state.victoryDisplay.some(card => String(card.code) === EXPEDITION), '探险支援加入胜利区')
})
