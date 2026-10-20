// 战役台面（hub）与幕间：选关、幕间、经验结算、座位顺序（Phase 6 · 6d-29）。
//
// 这一组是「一关结束到下一关开始之间」的调度：
//   selectInitialHubScenario / hubLegalMoves —— 台面上可选的动作（选关、购买、结算）
//   chooseTurn / firstAliveSeat / leadDecisionSeat / nextSeat / expeditionLeaderSeat —— 座位与决策顺序
//   runInterlude / addLitaToCampaign / registerCampaignScenarios / endCampaign —— 幕间与战役收尾
// 与 campaign-flow.js 的分工：那边是「一关的结算」，这边是「关卡之间的台面」。

import { contentRegistry } from '../../content/registered.js'

// Phase 6（6d-29）：contentRegistry 是 `let`（registerContentBundle 会重新赋值），
// SCENARIOS 是从它派生的表（registerCampaignScenarios 会往里写）。它们必须走 import 的
// live binding，不能进依赖表——否则拿到的是首次调用时的快照，后注册的战役查不到。
// SCENARIOS 由 engine 注入：registerCampaignScenarios 会往里写，setup.js 要读到同一份。

export function createHub(deps) {
  const {
    SCENARIOS,
    ALL_CARDS,
    ALL_ENEMIES,
    ALL_INVESTIGATORS,
    ALL_STORY_ASSETS,
    ALL_TREACHERIES,
    HUB_DIFFICULTIES,
    LITA_CHANDLER_CODE,

    actingSeats,
    aliveInvestigators,
    applyCampaignEffect,
    availablePurchases,
    buildDeck,
    campaignCardChange,
    campaignEnding,
    campaignFor,
    campaignManifestFor,
    cardName,

    decisionSeat,
    hubInvestigatorChoices,
    hubStartingDeckReady,
    info,
    initialHubPreparation,
    initialHubScenarioMoves,
    makeInvestigator,
    progressCampaign,
    purchaseCard,
    randomValue,
    registerCampaignInvestigator,
    replacementCandidates,
    replacementOptions,
    requestChoice,
    resolutionCheckpoint,
    shuffle,
    upgradeRecord,
    walkCampaign,
  } = deps

function registerCampaignScenarios(campaignId) {
  for (const entry of contentRegistry.listScenarios(campaignId)) {
    const scenario = contentRegistry.getScenarioData(entry.id)
    SCENARIOS[entry.id] = scenario
    Object.assign(ALL_ENEMIES, scenario.enemies || {})
    Object.assign(ALL_TREACHERIES, scenario.treacheries || {})
    Object.assign(ALL_STORY_ASSETS, scenario.storyAssets || {})
  }
}

function addLitaToCampaign(state) {
  const campaign = state.campaign
  const lead = state.investigators[campaign.leadSeat]
  const candidates = campaign.investigators[lead.seat].status === 'active' ? [lead]
    : state.investigators.filter(inv => inv.resigned && campaign.investigators[inv.seat].status === 'active')
  if (!candidates.length) return
  const answer = requestChoice(state, { kind: 'storyCard', source: LITA_CHANDLER_CODE, seat: candidates[0].seat,
    prompt: '是否将丽塔·钱德勒加入战役牌组？不计入牌组张数。', canSkip: true,
    options: [{ id: 'skip', label: '不加入丽塔' }, ...candidates.map(inv => ({ id: String(inv.seat), label: `加入${inv.name}的牌组` }))] })
  if (answer !== 'skip') {
    const seat = Number(answer)
    campaignCardChange(campaign, seat, LITA_CHANDLER_CODE, 'add', state.scenario.id)
    campaign.records.litaOwner = campaign.investigators[seat].id
  }
}

function runInterlude(state, nextIndex, events) {
  const campaign = state.campaign
  campaign.phase = 'interlude'
  state.phase = 'interlude'
  const eliminated = state.investigators.filter(inv => campaign.investigators[inv.seat].status !== 'active')
  if (replacementCandidates(campaign).length < eliminated.length) {
    campaign.failed = true
    info(state, events, '已开放的调查员不足以替换所有死亡或疯狂的人物，战役无法继续。')
    endCampaign(state, events)
    return
  }
  for (const inv of eliminated) {
    const code = requestChoice(state, { kind: 'replacement', source: campaign.investigators[inv.seat].id,
      seat: inv.seat, prompt: '选择新的调查员，以全新 0 XP 牌组加入；不继承旧人物创伤与卡牌。',
      options: replacementCandidates(campaign).map(code => ({ id: code, label: cardName(code) })),
    })
    campaign.retired.push(structuredClone(campaign.investigators[inv.seat]))
    const replacement = makeInvestigator(ALL_INVESTIGATORS[code], inv.seat)
    const built = buildDeck(ALL_INVESTIGATORS[code], { seat: inv.seat, seed: Math.floor(randomValue(state) * 4294967296) })
    registerCampaignInvestigator(campaign, replacement, built.deck)
    state.investigators[inv.seat] = replacement
    info(state, events, `${replacement.name} 替换 ${inv.name} 加入战役。`)
  }
  campaign.interlude ||= { seatIndex: 0 }
  const inv = state.investigators[campaign.interlude.seatIndex]
  if (!inv) {
    delete campaign.interlude
    progressCampaign(state, events, true, true)
    return
  }
  const resume = () => resolutionCheckpoint(state, inv.seat, { action: 'interlude', nextIndex })
  const record = campaign.investigators[inv.seat]
  const cards = campaign.upgradesAllowed === false ? [] : availablePurchases(record, campaign.records)
  const answer = requestChoice(state, { kind: 'interlude', source: record.id, seat: inv.seat,
    prompt: `${inv.name}：未花费 ${record.xp} XP。可调整牌组，或保留经验进入下一关。候选卡按构筑限制、经验和替换后的完整牌组筛选。`,
    options: [{ id: 'done', label: '完成关间准备，保留剩余 XP' }, ...(cards.length ? [{ id: 'upgrade', label: '购买或替换一张卡牌' }] : [])],
  })
  if (answer === 'done') { campaign.interlude.seatIndex++; resume() }
  const added = requestChoice(state, { kind: 'upgradeCard', source: record.id, seat: inv.seat,
    prompt: '选择购入卡牌；0 级新卡至少支付 1 XP。', canSkip: true,
    options: [{ id: 'cancel', label: '返回关间准备' }, ...cards.map(code => ({ id: code, label: `${cardName(code)}（${ALL_CARDS[code].xp || 0} 级）` }))],
  })
  if (added === 'cancel') resume()
  const removed = requestChoice(state, { kind: 'upgradeRemove', source: { type: 'upgrade', cardCode: added, id: record.id }, seat: inv.seat,
    prompt: '选择被替换的普通玩家卡；签名、弱点与剧情卡不能以此方式移除。', canSkip: true,
    options: [{ id: 'cancel', label: '取消购买' }, ...replacementOptions(record, added, campaign.records).map(item => ({ id: item.code, label: `替换${cardName(item.code)}，支付 ${item.cost} XP` }))],
  })
  if (removed === 'cancel') resume()
  const purchase = purchaseCard(campaign, inv.seat, added, removed)
  info(state, events, `${inv.name} 完成一次牌组调整，支付 ${purchase.cost} XP。`)
  resume()
}

function endCampaign(state, events) {
  const CAMPAIGN = campaignFor(state)
  state.status = 'over'
  if (state.hubFlow) { state.uiState = 'campaignResult'; state.phase = 'campaignResult' }
  state.campaign.phase = 'finished'
  state.campaign.finished = true
  // 地底噬魔 noResolution → 失败；其余剧本推进到底 → 胜利。
  // 没有任何幸存者（时间线崩解、全灭）同样按失败收尾。
  const noSurvivors = !(state.investigators || []).some(inv => !inv.defeated && !inv.resigned)
  // 战役结局编号：按 manifest.endings 匹配剧本日志，映射到具体结局（结局 1–5）。
  const ending = campaignEnding(CAMPAIGN, state.campaign.records || {})
  if (ending) {
    state.campaign.ending = ending.id
    state.campaign.endingLabel = ending.label
    info(state, events, `📖 战役结局：${ending.label}。`)
  }
  if (state.campaign.failed || state.campaign.flowOutcome === 'defeat' || noSurvivors) {
    state.outcome = 'defeat'
    state.campaign.result = 'defeat'
    info(state, events, '调查失败，战役结束。')
  } else if (state.campaign.records.sacrificedLita || state.campaign.flowOutcome === 'survived') {
    state.outcome = 'survived'
    state.campaign.result = 'survived'
    state.winnerSeat = null
    info(state, events, state.campaign.records.sacrificedLita ? '调查队以牺牲丽塔为代价幸存；这不是胜利结局。' : '调查队幸存，战役结束。')
  } else {
    state.outcome = 'victory'
    state.campaign.result = 'victory'
    state.winnerSeat = 0
    info(state, events, `🏆 战役完成！《${CAMPAIGN.name}》结束。累计胜利点 ${state.campaign.victory}，经验 ${state.campaign.xp}。`)
  }
  state.legalMoves = []
}

function firstAliveSeat(state) {
  const a = aliveInvestigators(state)
  return a.length ? a[0].seat : null
}

function leadDecisionSeat(state) {
  const humans = state.humanSeats || [0]
  return humans.includes(state.campaign.leadSeat) ? state.campaign.leadSeat : humans[0] ?? null
}

function nextSeat(state, seat) {
  state.turnsTaken ||= []
  if (!state.turnsTaken.includes(seat)) state.turnsTaken.push(seat)
  return chooseTurn(state)
}

function chooseTurn(state) {
  const candidates = aliveInvestigators(state).filter(inv => !(state.turnsTaken || []).includes(inv.seat))
  if (!candidates.length) return null
  if (state.numInvestigators === 1) return candidates[0].seat
  const humanSeats = state.humanSeats || [0]
  const humans = candidates.filter(inv => humanSeats.includes(inv.seat))
  if (humans.length) {
    const leadSeat = state.campaign.leadSeat
    const aiOptions = humans.some(inv => inv.seat === leadSeat)
      ? candidates.filter(candidate => !humanSeats.includes(candidate.seat))
        .map(candidate => ({ id: String(candidate.seat), label: `让 ${candidate.name} 先行动`, responderSeat: leadSeat }))
      : []
    const shared = humans.length > 1 ? '尚未行动的玩家谁先点击「开始行动」谁先行动。' : '点击开始行动。'
    return Number(requestChoice(state, { kind: 'turnOrder', source: `round:${state.round}`, seat: humans[0].seat,
      seats: humans.map(inv => inv.seat),
      prompt: aiOptions.length ? shared + '队长也可以让一名尚未行动的 AI 队友先行动。' : shared,
      options: [...humans.map(inv => ({ id: String(inv.seat), label: '开始行动', responderSeat: inv.seat })), ...aiOptions] }))
  }
  if (state.aiTurnOrderRound !== state.round) {
    state.aiTurnOrderRound = state.round
    state.aiTurnOrder = shuffle(candidates.map(inv => inv.seat), () => randomValue(state))
  }
  return state.aiTurnOrder.find(seat => candidates.some(inv => inv.seat === seat)) ?? candidates[0].seat
}

function expeditionLeaderSeat(state) {
  const seat = state.expeditionLeaderSeat ?? state.campaign.expeditionLeader
  if (Number.isInteger(seat) && state.investigators?.[seat]) return seat
  return state.campaign.leadSeat ?? state.currentSeat ?? 0
}

function selectInitialHubScenario(state, scenarioId, events) {
  const choices = initialHubScenarioMoves(state)
  const selected = choices.find(choice => choice.scenarioId === scenarioId)
  if (!selected) return false
  const campaign = state.campaign
  const manifest = campaignManifestFor(state)
  delete campaign.flow
  const node = walkCampaign(campaign, manifest, () => selected.optionId,
    effect => { if (effect.type !== 'log') applyCampaignEffect(state, effect, text => info(state, events, text)) })
  if (node.type !== 'scenario' || node.scenarioId !== scenarioId) throw new Error('初始路线没有到达所选关卡')
  campaign.flowStage = node.type
  campaign.scenarioIndex = manifest.scenarioIds.indexOf(scenarioId)
  state.hubSelectedScenarioId = scenarioId
  return true
}

function hubLegalMoves(state, seat = decisionSeat(state)) {
  const CAMPAIGN = campaignFor(state)
  if (state.status !== 'playing' || !actingSeats(state).includes(seat)) return []
  const record = state.campaign.investigators[seat]
  const moves = []
  const humans = state.humanSeats || [0]
  const leaderMoves = humans.includes(seat) ? humans.map(leadSeat => ({ action: 'hubSetLeader', leadSeat,
    label: `队长：${state.investigators[leadSeat].name}` })) : []
  if (state.uiState === 'campaignHub') {
    if (seat !== 0) return []
    moves.push(...HUB_DIFFICULTIES.map(difficulty => ({ action: 'hubSetDifficulty', difficulty,
      label: `难度：${difficulty}` })))
    const opening = initialHubScenarioMoves(state)
    moves.push(...(opening.length ? opening.map(({ optionId, ...move }) => move)
      : [{ action: 'hubSelectScenario', scenarioId: CAMPAIGN.scenarioOrder[0], label: '选择第一关' }]))
    if (!opening.length || state.hubSelectedScenarioId) moves.push({ action: 'hubGoSetup', label: '配置调查员与卡组' })
    moves.push(...leaderMoves)
    return moves
  }
  if (state.uiState === 'scenarioResult') return seat === 0
    ? [{ action: 'hubContinue', label: '查看结算并进入关间准备' }] : []
  if (state.uiState === 'scenarioSetup' && state.hubReady) {
    return seat === 0 ? [
      ...leaderMoves,
      { action: 'hubSelectScenario', scenarioId: CAMPAIGN.scenarioOrder[state.campaign.scenarioIndex], label: '选择当前关卡' },
      ...(!state.campaign.scenarioResults.length
        ? [{ action: 'hubReopenSetup', label: '重新准备调查员与牌组' }] : []),
      ...(state.campaign.leadConfirmed && humans.includes(state.campaign.leadSeat) ? [{ action: 'hubBeginScenario', label: '开始当前关卡' }] : []),
    ] : []
  }
  if (state.uiState !== 'scenarioSetup' && state.uiState !== 'interlude') return []
  moves.push(...leaderMoves)
  if (!record || record.status !== 'active' || initialHubPreparation(state)) {
    moves.push(...hubInvestigatorChoices(state, seat).map(code => ({
      action: 'hubSelectInvestigator', code, label: `选择调查员：${ALL_INVESTIGATORS[code].nameZh || ALL_INVESTIGATORS[code].name}`,
    })))
    if (state.hubSeatSelected?.[seat] && (!record || !hubStartingDeckReady(record))) {
      moves.push({ action: 'hubAutoDeck', label: '自动构筑合法牌组' })
      moves.push({ action: 'hubSetDeck', label: '保存手动牌组' })
    }
  }
  if (state.uiState === 'interlude' && record?.status === 'active' && state.campaign.upgradesAllowed !== false) {
    const effective = upgradeRecord(record)
    for (const added of availablePurchases(effective, state.campaign.records)) {
      for (const option of replacementOptions(effective, added, state.campaign.records)) moves.push({ action: 'hubPurchase', added, removed: option.code,
        label: `购入 ${cardName(added)}，${option.code ? '替换 ' + cardName(option.code) : '加入永久卡'}（${option.cost} XP）`, explanation: option.explanation })
    }
    if (!state.hubUpgradedSeats?.[seat] && moves.some(move => move.action === 'hubPurchase')) {
      moves.push({ action: 'hubAutoUpgrade', label: '自动选择一次合法升级' })
    }
  }
  if (record?.upgradeDraft) {
    moves.push({ action: 'hubConfirmUpgrades', label: '保存升级方案' }, { action: 'hubCancelUpgrades', label: '撤销本轮升级' })
  }
  if (record?.status === 'active' && !record.upgradeDraft && hubStartingDeckReady(record)) {
    moves.push({ action: 'hubDoneSeat', label: state.uiState === 'interlude' ? '完成升级，准备下一关' : '确认准备' })
  }
  if (state.uiState === 'scenarioSetup' && !state.campaign.scenarioResults.length && !state.hubSeatDone?.[seat] && record?.status === 'active') {
    moves.push({ action: 'hubSetDeck', label: '调整起始牌组' })
  }
  return moves
}

  return { registerCampaignScenarios, addLitaToCampaign, runInterlude, endCampaign, firstAliveSeat, leadDecisionSeat, nextSeat, chooseTurn, expeditionLeaderSeat, selectInitialHubScenario, hubLegalMoves }
}
