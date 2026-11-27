import { spliceHand } from './hand-icons.js'
import { discardPlayerCards, splicePlayerDiscard } from './player-zones.js'
import { bondedSetKey } from './bonded.js'
import { notifyPlacedAsset } from './investigator-mechanics.js'
import { putInHand } from './hand-entry.js'
import { attachControlledAsset, claimHostedAsset } from './hosted-assets.js'
import { createChaosReveal } from './chaos-reveal.js'
import { withBaseTestValue } from './test-deferred-effects.js'
import { currentEffectSource } from './effect-provenance.js'
import { canLeaveControlledAsset } from './asset-departure.js'
﻿// 能力 API · 卡牌与状态写入口（Phase 6 · 6d-7 第一批）。
//
// `abilityApi(state, events)` 是个 179 个方法的巨型对象，按域拆开的第一块：
// 「按 id 查/取、把牌放进弃牌堆、遭遇牌库顶敌人、最远地点、生成敌人、标记弱点、
//  揭示混乱标记、封印、驱逐、复制打出……」——即 Phase 5 期间为卡牌内容补的**薄写入封装**。
//
// 每个方法都闭包 `state` / `events`（能力层只拿得到 api，拿不到引擎内部），
// 所以这里用 `createCardApi(state, events, deps)` 的形式注入。

