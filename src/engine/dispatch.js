// 行动分派（applyMove / executeCommand / executeAction / executeHubMove / applyMoveUnchecked）
// 从 engine.js 拆出的模块（Phase 6 · 6d-19）。
//
// 这一组是「一条合法行动如何落到具体结算函数」的调度层：
//   applyMove → executeCommand →（关间？executeHubMove ：executeAction → 具体 do*）
// 它本身不含规则，只做「校验通过后分发」与「动作级事件的统一记录」。
// 拆开后 engine.js 的顶层只剩：状态机（阶段）、各个 do*、以及能力层 api。
//
// 依赖注入同前；被依赖表引用的 do* 与本模块函数都用函数声明 + 惰性装配。

import { investigatorRule } from '../cards/card-rules.js'
import { cardPoolContext } from '../deck/card-pool.js'

import { isParleyDescriptor } from './parley.js'
// 第 5 步 P6：法术专用额外行动的算术在 spell-actions.js（纯函数，无依赖）。
// P6（食梦者）：受限行动的算术与 kind 判定分别在 restricted-actions.js / table-decisions.js。
import { spellOnlyActionsOf } from './spell-actions.js'
import {
  actionsAvailable as restrictedActionsAvailable, consumeAction as consumeRestrictedAction,
} from './restricted-actions.js'

