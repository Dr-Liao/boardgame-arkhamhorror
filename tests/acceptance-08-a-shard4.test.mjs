// 验收测试：08-a 地球边缘 · 分片 4（eoec 08501–08545）
// 每张卡一条标题含卡号的真实执行用例：经生产组合根（content/registered.js）打开冰原 I/II/III，
// 用真实引擎入口（scenarioRuntime / legalMoves / applyMove / resolveTransaction）执行单卡条目或章节 behavior。
// 涉及修复的能力用真实动作、窗口与结算验证状态变化。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadEoteWorld, openChapter, createHubGame, hubSetup, finishScenario, continueFromResult, beginChapter,
  legalFor, playMove, settleChoices, transact, codeOf,
} from './eote-p8-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as chapter1 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/index.js'
import * as chapter2 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/index.js'
import { RAW_CODES as RAW2, POSSESSED_ENEMY_CODES } from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js'
import { RAW_CODES as RAW3 } from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js'
import { part1ChaosTokenValue, part1ChaosFailureSpec } from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/chaos.js'

const world = await loadEoteWorld()
const { registeredEntry, scenarioRuntime } = world

const part1 = () => openChapter(world, 0, { seats: 2, seed: 'a08s4-p1', investigatorCodes: ['08001', '08004'] })
const part2 = () => openChapter(world, 1, { seats: 2, seed: 'a08s4-p2', investigatorCodes: ['08001', '08004'] })
function part3() {
  const codes = ['08001', '08004']
  const state = createHubGame(world, { seats: 2, seed: 'a08s4-p3', investigatorCodes: codes })
  hubSetup(world, state, { investigatorCodes: codes })
  for (const expected of ['iceAndDeathPart1', 'iceAndDeathPart2']) {
    assert.equal(state.scenario.id, expected)
    finishScenario(world, state, 'resolution1')
    continueFromResult(world, state, { upgrades: false, storySelect: choice => (choice.options.some(option => option.id === 'stand') ? 'stand' : null) })
    beginChapter(world, state)
  }
  assert.equal(state.scenario.id, 'iceAndDeathPart3')
  return state
}
const run = (state, fn, select) => transact(world, state, draft => fn(draft), select)
const rt = state => scenarioRuntime(state, [])
const mech = state => world.mechanics.createMechanicsApi(state)
const me = state => state.investigators[0]
const locByCode = (state, code) => state.locations.find(location => codeOf(location) === code) || null
const locById = (state, id) => state.locations.find(location => location.id === id) || null
const liveSeat = (state, inv) => (inv == null ? 0 : typeof inv === 'number' ? inv : inv.seat)
function exec(state, code, { index = 0, inv, source, context = {} } = {}) {
  const entry = registeredEntry(code)
  assert.ok(entry, `${code} 未注册`)
  const seat = liveSeat(state, inv)
  const liveInv = state.investigators[seat]
  let liveSource = source || null
  if (liveSource) {
    liveSource = state.locations.find(location => location.id === liveSource.id)
      || state.enemies.find(enemy => enemy.id === liveSource.id)
      || state.investigators.flatMap(item => item.threat || []).find(card => card.id === liveSource.id)
      || liveSource
  } else {
    liveSource = locByCode(state, code) || { id: code, code, originalCode: code }
  }
  return entry.abilities[index].resolve({ state, inv: liveInv, source: liveSource, api: rt(state), context, target: context.target })
}
function place(state, code, { revealed = true, clues = 0 } = {}) {
  let location = locByCode(state, code)
  if (!location) {
    location = { id: code, code, originalCode: code, name: code, revealed, clues, shroud: 1, connections: [], traits: [...(ALL_CARDS[code]?.traits || [])], maxClues: 20 }
    state.locations.push(location)
  }
  location.revealed = revealed
  location.clues = clues
  location.maxClues = 20
  return location
}
function spawnEnemy(state, code, locationId, extra = {}) {
  const card = ALL_CARDS[code] || {}
  const enemy = { id: `${code}-${state.enemies.length + 1}`, code, originalCode: code, name: card.nameZh || code,
    location: locationId, engagedSeat: null, exhausted: false, damageTaken: 0, doom: 0, beneath: [], traits: [...(card.traits || [])],
    fight: card.fight ?? 1, evade: card.evade ?? 1, health: card.health ?? 2, damage: card.damage || 1, horror: card.horror || 1, ...extra }
  state.enemies.push(enemy)
  return enemy
}
const supplies = state => (state.campaign?.records?.suppliesRecovered || []).map(item => (typeof item === 'string' ? item : item?.code))
const pickChoice = (choice, ids) => {
  for (const id of ids) if (choice.options.some(option => option.id === id)) return id
  return null
}
const commandFor = (state, entity) => legalFor(world, state).find(move => move.action === 'entityAbility' && move.entityId === entity.id)
const investigate = state => legalFor(world, state).find(move => move.action === 'investigate')

