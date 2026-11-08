// IDP 修复验收探针（P0-1/2/3/4）— 真实引擎路径（生产组合根 content/registered.js）。
//
// 运行：cd G:\boardgame-hall-ai\games\arkhamhorror
//       node docs/edgeOfTheEarth/eote-scan/campaign/a/_fix-idp-p0.mjs
//
// 覆盖：
//   P0-1 三章 behavior 导出 actions/performAction，legalMoves 出现 scenarioAction，真实 applyMove 结算。
//   P0-2 三章 agendaReveal/actReveal 接线，advanceAgenda/advanceAct 不再抛「尚未迁移」，结局记录写入。
//   P0-3 三章 resolveChaosToken 真实检定数值（skull/cultist/tablet）与 Part III afterTest 失败后果。
//   P0-4 EOTE 地点 shroud 进入地点数据（调查难度有限）、未探索地点入场费在揭示前收取。
import {
  loadEoteWorld, createHubGame, hubSetup, finishScenario, continueFromResult, beginChapter,
  legalFor, decisionSeat, playMove, settleChoices, transact,
} from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const P1 = 'iceAndDeathPart1'
const P2 = 'iceAndDeathPart2'
const P3 = 'iceAndDeathPart3'
const out = []
const log = (...parts) => out.push(parts.join(' '))
let failures = 0
const check = (name, cond, detail = '') => {
  if (!cond) failures += 1
  log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` | ${detail}` : ''}`)
}
const run = (label, fn) => {
  try {
    const value = fn()
    log(`OK   ${label}`)
    return value
  } catch (error) {
    log(`THREW ${label} | ${error.constructor?.name || 'Error'}: ${error.message}`)
    failures += 1
    return undefined
  }
}
const isScenarioEnded = error => error?.constructor?.name === 'ScenarioEnded'
const scenarioResult = (state, id) => state.campaign?.scenarioResults?.at(-1)
const IDS = [P1, P2, P3]
// IDP 三章连续推进：P1/P2 用 resolution1 结算；检查点 II 必须选「留下战斗」才能进入第 III 部分。
// （fixture 的 openChapter 默认选择第一项=逃跑，会进入 fatalMirage，因此这里显式驱动。）
const openIdpChapter = index => {
  const state = createHubGame(world, { seats: 2, seed: 'probe-fix-idp', investigatorCodes: ['08001', '08004'] })
  hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
  for (let current = 0; current < index; current++) {
    if (state.scenario.id !== IDS[current]) throw new Error(`推进到第 ${current + 1} 章时关卡不符：${state.scenario.id}`)
    finishScenario(world, state, 'resolution1')
    continueFromResult(world, state, {
      upgrades: false,
      storySelect: choice => (choice.options.some(option => option.id === 'stand') ? 'stand' : null),
    })
    beginChapter(world, state)
  }
  if (state.scenario.id !== IDS[index]) throw new Error(`应停在第 ${index + 1} 章：${state.scenario.id}`)
  return state
}
const chapterState = id => openIdpChapter(IDS.indexOf(id))

// ---------------------------------------------------------------------------
// A. 钩子契约（生产 contentRegistry 读到的 behavior 对象）
// ---------------------------------------------------------------------------
log('=== A. behavior 钩子契约（production contentRegistry） ===')
for (const id of [P1, P2, P3]) {
  const keys = Object.keys(world.contentRegistry.getBehavior(id))
  check(`${id} actions`, keys.includes('actions'))
  check(`${id} performAction`, keys.includes('performAction'))
  check(`${id} agendaReveal`, keys.includes('agendaReveal'))
  check(`${id} actReveal`, keys.includes('actReveal'))
  check(`${id} resolveChaosToken`, keys.includes('resolveChaosToken'))
  check(`${id} checkObjectives`, keys.includes('checkObjectives'))
}

// ---------------------------------------------------------------------------
// B. P0-4a 地点 shroud 进入数据 → 调查难度不再是 NaN
// ---------------------------------------------------------------------------
log('\n=== B. P0-4 地点 shroud / 调查难度 ===')
{
  const state = chapterState(P1)
  const bad = state.locations.filter(location => !Number.isFinite(location.shroud))
  check('P1 全部地点 shroud 有限', bad.length === 0, bad.map(location => location.id).join(',') || 'ok')
  const broad = state.scenario.locations.broadSnowdrifts
  check('definition 地点数据带印刷 shroud', broad.shroud === 1, `broadSnowdrifts shroud=${broad.shroud}`)
  const seat = decisionSeat(world, state)
  let moves = legalFor(world, state, seat)
  const moveToShores = moves.find(move => move.action === 'move' && move.locationId === 'frozenShores')
  check('可移动到冰冻海岸（已揭示、无入场费）', Boolean(moveToShores))
  if (moveToShores) {
    playMove(world, state, moveToShores, seat)
    settleChoices(world, state)
    const seat2 = decisionSeat(world, state)
    const moves2 = legalFor(world, state, seat2)
    const investigate = moves2.find(move => move.action === 'investigate')
    check('调查行动 label 携带数值帷幕', Boolean(investigate) && /帷幕 \d+/.test(investigate.label), investigate?.label)
    if (investigate) {
      playMove(world, state, investigate, seat2)
      check('调查难度为有限数值', Number.isFinite(state.skillTest?.difficulty), `difficulty=${state.skillTest?.difficulty}`)
      settleChoices(world, state)
    }
  }
}

// ---------------------------------------------------------------------------
// C. P0-4b 未探索地点入场费（beforeMove，揭示前收费；线索不足不可进入）
// ---------------------------------------------------------------------------
log('\n=== C. P0-4 未探索地点入场费 ===')
{
  const state = chapterState(P1)
  const seat = decisionSeat(world, state)
  const moveToShores = legalFor(world, state, seat).find(move => move.action === 'move' && move.locationId === 'frozenShores')
  playMove(world, state, moveToShores, seat)
  settleChoices(world, state)
  const broad = state.locations.find(location => location.id === 'broadSnowdrifts')
  check('进入冰冻海岸后放置相连的辽阔雪地', Boolean(broad) && broad.revealed === false)
  const seat2 = decisionSeat(world, state)
  const withoutClues = legalFor(world, state, seat2)
  check('线索不足时未探索地点不出现在 legalMoves',
    !withoutClues.some(move => move.action === 'move' && move.locationId === 'broadSnowdrifts'))
  state.investigators[seat2].clues = 2 // 2 人局：1[per_investigator]×2 = 2
  const seat3 = decisionSeat(world, state)
  const withClues = legalFor(world, state, seat3)
  const intoBroad = withClues.find(move => move.action === 'move' && move.locationId === 'broadSnowdrifts')
  check('线索足够时未探索地点进入 legalMoves', Boolean(intoBroad), intoBroad?.label)
  if (intoBroad) {
    playMove(world, state, intoBroad, seat3)
    settleChoices(world, state)
    const after = state.locations.find(location => location.id === 'broadSnowdrifts')
    check('入场费已收取（-2 线索）', state.investigators[seat3].clues === 0, `clues=${state.investigators[seat3].clues}`)
    check('未探索地点揭示', after.revealed === true)
    check('揭示后按 maxClues 放置线索', after.clues === 4, `clues=${after.clues}`)
  }
}

// ---------------------------------------------------------------------------
// D. P0-1 剧本行动 + 三章真实推进到 scenarioResult
// ---------------------------------------------------------------------------
log('\n=== D. P0-1 actions/performAction + 章节真实结算 ===')
{
  // P1：所有调查员在坠机点（0 线索）→ legalMoves 有 campResign → applyMove → 结局 1。
  const state = chapterState(P1)
  const seat = decisionSeat(world, state)
  const resign = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  check('P1 legalMoves 含 campResign', Boolean(resign), resign?.label)
  if (resign) {
    playMove(world, state, resign, seat)
    settleChoices(world, state)
    check('P1 真实结算进入 scenarioResult', state.uiState === 'scenarioResult', `uiState=${state.uiState}`)
    check('P1 结局 records.iceAndDeathPart1Resolution', state.campaign.records.iceAndDeathPart1Resolution === 'resolution1')
    check('P1 检查点营地记录 Camp_*', Object.entries(state.campaign.records)
      .some(([key, value]) => key.startsWith('camp') && key !== 'camp' && value === true))
    check('P1 检查点庇护值快照已写入', Number.isSafeInteger(state.campaign.records.eoteShelterValue))
    check('P1 scenarioResults 结局键', scenarioResult(state, P1)?.resolution === 'resolution1')
  }
}
{
  // P2：营地（继承记录）→ legalMoves 有 campResign → applyMove → 结局 1。
  const state = chapterState(P2)
  const seat = decisionSeat(world, state)
  const resign = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  check('P2 legalMoves 含 campResign', Boolean(resign), resign?.label)
  if (resign) {
    playMove(world, state, resign, seat)
    settleChoices(world, state)
    check('P2 真实结算进入 scenarioResult', state.uiState === 'scenarioResult', `uiState=${state.uiState}`)
    check('P2 结局 records.iceAndDeathPart2Resolution', state.campaign.records.iceAndDeathPart2Resolution === 'resolution1')
    check('P2 scenarioResults 结局键', scenarioResult(state, P2)?.resolution === 'resolution1')
  }
}
{
  // P2：[fast] 抽取地点底下遭遇卡（真实 applyMove；线索做前置准备）。
  const state = chapterState(P2)
  const host = state.locations.find(location => (location.beneath || []).length)
  for (const inv of state.investigators) inv.location = host.id
  for (const inv of state.investigators) inv.clues = 1 // 1[per_investigator]×2 = 2
  state.investigators[1].clues = 1
  const seat = decisionSeat(world, state)
  const draw = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'drawUnderLocation')
  check('P2 legalMoves 含 drawUnderLocation', Boolean(draw), draw?.label)
  if (draw) {
    const hostId = host.id
    const before = host.beneath.length
    playMove(world, state, draw, seat)
    settleChoices(world, state)
    // 事务会用 draft 重建 state：地点对象已换新，必须按 id 重新取。
    const hostAfter = state.locations.find(location => location.id === hostId)
    check('P2 底牌被抽走', (hostAfter.beneath || []).length === before - 1,
      `beneath=${before}->${hostAfter.beneath.length}`)
    check('P2 共同花费线索', state.investigators.reduce((sum, inv) => sum + inv.clues, 0) === 0)
  }
}
{
  // P3：营地共同花 4 线索撤退（真实 applyMove）→ 结局 2（撤退路线）。
  const state = chapterState(P3)
  const camp = state.scenarioFlags.camp
  const group = state.investigators.filter(inv => inv.location === camp)
  for (const inv of group) inv.clues = Math.ceil(4 / group.length)
  const seat = decisionSeat(world, state)
  const resign = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  check('P3 legalMoves 含营地撤退', Boolean(resign), resign?.label)
  if (resign) {
    playMove(world, state, resign, seat)
    settleChoices(world, state)
    check('P3 真实结算进入 scenarioResult', state.uiState === 'scenarioResult', `uiState=${state.uiState}`)
    check('P3 撤退路线 → 结局 2', state.campaign.records.iceAndDeathPart3Resolution === 'resolution2')
    check('P3 记录队伍逃进群山', state.campaign.records.theTeamFledToTheMountains === true)
    check('P3 scenarioResults 结局键', scenarioResult(state, P3)?.resolution === 'resolution2')
  }
}

// ---------------------------------------------------------------------------
// E. P0-2 议程/幕 reveal（真实 advanceAgenda/advanceAct，事务内回答选择）
// ---------------------------------------------------------------------------
log('\n=== E. P0-2 议程/幕 reveal ===')
{
  // P1 三张议程背面依次结算；第三张触发幕目标 → 结局 1。
  const state = chapterState(P1)
  const select = () => null
  const first = transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
    ?? {}
  const leaders = state.investigators.filter(inv => !inv.defeated)
  check('P1 议程 1 背面生成疾行谬物', state.enemies.some(enemy => (enemy.originalCode || enemy.code) === '08515'),
    `enemies=${state.enemies.map(enemy => enemy.code).join(',')}`)
  check('P1 议程推进到 2', state.agendaIndex === 1, `agendaIndex=${state.agendaIndex}`)
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
  check('P1 议程 2 背面生成星之恐怖', state.enemies.some(enemy => (enemy.originalCode || enemy.code) === '08522'))
  check('P1 议程推进到 3', state.agendaIndex === 2, `agendaIndex=${state.agendaIndex}`)
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
  check('P1 议程 3 背面结算结局 1', scenarioResult(state, P1)?.resolution === 'resolution1',
    `records=${state.campaign.records.iceAndDeathPart1Resolution}`)
  check('P1 存活者均已撤退/结算', Number.isSafeInteger(state.campaign.records.iceAndDeathPart1CampShelter))
  log(`     P1 议程结算后 leader=${leaders.length} 人；encounterDeck=${state.encounterDeck.length}`)
}
{
  // P2 三张议程背面：查看底牌 ×2 → 疯狂与死亡（全员被击败 + 结局 1）。
  const state = chapterState(P2)
  const select = (choice) => choice.options[0]?.id
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
  check('P2 议程 4 背面查看底牌', Boolean(state.scenarioFlags.lookedAt?.code), JSON.stringify(state.scenarioFlags.lookedAt))
  check('P2 议程推进到 5', state.agendaIndex === 1, `agendaIndex=${state.agendaIndex}`)
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
  check('P2 议程 5 背面查看底牌', Boolean(state.scenarioFlags.lookedAt?.code))
  check('P2 议程推进到 6', state.agendaIndex === 2, `agendaIndex=${state.agendaIndex}`)
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
  check('P2 议程 6 背面结案（结局 1）', scenarioResult(state, P2)?.resolution === 'resolution1',
    `records=${state.campaign.records.iceAndDeathPart2Resolution}`)
  check('P2 疯狂与死亡：剩余调查员全部被击败', state.investigators.every(inv => inv.defeated))
}
{
  // P3 议程 7 强制：底下有卡 → 阻止推进，移除 2 毁灭并生成 1 张底牌。
  const state = chapterState(P3)
  state.doom = 5
  const enemiesBefore = state.enemies.length
  const host = state.enemies.find(enemy => (enemy.beneath || []).length)
  const hostId = host.id
  const beneathBefore = host.beneath.length
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), () => null)
  const hostAfter = state.enemies.find(enemy => enemy.id === hostId)
  check('P3 议程强制阻止推进（agendaIndex 仍 0）', state.agendaIndex === 0, `agendaIndex=${state.agendaIndex}`)
  check('P3 移除 2 点毁灭', state.doom === Math.max(0, 5 - 2), `doom=${state.doom}`)
  check('P3 底牌减少 1 张', (hostAfter?.beneath || []).length === beneathBefore - 1,
    `beneath=${beneathBefore}->${hostAfter?.beneath?.length}`)
  check('P3 翻出的卡真实生成', state.enemies.length >= enemiesBefore, `enemies=${enemiesBefore}->${state.enemies.length}`)
  // 清空所有底下卡后，议程 7 背面结算（队长二选一 → frost），随后议程 8 背面击败剩余调查员。
  for (const enemy of state.enemies) enemy.beneath = []
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), choice =>
    (choice.options.some(option => option.id === 'frost') ? 'frost' : choice.options[0]?.id))
  check('P3 议程 7 背面：加入 1 个 frost', (state.chaosBag || []).filter(token => token === 'frost').length >= 1)
  check('P3 议程推进到 2', state.agendaIndex === 1, `agendaIndex=${state.agendaIndex}`)
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), () => null)
  check('P3 议程 8 背面：剩余调查员被击败', state.investigators.every(inv => inv.defeated || inv.resigned))
  check('P3 议程 8 后走 noResolution', scenarioResult(state, P3)?.resolution === 'noResolution',
    `records=${state.campaign.records.iceAndDeathPart3Resolution}`)
}
{
  // P3 幕 3 背面：无幻灵敌人 → 结局 1（真实 advanceAct 入口）。
  const state = chapterState(P3)
  state.enemies = []
  transact(world, state, draft => world.engine.advanceAct(draft, []), () => null)
  check('P3 幕目标（无幻灵）→ 结局 1', scenarioResult(state, P3)?.resolution === 'resolution1',
    `records=${state.campaign.records.iceAndDeathPart3Resolution}`)
  check('P3 结局 1 记录击败追猎生物', state.campaign.records.theTeamDefeatedTheHuntingCreatures === true)
}

// ---------------------------------------------------------------------------
// F. P0-3 混乱标记真实检定数值 + Part III afterTest
// ---------------------------------------------------------------------------
log('\n=== F. P0-3 混乱标记 ===')
for (const [id, shelter] of [[P1, 2], [P2, 2], [P3, 2]]) {
  const state = chapterState(id)
  const inv = state.investigators[0]
  inv.location = 'frozenShores'
  const shelterValue = state.locations.find(location => location.id === 'frozenShores')?.shelter
  const skull = world.engine.resolveSpecialToken(state, inv.seat, inv, 'skull', [])
  const cultist = world.engine.resolveSpecialToken(state, inv.seat, inv, 'cultist', [])
  const tablet = world.engine.resolveSpecialToken(state, inv.seat, inv, 'tablet', [])
  check(`${id} [skull] 数值`, skull.delta === Math.ceil(shelterValue / 2),
    `shelter=${shelterValue} delta=${skull.delta}`)
  check(`${id} [cultist] 数值`, cultist.delta === -2, `delta=${cultist.delta}`)
  check(`${id} [tablet] 数值`, tablet.delta === -3, `delta=${tablet.delta}`)
  state.difficulty = 'hard'
  const hardTablet = world.engine.resolveSpecialToken(state, inv.seat, inv, 'tablet', [])
  const hardSkull = world.engine.resolveSpecialToken(state, inv.seat, inv, 'skull', [])
  check(`${id} 困难 [tablet] 数值`, hardTablet.delta === -4, `delta=${hardTablet.delta}`)
  check(`${id} 困难 [skull] 数值`, hardSkull.delta === shelterValue, `delta=${hardSkull.delta}`)
  log(`     ${id} 使用庇护值 ${shelter} 对照（冻结海岸）`)
}
{
  // Part III 失败后果（afterTest）：[cultist] 失败 → 忒咳哩-哩洗入；[tablet] 失败 → 弃牌库顶。
  // 注意：事务会按 draft 重建 state，事务前后必须按 seat 重新取调查员对象。
  const cultistState = chapterState(P3)
  const cultistSeat = cultistState.investigators[0].seat
  cultistState.chaosBag = ['cultist']
  const deckBefore = cultistState.investigators[0].deck.length
  const tekeliBefore = cultistState.scenarioFlags?.mechanics?.eote?.tekeli
  run('P3 [cultist] 失败后 afterTest（真实 performTest）', () => {
    transact(world, cultistState, draft => {
      world.engine.performTest(draft, cultistSeat, 'intellect', 100, { resolve: () => {} })
    }, () => null)
  })
  const cultistInvAfter = cultistState.investigators[cultistSeat]
  const tekeliDeckAfter = cultistState.scenarioFlags?.mechanics?.eote?.tekeli
  check('P3 [cultist] afterTest：忒咳哩-哩洗入牌库', cultistInvAfter.deck.length === deckBefore + 1,
    `deck=${deckBefore}->${cultistInvAfter.deck.length}（tekeli meta=${tekeliBefore ? 'yes' : 'no'}/${tekeliDeckAfter ? 'yes' : 'no'}）`)
  const tabletState = chapterState(P3)
  const tabletSeat = tabletState.investigators[0].seat
  tabletState.chaosBag = ['tablet']
  const discardBefore = tabletState.investigators[0].discard.length
  run('P3 [tablet] 失败后 afterTest（真实 performTest）', () => {
    transact(world, tabletState, draft => {
      world.engine.performTest(draft, tabletSeat, 'intellect', 100, { resolve: () => {} })
    }, () => null)
  })
  const tabletInvAfter = tabletState.investigators[tabletSeat]
  check('P3 [tablet] afterTest：弃掉牌库顶', tabletInvAfter.discard.length > discardBefore,
    `discard=${discardBefore}->${tabletInvAfter.discard.length}`)
}

// ---------------------------------------------------------------------------
// G. 结论
// ---------------------------------------------------------------------------
log(`\nRESULT: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures} failing checks)`)
console.log(out.join('\n'))
process.exitCode = failures === 0 ? 0 : 1
