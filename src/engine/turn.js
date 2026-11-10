import { resetTskTurnTracking } from './tsk-investigator-support.js'
import { hunterRouteCandidates } from './enemy-routes.js'
import { enemyCanEnterLocation } from './enemy-entry.js'
import { mechanicState } from './mechanic-state.js'
import { putInHand } from './hand-entry.js'
import { hasPlayerWindow, playerWindowContext } from './player-mechanics.js'
import { hasWindowListener } from './window-listeners.js'
// 回合与阶段推进（神话 / 敌人 / 轮末 / 回合开始与结束）从 engine.js 拆出的模块
// （Phase 6 · 6d-25）。
//
// `upkeepPhase` 与密谋揭示已在 phases.js；这里补齐另一半：
//   runMythos / enemyPhase / hunterStep —— 神话与敌人阶段（含猎人移动）
//   runLocationRoundEnd / runEnemyRoundEnd / runThreatEndTurn —— 轮末与威胁到期
//   phaseBeginningWindow / turnBeginningWindow / beginInvestigationPhase /
//   runBetweenInvestigationPhases — 阶段与回合的窗口
//   doEndTurn —— 结束回合
// 拆完后 engine.js 里的「状态机」只剩一个顶层循环（startScenario → 各阶段 → 结局）。

// 第 5 步 P6：法术专用额外行动的授权/清理只走 spell-actions 的算术（纯函数，无依赖）。
import { clearSpellCredit, grantSpellCredit } from './spell-actions.js'
import { beginAirTurn, floodLevel } from './flood.js'
// P6（食梦者）：受限额外行动（托尼·摩尔根的赏金行动）的授权与清理。
import {
  RESTRICTED_ACTION_KINDS, clearRestrictedAction, grantRestrictedAction, restrictedActionRule,
} from './restricted-actions.js'
import { enemyRuleFlags, investigatorRule } from '../cards/card-rules.js'
import { dreamGateEntryError, setDreamGatesAside } from './dream-gate.js'
import { swarmGroup } from './swarm.js'
import {
  clearAttackHistory, clearExpiredFlipAfterTestMarkers, resetRoundEvents, syncAllPassiveDeckTops,
} from './eote-investigator-support.js'