function perform(state, command, select) {
  assert.ok(command, '真实合法动作可达')
  playMove(world, state, command)
  settleChoices(world, state, select)
}

function visit(state, code, seat = 0) {
  const location = locByCode(state, code)
  assert.ok(location, `实际章节已布置 ${code}`)
  location.revealed = true
  const inv = state.investigators[seat]
  inv.location = location.id
  inv.actionsLeft = 3
  state.currentSeat = seat
  state.turnSeat = seat
  state.chaosBag = ['0']
  return location
}

const NON_ELITE_POSSESSED = Object.keys(ALL_CARDS).find(code => {
  const traits = (ALL_CARDS[code].traits || []).map(value => String(value).toLowerCase())
  return ALL_CARDS[code].type === 'enemy' && traits.includes('possessed') && !traits.includes('elite')
})

// ===========================================================================
// 批次 A：亡命冰原共用卡 08501–08517
// ===========================================================================

test('08501 亡命冰原：骷髅=庇护值一半（困难全值），cultist/tablet 失败后果与引擎读点一致', () => {
  const state = part1()
  const inv = me(state)
  inv.location = 'frozenShores'
  assert.equal(locByCode(state, '08503').shelter, 2)
  assert.equal(part1ChaosTokenValue(state, 'skull', inv), 1)
  assert.equal(part1ChaosTokenValue(state, 'tablet', inv), -3)
  state.difficulty = 'hard'
  assert.equal(part1ChaosTokenValue(state, 'skull', inv), 2)
  assert.equal(part1ChaosTokenValue(state, 'tablet', inv), -4)
  assert.deepEqual(part1ChaosFailureSpec(state, 'cultist', 2), { token: 'cultist', kind: 'tekelili', count: 2 })
  assert.deepEqual(part1ChaosFailureSpec(state, 'tablet', 3), { token: 'tablet', kind: 'discardTop', count: 3 })
  assert.equal(registeredEntry('08501').scope, 'scenario')
})

test('08502 坠机点：真实搜寻检定失败可重试，成功记录备用零件后关闭动作', () => {
  const state = part1()
  const location = visit(state, '08502')
  me(state).intellect = 6
  state.chaosBag = ['autofail']
  perform(state, commandFor(state, location), choice => pickChoice(choice, ['intellect']))
  assert.equal(state.lastTestResult?.difficulty, 3)
  assert.equal(supplies(state).includes('08620'), false)
  state.chaosBag = ['0']
  perform(state, commandFor(state, location), choice => pickChoice(choice, ['intellect']))
  assert.equal(supplies(state).filter(code => code === '08620').length, 1)
  assert.equal(commandFor(state, location), undefined, '战役中成功后不再提供搜寻')
})

