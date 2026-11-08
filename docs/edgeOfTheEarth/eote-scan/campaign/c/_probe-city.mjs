// 古者之城（City of the Elder Things · 08621）P0-6 / P0-12 / P0-8 真实引擎探针。
//
// 口径：生产组合根 tests/eote-p8-fixture.mjs（content/registered.js → 真实 createGameState /
// startScenario / legalMoves / applyMove / 事务 / 遭遇抽牌）。探针只做「布置」性质的准备
// （把调查员放到目标地点、揭示地点、固定混乱袋、把 v3 幕牌库换上），被验收的行为一律走真实
// 引擎入口：legalMoves → applyMove / engine.advanceAgenda / engine.drawEncounter / 剧本钩子
// 的既有引擎读点（enemyMoved）；不直接调用 behavior.performAction / behavior.claimKey 冒充。
//
// 运行：cd games/arkhamhorror && node docs/edgeOfTheEarth/eote-scan/campaign/c/_probe-city.mjs
import {
  loadEoteWorld, createHubGame, hubSetup, finishScenario, continueFromResult, beginChapter,
  legalFor, decisionSeat, playMove, transact, settleChoices,
} from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'
import { writeFileSync } from 'node:fs'
import { valueKeysAt, spendValueKeys } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/scenario-keys.js'
import {
  actsForVersion, REMOVED_BY_VERSION, SET_ASIDE_BY_VERSION, ENCOUNTER_DECK_BY_VERSION,
  RAW_CODES, HIDDEN_TUNNEL,
} from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js'

