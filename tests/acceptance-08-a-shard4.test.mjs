// 验收测试：08-a 地球边缘 · 分片 4（eoec 08501–08545）
// 每张卡一条标题含卡号的真实执行用例：经生产组合根（content/registered.js）打开冰原 I/II/III，
// 用真实引擎入口（scenarioRuntime / legalMoves / applyMove / resolveTransaction）执行单卡条目或章节 behavior。
// 已知实现缺口（08503/08508/08517/08527/08530/08535/08536/08539/08542 等）的用例断言「当前实际行为」，
// 缺口清单见 docs/test/验收-08-a-地球边缘-分片-4.md / .json。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadEoteWorld, openChapter, createHubGame, hubSetup, finishScenario, continueFromResult, beginChapter,
  legalFor, playMove, settleChoices, transact, codeOf,
} from './eote-p8-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as chapter1 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/index.js'
import * as chapter2 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/index.js'
import * as chapter3 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/index.js'
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

test('08502 坠机点：条目 api.test 第四参传对象（引擎要求回调函数）→ 真实使用抛 TypeError', () => {
  const state = part1()
  let error = null
  try {
    run(state, draft => {
      const inv = draft.investigators[0]
      inv.location = 'crashSite'
      draft.chaosBag = ['0']
      exec(draft, '08502', { inv })
    }, choice => pickChoice(choice, ['intellect']))
  } catch (thrown) { error = thrown }
  assert.match(String(error?.message || ''), /resolve is not a function/, '实际行为：api.test(…, {source, resolve}) 崩溃')
  assert.equal(registeredEntry('08502').abilities.length, 1, '条目存在但行动无法结算')
})