test('08503 冰冻海岸：附属遭遇牌时实际调查难度增加 2，移开后恢复', () => {
  const state = part2()
  const location = visit(state, '08503')
  location.shroud = 2
  location.clues = 5
  me(state).intellect = 9
  perform(state, investigate(state))
  assert.equal(state.lastTestResult?.difficulty, 2)
  run(state, draft => rt(draft).attachEncounterToLocation('08699', location.id))
  perform(state, investigate(state))
  assert.equal(state.lastTestResult?.difficulty, 4)
  const current = locByCode(state, '08503')
  current.attachments = []
  perform(state, investigate(state))
  assert.equal(state.lastTestResult?.difficulty, 2)
})

test('08504 危险道路：技能检定中揭示 frost 后受到 1 点伤害或恐惧', () => {
  const state = part2()
  run(state, draft => {
    const inv = draft.investigators[0]
    const location = locByCode(draft, '08504')
    inv.location = location.id
    draft.skillTest = { seat: inv.seat, skill: 'willpower' }
    exec(draft, '08504', { inv, source: location, context: { token: 'frost' } })
  }, choice => pickChoice(choice, ['damage']))
  assert.equal(state.investigators[0].damage + state.investigators[0].horror, 1)
})

test('08505 不稳定冰盖：抽到危险诡计时加 1 个 frost 并取消该卡', () => {
  const state = part2()
  const before = mech(state).frost.count()
  const context = { cardCode: '08517', cancelled: false }
  run(state, draft => {
    const inv = draft.investigators[0]
    inv.location = 'precariousIceSheet'
    exec(draft, '08505', { inv, source: locByCode(draft, '08505'), context })
  })
  assert.equal(mech(state).frost.count(), before + 1, '加入 1 个 frost')
  assert.equal(context.cancelled, true, '取消并弃掉危险诡计')
})

test('08506 辽阔雪地：选反应加寒霜并额外发现 3 线索，换调查员后团队仍限一次', () => {
  const state = part2()
  const location = visit(state, '08506')
  location.clues = 9
  location.shroud = 1
  me(state).intellect = 7
  const beforeFrost = mech(state).frost.count()
  const beforeClues = me(state).clues
  let offered = false
  const select = choice => {
    const option = choice.options.find(item => item.label?.includes('辽阔雪地'))
    if (option) offered = true
    return option?.id ?? null
  }
  perform(state, investigate(state), select)
  assert.equal(offered, true)
  assert.equal(mech(state).frost.count(), beforeFrost + 1)
  assert.equal(me(state).clues, beforeClues + 4)
  assert.equal(locByCode(state, '08506').clues, 5)
  visit(state, '08506', 1)
  state.chaosBag = ['0', 'frost']
  state.investigators[1].intellect = 9
  offered = false
  perform(state, investigate(state), select)
  assert.equal(offered, false)
})

test('08507 冰封荒原：本次检定第一个 frost 的修正视为 -3（treat 读点）', () => {
  const state = part2()
  run(state, draft => {
    const inv = draft.investigators[0]
    const location = locByCode(draft, '08507')
    inv.location = location.id
    draft.chaos = { revealed: ['frost'], frames: [0] }
    draft.skillTest = { seat: inv.seat, skill: 'willpower' }
    exec(draft, '08507', { inv, source: location, context: { token: 'frost' } })
  })
  assert.equal(state.skillTest?.tokenTreatments?.[0]?.modifier, -3, '首个 frost 修正 -3')
})

test('08508 岩石峭壁：真实显现附属诡计后额外抽遭遇，每阶段限一次', () => {
  const state = part2()
  const location = visit(state, '08508')
  state.encounterDeck = ['08515', '08699']
  run(state, draft => rt(draft).drawEncounter(0), choice => pickChoice(choice, [location.id]))
  assert.ok(locByCode(state, '08508').attachments.some(card => codeOf(card) === '08699'))
  assert.equal(state.encounterDeck.length, 0, '附属后因涌动额外抽牌')
  assert.ok(state.enemies.some(enemy => codeOf(enemy) === '08515'))
  locByCode(state, '08508').attachments = []
  state.encounterDeck = ['08515', '08699']
  run(state, draft => rt(draft).drawEncounter(0), choice => pickChoice(choice, [location.id]))
  assert.ok(locByCode(state, '08508').attachments.some(card => codeOf(card) === '08699'))
  assert.deepEqual(state.encounterDeck, ['08515'], '同阶段第二次附属不额外抽牌')
})