import { MODE_LABELS, assignSeatPart, campaignPartsManifest, defaultPartLeads, describeModePlan, laneBalance, modePlan } from '../campaign/campaign-modes.js'
import { createPartsState, inPart, setPart } from '../campaign/campaign-parts.js'
import { partOfScenario } from '../campaign/part-flow.js'
import { enterLaneRuntime, leaveLaneRuntime } from './lane-runtime.js'
import { createEffect } from './effect-state.js'
import { nextInstanceId } from './rules-state.js'
export function createDispatch(deps) {
  const {
    ALL_CARDS,
    ALL_INVESTIGATORS,
    EFFECTS,
    ScenarioEnded,
    ScenarioRestarted,
    abilityOfMove,
    actionCost,
    actionKind,
    isSpellAction,
    restrictedKindOfMove,
    advanceAct,
    advanceInvestigator,
    aliveInvestigators,
    assetEffect,
    basicWeaknessPool,
    buildDeck,
    buildDeckFromList,
    campaignDiscardOnYourOwn,
    campaignFor,
    captureTableState,
    cardKeyword,
    checkAct,
    checkDefeated,
    checkOutcome,
    chooseAttack,
    controlledAbilityCard,
    corePlayerPool,
    availablePlayerPool,
    getCurrentActionKind,
    setCurrentActionKind,
    setCurrentSpellAction,
    setCurrentRestrictedKind,
    doAbility,
    doEntityAbility,
    doBreakDoor,
    doDiscardThreat,
    doDraw,
    doDrawCultist,
    doEndTurn,
    doEngage,
    doEvade,
    doExplore,
    doFight,
    doFreeAction,
    doHiddenAction,
    doInterruptRitual,
    doInvestigate,
    doLocationAbility,
    doMove,
    doParley,
    doParleyCultist,
    doParleyLita,
    doPayDebt,
    doPlay,
    doPurgeThreat,
    doResign,
    doResource,
    doSacrificeLita,
    doSearchIzzie,
    doShortcutMove,
    doDetachLocationAttachment,
    endCampaign,
    enemiesEngagedWith,
    enemyAttack,
    enemyCanOpportunityAttack,
    // 2026-10-28 调试控制台（CONTRACT §3）：由 engine.js 注入的调试执行器。
    executeDebugMove,
    finishUpgradeDraft,
    getMaxSanity,
    getStat,
    hubActingSeats,
    hubPendingSeats,
    // 2026-10-27 修复 05002：直觉牌库揭示牌的折扣值走规则读点（不再写死 2）。
    hunchDeck,
    inHub,
    info,
    initialHubPreparation,
    jakeSkipsOpportunityAttack,
    legalMoves,
    makeInvestigator,
    normalActionsLeft,
    payAndAdvanceAct,
    playFlag,
    // 2026-10-27：如同手牌通道统一取牌（宿主附属 / 直觉牌库 / 银暮匕首下方 / 其余通道片段）。
    playChannels,
    playerWindow,
    progressCampaign,
    randomValue,
    reactionWindow,
    recommendUpgrade,
    registerCampaignInvestigator,
    registeredEntry,
    // 2026-10-25 第六轮修复 05040：行动结束统一清 endOfAction 时长的效果。
    expireEffects,
    resolveTransaction,
    ruleIgnored,
    runInterlude,
    runMulligans,
    scenarioBehavior,
    scenarioRuntime,
    selectInitialHubScenario,
    stagePurchase,
    startScenario,
    syncClues,
    unpaidExtraActionThreats,
    validateMove,
  } = deps

function applyMove(state, seat, move) {
  const error = validateMove(state, seat, move)
  if (error) throw new Error(error)
  // 事务会用"本次动作开始前"的快照重建整个 state（见 resolution.js），
  // 所以动作日志必须由这里持有，事务结束后再挂回去。
  const actionLog = state.actionLog || []
  let events
  try {
    events = resolveTransaction(state, seat, move, executeCommand)
  } finally {
    state.actionLog = actionLog
  }
  // 对局级动作日志：重放、撤销与 AI 决策回归都读它（见 src/engine/replay.js）。
  // 只记成功提交的动作；内容是可 JSON 存档的纯数据，不含闭包。
  actionLog.push({ seat, move: { ...move } })
  // 公共线索是个人线索之和的派生值；内容层直接写 inv.clues 时在这里统一收敛，
  // 避免「公共线索 0 / 个人线索 1」导致共同支付与幕推进读错。
  if (!inHub(state) && state.uiState === 'inScenario') syncClues(state)
  state.legalMoves = legalMoves(state)
  if (!inHub(state)) events.push({ type: 'presentation', kind: 'checkpoint', tableState: captureTableState(state, getStat, getMaxSanity) })
  return events
}

function executeCommand(state, seat, move, events) {
  // 调试 move（CONTRACT §3.1）：在局外分支之前分发，完全绕过行动点 / 借机攻击 /
  // 行动类型；校验已由 applyMove → validateMove 完成。
  if (move.action === 'debug') return executeDebugMove(state, seat, move, events)
  if (inHub(state)) {
    executeHubMove(state, seat, move, events)
    return
  }
  if (move.action === 'interlude') {
    runInterlude(state, move.nextIndex, events)
    return
  }
  try {
    executeAction(state, seat, move, events)
  } catch (error) {
    if (error instanceof ScenarioRestarted) {
      // 04059 结局 4：重演本场冒险。原地重新布置同一剧本，并重新发起始手牌。
      const index = state.campaign.scenarioIndex
      startScenario(state, index, events)
      runMulligans(state, events)
      info(state, events, '🔁 调查队重组队伍，再次进入遗迹深处。')
      return
    }
    if (!(error instanceof ScenarioEnded)) throw error
    // 关卡结束：先把记录键与座位簿记改回 roomSeat，再进入结算/关间。
    leaveLaneRuntime(state)
    if (error.nextIndex == null) {
      if (state.campaign.failed || !state.campaign.pendingNode) endCampaign(state, events)
      else progressCampaign(state, events, false)
    }
    else if (state.hubFlow) {
      state.campaign.pendingNextIndex = error.nextIndex
      state.campaign.phase = 'scenarioResult'
      state.uiState = 'scenarioResult'
      state.phase = 'scenarioResult'
      state.currentSeat = 0
      state.legalMoves = legalMoves(state)
    } else progressCampaign(state, events, true)
  }
}

function executeAction(state, seat, move, events) {
  if (move.action === 'setup') {
    progressCampaign(state, events, true)
    return
  }
  const inv = state.investigators[seat]
  // Phase 5（5c-39）：谁能回滚这个动作由条目级 rewindAction 决定（手上或附属区里都算）。
  const needsTimeWarpSnapshot = !['endTurn', 'setup', 'interlude'].includes(move.action)
    && aliveInvestigators(state).some(owner => owner.hand.some(code => registeredEntry(code)?.rewindAction === true)
      || owner.assets.some(asset => (asset.attached || []).some(code => registeredEntry(code)?.rewindAction === true)))
  const actionSnapshot = needsTimeWarpSnapshot
    ? structuredClone({ ...state, _resolution: null, pendingChoice: null, legalMoves: [], lastActionSnapshot: null }) : null
  const totalCost = actionCost(state, inv, move, false)
  const cost = actionCost(state, inv, move)
  const kind = actionKind(state, inv, move)
  setCurrentActionKind(kind)
  // 第 5 步 P6：法术专用额外行动（玛丽·朗博）——最后一个行动只能花在法术卡/法术能力上。
  // P6（食梦者）：同一读点也覆盖托尼·摩尔根的「只能用于交战/攻击带赏金敌人」的额外行动。
  const spell = isSpellAction(state, inv, move)
  const restricted = restrictedKindOfMove(state, inv, move)
  setCurrentSpellAction(spell)
  setCurrentRestrictedKind(restricted)
  if (kind === 'explore') {
    if (inv.actionsLeft < cost) throw new Error('行动点不足')
    const normal = normalActionsLeft(inv)
    inv.actionsLeft -= cost
    if (normal < cost) inv.exploreOnlyActions = Math.max(0, (inv.exploreOnlyActions || 0) - (cost - normal))
  } else {
    if (restrictedActionsAvailable(inv, restricted) < cost) {
      throw new Error(restricted === 'bounty'
        ? '行动点不足（额外行动只能用于交战或攻击带赏金的敌人）'
        : inv.bountyOnlyActions && restricted !== 'bounty'
          ? '行动点不足（额外行动只能用于交战或攻击带赏金的敌人）'
          : spellOnlyActionsOf(inv) && restricted !== 'spell'
            ? '行动点不足（额外行动只能用于探索或法术）'
            : '行动点不足')
    }
    consumeRestrictedAction(inv, cost, restricted)
  }
  inv.exploreOnlyActions = Math.min(inv.exploreOnlyActions || 0, Math.max(0, inv.actionsLeft))
  if (cost > 0) { inv.actionsTakenThisTurn = (inv.actionsTakenThisTurn || 0) + 1; state.phaseActionCount = (state.phaseActionCount || 0) + 1 }
  if (totalCost > cost || move.action === 'endTurn') inv.tomeActionUsed = true
  state.moveCount++
  const ability = move.action === 'ability' ? assetEffect(inv, controlledAbilityCard(inv, move.assetId))?.abilities?.[move.abilityIndex] : null
  if (totalCost) for (const threat of unpaidExtraActionThreats(state, inv, kind)) {
    threat.extraActionPaidRound = state.round
  }
  state._actionPaid = true
  try {
    if (move.action === 'scenarioAction') scenarioBehavior(state).payScenarioActionCost?.(state, inv, move, scenarioRuntime(state, events))
    const noOpportunityAttack = move.action === 'freeAction' && investigatorRule(inv.code)?.freeAction?.noOpportunityAttack
    // Phase 2（C2）：noOpportunityAttack 也可以由描述子的 add:keyword 授予。
    // Phase 5（5c）：资产把「打出时不引发借机攻击」写成条目级 noOpportunityAttack
    // （旧 DSL 的字段名是 noOpportunityAttackOnPlay），两边都在这里汇合。
    const playNoAoO = move.action === 'play'
      && (playFlag(move.copyCode || move.cardId, 'noOpportunityAttack')
        || cardKeyword(state, inv, move.copyCode || move.cardId, 'noOpportunityAttack'))
    // 行动/能力级豁免（01055 飞贼的 [action]）：只豁免这一次行动，不豁免打出资产本身。
    const usedAbility = move.action === 'ability' ? abilityOfMove(state, inv, move) : null
    const abilityNoAoO = usedAbility?.descriptor?.noOpportunityAttack === true
      || usedAbility?.noOpportunityAttack === true
      // 第 2 步 P2.7：谈判行动按规则不引发借机攻击；非玩家实体的通用行动同理。
      || isParleyDescriptor(usedAbility?.descriptor)
      || move.action === 'entityAbility'
    // 03147 双刃短刀：控制者的「交战」行动不引发借机攻击。
    const engageNoAoO = kind === 'engage'
      && inv.assets.some(item => registeredEntry(item.code)?.engageNoOpportunityAttack === true)
    // 2026-10-25 本循环修复 05228：剧本行动（behavior.actions）可以声明不引发借机攻击，
    // 支持全豁免（noOpportunityAttack: true）与按敌人卡号豁免（noOpportunityAttackFrom: [卡号…]）。
    const scenarioNoAoOAll = move.action === 'scenarioAction' && move.noOpportunityAttack === true
    const scenarioNoAoOFrom = move.action === 'scenarioAction' && Array.isArray(move.noOpportunityAttackFrom)
      ? move.noOpportunityAttackFrom.map(String)
      : []
    if (totalCost && !noOpportunityAttack && !playNoAoO && !abilityNoAoO && !engageNoAoO && !scenarioNoAoOAll
      && !ruleIgnored(state, inv, 'opportunityAttack')
      && !jakeSkipsOpportunityAttack(state, inv, kind)
      && !['fight', 'evade', 'resign', 'parley', 'parleyCultist', 'parleyLita'].includes(kind)) {
      const scenarioExempt = enemy => scenarioNoAoOFrom.includes(String(enemy.originalCode || enemy.code))
        || scenarioNoAoOFrom.includes(String(enemy.code))
      const pending = enemiesEngagedWith(state, inv).filter(enemy => !enemy.exhausted
        && enemyCanOpportunityAttack(state, enemy) && !scenarioExempt(enemy)).map(e => e.id)
      while (pending.length) {
        const candidates = pending.map(id => state.enemies.find(e => e.id === id)).filter(e => e && !e.exhausted)
        if (!candidates.length) break
        const enemy = chooseAttack(state, inv, candidates, 'opportunity')
        pending.splice(pending.indexOf(enemy.id), 1)
        if (inv.onTheLam && !enemy.elite) continue
        const opportunity = reactionWindow(state, 'opportunityAttack', {
          when: 'opportunityAttack', seat, location: inv.location, enemy, prompt: `「${enemy.name}」对 ${inv.name} 发动借机攻击`,
        }, events)
        if (opportunity.cancelled) {
          info(state, events, `${inv.name} 取消了「${enemy.name}」的借机攻击。`)
          continue
        }
        enemyAttack(state, enemy, inv, events, enemy.name + ' 发动借机攻击。', { kind: 'opportunity' })
        if (inv.defeated || state.status !== 'playing') break
      }
    }
    if (!inv.defeated && !inv.resigned && state.status === 'playing') {
      state.lastActionSnapshot = actionSnapshot
      applyMoveUnchecked(state, seat, move, events)
      // 「自食其力」（04236）等持续强制：资产入场/换装后立刻检查，而不是等到重整阶段。
      if (!inv.defeated && !inv.resigned) campaignDiscardOnYourOwn(state, inv, events)
      if (state._timeWarped) {
        delete state._timeWarped
        state.lastActionSnapshot = null
        return
      }
      if (move.action !== 'endTurn') {
        reactionWindow(state, 'actionResolvedAtLocation', {
          when: 'actionResolvedAtLocation', seat, location: inv.location, prompt: `${inv.name} 完成了一次行动`,
        }, events)
      }
      state.lastActionSnapshot = null
    } else if (state.status === 'playing') advanceInvestigator(state, seat, events)
  } finally {
    delete state._actionPaid
  }
}

// 幕间结算留下的「下一场冒险」修正：起始资源 / 起始线索，用一次后清空。

function executeHubMove(state, seat, move, events) {
  const CAMPAIGN = campaignFor(state)
  const campaign = state.campaign
  switch (move.action) {
    case 'hubSetLeader':
      if (!(state.humanSeats || [0]).includes(move.leadSeat)) throw new Error('队长必须由真人玩家担任')
      campaign.leadSeat = move.leadSeat
      campaign.leadConfirmed = true
      if (campaign.partLeads && campaign.currentPart) campaign.partLeads[campaign.currentPart] = move.leadSeat
      info(state, events, `${state.investigators[move.leadSeat].name} 被选为小队队长。`)
      break
    case 'hubSetPartLeader': {
      if (!campaignPartsManifest(campaignFor(state)) || !campaign.seatParts) throw new Error('当前战役没有双线队长')
      const part = move.part
      if (!['A', 'B'].includes(part)) throw new Error(`线必须是 A 或 B：${String(part)}`)
      if (!Number.isInteger(move.leadSeat) || campaign.seatParts[move.leadSeat] !== part) {
        throw new Error(`座位 ${move.leadSeat + 1} 不在 ${part} 线，不能担任该线队长`)
      }
      campaign.partLeads = { ...(campaign.partLeads || {}), [part]: move.leadSeat }
      if (campaign.currentPart === part) campaign.leadSeat = move.leadSeat
      info(state, events, `${state.investigators[move.leadSeat].name} 被选为 ${part} 线队长。`)
      break
    }
    case 'hubSetDifficulty': state.difficulty = move.difficulty; break
    case 'hubSelectScenario':
      if (!selectInitialHubScenario(state, move.scenarioId, events)) state.hubSelectedScenarioId = move.scenarioId
      break
    case 'hubGoSetup': state.uiState = 'scenarioSetup'; state.phase = 'scenarioSetup'; campaign.phase = 'scenarioSetup'; break
    case 'hubSetMode': {
      const plan = modePlan({ mode: move.mode, playerCount: (state.investigators || []).length })
      if (!plan.ok) throw new Error(plan.reason || '该开局模式不可用')
      const created = createPartsState({ mode: plan.mode, seatParts: plan.seatParts, currentPart: plan.currentPart })
      campaign.mode = created.mode
      campaign.seatParts = [...created.seatParts]
      campaign.activeParts = [...created.activeParts]
      campaign.currentPart = created.currentPart
      campaign.parts = {}
      // 双线各自一名队长（默认每条线第一个真人座位）；分选/并行都保留，便于关间切换。
      campaign.partLeads = defaultPartLeads(campaign.seatParts, state.humanSeats || [0])
      campaign.leadConfirmed = true
      campaign.leadSeat = campaign.partLeads[campaign.currentPart || 'A'] ?? campaign.leadSeat
      campaign.scenarioIndex = 0
      // 声明了 parts 的双线 flow 从章对门起步：把 flow 直接定位到首关（a1/b1），
      // 这样 hub 的「选择第一关」与后续 hubBeginScenario 都能读到 scenario 节点。
      const order = campaignFor(state).scenarioOrder || []
      const first = order[0] ?? null
      state.hubSelectedScenarioId = first
      if (first && campaignPartsManifest(campaignFor(state))) selectInitialHubScenario(state, first, events)
      state.hubSeatSelected = {}
      state.hubSeatDone = {}
      state.hubUpgradedSeats = {}
      info(state, events, `开局模式：${MODE_LABELS[plan.mode]?.label || plan.mode}。${describeModePlan(plan)}`)
      break
    }
    case 'hubSetSeatPart': {
      if (!['pick', 'parallel'].includes(campaign.mode)) throw new Error('只有分选/并行双线允许手动改线')
      if (campaign.scenarioResults.length) throw new Error('已经开始游戏，不能再改线')
      // 并行：玩家只能换自己的座位；房主只能代操作 AI 座位（不能替其他真人换线）。
      // 分选保留旧口径：座位 1 可替全桌调整。
      if (campaign.mode === 'parallel') {
        const humans = state.humanSeats || [0]
        const self = seat === move.seat
        const hostForAi = seat === 0 && !humans.includes(move.seat)
        if (!self && !hostForAi) throw new Error('房主只能代 AI 换线；真人请用自己的换位置按钮')
      } else if (seat !== move.seat && seat !== 0) throw new Error('只能改自己座位的线')
      const trial = assignSeatPart({ mode: campaign.mode, seatParts: campaign.seatParts, seat: move.seat, part: move.part })
      if (!trial.ok) throw new Error(trial.reason)
      campaign.seatParts = [...trial.seatParts]
      // 换线后如果某线队长被换走，默认改回该线第一个真人座位。
      if (campaign.partLeads) {
        for (const part of ['A', 'B']) {
          const seatInPart = campaign.seatParts[campaign.partLeads[part]] === part
          if (!seatInPart) campaign.partLeads[part] = defaultPartLeads(campaign.seatParts, state.humanSeats || [0])[part]
        }
      }
      const balance = laneBalance(campaign.seatParts)
      const tail = campaign.mode === 'parallel'
        ? `（A ${balance.A} / B ${balance.B}${balance.balanced ? '，人数相等' : '，人数还不相等，不能开始'}）`
        : ''
      info(state, events, `座位 ${move.seat + 1} 改到 ${move.part} 线${tail}。`)
      break
    }
    case 'hubSelectInvestigator': {
      const previous = campaign.investigators[seat]
      if (previous?.status === 'active' && !initialHubPreparation(state)) throw new Error('现役调查员不能更换；只有死亡或疯狂后才能挑选替补')
      if (previous?.status === 'active' && previous.code !== move.code) {
        // Before the first scenario the player may reconsider their investigator.
        // Keep the already generated basic weakness, but require a new legal deck
        // so repeatedly previewing investigators cannot reroll that weakness.
        previous.code = move.code
        previous.name = ALL_INVESTIGATORS[move.code].nameZh || ALL_INVESTIGATORS[move.code].name
        previous.deck = previous.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness')
        previous.startingDeckReady = false
      } else if (previous && previous.status !== 'active') {
        campaign.retired.push(structuredClone(previous))
        delete campaign.investigators[seat]
        // 关间替补：新调查员的 0 XP 起始牌组在确认席位前仍可反复调整（自动构筑/手动/
        // 卡组库/ArkhamDB）。只标记本关间换人的席位，现役调查员仍不能在关间重建牌组。
        if (state.uiState === 'interlude') state.hubReplacementSeats = { ...(state.hubReplacementSeats || {}), [seat]: true }
      }
      state.investigators[seat] = makeInvestigator(ALL_INVESTIGATORS[move.code], seat)
      if (campaign.investigators[seat]) state.investigators[seat].campaignId = campaign.investigators[seat].id
      state.hubSeatSelected[seat] = true
      break
    }
    case 'hubAutoDeck':
    case 'hubSetDeck': {
      const inv = state.investigators[seat]
      const built = move.action === 'hubSetDeck'
        ? buildDeckFromList(ALL_INVESTIGATORS[inv.code], move.codes,
          { seat, seed: Math.floor(randomValue(state) * 4294967296), playerPool: availablePlayerPool(state), basicWeaknessPool: basicWeaknessPool(state) })
        : buildDeck(ALL_INVESTIGATORS[inv.code], {
          seat, seed: Math.floor(randomValue(state) * 4294967296), playerPool: corePlayerPool(state),
        })
      if (built.errors?.length) throw new Error(`牌组无效：${built.errors.join('；')}`)
      // P5 批次 2：非活动线座位的 campaign record 写进该线快照（parts[part]），
      // 活动线仍写顶层；两条线共用同一个 record 形状，靠 inPart 换数据作用域。
      const saveDeck = () => {
        const existing = campaign.investigators[seat]
        if (existing) {
          // Editing or rebuilding a starting deck keeps the generated basic
          // weakness and identity while replacing investigator-specific cards.
          const retained = existing.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness')
          existing.code = inv.code
          existing.name = inv.name
          existing.deck = [...built.playerCards, ...built.signatureCards, ...built.signatureWeaknesses,
            ...(retained.length ? retained : built.basicWeaknesses)].sort()
          existing.startingDeckReady = true
        } else {
          const created = registerCampaignInvestigator(campaign, inv, built.deck)
          created.startingDeckReady = true
        }
      }
      const lanePart = state.campaign.seatParts?.[seat]
      if (lanePart && lanePart !== campaign.currentPart) inPart(state, lanePart, saveDeck)
      else saveDeck()
      inv.autoBuilt = move.action === 'hubAutoDeck'
      if (inv.autoBuilt) info(state, events, `${inv.name}：按调查员属性与卡牌能力评分组牌，并通过尺寸、职业、等级、限额、重复张数和 0 XP 预算检查；签名卡与随机基础弱点另行加入。`)
      info(state, events, `${inv.name} 的战役牌组已保存。`)
      break
    }
    case 'hubPurchase': {
      const purchase = stagePurchase(campaign, seat, move.added, move.removed, cardPoolContext(state))
      info(state, events, `${state.investigators[seat].name} 暂存升级（${purchase.cost} XP），等待确认。`)
      break
    }
    case 'hubConfirmUpgrades': finishUpgradeDraft(campaign, seat, true); break
    case 'hubCancelUpgrades': finishUpgradeDraft(campaign, seat, false); break
    case 'hubAutoUpgrade': {
      const advice = recommendUpgrade(campaign.investigators[seat], campaign.records, cardPoolContext(state))
      campaign.investigators[seat].upgradeAdvice = advice
      if (advice.added) {
        stagePurchase(campaign, seat, advice.added, advice.removed, cardPoolContext(state))
        finishUpgradeDraft(campaign, seat, true)
      }
      state.hubUpgradedSeats[seat] = true
      info(state, events, state.investigators[seat].name + '：' + advice.reason)
      break
    }
    case 'hubDoneSeat': {
      state.hubSeatDone[seat] = true
      // 席位确认后关间不再开放起始牌组重构（与首关准备一致）。
      if (state.hubReplacementSeats) {
        delete state.hubReplacementSeats[seat]
        if (!Object.keys(state.hubReplacementSeats).length) delete state.hubReplacementSeats
      }
      if (hubPendingSeats(state).length) state.currentSeat = hubActingSeats(state)[0]
      else {
        state.currentSeat = 0
        state.hubReady = true
        if (state.uiState === 'interlude') {
          progressCampaign(state, events, false, true)
        }
      }
      break
    }
    case 'hubReopenSetup':
      state.hubReady = false
      state.hubSeatDone = {}
      state.currentSeat = 0
      info(state, events, '首关尚未开始，已重新开放调查员、牌组与席位准备。')
      break
    case 'hubBeginScenario': {
      if (!campaign.leadConfirmed || !(state.humanSeats || [0]).includes(campaign.leadSeat)) throw new Error('请先选择一名真人玩家担任队长')
      // P5 批次 3：单线与分选在进入关卡前切到目标线的运行时（密集线内座位）；并行仍需双运行时
      // 容器接线，先用明确原因挡住，避免把两条线塞进一个运行时。
      const manifest = campaignFor(state)
      const parts = campaignPartsManifest(manifest)
      if (parts && campaign.mode === 'parallel') {
        throw new Error('并行双线由大厅边界启动（mod.applyMove）；纯引擎不直接开局')
      }
      if (!state.hubReady || state.hubSelectedScenarioId !== CAMPAIGN.scenarioOrder[campaign.scenarioIndex]) {
        throw new Error('关卡尚未解锁或队伍尚未准备')
      }
      if (parts && campaign.mode) {
        const part = partOfScenario(manifest.parts, state.hubSelectedScenarioId)
        if (part && campaign.currentPart !== part) setPart(state, part)
        enterLaneRuntime(state)
      }
      progressCampaign(state, events, true)
      break
    }
    case 'hubContinue': {
      delete campaign.pendingNextIndex
      progressCampaign(state, events, false)
      if (state.status !== 'playing') break
      if (state.campaign.flowStage !== 'interlude' && state.campaign.flowStage !== 'checkpoint') break
      campaign.phase = 'interlude'
      state.uiState = 'interlude'
      state.phase = 'interlude'
      state.currentSeat = 0
      state.hubReady = false
      state.hubSeatDone = {}
      state.hubUpgradedSeats = {}
      // 新关间从零开始：替换席位标记只在换人的那一轮关间有效。
      delete state.hubReplacementSeats
      state.hubSelectedScenarioId = CAMPAIGN.scenarioOrder[campaign.scenarioIndex]
      break
    }
    default: throw new Error('未知局外操作')
  }
  state.legalMoves = legalMoves(state)
}

function applyMoveUnchecked(state, seat, move, events) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return events
  // 2026-10-25 第七轮修复 05040：「下一次行动期间生效」的排队效果在行动开始时挂上（endOfAction 到期）。
  if (state.pendingActionEffects?.length) {
    const pending = state.pendingActionEffects
    delete state.pendingActionEffects
    for (const record of pending) {
      createEffect(state, { ...record, duration: 'endOfAction', controllerSeat: record.controllerSeat ?? seat })
    }
    info(state, events, `⏳ 本行动期间生效：${pending.map(record => record.label).filter(Boolean).join('、')}`)
  }

  const m = move || {}
  switch (m.action) {
    case 'advanceAct': payAndAdvanceAct(state, events); break
    case 'scenarioAction': scenarioBehavior(state).performAction(state, inv, m, scenarioRuntime(state, events)); break
    case 'shortcutMove': doShortcutMove(state, seat, m, events); break
    case 'detachLocationAttachment': doDetachLocationAttachment(state, seat, m, events); break
    case 'encounterAction': scenarioBehavior(state).performEncounterAction(state, inv, m, scenarioRuntime(state, events)); break
    case 'play': {
      // 2026-10-27「如同手牌」通道统一原语（play-channels.js）：宿主附属 / 直觉牌库 / 银暮匕首下方
      // 旧实现会先把牌放进手牌再走 doPlay；其余通道保留 move 片段交给 doPlay 从来源取牌。
      // 取牌规则、附加费与折扣都在原语里，dispatch 不再逐通道写分支。
      const channelTaken = playChannels.actionTake(state, inv, m, events)
      if (channelTaken?.toHand) {
        const previousBeneath = state._playedFromBeneath
        if (channelTaken.playedFromBeneath) state._playedFromBeneath = { seat, cardCode: m.cardId }
        try {
          doPlay(state, seat, m.cardId, events, false, false, null, null, null, null, channelTaken.playDiscount || 0)
        } finally {
          if (channelTaken.playedFromBeneath) {
            if (previousBeneath === undefined) delete state._playedFromBeneath
            else state._playedFromBeneath = previousBeneath
          }
        }
        playChannels.actionFinish(state, inv, channelTaken, events)
        break
      }
      // 手牌 / 彩绘世界复制 / 弃牌堆顶事件等：沿用原参数传递（通道 move 的片段也走这里）。
      doPlay(state, seat, m.cardId, events, !!m.fromDiscard, false, m.copyCode,
        m.fromPlanAssetId, m.fromBackpackId, m.threatId)
      break
    }
    case 'draw': doDraw(state, seat, events); break
    case 'resource': doResource(state, seat, events); break
    case 'freeAction': doFreeAction(state, seat, events); break
    case 'hiddenAction': doHiddenAction(state, seat, m, events); break
    case 'move': doMove(state, seat, m.locationId, events); break
    case 'investigate': doInvestigate(state, seat, m.allowNoClues ? { allowNoClues: true } : {}, events); break
    case 'explore': doExplore(state, seat, events); break
    case 'searchIzzie': doSearchIzzie(state, seat, events); break
    case 'locationAbility': doLocationAbility(state, seat, m.locationId, events); break
    case 'fight': doFight(state, seat, { enemyId: m.enemyId }, events); break
    case 'evade': doEvade(state, seat, { enemyId: m.enemyId }, events); break
    case 'extraEvade': doEvade(state, seat, { enemyId: m.enemyId }, events, true); inv.extraEvadeUsed = state.turnSerial; break
    case 'parley': doParley(state, seat, m.enemyId, events); break
    case 'parleyCultist': doParleyCultist(state, seat, m.enemyId, events); break
    case 'parleyLita': doParleyLita(state, seat, events); break
    case 'drawCultist': doDrawCultist(state, seat, events); break
    case 'interruptRitual': doInterruptRitual(state, seat, m.skill, events); break
    case 'sacrificeLita': doSacrificeLita(state, seat, events); break
    case 'breakDoor': doBreakDoor(state, seat, m.skill, events); break
    // 第 2 步 P2.7：地点/敌人/剧情资产上的通用行动（谈判）——与玩家卡能力同一条描述子管线。
    case 'entityAbility': doEntityAbility(state, seat, m, events); break
    case 'ability': doAbility(state, seat, m.assetId, m.abilityIndex, m.targetId, m.optionIndex, events, m.ownerSeat); break
    case 'discardThreat': doDiscardThreat(state, seat, m.threatId, events); break
    case 'purgeThreat': doPurgeThreat(state, seat, m.threatId, events); break
    case 'payDebt': doPayDebt(state, seat, m.threatId, events); break
    case 'engage': doEngage(state, seat, m.enemyId, events); break
    case 'resign': doResign(state, seat, events); break
    case 'endTurn': doEndTurn(state, seat, events); break
    default: break
  }

  checkAct(state, events)
  checkDefeated(state, seat, events)
  checkOutcome(state, events)

  // 2026-10-25 第六轮修复 05040：「本次行动期间」的持续效果在行动结算结束时到期。
  expireEffects(state, 'endOfAction')

  if (state.status === 'playing') {
    // 行动点已经用完（或刚点了结束回合）时，收尾窗口里仍然可以打出快速卡：
    // 否则「快速。只能在你回合期间打出」的手牌会随回合推进失去唯一的时机。
    const acting = state.investigators[seat]
    const closingTurn = !acting || acting.actionsLeft <= 0 || acting.turnEnded || acting.defeated || acting.resigned
    playerWindow(state, 'investigation.afterAction', events, null, { fastCards: closingTurn })
    const cur = state.investigators[seat]
    if (cur.actionsLeft <= 0 || cur.turnEnded || cur.defeated || cur.resigned) {
      advanceInvestigator(state, seat, events)
    }
  }

  if (state.status === 'playing') {
    state.legalMoves = legalMoves(state)
  } else {
    state.legalMoves = []
  }
  return events
}

  return { applyMove, executeCommand, executeAction, executeHubMove, applyMoveUnchecked }
}
