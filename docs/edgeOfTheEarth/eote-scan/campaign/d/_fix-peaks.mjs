// _fix-peaks.mjs · P0-8（Peaks 部分）真实引擎探针 · To the Forbidden Peaks
//
// 口径：真实生产组合根（content/registered.js）+ 真实大厅准备状态（eote-p8-fixture）+
//      引擎自己的章节启动入口 `engine.startScenario(state, index, events)`；之后全部走真实引擎
//      （legalMoves / applyMove / drawEncounter / enemyFightValue / enemyHealth / discoverClueAt）。
// 运行：node docs/edgeOfTheEarth/eote-scan/campaign/d/_fix-peaks.mjs
//
// ── 修复前（真实引擎，2026-11-08 观测）──
//   · 遭遇牌库只有本章 14 张，Deadly Weather / Elder Things / Hazards of Antarctica /
//     Nameless Horrors 四个共享组 0 张（requiredEncounterGroupIds 只是注册校验，引擎只读 scenario.encounterDeck）。
//   · definition 自建 treacheryDefinition 缺 entryRevelation → 4 张专属诡计真实遭遇零结算；
//     且没有 effect.campaignRule 接线，behavior.resolveEncounter 永远不被调用。
//   · 08597/08598「移动后归还线索」写在引擎无调用点的 behavior.afterMove；
//     08600–08606 的「从下方进入」只认测试用的 climb 原语标记，真实移动不触发。
//   · 08607 cluesOnlyByInvestigation 误嵌 flags（引擎读 locationRule.cluesOnlyByInvestigation）。
//   · 08608/08609 X=-2 占位直接相加：Level 1–2 时战斗值/生命值算成 -1/0。
//   · 08614–08620 七件 Expedition 支援只放一边、从不入场，能力全缺。
// 修复后本探针逐项 PASS。
import {
  loadEoteWorld, INVESTIGATOR_CODES, createHubGame, legalFor, decisionSeat, playMove, settleChoices,
  transact,
} from '../../../../../tests/eote-p8-fixture.mjs'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { tekeliDeckSize } from '../../../../../src/engine/eote-tekeli.js'

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

const CHAPTER = 'toTheForbiddenPeaks'
const RECOVERED = ['08614', '08616', '08618', '08620']

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

function openChapter(seed, { recovered = RECOVERED } = {}) {
  const state = preparedHubState(seed)
  state.campaign.records.suppliesRecovered = [...recovered]
  const order = world.contentRegistry.getCampaign('edgeOfTheEarth').scenarioIds
  const index = order.indexOf(CHAPTER)
  assert(index >= 0, '战役章节表缺少 toTheForbiddenPeaks')
  world.engine.startScenario(state, index, [])
  settleChoices(world, state)
  return state
}

const codeOf = location => location?.originalCode || location?.code
const locationById = (state, id) => state.locations.find(location => location.id === id)

// 用真实引擎动作「控制本地点一件 Expedition 支援」取得指定卡（legalMoves → applyMove）。
function takeExpeditionAsset(seatState, seat, code) {
  const asset = (seatState.storyAssets || []).find(item => (item.code || item.originalCode) === code)
  assert(asset, `所在地点没有可控制的支援 ${code}（storyAssets=${(seatState.storyAssets || []).map(item => item.code).join(',')}）`)
  const move = legalFor(world, seatState, seat)
    .find(item => item.action === 'scenarioAction' && item.rule === 'takeExpeditionAsset'
      && String(item.assetId) === String(asset.id))
  assert(move, `legalMoves 缺少控制 ${code} 的剧本行动`)
  playMove(world, seatState, move, seat)
  settleChoices(world, seatState)
  const controlled = (seatState.investigators[seat].assets || [])
    .find(item => (item.code || item.originalCode) === code)
  assert(controlled, `控制行动后 ${code} 应进入调查员资产区`)
  return controlled
}

// ─────────────────────────────────────────────────────────────────────────
// 1) 遭遇牌库按 gather 组补全 + 诡计定义补齐显现读点
// ─────────────────────────────────────────────────────────────────────────
check('P0-8.1 遭遇牌库含 4 个共享组（14→37 张），星之恐怖/Tekeli-li 不进普通牌库', () => {
  const state = openChapter('fix-peaks-deck')
  const codes = new Set(state.encounterDeck)
  const shared = ['08692', '08693', '08694', '08695', '08696', '08697', '08698', '08699', '08703', '08704', '08705']
  for (const code of shared) assert(codes.has(code), `遭遇牌库缺少共享组卡 ${code}`)
  assert(!codes.has('08608'), '星之恐怖（放一边剧情敌人）不应进普通遭遇牌库')
  assert(!codes.has('08723'), 'Tekeli-li 弱点不应进普通遭遇牌库')
  const total = state.encounterDeck.length
  assert(total === 37, `按印刷份数展开应为 37 张，实际 ${total}`)
  return `牌库 ${total} 张，含 deadlyWeather/elderThings/hazards/namelessHorrors 共享卡`
})

