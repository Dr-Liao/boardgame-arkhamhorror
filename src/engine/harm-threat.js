import { filterHand } from './hand-icons.js'
import { attachmentTextBlanked } from './attachment-rules.js'
import { consumeHarmBonus } from './effect-state.js'
import { canLeaveControlledAsset } from './asset-departure.js'
import { putInHand } from './hand-entry.js'
// harm-threat.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 伤害 / 恐惧 / 威胁区 / 击败与淘汰：assignHarm 是唯一承伤入口。
// 读点：combat 与 api 的伤害接口、威胁区的强制效果、弱点与淘汰判定。
import { playerEffectCanAffect } from './effect-recipient.js'
import { keysOnExit } from './scenario-keys.js'
import { locationExploreExtraActions, payLocationActionCost } from './location-action-cost.js'
import { vehicleOf, leaveVehicle } from './vehicles.js'
import { mechanicState } from './mechanic-state.js'
import { roadDistance } from './map-graph.js'
import { routeDiscardToScenarioDeck } from './scenario-decks.js'
import { chooseTdcArtifactRecipient, earnedTdcArtifacts, tdcInteractionSpec } from './tdc-interactions.js'
import { hasWindowListener } from './window-listeners.js'
import { hasTrait } from './matcher.js'
import { hiddenScenarioExperience } from './hidden-rules.js'
import { emitCardAudio } from './presentation-events.js'
import { effectSourceIsPlayer } from './effect-provenance.js'
import { assetRegulationEnabled, assetTextBlanked, assetTextBlankedExceptForced } from './card-text.js'
import { concealedAt, exposeLimitPerInvestigator, exposuresThisRound, setAsideRemainingDecoys } from './tsk-concealed.js'

