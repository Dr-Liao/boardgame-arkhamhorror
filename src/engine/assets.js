// assets.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 支援的生命周期与槽位：装备/替换/离场、手牌位与武器位、被动加成、
// 以及「打出的事件去哪」（牌库顶 / 弃牌堆）与反应卡打出的收尾。
export function createAssets(deps) {
  const {
    EFFECTS,
    SLOT_CAPACITY,
    abilityApi,
    assetEffect,
    blanksTraits,
    cardDef,
    cardName,
    descriptorOfKind,
    distanceToInvestigator,
    enemyRuleFlags,
    enemyTextBlanked,
    executeDescriptor,
    exilePlayerCard,
    getThreatEffect,
    info,
    leavesPlayEffect,
    makeRuntime,
    nextInstanceId,
    placeLocation,
    playCost,
    playedEffect,
    randomValue,
    reactionWindow,
    registeredEntry,
    releaseChaosTokens,
    removeEffectsFromSource,
    removeOne,
    requestChoice,
    resolveEffect,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    slotBonus,
    weaknessProfile,
    withEffectCode,
  } = deps

  function litaAuraAt(state, inv) {
    return state.investigators.some((i) => {
      if (i.location !== inv.location || i.defeated || i.resigned) return false
      const hasAura = i.assets.some((a) => registeredEntry(a.code)?.auraWhileInPlay)
      const auraBlanked = i.threat.some((t) => blanksTraits(t.code).includes('ally'))
      return hasAura && !auraBlanked
    })
  }

  function assetPassiveBonus(inv, key) {
    return (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.[key] || 0), 0)
  }

  function assetPassiveData(code) {
    return registeredEntry(code)?.passive || null
  }

  function assetCannotLeavePlay(asset) {
    return Boolean(asset?.cannotLeavePlay
      || registeredEntry(asset?.code)?.cannotLeavePlay)
  }

  function normalizedSlots(card) {
    if (!card || !Array.isArray(card.slots) || !card.slots.length) return []
    return card.slots.map((s) => {
      const key = String(s).trim().toLowerCase()
      if (key === 'hand x2') return 'handx2'
      if (key === 'arcane x2') return 'arcanex2'
      return key
    })
  }

  function slotUsage(inv) {
    const usage = {}
    for (const a of [...inv.assets, ...(inv.threat || [])]) {
      const def = cardDef(a.code)
      for (const s of normalizedSlots(Array.isArray(a.slots) && a.slots.length ? a : def)) {
        if (s === 'handx2') usage.hand = (usage.hand || 0) + 2
        else if (s === 'arcanex2') usage.arcane = (usage.arcane || 0) + 2
        else usage[s] = (usage[s] || 0) + 1
      }
    }
    // 2026-10-25：05009「最多 2 张[[工具]]支援不占用手部槽位」由条目级 toolHandSlotsExempt 声明。
    // 在占用统计里扣掉对应数量的工具手槽；canEquip 的容量比较因此自动生效。
    const exemptLimit = [...inv.assets, ...(inv.threat || [])]
      .reduce((sum, a) => sum + (registeredEntry(a.code)?.toolHandSlotsExempt || 0), 0)
    if (exemptLimit > 0 && usage.hand) {
      const toolHandSlots = [...inv.assets, ...(inv.threat || [])].reduce((sum, a) => {
        const def = cardDef(a.code)
        const isTool = (def?.traits || []).some(trait => String(trait).toLowerCase() === 'tool')
        if (!isTool) return sum
        return sum + normalizedSlots(Array.isArray(a.slots) && a.slots.length ? a : def)
          .reduce((count, slot) => count + (slot === 'handx2' ? 2 : slot === 'hand' ? 1 : 0), 0)
      }, 0)
      usage.hand = Math.max(0, usage.hand - Math.min(exemptLimit, toolHandSlots))
    }
    return usage
  }

  // 2026-10-25 第七轮修复 05112：受限额外槽——条目声明 restrictedSlots:[{slot,traitsAny,count}]，
  // 只有特性命中的卡能使用该额外容量；受限占用不计入普通槽位。
  function restrictedSlotInfo(inv, slot, cardCode) {
    const controlled = [...(inv.assets || []), ...(inv.threat || [])]
    const traitsOf = code => (cardDef(code)?.traits || []).map(trait => String(trait).toLowerCase())
    let capacity = 0
    const traitsAny = []
    for (const holder of controlled) {
      const spec = registeredEntry(holder.code)?.restrictedSlots
      for (const entry of (Array.isArray(spec) ? spec : spec ? [spec] : [])) {
        if (!entry || entry.slot !== slot) continue
        capacity += Math.max(1, Number(entry.count) || 1)
        for (const trait of entry.traitsAny || []) traitsAny.push(String(trait).toLowerCase())
      }
    }
    if (!capacity) return { capacity: 0, occupancy: 0, eligible: false, traitsAny }
    const eligible = Boolean(cardCode) && traitsOf(cardCode).some(trait => traitsAny.includes(trait))
    let occupancy = 0
    for (const asset of controlled) {
      const slots = normalizedSlots(Array.isArray(asset.slots) && asset.slots.length ? asset : cardDef(asset.code))
      if (!slots.includes(slot)) continue
      if (traitsOf(asset.code).some(trait => traitsAny.includes(trait))) occupancy += 1
    }
    return { capacity, occupancy: Math.min(occupancy, capacity), eligible, traitsAny }
  }

  function canEquip(inv, card) {
    const need = {}
    for (const s of normalizedSlots(card)) {
      if (s === 'handx2') need.hand = (need.hand || 0) + 2
      else if (s === 'arcanex2') need.arcane = (need.arcane || 0) + 2
      else need[s] = (need[s] || 0) + 1
    }
    // 米奇·布朗：额外 2 个只能携带非独特盟友的盟友槽位。
    // 盟友槽要区分「不受限」与「只能放非独特盟友」两类：独特盟友只能占前者，
    // 总数则两类都能用；否则与「魅力超凡」这类通用加槽叠加时会误判槽位已满。
    if (need.ally && !allySlotsOk(inv, card, allySlotCapacities(inv))) return false
    const usage = slotUsage(inv)
    // Allocate Tomes to Daisy's restricted slots before counting ordinary hands.
    // Otherwise playing a non-Tome after two books incorrectly forces a discard.
    const tomeHands = [...inv.assets, ...(inv.threat || []), { code: card.code }]
      .reduce((n, item) => {
        const def = cardDef(item.code)
        return n + (isTomeCard(def) ? normalizedSlots(def).reduce((v, slot) => v + (slot === 'handx2' ? 2 : slot === 'hand' ? 1 : 0), 0) : 0)
      }, 0)
    // Phase 5（5a-6）：「书虫」这类「每份占用 2 个书位」的规则由条目级 tomeHandSlotsPerCopy 声明。
    const restrictedHands = inv.assets.reduce((sum, asset) => sum + (registeredEntry(asset.code)?.tomeHandSlotsPerCopy || 0), 0)
    for (const [s, n] of Object.entries(need)) {
      // 盟友槽已在上面按「独特 / 非独特」分类校验，不再走通用容量比较。
      if (s === 'ally') continue
      let cap = SLOT_CAPACITY[s] ?? 0
      if (s === 'hand') {
        cap += handSlotsBonusFor(inv, card) + Math.min(tomeHands, restrictedHands)
        // Bandolier: an extra hand slot that may only hold a [[Weapon]] asset.
        if (isWeaponCard(card)) cap += weaponHandSlotsFor(inv)
      }
      cap += (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.extraSlots?.[s] || 0), 0)
      // 能力层槽位修正（如 05112 魔法手势的额外法术槽位）。
      cap += slotBonus(inv, s)
      // 2026-10-25 第七轮修复 05112：受限额外槽（容量只给特性命中的卡；受限占用不占普通槽）。
      const restricted = restrictedSlotInfo(inv, s, card.code)
      if (restricted.eligible) cap += restricted.capacity
      const ordinaryUsage = Math.max(0, (usage[s] || 0) - restricted.occupancy)
      const totalUsage = ordinaryUsage + (restricted.eligible ? restricted.occupancy : 0)
      if (totalUsage + n > cap) return false
    }
    return true
  }

  function assetReplacementPlans(inv, card) {
    if (canEquip(inv, card)) return [[]]
    const assets = inv.assets.filter(asset => !cardDef(asset.code)?.permanent && !assetEffect(inv, asset)?.cannotDiscard)
    const plans = []
    const visit = (index, removed) => {
      if (plans.some(plan => plan.every(id => removed.includes(id)))) return
      if (canEquip({ ...inv, assets: inv.assets.filter(a => !removed.includes(a.id)) }, card)) {
        plans.push(removed); return
      }
      for (let i = index; i < assets.length; i++) visit(i + 1, [...removed, assets[i].id])
    }
    visit(0, [])
    return plans
  }

  function replaceAssets(state, inv, card, events) {
    let plans = assetReplacementPlans(inv, card)
    if (!plans.length) throw new Error('没有合法的槽位替换方案')
    const removed = []
    while (!plans.some(plan => plan.length === removed.length)) {
      const ids = [...new Set(plans.flat())].filter(id => !removed.includes(id))
      const id = requestChoice(state, { kind: 'assetReplacement', source: card.code, seat: inv.seat,
        prompt: `为「${cardName(card.code)}」腾出槽位，选择弃置资产。`,
        options: ids.map(id => ({ id, label: `弃置 ${cardName(inv.assets.find(a => a.id === id).code)}` })) })
      removed.push(id)
      plans = plans.filter(plan => removed.every(id => plan.includes(id)))
    }
    for (const asset of inv.assets.filter(a => removed.includes(a.id))) {
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
      releaseChaosTokens(state, asset.id)
      info(state, events, `${inv.name} 弃置「${cardName(asset.code)}」腾出槽位。`)
    }
    inv.assets = inv.assets.filter(a => !removed.includes(a.id))
  }

  function nonUniqueAllySlotsFor(inv) {
    return (inv.assets || []).reduce((sum, asset) =>
      sum + (assetEffect(inv, asset)?.passive?.allySlotsForNonUnique || 0), 0)
  }

  // 盟友槽容量拆成两组：
  // - unrestricted：基础槽 + 「额外盟友槽」（如 02158 魅力超凡）+ 能力层 add:slot，独特/非独特都能用；
  // - restricted：米奇·布朗这类「只可携带非独特盟友」的额外槽。
  // 读点与 canEquip 的通用容量一致：支援被动 + 能力层修正。
  function allySlotCapacities(inv) {
    const unrestricted = (SLOT_CAPACITY.ally ?? 1)
      + (inv.assets || []).reduce((sum, asset) =>
        sum + (assetEffect(inv, asset)?.passive?.extraSlots?.ally || 0), 0)
      + slotBonus(inv, 'ally')
    return { unrestricted, restricted: nonUniqueAllySlotsFor(inv) }
  }

  function allySlotsOk(inv, card, capacities = allySlotCapacities(inv)) {
    const { unrestricted, restricted } = typeof capacities === 'number'
      ? { unrestricted: allySlotCapacities(inv).unrestricted, restricted: capacities }
      : capacities
    // 2026-10-25 修复战役（本循环修复 05262-05265）：剧情支援实例可以用 slots:['none'] 覆盖印表槽位，
    // 与 slotUsage 同一优先级（实例 slots 优先于 cardDef），否则「不占盟友槽」的能力只影响容量统计、
    // 不影响盟友槽校验（allySlotsOk 直接读 cardDef 的 Ally 槽）。
    const slotsOf = item => normalizedSlots(
      item && Array.isArray(item.slots) && item.slots.length ? item : cardDef(item?.code))
    const entries = [...inv.assets, ...(inv.threat || []), { code: card.code }]
      .filter(item => slotsOf(item).includes('ally'))
    let unique = 0
    let nonUnique = 0
    for (const item of entries) {
      if (cardDef(item.code)?.unique) unique++
      else nonUnique++
    }
    // 独特盟友只能占不受限槽；所有盟友合计不能超过两类槽位之和。
    return unique <= unrestricted && unique + nonUnique <= unrestricted + restricted
  }

  function isTomeCard(card) {
    return (card?.traits || []).some(trait => {
      const key = String(trait).toLowerCase()
      return key === 'tome' || String(trait) === '书籍'
    })
  }

  function handSlotsBonusFor(inv, card) {
    let v = -(inv.handSlotsPenalty || 0)
    for (const a of inv.assets) {
      const eff = assetEffect(inv, a)
      // Phase 5（5a-7）：带「书位」的支援（书虫）不参与普通手部加成，书位单独结算。
      if (registeredEntry(a.code)?.tomeHandSlotsPerCopy) continue
      if (eff && eff.passive && eff.passive.handSlotsBonus) v += eff.passive.handSlotsBonus
    }
    return v
  }

  function isWeaponCard(card) {
    return (card?.traits || []).some(trait => {
      const key = String(trait).toLowerCase()
      return key === 'weapon' || String(trait) === '武器'
    })
  }

  function weaponHandSlotsFor(inv) {
    return (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.extraSlots?.handWeapon || 0), 0)
  }

  function isThreatWeakness(code) {
    return weaknessProfile(code)?.type === 'threat'
  }

  function leaveAsset(state, inv, asset, events = [], options = {}) {
    if (!inv.assets.includes(asset)) return
    // 2026-10-25 第七轮修复 05019：「不能离场」的支援（动态条件）拒绝一切离场路径。
    const leaveGuard = registeredEntry(asset.code)?.cannotLeavePlayWhile
    if (typeof leaveGuard === 'function' && leaveGuard(state, inv, asset) === true) {
      info(state, events, `「${cardName(asset.code)}」当前不能离场。`)
      return false
    }
    removeOne(inv.assets, asset)
    releaseChaosTokens(state, asset.id)
    // 2026-10-25 第六轮修复 05152：离场原因（'discard'/'return'/'effect'），
    // 供 assetLeavesPlay 窗口的「被弃掉后」类反应精确限定。
    const reason = options.reason ?? 'discard'
    // 来源离场：绑定在这张卡上的持续效果一起消失（Phase 1 A1）。
    for (const effect of removeEffectsFromSource(state, asset.id)) {
      if (effect.label) info(state, events, `「${effect.label}」随「${cardName(asset.code)}」离场而结束。`)
    }
    // 「如果其离场，将其从游戏中移除」（04311 第七印记的封印 / 03182a 丹尼尔·契斯特菲尔德）。
    // Phase 6（6e-16）：从条目级字段读（旧 DSL 条目回落）。
    const removeOnLeave = registeredEntry(asset.code)?.removeFromGameWhenEmpty
      || registeredEntry(asset.code)?.removeFromGameOnLeave
    if (removeOnLeave) {
      asset.removedFromGame = true
      state.removedFromGame ||= []
      if (!state.removedFromGame.includes(asset.code)) state.removedFromGame.push(asset.code)
    }
    // 离场钩子（Phase 1 的 leavesPlay kind）：数据驱动，引擎不再认识具体卡面字段。
    // 第 5 步 P7：描述子允许只带 resolve（05313/05316 的绑定副本收回走 api.bonded.return）。
    const leaveDescriptor = descriptorOfKind(asset.code, 'leavesPlay')
    if (leaveDescriptor?.resolve) {
      leaveDescriptor.resolve({
        state, inv, seat: inv.seat, source: asset, descriptor: leaveDescriptor, events, context: {},
        api: abilityApi(state, events),
      })
    } else {
      const leaveEffect = leavesPlayEffect(asset.code)
      if (leaveEffect) {
        resolveEffect(state, inv.seat, { ...leaveEffect, assetId: asset.id }, makeRuntime(state, events))
      }
    }
    scenarioBehavior(state).assetLeftPlay?.(state, inv, asset, scenarioRuntime(state, events))
    // 2026-10-25：新增「支援离场后」通用玩家卡反应窗口（05152 妥善养护：
    // 带附属升级的支援被弃置/放回后，把该支援与其升级返回手牌）。
    // context 带 asset 实例与附件数；调用方随后是否把卡放进弃牌堆由原逻辑决定。
    reactionWindow?.(state, 'assetLeavesPlay', {
      when: 'assetLeavesPlay', seat: inv.seat, location: inv.location,
      assetCode: asset.code, assetId: asset.id, asset, reason,
      upgrades: (asset.attachments || []).length,
      prompt: `「${cardName(asset.code)}」离场后`,
    }, events)
  }

  function discardRandomAsset(state, inv, events) {
    const candidates = inv.assets.filter(asset => !assetCannotLeavePlay(asset))
    if (!candidates.length) { info(state, events, `${inv.name} 没有可弃置的资产。`); return }
    const id = requestChoice(state, { kind: 'discard-asset', source: 'discard-asset', seat: inv.seat,
      prompt: '选择一件要弃置的资产。', options: candidates.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
    const a = candidates.find(asset => asset.id === id)
    leaveAsset(state, inv, a, events)
    if (!a.removedFromGame && !a.returnedToHand) inv.discard.push(a.code)
    info(state, events, `${inv.name} 弃掉了资产「${cardName(a.code)}」。`)
  }

  function placeLocationForEmptySpawn(state) {
    const deck = [...(state.explorationDeck || [])]
    const revealed = []
    let found = null
    while (deck.length) {
      const code = deck.shift()
      if (state.scenario?.locations?.[code]) { found = code; break }
      revealed.push(code)
    }
    if (!found) {
      state.explorationDeck = shuffle([...deck, ...revealed], () => randomValue(state))
      return null
    }
    placeLocation(state, found, [])
    state.explorationDeck = shuffle([...deck, ...revealed], () => randomValue(state))
    return found
  }

  function farthestLocationsFor(state, inv) {
    if (!inv) return []
    const distances = state.locations.map(loc => ({ id: loc.id, distance: distanceToInvestigator(state, loc.id, [inv]) }))
    const finite = distances.filter(item => Number.isFinite(item.distance))
    if (!finite.length) return []
    const farthest = Math.max(...finite.map(item => item.distance))
    return finite.filter(item => item.distance === farthest).map(item => item.id)
  }

  function discardLocked(state, inv) {
    return state.enemies.some(enemy => enemyRuleFlags(enemy.code).locksDiscardWhileEngaged
      && enemy.engagedSeat === inv.seat && !enemyTextBlanked(state, enemy))
  }

  function hasPlayedEventsToDeckTop(inv) {
    return (inv.assets || []).some(asset => registeredEntry(asset.code)?.playedEventsToDeckTop)
  }

  function topDiscardEvent(state, inv) {
    return hasPlayedEventsToDeckTop(inv) && !discardLocked(state, inv)
      ? inv.discard.findLast(code => cardDef(code)?.type === 'event') : null
  }

  function disposePlayedEvent(inv, code) {
    if (hasPlayedEventsToDeckTop(inv)) inv.deck.unshift(code)
    else inv.discard.push(code)
  }

  function consumePlayThreatResources(state, inv, events) {
    for (const threat of inv.threat.slice()) {
      if (!getThreatEffect(threat)?.consumeResourceAfterPlay) continue
      threat.resources = Math.max(0, (threat.resources || 0) - 1)
      if (threat.resources === 0) {
        removeOne(inv.threat, threat)
        state.encounterDiscard.push(threat.code)
        info(state, events, `「${cardName(threat.code)}」上的资源耗尽并被弃掉。`)
      }
    }
  }

  function playReactionCard(state, inv, index, context, events, fromDiscard = false, copyCode = null, fromPlanAssetId = null) {
    const plan = fromPlanAssetId && inv.assets.find(asset => asset.id === fromPlanAssetId && registeredEntry(asset.code)?.cardPlan)
    const code = plan ? plan.attached.splice(index, 1)[0]
      : fromDiscard ? inv.discard.splice(inv.discard.lastIndexOf(topDiscardEvent(state, inv)), 1)[0] : inv.hand.splice(index, 1)[0]
    if (plan) plan.exhausted = true
    const def = cardDef(copyCode || code)
    inv.resources -= playCost(state, inv, def)
    consumePlayThreatResources(state, inv, events)
    info(state, events, `⚡ ${inv.name} 快速打出「${copyCode ? `彩绘世界／${cardName(copyCode)}` : cardName(code)}」。`, { kind: 'play', seat: inv.seat, code })
    state._reaction = context
    try {
      // Phase 5（5c-8）：能力层的快速事件由描述子结算（alreadyPaid：费用与「快速打出」日志已在上面付过/写过）。
      const descriptor = descriptorOfKind(copyCode || code, 'played')
      if (descriptor) {
        executeDescriptor(state, {
          inv, source: { code }, descriptor, context, events, windowId: context.when ?? null,
          alreadyPaid: true, silent: true,
        })
      } else {
        resolveEffect(state, inv.seat, withEffectCode(playedEffect(copyCode || code), copyCode || code), makeRuntime(state, events))
      }
    } finally {
      delete state._reaction
    }
    if (copyCode && registeredEntry(code)?.copiesBeneathEvents) {
      state.removedFromGame ||= []
      state.removedFromGame.push(code)
    } else {
      // 2026-10-25 本循环修复 05018（fast-event-disposal）：快速反应事件与普通打出走同一份「打出后去向」口径。
      // 之前这里固定 disposePlayedEvent，导致 exileAfterPlay 的快速事件（05018 神秘乐曲）进了弃牌堆。
      const playedFlags = descriptorOfKind(copyCode || code, 'played') || {}
      const entryFlags = registeredEntry(copyCode || code) || {}
      const removeAfterPlay = playedFlags.removeAfterPlay === true || entryFlags.removeAfterPlay === true
      const shuffleBackAfterPlay = playedFlags.shuffleBackAfterPlay === true || entryFlags.shuffleBackAfterPlay === true
      const exileAfterPlay = playedFlags.exileAfterPlay === true || entryFlags.exileAfterPlay === true
      const addToVictory = playedFlags.addToVictory === true || entryFlags.addToVictory === true
      if (context.eventToVictory === code) {
        state.victoryDisplay.push({ id: nextInstanceId(state, 'c'), code, originalCode: code, victory: cardDef(code)?.victory || 0 })
      } else if (removeAfterPlay) {
        state.removedFromGame ||= []
        state.removedFromGame.push(code)
      } else if (addToVictory) {
        state.victoryDisplay.push({ id: nextInstanceId(state, 'c'), code, originalCode: code, victory: cardDef(code)?.victory || 0 })
        info(state, events, `💎 「${cardName(code)}」被加入胜利展示区。`)
      } else if (exileAfterPlay) exilePlayerCard(state, inv, code, events)
      else if (shuffleBackAfterPlay) inv.deck = shuffle([...inv.deck, code], () => randomValue(state))
      else if (entryFlags.keepOnPlay !== true) disposePlayedEvent(inv, code)
    }
  }

  return { litaAuraAt, assetPassiveBonus, assetPassiveData, assetCannotLeavePlay, normalizedSlots, slotUsage, canEquip, assetReplacementPlans, replaceAssets, nonUniqueAllySlotsFor, allySlotCapacities, allySlotsOk, isTomeCard, handSlotsBonusFor, isWeaponCard, weaponHandSlotsFor, isThreatWeakness, leaveAsset, discardRandomAsset, placeLocationForEmptySpawn, farthestLocationsFor, discardLocked, hasPlayedEventsToDeckTop, topDiscardEvent, disposePlayedEvent, consumePlayThreatResources, playReactionCard }
}