check('P0-8.2 4 张专属诡计带 entryRevelation + campaignRule 接线（引擎真实结算通道）', () => {
  const state = openChapter('fix-peaks-defs')
  for (const code of ['08610', '08611', '08612', '08613']) {
    const definition = state.scenario.treacheries[code]
    assert(definition, `缺少诡计定义 ${code}`)
    assert(definition.entryRevelation === true, `${code} 缺少 entryRevelation（真实遭遇不会结算）`)
    assert(definition.effect?.kind === 'campaignRule', `${code} 缺少 effect.campaignRule（behavior.resolveEncounter 不会被调用）`)
  }
  // 共享组诡计也必须有显现读点（由 campaign card-data 的 encounterDefinitions 统一生成）。
  for (const code of ['08692', '08693', '08694', '08697', '08703', '08704', '08705']) {
    assert(state.scenario.treacheries[code]?.entryRevelation === true, `共享诡计 ${code} 缺少 entryRevelation`)
  }
  return '4 张专属诡计 + 7 张共享诡计均有 entryRevelation；专属另有 campaignRule'
})

check('P0-8.3 真实遭遇：08610 降雪结算 2 线索；08692 南极寒风真实附属到地点', () => {
  const state = openChapter('fix-peaks-encounter')
  const inv = state.investigators[0]
  const here = locationById(state, inv.location)
  const before = here.clues || 0
  state.encounterDeck.push('08610')            // 牌库顶（栈顶在数组末尾）
  world.engine.drawEncounter(state, inv, [])
  settleChoices(world, state)
  const after = locationById(state, inv.location).clues
  assert(after === before + 2, `08610 降雪应在所在地点放 2 线索（${before}→${after}）`)
  state.encounterDeck.push('08692')
  world.engine.drawEncounter(state, state.investigators[0], [])
  settleChoices(world, state)
  const attached = state.locations.some(location => (location.attachments || [])
    .some(attachment => (attachment.code || attachment.originalCode) === '08692'))
  assert(attached, '08692 南极寒风应附属到最近地点（共享组卡真实结算）')
  return `降雪 ${before}→${after} 线索；南极寒风附属成功`
})

// ─────────────────────────────────────────────────────────────────────────
// 2) 08597/08598 移动归还线索 + 08600–08606 从下方进入强制 真实触发
// ─────────────────────────────────────────────────────────────────────────
check('P0-8.4 真实移动：08597 强制归还线索 + 08602「从下方进入」1 伤害', () => {
  const state = openChapter('fix-peaks-climb')
  settleChoices(world, state)
  const inv = state.investigators[0]
  const start = locationById(state, inv.location)
  assert(codeOf(start) === '08600', `应从 Level 0 地点开始，实际 ${codeOf(start)}`)
  start.clues = 0                          // 背面：下方地点无线索才能进入
  inv.clues = 2                            // 08597 强制：移动后归还全部线索
  inv.actionsLeft = 5
  state.chaosBag = ['0']
  const seat = decisionSeat(world, state)
  const move = legalFor(world, state, seat).find(item => item.action === 'move' && item.locationId === 'steepIncline')
  assert(move, `合法动作缺少移动到 steepIncline：${legalFor(world, state, seat).map(item => item.action).join(',')}`)
  playMove(world, state, move, seat)
  settleChoices(world, state)
  const current = state.investigators[0]
  assert(current.location === 'steepIncline', `应移动到 steepIncline，实际 ${current.location}`)
  assert(current.damage === 1, `08602 从下方进入应受 1 点伤害，实际 ${current.damage}`)
  assert(current.clues === 0, `08597 强制应在移动后归还全部线索，实际 ${current.clues}`)
  assert(!state.scenarioFlags.pendingMove, '「从下方进入」的临时移动记录应已消费')
  return `移动到位、1 伤害、线索 ${2}→0`
})