export function createCardApi(state, events, deps) {
  const {
    bondedGroupOf,
    retrieveBonded,
    shuffleBondedCopyIntoDeck,
    returnBonded,
    bondedHas,
    bondedTake,
    bondedStore,
    attachCardTo,
    CLASS_NAMES,
    beginChaosTest,
    cardDef,
    cardName,
    checkDefeated,
    chooseLolaRole,
    canEquip,
    replaceAssets,
    descriptorOfKind,
    disengageAll,
    drawChaosToken,
    endChaosTest,
    enemyAttack,
    enemyDef,
    executeDescriptor,
    descriptorUsable,
    enumerateTargets,
    effectError,
    registeredEntry,
    requestChoice,
    reactionWindow,
    farthestLocationsFor,
    getMaxHealth,
    info,
    leaveAsset,
    itemDiscountAtLocation,
    locName,
    makeRuntime,
    newPlayerAssetInstance,
    nextInstanceId,
    notifyCluesRemoved,
    playCost,
    playedEffect,
    removeOne,
    resolveEffect,
    scenarioBehavior,
    scenarioRuntime,
    spawnEnemy,
    syncClues,
    tarotSlotInfo,
  } = deps

  const abilitySource = source => typeof source === 'string'
    ? { id: `revealed:${source}`, code: source, exhausted: false, uses: registeredEntry(source)?.uses ?? null }
    : source
  const abilityOptions = (seat, source, options = {}) => {
    const inv = state.investigators[seat]
    source = abilitySource(source)
    if (!inv || !source) return []
    return (registeredEntry(source.code)?.abilities || []).map((descriptor, index) => ({ descriptor, index }))
      .filter(({ descriptor }) => (options.actionOnly ? descriptor.kind === 'action' : ['action', 'free'].includes(descriptor.kind))
        && (!options.countsAs || (descriptor.countsAs || descriptor.actionKind || descriptor.effect?.type) === options.countsAs)
        && descriptorUsable(state, inv, source, descriptor, { mode: 'action', ignoreCosts: options.ignoreCosts === true,
          ignoreActionCost: options.ignoreActionCost === true })
        && (!descriptor.effect || !effectError(state, inv, descriptor.effect))
        && (!descriptor.target || descriptor.target.optional
          || enumerateTargets(state, inv, descriptor.target, { source }).length))
  }

  const resolveCardAbility = (seat, source, { abilityIndex, ignoreCosts = false, ignoreActionCost = false, actionOnly = false, countsAs = null, baseValue, targetId: requiredTarget, skill } = {}) => {
    const inv = state.investigators[seat]
    const revealed = typeof source === 'string' || (source && !inv?.assets.includes(source) && source.id)
    source = abilitySource(source)
    const picked = abilityOptions(seat, source, { ignoreCosts, ignoreActionCost, actionOnly, countsAs }).find(item => item.index === abilityIndex)
    if (!picked) return false
    const { descriptor } = picked
    const targets = enumerateTargets(state, inv, descriptor.target, { source })
    let targetId = requiredTarget == null ? null : String(requiredTarget)
    if (targets.length && targetId == null) targetId = targets.length === 1 ? String(targets[0].id) : requestChoice(state, {
      kind: 'target', source: source.code, seat, prompt: '选择这项能力的目标。',
      options: targets.map(target => ({ id: String(target.id), label: target.label })),
    })
    if (targets.length && !targets.some(target => String(target.id) === targetId)) return false
    const previous = state._revealedAbility
    const previousFight = state._configuredAbilityFight
    if (countsAs === 'fight' && (requiredTarget != null || skill)) {
      state._configuredAbilityFight = { seat, sourceId: source.id, targetId, skill }
    }
    if (revealed) state._revealedAbility = { seat, source, abilityIndex: picked.index }
    try {
      return withBaseTestValue(state, seat, baseValue, () =>
        executeDescriptor(state, { inv, source, descriptor, context: { targetId }, events, ignoreCosts, ignoreActionCost }))
    } finally {
      if (previous) state._revealedAbility = previous
      else delete state._revealedAbility
      if (previousFight) state._configuredAbilityFight = previousFight
      else delete state._configuredAbilityFight
    }
  }

  function detachControlledAsset(inv, host, asset) {
    delete asset.attachedToAsset
    host.attachments = host.attachments.filter(card => !card.assetReference || card.id !== asset.id)
    const otherAssets = inv.assets.filter(card => card !== asset)
    if (!canEquip({ ...inv, assets: otherAssets }, cardDef(asset.code))) {
      inv.assets = otherAssets
      replaceAssets(state, inv, cardDef(asset.code), events)
      inv.assets.push(asset)
    }
    return true
  }

  const putIntoPlay = (seat, code, { attachToAssetId = null, handIndex = null } = {}) => {
    const inv = state.investigators[seat]
    const index = handIndex ?? (inv?.hand.indexOf(code) ?? -1)
    if (!inv || index < 0 || inv.hand[index] !== code) return null
    const host = attachToAssetId == null ? null : inv.assets.find(card => card.id === attachToAssetId)
    if (attachToAssetId != null && (!host || inv.assets.some(card => card.attachedToAsset === host.id)
      || cardDef(code)?.type !== 'asset')) return null
    if (scenarioBehavior(state).canPlaceAsset?.(state, inv, code) === false) {
      info(state, events, `⛔ 「${cardName(code)}」当前不能放置入场。`)
      return null
    }
    spliceHand(inv, index, 1)
    const asset = newPlayerAssetInstance(state, inv, code)
    if (host) {
      asset.attachedToAsset = host.id
      ;(host.attachments ||= []).push({ id: asset.id, code: asset.code, ownerSeat: seat, assetReference: true })
    }
    inv.assets.push(asset)
    scenarioBehavior(state).assetEntered?.(state, inv, asset, scenarioRuntime(state, events))
    notifyPlacedAsset(state, seat, asset, events, reactionWindow)
    info(state, events, `🎴 ${inv.name} 将「${cardName(code)}」放置入场。`)
    return asset
  }

  return {
    putIntoPlay,
    putHandAssetOnHost: (seat, target, host) => {
      const handIndex = /^hand:(\d+)$/.exec(String(target))?.[1]
      const index = handIndex == null ? null : Number(handIndex)
      const code = index == null ? target : state.investigators[seat]?.hand[index]
      return host ? putIntoPlay(seat, code, { attachToAssetId: host.id, handIndex: index }) : null
    },
    attachControlledAsset: (seat, assetId, kind, hostId) => attachControlledAsset(state, seat, assetId, kind, hostId),
    claimHostedAsset: (seat, kind, hostId, assetId) => claimHostedAsset(state, seat, kind, hostId, assetId, { canEquip, cardDef }),
    attachOrSwapControlledAsset: (seat, hostId, assetId, { maximum = 1, replaceId = undefined } = {}) => {
      const inv = state.investigators[seat]
      const host = inv?.assets.find(asset => asset.id === hostId)
      const incoming = inv?.assets.find(asset => asset.id === assetId && !asset.attachedToAsset)
      if (!host || !incoming || host === incoming) return false
      const attached = inv.assets.filter(asset => asset.attachedToAsset === host.id)
      const current = replaceId == null ? (replaceId === undefined && maximum === 1 ? attached[0] : null)
        : attached.find(asset => asset.id === replaceId)
      if (replaceId != null && !current || !current && attached.length >= maximum) return false
      incoming.attachedToAsset = host.id
      host.attachments ||= []
      host.attachments.push({ id: incoming.id, code: incoming.code, ownerSeat: seat, assetReference: true })
      if (current) detachControlledAsset(inv, host, current)
      return true
    },
    detachControlledAsset: (seat, hostId, targetId) => {
      const inv = state.investigators[seat]
      const host = inv?.assets.find(asset => asset.id === hostId)
      const attached = inv?.assets.find(asset => asset.id === targetId && asset.attachedToAsset === hostId)
      return Boolean(host && attached) && detachControlledAsset(inv, host, attached)
    },
    repeatResolvedAbility: context => {
      const inv = state.investigators[context?.seat]
      const source = inv?.assets.find(asset => asset.id === context.assetId)
      const descriptor = registeredEntry(source?.code)?.abilities.find(descriptor => descriptor.id === context.descriptorId)
      if (!descriptor || descriptor.kind !== 'action') return false
      const targets = enumerateTargets(state, inv, descriptor.target, { source })
      const targetId = targets.length ? requestChoice(state, { kind: 'target', source: source.code, seat: inv.seat,
        prompt: '选择再次结算的目标。', options: targets.map(target => ({ id: String(target.id), label: target.label })) }) : null
      return executeDescriptor(state, { inv, source, descriptor, context: { targetId }, events,
        alreadyPaid: true, repeatedEffect: true })
    },
    returnEnemyToBonded: (enemy, options = {}) => {
      if (!state.enemies.includes(enemy)) return false
      const code = enemy.originalCode || enemy.code
      const group = bondedGroupOf(code)
      if (!group) return false
      const seat = options.ownerSeat ?? enemy.bearerSeat ?? state.currentSeat
      for (const inv of state.investigators) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
      state.enemies.splice(state.enemies.indexOf(enemy), 1)
      state.bondedSets ||= {}
      const set = state.bondedSets[bondedSetKey(state, group.main, seat)] ||= { seat, cards: [], retrieved: true }
      set.cards.push(code)
      return true
    },
    cardAbilityOptions: (seat, source, options = {}) => abilityOptions(seat, source, options)
      .map(({ descriptor, index }) => ({ index, label: descriptor.label })),
    resolveCardAbility,
    resolveAssetAction: (seat, { assetId, discardIndex, abilityIndex, waive = 'action' } = {}) => {
      const inv = state.investigators[seat]
      if (!inv || inv.defeated || inv.resigned || !['none', 'action', 'all'].includes(waive)
        || (assetId == null) === (discardIndex == null)) return false
      const source = assetId != null ? inv.assets.find(asset => asset.id === assetId) : inv.discard[discardIndex]
      if (!source || discardIndex != null && (!Number.isSafeInteger(discardIndex) || cardDef(source)?.type !== 'asset' || waive !== 'all')) return false
      return resolveCardAbility(seat, source, { abilityIndex, ignoreCosts: waive === 'all',
        ignoreActionCost: waive === 'action', actionOnly: true })
    },
    swapControlledAssetFromHand: (seat, id, handIndex, { trait } = {}) => {
      const inv = state.investigators[seat]
      const asset = inv?.assets.find(item => item.id === id)
      const code = inv?.hand[handIndex]
      if (!asset || !code || !Number.isSafeInteger(handIndex) || inv.defeated || inv.resigned) return false
      const outgoing = cardDef(asset.code), incoming = cardDef(code)
      const cost = definition => Number.isFinite(definition?.cost) ? definition.cost : Infinity
      const matches = definition => !trait || definition?.traits?.some(value => value.toLowerCase() === trait.toLowerCase())
      if (!Number.isFinite(cost(incoming)) || !Number.isFinite(cost(outgoing)) || outgoing.permanent
        || incoming?.type !== 'asset' || !matches(outgoing) || !matches(incoming) || cost(incoming) > cost(outgoing)) return false
      if (!canEquip({ ...inv, assets: inv.assets.filter(item => item !== asset) }, incoming)) return false
      const slot = inv.assets.indexOf(asset)
      spliceHand(inv, handIndex, 1)
      asset.returnedToHand = true
      leaveAsset(state, inv, asset, events)
      putInHand(state, state.investigators[asset.ownerSeat] || inv, asset.originalCode || asset.code)
      const inserted = newPlayerAssetInstance(state, inv, code)
      inv.assets.splice(slot, 0, inserted)
      notifyPlacedAsset(state, seat, inserted, events, reactionWindow)
      return inserted
    },
    attachResolvingEncounter: asset => {
      const context = state._reaction
      if (!asset || context?.when !== 'treacheryWouldDiscard' || !context.cardCode || context.attached) return false
      asset.attachments ||= []
      asset.attachments.push({ id: nextInstanceId(state, 'a'), code: context.cardCode,
        ownerSeat: null, encounterAttached: true })
      context.attached = true
      return true
    },
    // 第 2 步 P2.8：绑定（场外集合/检索 3 张/洗回/离场收回）。卡面生命周期钩子调用它；
    // 主卡与副本的关系来自卡面数据（bondedCards / bondedTo），引擎不认卡号。
    bonded: {
      group: code => bondedGroupOf(code),
      has: (seat, code) => bondedHas(state, state.investigators[seat], code),
      attachToEnemy: (seat, code, enemy) => {
        const inv = state.investigators[seat]
        if (!inv || !state.enemies.includes(enemy) || !bondedTake(state, inv, code)) return null
        const card = attachCardTo(state, seat, code, enemy, { hostEnemyId: enemy.id })
        if (!card) bondedStore(state, inv, code)
        return card
      },
      putAssetIntoPlay: (seat, code) => {
        const inv = state.investigators[seat]
        const definition = cardDef(code)
        if (!inv || definition?.type !== 'asset' || !bondedTake(state, inv, code)) return null
        replaceAssets(state, inv, definition, events)
        const asset = newPlayerAssetInstance(state, inv, code, { ownerSeat: seat })
        inv.assets.push(asset)
        notifyPlacedAsset(state, seat, asset, events, reactionWindow)
        return asset
      },
      swapAsset: (seat, source, nextCode, { transferUses = false } = {}) => {
        const inv = state.investigators[seat]
        const outgoing = bondedGroupOf(source?.code)
        const incoming = bondedGroupOf(nextCode)
        if (!outgoing || !incoming || outgoing.main !== incoming.main || source.code === nextCode
          || cardDef(nextCode)?.type !== 'asset' || !canLeaveControlledAsset(state, inv, source)) return null
        const owner = state.investigators[source.ownerSeat ?? seat]
        if (!bondedTake(state, owner, nextCode)) return null
        const fields = { ownerSeat: owner.seat }
        if (transferUses && source.uses != null) {
          fields.uses = source.uses
          fields.usesType = source.usesType
        }
        if (source.location != null) fields.location = source.location
        bondedStore(state, owner, source.originalCode || source.code)
        const replacement = newPlayerAssetInstance(state, inv, nextCode, {
          ...fields, id: source.id, enteredRound: source.enteredRound,
        })
        for (const key of ['damage', 'horror', 'doom', 'clues', 'resources', 'counters', 'attachments', 'beneath']) {
          if (Object.hasOwn(source, key)) replacement[key] = source[key]
        }
        inv.assets[inv.assets.indexOf(source)] = replacement
        return replacement
      },
      returnAsset: (seat, source) => {
        const inv = state.investigators[seat]
        if (!source || source.returnedToHand || !inv) return false
        if (inv.assets.includes(source) && leaveAsset(state, inv, source, events, { reason: 'bonded' }) === false) return false
        if (source.returnedToHand) return true
        const owner = state.investigators[source.ownerSeat ?? seat]
        if (!bondedStore(state, owner, source.originalCode || source.code)) return false
        source.returnedToHand = true
        return true
      },
      retrieve: (seat, mainCode, options = {}) => retrieveBonded(state, state.investigators[seat], mainCode, { ...options, events }),
      shuffleCopyIntoDeck: (seat, main, code) => shuffleBondedCopyIntoDeck(state, state.investigators[seat], main, code),
      return: (seat, mainCode) => returnBonded(state, state.investigators[seat], mainCode, { events }),
    },
    locationById: id => state.locations.find(location => location.id === id) || null,
    // 2026-10-25 本循环修复 abilityApi.canEquip（05023/05027/05031/05035/05039 等「放置入场」查槽位）：
    // 暴露与打出管线同一个槽位读点，内容层的放置入场能力可据此决定是否可选/是否需要替换。
    canEquip: (inv, card) => canEquip(inv, card),
    // 塔罗槽读数：{ capacity, usage }（开局 [reaction] 放置入场前判断槽位是否已满）。
    tarotSlotInfo: inv => tarotSlotInfo(state, inv),
    // Phase 5（5a-15）：把一张牌直接放进弃牌堆（附着型弱点没找到目标时用）。
    putIntoDiscard: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !code) return false
      discardPlayerCards(state, owner, code)
      return true
    },
    // Phase 5（5a-15）：「惩戒邪恶 / 寻找伊兹」共用——遭遇牌库顶的敌人、最远地点、生成敌人与两个标记。
    encounterTopEnemy: () => {
      while (state.encounterDeck.length) {
        const code = state.encounterDeck.pop()
        if (enemyDef(code)) return code
        state.encounterDiscard.push(code)
      }
      return null
    },
    farthestLocations: seat => farthestLocationsFor(state, state.investigators[seat] || state.investigators[state.currentSeat]),
    spawnEnemyAt: (code, locationId) => spawnEnemy(state, code, locationId, null),
    markSmiteTheWicked: (enemy, seat) => {
      if (!enemy) return false
      enemy.smiteTheWickedSeat = seat
      return true
    },
    markSearchingForIzzie: (location, seat) => {
      if (!location) return false
      location.searchingForIzzieSeat = seat
      return true
    },
    // Phase 5（5a-14）：「梦魇」这类弱点让玩家弃掉牌库顶 N 张（走剧本运行时）。
    scenarioDiscardTop: (seat, count = 3) => scenarioRuntime(state, events).discardTop(seat, count),
    // Phase 5（5a-12）：「最终狂想曲」这类「一次性揭示 N 枚标记（不生成检定）」。
    revealChaosTokens: (count, options = {}) => {
      if (!Number.isSafeInteger(count) || count < 1) return []
      const seat = options.seat ?? currentEffectSource(state)?.controllerSeat ?? state.currentSeat
      const reveal = createChaosReveal(state, events, deps)
      beginChaosTest(state)
      const context = reveal.before(seat, count, options.source)
      const { revealed: tokens } = reveal.draw(context, count, context.replacementToken ? [context.replacementToken] : [])
      for (const token of tokens) reveal.revealed(seat, token)
      endChaosTest(state, options.seat == null ? tokens : [])
      return tokens
    },
    addChaosRevealCancellation: (context, { seat, source } = {}) => {
      if (context?.when !== 'beforeChaosTokenReveal' || !state.investigators[seat]) return false
      ;(context.cancellationPlans ||= []).push({ seat, source })
      return true
    },
    triggerChaosRevealEffect: (seat, sourceCode, resolve) =>
      createChaosReveal(state, events, deps).resolveCardEffect(seat, sourceCode, resolve),
    modifyChaosRevealEffect: (context, { cancel = false, additional = 0 } = {}) => {
      if (context?.when !== 'chaosRevealEffectWouldResolve') return false
      if (cancel) context.cancelled = true
      if (Number.isSafeInteger(additional) && additional > 0) context.additional += additional
      return true
    },
    // Phase 5（5b-8）：「戴红手套的男子」把两项技能的基础值提升为 6。
    setStatOverride: (card, skills) => {
      if (!card) return null
      card.statOverride = [...skills]
      return card.statOverride
    },
    // Phase 5（5c-39）：「原定计划」把牌放进 attached（不是 attachments），并能从那里面打出。
    attachedCodes: host => (host?.attached || []).slice(),
    attachToHostByCode: (host, code) => {
      if (!host) return false
      const owner = state.investigators.find(person => (person.deck || []).includes(code))
      if (!owner) return false
      const index = owner.deck.indexOf(code)
      if (index < 0) return false
      owner.deck.splice(index, 1)
      host.attached ||= []
      host.attached.push(code)
      return true
    },
    // Phase 5（5c-38）：「遗觉记忆」——所有弃牌堆里的候选、复制的费用、移出游戏、重放被复制的事件。
    discardPiles: () => state.investigators.flatMap(owner => (owner.discard || [])
      .map(code => ({ code, seat: owner.seat }))),
    playCostOf: (seat, code) => {
      const owner = state.investigators[seat]
      const def = cardDef(code)
      return owner && def ? playCost(state, owner, def) : 0
    },
    exileFromDiscard: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner) return false
      const index = (owner.discard || []).lastIndexOf(code)
      if (index < 0) return false
      splicePlayerDiscard(owner, index, 1)
      state.removedFromGame ||= []
      state.removedFromGame.push(code)
      return true
    },
    // 重放「被复制的事件卡」的打出效果：数据体与描述子两条读点都走这里。
    replayPlayedCode: (seat, code) => {
      const played = playedEffect(code)
      const descriptor = descriptorOfKind(code, 'played')
      const previousFromDiscard = state._fromDiscardCode
      state._fromDiscardCode = null
      try {
        if (descriptor?.resolve) {
          executeDescriptor(state, { inv: state.investigators[seat], source: { code, id: code }, descriptor,
            context: { fromDiscard: false, copyCode: null, cardId: code }, events })
          return true
        }
        if (played) { resolveEffect(state, seat, played, makeRuntime(state, events)); return true }
        return false
      } finally {
        if (previousFromDiscard === undefined) delete state._fromDiscardCode
        else state._fromDiscardCode = previousFromDiscard
      }
    },
    // Phase 5（5c-37）：「时间借取」的滴答计数（上限 3）与「虚空碎裂」的封印「0」标记支付。
    addClicks: (card, max = 3) => {
      if (!card) return null
      if ((card.clicks || 0) >= max) return card.clicks
      card.clicks = (card.clicks || 0) + 1
      return card.clicks
    },
    sealedTokensFrom: (card, token = '0') => (state.chaos?.sealed || [])
      .filter(entry => entry.source === card?.id && entry.token === token).length,
    releaseSealedToken: (card, token = '0') => {
      const entry = (state.chaos?.sealed || []).find(item => item.source === card?.id && item.token === token)
      if (!entry) return null
      state.chaos.sealed = state.chaos.sealed.filter(item => item !== entry)
      state.sealedTokens = state.chaos.sealed.map(item => item.token)
      state.chaosBag.push(entry.token)
      return entry.token
    },
    // Phase 5（5c-36）：「死里逃生」的候选地点——已揭示且没有敌人。
    locationsWithoutEnemies: () => state.locations.filter(location => location.revealed
      && !state.enemies.some(enemy => enemy.location === location.id)),
    // Phase 5（5c-36）：「死里逃生」——与所有敌人解除交战、把威胁区的牌丢进弃牌堆、软结束回合。
    disengageAll: seat => disengageAll(state, seat, events),
    discardAllThreats: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      let removed = 0
      for (const threat of owner.threat.slice()) {
        removeOne(owner.threat, threat)
        owner.discard.push(threat.code)
        removed++
      }
      return removed
    },
    softEndTurn: seat => {
      const owner = state.investigators[seat]
      if (!owner) return false
      if (state.currentSeat === seat) { owner.actionsLeft = 0; owner.turnEnded = true }
      return owner.turnEnded === true
    },
    // Phase 5（5c-36）：「时间曲折」——把整局状态回滚到上一个动作的快照，
    // 保留该调查员的手牌/资源/弃牌堆与「移出游戏」，并保留事务层的 _resolution/revision。
    rewindLastAction: seat => {
      const snapshot = state.lastActionSnapshot
      if (!snapshot) return false
      const owner = state.investigators[seat]
      if (!owner) return false
      const preserved = { hand: owner.hand.slice(), resources: owner.resources,
        discard: owner.discard.slice(), removedFromGame: (state.removedFromGame || []).slice() }
      const resolution = state._resolution
      const revision = state.revision
      for (const key of Object.keys(state)) delete state[key]
      Object.assign(state, structuredClone(snapshot))
      Object.assign(state.investigators[seat], preserved)
      state.removedFromGame = preserved.removedFromGame
      state._resolution = resolution
      state.revision = revision
      state._timeWarped = true
      return true
    },
    // Phase 5（5c-35）：「同归于尽」用——列出与我交战的所有敌人（不限地点）。
    engagedEnemies: seat => state.enemies.filter(enemy => enemy.engagedSeat === seat),
    // Phase 5（5c-35）：写调查员实例上的 physicalTrauma/mentalTrauma（**不是**战役账本）。
    // 「同归于尽」的旧实现只写了这个实例字段：引擎里没有读点、也不写日志——见 §4.44 的已知缺陷记录。
    bumpInstanceTrauma: (seat, kind, amount = 1) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      const key = kind === 'physical' ? 'physicalTrauma' : 'mentalTrauma'
      owner[key] = (owner[key] || 0) + amount
      return owner[key]
    },
    // Phase 5（5c-35）：「同归于尽」把伤害直接拉到最大生命值，再走一次击败检查（与旧原语同序）。
    setDamageToMax: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.damage = getMaxHealth(owner)
      checkDefeated(state, seat, events)
      return owner.damage
    },
    // Phase 5（5c-35）：「查尔斯·罗斯」这类「本地点下一件物品 -N」，记在支援或玩家身上。
    setLocationItemDiscount: (seat, card, amount = 1) => {
      const owner = state.investigators[seat ?? state.currentSeat]
      const record = { amount, round: state.round, phase: state.phase }
      if (card) card.itemDiscountAtLocation = record
      else if (owner) owner.itemDiscountAtLocation = record
      return record
    },
    // Phase 5（5c-34）：「背包」把牌放在 attachedCards 上（能从那里当手牌打出）与从牌库取走若干张。
    setAttachedCards: (host, codes) => {
      if (!host) return null
      host.attachedCards = [...codes]
      return host.attachedCards
    },
    takeFromDeck: (seat, codes) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      let taken = 0
      for (const code of codes || []) {
        const index = owner.deck.lastIndexOf(code)
        if (index >= 0) { owner.deck.splice(index, 1); taken++ }
      }
      return taken
    },
    // Phase 5（5c-33）：「吃子弹」这类在反应窗口里给本次检定加「额外揭示数」的卡。
    // 反应窗口里写反应上下文（战斗流程在窗口后读 context.extraChaosChoices），否则写 skillTest。
    addExtraChaosChoicesToTest: amount => {
      const reaction = state._reaction
      const target = reaction && (reaction.context || reaction)
      if (target) {
        target.extraChaosChoices = (target.extraChaosChoices || 0) + amount
        return target.extraChaosChoices
      }
      if (state.skillTest) {
        state.skillTest.extraChaosChoices = (state.skillTest.extraChaosChoices || 0) + amount
        return state.skillTest.extraChaosChoices
      }
      return 0
    },
    // Phase 5（5c-32）：「英勇救援」这类由卡牌造成的敌人攻击（不计入「不能攻击」开关）。
    enemyAttackByCard: (enemy, label, seat = state.currentSeat) => {
      const target = state.investigators[seat] || state.investigators[state.currentSeat]
      if (!enemy || !target) return false
      return enemyAttack(state, enemy, target, events, label, { kind: 'effect' })
    },
    // Phase 5（5c-32）：「即兴表演」这类切换角色（会写 inv.role）与「本回合下一张该阵营卡 -N」。
    switchRole: (seat, source, prompt) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      return chooseLolaRole(state, owner, source, prompt)
    },
    setRoleDiscount: (seat, role, amount = 3) => {
      const owner = state.investigators[seat]
      if (!owner || !role) return null
      owner.lolaDiscount = { role, amount, round: state.round, turnSeat: state.currentSeat }
      return owner.lolaDiscount
    },
    className: role => CLASS_NAMES[role] || role,
    // Phase 5（5c-31）：这个敌人是否还在场上（反击类能力要先确认目标没被同窗口的效果清掉）。
    isEnemyInPlay: enemy => Boolean(enemy) && state.enemies.includes(enemy),
    discoverAt: (seat, locationId, amount = 1, { silent = false, log = null } = {}) => {
      const inv = state.investigators[seat]
      const location = state.locations.find(entry => entry.id === locationId)
      if (!inv || !location) return 0
      const got = Math.min(amount, location.clues || 0)
      if (!got) return 0
      location.clues -= got
      inv.clues += got
      syncClues(state)
      // log：调用方需要自己的文案（「寻找答案」）；silent：调用方已经写过日志。
      if (log) info(state, events, log)
      else if (!silent) info(state, events, `🔍 ${inv.name} 在「${locName(state, location.id)}」发现 ${got} 个线索。`)
      notifyCluesRemoved(state, location, got, events)
      return got
    },
    putCommittedIntoPlay: (seat, code) => {
      const inv = state.investigators[seat]
      if (!inv || cardDef(code)?.type !== 'skill' || !state.skillTest?.committed.some(card => card.seat === seat && card.code === code)
        || scenarioBehavior(state).canPlaceAsset?.(state, inv, code) === false) return null
      const card = newPlayerAssetInstance(state, inv, code)
      inv.assets.push(card)
      notifyPlacedAsset(state, seat, card, events, reactionWindow)
      return card
    },
  }
}