export function createTurn(deps) {
  const {
    upkeepPhase,
    EFFECTS,
    PREY_RANK,
    aliveInvestigators,
    applyThreatForced,
    assetEffect,
    autoEngageAll,
    cardName,
    checkAct,
    checkAgenda,
    checkDefeated,
    checkOutcome,
    chooseAmong,
    chooseAttack,
    chooseTurn,
    disengageEnemy,
    distanceToInvestigator,
    drawEncounter,
    enemiesEngagedWith,
    // 07327 缟玛瑙守卫：地点声明「敌军阶段期间，重整的古神敌人可以攻击本地点的调查员」。
    enemyAttacksAsIfEngaged,
    enemyAttack,
    enemyDef,
    enemyTextBlanked,
    expireEffects,
    exploreOnlyActionBonus,
    extraActionBonus,
    getThreatEffect,
    info,
    // 第 5 步 P6：直觉牌库的揭示/洗回与资源寄存的回合结算。
    hunchDeck,
    investigatorTextBlanked,
    resourceBank,
    leadDecisionSeat,
    leaveAsset,
    locName,
    performTest,
    placeDoomOnCard,
    playerWindow,
    openAbilityWindow,
    reactionWindow,
    registeredEntry,
    relocateEnemy,
    removeOne,
    removeThreat,
    requestChoice,
    ruleIgnored,
    runAgendaForced,
    scenarioBehavior,
    scenarioRuntime,
    campaignBorrowedTimeTurnStart,
    triggerReaction,
    useGoldPocketWatch,
  } = deps

function runMythos(state, repeated = false) {
  const events = []
  // 上一轮的「本轮内」效果在这里到期；神话阶段自身的临时效果在敌人阶段开始时到期。
  for (const effect of expireEffects(state, 'endOfRound')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（本轮结束）。`)
  }
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phase = 'mythos'
  state.phaseActionCount = 0
  if (!repeated) state.round += 1
  if (!repeated) resetRoundEvents(state)
  if (!repeated) syncAllPassiveDeckTops(state)
  if (!repeated && hasPlayerWindow(state, 'roundStarts')) reactionWindow(state, 'roundStarts', { when: 'roundStarts' }, events)
  // 「轮末弃置」的支援（如柯尔特袖珍手枪）在新一轮开始时弃掉。
  if (!repeated) {
    for (const inv of state.investigators) {
      if (!inv || inv.defeated || inv.resigned) continue
      // Phase 6（6e-14）：轮末弃置从条目级字段读（旧 DSL 条目回落）。
      for (const asset of inv.assets.filter(item =>
        (registeredEntry(item.code)?.discardAtRoundEnd)).slice()) {
        leaveAsset(state, inv, asset, [])
        inv.discard.push(asset.code)
      }
    }
  }
  // 卡面「跳过神话阶段的『在当前密谋放置 1 个毁灭』步骤」（03121/03122/03123）。
  const currentAgenda = state.agendas[state.agendaIndex]
  const skipMythosDoom = registeredEntry(currentAgenda?.originalCode || currentAgenda?.code)?.skipMythosDoom === true
  if (skipMythosDoom) {
    info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：「${currentAgenda?.name || '当前密谋'}」跳过放置毁灭步骤（当前 ${state.doom}）。`,
      { kind: 'phase', phase: 'mythos', round: state.round, text: '跳过密谋毁灭 · 当前无变化', effect: 'doom', delta: 0 })
  } else {
    // 2026-10-25 第四轮修复 05285：神话阶段的「在当前密谋放置 1 点毁灭」也走统一替换钩子
    // （behavior.doomPlacementReplacement 可把这次放置替换成别的效果；05285 改为放裂口）。
    // 2026-10-31 黑星升起：把来源（神话阶段步骤 1）传给剧本——黑星升起要等本阶段的
    // 「检查毁灭阈值」步骤统一比较两套密谋，而卡牌效果放置毁灭时才允许即时检查。
    const replacedByBehavior = scenarioBehavior(state).doomPlacementReplacement?.(
      state, 1, scenarioRuntime(state, events), { source: 'mythos' }) === true
    if (replacedByBehavior) {
      info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：「在当前密谋放置 1 点毁灭」被剧本效果替换。`,
        { kind: 'phase', phase: 'mythos', round: state.round, text: '密谋毁灭被替换', effect: 'doom', delta: 0 })
    } else {
      state.doom += 1
      info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：密谋上放置 1 点毁灭（当前 ${state.doom}）。`,
        { kind: 'phase', phase: 'mythos', round: state.round, text: `密谋增加 1 点毁灭 · 当前 ${state.doom}`, effect: 'doom', delta: 1 })
      // 神话阶段的毁灭也是「放置毁灭」，剧本的强制要能看到（04282/04283）。
      scenarioBehavior(state).doomPlaced?.(state,
        { target: null, amount: 1, agenda: true }, scenarioRuntime(state, events))
    }
  }
  phaseBeginningWindow(state, events)
  checkAgenda(state, events)
  // 神话阶段「检查毁灭阈值」步骤结束后的剧本强制（04284 复仇等）。
  if (state.status === 'playing') scenarioBehavior(state).mythosDoomChecked?.(state, scenarioRuntime(state, events))
  if (state.status !== 'playing') return events
  const encounterStep = reactionWindow(state, 'mythosEncounterStep', { when: 'mythosEncounterStep',
    seat: state.campaign.leadSeat, prompt: '神话阶段：将要依次抽取遭遇卡。' }, events)
  if (!encounterStep.skip && state.mythosEncounterReplacementRound !== state.round) for (const inv of aliveInvestigators(state)) drawEncounter(state, inv, events)
  playerWindow(state, 'mythos.afterEncounter', events)
  // 2026-10-25 第七轮修复 05021：神话阶段结束的 pay-or-discard 窗口。
  // 仅当真的有带 mythosEnd 能力的卡时才开窗（避免空窗口改变重放指纹）。
  for (const inv of aliveInvestigators(state)) {
    const hasMythosEnd = [...(inv.assets || []), ...(inv.threat || []), ...(inv.attachments || [])]
      .some(card => (registeredEntry(card.code)?.abilities || []).some(ability => ability.trigger?.includes('mythosEnd')))
    if (!hasMythosEnd) continue
    openAbilityWindow(state, 'mythosEnd', {
      when: 'mythosEnd', seat: inv.seat, location: inv.location,
      prompt: `${inv.name} 的神话阶段结束窗口`,
    }, events)
  }
  // 神话阶段结束强制：数据中的 mythosEndDoom。
  for (const enemy of state.enemies.slice()) {
    const doom = enemyTextBlanked(state, enemy) ? 0
      : (enemyDef(enemy.code)?.mythosEndDoom || enemyRuleFlags(enemy.code).mythosEndDoom || 0)
    if (doom > 0) {
      placeDoomOnCard(state, enemy, doom, events, { silent: true })
      info(state, events, `🌑 「${enemy.name}」上放置 ${doom} 点毁灭（当前 ${enemy.doom}）。`)
    }
  }
  for (const inv of aliveInvestigators(state)) {
    for (const asset of inv.assets.slice()) {
      if (!assetEffect(inv, asset)?.forcedMythosEndDiscard) continue
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
      info(state, events, `🌑 「${cardName(asset.code)}」在神话阶段结束时被弃掉。`)
    }
  }
  scenarioBehavior(state).mythosEnded?.(state, scenarioRuntime(state, events))
  return events
}

// 07202 油门踩死：「每个敌人获得猎手」= 当前幕条目的 `actRule.enemiesGainHunter`。
// 只影响猎手行为判定（移动/目标），不写实例字段，因此换幕/换面立即失效。
function enemyHasHunter(state, enemy) {
  if (enemy?.hunter) return true
  const act = state.acts?.[state.actIndex]
  return registeredEntry(act?.originalCode || act?.code)?.actRule?.enemiesGainHunter === true
}