check('P0-8.5 真实移动第二层：08603「从下方进入」1 恐惧', () => {
  const state = openChapter('fix-peaks-climb2')
  settleChoices(world, state)
  const inv = state.investigators[0]
  locationById(state, inv.location).clues = 0
  inv.actionsLeft = 5
  state.chaosBag = ['0']
  const seat = decisionSeat(world, state)
  const first = legalFor(world, state, seat).find(item => item.action === 'move' && item.locationId === 'steepIncline')
  playMove(world, state, first, seat)
  settleChoices(world, state)
  locationById(state, 'steepIncline').clues = 0
  const second = legalFor(world, state, seat).find(item => item.action === 'move' && item.locationId === 'narrowRidge')
  assert(second, '清空下方线索后应能移动到 narrowRidge')
  const beforeHorror = state.investigators[0].horror
  playMove(world, state, second, seat)
  settleChoices(world, state)
  const current = state.investigators[0]
  assert(current.location === 'narrowRidge', `应到达 narrowRidge，实际 ${current.location}`)
  assert(current.horror === beforeHorror + 1, `08603 从下方进入应受 1 点恐惧，实际 +${current.horror - beforeHorror}`)
  return `位于 ${current.location}，恐惧 +1`
})

// ─────────────────────────────────────────────────────────────────────────
// 3) 08607 cluesOnlyByInvestigation / 08608・08609 X 数值
// ─────────────────────────────────────────────────────────────────────────
check('P0-8.6 08607：山顶线索只能通过调查发现（引擎 discoverClueAt 读点）', () => {
  const state = openChapter('fix-peaks-summit')
  const inv = state.investigators[0]
  inv.location = 'summit'
  const summit = locationById(state, 'summit')
  summit.clues = 2
  const entry = registeredEntry('08607')
  assert(entry?.locationRule?.cluesOnlyByInvestigation === true,
    '08607 的 cluesOnlyByInvestigation 必须在 locationRule 顶层（引擎读点）')
  assert(entry.locationRule.flags?.cluesOnlyByInvestigation == null, '不应再嵌在 flags 下（无读点）')
  const blocked = world.engine.discoverClueAt(state, inv, 1, [], {})
  assert(blocked === false, `非调查发现应被阻止，实际返回 ${JSON.stringify(blocked)}`)
  const allowed = world.engine.discoverClueAt(state, state.investigators[0], 1, [], { investigation: true })
  assert(allowed === 1 || allowed === true, `调查发现应成功，实际返回 ${JSON.stringify(allowed)}`)
  const summitAfter = locationById(state, 'summit')
  assert(summitAfter.clues === 1, `山顶线索应 2→1，实际 ${summitAfter.clues}`)
  return '非调查发现=false；调查发现后山顶线索 2→1'
})

check('P0-8.7 08608/08609 X=-2 占位不再相加错误（Level 2：战斗 X=2、生命 X 正常）', () => {
  const state = openChapter('fix-peaks-x')
  const inv = state.investigators[0]
  inv.location = 'narrowRidge'
  const terror = {
    id: 'x-08608', code: '08608', originalCode: '08608', fight: -2, evade: -2, health: 3,
    damage: 0, horror: 0, exhausted: false, location: 'narrowRidge',
    traits: ['Monster', 'Eidolon', 'Elite'],
  }
  assert(world.engine.enemyFightValue(state, terror, inv) === 2,
    `08608 在 Level 2 的战斗值应为 2，实际 ${world.engine.enemyFightValue(state, terror, inv)}`)
  assert(world.engine.enemyEvadeValue(state, terror, inv) === 2,
    `08608 在 Level 2 的躲避值应为 2，实际 ${world.engine.enemyEvadeValue(state, terror, inv)}`)
  assert(world.engine.enemyHealth(state, terror) === 9,
    `08608 生命应为 3+3×2=9，实际 ${world.engine.enemyHealth(state, terror)}`)
  const elder = {
    id: 'x-08609', code: '08609', originalCode: '08609', fight: 3, evade: 2, health: -2,
    damage: 0, horror: 0, exhausted: false, location: 'rockyLedge', traits: ['Monster', 'Elder Thing'],
  }
  assert(world.engine.enemyHealth(state, elder) === 3,
    `08609 在 Level 3 的生命 X 应为 3，实际 ${world.engine.enemyHealth(state, elder)}`)
  assert(world.engine.enemyFightValue(state, elder, inv) === 3,
    `08609 战斗值应为印刷 3（X 只作用于生命），实际 ${world.engine.enemyFightValue(state, elder, inv)}`)
  return '08608 fight/evade=2、health=9；08609 health=3、fight=3'
})

