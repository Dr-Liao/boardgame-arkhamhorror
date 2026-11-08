// P0-5 / P0-13 真实引擎路径探针（生产组合根 + eote-p8-fixture）。
//
// 运行：node docs/edgeOfTheEarth/eote-scan/campaign/b/_fix-realpath.mjs
// 口径：setup → legalMoves → applyMove → 真实调查/翻面/击败/幕推进/议程推进 → 结局记录；
//       混乱标记用真实 performTest 验证 delta 与参考实现一致。
// 修复前应失败（议程推进抛「密谋规则尚未迁移」/索引越界/19 地点 0 线索/无翻面行动/记录不写/
// 标记 delta 全 0），修复后全部 PASS。
const F = await import('../../../../../tests/eote-p8-fixture.mjs')

const failures = []
const results = []
function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`)
  if (!ok) failures.push(name)
}
const eq = (name, actual, expected) => check(name, Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected),
  `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`)

const world = await F.loadEoteWorld()

function settle(state) { F.settleChoices(world, state) }
function play(state, move, seat = 0) { F.playMove(world, state, move, seat); settle(state); return state }
function legal(state, seat = null) { return F.legalFor(world, state, seat) }
function findMove(state, predicate, seat = null) { return legal(state, seat).find(predicate) }

function newCampaign(seed) {
  const state = F.createHubGame(world, { seats: 2, humans: [0], seed })
  F.hubSetup(world, state, {})
  return state
}

/** 结束当前章节并用真实大厅流程推进，直到进入 Fatal Mirage（真实幕间门路径）。 */
function driveToMirage(seed, wantEntry = 1) {
  const state = newCampaign(seed)
  let entries = 0
  for (let guard = 0; guard < 30; guard++) {
    if (state.scenario?.id === 'fatalMirage') {
      entries += 1
      if (entries >= wantEntry) return { state, entries }
    }
    F.finishScenario(world, state, 'resolution1')
    settle(state)
    F.continueFromResult(world, state, { upgrades: false })
    settle(state)
    if (state.uiState === 'scenarioSetup') F.beginChapter(world, state)
    settle(state)
  }
  throw new Error('未能通过真实大厅流程进入 Fatal Mirage')
}

// ---------------------------------------------------------------------------
// A. 布置：版本化幕/议程、Mirage 地点线索/帷幕、Tekeli-li 牌库、遭遇牌库
// ---------------------------------------------------------------------------
{
  const { state } = driveToMirage('fm-probe-setup')
  console.log(`\n=== A. setup（第 ${state.campaign.records.eoteFatalMirageEntries} 次进入）===`)
  eq('A1 scenario = fatalMirage', state.scenario.id, 'fatalMirage')
  eq('A2 uiState = inScenario', state.uiState, 'inScenario')
  eq('A3 议程版本数据 08550 / 1a / 阈值 15', [state.agendas[0]?.originalCode, state.agendas[0]?.stage, state.agendas[0]?.doomThreshold], ['08550', '1a', 15])
  eq('A4 幕版本数据 08553 / 1a', [state.acts[0]?.originalCode, state.acts[0]?.stage], ['08553', '1a'])
  eq('A5 议程/幕索引从 0 开始', [state.agendaIndex, state.actIndex], [0, 0])
  const prison = state.locations.find(location => location.id === 'prisonOfMemories')
  eq('A6 记忆囚笼入场即揭示', prison?.revealed, true)
  eq('A7 记忆囚笼线索 3/人 × 2 人 = 6', prison?.clues, 6)
  eq('A8 记忆囚笼帷幕 = 当前密谋编号 1', world.contentRegistry.getBehavior('fatalMirage').locationShroudModifier(state, prison), 1)
  eq('A9 放一边地点 18 个', state.scenarioZones?.setAsideLocations?.length, 18)
  eq('A10 记忆敌人放一边 9 个', state.scenarioZones?.setAside?.length, 9)
  eq('A11 忒咳哩-哩牌库 16 张', state.scenarioFlags?.mechanics?.eote?.tekeli?.total, 16)
  const deck = state.encounterDeck || []
  check('A12 忒咳哩-哩 7 张弱点不进主遭遇牌库', !['08723', '08724', '08725', '08726', '08727', '08728', '08729'].some(code => deck.includes(code)), `deck=${deck.length}`)
  check('A13 收集 Chilling Cold（01167/01168 进牌库）', deck.includes('01167') && deck.includes('01168'), `deck=${deck.length}`)
  const investigateMove = findMove(state, move => move.action === 'investigate')
  check('A14 legalMoves 有调查行动且难度不再是 NaN', investigateMove && !/NaN/.test(investigateMove.label || ''), investigateMove?.label)
  const flips = legal(state).filter(move => String(move.rule || '').startsWith('mirageFlip:'))
  eq('A15 初始无线索时翻面行动不可执行（只留提示）', flips.length, 0)
  const behavior = world.contentRegistry.getBehavior('fatalMirage')
  const hinted = behavior.actions(state, state.investigators[state.currentSeat]).filter(move => move.reason)
  check('A16 翻面行动给出「线索不足」提示', hinted.some(move => /线索不足/.test(move.reason || '')), hinted.map(move => move.reason).join('|'))
  // A17：19 个幻景地点的印刷数据（帷幕/线索）齐全，Mirage 线索按公式 > 0。
  const locationFacts = Object.keys(world.contentRegistry.getScenario('fatalMirage').layout.locations).map(id => {
    const location = world.contentRegistry.getScenarioData('fatalMirage').locations[id]
    return { id, shroud: location.shroud, base: location.cluesPerInvestigator, clueTotal: behavior.mirageClueTotal(state, id), tier: location.mirage }
  })
  check('A17 19 个幻景地点帷幕/线索数据齐全（无 undefined/NaN）', locationFacts.length === 19
    && locationFacts.every(fact => Number.isFinite(fact.shroud) && Number.isFinite(fact.base) && fact.base > 0
      && Number.isFinite(fact.clueTotal) && fact.clueTotal > 0 && Number.isInteger(fact.tier)),
  JSON.stringify(locationFacts.filter(fact => !(Number.isFinite(fact.shroud) && fact.base > 0 && fact.clueTotal > 0))))
}

// ---------------------------------------------------------------------------
// B. 调查获得线索 → 花线索翻面（Mirage 核心循环，真实 legalMoves/performAction）
// ---------------------------------------------------------------------------
{
  const { state } = driveToMirage('fm-probe-flip')
  console.log('\n=== B. 调查 & 幻景翻面循环 ===')
  state.chaosBag = ['0'] // 固定 0 标记保证确定性
  play(state, { action: 'investigate' })
  eq('B1 真实调查行动获得 1 个线索', state.investigators[0].clues, 1)
  play(state, { action: 'investigate' })
  eq('B2 第二次调查后 2 个线索', state.investigators[0].clues, 2)
  const flipMove = findMove(state, move => String(move.rule || '') === 'mirageFlip:prisonOfMemories' && move.choice === 'baseCamp')
  check('B3 legalMoves 出现「花线索翻面」行动', Boolean(flipMove), flipMove?.label)
  play(state, F.plainMove(flipMove))
  const baseCamp = state.locations.find(location => location.id === 'baseCamp')
  check('B4 翻面揭示所选记忆地点（真实 performAction）', Boolean(baseCamp), JSON.stringify(state.locations.map(location => location.id)))
  eq('B5 揭示地点入场即揭示', baseCamp?.revealed, true)
  eq('B6 大本营线索 3/人 × 2 人 = 6（目标未入场，不扣减）', baseCamp?.clues, 6)
  eq('B7 翻面费用（2 线索）已由共同支付扣除', state.investigators[0].clues, 0)
  const behavior = world.contentRegistry.getBehavior('fatalMirage')
  eq('B8 baseCamp 不再是待翻面目标', behavior.pendingMirageTargets(state, 'prisonOfMemories').some(target => target.id === 'baseCamp'), false)
}

// ---------------------------------------------------------------------------
// C. 议程推进（v1 真实入口）：不再 throw，背面击败全员并写结局记录
// ---------------------------------------------------------------------------
{
  const { state } = driveToMirage('fm-probe-agenda')
  console.log('\n=== C. 议程推进（v1，真实 advanceAgenda 入口）===')
  play(state, { action: 'debug', kind: 'doom', amount: 15 })
  eq('C1 毁灭已达阈值', state.doom, 15)
  play(state, { action: 'debug', kind: 'advanceAgenda' }) // 内部走真实 advanceAgenda → runAgendaReveal
  eq('C2 议程推进后正常进入结算（不再抛「密谋规则尚未迁移」）', state.uiState, 'scenarioResult')
  const result = state.campaign.scenarioResults.at(-1)
  eq('C3 结局 = noResolution', result?.resolution, 'noResolution')
  eq('C4 记录 fatalMirageTimes = 1', state.campaign.records.fatalMirageTimes, 1)
  eq('C5 记录 fatalMirageResolution = noResolution', state.campaign.records.fatalMirageResolution, 'noResolution')
  check('C6 议程背面击败剩余调查员', state.investigators.every(inv => inv.defeated || inv.resigned), JSON.stringify(state.investigators.map(inv => ({ defeated: inv.defeated, resigned: inv.resigned }))))
}

// ---------------------------------------------------------------------------
// C2. 全灭 → noResolution：走真实神话阶段（endTurn 推进到第 2 轮神话）与原始 checkAgenda 读点
// ---------------------------------------------------------------------------
{
  console.log('\n=== C2. 议程全灭 → noResolution（真实神话阶段 + 原始 checkAgenda 读点）===')
  const { state } = driveToMirage('fm-probe-mythos')
  play(state, { action: 'debug', kind: 'doom', amount: 14 })
  // 真实回合流程：两个座位各结束回合 → 第 2 轮神话阶段 placeDoom/checkAgenda。
  for (let step = 0; step < 8 && state.status === 'playing' && state.uiState === 'inScenario'; step++) {
    const seat = F.decisionSeat(world, state)
    play(state, { action: 'endTurn' }, seat)
  }
  eq('C2.1 真实神话阶段议程推进后进入结算', state.uiState, 'scenarioResult')
  const mythosResult = state.campaign.scenarioResults.at(-1)
  eq('C2.2 结算结局 = noResolution', mythosResult?.resolution, 'noResolution')
  eq('C2.3 记录 fatalMirageTimes = 1', state.campaign.records.fatalMirageTimes, 1)
  eq('C2.4 记录 fatalMirageResolution = noResolution', state.campaign.records.fatalMirageResolution, 'noResolution')
  check('C2.5 全员被击败', state.investigators.every(inv => inv.defeated || inv.resigned), JSON.stringify(state.investigators.map(inv => ({ defeated: inv.defeated, resigned: inv.resigned }))))

  // 原始引擎读点：不经过 applyMove 的 dispatch 边界直接调用 checkAgenda（verifier 常用形态）。
  // 结局结算必须已由 behavior.agendaReveal 落盘（resolution/campaign.phase/records），
  // 只有 hub 的 uiState→scenarioResult 过渡属于 dispatch.settleScenarioBoundary（真实动作路径）。
  const { state: raw } = driveToMirage('fm-probe-mythos-raw')
  raw.doom = 15
  let rawError = null
  try { world.engine.checkAgenda(raw, []) } catch (error) { rawError = error }
  check('C2.6 原始 checkAgenda 以 ScenarioEnded 结束本关', rawError?.constructor?.name === 'ScenarioEnded', rawError ? `${rawError.constructor.name}: ${rawError.message}` : 'no throw')
  eq('C2.7 原始 checkAgenda 后 state.resolution = noResolution', raw.resolution, 'noResolution')
  eq('C2.8 原始 checkAgenda 后 campaign.phase = resolution', raw.campaign.phase, 'resolution')
  eq('C2.9 原始 checkAgenda 后记录已写 fatalMirageTimes = 1', raw.campaign.records.fatalMirageTimes, 1)
  check('C2.10 原始 checkAgenda 后 scenarioResults 已登记 noResolution', raw.campaign.scenarioResults.at(-1)?.resolution === 'noResolution', JSON.stringify(raw.campaign.scenarioResults.at(-1)?.resolution))
}

// ---------------------------------------------------------------------------
// D. 记忆剧情（敌人被击败）→ 直面恶魔 → 推进幕 → victory 结局记录
// ---------------------------------------------------------------------------
{
  const { state } = driveToMirage('fm-probe-victory')
  console.log('\n=== D. 记忆剧情 → 直面恶魔 → 推进幕 → victory ===')
  // 前置：让高田（08595 / 基础伙伴 08722）活着（战役流程可能已在前面检查点划掉伙伴）。
  const roster = state.campaign.eote?.partners?.roster || []
  const takada = roster.find(entry => entry.code === '08722')
  if (takada) takada.status = 'safe'
  const behavior = world.contentRegistry.getBehavior('fatalMirage')
  eq('D1 高田（08595）存活判定可读', behavior.isAlive(state, '08595'), true)
  // 前置（引擎原语）：把飞机场放入场（本来由沿海水域的剧情揭示；这里用真实 runtime 原语缩短路径）。
  world.resolution.resolveTransaction(state, 0, { action: 'probe-place-airfield' }, draft => {
    const runtime = world.engine.scenarioRuntime(draft, [])
    runtime.place('airfield')
    runtime.reveal('airfield')
  })
  settle(state)
  const airfield = state.locations.find(location => location.id === 'airfield')
  eq('D2 飞机场入场即揭示', airfield?.revealed, true)
  eq('D3 飞机场线索 2/人 × 2 人 = 4', airfield?.clues, 4)
  play(state, { action: 'debug', kind: 'moveTo', targetSeat: 0, locationId: 'airfield' })
  eq('D4 调查员到达飞机场', state.investigators[0].location, 'airfield')
  play(state, { action: 'debug', kind: 'clues', targetSeat: 0, amount: 4 })
  const flipMove = findMove(state, move => String(move.rule || '') === 'mirageFlip:airfield' && move.choice === '08577')
  check('D5 legalMoves 出现记忆地点翻面行动', Boolean(flipMove), flipMove?.label)
  play(state, F.plainMove(flipMove))
  const memoryEnemy = state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '08577')
  check('D6 伙伴活着 → 生成记忆敌人 08577', Boolean(memoryEnemy), JSON.stringify(state.enemies.map(enemy => enemy.code)))
  eq('D7 记忆敌人生命 = 印刷 4/人 × 2 人 = 8', memoryEnemy?.health, 8)
  eq('D8 伙伴尚未直面恶魔', Boolean(state.campaign.records.takadaHasConfrontedHerDemons), false)
  play(state, { action: 'debug', kind: 'defeat', enemyIds: [memoryEnemy.id] }) // 真实 defeatEnemy → behavior.enemyDefeated
  eq('D9 记录「高田直面内心恶魔」', state.campaign.records.takadaHasConfrontedHerDemons, true)
  check('D10 记录 partnersFacedInnerDemon', (state.campaign.records.partnersFacedInnerDemon || []).includes('08595'), JSON.stringify(state.campaign.records.partnersFacedInnerDemon))
  check('D11 记忆剧情卡 08577b 进胜利区（胜利 1）', (state.victoryDisplay || []).some(entry => String(entry.code) === '08577b'), JSON.stringify((state.victoryDisplay || []).map(entry => entry.code)))
  eq('D12 允许推进当前幕', state.scenarioFlags.fatalMirageMayAdvance, true)
  const advance = findMove(state, move => move.action === 'scenarioAction' && move.rule === 'fatalMirageAdvanceAct')
  check('D13 legalMoves 出现「推进当前幕」', Boolean(advance), advance?.label)
  play(state, F.plainMove(advance))
  eq('D14 幕背面 → 正常结局结算', state.uiState, 'scenarioResult')
  const result = state.campaign.scenarioResults.at(-1)
  eq('D15 结局 = victory', result?.resolution, 'victory')
  eq('D16 记录 fatalMirageCompleted = true', state.campaign.records.fatalMirageCompleted, true)
  eq('D17 记录 fatalMirageTimes = 1', state.campaign.records.fatalMirageTimes, 1)
  check('D18 记录 memoriesBanished 含记忆剧情卡', (state.campaign.records.memoriesBanished || []).includes('08577b'), JSON.stringify(state.campaign.records.memoriesBanished))
  check('D19 记录 memoriesDiscovered 含飞机场卡号 08566', (state.campaign.records.memoriesDiscovered || []).includes('08566'), JSON.stringify(state.campaign.records.memoriesDiscovered))
  check('D20 记录 resolutePartners 含 08595', (state.campaign.records.resolutePartners || []).includes('08595'), JSON.stringify(state.campaign.records.resolutePartners))
}

// ---------------------------------------------------------------------------
// E. 三次重入：v1/v2/v3 的幕/议程版本数据、阈值与推进（不再索引越界/静默 no-op）
// ---------------------------------------------------------------------------
{
  console.log('\n=== E. 三次重入版本 & 每个版本议程推进 ===')
  const state = newCampaign('fm-probe-versions')
  const expected = [
    { version: 1, agenda: '08550', act: '08553', stage: '1a', threshold: 15 },
    { version: 2, agenda: '08551', act: '08554', stage: '2a', threshold: 13 },
    { version: 3, agenda: '08552', act: '08555', stage: '3a', threshold: 11 },
  ]
  for (const entry of expected) {
    let guard = 0
    while (state.scenario?.id !== 'fatalMirage') {
      F.finishScenario(world, state, 'resolution1')
      settle(state)
      F.continueFromResult(world, state, { upgrades: false })
      settle(state)
      if (state.uiState === 'scenarioSetup') F.beginChapter(world, state)
      settle(state)
      if (++guard > 30) throw new Error('未能进入 Fatal Mirage')
    }
    const v = entry.version
    eq(`E${v}.1 第 ${v} 次进入的议程版本`, [state.agendas[0]?.originalCode, state.agendas[0]?.stage, state.agendas[0]?.doomThreshold], [entry.agenda, entry.stage, entry.threshold])
    eq(`E${v}.2 第 ${v} 次进入的幕版本`, [state.acts[0]?.originalCode, state.acts[0]?.stage], [entry.act, entry.stage])
    eq(`E${v}.3 议程索引不越界`, [state.agendaIndex, state.agendas.length], [0, 1])
    play(state, { action: 'debug', kind: 'advanceAgenda' })
    eq(`E${v}.4 第 ${v} 次议程推进正常结算`, state.uiState, 'scenarioResult')
    eq(`E${v}.5 fatalMirageTimes = ${v}`, state.campaign.records.fatalMirageTimes, v)
    F.continueFromResult(world, state, { upgrades: false })
    settle(state)
    if (state.uiState === 'scenarioSetup') F.beginChapter(world, state)
    settle(state)
  }
  check('E4 三次进入后仍可回到主线章节', state.scenario?.id !== 'fatalMirage', state.scenario?.id)
}

// ---------------------------------------------------------------------------
// F. P0-13：真实 performTest 的混乱标记 delta（对照参考实现）
// ---------------------------------------------------------------------------
{
  console.log('\n=== F. 08549 混乱标记真实 performTest ===')
  const scenarioData = world.contentRegistry.getScenarioData('fatalMirage')
  const beastScenario = world.contentRegistry.getScenarioData('theHeartOfMadnessPart2')

  function runTest(probe, scenario, token, { difficulty = 'standard', victoryDisplay = [], agendas = null } = {}) {
    probe.scenario = structuredClone(scenario)
    probe.scenarioFlags ||= {}
    probe.difficulty = difficulty
    probe.victoryDisplay = victoryDisplay.map(entry => ({ code: entry.code, victory: 1 }))
    if (agendas) probe.agendas = structuredClone(agendas)
    probe.chaosBag = [token]
    let captured = null
    // +10 技能值：避免负修正被 0 下限吞掉，从而精确读出标记 delta。
    const execute = draft => world.engine.performTest(draft, 0, 'willpower', 2, { skillBonus: 10, resolve: result => { captured = result } })
    world.resolution.resolveTransaction(probe, 0, { action: 'probe-token' }, execute)
    for (let guard = 0; probe.pendingChoice && guard < 40; guard++) {
      const choice = probe.pendingChoice
      const optionId = ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
        ?? choice.options[0].id
      world.resolution.resolveTransaction(probe, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
    }
    return captured.value - 10
  }

  function tokenValue(scenario, token, options = {}) {
    const probe = F.createHubGame(world, { seats: 2, humans: [0], seed: 'fm-token-probe' })
    probe.status = 'playing'
    probe.uiState = 'inScenario'
    probe.currentSeat = 0
    const base = runTest(probe, scenario, '0', {})
    const value = runTest(probe, scenario, token, options)
    return value - base
  }

  console.log('F0 基础值（+10 技能）已用同 seed 同调查员对齐')
  eq('F1 [cultist] delta -2', tokenValue(scenarioData, 'cultist'), -2)
  eq('F2 [tablet] delta -3', tokenValue(scenarioData, 'tablet'), -3)
  eq('F3 [elderthing] delta -4', tokenValue(scenarioData, 'elderthing'), -4)
  eq('F4 困难 [tablet] delta -4', tokenValue(scenarioData, 'tablet', { difficulty: 'hard' }), -4)
  eq('F5 困难 [elderthing] delta -5', tokenValue(scenarioData, 'elderthing', { difficulty: 'hard' }), -5)
  const story = [{ code: '08556b' }, { code: '08560b' }]
  eq('F6 [skull] -X（X=胜利区剧情卡数 2）', tokenValue(scenarioData, 'skull', { victoryDisplay: story }), -2)
  eq('F7 困难 [skull] -(X + 当前密谋编号)', tokenValue(scenarioData, 'skull', {
    difficulty: 'hard', victoryDisplay: [{ code: '08556b' }],
    agendas: [{ originalCode: '08551', stage: '2a', doomThreshold: 13 }],
  }), -3)
  // 对照实现：Heart of Madness Part2 的 [tablet] 修正 -3（参考卡片数值）。
  eq('F8 对照 Heart of Madness Part2 [tablet] -3', tokenValue(beastScenario, 'tablet'), -3)
}

// ---------------------------------------------------------------------------
// G. P0-13 标记失败追加效果（cultist/tablet/elderthing，真实 performTest → afterTest 读点）
// ---------------------------------------------------------------------------
{
  const { state } = driveToMirage('fm-probe-riders')
  console.log('\n=== G. 08549 标记失败追加效果（真实 performTest）===')
  // 固定失败：难度 20；调查员在记忆囚笼。
  function failTest(token) {
    state.chaosBag = [token]
    let captured = null
    const execute = draft => world.engine.performTest(draft, 0, 'willpower', 20, { resolve: result => { captured = result } })
    world.resolution.resolveTransaction(state, 0, { action: 'probe-rider' }, execute)
    for (let guard = 0; state.pendingChoice && guard < 40; guard++) {
      const choice = state.pendingChoice
      const optionId = ['done', 'skip', 'self', 'tekelili', 'prison'].find(id => choice.options.some(option => option.id === id))
        ?? choice.options[0].id
      world.resolution.resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
    }
    return captured
  }
  // [cultist]：失败的调查员把 1 个线索放到所在地点。
  const prison = state.locations.find(location => location.id === 'prisonOfMemories')
  const prisonCluesBefore = prison.clues
  play(state, { action: 'debug', kind: 'clues', targetSeat: 0, amount: 1 })
  const cultist = failTest('cultist')
  eq('G1 [cultist] 检定失败', cultist?.success, false)
  eq('G2 [cultist] 失败后个人线索 -1', state.investigators[0].clues, 0)
  const prisonAfter = state.locations.find(location => location.id === 'prisonOfMemories')
  eq('G3 [cultist] 线索放到所在地点', prisonAfter?.clues, prisonCluesBefore + 1)
  // [tablet]：失败 → 移动到记忆囚笼，或将忒咳哩-哩牌库顶 1 张洗入牌库（已在囚笼 → 只剩洗入）。
  const tekeliSizeBefore = state.scenarioFlags.mechanics.scenarioDecks?.tekeli?.deck?.length
  const tablet = failTest('tablet')
  eq('G4 [tablet] 检定失败', tablet?.success, false)
  eq('G5 [tablet] 忒咳哩-哩牌库顶 1 张洗入调查员牌库', state.scenarioFlags.mechanics.scenarioDecks.tekeli.deck.length, tekeliSizeBefore - 1)
  // [elder_thing]：失败 → 在场上一个[[幻灵]]敌人上放 1 个毁灭标记。
  play(state, { action: 'debug', kind: 'spawn', code: '08584', targetSeat: 0 }) // 08584 奇异的阴影：Eidolon
  const eidolon = state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '08584')
  check('G6 场上出现[[幻灵]]敌人', Boolean(eidolon), JSON.stringify(state.enemies.map(enemy => enemy.code)))
  const ether = failTest('elderthing')
  eq('G7 [elder_thing] 检定失败', ether?.success, false)
  const eidolonAfter = state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '08584')
  eq('G8 [elder_thing] 幻灵敌人上放置 1 个毁灭标记', eidolonAfter?.doom, 1)
}

// ---------------------------------------------------------------------------
console.log(`\n=== 汇总：${results.length - failures.length}/${results.length} PASS ===`)
if (failures.length) {
  console.log('FAILED:', failures.join(' | '))
  process.exitCode = 1
} else {
  console.log('ALL PASS（P0-5 议程/索引/线索/翻面/结算 + P0-13 标记数值：真实引擎路径可达）')
}
