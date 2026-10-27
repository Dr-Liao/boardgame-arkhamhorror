// 打牌与调查（doPlay / doInvestigate）从 engine.js 拆出的第四个模块（Phase 6 · 6d-4）。
//
// 这一批是 roadmap「按域拆分」的第二个域：出牌与调查。
// 两个函数都写 state（资源、手牌、支援入场、地点线索、事件弃置），依赖注入同 combat.js；
// 依赖清单由「engine 顶层声明 ∪ 全部 import 绑定」与函数体对比生成，
// 并**先剥掉注释**再匹配——否则注释里的「Phase 5」「C1」之类会被当成标识符混进来。

import { beginInvestigationFrame, endInvestigationFrame, investigationFrameRef } from './resolution-scope.js'
import { grantSpellCredit } from './spell-actions.js'
export function createActions(deps) {
  const {
    campaignState,
    EFFECTS,
    SKILL_NAMES,
    abilityApi,
    afterEvade,
    attachCardTo,
    attachmentTargets,
    awardLocationVictory,
    cannotPlayTypes,
    capabilityBlocked,
    entityModifierTotal,
    cardDef,
    cardName,
    charlesPayCandidate,
    chooseEnemyFrom,
    consumeItemDiscountAtLocation,
    consumePlayThreatResources,
    descriptorOfKind,
    discoverClueAt,
    disengageEnemy,
    disposePlayedEvent,
    enemiesEngagedWith,
    engagedWithClueBlocker,
    clueBlockerName,
    entersPlayEffect,
    executeDescriptor,
    exilePlayerCard,
    getStat,
    baseStatValue,
    hauntedAfterFail,
    info,
    investigateBonus,
    isWeaknessCard,
    leaveAsset,
    lolaCanUseCard,
    makeRuntime,
    newPlayerAssetInstance,
    nextInstanceId,
    performTest,
    playAccess,
    playCost,
    playedEffect,
    randomValue,
    reactionWindow,
    registeredEntry,
    removeCardByCode,
    replaceAssets,
    requestChoice,
    resolveEffect,
    scenarioBehavior,
    scenarioRuntime,
    sealChaosToken,
    shuffle,
    spendAction,
    campaignApplyPlayCost,
    campaignPlayCostPreview,
    tokenLabel,
    topDiscardEvent,
    triggerReaction,
    unique,
    withEffectCode,
  } = deps

function doPlay(state, seat, cardId, events, fromDiscard = false, noAction = false, copyCode = null, fromPlanAssetId = null, fromBackpackId = null, fromThreatId = null) {
  const inv = state.investigators[seat]
  const def = cardDef(cardId)
  const copiedDef = copyCode && registeredEntry(cardId)?.copiesBeneathEvents ? cardDef(copyCode) : null
  const playedDef = copiedDef || def
  // 2026-10-27：从威胁区打出的那张实体（05010 悬案的 playableFromThreat 通道）。
  // 支付失败/没有合法宿主/唯一冲突时原样放回威胁区。
  let removedThreatCard = null
  if (!def) return
  if (!lolaCanUseCard(inv, cardId)) return
  if (def.type === 'skill' || (isWeaknessCard(def) && !playAccess(cardId).playableWeakness)) return
  if (cannotPlayTypes(inv).has(def.type)) {
    info(state, events, `⛔ ${inv.name} 受「刺耳之声」影响，不能打出${def.type === 'asset' ? '支援' : '事件'}。`)
    return
  }
  const plan = fromPlanAssetId && inv.assets.find(asset =>
    asset.id === fromPlanAssetId && registeredEntry(asset.code)?.cardPlan && !asset.exhausted && asset.attached?.includes(cardId))
  if (plan) {
    plan.attached.splice(plan.attached.indexOf(cardId), 1)
    plan.exhausted = true
  } else if (fromDiscard) {
    // 温蒂的护身符要求弃牌堆顶；「临时武器」等标记 playableFromDiscard 的卡可在弃牌堆任意位置。
    if (playAccess(cardId).fromDiscard) {
      if (!inv.discard.includes(cardId)) return
      inv.discard.splice(inv.discard.lastIndexOf(cardId), 1)
    } else {
      if (topDiscardEvent(state, inv) !== cardId) return
      inv.discard.splice(inv.discard.lastIndexOf(cardId), 1)
    }
  } else if (fromBackpackId) {
    // 04037 背包：从附属区当作手牌打出；最后一张打完后弃掉背包。
    const bag = inv.assets.find(asset => asset.id === fromBackpackId && registeredEntry(asset.code)?.cardBackpack)
    const index = bag?.attachedCards?.indexOf(cardId) ?? -1
    if (index < 0) return
    bag.attachedCards.splice(index, 1)
    if (!bag.attachedCards.length) {
      inv.discard.push(bag.code)
      leaveAsset(state, inv, bag, events)
      info(state, events, '🎒 背包里的最后一张牌被打出，弃掉背包。')
    }
  } else if (fromThreatId) {
    // 2026-10-27：从威胁区打出（条目级 playableFromThreat，05010 悬案）。
    const index = (inv.threat || []).findIndex(card => card.id === fromThreatId)
    if (index < 0 || inv.threat[index].code !== cardId) return
    removedThreatCard = inv.threat.splice(index, 1)[0]
  } else if (!removeCardByCode(inv.hand, cardId)) return

  // 2026-10-25 修复：把「打出费用」抽成可复用步骤，附属事件（attachTo）也必须付费。
  // 之前附属分支在费用结算之前 return，05230「瞄准镜」等附属事件实测不扣资源。
  function payPlayCost() {
    // 「销赃贩子」（违法卡获得快速／已有快速则减 1 费用）与「自食其力」（幸存者事件减 2 费用）。
    const playPreview = campaignPlayCostPreview(state, inv, cardId)
    if (playPreview) {
      campaignApplyPlayCost(state, inv, playPreview, events)
      if (playPreview.noAction) noAction = true
      if (playPreview.discount) inv.playDiscount = (inv.playDiscount || 0) + playPreview.discount
    }
    const usesLolaDiscount = inv.lolaDiscount?.round === state.round && inv.lolaDiscount?.turnSeat === state.currentSeat
      && (playedDef.factions || [playedDef.klass, playedDef.klass2, playedDef.klass3].filter(Boolean)).includes(inv.lolaDiscount.role)
    // Phase 5（5a-18）：「打出时自选花费若干资源」由条目级 chooseResourceCostOnPlay 声明。
    let cost = registeredEntry(cardId)?.chooseResourceCostOnPlay
      ? Number(requestChoice(state, { kind: 'resource', source: cardId, seat,
        prompt: `选择花费多少资源，为「${cardName(cardId)}」装填等量弹药。`,
        options: Array.from({ length: inv.resources + 1 }, (_, i) => ({ id: String(i), label: `${i} 资源／${i} 弹药` })),
      })) : playCost(state, inv, playedDef)
    // 2026-10-25 第四轮修复 play-cost-interrupt（05150 黑书 / 05111 / 05277 / 05234 等）：
    // 「打出一张卡牌时」的支付前窗口。反应可在 context.costReduction 里给出减免；
    // 卡面费用本身（资源/行动）仍由条目自己结算。
    {
      const playCostContext = { when: 'beforePlayCost', seat: inv.seat, location: inv.location,
        cardCode: cardId, playedCardId: cardId, cost, costReduction: 0, costIncrease: 0,
        prompt: `打出「${cardName(cardId)}」的支付前窗口` }
      triggerReaction(state, inv.seat, 'beforePlayCost', events, playCostContext)
      reactionWindow(state, 'beforePlayCost', playCostContext, events)
      if (playCostContext.costIncrease > 0) {
        cost += playCostContext.costIncrease
        info(state, events, `「${cardName(cardId)}」的费用增加 ${playCostContext.costIncrease}（支付 ${cost} 资源）。`)
      }
      if (playCostContext.costReduction > 0) {
        cost = Math.max(0, cost - playCostContext.costReduction)
        info(state, events, `「${cardName(cardId)}」的费用减少 ${playCostContext.costReduction}（支付 ${cost} 资源）。`)
      }
    }
    campaignState.clearPlayDiscount(inv)
    delete inv.playDiscount
    let payer = inv
    if (inv.resources < cost) {
      const charles = charlesPayCandidate(state, inv, cost, playedDef)
      if (charles && requestChoice(state, {
        kind: 'resource', source: cardId, seat: charles.seat, canSkip: true,
        prompt: `${inv.name} 资源不足，是否由查尔斯·罗斯代付 ${cost} 资源？`,
        options: [{ id: 'skip', label: '不代付' }, { id: 'pay', label: '让查尔斯支付' }],
      }) === 'pay') payer = charles
    }
    if (payer.resources < cost) {
      info(state, events, `${inv.name} 资源不足，无法打出「${cardName(cardId)}」。`)
      // 2026-10-25 第五轮：支付失败时把已离手的牌放回原处（否则「合法性靠潜在减费放行、
      // 但玩家放弃/减不够」会让牌凭空消失）。
      if (fromBackpackId) {
        const bag = inv.assets.find(asset => asset.id === fromBackpackId)
        if (bag) { bag.attachedCards ||= []; bag.attachedCards.push(cardId) }
      } else if (fromPlanAssetId) {
        const planAsset = inv.assets.find(asset => asset.id === fromPlanAssetId)
        if (planAsset) { planAsset.attached ||= []; planAsset.attached.push(cardId); planAsset.exhausted = false }
      } else if (removedThreatCard) {
        inv.threat ||= []
        inv.threat.push(removedThreatCard)
      } else if (fromDiscard) {
        inv.discard.push(cardId)
      } else {
        inv.hand.push(cardId)
      }
      return { ok: false, cost }
    }
    payer.resources -= cost
    if (def.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')) {
      consumeItemDiscountAtLocation(state, inv)
    }
    consumePlayThreatResources(state, inv, events)
    if (usesLolaDiscount) delete inv.lolaDiscount
    info(state, events, `🃏 ${inv.name} 打出「${cardName(cardId)}」（花费 ${cost} 资源，剩余 ${inv.resources}）。`, { kind: 'play', seat: inv.seat, code: cardId })
    return { ok: true, cost }
  }

  // Phase 5（5b-10）：附属声明也可以写在能力层条目上。
  // 2026-10-25：05021「附属到同地点任意调查员」——kind:'investigator' 也走这条通道
  // （attachmentTargets 返回调查员对象，attachCardTo 写入 inv.attachments）。
  const attachSpec = registeredEntry(copyCode || cardId)?.attachTo
  if (attachSpec && (attachSpec.kind === 'asset' || attachSpec.kind === 'investigator')) {
    const candidates = attachmentTargets(state, inv, attachSpec, cardId)
    if (!candidates.length) {
      // 没有合法宿主：把卡放回被取出的位置（P7 顺带修：这里原本引用从未存在的
      // fromAttachmentAssetId，任何无宿主的附属事件都会 ReferenceError；004193 / 05152 会踩）。
      if (removedThreatCard) {
        inv.threat ||= []
        inv.threat.push(removedThreatCard)
      } else if (fromDiscard) inv.discard.push(cardId)
      else inv.hand.push(cardId)
      info(state, events, `没有可以附属「${cardName(cardId)}」的支援。`)
      return
    }
    const paid = payPlayCost()
    if (!paid.ok) {
      // fromThreat 的复位已在 payPlayCost 内完成（见 removedThreatCard）。
      if (!fromThreatId) {
        if (fromDiscard) inv.discard.push(cardId)
        else inv.hand.push(cardId)
      }
      return
    }
    const isInvestigatorTarget = attachSpec.kind === 'investigator'
    const chosen = candidates.length === 1 ? candidates[0].id : requestChoice(state, { kind: 'target', source: cardId, seat,
      prompt: `选择要附属「${cardName(cardId)}」的${isInvestigatorTarget ? '调查员' : '支援'}。`,
      options: candidates.map(asset => ({ id: asset.id, label: isInvestigatorTarget ? (asset.label || asset.name || cardName(asset.code)) : cardName(asset.code) })) })
    const candidate = candidates.find(asset => asset.id === chosen) || candidates[0]
    // 2026-10-25 第七轮修复 05021：attachmentTargets 对 investigator 返回包装对象，必须取真实调查员实例；
    // 此前把 attachments 写在临时包装上，commit 后丢失。
    const target = isInvestigatorTarget
      ? (candidate.investigator || state.investigators[candidate.seat] || candidate)
      : candidate
    attachCardTo(state, seat, cardId, target)
    // Phase 5（5b-10）：附带来的加值也可以写在能力层条目上。
    const onAttach = registeredEntry(cardId)?.onAttach || {}
    if (onAttach.ammo) target.uses = (target.uses || 0) + onAttach.ammo
    info(state, events, `「${cardName(cardId)}」附属到「${cardName(target.code)}」。`)
    if (!noAction) spendAction(state, inv)
    return
  }

  if (def.unique) {
    const exists = state.investigators.some((i) => i.assets.some((a) => cardDef(a.code)?.name === def.name))
    if (exists) {
      if (removedThreatCard) { inv.threat ||= []; inv.threat.push(removedThreatCard) }
      else inv.hand.push(cardId)
      info(state, events, `「${cardName(cardId)}」已在场上，不能重复打出。`)
      return
    }
  }

  if (def.type === 'asset') replaceAssets(state, inv, def, events)

  const paid = payPlayCost()
  if (!paid.ok) return
  const cost = paid.cost

  if (def.type === 'asset') {
    // Phase 5（5b-8）：资产入场时读的 passive（额外行动等）也要认条目。
    const entryPassive = registeredEntry(cardId)?.passive
    const entryFlags = registeredEntry(cardId) || {}
    const eff = {
      ...({}),
      ...(entryPassive ? { passive: entryPassive } : {}),
      ...(entryFlags.sealOnEnter ? { sealOnEnter: entryFlags.sealOnEnter } : {}),
      // Phase 6（6e-15）：选择式封印（04030/04031）也走条目级字段。
      ...(entryFlags.sealOnEnterChoice ? { sealOnEnterChoice: entryFlags.sealOnEnterChoice } : {}),
      // Phase 6（6e-14）：「入场放毁灭」搬到条目级字段（旧 DSL 条目由上面的 spread 回落）。
      ...(entryFlags.onPlayDoom != null ? { onPlayDoom: entryFlags.onPlayDoom } : {}),
    }
    const asset = newPlayerAssetInstance(state, inv, cardId)
    // Phase 5（5a-18）：「打出时自选花费并转成弹药」也由条目级 chooseResourceCostOnPlay 声明。
    if (registeredEntry(cardId)?.chooseResourceCostOnPlay) { asset.uses = cost; asset.usesType = 'ammo' }
    if (eff.onPlayDoom) asset.doom = eff.onPlayDoom
    if (eff.passive && eff.passive.extraAction && state.currentSeat === seat) inv.actionsLeft += eff.passive.extraAction
    inv.assets.push(asset)
    // 2026-10-25 第七轮修复 05006：入场即带毁灭的卡也应触发「毁灭→法术专用额度」。
    if ((asset.doom || 0) > 0) {
      grantSpellCredit(state, inv, { info: text => info(state, events, text) })
    }
    scenarioBehavior(state).assetEntered?.(state, inv, asset, scenarioRuntime(state, events))
    if (eff.sealOnEnter && state.chaosBag.includes(eff.sealOnEnter)) {
      sealChaosToken(state, eff.sealOnEnter, asset.id)
      info(state, events, `🔒 「${cardName(cardId)}」封印了 ${tokenLabel(eff.sealOnEnter)}。`)
    }
    // 封印任意标记：从混乱袋中选择一个符合条件的标记。
    if (eff.sealOnEnterChoice) {
      const symbols = ['skull', 'cultist', 'tablet', 'elderthing']
      const pool = state.chaosBag.filter(token => {
        if (Array.isArray(eff.sealOnEnterChoice)) return eff.sealOnEnterChoice.includes(token)
        if (eff.sealOnEnterChoice === 'symbol') return symbols.includes(token)
        if (eff.sealOnEnterChoice === 'nonAutofail') return token !== 'autofail'
        return true
      })
      if (pool.length) {
        const chosen = eff.sealOnEnterChoice === 'random'
          ? pool[Math.floor(randomValue(state) * pool.length)]
          : pool.length === 1 ? pool[0] : requestChoice(state, { kind: 'seal', source: cardId, seat,
            prompt: `选择要封印在「${cardName(cardId)}」上的标记。`,
            options: pool.map(token => ({ id: token, label: tokenLabel(token) })) })
        const token = pool.includes(chosen) ? chosen : pool[0]
        sealChaosToken(state, token, asset.id)
        info(state, events, `🔒 「${cardName(cardId)}」封印了 ${tokenLabel(token)}。`)
      }
    }
    info(state, events, `✔️ 「${cardName(cardId)}」已装备（${def.textZh || def.text || ''}）。`)
    // 入场即生效的支援（如「背包」「爱丽·霍洛维兹博士」）：
    // Phase 1 起走进入场钩子的唯一读点（描述子 kind: 'entersPlay'，回落旧 onEnter）。
    // Phase 5（5c-19）：描述子可以只带 resolve（效果 DSL 表达不了时），由它接管结算；
    // 读点仍是 lifecycle 的 entersPlay，引擎侧没有第二条路径（与弱点 resolve 同形）。
    const enterDescriptor = descriptorOfKind(copyCode || cardId, 'entersPlay')
    if (enterDescriptor?.resolve) {
      enterDescriptor.resolve({
        state, inv, seat, source: asset, descriptor: enterDescriptor, events, context: {},
        api: abilityApi(state, events),
      })
    } else {
      const enterEffect = entersPlayEffect(copyCode || cardId)
      if (enterEffect) {
        resolveEffect(state, seat, enterEffect, makeRuntime(state, events))
      }
    }
    triggerReaction(state, seat, 'assetEnteredPlay', events, { assetCode: cardId, assetId: asset.id, location: inv.location })
  } else if (def.type === 'event') {
    const eff = {}
    // Phase 5（5c-10）：打出后的去向（移出游戏 / 洗回牌库）也可以写在 played 描述子上。
    const playedFlags = descriptorOfKind(copyCode || cardId, 'played') || {}
    const entryFlags = registeredEntry(copyCode || cardId) || {}
    const disposal = {
      removeAfterPlay: eff.removeAfterPlay === true || playedFlags.removeAfterPlay === true || entryFlags.removeAfterPlay === true,
      shuffleBackAfterPlay: eff.shuffleBackAfterPlay === true || playedFlags.shuffleBackAfterPlay === true || entryFlags.shuffleBackAfterPlay === true,
      // Phase 5（5c-24）：打出后去向的另外三项也认 played 描述子与条目级字段（旧 DSL 仍然优先）。
      exileAfterPlay: eff.exileAfterPlay === true || playedFlags.exileAfterPlay === true || entryFlags.exileAfterPlay === true,
      addToVictory: eff.addToVictory === true || playedFlags.addToVictory === true || entryFlags.addToVictory === true,
      becomesAsset: eff.becomesAsset === true || playedFlags.becomesAsset === true || entryFlags.becomesAsset === true,
    }
    const played = withEffectCode(playedEffect(copyCode || cardId), copyCode || cardId)
    // 结算型「之后洗回牌库」：条目可在 resolve 里声明本次打出的去向（04010 走私货物）。
    delete state._playDisposal
    // Phase 2：事件卡的「played」描述子可以直接带 resolve（数据表达不了时），
    // 与 effect 数据体共用同一个读点，因此迁移一张事件卡不需要改引擎。
    const playedDescriptor = descriptorOfKind(copyCode || cardId, 'played')
    // 「临时武器」等从弃牌堆打出的事件需要知道自己来自哪里。
    const previousFromDiscard = state._fromDiscardCode
    state._fromDiscardCode = fromDiscard ? cardId : null
    try {
      if (playedDescriptor?.resolve) {
        // Phase 5（5c-35）：quietPlay 的条目复刻「数据体事件卡」的日志——旧数据体不写
        // 「使用「X」：…」这一行，迁移后若照写会改玩家可见日志、重放指纹立刻对不上（03189）。
        executeDescriptor(state, { inv, source: { code: cardId, id: cardId }, descriptor: playedDescriptor,
          context: { fromDiscard, copyCode: copyCode || null, cardId }, events,
          silent: registeredEntry(cardId)?.quietPlay === true })
      } else if (played) resolveEffect(state, seat, played, makeRuntime(state, events))
    } finally {
      if (previousFromDiscard === undefined) delete state._fromDiscardCode
      else state._fromDiscardCode = previousFromDiscard
    }
    if (state._playDisposal === 'shuffleBack') {
      disposal.shuffleBackAfterPlay = true
      disposal.fromHandShuffle = true
    }
    delete state._playDisposal
    if (copyCode && registeredEntry(cardId)?.copiesBeneathEvents) {
      state.removedFromGame ||= []
      state.removedFromGame.push(cardId)
    } else if (disposal.removeAfterPlay) {
      state.removedFromGame ||= []
      state.removedFromGame.push(cardId)
    } else if (disposal.addToVictory) {
      state.victoryDisplay.push({ id: nextInstanceId(state, 'c'), code: cardId, originalCode: cardId,
        victory: cardDef(cardId)?.victory || 0 })
      info(state, events, `💎 「${cardName(cardId)}」被加入胜利展示区。`)
    } else if (disposal.exileAfterPlay) exilePlayerCard(state, inv, cardId, events)
    else if (disposal.becomesAsset) { /* 「危险预感」等：卡牌本身留在场上，由效果创建实例。 */ }
    else if (disposal.shuffleBackAfterPlay && (fromDiscard || disposal.fromHandShuffle)) {
      inv.deck = shuffle([...inv.deck, cardId], () => randomValue(state))
      info(state, events, `「${cardName(cardId)}」洗回 ${inv.name} 的牌库。`)
    }
    // Phase 5（5a-18）：附属到地点/敌人的事件不弃掉，由效果数据里的 keepOnPlay 标记声明。
    // 条目声明 keepOnPlay，或这张牌正以「绑定」形态留在敌人身上时，不按普通事件弃掉。
    else if (registeredEntry(cardId)?.keepOnPlay !== true
      && !state.enemies.some(enemy => enemy.bindMonster?.ownerSeat === seat && enemy.bindMonster.code === cardId)) disposePlayedEvent(inv, cardId)
  }
  // 第 5 步 P7：事件打出并结算后开窗（05320 超级加倍；卡面用 api.replayPlayedCode 重放刚打出的事件）。
  // 只有事件卡开这个窗口；没有卡面挂载时 reactionWindow 是 no-op，不影响既有行为。
  if (def.type === 'event') {
    reactionWindow(state, 'eventPlayed', {
      when: 'eventPlayed', seat, cardId, cardCode: copyCode || cardId, location: inv.location,
      prompt: `${inv.name} 打出「${cardName(cardId)}」后`,
    }, events)
  }
  const traits = (playedDef.traits || []).map(trait => String(trait).toLowerCase())
  if (traits.includes('spell')) triggerReaction(state, seat, 'spellPlayed', events, { location: inv.location, cardId })
  if (!noAction) spendAction(state, inv)
}

function doInvestigate(state, seat, opts, events, noSpend) {
  const inv = state.investigators[seat]
  // Phase 2（C1）：capability:investigate。
  if (capabilityBlocked(state, inv, 'investigate')) {
    info(state, events, `⛔ ${inv.name} 受当前效果影响，不能进行调查。`)
    return
  }
  const loc = state.locations.find((l) => l.id === (opts.locationId || inv.location))
  // 剧本可以在调查前收费/拦截（04073 曲折小道：没有指南针要花 3 资源）。
  const before = scenarioBehavior(state).beforeInvestigate?.(
    state, inv, loc, scenarioRuntime(state, events))
  if (before === false) return
  if (!noSpend) spendAction(state, inv)
  if (!loc || (loc.clues <= 0 && !opts.allowNoClues)) {
    info(state, events, `${inv.name} 调查了「${loc ? loc.name : inv.location}」，但这里已经没有线索了。`)
    return
  }
  if (loc.locked) {
    info(state, events, `🔒 「${loc.name}」被上锁的门封锁，无法调查。`)
    return
  }
  const clueBlocker = engagedWithClueBlocker(state, inv)
  if (clueBlocker && !opts.noClueDiscovery) {
    info(state, events, `🎭 ${inv.name} 与「${clueBlockerName(state, clueBlocker)}」交战时不能发现线索。`)
    return
  }
  // 卡面可以改写「这次调查用哪项技能」：礼寻术（02028 / 02233）的
  // 「不使用智力，改为使用意志」通过能力效果的 `skill` 传进来，这里优先于地点的
  // 调查技能声明（地点 investigateSkill 用于「用敏捷调查」这类地点规则）。
  const skill = opts.skill || loc.investigateSkill || 'intellect'
  const temporaryShroud = campaignState.turnShroudModifier(loc, state)
    + (loc.turnShroudMod?.round === state.round && loc.turnShroudMod.turnSeat === state.currentSeat
      ? loc.turnShroudMod.amount : 0)
  // 帷幕的剧本修正：把正在调查的调查员也传进去（04182/04185 的帷幕取决于他的
  // 剩余行动/控制支援数，失落时代 P2）。D1：地点卡自己的声明式帷幕修正也在这里叠加。
  const scenarioShroud = (scenarioBehavior(state).locationShroudModifier?.(state, loc, inv) || 0)
    + entityModifierTotal(state, loc, 'locationShroud')
  // 「骷髅钥匙」：附属地点的帷幕设为 1（现在是附属条目上的声明式标记 shroudAsOne）。
  const keyed = (loc.attachments || []).some(entry => entry.shroudAsOne === true)
  const difficulty = keyed ? 1
    : loc.shroud + (loc.shroudMod || 0) + (loc.peabodyShroud || 0) + temporaryShroud + scenarioShroud + (state.fogMod || 0) + (opts.shroudMod || 0)
  const noIntellectBoost = skill === 'intellect' && loc.noIntellectBoost
  // 2026-10-25 第五轮修复 05281（交叉复核）：倍化/限制基值时用「印刷基值 + 临时基值覆盖」读点，
  // 不再直读 inv[skill]，使「把基础技能值设为 X」对 doubleBaseSkill/noIntellectBoost 也生效。
  const baseValue = opts.baseValue ?? (loc.doubleBaseSkill ? baseStatValue(state, inv, skill) * 2
    : noIntellectBoost ? baseStatValue(state, inv, skill) : undefined)

  // 「值得信赖」：结算宿主支援的触发能力时每项技能 +1。
  const trustedHost = inv.assets.find(item => item.id === opts.assetId)
  // Phase 5（5a-24）：「值得信赖」授予的每项技能 +1 由附属卡的条目字段声明。
  const trustedFreshBonus = (trustedHost?.attachments || [])
    .reduce((sum, entry) => sum + (registeredEntry(entry.code)?.attachedSkillBonus || 0), 0)
  beginInvestigationFrame({ locationId: loc.id, retarget: null })
  const testResult = performTest(state, seat, skill, difficulty, { source: { label: '调查', name: loc.name, code: loc.originalCode || loc.code }, baseValue,
    investigation: { locationId: loc.id },
    skillBonus: (noIntellectBoost ? 0 : skill === 'intellect' ? investigateBonus(inv) : 0) + (opts.bonus || 0)
      + (opts.addSkill ? getStat(state, inv, opts.addSkill) : 0) + trustedFreshBonus, resolve: r => {
    const negativeSymbol = r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))
    if (negativeSymbol && opts.symbolEndsTurn) {
      inv.actionsLeft = 0
      if (state.currentSeat === seat) inv.turnEnded = true
      info(state, events, `${inv.name} 揭示负面符号，失去所有剩余行动并结束本回合。`)
    } else if (negativeSymbol && opts.symbolActionLoss) {
      inv.actionsLeft = Math.max(0, inv.actionsLeft - opts.symbolActionLoss)
      info(state, events, `${inv.name} 揭示负面符号，失去 ${opts.symbolActionLoss} 个行动。`)
    }
    if (opts.lockpicksAssetId && r.value - difficulty < 2) {
      const lockpicks = inv.assets.find(item => item.id === opts.lockpicksAssetId)
      if (lockpicks) {
        lockpicks.uses = Math.max(0, (lockpicks.uses || 0) - 1)
        if (!lockpicks.uses) { leaveAsset(state, inv, lockpicks, events); inv.discard.push(lockpicks.code) }
      }
    }
    // 调查结果窗口（在发现线索之前）：04064 华美石室要先把线索翻成毁灭。
    const investigationReplaced = scenarioBehavior(state).investigateResult?.(state, inv, loc, r, scenarioRuntime(state, events)) === false
    if (r.success) {
      const successBy = r.value - difficulty
      // 「未知的呼唤」需要知道本回合是否成功调查了被指定的地点。
      if (inv.investigatedTurnRound !== state.round) { inv.investigatedTurnRound = state.round; inv.investigatedThisTurn = [] }
      if (!inv.investigatedThisTurn.includes(loc.id)) inv.investigatedThisTurn.push(loc.id)
      const gain = (1 + (opts.clueBonus || 0) + (r.clueBonus || 0)
        + (opts.successByClueEvery ? Math.floor(successBy / opts.successByClueEvery) : 0)) * (r.rewardMultiplier || 1)
      info(state, events, `${inv.name} 调查成功（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}）。`)
      triggerReaction(state, seat, 'investigateSuccess', events, { location: loc.id, successBy: r.value - difficulty })
      // 「改为不发现线索」的调查（02282/02283/02287）先走完调查成功窗口，再交给卡面回调。
      if (opts.onInvestigateSuccess) opts.onInvestigateSuccess(r, { state, inv, loc })
      // 2026-10-25 第七轮修复 05158：可在检定中把调查重定向到连接地点（改用该地点的隐藏值）。
      const retarget = investigationFrameRef()?.retarget || null
      const dual = investigationFrameRef()?.dual || null
      if (!opts.noClueDiscovery && !investigationReplaced) {
        if (retarget?.locationId) {
          const targetLoc = state.locations.find(l => l.id === retarget.locationId)
          discoverClueAt(state, inv, gain, events, { locationId: retarget.locationId })
          info(state, events, `🔎 ${inv.name} 改为在「${targetLoc?.name || retarget.locationId}」调查，线索在该地点被发现。`)
        } else if (dual?.locationId) {
          // 2026-10-25 第七轮修复 05322：双地点调查——原地点与所选地点各发现一次。
          discoverClueAt(state, inv, gain, events)
          discoverClueAt(state, inv, gain, events, { locationId: dual.locationId })
          const dualLoc = state.locations.find(l => l.id === dual.locationId)
          info(state, events, `🔎 ${inv.name} 同时在「${dualLoc?.name || dual.locationId}」调查，线索在该地点也被发现。`)
        } else discoverClueAt(state, inv, gain, events)
      }
      // 2026-10-25 第四轮修复 after-investigate-hook（05175 教堂阁楼等）：卡面「成功调查后」
      // 的窗口必须在发现线索之后触发（此前只有 investigateResult = 发现线索之前）。
      scenarioBehavior(state).afterInvestigate?.(state, inv, loc, r, scenarioRuntime(state, events))
      // 「古代巨石」：成功时额外发现 1 个线索、弃置自身并记录鉴定难度。
      if (opts.ancientStone) {
        discoverClueAt(state, inv, 1, events)
        // Phase 5（5a-31）：「鉴定后弃置自身」的支援由条目级 identifiedStoneOnInvestigateSuccess 声明。
        const stone = inv.assets.find(asset => registeredEntry(asset.code)?.identifiedStoneOnInvestigateSuccess)
        if (stone) { leaveAsset(state, inv, stone, events); inv.discard.push(stone.code) }
        state.campaign.records ||= {}
        state.campaign.records.identifiedTheAncientStone = r.difficulty
        info(state, events, `📜 剧本日志：你鉴定了古代巨石（难度 ${r.difficulty}）。`)
      }
      if (opts.autoEvadeOnSuccess) {
        const targets = enemiesEngagedWith(state, inv)
        if (targets.length) {
          const want = !opts.autoEvadeChoice || requestChoice(state, {
            kind: 'effect', source: loc.originalCode || loc.code, seat, canSkip: true,
            prompt: '是否自动躲避一个与你交战的敌人？',
            options: [{ id: 'skip', label: '不躲避' }, { id: 'trigger', label: '自动躲避' }],
          }) === 'trigger'
          if (want) {
            const enemy = targets.length === 1 ? targets[0]
              : chooseEnemyFrom(state, seat, targets, loc.originalCode || loc.code)
            enemy.exhausted = true; disengageEnemy(state, enemy); afterEvade(state, inv, enemy, events)
          }
        }
      }
      if (loc.fog) {
        // 朦胧之雾可以叠加：每次成功调查只吹散其中 1 张（-2 帷幕）。
        loc.fog -= 1
        loc.shroudMod = Math.max(0, (loc.shroudMod || 0) - 2)
        if (loc.fogCode) state.encounterDiscard.push(loc.fogCode)
        if (!loc.fog) {
          delete loc.fogCode
          delete loc.fog
        }
        info(state, events, `🌫️ 「${loc.name}」被成功调查，朦胧之雾消散。`)
      }
      awardLocationVictory(state, loc, events)
    } else {
      info(state, events, `🔍 ${inv.name} 调查失败（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}，标记 ${tokenLabel(r.token)}）。`)
      reactionWindow(state, 'investigateFail', { when: 'investigateFail', seat, location: loc.id, failedBy: Math.max(0, difficulty - r.value), prompt: '调查检定失败后' }, events)
      // 第四循环P2.1：闹鬼关键字——调查检定失败后结算该地点的每个闹鬼能力。
      // 攻击/躲避失败由卡面（混乱标记/敌人强制能力）显式调用 api.haunted，不在这里触发。
      hauntedAfterFail(state, seat, 'investigate', scenarioRuntime(state, events), events, { locationId: loc.id })
    }
  } })
  endInvestigationFrame()
  return testResult
}

  return { doPlay, doInvestigate }
}
