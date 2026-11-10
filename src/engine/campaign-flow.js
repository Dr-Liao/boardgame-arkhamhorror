// 战役流程（关间推进 / 重开 / 结局结算 / 创伤）从 engine.js 拆出的模块（Phase 6 · 6d-17）。
//
// 这一组函数是「一关结束之后发生什么」：按战役图推进、重开关卡、结算结局条目、
// 记录创伤（败退/撤退/弱点带来的持久后果）。它们与 `scenario-runtime` 的区别是：
// 那边是剧本**进行中**的接口，这边是剧本**之间**的簿记。
//
// 依赖注入同前几批；本模块没有工厂产物依赖。

import { isDraftMode, openDraftUpgrades } from '../deck/draft-mode.js'
import { restoreInvestigatorForms } from './investigator-form.js'

export function createCampaignFlow(deps) {
  const { scenarioRuntime } = deps
  const {
    ALL_CARDS,
    CHAOS_BAGS,
    pallidMaskCode,
    ScenarioEnded,
    ScenarioRestarted,
    addLitaToCampaign,
    applyCampaignEffect,
    applyResolutionResults,
    awardExperience,
    basicWeaknessPool,
    campaignCardChange,
    campaignFor,
    campaignGraph,
    campaignManifestFor,
    endCampaign,
    enterCampaignNode,
    getThreatEffect,
    info,
    initializeChaosBag,
    introduction,
    originalCardCode,
    randomValue,
    refreshArcaneResearch,
    registeredEntry,
    requestChoice,
    resolutionStory,
    runInterlude,
    runMulligans,
    scenarioBehavior,
    settleExiledCards,
    startScenario,
    updateCampaignStatus,
    walkCampaign,
  } = deps

// 上一关阵亡/疯狂的席位在战役记录里仍是 `killed` / `insane`：它们不能带着旧身份进入下一关，
// 必须先在准备窗口里挑选替补调查员（全新 0 XP 牌组）。
//   · 有幕间节点时，关间窗口（下面 interlude 分支）本来就会重置席位确认并开放换人；
//   · 流程图里两关直接相邻（中间没有幕间节点，例如《失落的时代》久远腹地上/下半、
//     《万象无终》前几章）时，hubContinue 会从上一关结算直接落到下一关的 scenarioSetup。
//     若沿用上一轮的 hubReady/hubSeatDone，界面会显示「全队已就绪」，房主点「开始当前关卡」
//     会在 prepareInvestigator 抛「调查员战役身份不可进入剧本」，而且没有任何入口可以换人。
// 现役席位视为已确认（不需要为换人重复确认一次），只把阵亡/疯狂的席位挂回待准备。
// 返回被挂回待准备的调查员（空数组表示无需换人，调用方可据此决定是否提示/重开窗口）。
function reopenReplacementPreparation(state) {
  if (!state.hubFlow || state.uiState !== 'scenarioSetup') return []
  const eliminated = (state.investigators || []).filter(inv => {
    const status = state.campaign?.investigators?.[inv.seat]?.status
    return status != null && status !== 'active'
  })
  if (!eliminated.length) return []
  const pending = new Set(eliminated.map(inv => inv.seat))
  state.hubSeatDone = Object.fromEntries((state.investigators || [])
    .filter(inv => !pending.has(inv.seat)).map(inv => [inv.seat, true]))
  // 阵亡席位必须重新走「选择调查员」步骤，不能沿用上一轮已选中的界面标记。
  if (state.hubSeatSelected) {
    for (const seat of pending) delete state.hubSeatSelected[seat]
  }
  state.hubReady = false
  state.currentSeat = eliminated[0].seat
  state.hubUpgradedSeats = {}
  return eliminated
}

function progressCampaign(state, events, launch = false, leaveRest = false) {
  const campaign = state.campaign
  const manifest = campaignManifestFor(state)
  const graph = campaignGraph(manifest)
  // 是否是「上一关结算后直接推进」：幕间分支会自行重置席位；只有从 scenarioResult 直接
  // 落到 scenario 的准备窗口需要补一次替补席位恢复（旧存档的坏状态由 dispatch 的开始关卡兜底）。
  const fromScenarioResult = state.uiState === 'scenarioResult'
  if (!campaign.chaosBag) {
    const part = campaign.currentPart ?? null
    const bags = (part && manifest.partChaosBags?.[part]) || manifest.chaosBags || CHAOS_BAGS
    initializeChaosBag(state, bags[state.difficulty] || bags.standard)
  }
  if (campaign.pendingNode) {
    enterCampaignNode(campaign, manifest, campaign.pendingNode)
    delete campaign.pendingNode
  } else if (leaveRest && ['interlude', 'checkpoint'].includes(graph.nodes[campaign.flow?.nodeId]?.type)) {
    enterCampaignNode(campaign, manifest, graph.nodes[campaign.flow.nodeId].next)
  }
  // P9.5：`interludeFlow: 'continuous'` 的战役在关间准备结束后一次读完整个幕间子图。
  const node = walkCampaign(campaign, manifest, (id, node, options) => requestChoice(state, {
    kind: 'campaignBranch', source: id, seat: campaign.leadSeat, prompt: node.prompt || node.text || '选择战役路线',
    options: options.map(option => ({ id: option.id, label: option.label })),
  }), effect => applyCampaignEffect(state, effect, text => info(state, events, text)),
  { continuousInterlude: leaveRest && manifest.interludeFlow === 'continuous' })
  campaign.flowStage = node.type
  if (node.type === 'end') {
    campaign.flowOutcome = node.outcome
    endCampaign(state, events)
  } else if (node.type === 'scenario') {
    campaign.scenarioIndex = manifest.scenarioIds.indexOf(node.scenarioId)
    state.hubSelectedScenarioId = node.scenarioId
    state.uiState = 'scenarioSetup'; state.phase = 'scenarioSetup'; campaign.phase = 'scenarioSetup'
    // 两关直接相邻时也要能换掉上一关阵亡/疯狂的席位，否则会带着非现役战役身份开局并抛错。
    const eliminated = launch || !fromScenarioResult ? [] : reopenReplacementPreparation(state)
    if (eliminated.length) {
      info(state, events, `☠️ ${eliminated.map(inv => inv.name).join('、')} 已经阵亡或疯狂：进入下一关前请先挑选替补调查员并确认准备。`)
    }
    if (launch) { startScenario(state, campaign.scenarioIndex, events); runMulligans(state, events) }
  } else {
    campaign.phase = 'interlude'; state.phase = 'interlude'; state.uiState = 'interlude'
    // 04109 奥术研究：「每个冒险结束后、下一场冒险前」重置一次首张法术升级折扣。
    // 进入关间窗口时统一刷新；重复调用不会增加创伤（创伤只在购买 04109 时结算）。
    const refreshed = refreshArcaneResearch?.(campaign) || []
    if (refreshed.length) info(state, events, `🔮 「奥术研究」：${refreshed.length} 位调查员恢复了本关间的首张法术升级折扣。`)
    const next = graph.nodes[node.next]
    if (next?.type === 'scenario') {
      campaign.scenarioIndex = manifest.scenarioIds.indexOf(next.scenarioId)
      state.hubSelectedScenarioId = next.scenarioId
    }
    campaign.upgradesAllowed = node.type === 'interlude' && node.upgrades !== false
    if (campaign.upgradesAllowed) openDraftUpgrades(state)
    state.hubReady = false; state.hubSeatDone = {}; state.currentSeat = 0
    if (launch && !state.hubFlow) runInterlude(state, campaign.scenarioIndex, events)
  }
}

  function restartScenario(state, events = []) {
  const campaign = state.campaign
  if (!campaign || !state.scenario) return false
  const graph = campaignGraph(campaignManifestFor(state))
  // campaignGraph 直接返回 manifest.flow，节点对象没有 id 字段，key 从 flow.nodeId 取。
  const nodeId = campaign.flow?.nodeId
  const node = graph.nodes[nodeId]
  if (!node || node.type !== 'scenario') return false
  const roster = state.investigators.filter(inv => campaign.investigators?.[inv.seat])
  if (!roster.length) return false
  // 有人死亡/疯狂/退场时不在原地重开：让正常结算流程处理替补。
  if (roster.some(inv => campaign.investigators[inv.seat].status !== 'active')) return false
  // 旧存档兜底：重开前把威胁区里的中毒弱点补记进战役牌组，否则重开后按记录重建牌组会丢中毒。
  persistPoisonedWeaknesses(state, events)
  campaign.flow.visits ||= {}
  campaign.flow.visits[nodeId] = (campaign.flow.visits[nodeId] || 1) + 1
  return true
}

// 04102「中毒」是永久弱点：正常获得时 poisonInvestigator 已把卡写进战役牌组记录；
// 这里兜底旧存档——更新前中毒只进了威胁区域、战役记录里没有这张卡。结算时按威胁区补记，
// 否则旧存档跨关后中毒仍会凭空消失（同一调查员只保留一张，campaignCardChange 前先查重）。
function persistPoisonedWeaknesses(state, events) {
  const campaign = state.campaign
  for (const inv of state.investigators || []) {
    const record = campaign.investigators?.[inv.seat]
    if (!record || !Array.isArray(record.deck)) continue
    const poison = (inv.threat || [])
      .map(card => card?.code)
      .find(code => code && registeredEntry(code)?.poisonWeakness === true)
    if (!poison || record.deck.includes(poison)) continue
    campaignCardChange(campaign, inv.seat, poison, 'add', 'poison')
    info(state, events, `🧪 ${inv.name} 的中毒弱点补记入战役牌组（永久弱点跨关保留）。`)
  }
}

function finishScenario(state, resolutionKey, events) {
  const CAMPAIGN = campaignFor(state)
  if (state.status !== 'playing') return
  const sc = state.scenario
  const campaign = state.campaign
  if (!Object.hasOwn(sc.resolutions, resolutionKey)) throw new Error('未知剧本结局')
  // 关卡结束：先还原换身（04244 伊斯人身体等），幕间/关间窗口与后续剧情都回到原本的调查员卡；
  // 战役要求延续到后续关卡的换身由 campaign.ruleFlags.investigatorForms 记录、下一关开局再套用。
  const restoredForms = restoreInvestigatorForms(state)
  if (restoredForms) info(state, events, `🧠 你们的意识回到了自己的身体（${restoredForms} 位调查员）。`)
  const visitId = `${campaign.flow?.nodeId || sc.id}:${campaign.flow?.visits?.[campaign.flow.nodeId] || 1}`
  if (campaign.scenarioResults.some(result => result.visitId === visitId)) throw new Error('本关已经结算')
  const before = structuredClone(campaign.investigators)
  const recordsBefore = structuredClone(campaign.records)
  state.resolution = resolutionKey
  campaign.phase = 'resolution'
  const awardedLocationIds = new Set((state.victoryDisplay || [])
    .filter(card => String(card.id || '').startsWith('location:'))
    .map(card => String(card.id).slice('location:'.length)))
  state.victory = (state.victoryDisplay || []).reduce((sum, card) => sum + (card.victory || 0), 0)
    + state.locations.filter(loc => !awardedLocationIds.has(loc.id) && loc.revealed && loc.clues === 0)
      .reduce((sum, loc) => sum + (loc.victory || 0), 0)
  info(state, events, `剧本结局：${resolutionKey}。`)
  // 04038 黑暗契约：游戏结束/退场时仍在手牌，则移出牌库并换成「失败的代价」。
  for (const inv of state.investigators) {
    for (const code of [...(inv.hand || [])]) {
      const entry = registeredEntry(code)
      if (!entry?.darkPactForced || !entry.replacementCode) continue
      inv.hand = inv.hand.filter(item => item !== code)
      inv.deck = (inv.deck || []).filter(item => item !== code)
      inv.deck.push(entry.replacementCode)
      info(state, events, `📜 「${cardName(code)}」仍在你手中：移出牌库，换成「${cardName(entry.replacementCode)}」。`)
    }
  }
  const storyKey = scenarioBehavior(state).storyResolutionKey?.(state, resolutionKey) || resolutionKey
  let story = resolutionStory(sc, storyKey, null, {
    records: recordsBefore,
    investigators: state.investigators,
    actIndex: state.actIndex,
  })
  info(state, events, story.paragraphs.join('\n\n'), { kind: 'story', title: story.title,
    name: sc.name, text: story.paragraphs.join('\n\n') })
  applyDefeatTrauma(state, events)
  const resolutionResult = applyResolutionEffects(state, resolutionKey, events)
  if (resolutionResult?.story) story = resolutionResult.story
  persistPoisonedWeaknesses(state, events)
  settleExiledCards(campaign, state.exiledBySeat)
  for (const inv of state.investigators) {
    // Phase 5（5a-8）：威胁卡带来的创伤由条目级标记声明（计数 / 充能阈值）。
    if (inv.threat.some(card => registeredEntry(card.code)?.mentalTraumaIfCounters && card.counters > 0)) {
      addTrauma(state, inv.seat, 'mental', 1, events)
    }
    for (const threat of inv.threat) {
      const threshold = registeredEntry(threat.code)?.physicalTraumaIfUsesBelow
      if (threshold == null || (threat.uses || 0) >= threshold || threat.traumaApplied) continue
      threat.traumaApplied = true
      addTrauma(state, inv.seat, 'physical', 1, events)
    }
    if (state.enemies.some(enemy => enemy.smiteTheWickedSeat === inv.seat)
      || state.locations.some(loc => loc.searchingForIzzieSeat === inv.seat)) addTrauma(state, inv.seat, 'mental', 1, events)
    // 2026-10-25 第四轮修复 05012：弱点「游戏结束时仍在你手牌中则承受 1 点精神创伤」。
    // 已退场/撤退者的手牌已不满足「游戏结束时仍在手牌」（且退场分支已在 eliminateInvestigator
    // 结算过），这里跳过，避免跨分支重复触发。
    if (!inv.defeated && !inv.resigned
      && inv.hand.some(code => registeredEntry(code)?.traumaAtGameEndWhenInHand === true)) {
      addTrauma(state, inv.seat, 'mental', 1, events)
      info(state, events, `${inv.name} 手牌中的弱点在游戏结束时令其承受 1 点精神创伤。`)
    }
    updateCampaignStatus(campaign, inv.seat)
  }
  // 第 124 轮：关末的「战役弱点转交」由战役清单声明记录键
  // （`campaignWeaknessTransferRecord`），引擎不再写死战役 id。
  const weaknessTransferRecord = campaignManifestFor(state)?.campaignWeaknessTransferRecord
  if (weaknessTransferRecord && campaign.records[weaknessTransferRecord]) {
    applyCampaignEffect(state, {
      type: 'transferCampaignWeakness',
      code: pallidMaskCode(),
      bearerRecord: weaknessTransferRecord,
    }, text => info(state, events, text))
  }
  if (isDraftMode(state)) for (const inv of state.investigators) {
    const record = campaign.investigators[inv.seat]
    const finalXp = Math.max(0, record.earnedXp - before[inv.seat].earnedXp)
    const extra = finalXp + 2
    awardExperience(campaign, inv.seat, extra)
    info(state, events, `${inv.name} 三选一模式：(${finalXp} + 1) × 2 = ${(finalXp + 1) * 2} XP。`)
  }
  campaign.victory += state.victory
  campaign.scenarioResults.push({
    scenarioId: sc.id, scenarioIndex: campaign.scenarioIndex, visitId, resolution: resolutionKey,
    storyResolution: storyKey,
    introStory: structuredClone(state.scenarioIntro || introduction(sc, recordsBefore, state)),
    story,
    victory: state.victory, rounds: state.round, recordsBefore, recordsAfter: structuredClone(campaign.records),
    investigators: state.investigators.map(inv => {
      const record = campaign.investigators[inv.seat]
      return { seat: record.roomSeat ?? inv.seat, id: record.id, code: record.code, status: record.status,
        defeated: inv.defeated, resigned: inv.resigned,
        xpAwarded: record.earnedXp - before[inv.seat].earnedXp, xp: record.xp,
        traumaBefore: before[inv.seat].trauma, traumaAfter: { ...record.trauma }, deck: [...record.deck] }
    }),
  })
  const graph = campaignGraph(campaignManifestFor(state))
  const current = graph.nodes[campaign.flow?.nodeId]
  const node = current?.type === 'scenario' && current.scenarioId === sc.id ? current
    : Object.values(graph.nodes).find(item => item.type === 'scenario' && item.scenarioId === sc.id)
  campaign.pendingNode = node?.next
  const next = graph.nodes[campaign.pendingNode]
  const campaignEnds = campaign.failed || !next || next.type === 'end'
  // 规则（P1）：本关全灭/全员撤退只结束本关，队伍带着创伤进入下一关；
  // 只有战役已无下一关（或剧本显式把 campaign.failed 置真）才算战役失败。
  // 旧的非大厅流程没有关间换人步骤，若有人已死亡/疯狂则无法接手，仍按失败处理。
  const noSurvivor = !state.investigators.some(inv => !inv.defeated && !inv.resigned)
  const needsReplacement = state.investigators.some(inv => campaign.investigators[inv.seat]?.status !== 'active')
  if (resolutionKey === 'noResolution' && noSurvivor
    && (campaignEnds || (!state.hubFlow && needsReplacement))) campaign.failed = true
  if (campaign.failed || campaignEnds) {
    throw new ScenarioEnded(null)
  }
  throw new ScenarioEnded(campaign.scenarioIndex + 1)
}

function applyResolutionEffects(state, resolutionKey, events) {
  const campaign = state.campaign
  const result = scenarioBehavior(state).resolution?.(
    state, resolutionKey, events,
    { ...scenarioRuntime(state,events), addLitaToCampaign, addTrauma, originalCardCode, basicWeaknessPool,
      ALL_CARDS, campaignCardChange, randomValue,
      // P2：结局钩子也能要求玩家做选择（04059 结局 3「回到遗迹深处 / 摧毁此处」），
      // 以及「重演本场冒险」的剧本重开原语（04059 结局 4）。
      choose: request => requestChoice(state, request),
      restartScenario: () => {
        if (!restartScenario(state, events)) return false
        throw new ScenarioRestarted()
      } }) || {}
  if (result.flowData !== undefined) campaign.flowPayload = structuredClone(result.flowData)
  const { bonus = 0, award = true, seatBonus = () => 0 } = result
  // Phase 3（D4）：结局的「写哪些记录 / 给谁创伤 / 加什么标记」可以是声明式条目，
  // 由 campaign-effects 的解释器统一校验 recordSchema 后结算。必须在记录快照之前完成。
  if (result.effects) {
    try {
      applyResolutionResults(state, result.effects, { log: text => info(state, events, text) })
    } catch (error) {
      throw new Error(`关卡 ${state.scenario?.id || '?'} 的结局 ${resolutionKey} 声明无效：${error.message}`)
    }
  }
  if (award) for (const inv of state.investigators) {
    let amount = state.victory + bonus + seatBonus(inv.seat) + (inv.scenarioXpBonus || 0)
    // Phase 5（5b-9）：「卡戎的银币」这类结局加成由条目级 obolContract 声明。
    const obol = inv.assets.find(asset => registeredEntry(asset.code)?.obolContract)
    if (obol) {
      if (inv.defeated) {
        const record = campaign.investigators[inv.seat]
        if (record) record.status = 'killed'
        updateCampaignStatus(campaign, inv.seat)
        info(state, events, `${inv.name} 在「卡戎的银币」的契约下被击败，已死亡。`)
        continue
      }
      amount += 2
      info(state, events, `${inv.name} 因「卡戎的银币」额外获得 2 XP。`)
    }
    const debt = inv.threat.find(item => getThreatEffect(item)?.debt)
    if (debt && (debt.resources || 0) < 6) {
      const penalty = getThreatEffect(debt)?.xpPenalty || 2
      amount = Math.max(0, amount - penalty)
      info(state, events, `${inv.name} 的医院债务少于 6 资源，本场冒险少获得 ${penalty} XP。`)
    }
    // 2026-10-25 本循环修复 05010：通用「本场冒险少取得 N 点经验」的威胁条目字段（scenarioXpModifier）。
    // 威胁区里每张声明该字段的卡都参与 XP 结算（如悬案在「改为加入威胁区域」后生效）。
    for (const threat of inv.threat.slice()) {
      const modifier = Number(registeredEntry(threat.code)?.scenarioXpModifier || 0)
      if (!modifier) continue
      amount = Math.max(0, amount + modifier)
      const label = ALL_CARDS[threat.code]?.nameZh || ALL_CARDS[threat.code]?.name || threat.code
      info(state, events, `「${label}」：${inv.name} 本场冒险少取得 ${Math.abs(modifier)} 点经验值。`)
    }
    awardExperience(campaign, inv.seat, amount)
    info(state, events, `${inv.name} 获得 ${amount} XP，未花费 ${campaign.investigators[inv.seat].xp} XP。`)
  }
  result.afterExperience?.(state, scenarioRuntime(state, events))
  return result
}

function addTrauma(state, seat, kind, amount, events) {
  const t = state.campaign.trauma[seat]
  t[kind] += amount
  updateCampaignStatus(state.campaign, seat)
  const inv = state.investigators[seat]
  info(state, events, `${inv.name} 受到 ${amount} 点${kind === 'physical' ? '肉体' : '精神'}创伤。`)
}

function applyDefeatTrauma(state, events) {
  for (const inv of state.investigators) {
    if (!inv.defeated || inv.resigned || !inv.defeatCause) continue
    // 只有「因伤害/恐惧被击败」才按创伤结算；阵亡类原因（坠崖、被杀等）不折算成精神创伤。
    if (!['both', 'damage', 'horror'].includes(inv.defeatCause)) continue
    const kind = inv.defeatCause === 'both' ? requestChoice(state, {
      kind: 'trauma', source: 'defeat', seat: inv.seat, prompt: '同时因伤害与恐惧被击败，选择一种创伤。',
      options: [{ id: 'physical', label: '1 点肉体创伤' }, { id: 'mental', label: '1 点精神创伤' }],
    }) : inv.defeatCause === 'damage' ? 'physical' : 'mental'
    addTrauma(state, inv.seat, kind, 1, events)
  }
}

  return { progressCampaign, restartScenario, finishScenario, applyResolutionEffects, addTrauma, applyDefeatTrauma, reopenReplacementPreparation }
}