test('08509 雪冢：发现最后一个线索后洗入 3 张忒咳哩-哩并记录「绿皂石」', () => {
  const state = part2()
  const tekeliBefore = mech(state).tekeli.size()
  run(state, draft => {
    const inv = draft.investigators[0]
    const location = place(draft, '08509')
    inv.location = location.id
    inv.deck = []
    exec(draft, '08509', { inv, source: location })
  })
  assert.ok(supplies(state).includes('08614'), '记录绿皂石')
  assert.equal(state.investigators[0].deck.length, 3)
  assert.equal(mech(state).tekeli.size(), tekeliBefore - 3)
})

for (const [code, skill, difficulty, supply] of [
  ['08510', 'intellect', 4, '08619'],
  ['08512', 'willpower', 4, '08616'],
  ['08513', 'combat', 4, '08615'],
  ['08514', 'agility', 5, '08617'],
]) {
  test(`${code} 地点行动：以印刷技能和难度检定，成功后记录对应补给并关闭行动`, () => {
    const state = part2()
    const location = visit(state, code)
    me(state)[skill] = 9
    perform(state, commandFor(state, location), choice => pickChoice(choice, ['radio']))
    assert.equal(state.lastTestResult?.skill, skill)
    assert.equal(state.lastTestResult?.difficulty, difficulty)
    assert.equal(supplies(state).filter(value => value === supply).length, 1)
    assert.equal(commandFor(state, location), undefined)
  })
}

test('08511 严寒洞穴：加 1 个 frost 并在剧本日志记录「矿物标本」', () => {
  const state = part2()
  run(state, draft => {
    const inv = draft.investigators[0]
    const location = locByCode(draft, '08511')
    inv.location = location.id
    exec(draft, '08511', { inv, source: location })
  })
  assert.ok(supplies(state).includes('08618'), '记录矿物标本')
})

test('08515 疾行谬物：真实攻击击败后只洗入 1 张；堆空时开启可取消的敌人攻击', () => {
  const makeFight = () => {
    const state = part1()
    me(state).deck = []
    me(state).combat = 8
    return { state, target: spawnEnemy(state, '08515', me(state).location, { health: 1, fight: 1 }) }
  }
  const fight = ({ state, target }, select) => perform(state,
    legalFor(world, state).find(move => move.action === 'fight' && move.enemyId === target.id), select)
  const regular = makeFight()
  const before = mech(regular.state).tekeli.size()
  fight(regular)
  assert.equal(me(regular.state).deck.length, 1)
  assert.equal(mech(regular.state).tekeli.size(), before - 1)
  const empty = makeFight()
  while (mech(empty.state).tekeli.size()) mech(empty.state).tekeli.draw()
  me(empty.state).hand = ['01023']
  me(empty.state).resources = 9
  let cancelled = false
  fight(empty, choice => {
    const option = choice.options.find(item => item.cardCode === '01023')
    if (option) cancelled = true
    return option?.id ?? null
  })
  assert.equal(cancelled, true, '没有忒咳哩-哩时攻击进入可打出闪躲的窗口')
  assert.equal(me(empty.state).damage, 0)
  assert.equal(me(empty.state).horror, 0)
})

test('08516 无限恐惧症：意志(X=庇护值 7) 失败后选择每差 1 点 1 恐惧', () => {
  const state = part2()
  state.chaosBag = ['autofail']
  run(state, draft => {
    const inv = draft.investigators[0]
    inv.location = 'barrierCamp'
    inv.horror = 0
    draft.chaosBag = ['autofail']
    registeredEntry('08516').encounterResolve(draft, inv, { code: '08516' }, rt(draft))
  }, choice => pickChoice(choice, ['horror']))
  assert.equal(state.lastTestResult?.difficulty, 7, '难度 = 所在地点庇护值 7')
  assert.ok(state.investigators[0].horror >= 1, '失败代价：每低 1 点 1 恐惧')
})