export function createHarmThreat(deps) {
  const {
    abilityApi,
    exileExitAssets,
    campaignState,
    ALL_TREACHERIES,
    EFFECTS,
    activeHiddenRules,
    aliveInvestigators,
    all,
    applyDamage,
    assetCapacityValue,
    assetEffect,
    assetPassiveData,
    capabilityBlocked,
    captureTableState,
    cardDef,
    cardName,
    chooseInvestigator,
    damageEnemy,
    defeatEnemy,
    discardHiddenCard,
    disengageEnemy,
    doInvestigate,
    drawCards,
    enemyEvadeValue,
    enemyFightValue,
    enemyHealth,
    finishScenario,
    getMaxHealth,
    getMaxSanity,
    getStat,
    info,
    investigateBonus,
    investigatorMoveDestinations,
    isWeaknessCode,
    leaveAsset,
    locName,
    makeRuntime,
    performTest,
    placeCluesOnLocation,
    randomValue,
    reactionWindow,
    registeredEntry,
    relocateInvestigator,
    removeOne,
    requestChoice,
    resolveEffect,
    scenarioBehavior,
    resourceBank,
    scenarioRuntime,
    shuffle,
    spendAction,
    triggerReaction,
    weaknessProfile,
  } = deps

  function hasTomeAsset(inv) {
    return inv.assets.some((a) => {
      const def = cardDef(a.code)
      return def && (def.traits || []).some((t) => t.toLowerCase() === 'tome')
    })
  }

  function getThreatEffect(cardOrCode, state = null) {
    if (state ? attachmentTextBlanked(state, cardOrCode) : cardOrCode?.textBlankTurn != null) return null
    if (cardOrCode && typeof cardOrCode === 'object' && cardOrCode.threatEffect) {
      return cardOrCode.threatEffect
    }
    const code = typeof cardOrCode === 'object' ? cardOrCode?.code : cardOrCode
    if (registeredEntry(code)?.threatEffect) return registeredEntry(code).threatEffect
    const profile = weaknessProfile(code)
    if (profile?.type === 'threat') return profile
    const t = ALL_TREACHERIES[code]
    if (t?.threatEffect) return t.threatEffect
    if (t && t.threat) return t.threat
    return null
  }

  function availableThreatAbilities(state, inv) {
    return state.investigators.filter(owner => !owner.defeated && !owner.resigned && owner.location === inv.location)
      .flatMap(owner => owner.threat.filter(card => owner.seat === inv.seat || getThreatEffect(card, state)?.sameLocationAction))
  }

  function assetsCannotReady(inv, round = null, state = null) {
    // 「蟒蛇」（04079）：下个补给阶段不能重整（标记写在调查员身上）。
    const noReadyRound = campaignState.cannotReadyRound(inv)
    if (noReadyRound != null && (round == null || noReadyRound === round)) return true
    return inv.threat.some(card => getThreatEffect(card, state)?.preventReady)
  }

  function drawBlocked(state, inv) {
    if (capabilityBlocked(state, inv, 'draw') || capabilityBlocked(state, inv, 'drawCards')) return true
    return (inv.threat || []).some(card => !attachmentTextBlanked(state, card)
      && (card.noDrawAction === true || getThreatEffect(card, state)?.noDrawAction === true))
  }

  function removeThreat(state, inv, threatCard, events, { seat = state._resolvingSeat, discard: shouldDiscard = true, force = false } = {}) {
    if (!inv.threat.includes(threatCard)) return false
    // 批次 3（12012/12098）：条目声明「不能离场」时，除强制移除外的任何路径都拒绝。
    if (!force && registeredEntry(threatCard.code)?.cannotLeavePlay === true) {
      info(state, events, `⛔ 「${cardName(threatCard.code)}」不能离场。`)
      return false
    }
    // 「死灵之书上有恐惧时不能离场」（01009）：只要还有计数器，任何离场路径都不生效。
    if (registeredEntry(threatCard.code)?.threatCannotLeaveWhileCounters && (threatCard.counters || 0) > 0) {
      info(state, events, `⛔ 「${cardName(threatCard.code)}」上还有恐惧，不能离场。`)
      return false
    }
    removeOne(inv.threat, threatCard)
    if (!shouldDiscard) return true
    if (!routeDiscardToScenarioDeck(state, threatCard.code, threatCard.discardToScenarioDeck)) {
      const discard = ALL_TREACHERIES[threatCard.code] ? state.encounterDiscard : inv.discard
      discard.push(threatCard.code)
    }
    if (Number.isSafeInteger(seat) && cardDef(threatCard.originalCode || threatCard.code)?.type === 'treachery') {
      reactionWindow(state, 'encounterCardDiscardedFromPlay', { when: 'encounterCardDiscardedFromPlay',
        seat, code: threatCard.code, targetId: threatCard.id, location: inv.location }, events, { allowNested: true })
    }
    return true
  }

  const HARM_STRATEGIES = Object.freeze(['distribute', 'self', 'assetsFirst', 'soakFirst', 'assetsOnly', 'fillOne'])

  function assignHarm(state, inv, amount, kind, events, direct, assetsFirst = false, strategy = null, priorAssignments = null,
    playerEffect = effectSourceIsPlayer(state) && !state._enemyAttackResolving) {
    if (strategy != null && !HARM_STRATEGIES.includes(strategy)) {
      throw new Error(`未知伤害分配策略 ${JSON.stringify(strategy)}（可选：${HARM_STRATEGIES.join(' / ')}）`)
    }
    if (strategy === 'self') return new Map([[inv, amount]])
    const preferAssets = assetsFirst || strategy === 'assetsFirst' || strategy === 'soakFirst' || strategy === 'assetsOnly'
    const assignments = new Map()
    const assetsInControl = [...inv.assets, ...(state.storyAssets || []).filter(asset => asset.controlledByAll)]
    const capacity = kind === 'damage' ? 'health' : 'sanity'
    const traitLimits = inv.assets.filter(asset => !assetTextBlanked(asset, inv))
      .map(asset => registeredEntry(asset.code)?.assetRule?.harmAssignmentTraitLimit).filter(Boolean)
    const voluntaryForbidden = inv.assets.filter(asset => assetRegulationEnabled(state, inv, asset))
      .flatMap(asset => registeredEntry(asset.code)?.assetRule?.voluntaryHarmForbiddenForTraits || [])
    const harmAssignable = (asset, forced = false) => (forced || !voluntaryForbidden.some(trait => hasTrait(cardDef(asset.code), trait)))
      && (playerEffect || registeredEntry(asset.code)?.assetRule?.onlyPlayerEffectHarm !== true
      || assetTextBlanked(asset, inv) || assetTextBlankedExceptForced(asset))
      && traitLimits.every(({ trait, maximum }) => {
        if (!hasTrait(cardDef(asset.code), trait)) return true
        let used = 0
        for (const assigned of [priorAssignments, assignments]) {
          for (const [target, quantity] of assigned || []) {
            if (!state.investigators.includes(target) && hasTrait(cardDef(target.code), trait)) used += quantity
          }
        }
        return used < maximum
      })
    // Allies such as Brother Xavier may soak harm dealt to other investigators at
    // their location (passive.assignHarmAtLocation).
    const soaks = direct ? [] : state.investigators
      .filter(other => other !== inv && !other.defeated && !other.resigned)
      .flatMap(other => other.assets
        // 2026-10-25 第四轮修复 05109：assignHarmAtLocation 可限定只接伤害或只接恐惧
        // （true = 两者都接；'damage' / 'horror' = 只接对应类型）。
        .filter(asset => {
          const passive = assetEffect(other, asset)?.passive?.assignHarmAtLocation
          const connected = assetEffect(other, asset)?.passive?.assignHarmConnections
            && state.locations.find(loc => loc.id === other.location)?.connections?.includes(inv.location)
          if (kind === 'damage' && asset.soakDamageAtLocation && !assetTextBlanked(asset, other, state)) return asset.location === inv.location
          return (other.location === inv.location || connected) && (passive === true || passive === kind)
        })
        .map(asset => ({ asset, owner: other })))
    const investigators = direct ? [] : investigatorsWhoCanAbsorbHarm(state, inv.location, inv)
    let locked = null
    // 2026-11-13 P1-6：09007「非直接伤害至少 1 点必须分配给受伤的旁观者」——
    // 旧实现只把 composureDamage 支援列入 mandatory 并去掉「由调查员承受」选项，玩家仍可
    // 把第 1 点分给其它支援/同地点承接者。这里强制第 1 点先落到该支援（多张 mandatory 时才询问目标）。
    let composureDamageSatisfied = false
    for (let i = 0; i < amount; i++) {
      // 「先把一张卡填满再分配下一张」（03088 毕宿五的野兽）。
      if (strategy === 'fillOne' && locked) {
        const stillOpen = locked === inv
          || (harmAssignable(locked) && assetCapacityValue(locked, capacity, state) > (locked[kind] || 0) + (assignments.get(locked) || 0))
        if (stillOpen) {
          assignments.set(locked, (assignments.get(locked) || 0) + 1)
          continue
        }
        locked = null
      }
      // 「时间尽头」允许把直接伤害/直接恐惧分配给自己，其余支援不能承接直接伤害。
      const directSoaks = direct
        ? inv.assets.filter(asset => assetPassiveData(asset.code)?.assignDirectHarm
          && harmAssignable(asset)
          && assetCapacityValue(asset, capacity, state) > (asset[kind] || 0) + (assignments.get(asset) || 0))
        : []
      let assets = direct ? directSoaks
        : assetsInControl.filter(asset => (!asset.soakDamageAtLocation || asset.location === inv.location)
          && harmAssignable(asset) && assetCapacityValue(asset, capacity, state) > (asset[kind] || 0) + (assignments.get(asset) || 0))
      // Phase 5（5b-7）：「沉静」与「redirectOneHorrorToSelf」也可以写在能力层条目上（读点走 assetEffect）。
      // P6（08056/08081）：「非直接伤害/恐惧都必须先分配给该支援」——沉静从「仅恐惧」扩展到伤害。
      // 声明放在条目 `flags.composureDamage: true`（flags 是注册表白名单里的通用透传字段，
      // 不新造状态字段；命中后伤害与恐惧都进入 mandatory 分配，必须在该支援填满后才轮到调查员）。
      const composureDamage = asset => registeredEntry(asset.code)?.flags?.composureDamage === true
      // 2026-11-13 P1-6：09007「非直接伤害至少 1 点必须分配给受伤的旁观者」。第 1 点只提供
      // composureDamage 支援作为候选（不提供 self / 其它支援）；其余点数恢复正常分配。
      const forcedFirst = kind === 'damage' && !direct && !composureDamageSatisfied
        ? inv.assets.filter(asset => composureDamage(asset) && harmAssignable(asset, true)
          && assetCapacityValue(asset, capacity, state) > (asset[kind] || 0) + (assignments.get(asset) || 0))
        : []
      if (forcedFirst.length) assets = forcedFirst
      const mandatory = assets.filter(asset => (kind === 'horror' && (assetEffect(inv, asset)?.composure
        || (assetEffect(inv, asset)?.redirectOneHorrorToSelf && !(assignments.get(asset) > 0))))
        || (kind === 'damage' && composureDamage(asset)))
      // 2026-10-25 第七轮修复 05236：不再把候选收窄到「沉静」支援本身——其他己方支援也可先承接，
      // 只需保证在调查员卡之前（mandatory 存在时不提供「由调查员承受」选项）。
        const availableSoaks = (forcedFirst.length ? [] : soaks).filter(({ asset }) => harmAssignable(asset)
          && assetCapacityValue(asset, capacity, state) > (asset[kind] || 0) + (assignments.get(asset) || 0))
        const availableInvestigators = forcedFirst.length ? [] : investigators.filter(other =>
          (kind === 'damage' ? getMaxHealth(other) : getMaxSanity(other)) > (other[kind] || 0) + (assignments.get(other) || 0))
        const candidates = assets.length || availableSoaks.length || availableInvestigators.length
        ? requestChoice(state, { kind: 'assign-' + kind, source: 'harm', seat: inv.seat,
          prompt: `分配 1 点${kind === 'damage' ? '伤害' : '恐惧'}（剩余 ${amount - i}）。`,
          options: [...(preferAssets || mandatory?.length ? [] : [{ id: 'self', label: '由调查员承受' }]),
            ...assets.map(asset => ({ id: asset.id, label: cardName(asset.code) })),
              ...availableSoaks.map(({ asset, owner }) => ({ id: asset.id, label: `${cardName(asset.code)}（${owner.name}）` })),
              ...availableInvestigators.map(other => ({ id: `seat:${other.seat}`, label: other.name }))] })
        : 'self'
      const recipient = candidates === 'self' ? inv
          : assets.find(item => item.id === candidates) || availableSoaks.find(item => item.asset.id === candidates)?.asset
            || availableInvestigators.find(other => `seat:${other.seat}` === candidates)
      assignments.set(recipient, (assignments.get(recipient) || 0) + 1)
      if (forcedFirst.length) composureDamageSatisfied = true
      if (strategy === 'fillOne') locked = recipient
    }
    return assignments
  }

  function triggerThreatForced(state, inv, when, events, depth = 0) {
    if (depth > 4 || inv.defeated || inv.resigned) return
    for (const t of inv.threat.slice()) {
      const th = getThreatEffect(t, state)
      const fx = th && th.forced && th.forced[when]
      if (fx) applyThreatForced(state, inv, t, fx, events, depth)
    }
  }

  function applyThreatForced(state, inv, t, fx, events, depth = 0) {
    if (state.scenario?.mechanics?.protectInvestigators) return
    const playHarm = (sound, damage, horror) => emitCardAudio(state, events, {
      kind: 'cardOutcome', effects: [{ sound, targets: [{ seat: inv.seat, damage, horror, selfDamage: damage, selfHorror: horror }] }],
    })
    if (fx.damage && !inv.defeated && !inv.resigned) {
      const themed = deps.presentCardDamage?.(state, inv, null, fx.damage, events, { code: t.code, assetId: t.id, sourceSeat: inv.seat })
      inv.damage += fx.damage
      if (!themed) playHarm('injury', fx.damage, 0)
      info(state, events, `💥 「${cardName(t.code)}」强制：${inv.name} 受到 ${fx.damage} 点直接伤害。`)
      checkDefeated(state, inv.seat, events)
      if (!inv.defeated && !inv.resigned) triggerThreatForced(state, inv, 'onDamage', events, depth + 1)
    }
    if (fx.horror && !inv.defeated && !inv.resigned) {
      inv.horror += fx.horror
      playHarm('fright', 0, fx.horror)
      info(state, events, `😱 「${cardName(t.code)}」强制：${inv.name} 受到 ${fx.horror} 点直接恐惧。`)
      checkDefeated(state, inv.seat, events)
      if (!inv.defeated && !inv.resigned) triggerThreatForced(state, inv, 'onHorror', events, depth + 1)
    }
  }

  function unpaidExtraActionThreats(state, inv, kind) {
    return inv.threat.filter(card => {
      const effect = getThreatEffect(card, state)
      return effect?.extraActionCost?.includes(kind) && card.extraActionPaidRound !== state.round
    })
  }

  function payActionCost(state, inv, kind, events) {
    if (state._actionPaid) return true
    const extra = kind === 'explore' ? locationExploreExtraActions(state, inv) : 0
    const threats = unpaidExtraActionThreats(state, inv, kind)
    if (kind === 'explore' && inv.actionsLeft < 1 + extra + threats.length) return false
    for (let index = 0; index <= extra; index++) spendAction(state, inv)
    for (const threat of threats) {
      spendAction(state, inv)
      threat.extraActionPaidRound = state.round
      info(state, events, `⏳ ${inv.name} 受「${cardName(threat.code)}」影响，本次${kind === 'move' ? '移动' : kind === 'fight' ? '攻击' : '躲避'}额外消耗 1 行动。`)
    }
    return true
  }

  function defeatAll(state, events) {
    if (state.scenario?.mechanics?.protectInvestigators) return
    for (const inv of state.investigators) {
      if (!inv.defeated && !inv.resigned) inv.defeated = true
    }
    info(state, events, '💀 调查队全军覆没……')
  }

  function eliminateInvestigator(state, inv, events) {
    if (inv.doom) delete inv.doom
    exileExitAssets?.(state, inv, events)
    const record = state.campaign?.investigators?.[inv.seat]
    if (inv.defeated && !inv.resigned && registeredEntry(record?.code)?.campaignDeck?.killedOnDefeat) {
      record.status = 'killed'
    }
    keysOnExit(state, `investigator:${inv.seat}`, inv.location)
    const vehicleId = vehicleOf(state, inv.seat)
    if (vehicleId) {
      const vehicle = mechanicState(state).vehicles[vehicleId]
      const remaining = vehicle.passengers.filter(seat => seat !== inv.seat && !state.investigators[seat].defeated && !state.investigators[seat].resigned)
      const nextDriver = vehicle.driver === inv.seat && remaining.length > 1
        ? Number(requestChoice(state, { kind: 'investigator', source: vehicleId, seat: state.campaign.leadSeat ?? remaining[0],
          prompt: '选择新的驾驶者。', options: remaining.map(seat => ({ id: String(seat), label: state.investigators[seat].name })) }))
        : remaining[0] ?? null
      leaveVehicle(state, inv.seat, vehicleId, { forced: true, nextDriver })
    }
    // 04038 黑暗契约：退场（被击败/发疯/撤退都走这里）时若仍在手牌 → 移出牌库，
    // 查找收藏换成「失败的代价」。主动撤退路径在 doResign 里已先结算过（幂等）。
    for (const code of [...(inv.hand || [])]) {
      const entry = registeredEntry(code)
      if (!entry?.darkPactForced || !entry.replacementCode) continue
      filterHand(inv, item => item !== code)
      inv.deck = (inv.deck || []).filter(item => item !== code)
      inv.deck.push(entry.replacementCode)
      info(state, events, `📜 「${cardName(code)}」仍在你手中：移出牌库，换成「${cardName(entry.replacementCode)}」。`)
    }
    // 2026-10-25 第四轮修复 05012：退场时仍在手牌中的弱点 → 1 点精神创伤
    // （卡面「游戏结束或你退场时」；游戏结束分支在 campaign-flow.finishScenario 里）。
    if ((inv.hand || []).some(code => registeredEntry(code)?.traumaAtGameEndWhenInHand === true)) {
      if (state.campaign?.trauma?.[inv.seat]) state.campaign.trauma[inv.seat].mental += 1
      info(state, events, `${inv.name} 退场时手牌中的弱点令其承受 1 点精神创伤。`)
    }
    // 本地点有调查员被击败（04026 彩饰骷髅），其他调查员可触发。
    for (const other of state.investigators.filter(item =>
      item !== inv && !item.defeated && !item.resigned && item.location === inv.location)) {
      triggerReaction(state, other.seat, 'defeatAtLocation', events,
        { when: 'defeatAtLocation', kind: 'investigator', seat: other.seat, location: inv.location, defeatedSeat: inv.seat })
    }
    const hiddenExperience = hiddenScenarioExperience(inv)
    if (hiddenExperience) inv.hiddenExperienceOnElimination = hiddenExperience
    for (const code of [...(inv.hiddenCards || [])]) discardHiddenCard(state, inv, code, events)
    // Phase 5（5a-19）：「被消除时离场」的支援由条目级 discardOnElimination 声明。
    for (const asset of inv.assets.filter(item => registeredEntry(item.code)?.discardOnElimination)) {
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
    }
    for (const asset of inv.assets.slice()) {
      const policy = registeredEntry(asset.code)?.transferOnControllerDefeat
      if (!inv.defeated || inv.resigned || !policy) continue
      let targets = aliveInvestigators(state).filter(other => other !== inv)
      if (policy === 'nearest' && targets.length > 1) {
        const distances = targets.map(other => roadDistance(state.locations, inv.location, other.location))
        const nearest = Math.min(...distances)
        targets = targets.filter((_, index) => distances[index] === nearest)
      }
      if (!targets.length) continue
      const lead = state.campaign.leadSeat
      const artifact = tdcInteractionSpec(state) && earnedTdcArtifacts(state).includes(asset.originalCode || asset.code)
      const targetSeat = targets.length === 1 ? targets[0].seat : artifact
        ? chooseTdcArtifactRecipient(state, aliveInvestigators(state).some(other => other.seat === lead) ? lead : targets[0].seat,
          targets, asset.id, false)
        : Number(requestChoice(state, { kind: 'investigator',
        source: asset.code, seat: state.campaign.leadSeat ?? targets[0].seat, prompt: '将支援交给另一名调查员。',
        options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
      const target = targets.find(other => other.seat === targetSeat && !other.defeated && !other.resigned)
      if (!target || !inv.assets.includes(asset)) throw new RangeError('无效的支援接管目标')
      inv.assets.splice(inv.assets.indexOf(asset), 1)
      target.assets.push(asset)
      scenarioBehavior(state).assetControlChanged?.(state, asset, inv.seat, targetSeat, scenarioRuntime(state, events))
    }
    for (const eid of inv.engaged.slice()) {
      const enemy = state.enemies.find((e) => e.id === eid)
      if (enemy) disengageEnemy(state, enemy)
    }
    inv.engaged = []
    const handled = scenarioBehavior(state).investigatorEliminated?.(state, inv, inv.clues, scenarioRuntime(state, events))
    if (!handled) placeCluesOnLocation(state, inv, inv.clues, events)
  }

  function checkDefeated(state, seat, events) {
    const inv = state.investigators[seat]
    if (!inv || inv.defeated || inv.resigned || state.scenario?.mechanics?.protectInvestigators) return
    const lethalHidden = activeHiddenRules(state, inv).find(item =>
      Number.isFinite(item.rule.killAtHorrorOverSanityMultiplier)
        && inv.horror > getMaxSanity(inv) * item.rule.killAtHorrorOverSanityMultiplier)
    if (lethalHidden) {
      inv.defeated = true
      inv.defeatCause = 'killed'
      if (state.campaign.investigators[inv.seat]) state.campaign.investigators[inv.seat].status = 'killed'
      eliminateInvestigator(state, inv, events)
      info(state, events, `${inv.name} 因隐私牌「${cardName(lethalHidden.code)}」退场并死亡。`)
      checkOutcome(state, events)
      return
    }
    let damageLethal = inv.damage >= getMaxHealth(inv)
    let horrorLethal = inv.horror >= getMaxSanity(inv)
      && scenarioBehavior(state).investigatorCanBeDefeated?.(state, inv, 'horror') !== false
    if (damageLethal || horrorLethal) {
      if (horrorLethal) {
        triggerReaction(state, inv.seat, 'wouldDefeatByHorror', events, {
          when: 'wouldDefeatByHorror', seat: inv.seat, location: inv.location,
        })
      }
      // 致命伤害/恐惧可能发生在快速卡或反应的结算内部（state._reaction 非空）。
      // 那一层平时会拒绝再开窗口，但「将要被击败」必须例外：否则救命卡没有机会打出，
      // 调查员会在 0 行动点的同一刻被直接判定击败并结束回合。
      const outerReaction = state._reaction
      if (state._defeatWindow !== true) {
        state._defeatWindow = true
        try {
          reactionWindow(state, 'wouldDefeat', {
            when: 'wouldDefeat', seat: inv.seat, location: inv.location,
            cause: damageLethal && horrorLethal ? 'both' : damageLethal ? 'damage' : 'horror',
            prompt: `${inv.name} 将要被击败`,
          }, events, { allowNested: true })
        } finally {
          // 嵌套窗口里打出的快速卡会把 _reaction 覆盖后删除；恢复外层上下文，
          // 让外面那张卡的后续结算仍然以为自己还在反应窗口里。
          if (outerReaction) state._reaction = outerReaction
          else delete state._reaction
          delete state._defeatWindow
        }
      }
      damageLethal = inv.damage >= getMaxHealth(inv)
      horrorLethal = inv.horror >= getMaxSanity(inv)
        && scenarioBehavior(state).investigatorCanBeDefeated?.(state, inv, 'horror') !== false
      if (!damageLethal && !horrorLethal) return
    }
    if (damageLethal || horrorLethal) {
      inv.defeated = true
      // 2026-10-25 第四轮修复 05275：内容可以在致败伤害前预设 defeatCause（如 'card'），
      // 此时不要用伤害/恐惧类型覆盖（否则战役结局会补算错误的创伤类型）。
      if (!inv.defeatCause) {
        inv.defeatCause = damageLethal && horrorLethal ? 'both' : damageLethal ? 'damage' : 'horror'
      }
      eliminateInvestigator(state, inv, events)
      info(state, events, `💀 ${inv.name} 被击败了！`)
      checkOutcome(state, events)
    }
  }

  function checkOutcome(state, events) {
    if (state.status !== 'playing') return
    // 场景/密谋推进到尽头时由各自的 reveal 处理结局（resolutionChoice / agenda reveal）。
    // 这里只兜底处理「全体调查员均败退/撤退」的无结局情况（按剧本差异结算）。
    if (aliveInvestigators(state).length === 0) {
      finishScenario(state, 'noResolution', events)
    }
  }

  function disengageAll(state, seat, events) {
    const inv = state.investigators[seat]
    for (const enemyId of inv.engaged.slice()) {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (enemy && canDisengage(state, inv, enemy)) disengageEnemy(state, enemy)
    }
    info(state, events, `${inv.name} 与所有敌人解除交战。`)
  }

  function canDisengage(state, inv, enemy) {
    return scenarioBehavior(state).canDisengage?.(state, inv, enemy) !== false
  }

  function targetedTest(state, seat, effect, events) {
    const targetSeat = chooseInvestigator(state, seat, effect.target || 'location')
    const inv = state.investigators[seat]
    // 「值得信赖」：结算宿主支援的触发能力时每项技能 +1。
    const trustedBonus = (inv.assets.find(item => item.id === effect.assetId)?.attachments || [])
      .reduce((sum, entry) => sum + (registeredEntry(entry.code)?.attachedSkillBonus || 0), 0)
    return performTest(state, seat, effect.skill || 'intellect', effect.difficulty ?? 2, { source: { label: '卡牌能力', name: effect.source ? cardName(effect.source) : '目标调查员：' + state.investigators[targetSeat].name, code: effect.source }, skillBonus: trustedBonus, resolve: result => {
      const rt = makeRuntime(state, events)
      if (result.success) {
        if (effect.successEffect) resolveEffect(state, targetSeat, effect.successEffect, rt)
      } else if (effect.failEffect) {
        resolveEffect(state, targetSeat, effect.failEffect, rt)
      }
    } })
  }

  function investigateForResources(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || !payLocationActionCost(state, inv, 'investigate', requestChoice)) return
    const skill = loc.investigateSkill || 'intellect'
    const difficulty = loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0)
    return performTest(state, seat, skill, difficulty, { source: { label: '调查以获取资源', name: loc.name, code: loc.originalCode || loc.code }, skillBonus: skill === 'intellect' ? investigateBonus(inv) : 0, resolve: r => {
      if (r.success) {
        const amount = effect.amount || 3
        if (scenarioBehavior(state).canGainResources?.(state, inv) !== false) resourceBank.gainResource(state, inv, amount, events)
        info(state, events, `${inv.name} 调查成功，将发现线索改为获得 ${amount} 资源（当前 ${inv.resources}）。`)
        if (loc.fog) {
          loc.shroudMod = Math.max(0, (loc.shroudMod || 0) - 2); loc.fog = 0
          if (loc.fogCode) state.encounterDiscard.push(loc.fogCode); delete loc.fogCode
        }
        triggerReaction(state, seat, 'investigateSuccess', events, { location: loc.id, successBy: r.value - difficulty })
      } else {
        info(state, events, `${inv.name} 的调查失败，未获得资源。`)
        reactionWindow(state, 'investigateFail', { when: 'investigateFail', seat, location: loc.id,
          failedBy: r.failedBy ?? Math.max(0, difficulty-r.value), prompt: '调查检定失败后' }, events)
      }
    } })
  }

  function concealedTargetsForEffect(state, seat, locationId) {
    const inv = state.investigators[seat]
    if (!inv || inv.defeated || inv.resigned) return []
    if (!state.locations.some(location => location.id === locationId)) return []
    const limit = exposeLimitPerInvestigator(state)
    if (limit && exposuresThisRound(state, seat) >= limit) return []
    const candidates = scenarioBehavior(state).concealedTargetsByEffect?.(state, inv, locationId) ?? concealedAt(state, locationId)
    return candidates.filter(card => !card.flipped)
  }

  function concealedDamageTargets(state, seat, locationId) {
    const inv = state.investigators[seat]
    if (!inv || capabilityBlocked(state, inv, 'dealEnemyDamage')) return []
    return concealedTargetsForEffect(state, seat, locationId)
  }

  function exposeConcealedByEffect(state, seat, locationId, id, events) {
    const inv = state.investigators[seat]
    if (!concealedTargetsForEffect(state, seat, locationId).some(card => card.id === id)) return false
    const behavior = scenarioBehavior(state)
    const runtime = scenarioRuntime(state, events)
    if (behavior.exposeConcealedByEffect) {
      const mechanics = runtime.mechanics
      const concealed = mechanics.tsk.concealed
      const tsk = { ...mechanics.tsk, concealed: { ...concealed,
        expose: (id, options) => concealed.expose(id, { ...options, seat: options?.seat ?? seat }),
      } }
      const result = behavior.exposeConcealedByEffect(state, inv, id, { ...runtime, mechanics: { ...mechanics, tsk }, tsk }, locationId)
      if (result && !result.decoy && (result.enemyCode || result.code || result.enemyId || result.enemy)) {
        setAsideRemainingDecoys(state)
      }
      return Boolean(result) || !concealedAt(state, locationId).some(card => card.id === id && !card.flipped)
    }
    const revealed = abilityApi(state, events).tsk.concealed.expose(id, { seat })
    if (!revealed || revealed.cancelled) return false
    behavior.concealedCombatResolved?.(state, revealed, seat, 'fightConcealed', runtime)
    return true
  }

  function exposeConcealedInsteadOfDamage(state, seat, locationId, id, events) {
    if (!concealedDamageTargets(state, seat, locationId).some(card => card.id === id)) return false
    return exposeConcealedByEffect(state, seat, locationId, id, events)
  }

  function dealDamageAll(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const canExpose = locationId => effect.exposeConcealed ? concealedDamageTargets(state, seat, locationId) : []
    let locId = inv.location
    if (effect.location === 'choice') {
      const options = [inv.location, ...((state.locations.find(item => item.id === inv.location)?.connections) || [])]
        .filter((id, index, arr) => arr.indexOf(id) === index && state.locations.some(item => item.id === id))
        .filter(id => !effect.exposeConcealed || canExpose(id).length || state.enemies.some(enemy => enemy.location === id)
          || (effect.investigators && aliveInvestigators(state).some(target => target.location === id)))
      locId = options.length === 1 ? options[0] : requestChoice(state, {
        kind: 'target', source: effect.source || 'deal-damage-all', seat, prompt: '选择要造成伤害的地点。',
        options: options.map(id => ({ id, label: locName(state, id) })),
      })
    }
    const enemies = state.enemies.filter(enemy => enemy.location === locId)
    ;(state._resolution?.events || events).push({ type: 'presentation', kind: 'blast', fx: effect.fx || 'blast', seat, location: locId,
      name: locName(state, locId), damage: effect.amount || 3, enemyIds: enemies.map(enemy => enemy.id),
      seats: effect.investigators ? aliveInvestigators(state).filter(item => item.location === locId).map(item => item.seat) : [],
      tableState: captureTableState(state, getStat, getMaxSanity, { enemyHealth, enemyFightValue, enemyEvadeValue }) })
    const packetSource = effect.exposeConcealed || hasWindowListener(state, 'enemyWouldTakeDamage') ? effect.code : null
    for (const enemy of enemies.slice()) {
      if (!damageEnemy(state, enemy, effect.amount || 3, seat, events, packetSource, { suppressDirectCue: true })) continue
      info(state, events, `💥 「${enemy.name}」受到 ${effect.amount || 3} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
    }
    if (effect.investigators) {
      for (const target of aliveInvestigators(state).filter(item => item.location === locId)) {
        info(state, events, `💥 ${target.name} 受到 ${effect.amount || 3} 点伤害。`)
        applyDamage(state, target, effect.amount || 3, events)
      }
    }
    const concealed = canExpose(locId)
    if (!concealed.length || inv.defeated || inv.resigned) return
    const selected = requestChoice(state, { kind: 'target', source: effect.code, seat, canSkip: true,
      prompt: '可揭露目标地点的一张隐匿迷你卡。', options: [{ id: 'skip', label: '不揭露' },
        ...concealed.map((card, index) => ({ id: card.id, label: `隐匿迷你卡 ${index + 1}` }))] })
    if (selected !== 'skip') exposeConcealedInsteadOfDamage(state, seat, locId, selected, events)
  }

  function dealDamageExhausted(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && enemy.exhausted)
    if (!candidates.length) { info(state, events, '这里没有已横置的敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: effect.source || 'deal-damage-exhausted', seat, prompt: '选择已横置的敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    if (!damageEnemy(state, enemy, effect.amount || 2, seat, events, null, { code: effect.code || effect.assetId })) return
    info(state, events, `💥 「${enemy.name}」受到 ${effect.amount || 2} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
  }

  function blankEnemy(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
    if (!candidates.length) { info(state, events, '这里没有可抹消的非精英敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: effect.source || 'blank-enemy', seat, prompt: '选择要抹消文本框的非精英敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    const previous = enemy.textBlanked?.round === state.round && enemy.textBlanked?.phase === state.phase
      ? enemy.textBlanked : null
    const damagePenalty = (previous?.damagePenalty || 0) + (effect.damagePenalty || 0)
    const horrorPenalty = (previous?.horrorPenalty || 0) + (effect.horrorPenalty || 0)
    enemy.textBlanked = { round: state.round, phase: state.phase,
      ...(damagePenalty ? { damagePenalty } : {}), ...(horrorPenalty ? { horrorPenalty } : {}) }
    if (enemyHealth(state, enemy) != null && enemy.damageTaken >= enemyHealth(state, enemy)) { enemy.defeatedBy = seat; defeatEnemy(state, enemy, events) }
    info(state, events, `📖 「${enemy.name}」的印刷文本被视为空白，直到本阶段结束。`)
  }

  function ignoreChaos(state, seat, effect, events) {
    const inv = state.investigators[seat]
    inv.ignoreChaosThisTurn = true
    info(state, events, `${inv.name} 本回合执行的所有技能检定不揭示混乱标记。`)
  }

  function returnAssetToHand(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const api = abilityApi(state, events)
    const candidates = inv.assets.filter(asset => (effect.trait
      ? api.effectiveTraits(asset).some(trait => trait.toLowerCase() === effect.trait.toLowerCase())
      : asset.id === effect.assetId)
      && canLeaveControlledAsset(state, inv, asset))
    if (!candidates.length) return
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'card', source: effect.source, seat, prompt: '选择要返回手牌的支援。',
      options: candidates.map(asset => ({ id: asset.id, cardCode: asset.code, label: cardName(asset.code) })),
    })
    const asset = candidates.find(item => item.id === id)
    if (asset && api.returnAssetToHand(seat, asset, { toOwner: true })) {
      info(state, events, `${inv.name} 将「${cardName(asset.code)}」返回手牌。`)
    }
  }

  function shuffleIntoEncounter(state, seat, effect, events) {
    const inv = state.investigators[seat]
    let candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite && !isWeaknessCode(enemy.code))
    if (state._reaction?.enemy && candidates.includes(state._reaction.enemy)) candidates = [state._reaction.enemy]
    if (!candidates.length) { info(state, events, '这里没有可洗回遭遇牌库的敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: effect.source || 'shuffle-enemy', seat, prompt: '选择要洗回遭遇牌库的敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    removeOne(state.enemies, enemy)
    if (enemy.engagedSeat != null) {
      const target = state.investigators[enemy.engagedSeat]
      if (target) removeOne(target.engaged, enemy.id)
    }
    state.encounterDeck.push(enemy.code)
    state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
    info(state, events, `🌀 「${enemy.name}」被洗回遭遇牌库。`)
  }

  function moveHorrorToInvestigator(state, seat, effect, events) {
    const inv = state.investigators[seat]
    const source = state.investigators[seat].threat.find(item => item.id === effect.threatId)
    if (source && (source.counters || 0) > 0 && effect.toSeat != null) {
      source.counters -= 1
      const target = state.investigators[effect.toSeat]
      if (target) { target.horror += 1; info(state, events, `😱 将 1 点恐惧移动到 ${target.name}。`); checkDefeated(state, target.seat, events) }
    }
  }

  function damagedTargetsAtLocation(state, seat) {
    const here = state.investigators[seat].location
    return aliveInvestigators(state).filter(owner => owner.location === here).flatMap(owner => [
      ...(owner.damage > 0 ? [{ id: `investigator:${owner.seat}`, name: owner.name, target: owner }] : []),
      ...owner.assets.filter(asset => asset.damage > 0 && (cardDef(asset.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))
        .map(asset => ({ id: `asset:${asset.id}`, name: cardName(asset.code), target: asset })),
    ])
  }

  function healDamageAtLocation(state, seat, amount, events) {
    const targets = damagedTargetsAtLocation(state, seat)
    if (!targets.length) return
    const id = targets.length === 1 ? targets[0].id : requestChoice(state, {
      kind: 'target', source: 'healDamageAtLocation', seat, prompt: '选择同地点的调查员或盟友，治疗伤害。',
      options: targets.map(target => ({ id: target.id, label: target.name })),
    })
    const chosen = targets.find(target => target.id === id)
    if (chosen) {
      const healed = Math.min(amount, chosen.target.damage)
      chosen.target.damage -= healed
      info(state, events, `${chosen.name} 治疗了 ${healed} 点伤害。`)
    }
  }

  function recordResearch(state, key) {
    state.campaign.records ||= {}
    state.campaign.records[key] = true
    for (const record of Object.values(state.campaign.investigators)) {
      record.research ||= {}
      record.research[key] = true
    }
  }

  function researchSolution(state, seat, assetId, events) {
    const inv = state.investigators[seat]
    // Phase 5（5a-9）：研究能力只按实例 id 找支援（调用方就是这张卡的能力），不再写死卡号。
    const asset = inv.assets.find(item => item.id === assetId)
    if (!asset) throw new Error('奇异溶液必须在场才能研究')
    // 「值得信赖」：结算宿主支援的触发能力时每项技能 +1。
    const trustedBonus = (asset.attachments || [])
      .reduce((sum, entry) => sum + (registeredEntry(entry.code)?.attachedSkillBonus || 0), 0)
    return performTest(state, seat, 'intellect', 4, { source: { label: '研究', name: cardName(asset.code), code: asset.code }, skillBonus: trustedBonus, resolve: result => {
      if (!result.success) return
      recordResearch(state, 'identifiedStrangeSolution')
      leaveAsset(state, inv, asset, events)
      inv.discard.push(asset.code)
      for (const line of drawCards(state, inv, 2, events)) info(state, events, line)
      info(state, events, `${inv.name} 鉴定了奇异溶液；该研究记录已保存到战役。`)
    } })
  }

  function healHorrorNearby(state, seat, amount, events, sourceCode = null) {
    const inv = state.investigators[seat]
    const connections = state.locations.find(loc => loc.id === inv.location)?.connections || []
    const targets = aliveInvestigators(state).filter(other => other.horror > 0
      && (other.location === inv.location || connections.includes(other.location)))
    if (!targets.length) return
    const id = targets.length === 1 ? String(targets[0].seat) : requestChoice(state, {
      kind: 'target', source: sourceCode || 'healHorrorNearby', seat, prompt: '选择本地点或连接地点的一名调查员，治疗 1 点恐惧。',
      options: targets.map(target => ({ id: String(target.seat), label: target.name })),
    })
    const target = targets.find(item => String(item.seat) === id)
    if (target) {
      // 旧文案逐字保留（会进 state.log 与重放指纹）：治疗本身走统一入口，只是不重复打日志。
      target.horror = Math.max(0, target.horror - amount)
      info(state, events, `${target.name} 治疗 ${amount} 点恐惧。`)
      reactionWindow(state, 'horrorHealed', {
        when: 'horrorHealed', seat, cardSeat: seat, location: target.location,
        cardCode: sourceCode || null, healedSeat: target.seat, assetId: null, amount,
        prompt: `${target.name} 的恐惧被治疗 ${amount} 点`,
      }, events)
    }
  }

  // -------------------------------------------------------------------------
  // 治疗恐惧的唯一入口（第 5 步 M1 调查员批次 P6）
  //
  // 为什么要收敛：卡面「在你的卡牌效果治愈调查员或[[盟友]]支援的恐惧后」需要一个统一的事后窗口。
  // 所有治疗恐惧的卡牌效果都走这里，窗口就只需要开一次：
  //   · target 是调查员（有 seat）或支援（此时必须给 owner）；
  //   · owner.hasThreatHorrorSink 的威胁卡（「理性思考」）接管本次治疗——它自己写着
  //     「它上面的恐惧可以如同在卡洛琳身上一样被治愈 / 你不能治愈其他卡牌上的恐惧」；
  //   · 真正治疗了 ≥1 点时开 `horrorHealed` 窗口，只有治疗方（healerSeat）的卡面反应会响应。
  // -------------------------------------------------------------------------
  // 2026-10-25 第七轮修复 05007：当前正在开的 horrorHealed 窗口帧（追加治疗不重开窗口）。
  let healFrame = null

  function extendHealHorror(state, seat, amount, events = []) {
    const extra = Math.max(0, Math.floor(Number(amount) || 0))
    if (!healFrame || extra <= 0) return 0
    if (Number.isInteger(seat) && healFrame.seat !== seat) return 0
    let healed = 0
    if (healFrame.useSink && healFrame.sink && (healFrame.sink.counters || 0) > 0) {
      healed = Math.min(healFrame.sink.counters, extra)
      healFrame.sink.counters -= healed
      info(state, events, `💚 追加治疗「${cardName(healFrame.sink.code)}」上的 ${healed} 点恐惧。`)
      if (!healFrame.sink.counters) removeThreat(state, healFrame.owner, healFrame.sink, events)
    } else {
      const target = healFrame.target
      const before = target?.horror || 0
      healed = Math.min(before, extra)
      if (healed > 0) {
        target.horror = before - healed
        info(state, events, `💚 追加治疗 ${healed} 点恐惧。`)
      }
    }
    healFrame.context.amount = (healFrame.context.amount || 0) + healed
    return healed
  }

  function healOverflow(state, target, healerSeat, amount, harmKind, events) {
    if (amount > 0 && hasWindowListener(state, 'healOverflow')) reactionWindow(state, 'healOverflow', {
      when: 'healOverflow', seat: healerSeat, targetSeat: target.seat, location: target.location, amount, harmKind,
    }, events, { allowNested: true })
  }

  function healHorrorFrom(state, target, amount, events, options = {}) {
    const healedAmount = Math.max(0, Math.floor(Number(amount) || 0))
    if (!target || !healedAmount) return 0
    const isInvestigator = target.seat != null && target.name != null
    if (isInvestigator && (target.formHealingProhibited || !playerEffectCanAffect(state, target.seat))) return 0
    const owner = isInvestigator ? target : options.owner
    if (!owner) return 0
    const healerSeat = options.healerSeat ?? (Number.isInteger(state._resolvingSeat) ? state._resolvingSeat : owner.seat)
    // 2026-10-25 第七轮修复 05008：治疗发起者的「不能治愈其它卡牌恐惧」限制。
    const healer = state.investigators?.[healerSeat]
    const blockedByHealer = (healer?.threat || []).some(card => registeredEntry(card.code)?.blockHealOtherCards === true)
    const sink = (owner.threat || []).find(card => registeredEntry(card.code)?.threatHorrorSink)
    if (blockedByHealer && !isInvestigator && (!sink || target.id !== sink.id)) {
      if (options.log !== false) info(state, events, `⛔ ${healer?.name || '治疗者'} 不能治愈其他卡牌上的恐惧。`)
      return 0
    }
    // 05008：「如同在卡洛琳身上一样治愈」是可选的改道。
    let useSink = Boolean(sink && (sink.counters || 0) > 0 && !options.ignoreSink)
    if (useSink && registeredEntry(sink.code)?.redirectHeal?.optional === true && healer) {
      const answer = requestChoice(state, {
        kind: 'reaction', source: sink.code, seat: healerSeat, canSkip: true,
        prompt: `${healer.name}：是否把本次治疗改为治愈「${cardName(sink.code)}」上的恐惧？`,
        options: [{ id: 'skip', label: '不，治疗原目标' }, { id: 'redirect', label: `改为治愈「${cardName(sink.code)}」` }],
      })
      useSink = answer === 'redirect'
    }
    if (sink && useSink) {
      const healed = Math.min(sink.counters, healedAmount)
      sink.counters -= healed
      if (options.log !== false) info(state, events, `💚 ${owner.name} 治疗了「${cardName(sink.code)}」上的 ${healed} 点恐惧（剩 ${sink.counters}）。`)
      if (!sink.counters) {
        removeThreat(state, owner, sink, events)
        if (options.log !== false) info(state, events, `「${cardName(sink.code)}」上的恐惧被治愈，弃掉它。`)
      }
      // 05008 overflow:'discard'：超出该汇点的治疗量直接丢弃（不回流到其它目标）。
      if (healed < healedAmount && registeredEntry(sink.code)?.overflow === 'discard') {
        if (options.log !== false) info(state, events, `超出「${cardName(sink.code)}」剩余恐惧的 ${healedAmount - healed} 点治疗被丢弃。`)
      }
      openHealedWindow(healed, true)
      return healed
    }
    if (sink && !isInvestigator) return 0
    const before = target.horror || 0
    const offered = healedAmount + (before > 0 ? consumeHarmBonus(state, target, 'heal') : 0)
    const healed = Math.min(before, offered)
    if (isInvestigator) healOverflow(state, target, healerSeat, offered - healed, 'horror', events)
    if (!healed) return 0
    target.horror = before - healed
    if (options.log !== false) info(state, events, `💚 ${targetLabel()} 治疗了 ${healed} 点恐惧。`)
    openHealedWindow(healed, false)
    return healed

    function targetLabel() {
      return isInvestigator ? target.name : `${owner.name} 的「${cardName(target.code)}」`
    }

    function openHealedWindow(amountHealed, usedSink = false) {
      const context = {
        when: 'horrorHealed',
        seat: healerSeat,
        cardSeat: healerSeat,
        location: owner.location,
        cardCode: options.cardCode ?? state._resolvingCardCode ?? null,
        healedSeat: owner.seat,
        assetId: isInvestigator ? null : target.id,
        amount: amountHealed,
        prompt: `${owner.name} 的恐惧被治疗 ${amountHealed} 点`,
      }
      const previousFrame = healFrame
      healFrame = { seat: healerSeat, owner, target, sink: usedSink ? sink : null, useSink: usedSink, context }
      try {
        reactionWindow(state, 'horrorHealed', context, events)
      } finally {
        healFrame = previousFrame
      }
    }
  }


  // 治疗伤害的统一入口（P6 原语 `threatDamageSink`，与 healHorrorFrom 对称）
  //
  // 印刷场景（08130 臂伤 / 08131 腿伤）：「这张卡可以如同你身上的 1 点伤害被治愈
  // （如果你如此做，弃掉它）」。此前只有威胁区的 threatHorrorSink（05008）而没有伤害侧，
  // api.healDamage 只扣 inv.damage。这里收敛伤害治疗：
  //   · target 是调查员（有 seat）或支援（必须给 options.owner）；
  //   · owner.threat 里声明 `flags.threatDamageSink` 的威胁卡承接本次治疗
  //     （counters 归零时 removeThreat 并弃掉）；`options.ignoreSink` 可跳过承接；
  //   · 没有承接时按原逻辑扣 target.damage。
  //   · 八循环 P2：真正治疗 ≥1 点时开 `damageHealed` 窗口（文森特等「伤害被治愈后」读点），
  //     治疗者可显式指定（healerSeat），同一帧内的追加治疗走 extendHealDamage 不重开窗口。
  // 说明：条目的 `threatDamageSink` 会在注册期被 ability.js 拒绝（白名单暂无该键），
  // 所以本原语的声明口径是通用 `flags.threatDamageSink: true`（flags 本身已白名单透传），
  // worker 只需把字段写进 flags。
  let damageHealFrame = null

  function extendHealDamage(state, seat, amount, events = []) {
    const extra = Math.max(0, Math.floor(Number(amount) || 0))
    if (!damageHealFrame || extra <= 0) return 0
    if (Number.isInteger(seat) && damageHealFrame.seat !== seat) return 0
    let healed = 0
    if (damageHealFrame.useSink && damageHealFrame.sink && (damageHealFrame.sink.counters || 0) > 0) {
      healed = Math.min(damageHealFrame.sink.counters, extra)
      damageHealFrame.sink.counters -= healed
      info(state, events, `💚 追加治疗「${cardName(damageHealFrame.sink.code)}」上的 ${healed} 点伤害。`)
      if (!damageHealFrame.sink.counters) removeThreat(state, damageHealFrame.owner, damageHealFrame.sink, events)
    } else if (damageHealFrame.target) {
      const before = damageHealFrame.target.damage || 0
      healed = Math.min(before, extra)
      if (healed > 0) {
        damageHealFrame.target.damage = before - healed
        info(state, events, `💚 追加治疗 ${healed} 点伤害。`)
      }
    }
    damageHealFrame.context.amount = (damageHealFrame.context.amount || 0) + healed
    return healed
  }

  function healDamageFrom(state, target, amount, events, options = {}) {
    const healedAmount = Math.max(0, Math.floor(Number(amount) || 0))
    if (!target || !healedAmount) return 0
    const isInvestigator = target.seat != null && target.name != null
    if (isInvestigator && (target.formHealingProhibited || !playerEffectCanAffect(state, target.seat))) return 0
    // 批次 3（60453）：「不能治疗伤害」由条目 / 其威胁区卡上的 flags.cannotHealDamage 声明。
    if (isInvestigator && (registeredEntry(target.code)?.flags?.cannotHealDamage === true
      || (target.threat || []).some(card => registeredEntry(card.code)?.flags?.cannotHealDamage === true))) return 0
    const owner = isInvestigator ? target : options.owner
    if (!owner) return 0
    const healerSeat = options.healerSeat ?? (Number.isInteger(state._resolvingSeat) ? state._resolvingSeat : owner.seat)
    const sink = (owner.threat || []).find(card => !attachmentTextBlanked(state, card) && (card.counters || 0) > 0
      && registeredEntry(card.code)?.flags?.threatDamageSink === true)
    const optional = sink && registeredEntry(sink.code)?.redirectHeal?.optional === true
    let redirect = sink && !options.ignoreSink && (!optional || isInvestigator)
    if (redirect && optional && target.damage > 0) {
      redirect = requestChoice(state, { kind: 'target', source: sink.code, seat: healerSeat,
        prompt: '选择治疗诡计或调查员身上的伤害。',
        options: [{ id: 'treachery', label: `治疗「${cardName(sink.code)}」` }, { id: 'investigator', label: `治疗${owner.name}` }],
      }) === 'treachery'
    }
    if (redirect) {
      const healed = Math.min(sink.counters, healedAmount)
      sink.counters -= healed
      if (options.log !== false) info(state, events, `💚 ${owner.name} 治疗了「${cardName(sink.code)}」上的 ${healed} 点伤害（剩 ${sink.counters}）。`)
      if (!sink.counters) {
        removeThreat(state, owner, sink, events)
        if (options.log !== false) info(state, events, `「${cardName(sink.code)}」上的伤害被治愈，弃掉它。`)
      }
      if (healed > 0) openDamageHealedWindow(state, events, healed, true, { healerSeat, owner, target, sink, isInvestigator, options })
      return healed
    }
    const before = target.damage || 0
    const offered = healedAmount + (before > 0 ? consumeHarmBonus(state, target, 'heal') : 0)
    const healed = Math.min(before, offered)
    if (isInvestigator) healOverflow(state, target, healerSeat, offered - healed, 'damage', events)
    if (!healed) return 0
    target.damage = before - healed
    if (options.log !== false) {
      info(state, events, `💚 ${isInvestigator ? target.name : `${owner.name} 的「${cardName(target.code)}」`} 治疗了 ${healed} 点伤害。`)
    }
    openDamageHealedWindow(state, events, healed, false, { healerSeat, owner, target, sink: null, isInvestigator, options })
    return healed
  }

  function openDamageHealedWindow(state, events, amountHealed, usedSink, { healerSeat, owner, target, sink, isInvestigator, options }) {
    const context = {
      when: 'damageHealed',
      seat: healerSeat,
      cardSeat: healerSeat,
      location: owner.location,
      cardCode: options.cardCode ?? state._resolvingCardCode ?? null,
      healedSeat: owner.seat,
      assetId: isInvestigator ? null : target.id,
      amount: amountHealed,
      prompt: `${owner.name} 的伤害被治疗 ${amountHealed} 点`,
    }
    const previousFrame = damageHealFrame
    damageHealFrame = { seat: healerSeat, owner, target, sink: usedSink ? sink : null, useSink: usedSink, context }
    try {
      reactionWindow(state, 'damageHealed', context, events)
    } finally {
      damageHealFrame = previousFrame
    }
  }

  function dukeInvestigate(state, seat, events, code = null) {
    const inv = state.investigators[seat]
    const destinations = investigatorMoveDestinations(state, seat, {})
    if (destinations.length) {
      const id = requestChoice(state, { kind: 'move', source: code, seat,
        prompt: '杜克调查前是否移动到连接地点？',
        options: [{ id: 'stay', label: '留在原地调查' }, ...destinations.map(loc => ({ id: loc, label: locName(state, loc) }))] })
      if (id !== 'stay') relocateInvestigator(state, seat, id, events)
    }
    return doInvestigate(state, seat, { baseValue: 4 }, events, true)
  }

  return { hasTomeAsset, getThreatEffect, availableThreatAbilities, assetsCannotReady, drawBlocked, removeThreat, HARM_STRATEGIES, assignHarm, triggerThreatForced, applyThreatForced, unpaidExtraActionThreats, payActionCost, defeatAll, eliminateInvestigator, checkDefeated, checkOutcome, disengageAll, canDisengage, targetedTest, investigateForResources, dealDamageAll, concealedTargetsForEffect, exposeConcealedByEffect, concealedDamageTargets, exposeConcealedInsteadOfDamage, dealDamageExhausted, blankEnemy, ignoreChaos, returnAssetToHand, shuffleIntoEncounter, moveHorrorToInvestigator, damagedTargetsAtLocation, healDamageAtLocation, recordResearch, researchSolution, healHorrorNearby, healHorrorFrom, extendHealHorror, healDamageFrom, extendHealDamage, dukeInvestigate }
}
import { investigatorsWhoCanAbsorbHarm } from './harm-assignment.js'