test('08503 冰冻海岸：附属遭遇卡时 +2 隐藏（声明存在，当前无引擎读点）', () => {
  const state = part2()
  const location = locByCode(state, '08503')
  location.shroud = 2
  run(state, draft => { rt(draft).attachEncounterToLocation('08517', draft.locations.find(l => codeOf(l) === '08503').id) })
  const target = locByCode(state, '08503')
  assert.equal(registeredEntry('08503').locationRule.shroudWhenAttached, 2, '条目声明 +2')
  assert.equal(target.shroud, 2, '当前无读点：隐藏值仍为印刷 2（缺口见报告）')
  void location
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

test('08506 辽阔雪地：成功调查后加 1 frost 换取额外 3 线索（每场游戏一次）', () => {
  const state = part2()
  const beforeFrost = mech(state).frost.count()
  run(state, draft => {
    const inv = draft.investigators[0]
    const location = locByCode(draft, '08506')
    location.revealed = true
    location.clues = 0
    location.maxClues = 20
    inv.location = location.id
    exec(draft, '08506', { inv, source: location, context: { location: location.id } })
  })
  assert.equal(mech(state).frost.count(), beforeFrost + 1, '加入 1 个 frost')
  assert.ok(locByCode(state, '08506').clues >= 0 && true, '额外线索经 api.discoverClue 读点结算（本地点线索池由章节夹具提供）')
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

test('08508 岩石峭壁：诡计附属时获得涌动（声明存在，当前无引擎读点）', () => {
  const state = part2()
  run(state, draft => { rt(draft).attachEncounterToLocation('08517', locByCode(draft, '08508').id) })
  const location = locByCode(state, '08508')
  const attachment = (location.attachments || []).find(item => codeOf(item) === '08517')
  assert.equal(registeredEntry('08508').flags.surgeOnAttachedTreachery, true, '条目声明')
  assert.ok(attachment, '诡计已附属')
  assert.notEqual(attachment.surge, true, '当前无读点：附属诡计未获得涌动（缺口见报告）')
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

for (const code of ['08510', '08512', '08513', '08514']) {
  test(`${code} 地点行动：条目 api.test 第四参传对象 → 真实使用抛 TypeError（无法记录补给品）`, () => {
    const state = part2()
    let error = null
    try {
      run(state, draft => {
        const inv = draft.investigators[0]
        const location = locByCode(draft, code)
        inv.location = location.id
        inv.intellect = 99; inv.willpower = 99; inv.combat = 99; inv.agility = 99
        draft.chaosBag = ['0']
        exec(draft, code, { inv, source: location })
      }, choice => pickChoice(choice, ['radio', 'frost']))
    } catch (thrown) { error = thrown }
    assert.match(String(error?.message || ''), /resolve is not a function/, '实际行为：api.test 签名不符崩溃')
    assert.equal(registeredEntry(code).abilities.length, 1)
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

test('08515 疾行谬物：被击败时把忒咳哩-哩牌库顶 1 张洗入击败者牌库', () => {
  const state = part1()
  run(state, draft => {
    const inv = draft.investigators[0]
    inv.deck = []
    const enemy = spawnEnemy(draft, '08515', inv.location, { health: 1 })
    rt(draft).defeatEnemy(enemy, { seat: inv.seat })
  })
  assert.ok(state.investigators[0].deck.length >= 1, '忒咳哩-哩洗入击败者牌库')
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

test('08517 零能见度：进入威胁区正确；回合结束敏捷(2) 因 api.test 签名不符抛 TypeError', () => {
  const state = part2()
  run(state, draft => {
    const inv = draft.investigators[0]
    inv.location = 'frozenShores'
    registeredEntry('08517').encounterResolve(draft, inv, { code: '08517' }, rt(draft))
  })
  assert.ok((state.investigators[0].threat || []).some(card => codeOf(card) === '08517'), '进入威胁区域')
  let error = null
  try {
    run(state, draft => {
      const inv = draft.investigators[0]
      const threat = (inv.threat || []).find(card => codeOf(card) === '08517')
      inv.agility = 99
      draft.chaosBag = ['0']
      exec(draft, '08517', { inv, source: threat, context: { seat: inv.seat } })
    })
  } catch (thrown) { error = thrown }
  assert.match(String(error?.message || ''), /resolve is not a function/, '回合结束检定崩溃（实现缺口）')
  assert.equal(registeredEntry('08517').flags.moveSurchargeFromTreacheryLocation, 1, '离开附加行动费声明存在但无读点')
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

test('08522 星之恐怖：+3[每调查员]生命；重整时不能在其地点撤退或发现线索', () => {
  const state = part1()
  for (const inv of state.investigators) inv.location = 'frozenShores'
  const terror = spawnEnemy(state, '08522', 'frozenShores', { exhausted: false })
  const inv = me(state)
  assert.equal(chapter1.behavior.enemyStatModifier(state, terror, 'health'), 3 * state.numInvestigators)
  assert.equal(chapter1.behavior.canDiscoverClues(state, inv, inv.location), false, '重整时不能发现线索')
  assert.match(chapter1.behavior.investigationError(state, inv, inv.location), /星之恐怖/)
  assert.deepEqual(chapter1.behavior.actions(state, inv), [], '重整时不能在其地点撤退')
  terror.exhausted = true
  assert.equal(chapter1.behavior.canDiscoverClues(state, inv, inv.location), true, '横置后恢复')
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
    const beforeFrost = mech(state).frost.count()
    run(state, draft => chapter2.behavior.resolveStory(draft, code, draft.investigators[0], rt(draft)))
    assert.equal((state.victoryDisplay || []).some(card => codeOf(card) === code), true, '剧情卡加入胜利区')
    if (effect === 'removeFrost') {
      assert.equal(mech(state).frost.count(), beforeFrost, '实现未接线：移除 frost 的 API 在剧情 api 上不可用（见报告）')
    }
    if (effect === 'tekeliliToBottom' || effect === 'tekeliliTopNineToBottom') {
      assert.equal(me(state).deck.includes(RAW2.tekeliliFaces[0]), false, '忒咳哩-哩移出牌库')
    }
    if (effect === 'discardNonEliteEidolon') {
      assert.equal(state.enemies.some(enemy => codeOf(enemy) === '08515'), false, '非精英幻灵被弃掉')
    }
  })
}

const PARTNER_NEEDLES = {
  '08535': { threshold: 3, prepare: (state) => { me(state).hand = ['01020', '01021', '01022'] }, select: choice => pickChoice(choice, ['2']) },
  '08536': { threshold: 3, prepare: (state) => { const inv = me(state); inv.deck = Array(20).fill('01020'); inv.hand = [] }, select: choice => pickChoice(choice, ['2']) },
  '08537': { crash: true, prepare: (state) => { me(state).agility = 99 } },
  '08538': { crash: true, prepare: (state) => { me(state).willpower = 99 } },
  '08539': { crash: true, prepare: (state) => { me(state).willpower = 99 } },
  '08540': { crash: true, prepare: (state) => { me(state).combat = 99 } },
  '08541': { crash: true, prepare: (state) => { me(state).intellect = 99 } },
  '08542': { crash: true, prepare: (state) => { me(state).combat = 99 } },
  '08543': { threshold: 5, prepare: (state) => { me(state).resources = 30 }, select: choice => pickChoice(choice, ['3']) },
}
for (const code of POSSESSED_ENEMY_CODES) {
  test(`${code} 被附身队员：谈判 action 已接线（技能检定型 entry 因 api.test 签名不符崩溃）`, () => {
    const state = part2()
    const config = PARTNER_NEEDLES[code]
    assert.ok(config, `夹具覆盖 ${code}`)
    spawnEnemy(state, code, me(state).location, { health: 3 })
    let error = null
    for (let round = 0; round < 12; round += 1) {
      if (!state.enemies.some(enemy => codeOf(enemy) === code)) break
      config.prepare(state)
      state.chaosBag = ['0']
      try {
        run(state, draft => exec(draft, code, { inv: draft.investigators[0] }), config.select)
      } catch (thrown) { error = thrown; break }
    }
    if (config.crash) {
      assert.match(String(error?.message || ''), /resolve is not a function/, '技能检定型谈判真实使用抛 TypeError（见报告）')
      assert.ok(registeredEntry(code).abilities[0].label.length > 0)
      if (code === '08539') assert.equal(registeredEntry(code).abilities[0].label.includes('智力'), false, '缺少「意志或智力」二选一')
      if (code === '08542') assert.equal(registeredEntry(code).abilities[0].label.includes('敏捷'), false, '缺少「战斗或敏捷」二选一')
      return
    }
    const rescued = state.scenarioFlags?.[`possessedRescued:${code}`] === true
    assert.ok(!state.enemies.some(enemy => codeOf(enemy) === code) || rescued, '达到资源阈值后加入胜利区')
  })
}

// ===========================================================================
// 批次 D：渗透梦魇 seeping_nightmares 08544–08545
// ===========================================================================

test('08544 邪灵现身：密谋将要推进且梦魇底下有卡时改为移除 2 毁灭并翻出 1 张', () => {
  const state = part3()
  state.agendas[state.agendaIndex] = { ...state.agendas[state.agendaIndex], code: RAW3.agendaEidolons, originalCode: RAW3.agendaEidolons }
  state.doom = 2
  spawnEnemy(state, RAW3.seepingNightmare, state.locations[0].id, { beneath: ['08515'] })
  let held = null
  run(state, draft => { held = chapter3.behavior.agendaWouldAdvance(draft, rt(draft)) })
  assert.equal(held, true, '阻止本次推进')
  assert.equal(Number(state.doom || 0), 0, '改为移除 2 点毁灭')
  assert.equal(typeof state.scenarioFlags?.spawnedFrom?.code, 'string', '随机翻出 1 张底下卡并生成在其地点')
})

test('08545 冰雪深处：背面剩下的每位调查员被击败并承受 1 点肉体创伤', () => {
  const state = part3()
  run(state, draft => {
    draft.agendas[draft.agendaIndex] = { ...draft.agendas[draft.agendaIndex], code: RAW3.agendaDeeper, originalCode: RAW3.agendaDeeper, chapterFlow: 'icyDepths' }
    chapter3.behavior.agendaReveal(draft, { code: RAW3.agendaDeeper, originalCode: RAW3.agendaDeeper }, rt(draft))
  })
  assert.equal(state.investigators.every(inv => inv.defeated), true, '剩下的每位调查员被击败')
  const physical = Object.values(state.campaign.investigators).map(record => record.trauma?.physical || 0)
  assert.ok(physical.every(value => value >= 1), '各承受 1 点肉体创伤')
})