// 07338 潜水服：「你忽略当前密谋的强制能力」= 该调查员控制的资产声明 `assetRule.ignoreAgendaForced`。
// 读点：回合开始的「求取空气」（本条印刷把它归为当前密谋的强制能力）。
function ignoresAgendaForced(state, inv) {
  return [...(inv?.assets || []), ...(inv?.threat || [])].some(card =>
    registeredEntry(card.code)?.assetRule?.ignoreAgendaForced === true)
}

function resolveEnemyPhaseOf(state, enemy, events = []) {
  if (!enemy || !state.enemies.includes(enemy)) return { moved: false, attacked: false }
  const previous = enemy.location
  if (enemyHasHunter(state, enemy) && !enemy.exhausted && enemy.engagedSeat == null && !enemy.immobile
    && !enemyTextBlanked(state, enemy)) {
    const overridden = scenarioBehavior(state).hunterMove?.(state, enemy, scenarioRuntime(state, events))
    if (!overridden && !aliveInvestigators(state).some(inv => inv.location === enemy.location
      && (enemy.prey !== 'bearer' || inv.seat === enemy.bearerSeat))) {
      const target = hunterStep(state, enemy)
      if (target && !dreamGateEntryError(null, state.locations.find(location => location.id === target))) relocateEnemy(state, enemy, target, events, {cause:'hunter',phaseInstance:state.phaseInstance,routeSelected:true})
    }
  }
  autoEngageAll(state, events)
  let attacked = false
  for (const member of swarmGroup(state, enemy)) if (!member.exhausted && member.skipAttackRound !== state.round) {
    for (const inv of aliveInvestigators(state).filter(inv => enemiesEngagedWith(state, inv).includes(member)
      || enemyAttacksAsIfEngaged(state, member, inv))) {
      if (inv.onTheLam && !member.elite) continue
      if (inv.infighting?.round === state.round && inv.infighting.phase === 'enemy' && !member.elite) continue
      if (member.attackProtection?.[inv.seat] === state.round) continue
      attacked = true
      enemyAttack(state, member, inv, events)
      if (!member.massive) break
    }
  }
  if (attacked) for (const member of swarmGroup(state, enemy)) member.exhausted = true
  return { moved: previous !== enemy.location, attacked }
}