test('08517 零能见度：真实遭遇进入威胁区，离开附属地点多花 1 行动，回合末检定成功弃掉', () => {
  const state = part2()
  const location = visit(state, '08503')
  const destination = locByCode(state, '08502')
  assert.ok(destination)
  destination.revealed = true
  location.connections = [destination.id]
  state.encounterDeck = ['08517']
  run(state, draft => rt(draft).drawEncounter(0))
  assert.ok(me(state).threat.some(card => codeOf(card) === '08517'))
  run(state, draft => rt(draft).attachEncounterToLocation('08699', location.id))
  me(state).agility = 8
  const actions = me(state).actionsLeft
  perform(state, legalFor(world, state).find(move => move.action === 'move' && move.locationId === destination.id))
  assert.equal(me(state).location, destination.id)
  assert.equal(me(state).actionsLeft, actions - 2)
  perform(state, legalFor(world, state).find(move => move.action === 'endTurn'))
  assert.equal(state.lastTestResult?.difficulty, 2)
  assert.equal(me(state).threat.some(card => codeOf(card) === '08517'), false)
})

// ===========================================================================
// 批次 B：坠机 the_crash 08518–08522
// ===========================================================================

test('08518 冷遇：背面在队长地点生成疾行谬物，其余同名与冰中生物洗入遭遇牌库', () => {
  const state = part1()
  const deckBefore = state.encounterDeck.length
  run(state, draft => { chapter1.behavior.resolveAgendaBack(draft, draft.agendas[0], rt(draft)) })
  const skittering = state.enemies.find(enemy => codeOf(enemy) === '08515')
  assert.ok(skittering, '生成疾行谬物')
  assert.equal(skittering.location, state.investigators[Number(state.campaign.leadSeat ?? 0)].location)
  assert.ok(state.encounterDeck.length > deckBefore, '其余敌人洗入遭遇牌库')
})

test('08519 深入白雪：背面把星之恐怖生成在已揭示且庇护值最高的地点', () => {
  const state = part1()
  state.scenarioZones.setAside.push('08522')
  run(state, draft => { chapter1.behavior.resolveAgendaBack(draft, draft.agendas[1], rt(draft)) })
  const terror = state.enemies.find(enemy => codeOf(enemy) === '08522')
  assert.ok(terror, '生成星之恐怖')
  assert.equal(locById(state, terror.location)?.shelter, 2, '位于已揭示的庇护值最高地点')
})

test('08520 没时间了：背面每人洗入 1 张忒咳哩-哩、全员撤退', () => {
  const state = part1()
  for (const inv of state.investigators) inv.deck = []
  run(state, draft => { chapter1.behavior.resolveAgendaBack(draft, draft.agendas[2], rt(draft)) })
  for (const inv of state.investigators) {
    assert.equal(inv.resigned, true, '每位未击败调查员撤退')
    assert.equal(inv.deck.length, 1, '每人洗入 1 张忒咳哩-哩')
  }
})

test('08521 寻找扎营点：同处无线索地点出现撤退行动，撤退后推进结局 1', () => {
  const state = part1()
  for (const inv of state.investigators) { inv.location = 'crashSite'; inv.clues = 0 }
  locByCode(state, '08502').clues = 0
  const command = legalFor(world, state).find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  assert.ok(command, '合法撤退行动出现')
  playMove(world, state, command)
  settleChoices(world, state)
  assert.equal(state.investigators.every(inv => inv.resigned), true, '所有调查员撤退')
  assert.equal(chapter1.behavior.actObjectiveMet(state).met, true, '幕目标达成（全员撤退）')
})

