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
    quickEventView,
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

  // 占用豁免原语（05009 柯尔特）：「最多 N 张满足条件的支援不占用某类槽位」。
  // 条目声明 slotExemptions:[{ slot, traitsAny?, count }]；豁免读点只在这里。
  // extraCards 传入「正在尝试打出/装备的卡」——它还没有被控制，但装备判定必须把它
  // 一起算进豁免，否则第一张[[工具]]会按「手槽已满」被要求先弃置资产
  // （2026-10-26 修复：玩家报告柯尔特在场时打出放大镜仍触发腾槽弃牌）。
  function slotExemptionRelief(inv, extraCards = []) {
    const controlled = [...(inv.assets || []), ...(inv.threat || [])]
    const specs = []
    for (const holder of controlled) {
      const spec = registeredEntry(holder.code)?.slotExemptions
      for (const entry of (Array.isArray(spec) ? spec : spec ? [spec] : [])) {
        if (entry && entry.slot) specs.push(entry)
      }
    }
    if (!specs.length) return {}
    const items = [...controlled, ...extraCards]
    const defOf = item => (item.code ? cardDef(item.code) : item)
    const matches = (item, entry) => {
      const def = defOf(item)
      if (!def) return false
      const wanted = (entry.traitsAny || []).map(trait => String(trait).toLowerCase())
      if (!wanted.length) return true
      return (def.traits || []).some(trait => wanted.includes(String(trait).toLowerCase()))
    }
    const unitsIn = (item, slot) => {
      const def = defOf(item)
      const slots = normalizedSlots(Array.isArray(item.slots) && item.slots.length ? item : def)
      return slots.reduce((sum, s) => sum + (s === slot ? 1 : s === `${slot}x2` ? 2 : 0), 0)
    }
    const relief = {}
    for (const spec of specs) {
      const slot = String(spec.slot)
      const limit = Math.max(1, Number(spec.count) || 1)
      let used = 0
      for (const item of items) if (matches(item, spec)) used += unitsIn(item, slot)
      relief[slot] = (relief[slot] || 0) + Math.min(limit, used)
    }
    return relief
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
    // 槽位占用豁免（slotExemptions）：按槽位扣掉豁免数量，canEquip 的容量比较因此自动生效。
    for (const [slot, count] of Object.entries(slotExemptionRelief(inv))) {
      if (count > 0 && usage[slot]) usage[slot] = Math.max(0, usage[slot] - count)
    }
    return usage
  }

  // 受限额外槽的唯一读点：条目声明 restrictedSlots:[{ slot, traitsAny?, unique?, count }]。
  // 只有命中谓词的候选能使用该额外容量；受限占用不计入普通槽位。
  // - traitsAny：候选需拥有其中任一特性（01008 书位 / 02147 武器位 / 05112 法术位）；
  // - unique: false：候选必须是非独特（04006 米奇「只能放非独特盟友」这类盟友受限槽）。
  function restrictedSlotInfo(inv, slot, cardCode) {
    const controlled = [...(inv.assets || []), ...(inv.threat || [])]
    const specs = []
    for (const holder of controlled) {
      const spec = registeredEntry(holder.code)?.restrictedSlots
      for (const entry of (Array.isArray(spec) ? spec : spec ? [spec] : [])) {
        if (entry && entry.slot === slot) specs.push(entry)
      }
    }
    if (!specs.length) return { capacity: 0, occupancy: 0, eligible: false }
    const defOf = code => cardDef(code)
    const matches = (def, entry) => {
      if (!def) return false
      if (entry.unique != null && Boolean(def.unique) !== Boolean(entry.unique)) return false
      const wanted = (entry.traitsAny || []).map(trait => String(trait).toLowerCase())
      if (!wanted.length) return true
      return (def.traits || []).some(trait => wanted.includes(String(trait).toLowerCase()))
    }
    const capacity = specs.reduce((sum, entry) => sum + Math.max(1, Number(entry.count) || 1), 0)
    const eligible = Boolean(cardCode) && specs.some(entry => matches(defOf(cardCode), entry))
    let occupancy = 0
    for (const asset of controlled) {
      const slots = normalizedSlots(Array.isArray(asset.slots) && asset.slots.length ? asset : cardDef(asset.code))
      if (!slots.includes(slot)) continue
      if (specs.some(entry => matches(cardDef(asset.code), entry))) occupancy += 1
    }
    return { capacity, occupancy: Math.min(occupancy, capacity), eligible }
  }

  function canEquip(inv, card) {
    const need = {}
    for (const s of normalizedSlots(card)) {
      if (s === 'handx2') need.hand = (need.hand || 0) + 2
      else if (s === 'arcanex2') need.arcane = (need.arcane || 0) + 2
      else need[s] = (need[s] || 0) + 1
    }
    const usage = slotUsage(inv)
    // 占用豁免也要把候选卡一起算：05009 柯尔特在场打出第一张[[工具]]时，待打出的
    // 那张同样不占手槽（slotExemptionRelief 负责「在场 + 候选」的统一口径）。
    const reliefNow = slotExemptionRelief(inv)
    const reliefWithCard = slotExemptionRelief(inv, [card])
    const candidateRelief = {}
    for (const slot of new Set([...Object.keys(reliefNow), ...Object.keys(reliefWithCard)])) {
      const delta = (reliefWithCard[slot] || 0) - (reliefNow[slot] || 0)
      if (delta > 0) candidateRelief[slot] = delta
    }
    for (const [s, n] of Object.entries(need)) {
      let cap = SLOT_CAPACITY[s] ?? 0
      // 地点类「手槽惩罚」；额外槽由通用修正 + 受限额外槽两条原语统一叠加。
      if (s === 'hand') cap -= inv.handSlotsPenalty || 0
      // 通用额外槽：add:slot / slot:<slot> 修正（如 02158 魅力超凡、05283 安娜的塔罗槽）。
      cap += slotBonus(inv, s)
      // 受限额外槽的唯一读点：restrictedSlots（书位 / 武器位 / 法术位 / 非独特盟友槽）。
      // 容量只给命中谓词的候选；受限占用不占普通槽，因此还要从普通占用里扣掉 occupancy
      // （同时覆盖「候选卡是受限类型」与「在场受限卡可移入受限槽、把普通槽让给候选」）。
      const restricted = restrictedSlotInfo(inv, s, card.code)
      if (restricted.eligible) cap += restricted.capacity
      const ordinaryUsage = Math.max(0, (usage[s] || 0) - restricted.occupancy)
      let totalUsage = ordinaryUsage + (restricted.eligible ? restricted.occupancy : 0)
      if (candidateRelief[s] > 0) totalUsage = Math.max(0, totalUsage - candidateRelief[s])
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

  // 2026-10-26 原语收敛：盟友受限槽并入 restrictedSlots（unique: false），
  // 原 nonUniqueAllySlotsFor / allySlotCapacities / allySlotsOk 三条旁路删除；
  // 独特盟友只能占不受限槽的规则由 restrictedSlotInfo 的谓词 + canEquip 通用容量比较覆盖。
  function isWeaponCard(card) {
    return (card?.traits || []).some(trait => {
      const key = String(trait).toLowerCase()
      return key === 'weapon' || String(trait) === '武器'
    })
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

  // 2026-10-27「如同手牌」通道统一原语接入后，这个执行器只处理「牌已经在手牌里」的快速事件：
  //   · 手牌候选：index 是手牌下标；
  //   · 通道候选：play-channels 的 takeToHand 先把牌放进手牌（beneath 通道上下文由调用方包裹）；
  //   · 画中世界复制：index 是宿主手牌，copyCode 是被复制的事件。
  // 折扣由通道显式传入（不再写 inv.playDiscount），付费/结算/去向与普通事件同一口径。
  function playReactionCard(state, inv, index, context, events, opts = {}) {
    const { copyCode = null, discount = 0, fromChannel = null } = opts
    const code = inv.hand.splice(index, 1)[0]
    if (!code) return
    const def = cardDef(copyCode || code)
    inv.resources -= Math.max(0, playCost(state, inv, def) - (discount || 0))
    consumePlayThreatResources(state, inv, events)
    const fastLabel = fromChannel?.channel === 'hunch'
      ? `🔮 ${inv.name} 从直觉牌库快速打出「${cardName(code)}」。`
      : `⚡ ${inv.name} 快速打出「${copyCode ? `彩绘世界／${cardName(copyCode)}` : cardName(code)}」。`
    info(state, events, fastLabel, { kind: 'play', seat: inv.seat, code })
    // P2-4 快速事件统一通道：无论旧写法（played+fast）还是新写法（reaction+fromHand+quickEvent），
    // 都由这里的同一执行器结算（alreadyPaid：费用与「快速打出」日志已在上面付过/写过）。
    const quick = quickEventView(copyCode || code)
    const descriptor = quick?.descriptor || null
    state._reaction = context
    try {
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
      const playedFlags = quick?.descriptor || {}
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

  return { litaAuraAt, assetPassiveBonus, assetPassiveData, assetCannotLeavePlay, normalizedSlots, slotUsage, canEquip, assetReplacementPlans, replaceAssets, isWeaponCard, isThreatWeakness, leaveAsset, discardRandomAsset, placeLocationForEmptySpawn, farthestLocationsFor, discardLocked, hasPlayedEventsToDeckTop, topDiscardEvent, disposePlayedEvent, consumePlayThreatResources, playReactionCard }
}