function enemyPhase(state) {
  const events = []
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phase = 'enemy'
  state.fogMod = 0
  info(state, events, '⚔️ 敌人阶段……', { kind: 'phase', phase: 'enemy', round: state.round, text: '猎手移动 · 交战 · 敌人攻击' })
  phaseBeginningWindow(state, events)
  scenarioBehavior(state).enemyPhaseStart?.(state, scenarioRuntime(state, events))
  reactionWindow(state, 'enemyPhaseBegins', { when: 'enemyPhaseBegins', prompt: '敌人阶段开始' }, events)

  // 1) 猎手移动
  if(state.scenario?.eventWindowInstances)resolveHunterMoves(state,events)
  else for (const enemy of state.enemies.slice()) {
    if (enemy.hostId || !enemyHasHunter(state, enemy) || enemyTextBlanked(state, enemy) || enemy.engagedSeat != null || enemy.exhausted || enemy.immobile) continue
    if (scenarioBehavior(state).hunterMove?.(state, enemy, scenarioRuntime(state, events))) continue
    if (aliveInvestigators(state).some((inv) => inv.location === enemy.location && (enemy.prey !== 'bearer' || inv.seat === enemy.bearerSeat))) continue
    const target = hunterStep(state, enemy)
    if (target && dreamGateEntryError(null, state.locations.find(location => location.id === target))) continue
    if (target && target !== enemy.location) {
      const prev = enemy.location
      relocateEnemy(state, enemy, target, events, {cause:'hunter',phaseInstance:state.phaseInstance})
      info(state, events, `「${enemy.name}」从「${locName(state, prev)}」移动到「${locName(state, target)}」。`, {
        kind: 'automatic', phase: 'enemy', round: state.round, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code,
        name: enemy.name, text: `${enemy.name}：${locName(state, prev)} → ${locName(state, target)}`, effect: 'hunter', enemyId: enemy.id, from: prev, to: target, location: target })
    }
  }
  // 2026-10-25：新增「猎手移动后」剧本钩子（05067 等「在敌人经猎手关键词移动后」的强制时点）。
  scenarioBehavior(state).enemyPhaseAfterHunters?.(state, scenarioRuntime(state, events))
  autoEngageAll(state, events)
  playerWindow(state, 'enemy.afterHunters', events)

  // Resolve each investigator's attacks in their chosen order. Massive enemies
  // attack every eligible investigator before exhausting.
  const attacked = new Set()
  const seats = [...aliveInvestigators(state)].sort((a,b) =>
    (a.seat - state.campaign.leadSeat + state.numInvestigators) % state.numInvestigators -
    (b.seat - state.campaign.leadSeat + state.numInvestigators) % state.numInvestigators)
  for (const inv of seats) {
    // 「敌军阶段期间，每个处于重整状态的古神敌人可以攻击本地点的调查员，如同其已交战」
    // （07327 缟玛瑙守卫）：未交战的本地敌人也进入本轮的待攻击名单。
    const engaged = enemiesEngagedWith(state, inv)
    const asIfEngaged = state.enemies.filter(enemy => enemyAttacksAsIfEngaged(state, enemy, inv))
    const pending = [...new Set([...engaged, ...asIfEngaged])]
      .filter(e => !e.exhausted && e.skipAttackRound !== state.round && e.attackProtection?.[inv.seat] !== state.round)
      .map(e => e.id)
    while (pending.length && !inv.defeated && !inv.resigned) {
      const candidates = pending.map(id => state.enemies.find(e => e.id === id)).filter(e => e && !e.exhausted)
      if (!candidates.length) break
      const enemy = chooseAttack(state, inv, candidates, 'enemyPhase')
      pending.splice(pending.indexOf(enemy.id), 1)
      if (inv.onTheLam && !enemy.elite) continue
      if (inv.infighting?.round === state.round && inv.infighting?.phase === 'enemy' && !enemy.elite) {
        info(state, events, `🥊 「内讧」取消了「${enemy.name}」对 ${inv.name} 的攻击。`)
        continue
      }
      const resolved = enemyAttack(state, enemy, inv, events)
      attacked.add(enemy.id)
      if (!enemy.massive && !enemy.hostId && !enemy.swarmCards?.length) enemy.exhausted = true
      checkDefeated(state, inv.seat, events)
      if (state.status !== 'playing') return events
    }
  }
  for (const enemy of state.enemies) if (attacked.has(enemy.id)) enemy.exhausted = true
  playerWindow(state, 'enemy.afterAttacks', events)
  if (hasPlayerWindow(state, 'enemyPhaseEnds')) reactionWindow(state, 'enemyPhaseEnds', playerWindowContext(state, 'enemyPhaseEnds'), events)
  for (const attachment of (state.playerLocationAttachments || []).slice()) {
    const location = attachment.location
    const owner = state.investigators[attachment.ownerSeat]
    if (registeredEntry(attachment.code)?.grantsHidingSpot
      && state.enemies.some(enemy => enemy.location === location && !enemy.exhausted)) {
      removeOne(state.playerLocationAttachments, attachment)
      owner?.discard.push(attachment.code)
      info(state, events, `「藏身地点」在敌人阶段结束时被弃置。`)
    }
    if (registeredEntry(attachment.code)?.ambushAttachment
      && !aliveInvestigators(state).some(inv => inv.location === location)) {
      removeOne(state.playerLocationAttachments, attachment)
      owner?.discard.push(attachment.code)
      info(state, events, `「埋伏」的附属地点没有调查员，被弃置。`)
    }
  }

  // 3) 密谋 3 强制（集结：敌人阶段结束食尸鬼向客厅移动）
  runAgendaForced(state, 'enemyPhaseEnd', events)
  scenarioBehavior(state).enemyPhaseEnd?.(state, scenarioRuntime(state, events))
  return events
}

function hunterRoute(state,enemy,targetIds,prompt) {
  if(targetIds.includes(enemy.location)) return null
  const targets=[...new Set(targetIds)]
  if(!targets.length)return null
  const target=targets.length===1?targets[0]:chooseAmong(state,{kind:'location',source:enemy.id,seat:leadDecisionSeat(state),
    prompt:'选择猎手的目标地点。',options:targets.map(id=>({id,label:locName(state,id)}))})
  const {destinations}=hunterRouteCandidates(state,enemy,[target],{
    ignoreBarriers:!enemyTextBlanked(state,enemy)&&registeredEntry(enemy.originalCode||enemy.code)?.enemyRule?.ignoreHunterBarriers===true,
    connections:id=>{const loc=state.locations.find(l=>l.id===id);const extra=[...(loc?.connections||[]),...(scenarioBehavior(state).enemyConnections?.(state,enemy,loc)||[])];
      // 07332 水生异怪：「移动时，完全淹没的地点视作相互连接」——路障路径（hunterRoute）同样要加这条边。
      if(registeredEntry(enemy.originalCode||enemy.code)?.enemyRule?.hunterTreatsFloodedConnected===true&&floodLevel(state,id)>=2){
        for(const other of state.locations)if(other&&other.id!==id&&floodLevel(state,other.id)>=2)extra.push(other.id)
      }
      return [...new Set(extra)]},
    canEnter:(e,id)=>enemyCanEnterLocation(state,e,id)&&(!state.locations.find(l=>l.id===id)?.barricade||e.elite)&&!dreamGateEntryError(null,state.locations.find(l=>l.id===id))
  })
  if(!destinations.length)return null
  return chooseAmong(state,{kind:'hunter',source:enemy.id,seat:leadDecisionSeat(state),prompt,
    options:destinations.map(id=>({id,label:locName(state,id)}))})
}