check('P0-8.8 08609 blocksAscendWhileEngaged：交战时不能移动到上方地点', () => {
  const state = openChapter('fix-peaks-elder-block')
  const inv = state.investigators[0]
  inv.location = 'narrowRidge'
  const elder = {
    id: 'blocking-elder', code: '08609', originalCode: '08609', fight: 3, evade: 2, health: -2,
    damage: 0, horror: 0, exhausted: false, location: 'narrowRidge', engagedSeat: inv.seat,
    traits: ['Monster', 'Elder Thing'],
  }
  state.enemies.push(elder)
  const behavior = world.contentRegistry.getBehavior(CHAPTER)
  const blocked = behavior.moveError(state, state.investigators[0], 'rockyLedge')
  assert(typeof blocked === 'string' && blocked.includes('拘束型'), `交战时上行应被阻止，实际 ${JSON.stringify(blocked)}`)
  state.enemies = []
  const allowed = behavior.moveError(state, state.investigators[0], 'rockyLedge')
  assert(allowed === null, `无交战时上行应允许，实际 ${JSON.stringify(allowed)}`)
  return '交战时返回阻止原因；移除敌人后放行'
})

// ─────────────────────────────────────────────────────────────────────────
// 4) 08614–08620 Expedition 支援：真实入场（Supplies Recovered）与能力可触发
// ─────────────────────────────────────────────────────────────────────────
check('P0-8.9 Expedition 支援按「Supplies Recovered」真实入场；未回收的留在放一边区', () => {
  const state = openChapter('fix-peaks-supplies')
  const inPlay = (state.storyAssets || []).map(asset => asset.code)
  for (const code of RECOVERED) assert(inPlay.includes(code), `已回收支援 ${code} 应在场（storyAssets）`)
  assert(!inPlay.includes('08615') && !inPlay.includes('08617') && !inPlay.includes('08619'),
    '未回收的支援不应入场')
  for (const code of ['08615', '08617', '08619']) {
    assert((state.scenarioZones.setAside || []).includes(code), `未回收支援 ${code} 应在放一边区`)
  }
  return `已回收入场：${RECOVERED.join(',')}；其余放一边`
})

check('P0-8.10 幕 08599「控制一个 Expedition 支援」真实行动 + 08616 炸药能力可触发', () => {
  const state = openChapter('fix-peaks-take')
  settleChoices(world, state)
  const seat = decisionSeat(world, state)
  const dynamite = takeExpeditionAsset(state, seat, '08616')
  // 08616 能力：花费 1 补给并横置 → 对所在地点每个敌人与调查员各 3 点伤害。
  const damageBefore = state.investigators.map(item => item.damage || 0)
  const abilityMove = legalFor(world, state, seat)
    .find(move => move.action === 'ability' && move.assetId === dynamite.id && move.abilityIndex === 0)
  assert(abilityMove, `08616 能力应出现在合法动作里：${legalFor(world, state, seat).map(move => `${move.action}:${move.rule || move.assetId || ''}`).join(' | ')}`)
  playMove(world, state, abilityMove, seat)
  settleChoices(world, state)
  const after = state.investigators.map(item => ({ damage: item.damage || 0 }))
  const hit = after.filter((item, index) => item.damage === damageBefore[index] + 3).length
  assert(hit >= 1, `08616 爆炸应让所在地点调查员各受 3 点伤害，实际 ${JSON.stringify({ damageBefore, after })}`)
  return `控制 08616 并触发炸药：${hit} 名调查员受到 3 点伤害`
})

check('P0-8.11 08618 矿物标本能力可触发（基础值 5 调查 + 额外线索）', () => {
  const state = openChapter('fix-peaks-specimen', { recovered: ['08618'] })
  settleChoices(world, state)
  const seat = decisionSeat(world, state)
  const specimen = takeExpeditionAsset(state, seat, '08618')
  const inv = state.investigators[0]
  const here = locationById(state, inv.location)
  here.clues = 5
  state.chaosBag = ['0']
  const cluesBefore = inv.clues || 0
  const abilityMove = legalFor(world, state, seat)
    .find(move => move.action === 'ability' && move.assetId === specimen.id && move.abilityIndex === 0)
  assert(abilityMove, '08618 能力应出现在合法动作里')
  playMove(world, state, abilityMove, seat)
  settleChoices(world, state)
  const current = state.investigators[0]
  assert((current.clues || 0) >= cluesBefore + 1,
    `08618 调查成功应额外发现 1 线索，实际 ${cluesBefore}→${current.clues}`)
  const instance = (current.assets || []).find(item => (item.code || item.originalCode) === '08618')
  return `线索 ${cluesBefore}→${current.clues}，uses=${instance?.uses}`
})