const world = await loadEoteWorld()
const out = []
const log = (...parts) => { out.push(parts.join(' ')) }
const results = []
const check = (id, ok, detail = '') => {
  results.push({ id, ok: Boolean(ok), detail: String(detail ?? '') })
  log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` :: ${detail}` : ''}`)
}
const section = title => log(`\n=== ${title} ===`)
const S = (state, id) => state.locations.find(loc => loc.id === id)
const runtimeOf = state => world.engine.scenarioRuntime(state, [])
const actionRules = (state, seat) => legalFor(world, state, seat)
  .filter(move => move.action === 'scenarioAction').map(move => String(move.rule))

function hubCity(seed) {
  const state = createHubGame(world, { seats: 2, humans: [0, 1], seed, investigatorCodes: ['08001', '08004'] })
  hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
  // 章节推进按 uiState 走，不写死章节表（其它章节的检查点修复会改变真实顺序）。
  for (let guard = 0; guard < 16 && state.scenario?.id !== 'cityOfTheElderThings'; guard += 1) {
    if (state.uiState === 'inScenario') finishScenario(world, state, Object.keys(state.scenario.resolutions)[0])
    else if (state.uiState === 'scenarioResult') continueFromResult(world, state, { upgrades: false })
    else if (state.uiState === 'scenarioSetup') beginChapter(world, state)
    else throw new Error(`推进古者之城时遇到未知 uiState=${state.uiState}`)
  }
  if (state.scenario?.id !== 'cityOfTheElderThings' || state.uiState !== 'inScenario') {
    throw new Error(`未到达古者之城 inScenario：${state.scenario?.id} / ${state.uiState}`)
  }
  // 单标记混乱袋：探针需要确定性结果（+5 = 必过；需要失败时整袋换成 autofail）。
  state.chaosBag = ['+5']
  return state
}
const seatNow = state => state.currentSeat
function endTurn(state) {
  const seat = seatNow(state)
  const inv = state.investigators[seat]
  if (!inv) return false
  inv.actionsLeft = 0
  const end = legalFor(world, state, seat).find(move => move.action === 'endTurn')
  if (!end) return false
  playMove(world, state, end, seat)
  settleChoices(world, state)
  return true
}
function rotateTo(state, seat, limit = 6) {
  for (let guard = 0; guard < limit && seatNow(state) !== seat; guard += 1) if (!endTurn(state)) break
  return seatNow(state) === seat
}
// 布置：真实 runtime 的移动/揭示入口（不是行为私有函数）。
function placeAt(state, seat, locationId) {
  runtimeOf(state).moveInvestigator(seat, locationId)
  const loc = S(state, locationId)
  if (loc && !loc.revealed) runtimeOf(state).reveal(locationId, seat)
}
// 真实 investigate 行动清空地点线索。
function clearCluesReal(state, seat, locationId, limit = 10) {
  for (let guard = 0; guard < limit; guard += 1) {
    const loc = S(state, locationId)
    if (!loc || (loc.clues || 0) <= 0) return true
    if (!rotateTo(state, seat)) return false
    const investigate = legalFor(world, state, seat).find(move => move.action === 'investigate')
    if (!investigate) return false
    playMove(world, state, investigate, seat)
    settleChoices(world, state)
  }
  return (S(state, locationId)?.clues || 0) <= 0
}
function keyHolderOfValue(state, value) {
  for (const loc of state.locations) {
    if (loc.id === HIDDEN_TUNNEL) continue
    if (valueKeysAt(state, `location:${loc.id}`).some(key => String(key.value) === String(value))) return loc.id
  }
  return null
}
// 引擎的 scenario-keys 写入口（probe 布置用；claim 入口本身由 P0-6.1–6.4 验证）。
const spendValueKeysForProbe = (state, holderId, value, seat) =>
  spendValueKeys(state, `location:${holderId}`, { values: [value], destination: `investigator:${seat}` })
// 真实 claim 路径取得 1 把指定数值的钥匙（legalMoves 的 key:claim + applyMove）。
function claimValue(state, seat, value) {
  const locationId = keyHolderOfValue(state, value)
  if (!locationId) return { ok: false, reason: `城市景观上没有 ${value} 钥匙` }
  placeAt(state, seat, locationId)
  if (!clearCluesReal(state, seat, locationId)) return { ok: false, reason: '真实调查未能清空线索' }
  if (!rotateTo(state, seat)) return { ok: false, reason: '无法轮转回该调查员回合' }
  const claim = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'key:claim')
  if (!claim) return { ok: false, reason: `claim 不在 legalMoves: ${actionRules(state, seat).join(',')}` }
  playMove(world, state, claim, seat)
  settleChoices(world, state)
  const values = valueKeysAt(state, `investigator:${seat}`).map(key => String(key.value))
  return { ok: values.includes(String(value)), value, values, locationId }
}

// ---------------------------------------------------------------------------
section('0. setup 真实引擎状态')
const state = hubCity('city-p0-probe')
const deckCounts = {}
for (const code of state.encounterDeck) deckCounts[code] = (deckCounts[code] || 0) + 1
log(`scenario=${state.scenario.id} uiState=${state.uiState} acts=${state.acts.map(act => act.originalCode).join(',')}`)
log(`locations=${state.locations.length} encounterDeck=${state.encounterDeck.length} aside=${(state.scenarioZones?.setAside || []).length} removed=${(state.scenarioZones?.removed || []).length}`)
log(`start=${state.investigators[0].location} revealed=${S(state, state.investigators[0].location)?.revealed} clues=${S(state, state.investigators[0].location)?.clues}`)
log(`location shape=${state.locations.slice(0, 4).map(loc => `${loc.id}(clues=${loc.clues},maxClues=${loc.maxClues},revealed=${loc.revealed},shroud=${loc.shroud})`).join(' | ')}`)
log(`deck=${Object.entries(deckCounts).map(([code, count]) => `${code}x${count}`).join(',')}`)
check('0.1 真实遭遇牌库按 v1 gather（含共享组、>20 张）', state.encounterDeck.length === ENCOUNTER_DECK_BY_VERSION.v1.length
  && state.encounterDeck.length > 20 && state.encounterDeck.includes('08695'),
  `len=${state.encounterDeck.length} v1=${ENCOUNTER_DECK_BY_VERSION.v1.length}`)
check('0.2 setAside/removed 与参考 setup 一致', (state.scenarioZones?.setAside || []).length === SET_ASIDE_BY_VERSION.v1.length
  && (state.scenarioZones?.removed || []).length === REMOVED_BY_VERSION.v1.length,
  `aside=${(state.scenarioZones?.setAside || []).join(',')} removed=${(state.scenarioZones?.removed || []).join(',')}`)
check('0.3 起始地点已在 setup 揭示且带线索/帷幕', S(state, state.investigators[0].location)?.revealed === true
  && Number.isFinite(S(state, state.investigators[0].location)?.shroud)
  && S(state, state.investigators[0].location)?.clues > 0,
  `start=${state.investigators[0].location} shroud=${S(state, state.investigators[0].location)?.shroud}`)

// ---------------------------------------------------------------------------
section('P0-12 地点剧本行动 api.test 签名（bridgeDiscover / tunnelInvestigate）')
{
  const seat = decisionSeat(world, state)
  const bridge = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'loc:bridgeDiscover')
  check('P0-12.1 legalMoves 含石桥「发现线索」剧本行动', Boolean(bridge), actionRules(state, seat).join(','))
  if (bridge) {
    let error = null
    try { playMove(world, state, bridge, seat); settleChoices(world, state) } catch (caught) { error = caught }
    check('P0-12.2 石桥 applyMove 无 TypeError/options.resolve', !error, error ? `${error.name}: ${error.message}` : 'ok')
    check('P0-12.3 石桥检定真实结算', Boolean(state.lastTestResult), JSON.stringify(state.lastTestResult?.success))
  }
}

// ---------------------------------------------------------------------------
section('P0-6 钥匙入口：legalMoves 含 claim/give，applyMove 可执行')
{
  const seat = 0
  rotateTo(state, seat)
  const target = state.locations.find(loc => loc.id !== HIDDEN_TUNNEL
    && valueKeysAt(state, `location:${loc.id}`).length > 0)
  placeAt(state, seat, target.id)
  clearCluesReal(state, seat, target.id)
  rotateTo(state, seat)
  const claim = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'key:claim')
  check('P0-6.1 legalMoves 含钥匙取得（claim）', Boolean(claim),
    `loc=${target.id} clues=${S(state, target.id)?.clues} rules=${actionRules(state, seat).join(',')}`)
  if (claim) {
    let error = null
    const before = valueKeysAt(state, `investigator:${seat}`).length
    try { playMove(world, state, claim, seat); settleChoices(world, state) } catch (caught) { error = caught }
    const after = valueKeysAt(state, `investigator:${seat}`).length
    check('P0-6.2 claim applyMove 成功', !error && after === before + 1, `before=${before} after=${after} err=${error?.message || ''}`)
    const other = state.investigators.find(inv => inv.seat !== seat && !inv.defeated && !inv.resigned)
    placeAt(state, other.seat, target.id)
    rotateTo(state, seat)
    const give = legalFor(world, state, seat)
      .find(move => move.action === 'scenarioAction' && move.rule === 'key:give')
    check('P0-6.3 legalMoves 含钥匙交出（give）', Boolean(give), actionRules(state, seat).join(','))
    if (give) {
      let giveError = null
      try { playMove(world, state, give, seat); settleChoices(world, state) } catch (caught) { giveError = caught }
      const otherKeys = valueKeysAt(state, `investigator:${other.seat}`).length
      check('P0-6.4 give applyMove 成功', !giveError && otherKeys >= 1, `otherKeys=${otherKeys} err=${giveError?.message || ''}`)
    }
  }
}

// ---------------------------------------------------------------------------
section('P0-6 幕 1 目标可达（引擎钥匙写入口凑齐 2+2 钥匙 → 幕钥匙行动 → 真实推进 + 揭示隐秘隧道）')
{
  const actState = hubCity('city-p0-act1')
  const seat = decisionSeat(world, actState)
  // 真实 claim/give 入口已由 P0-6.1–6.4 在真实 legalMoves/applyMove 上验证；本节聚焦
  // 「幕 1 目标是否真实可达」，4 把钥匙用引擎 scenario-keys 写入口交给当前调查员
  // （避免探针为清 4 个地点线索而反复 endTurn，Mythos 抽出的敌人会在借机攻击里击败调查员）。
  const granted = []
  for (const value of ['elderthing', 'elderthing', 'tablet', 'tablet']) {
    const holder = keyHolderOfValue(actState, value)
    granted.push(Boolean(holder) && spendValueKeysForProbe(actState, holder, value, seat))
  }
  const controlled = valueKeysAt(actState, `investigator:${seat}`).map(key => String(key.value))
  check('P0-6.5 引擎钥匙写入口凑齐 2+2 把符号钥匙',
    granted.every(Boolean) && controlled.filter(value => value === 'elderthing').length >= 2
      && controlled.filter(value => value === 'tablet').length >= 2,
    `granted=${granted.join(',')} controlled=${controlled.join(',')}`)
    const rotated = rotateTo(actState, seat)
    log(`act1 debug: seat=${seat} currentSeat=${actState.currentSeat} rotated=${rotated} phase=${actState.phase} actions=${actState.investigators[seat]?.actionsLeft} keys=${valueKeysAt(actState, `investigator:${seat}`).map(key => key.value).join(',')}`)
    const study = legalFor(world, actState, seat)
      .find(move => move.action === 'scenarioAction' && move.rule === 'actKey:studyHistory')
    const discern = legalFor(world, actState, seat)
      .find(move => move.action === 'scenarioAction' && move.rule === 'actKey:discernShoggoths')
    check('P0-6.6 幕 1 钥匙研究行动在 legalMoves', Boolean(study) && Boolean(discern), actionRules(actState, seat).join(','))
    if (study && discern) {
      let error = null
      try {
        playMove(world, actState, study, seat); settleChoices(world, actState)
        log(`after study: records=${actState.campaign.records.theTeamStudiedTheHistoryOfTheElderThings}/${actState.campaign.records.theTeamDiscernedTheOriginOfTheShoggoths} keys=${valueKeysAt(actState, `investigator:${seat}`).map(key => key.value).join(',')} actIndex=${actState.actIndex} status=${actState.status} ui=${actState.uiState}`)
        playMove(world, actState, discern, seat); settleChoices(world, actState)
        log(`after discern: records=${actState.campaign.records.theTeamStudiedTheHistoryOfTheElderThings}/${actState.campaign.records.theTeamDiscernedTheOriginOfTheShoggoths} keys=${valueKeysAt(actState, `investigator:${seat}`).map(key => key.value).join(',')} actIndex=${actState.actIndex} status=${actState.status} ui=${actState.uiState}`)
      } catch (caught) { error = caught }
      log(`actIndex=${actState.actIndex} tunnelRevealed=${actState.scenarioFlags?.hiddenTunnelRevealed} tunnelLoc=${JSON.stringify({ revealed: S(actState, HIDDEN_TUNNEL)?.revealed, clues: S(actState, HIDDEN_TUNNEL)?.clues })} deck=${actState.encounterDeck.length}`)
      check('P0-6.7 幕 1 目标达成后真实推进（actIndex→1、隧道揭示、修格斯组洗回）',
        !error && actState.actIndex === 1 && actState.scenarioFlags?.hiddenTunnelRevealed === true
          && S(actState, HIDDEN_TUNNEL)?.revealed === true,
        `actIndex=${actState.actIndex} err=${error?.message || ''}`)
      // 幕 1 背面之后：进入隐秘隧道并走隧道行动（api.test 第二处调用点）。
      // 所有未败退调查员都要进隧道（幕 2 目标），隧道行动本身只要求人在隧道。
      for (let guard = 0; guard < 3; guard += 1) {
        const enterSeat = decisionSeat(world, actState)
        const enter = legalFor(world, actState, enterSeat)
          .find(move => move.action === 'scenarioAction' && move.rule === 'enterHiddenTunnel')
        if (!enter) break
        playMove(world, actState, enter, enterSeat)
        settleChoices(world, actState)
      }
      const tunnelSeat = decisionSeat(world, actState)
      const atTunnel = actState.investigators.filter(inv => !inv.defeated && !inv.resigned
        && inv.location === HIDDEN_TUNNEL).length
      check('P0-6.8 legalMoves 含进入隐秘隧道', atTunnel > 0,
        `atTunnel=${atTunnel} rules=${actionRules(actState, tunnelSeat).join(',')}`)
      const tunnelInvestigate = legalFor(world, actState, tunnelSeat)
        .find(move => move.action === 'scenarioAction' && move.rule === 'loc:tunnelInvestigate')
      check('P0-6.9 隧道行动可用（legalMoves）', Boolean(tunnelInvestigate), actionRules(actState, tunnelSeat).join(','))
      if (tunnelInvestigate) {
        let tunnelError = null
        const before = S(actState, HIDDEN_TUNNEL)?.clues
        try { playMove(world, actState, tunnelInvestigate, tunnelSeat); settleChoices(world, actState) } catch (caught) { tunnelError = caught }
        check('P0-12.4 隧道行动 applyMove 无 TypeError', !tunnelError, tunnelError ? tunnelError.message : `clues ${before} -> ${S(actState, HIDDEN_TUNNEL)?.clues}`)
      }
    }
}

// ---------------------------------------------------------------------------
section('P0-6 议程 2 背面 R2（真实 advanceAgenda）')
{
  const r2state = hubCity('city-p0-r2')
  let error = null
  try {
    transact(world, r2state, draft => world.engine.advanceAgenda(draft, []))
    log(`after agenda advance 1: agendaIndex=${r2state.agendaIndex}`)
    transact(world, r2state, draft => world.engine.advanceAgenda(draft, []))
  } catch (caught) { error = caught }
  const result = r2state.campaign?.scenarioResults?.at(-1)
  check('P0-6.10 议程 2 背面推进到 R2', r2state.resolution === 'resolution2' || result?.resolution === 'resolution2',
    `resolution=${r2state.resolution} result=${result?.resolution} err=${error?.message || ''}`)
  check('P0-6.11 R2 记录 theTeamWasGuidedToTheHiddenTunnel',
    r2state.campaign?.records?.theTeamWasGuidedToTheHiddenTunnel === true,
    JSON.stringify({ guided: r2state.campaign?.records?.theTeamWasGuidedToTheHiddenTunnel }))
}

// ---------------------------------------------------------------------------
section('P0-8 专属诡计从真实遭遇牌库结算')
for (const code of [RAW_CODES.dawningOfTheTruth, RAW_CODES.crumblingRuins, RAW_CODES.frostbitten, RAW_CODES.possessed]) {
  const tstate = hubCity(`city-p0-treachery-${code}`)
  tstate.encounterDeck.push(code)
  // 08644/08645 带检定：单标记 autofail 保证失败分支；08646/08647 是威胁区放置（无检定）。
  tstate.chaosBag = code === RAW_CODES.frostbitten || code === RAW_CODES.possessed ? ['+5'] : ['autofail']
  const before = { threat: tstate.investigators[0].threat.length, horror: tstate.investigators[0].horror, damage: tstate.investigators[0].damage }
  let error = null
  try {
    transact(world, tstate, draft => { world.engine.drawEncounter(draft, draft.investigators[0], []) })
  } catch (caught) { error = caught }
  const after = { threat: tstate.investigators[0].threat.length, horror: tstate.investigators[0].horror, damage: tstate.investigators[0].damage }
  const changed = after.threat > before.threat || after.horror > before.horror || after.damage > before.damage
  check(`P0-8.${code} 真实遭遇结算产生落地效果`, changed,
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)} err=${error?.message || ''}`)
}