function resolveHunterMove(state,enemy,events=[],options={}) {
  if(!enemy||!state.enemies.includes(enemy)||enemy.hostId||!enemyHasHunter(state,enemy)||enemy.exhausted||enemy.engagedSeat!=null||enemy.immobile||enemyTextBlanked(state,enemy))return {moved:false}
  if(aliveInvestigators(state).some(inv=>inv.location===enemy.location&&(enemy.prey!=='bearer'||inv.seat===enemy.bearerSeat)&&!ruleIgnored(state,inv,'hunter')))return {moved:false}
  const target=hunterStep(state,enemy,{...options,barrierRouting:true})
  if(!target||dreamGateEntryError(null,state.locations.find(loc=>loc.id===target)))return {moved:false}
  return relocateEnemy(state,enemy,target,events,{cause:'hunter',phaseInstance:state.phaseInstance,routeSelected:true})||{moved:false}
}
function resolveHunterMoves(state,events=[],options={}) {
 const pending=state.enemies.filter(e=>!e.hostId&&enemyHasHunter(state,e)&&!e.exhausted&&e.engagedSeat==null&&!e.immobile&&!enemyTextBlanked(state,e)).map(e=>e.id),results=[]
 while(pending.length){
  const available=pending.map(id=>state.enemies.find(e=>e.id===id)).filter(Boolean)
  if(!available.length)break
  const id=available.length===1?available[0].id:chooseAmong(state,{kind:'enemy',source:options.source||'hunterMovement',seat:leadDecisionSeat(state),prompt:'选择下一个结算猎手移动的敌人。',options:available.map(e=>({id:e.id,label:e.name}))})
  if(!pending.includes(id))throw new Error('Invalid Hunter order')
  pending.splice(pending.indexOf(id),1)
  const enemy=state.enemies.find(e=>e.id===id)
  if(enemy)results.push(resolveHunterMove(state,enemy,events,options))
 }
 return {moved:results.some(r=>r.moved),results}
}

function hunterStep(state, enemy, options = {}) {
  const routeBarriers=options.barrierRouting||Object.keys(mechanicState(state)?.barriers||{}).length>0
  const loc = state.locations.find((l) => l.id === enemy.location)
  const extraConnections = scenarioBehavior(state).enemyConnections?.(state, enemy, loc) || []
  const neighbours = [...new Set([...(loc ? loc.connections : []), ...extraConnections])].filter((id) => {
    const target = state.locations.find((l) => l.id === id)
    if (!target) return false
    if (target.barricade && !enemy.elite) return false
    return true
  })
  // 07332 水生异怪：「移动时，完全淹没的地点视作相互连接」——当前地点完全淹没时，
  // 其它完全淹没地点直接进入猎手候选（仍随后经过 canEnter/路障/Dream-Gate 校验）。
  if (registeredEntry(enemy.originalCode || enemy.code)?.enemyRule?.hunterTreatsFloodedConnected === true
    && floodLevel(state, enemy.location) >= 2) {
    for (const other of state.locations) {
      const id = other?.id
      if (!id || id === enemy.location || neighbours.includes(id)) continue
      if (floodLevel(state, id) >= 2) neighbours.push(id)
    }
  }
  if (!neighbours.length) return null
  // 2026-10-25 第七轮修复 05323：地点附属的 locationLure 是真实诱饵（多诱饵取最近）。
  const lureAttachments = (state.playerLocationAttachments || [])
    .filter(attachment => registeredEntry(attachment.code)?.locationLure === true
      && (!(attachment.extra?.round ?? attachment.round) || (attachment.extra?.round ?? attachment.round) === state.round))
  const lureByAttachment = lureAttachments.length
    ? lureAttachments
      .map(attachment => ({ location: attachment.location,
        distance: distanceToInvestigator(state, enemy.location, [{ location: attachment.location }], enemy) }))
      .sort((a, b) => a.distance - b.distance)[0]
    : null
  const lure = lureByAttachment ? { id: lureByAttachment.location }
    : state.locations.find(item => item.lure?.round === state.round)
  if (lure) {
    if(routeBarriers)return hunterRoute(state,enemy,[lure.id],'选择朝诱饵移动的路线。')
    const target = [{ location: lure.id }]
    const distances = neighbours.map(id => distanceToInvestigator(state, id, target, enemy))
    const best = Math.min(...distances)
    const pool = neighbours.filter((_, index) => distances[index] === best)
    return chooseAmong(state, { kind: 'hunter', source: { type: 'enemy', code: enemy.code }, seat: leadDecisionSeat(state),
      prompt: `选择「${enemy.name}」向诱饵移动的路线。`, options: pool.map(id => ({ id, label: locName(state, id) })) })
  }
  let targets = options.targets || aliveInvestigators(state).filter(i => enemy.prey !== 'bearer' || i.seat === enemy.bearerSeat)
  // Phase 2（C1）：ignore:hunter —— 声明「敌人不把你当作猎手目标」的调查员不参与猎物计算。
  if (!options.targets) targets = targets.filter(i => !ruleIgnored(state, i, 'hunter'))
  if (!targets.length) return null
  const proximity = targets.map(i => distanceToInvestigator(state, enemy.location, [i], enemy))
  const nearest = Math.min(...proximity)
  targets = targets.filter((_, index) => proximity[index] === nearest)
  // 2026-10-25 本循环修复 hunter-step-prey-tiebreak（05087/05100）：敌人身上的猎物标记
  // （preySeat）只在「与最近调查员并列」时用于裁决目标，否则仍朝最近的调查员移动。
  // 2026-10-25 交叉复核修复 05221：并列时先问剧本 preyRank（如「猎物 - 控制最多钥匙的调查员」），
  // 卡片自身的猎物定义优先于通用猎物标记。
  if (targets.length > 1 && !enemyTextBlanked(state, enemy)) {
    const ranked = scenarioBehavior(state).preyRank?.(state, enemy, targets)
    if (Array.isArray(ranked) && ranked.length && ranked.length < targets.length) targets = ranked
    else if (Number.isInteger(enemy.preySeat)) {
      const preferred = targets.find(inv => inv.seat === enemy.preySeat)
      if (preferred) targets = [preferred]
    }
  }
  const rank = PREY_RANK[enemy.prey]
  if (rank && targets.length) {
    const best = Math.min(...targets.map(i => rank(state, i)))
    targets = targets.filter(i => rank(state, i) === best)
  }
  if(routeBarriers)return hunterRoute(state,enemy,targets.map(i=>i.location),'选择猎手移动的最短路线。')
  const distances = neighbours.map((id) => distanceToInvestigator(state, id, targets, enemy))
  const best = Math.min(...distances)
  if (!Number.isFinite(best)) return null
  const pool = neighbours.filter((_, index) => distances[index] === best)
  return chooseAmong(state, {
    kind: 'hunter', source: { type: 'enemy', code: enemy.code }, seat: leadDecisionSeat(state),
    prompt: `选择「${enemy.name}」的移动路线（多条等距路线）。`,
    options: pool.map((id) => ({ id, label: locName(state, id) })),
  })
}