check('P0-8.12 七件支援条目都有可触发能力描述子（08614–08620 零能力已消除）', () => {
  const codes = ['08614', '08615', '08616', '08617', '08618', '08619', '08620']
  const kinds = []
  for (const code of codes) {
    const entry = registeredEntry(code)
    assert(entry, `${code} 未注册`)
    assert(entry.implemented === true, `${code} 未标记 implemented`)
    assert((entry.abilities || []).length > 0, `${code} 仍然没有任何能力描述子`)
    const ability = entry.abilities[0]
    assert(['action', 'free', 'reaction', 'forced', 'constant'].includes(ability.kind), `${code} 能力 kind 非法`)
    if (['action', 'free'].includes(ability.kind)) {
      assert(typeof ability.actionKind === 'string', `${code} 非玩家 action/free 必须带 actionKind`)
    }
    kinds.push(`${code}:${ability.kind}`)
  }
  return kinds.join(' ')
})

// ─────────────────────────────────────────────────────────────────────────
// 5) verifier 复核项：TREACHERY_HANDLERS 的 api.test 四参对象写法 + Tekeli-li 牌库
// ─────────────────────────────────────────────────────────────────────────
check('P0-8.13 真实 drawEncounter 抽到 08612/08613 不再抛「options.resolve is not a function」', () => {
  const state = openChapter('fix-peaks-test-signature')
  const inv = state.investigators[0]
  inv.agility = 0
  inv.willpower = 0
  state.chaosBag = ['0']
  const here = locationById(state, inv.location)
  here.clues = 0
  const damageBefore = inv.damage || 0
  state.encounterDeck.push('08612')          // 悬于边缘：敏捷(3) 失败 → 2 伤害
  // 遭遇抽取会开检定/选择窗口：用 fixture 的 transact 在真实规则事务里结算（必须用 draft）。
  transact(world, state, draft => world.engine.drawEncounter(draft, draft.investigators[0], []))
  const damageAfter = state.investigators[0].damage
  assert(damageAfter === damageBefore + 2,
    `08612 失败应受到 2 点伤害，实际 ${damageBefore}→${damageAfter}`)
  // 低温症：意志(3) 失败 → 默认选择加入 1 个 [frost]。
  state.encounterDeck.push('08613')
  transact(world, state, draft => world.engine.drawEncounter(draft, draft.investigators[0], []))
  assert(state.chaosBag.includes('frost'), '08613 失败后混乱袋应加入 [frost]（真实结算完成，未抛错）')
  return '08612 造成 2 伤害；08613 加入 frost'
})

check('P0-8.14 Tekeli-li 独立牌库按 gather 建立（16 张），08604 从下方进入真实洗入', () => {
  const state = openChapter('fix-peaks-tekeli')
  assert(tekeliDeckSize(state) === 16, `忒咳哩-哩牌库应为 16 张，实际 ${tekeliDeckSize(state)}`)
  settleChoices(world, state)
  const inv = state.investigators[0]
  inv.actionsLeft = 10
  state.chaosBag = ['0']
  const seat = decisionSeat(world, state)
  // 真实移动逐层爬到 Rocky Ledge（08604，L3），沿途清空下方线索（背面进入限制）。
  const route = ['steepIncline', 'narrowRidge', 'rockyLedge']
  let previous = inv.location
  for (const target of route) {
    locationById(state, previous).clues = 0
    settleChoices(world, state)
    const move = legalFor(world, state, seat)
      .find(item => item.action === 'move' && item.locationId === target)
    assert(move, `合法动作缺少移动到 ${target}（当前 ${previous}）`)
    playMove(world, state, move, seat)
    settleChoices(world, state)
    previous = state.investigators[0].location
    assert(previous === target, `应到达 ${target}，实际 ${previous}`)
  }
  assert(tekeliDeckSize(state) === 15,
    `进入 08604 后应从忒咳哩-哩牌库顶洗入 1 张（16→15），实际 ${tekeliDeckSize(state)}`)
  const deck = state.investigators[0].deck || []
  assert(deck.some(code => ['08723', '08724', '08725', '08726', '08727', '08728', '08729'].includes(code)),
    '调查员牌库应含 1 张忒咳哩-哩（08604 的强制效果真实执行）')
  return `牌库 16→${tekeliDeckSize(state)}，已洗入 1 张忒咳哩-哩`
})

// ─────────────────────────────────────────────────────────────────────────
const failed = results.filter(item => !item.ok)
console.log(`\n结果：${results.length - failed.length}/${results.length} PASS`)
if (failed.length) {
  console.log('失败项：', failed.map(item => item.name).join(' | '))
  process.exitCode = 1
}