// ---------------------------------------------------------------------------
section('08629 actRule.forcedOnEnemyEnter 引擎读点（enemyMoved）')
{
  const fstate = hubCity('city-p0-08629')
  fstate.acts = structuredClone(actsForVersion('v3'))
  fstate.actIndex = 1
  const locA = fstate.locations[0].id
  const locB = fstate.locations[1].id
  const elder = {
    id: 'probe-elder', code: RAW_CODES.benignElderThing, originalCode: RAW_CODES.benignElderThing,
    name: '和蔼的古老者', traits: ['Monster', 'Elder Thing'], health: 3, damageTaken: 0,
    location: locA, engagedSeat: null, exhausted: false, defeated: false, attachments: [],
  }
  const shoggoth = {
    id: 'probe-shoggoth', code: '08710', originalCode: '08710',
    name: '被遗忘的修格斯', traits: ['Monster', 'Shoggoth'], health: 5, damageTaken: 0,
    location: locB, engagedSeat: null, exhausted: false, defeated: false, attachments: [],
  }
  fstate.enemies = [elder, shoggoth]
  let error = null
  try {
    // 真实 relocation 入口 → 引擎的 enemyMoved 读点 → 08629 的 forcedOnEnemyEnter 声明。
    runtimeOf(fstate).moveEnemy(shoggoth, locA)
  } catch (caught) { error = caught }
  check('08629.1 修格斯进入地点后击败该地点的古老者（声明已接线）',
    !error && !fstate.enemies.some(item => item.id === 'probe-elder'),
    `remaining=${fstate.enemies.map(item => item.id).join(',')} err=${error?.message || ''}`)
}

// ---------------------------------------------------------------------------
section('证据汇总')
const failed = results.filter(item => !item.ok)
log(`\n${results.filter(item => item.ok).length}/${results.length} PASS; FAIL=${failed.map(item => item.id).join(',') || '(none)'}`)
const report = out.join('\n')
console.log(report)
// 证据落盘（UTF-8，避免 PowerShell 重定向/管道按 UTF-16/GBK 中转）。
if (process.env.CITY_PROBE_OUT) writeFileSync(process.env.CITY_PROBE_OUT, report, 'utf8')
if (failed.length) process.exitCode = 1