function runLocationRoundEnd(state, events) {
  // 2026-10-25 第七轮修复 05323：轮末弃掉声明 discardAtRoundEnd 的地点附属。
  for (const attachment of [...(state.playerLocationAttachments || [])]) {
    if (registeredEntry(attachment.code)?.discardAtRoundEnd !== true) continue
    const index = state.playerLocationAttachments.indexOf(attachment)
    if (index >= 0) state.playerLocationAttachments.splice(index, 1)
    const owner = state.investigators[attachment.ownerSeat]
    if (owner) owner.discard.push(attachment.code)
    info(state, events, `「${cardName(attachment.code)}」在轮末被弃掉。`)
  }
  for (const loc of state.locations) {
    if (loc.lure?.round === state.round) { state.investigators[loc.lure.seat]?.discard.push(loc.lure.code); delete loc.lure }
    // 地点自己的「回合结束」规则（01156 仪式地：线索补至每人 2 个；05141 祭品场所：补到 3×人数）。
    // 2026-10-25 修复：条目可以写函数 onRoundEnd；此前引擎只读 cluesPerInvestigator 字段，
    // 05141 这类「函数写在条目里」的规则永远不会执行。
    const roundEnd = registeredEntry(loc.originalCode || loc.code)?.locationRule?.onRoundEnd
    if (typeof roundEnd === 'function') {
      roundEnd(state, loc, scenarioRuntime(state, events))
    } else if (roundEnd?.cluesPerInvestigator) {
      const target = state.numInvestigators * roundEnd.cluesPerInvestigator
      if (loc.clues < target) {
        loc.clues = target
        info(state, events, `🔍 「${loc.name}」的线索补至 ${loc.clues}。`)
      }
    }
  }
}

function runEnemyRoundEnd(state, events) {
  // 敌人「回合结束时」的强制效果由各自的 forced 描述子结算（如坚韧的黑山羊幼崽治愈 2 点）。
  const seat = leadDecisionSeat(state)
  if (seat == null) return
  for (const enemy of state.enemies.slice()) {
    triggerReaction(state, seat, 'enemyRoundEnd', events, { enemy, seat })
  }
}

function runThreatEndTurn(state, inv, events, timing = 'turn') {
  for (const t of inv.threat.slice()) {
    const th = getThreatEffect(t)
    if (!th) continue
    if (th.endTurnTest && timing === 'turn') {
      performTest(state, inv.seat, th.endTurnTest.skill, th.endTurnTest.difficulty, { source: { label: '回合结束', name: cardName(t.code), code: t.code }, resolve: r => {
        if (r.success) {
          removeThreat(state, inv, t, events)
          info(state, events, `✔️ ${inv.name} 通过检定，弃掉了「${cardName(t.code)}」。`)
        } else {
          info(state, events, `❌ ${inv.name} 未通过「${cardName(t.code)}」的回合结束检定。`)
        }
      } })
    } else if (th.forced?.onTurnEnd && timing === 'turn') {
      applyThreatForced(state, inv, t, th.forced.onTurnEnd, events)
      if (inv.defeated || inv.resigned) return
    } else if (th.roundEndDiscard && timing === 'round') {
      removeThreat(state, inv, t, events)
      info(state, events, `♻️ 「${cardName(t.code)}」在回合末被弃掉。`)
    }
  }
}

