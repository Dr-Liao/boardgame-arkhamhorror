// _fix-heart2.mjs · P0-7 真实引擎探针（Heart of Madness Part II）
//
// 口径：真实生产组合根（content/registered.js）+ 真实大厅准备状态（eote-p8-fixture）+
//      引擎自己的章节启动入口 `engine.startScenario(state, index, events)`（战役 flow 用的同一函数），
//      之后全部走真实引擎（legalMoves / applyMove / checkAgenda / checkAct / debug endScenario）。
// 运行：node docs/edgeOfTheEarth/eote-scan/campaign/d/_fix-heart2.mjs
//
// ── 修复前（真实引擎，2026-11-08 观测）──
//   · 08672 无名存在 doomThreshold = 0 → checkAgenda 在下一神话阶段立即以 doom(0)>=0 推进，
//     背面坡道清场执行：agendaIndex 1→2，locations 变为 gate+titanicRamp1..4+hiddenTunnel，status=over。
//   · 开局战役日志 drKenslerHasAPlan / theTruthOfTheMirageEludesYou 全仓无写入点（恒 false）→ R1/R2 永不可达。
//   · 08716 成功躲避路径引用未定义变量 `here` → ReferenceError（能力每次成功都崩）。
// 修复后本探针逐项 PASS。
import {
  loadEoteWorld, INVESTIGATOR_CODES, createHubGame, legalFor, decisionSeat, playMove, settleChoices,
  finishScenario,
} from '../../../../../tests/eote-p8-fixture.mjs'
import { damageTower, towerState } from '../../../../../src/engine/eote-facilities.js'