test('08522 星之恐怖：引擎按调查员数加生命；重整时不能在其地点撤退或发现线索', () => {
  const state = part1()
  const location = visit(state, '08503')
  for (const inv of state.investigators) inv.location = location.id
  const terror = spawnEnemy(state, '08522', location.id, { health: 2, exhausted: false })
  assert.equal(world.engine.enemyHealth(state, terror), 2 + 3 * state.numInvestigators)
  location.clues = 0
  const resign = () => legalFor(world, state).some(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  assert.equal(resign(), false, '重整时不能撤退')
  location.clues = 5
  const previous = me(state).clues
  run(state, draft => rt(draft).discoverClue(0, 1, location.id))
  assert.equal(me(state).clues, previous, '实际发现线索被阻止')
  state.enemies.find(enemy => enemy.id === terror.id).exhausted = true
  run(state, draft => rt(draft).discoverClue(0, 1, location.id))
  assert.equal(me(state).clues, previous + 1)
  locByCode(state, '08503').clues = 0
  assert.equal(resign(), true, '横置后恢复撤退')
})

// ===========================================================================
// 批次 C：迷失之夜 lost_in_the_night 08523–08543
// ===========================================================================

for (const [code, agendaIndex, beneathCode] of [['08523', 0, '08512'], ['08524', 1, '08513']]) {
  test(`${code} 背面：查看地点底下 1 张正面朝下的遭遇卡（不结算、放回）`, () => {
    const state = part2()
    const location = locByCode(state, '08504')
    location.beneath = [beneathCode]
    let returned = null
    run(state, draft => { returned = chapter2.behavior.agendaReveal(draft, draft.agendas[agendaIndex], rt(draft)) })
    assert.ok(returned, 'agendaReveal 已接线')
    assert.deepEqual(locByCode(state, '08504').beneath, [beneathCode], '查看后原样放回')
  })
}

test('08525 疯狂与死亡：背面剩下的每位调查员被击败并承受 1 点精神创伤', () => {
  const state = part2()
  run(state, draft => { chapter2.behavior.agendaReveal(draft, draft.agendas[2], rt(draft)) })
  assert.equal(state.investigators.every(inv => inv.defeated), true, '剩下的每位调查员被击败')
  const mental = Object.values(state.campaign.investigators).map(record => record.trauma?.mental || 0)
  assert.ok(mental.every(value => value >= 1), '各承受 1 点精神创伤')
})

test('08526 失踪队员：[fast] 付线索抽地点底下卡；[action] 在营地撤退', () => {
  const state = part2()
  const campId = mech(state).camp.location()
  assert.ok(campId, '本章有营地')
  for (const inv of state.investigators) { inv.location = campId; inv.clues = 5 }
  locById(state, campId).beneath = ['08527']
  const moves = legalFor(world, state)
  const draw = moves.find(move => move.action === 'scenarioAction' && move.rule === 'drawUnderLocation')
  const resign = moves.find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  assert.ok(draw, '付线索抽取底下卡的行动出现')
  assert.ok(resign, '在营地时可撤退')
  playMove(world, state, draw)
  settleChoices(world, state)
  assert.equal((locById(state, campId).beneath || []).length, 0, '底下卡被抽取结算')
  playMove(world, state, resign)
  settleChoices(world, state)
  assert.equal(state.investigators.every(inv => inv.resigned), true, '全员到营地撤退')
})

for (const [code, setup, effect] of [
  ['08527', null, 'removeFrost'],
  ['08528', (state) => { me(state).deck = [RAW2.tekeliliFaces[0], '01020'] }, 'tekeliliToBottom'],
  ['08529', (state) => { me(state).deck = [RAW2.tekeliliFaces[0], '01020', RAW2.tekeliliFaces[1]] }, 'tekeliliTopNineToBottom'],
  ['08530', null, 'removeFrost'],
  ['08531', (state) => { me(state).deck = [RAW2.tekeliliFaces[0], '01020'] }, 'tekeliliToBottom'],
  ['08532', null, 'discardNonEliteEidolon'],
  ['08533', (state) => { me(state).deck = [RAW2.tekeliliFaces[0], '01020'] }, 'tekeliliTopNineToBottom'],
  ['08534', (state) => { if (NON_ELITE_POSSESSED) spawnEnemy(state, NON_ELITE_POSSESSED, me(state).location, { doom: 2 }) }, 'possessedDoomToClues'],
]) {
  test(`${code} ${effect}：结算剧情效果并把本卡加入胜利区`, () => {
    const state = part2()
    if (setup) setup(state)
    if (code === '08532') spawnEnemy(state, '08515', me(state).location)
    const frostLocation = effect === 'removeFrost' ? visit(state, '08502') : null
    if (frostLocation) mech(state).frost.add(1)
    const beforeFrost = mech(state).frost.count()
    if (frostLocation) {
      const location = frostLocation
      location.beneath = [code]
      me(state).clues = state.numInvestigators
      perform(state, legalFor(world, state).find(move => move.action === 'scenarioAction' && move.rule === 'drawUnderLocation'))
      assert.equal(location.id, me(state).location)
      assert.equal(locById(state, location.id).beneath.length, 0)
    } else {
      run(state, draft => chapter2.behavior.resolveStory(draft, code, draft.investigators[0], rt(draft)))
    }
    assert.equal((state.victoryDisplay || []).some(card => codeOf(card) === code), true, '剧情卡加入胜利区')
    if (effect === 'removeFrost') {
      assert.equal(mech(state).frost.count(), beforeFrost - 1, '真实剧情抽取移除一枚寒霜')
    }
    if (effect === 'tekeliliToBottom' || effect === 'tekeliliTopNineToBottom') {
      assert.equal(me(state).deck.includes(RAW2.tekeliliFaces[0]), false, '忒咳哩-哩移出牌库')
    }
    if (effect === 'discardNonEliteEidolon') {
      assert.equal(state.enemies.some(enemy => codeOf(enemy) === '08515'), false, '非精英幻灵被弃掉')
    }
  })
}

const RESCUE_TESTS = {
  '08535': { threshold: 3, payment: 'hand', amount: 2 },
  '08536': { threshold: 3, payment: 'tekelili', amount: 2 },
  '08537': { threshold: 2, skill: 'agility', difficulty: 2 },
  '08538': { threshold: 2, skill: 'willpower', difficulty: 2 },
  '08539': { threshold: 1, skill: 'intellect', alternative: 'willpower', difficulty: 5 },
  '08540': { threshold: 2, skill: 'combat', difficulty: 2 },
  '08541': { threshold: 2, skill: 'intellect', difficulty: 2 },
  '08542': { threshold: 1, skill: 'agility', alternative: 'combat', difficulty: 5 },
  '08543': { threshold: 5, payment: 'pool', amount: 3 },
}

for (const code of POSSESSED_ENEMY_CODES) {
  test(`${code} 被附身队员：生产谈判把进度资源放在敌人上，达到人数阈值时加入胜利区`, () => {
    const state = part2()
    visit(state, '08502')
    const config = RESCUE_TESTS[code]
    assert.ok(config)
    const target = spawnEnemy(state, code, me(state).location, { health: 3 })
    if (config.skill) me(state)[config.skill] = config.difficulty + 1
    me(state).resources = 20
    const dealt = ['01021', '01022']
    me(state).hand = config.payment === 'hand' ? ['01020', ...dealt] : []
    me(state).deck = Array(20).fill('01020')
    const previousLogs = state.log.length
    const select = choice => {
      if (config.payment === 'hand') return choice.options.find(item => dealt.includes(item.cardCode))?.id ?? null
      if (config.alternative && choice.options.some(item => item.id === config.skill)) {
        assert.ok(choice.options.some(item => item.id === config.alternative))
        return config.skill
      }
      return config.amount ? pickChoice(choice, [String(config.amount)]) : null
    }
    perform(state, commandFor(state, target), select)
    const current = state.enemies.find(enemy => enemy.id === target.id)
    assert.ok(current, '第一次谈判不足以救回两人局的队员')
    if (config.skill) {
      assert.equal(state.lastTestResult?.skill, config.skill)
      assert.equal(state.lastTestResult?.difficulty, config.difficulty)
      assert.equal(state.lastTestResult?.success, true)
    }
    assert.equal(current.resources, config.amount || (config.alternative ? 1 : state.lastTestResult.value - config.difficulty))
    if (config.payment === 'hand') {
      assert.deepEqual(me(state).hand, ['01020'])
      assert.ok(dealt.every(item => me(state).discard.includes(item)))
      me(state).hand.push(...dealt)
    }
    if (config.payment === 'tekelili') {
      const messages = state.log.slice(previousLogs).map(line => typeof line === 'string' ? line : line.text || line.message || '')
      assert.equal(messages.filter(line => line.includes('抽到了弱点')).length, 2)
    }
    if (config.payment === 'pool') assert.equal(me(state).resources, 20 - config.amount)
    // 将第二次谈判置于印刷救援阈值前，验证资源落位与区划转移同属一个结算。
    current.resources = config.threshold * state.numInvestigators - 1
    perform(state, commandFor(state, current), select)
    assert.equal(state.enemies.some(enemy => enemy.id === target.id), false)
    assert.equal((state.victoryDisplay || []).some(card => codeOf(card) === code), true)
  })
}

test('08540 曲奇：谈判检定失败，在真实攻击窗口受到一次攻击且不增加救援资源', () => {
  const state = part2()
  visit(state, '08502')
  const target = spawnEnemy(state, '08540', me(state).location, { damage: 1, horror: 1 })
  state.chaosBag = ['autofail']
  const before = (me(state).damage || 0) + (me(state).horror || 0)
  perform(state, commandFor(state, target))
  assert.equal(state.lastTestResult?.success, false)
  assert.equal(state.enemies.find(enemy => enemy.id === target.id).resources || 0, 0)
  assert.equal((me(state).damage || 0) + (me(state).horror || 0), before + 2)
})

// ===========================================================================
// 批次 D：渗透梦魇 seeping_nightmares 08544–08545
// ===========================================================================

test('08544 邪灵现身：达到毁灭阈值时阻止推进，减少 2 毁灭并实际生成翻出的敌人', () => {
  const state = part3()
  assert.equal(codeOf(state.agendas[state.agendaIndex]), RAW3.agendaEidolons)
  const previous = state.agendaIndex
  const threshold = state.agendas[previous].doomThreshold
  state.doom = threshold
  const rivals = state.enemies.filter(enemy => codeOf(enemy) === RAW3.seepingNightmare)
  for (const rival of rivals) {
    rival.beneath = ['08515']
    rival.beneathFaceDown = [true]
  }
  const nightmare = spawnEnemy(state, RAW3.seepingNightmare, state.locations[0].id,
    { beneath: ['08515', '08515'], beneathFaceDown: [true, true] })
  run(state, draft => world.engine.checkAgenda(draft, []))
  assert.equal(state.agendaIndex, previous)
  assert.equal(state.doom, threshold - 2)
  assert.equal(state.enemies.find(enemy => enemy.id === nightmare.id).beneath.length, 1)
  for (const rival of rivals) assert.equal(state.enemies.find(enemy => enemy.id === rival.id).beneath.length, 1)
  assert.ok(state.enemies.some(enemy => codeOf(enemy) === '08515' && enemy.location === nightmare.location))
})

test('08545 冰雪深处：通过真实议程推进结算击败与 1 点肉体创伤', () => {
  const state = part3()
  const index = state.agendas.findIndex(agenda => codeOf(agenda) === RAW3.agendaDeeper)
  assert.ok(index >= 0)
  state.agendaIndex = index
  const before = Object.values(state.campaign.investigators).map(record => record.trauma?.physical || 0)
  run(state, draft => world.engine.advanceAgenda(draft, []))
  assert.equal(state.investigators.every(inv => inv.defeated), true)
  const after = Object.values(state.campaign.investigators).map(record => record.trauma?.physical || 0)
  assert.deepEqual(after, before.map(value => value + 1))
})