function phaseBeginningWindow(state, events) {
  if(state.scenario?.eventWindowInstances) state.phaseInstance=(state.phaseInstance||0)+1
  for (const enemy of state.enemies) if (enemy.massive && enemy.engagedSeat != null && !enemyTextBlanked(state, enemy)) disengageEnemy(state, enemy)
  // 剧本可以在每个阶段开始时结算持续/强制效果（04256 的「调查阶段开始」等）。
  scenarioBehavior(state).phaseBegan?.(state, state.phase, scenarioRuntime(state, events))
  for (const inv of aliveInvestigators(state)) triggerReaction(state, inv.seat, 'phaseBegins', events, {})
  reactionWindow(state, 'phaseBegins', { when: 'phaseBegins', prompt: '阶段开始' }, events)
}

function turnBeginningWindow(state, events) {
  const inv = state.investigators[state.currentSeat]
  state.turnSerial = (state.turnSerial || 0) + 1
  if (inv) {
    inv.turnEnded = false
    inv.actionsTakenThisTurn = 0
    resetTskTurnTracking(state, inv)
    for (const asset of inv.assets) delete asset.restrictedActionSpent
    // 第 5 步 P6：回合开始时清理上一回合的「法术专用额外行动」授权，再按当前毁灭标记重新授权，
    // 资源寄存支援的「放置 4 资源」也在这里结算（都是「在你的回合开始时」）。
    clearSpellCredit(inv)
    resourceBank.beginTurn(state, inv, events)
    expireEffects(state, 'startOfNextTurn')
    grantSpellCredit(state, inv, {
      blanked: investigatorTextBlanked(state, inv),
      info: text => info(state, events, text),
    })
    // P6（食梦者 · 托尼·摩尔根）：回合开始时授予「只能用于交战/攻击带赏金敌人」的额外行动。
    const restrictedRule = restrictedActionRule(inv.code, investigatorRule)
    if (restrictedRule && !investigatorTextBlanked(state, inv)) {
      clearRestrictedAction(inv, restrictedRule.kind)
      grantRestrictedAction(state, inv, restrictedRule.kind)
      info(state, events, `${inv.name} 获得 1 个${restrictedRule.kind === 'bounty' ? '只能用于交战或攻击带赏金敌人' : '受限'}的额外行动。`)
    }
    scenarioBehavior(state).turnBegins?.(state, inv, scenarioRuntime(state, events))
    // 07338 潜水服：「你忽略当前密谋的强制能力」——章节水位规则把「求取空气」作为当前密谋的
    // 强制能力结算，因此控制该资产的调查员在回合开始时不记录空气风险。
    if (state.scenario?.mechanics?.water?.air && !ignoresAgendaForced(state, inv)) beginAirTurn(state, inv.seat, { damage: state.scenario.mechanics.water.damage ?? 5 })
    // 「时间借取」：回合开始时移除所有滴答，换取等量额外行动。
    campaignBorrowedTimeTurnStart(state, inv, events)
    triggerReaction(state, inv.seat, 'turnBegins', events, { seat: inv.seat, location: inv.location })
    reactionWindow(state, 'turnBegins', { when: 'turnBegins', seat: inv.seat, location: inv.location, prompt: `${inv.name} 的回合开始` }, events)
    // 「未知的呼唤」：回合开始时选择本回合要调查的地点。
    for (const threat of inv.threat.filter(item => getThreatEffect(item)?.turnForced === 'callOfTheUnknown')) {
      const options = state.locations.filter(loc => loc.id !== inv.location)
        .map(loc => ({ id: loc.id, label: loc.name }))
      if (!options.length) continue
      threat.callTarget = requestChoice(state, { kind: 'location', source: threat.code, seat: inv.seat,
        prompt: '「未知的呼唤」：选择本回合必须成功调查的地点。', options })
      info(state, events, `「${cardName(threat.code)}」：${inv.name} 本回合必须成功调查「${locName(state, threat.callTarget)}」。`)
    }
  }
}