const world = await loadEoteWorld()
const results = []
function check(name, fn) {
  try {
    const detail = fn()
    results.push({ name, ok: true, detail })
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (error) {
    results.push({ name, ok: false, detail: error.message })
    console.log(`FAIL  ${name} — ${error.message}`)
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const CHAPTER = 'theHeartOfMadnessPart2'

// 真实大厅准备（不含开章）：选队长/选关/各座位选人+自动牌组+确认，停在 scenarioSetup。
function preparedHubState(seed) {
  const codes = INVESTIGATOR_CODES.slice(0, 2)
  const state = createHubGame(world, { seats: 2, seed, investigatorCodes: codes })
  settleChoices(world, state)
  const leader = legalFor(world, state, 0).find(move => move.action === 'hubSetLeader')
  if (leader) playMove(world, state, leader, 0)
  settleChoices(world, state)
  const select = legalFor(world, state, 0).find(move => move.action === 'hubSelectScenario')
  if (select) playMove(world, state, select, 0)
  settleChoices(world, state)
  playMove(world, state, { action: 'hubGoSetup' }, 0)
  settleChoices(world, state)
  for (let guard = 0; guard < 120 && !state.hubReady; guard += 1) {
    settleChoices(world, state)
    const seat = decisionSeat(world, state)
    const moves = legalFor(world, state, seat)
    const pick = moves.find(move => move.action === 'hubSelectInvestigator')
      || moves.find(move => move.action === 'hubAutoDeck')
      || moves.find(move => move.action === 'hubDoneSeat')
    if (!pick) break
    playMove(world, state, pick, seat)
  }
  settleChoices(world, state)
  return state
}

// 用引擎自己的章节启动入口进入目标章节（战役 flow 调用的同一函数）。
function openChapter(seed, { beforeStart = null } = {}) {
  const state = preparedHubState(seed)
  if (beforeStart) beforeStart(state)
  const order = world.contentRegistry.getCampaign('edgeOfTheEarth').scenarioIds
  const index = order.indexOf(CHAPTER)
  assert(index >= 0, '战役章节表缺少 theHeartOfMadnessPart2')
  world.engine.startScenario(state, index, [])
  settleChoices(world, state)
  return state
}

// 结束若干轮（真实 endTurn 驱动神话/敌人/重整阶段）；探针只为验证议程机制，
// 每步把伤害/恐惧归零避免调查员在测试中途阵亡掩盖议程结论。
function runRounds(state, rounds) {
  const startRound = state.round
  let guard = 0
  while (state.round < startRound + rounds && state.status === 'playing' && guard < 800) {
    guard += 1
    settleChoices(world, state)
    if (state.status !== 'playing') break
    for (const inv of state.investigators) { inv.damage = 0; inv.horror = 0 }
    const seat = decisionSeat(world, state)
    const moves = legalFor(world, state, seat)
    const endTurn = moves.find(move => move.action === 'endTurn')
    if (endTurn) { playMove(world, state, endTurn, seat); continue }
    if (!moves.length) break
    playMove(world, state, moves[0], seat)
  }
  settleChoices(world, state)
  return state
}

// ─────────────────────────────────────────────────────────────────────────
// 1) 08672 无印刷毁灭阈值（definition 修复）
// ─────────────────────────────────────────────────────────────────────────
check('P0-7.1 08672 doomThreshold=null 且 doom=99 时引擎 checkAgenda 不推进/不清场', () => {
  const state = openChapter('fix-h2-threshold')
  assert(state.agendaIndex === 0, `开局议程序号应为 0，实际 ${state.agendaIndex}`)
  assert(state.agendas[1]?.doomThreshold === null,
    `08672 的 doomThreshold 应为 null（无印刷毁灭阈值），实际 ${JSON.stringify(state.agendas[1]?.doomThreshold)}`)
  const before = state.locations.map(location => location.id).sort().join(',')
  state.agendaIndex = 1
  state.doom = 99
  world.engine.checkAgenda(state, [])
  assert(state.agendaIndex === 1, `checkAgenda 不应推进议程，实际 agendaIndex=${state.agendaIndex}`)
  assert(state.status === 'playing', `局面应仍在进行，实际 status=${state.status}`)
  const after = state.locations.map(location => location.id).sort().join(',')
  assert(after === before, '地点不应被坡道场景清场替换')
  assert(!after.includes('titanicRamp'), '不应出现泰坦坡道（坡道清场未执行）')
  return `agendaIndex 保持 1，地点 ${state.locations.length} 个`
})

// ─────────────────────────────────────────────────────────────────────────
// 2) 战役日志 R1/R2 门槛在正确时点写入
// ─────────────────────────────────────────────────────────────────────────
check('P0-7.2 开场写战役日志：肯斯勒不在场/未明真相 → theTruthOfTheMirageEludesYou=true', () => {
  const state = openChapter('fix-h2-record-r2')
  const records = state.campaign.records
  assert(records.theTruthOfTheMirageEludesYou === true,
    `初始大厅状态下应记录「幻景的真相仍未明了」，实际 ${JSON.stringify(records.theTruthOfTheMirageEludesYou)}`)
  assert(records.drKenslerHasAPlan === false,
    `不应记录「肯斯勒博士已有计划」，实际 ${JSON.stringify(records.drKenslerHasAPlan)}`)
  return 'theTruthOfTheMirageEludesYou=true / drKenslerHasAPlan=false'
})

check('P0-7.3 肯斯勒存活且已明真相时写 drKenslerHasAPlan=true（R1 分支）', () => {
  const state = openChapter('fix-h2-record-r1', {
    beforeStart(candidate) {
      candidate.campaign.eote ||= {}
      candidate.campaign.eote.partners = { roster: [
        { code: '08720', damage: 0, horror: 0, status: 'safe', resolute: '08593' },
      ] }
      candidate.campaign.records.drKenslerUnderstandsTheTrueNatureOfTheMiasma = true
    },
  })
  const records = state.campaign.records
  assert(records.drKenslerHasAPlan === true,
    `应记录「肯斯勒博士已有计划」，实际 ${JSON.stringify(records.drKenslerHasAPlan)}`)
  assert(records.theTruthOfTheMirageEludesYou === false,
    `R1 分支不应再写「真相未明」，实际 ${JSON.stringify(records.theTruthOfTheMirageEludesYou)}`)
  // 接引擎 resolution：debug endScenario 与正常结局走同一 applyResolutionEffects → behavior.resolution。
  const xpBefore = state.campaign.investigators?.[0]?.earnedXp ?? 0
  finishScenario(world, state, 'resolution1')
  const result = state.campaign.scenarioResults.at(-1)
  assert(result?.resolution === 'resolution1', `结局应为 resolution1，实际 ${JSON.stringify(result?.resolution)}`)
  const recordsAfter = state.campaign.records
  assert(recordsAfter.theNamelessMadnessIsContainedSafelyWithinItsHostForNow === true,
    `R1 结局记录未写入（contained=${JSON.stringify(recordsAfter.theNamelessMadnessIsContainedSafelyWithinItsHostForNow)}）`)
  const xpAfter = state.campaign.investigators?.[0]?.earnedXp ?? 0
  assert(xpAfter - xpBefore >= 10, `R1 应奖励 +10 经验，实际 +${xpAfter - xpBefore}`)
  return `resolution1 + 结局记录 + ${xpAfter - xpBefore} XP`
})

check('P0-7.4 真实回合推进不会让 08672 提前清场；R2 门槛可达并结算 resolution2', () => {
  const state = openChapter('fix-h2-rounds')
  runRounds(state, 6)
  assert(state.status === 'playing', `6 轮后局面应仍在进行，实际 status=${state.status}`)
  assert(state.agendaIndex <= 1, `议程不应推进到 08672 之后，实际 agendaIndex=${state.agendaIndex}`)
  const facilitySlots = state.scenario.facilitySlots || []
  assert(facilitySlots.every(slot => state.locations.some(location => location.id === slot)),
    '15 个设施/高塔槽位应仍在场（幕 3 未失去全部高塔）')
  assert(!state.locations.some(location => location.id === 'titanicRamp1'), '坡道场景不应被提前触发')
  // 走到 08681「最终幻景」：全部高塔坍塌 + 调查员在隐藏隧道 → checkObjectives 按记录分流 R2。
  const pylonSlots = facilitySlots.filter(slot =>
    ['08674', '08675', '08676', '08677', '08678'].includes(
      state.locations.find(location => location.id === slot)?.originalCode))
  for (const slot of pylonSlots) damageTower(state, { towerId: slot, amount: 99 })
  state.locations.push({ ...state.scenario.locations.hiddenTunnel, revealed: true, clues: 0 })
  state.actIndex = 1
  for (const inv of state.investigators) inv.location = 'hiddenTunnel'
  let ended = null
  try {
    world.engine.checkAct(state, [])
  } catch (error) { ended = error }
  assert(state.campaign.records.theTruthOfTheMirageEludesYou === true, 'R2 门槛记录应仍为 true')
  const lastResult = state.campaign.scenarioResults.at(-1)
  assert(lastResult?.resolution === 'resolution2',
    `R2 应经引擎 checkAct → behavior.checkObjectives 结算 resolution2，实际 ${JSON.stringify(lastResult?.resolution)}${ended ? ` (${ended.message})` : ''}`)
  assert(state.campaign.records.theFacilityWasDestroyed === true, 'R2 结局记录「设施被摧毁」未写入')
  return `6 轮后议程停在 ${state.agendaIndex}；R2 经 checkAct 结算并写入记录`
})

// ─────────────────────────────────────────────────────────────────────────
// 3) 08716 成功躲避：真实引擎能力路径（legalMoves → applyMove），无 ReferenceError
// ─────────────────────────────────────────────────────────────────────────
check('P0-7.5 08716 成功躲避经引擎能力路径结算并移动到连接地点（不再 ReferenceError）', () => {
  const state = openChapter('fix-h2-08716')
  const inv = state.investigators[0]
  const here = state.locations.find(location => location.id === inv.location)
  const target = state.locations.find(location => location.id === 'facility7')
  assert(here && target, '需要两个设施地点')
  if (!here.connections.includes(target.id)) here.connections.push(target.id)
  if (!target.connections.includes(here.id)) target.connections.push(here.id)
  state.enemies.push({
    id: 'evade-target', code: '99999', name: '测试敌人', location: here.id,
    fight: 0, evade: 0, health: 3, damage: 0, horror: 0, exhausted: false, engagedSeat: null,
  })
  inv.assets.push({
    id: 'asset-08716', code: '08716', originalCode: '08716', uses: 3, usesType: 'secrets', exhausted: false,
  })
  state.chaosBag = ['0']
  inv.actionsLeft = 5
  settleChoices(world, state)
  const seat = decisionSeat(world, state)
  const command = { action: 'ability', assetId: 'asset-08716', abilityIndex: 0 }
  const validation = world.engine.validateMove(state, seat, command)
  assert(validation === null, `08716 能力应为合法动作，实际拒绝原因：${validation}`)
  world.engine.applyMove(state, seat, command)   // 成功躲避 → 若 `here` 未定义这里必抛 ReferenceError
  settleChoices(world, state, choice =>
    choice.options.some(option => option.id === target.id) ? target.id : null)
  // 事务提交后调查员/支援实例会被替换，断言必须读提交后的权威状态。
  const current = state.investigators[0]
  const asset = (current.assets || []).find(item => item.id === 'asset-08716')
  assert(state.enemies[0].exhausted === true, '躲避成功后敌人应横置')
  assert(asset?.uses === 2, `应花费 1 秘密（3→2），实际 ${asset?.uses}`)
  assert(current.location === target.id, `应移动到连接地点 ${target.id}，实际 ${current.location}`)
  return `uses 3→${asset.uses}，敌人横置，移动 ${here.id}→${current.location}`
})

// ─────────────────────────────────────────────────────────────────────────
const failed = results.filter(item => !item.ok)
console.log(`\n结果：${results.length - failed.length}/${results.length} PASS`)
if (failed.length) {
  console.log('失败项：', failed.map(item => item.name).join(' | '))
  process.exitCode = 1
}