function beginInvestigationPhase(state, events, repeated = false) {
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phaseActionCount = 0
  state.turnsTaken = []
  for (const inv of aliveInvestigators(state)) {
    const loss = inv.pendingActionLoss?.[state.round] || 0
    inv.actionsLeft = Math.max(0, 3 + extraActionBonus(inv) - loss)
    inv.exploreOnlyActions = Math.max(0, exploreOnlyActionBonus(inv) - loss)
    // 第 5 步 P6：「下个回合期间可以额外行动一次」（序章故事调查员的旧印）。
    if (inv.extraActionNextTurn) {
      inv.actionsLeft += 1
      delete inv.extraActionNextTurn
    }
    clearSpellCredit(inv)
    // P6（食梦者）+ P0-10：上一轮的受限额外行动额度一并清掉（回合开始会重新授予）。
    // 修复前只清「声明了 investigator.restrictedAction 的调查员」，08010 陈丽丽的
    // fightEvade 额度（08014a 发放）没有声明，跨轮残留：新回合 actionsLeft=3 被 3 点
    // 受限额度抵掉 → 普通行动可用 0。这里对所有 kind 统一按轮清理（额度本身就是
    // actionsLeft 的最后 N 个行动，actionsLeft 已被重置，残留计数只会污染可用行动数）。
    for (const kind of RESTRICTED_ACTION_KINDS) clearRestrictedAction(inv, kind)
    if (inv.pendingActionLoss) delete inv.pendingActionLoss[state.round]
  }
  // 延迟翻面标记的轮边界过期点：08013a 用过但本回合没做检定时，+5 效果随回合结束清除，
  // 标记必须同步作废，不能在之后任意一次检定中翻面（P0-10 #1）。
  clearExpiredFlipAfterTestMarkers(state)
  // Phase 1（A1）：阶段级临时修正改由 state.effects 承载，上面的 expireEffects 已经清掉，
  // 这里保留旧的 phaseStatBonus 兼容清理（外部存档/测试可能仍有该字段）。
  for (const inv of aliveInvestigators(state)) inv.phaseStatBonus = null
  state.phase = 'investigation'
  phaseBeginningWindow(state, events)
  if (aliveInvestigators(state).some(inv => investigatorRule(inv.code)?.investigationStart)) {
    reactionWindow(state, 'investigationPhaseStarts', { when: 'investigationPhaseStarts', phase: 'investigation' }, events)
  }
  // 第 5 步 P6：「强制 - 在调查阶段开始时：揭示你直觉牌库顶 1 张卡牌」。
  for (const inv of aliveInvestigators(state)) hunchDeck.reveal(state, inv, events)
  const first = chooseTurn(state)
  if (first == null) { checkOutcome(state, events); return }
  state.currentSeat = first
  info(state, events, `${repeated ? '黄金怀表重复调查阶段；' : ''}第 ${state.round} 回合 · 调查阶段开始，轮到 ${state.investigators[first].name}。`,
    { kind: 'phase', phase: 'investigation', round: state.round, text: `轮到 ${state.investigators[first].name} 行动` })
  turnBeginningWindow(state, events)
}

function runBetweenInvestigationPhases(state, events) {
  // 「调查阶段结束时」的强制能力先结算（此时还在调查阶段的收尾，敌人阶段尚未开始）。
  // 只在真有监听者时开窗：空窗口会改变重放指纹（与神话阶段结束同一口径）。
  if (hasWindowListener(state, 'investigationPhaseEnds')) {
    reactionWindow(state, 'investigationPhaseEnds', { when: 'investigationPhaseEnds', round: state.round }, events)
  }
  // 第 5 步 P6：调查阶段结束——直觉牌库顶那张没打出的牌洗回直觉牌库。
  for (const inv of aliveInvestigators(state)) hunchDeck.returnCard(state, inv, events)
  setDreamGatesAside(state, {
    choose: (inv, ids) => requestChoice(state, {
      kind: 'location', source: 'dream-gate', seat: inv.seat, prompt: '梦境之门被放在一边。选择一个已揭示地点。',
      options: ids.map(id => ({ id, label: locName(state, id) })),
    }),
    applyHorror: (game, inv, amount) => { inv.horror = (inv.horror || 0) + amount },
    info: text => info(state, events, text),
  })
  if (!useGoldPocketWatch(state, 'begin', 'enemy', events)) {
    events.push(...enemyPhase(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'enemy', events)) events.push(...enemyPhase(state))
  }
  if (state.status !== 'playing') return
  if (!useGoldPocketWatch(state, 'begin', 'upkeep', events)) {
    events.push(...upkeepPhase(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'upkeep', events)) events.push(...upkeepPhase(state))
  }
  if (state.status !== 'playing') return
  state._roundEndWindow = true
  try { checkAct(state, events) } finally { delete state._roundEndWindow }
  if (state.status !== 'playing') return
  if (useGoldPocketWatch(state, 'begin', 'mythos', events)) {
    state.phase = 'mythos'; state.round += 1
    if (hasPlayerWindow(state, 'roundStarts')) reactionWindow(state, 'roundStarts', { when: 'roundStarts' }, events)
  } else {
    events.push(...runMythos(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'mythos', events)) events.push(...runMythos(state, true))
  }
}

function doEndTurn(state, seat, events) {
  const inv = state.investigators[seat]
  clearAttackHistory(inv)
  for (const asset of inv.assets.filter(item => item.sleightOfHand?.round === state.round
    && item.sleightOfHand.turnSeat === state.currentSeat).slice()) {
    leaveAsset(state, inv, asset, events)
    putInHand(state, inv, asset.code)
  }
  inv.actionsLeft = 0
  delete inv.lolaDiscount
  info(state, events, `${inv.name} 结束了本回合的行动。`)
}

// ---------------------------------------------------------------------------
// 合法行动 / 校验
// ---------------------------------------------------------------------------

  return { runMythos, enemyPhase, resolveEnemyPhaseOf, hunterStep, resolveHunterMove, resolveHunterMoves, runLocationRoundEnd, runEnemyRoundEnd, runThreatEndTurn, phaseBeginningWindow, turnBeginningWindow, beginInvestigationPhase, runBetweenInvestigationPhases, doEndTurn }
}
