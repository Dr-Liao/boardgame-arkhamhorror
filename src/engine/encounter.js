import { investigatorRule } from '../cards/card-rules.js'
import { extraDeckPiles } from './alt-decks.js'
// 遭遇牌与反应窗口（drawEncounter / reactionWindow / triggerReaction / playerWindow）
// 从 engine.js 拆出的模块（Phase 6 · 6d-20）。
//
// 这四个函数构成「事件 → 窗口 → 能力」的通道：
//   drawEncounter 抽遭遇并推进（含地点遭遇、遭遇行动）
//   reactionWindow / playerWindow 开一个可交互窗口（反应、强制、玩家窗口）
//   triggerReaction 是旧式 reactions 的入口（数据体 reactions）
// 它们与 ability-exec.js 的分工：那边结算单个能力，这边决定「什么时候问」。
//
// 第 2 步 P2.2：`drawEncounter(state, inv, events, { deck: 'spectral' })` 从第二遭遇牌堆
// 抽牌；不传 `deck` 时完全走原来的普通遭遇牌堆（行为零变化）。牌堆读写统一走 alt-decks.js。

export function createEncounter(deps) {
  const {
    ALL_CARDS,
    ALL_ENEMIES,
    ALL_TREACHERIES,
    EFFECTS,
    abilityApi,
    abilityTargets,
    actionCost,
    actPlacesLocationForEmptySpawn,
    aliveInvestigators,
    applyHorror,
    assetEffect,
    autoEngageAt,
    canAffordAbility,
    cannotPlayTypes,
    cannotTriggerFreeAbility,
    cardDef,
    cardName,
    checkDefeated,
    chooseAmong,
    controlledAbilityCards,
    descriptorOfKind,
    descriptorReactionSpec,
    descriptorsForWindow,
    doAbility,
    doPlay,
    effectError,
    enemyDef,
    evaluateCriteria,
    info,
    investigatorTextBlanked,
    isAutomaticReward,
    isWeaknessCode,
    leadDecisionSeat,
    leaveAsset,
    legalMoves,
    limitUsed,
    locName,
    locationExists,
    lolaCanUseCard,
    makeRuntime,
    openAbilityWindow,
    placeLocationForEmptySpawn,
    playConditionError,
    playConditionHelpers,
    playCost,
    playReactionCard,
    playedEffect,
    playerWindowLabel,
    randomValue,
    registeredEntry,
    requestChoice,
    resolveEffect,
    resolveTreachery,
    runtimeCardAvailable,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    spawnEnemy,
    syncClues,
    topDiscardEvent,
  } = deps

function drawEncounter(state, inv, events, options = {}) {
  // P2.2：deck 缺省是普通遭遇牌库；传 'spectral' 时读写第二遭遇牌堆的两堆。
  // P8：章节可以用 behavior.encounterDeckFor(state, inv) 在**抽牌时**决定从哪一堆抽
  // （《恶罪报应》等：调查员在幽灵地点时从幽灵遭遇牌堆抽）；显式 options.deck 优先。
  const deckId = options.deck
    || scenarioBehavior(state).encounterDeckFor?.(state, inv)
    || 'encounter'
  const piles = deckId === 'encounter' ? null : extraDeckPiles(state, deckId)
  const deck = () => (piles ? piles.deck : state.encounterDeck)
  const discard = () => (piles ? piles.discard : state.encounterDiscard)
  const setDeck = list => { if (piles) piles.deck = list; else state.encounterDeck = list }
  if (deck().length === 0) {
    if (discard().length === 0) return
    setDeck(shuffle([...discard()], () => randomValue(state)))
    if (piles) piles.discard = []
    else state.encounterDiscard = []
  }
  const code = deck().pop()
  const encounter = ALL_ENEMIES[code] || ALL_TREACHERIES[code]
  const redrawContext = { when: 'encounterDrawn', seat: inv.seat, location: inv.location, cardCode: code,
    weakness: isWeaknessCode(code), peril: !!encounter?.peril, cancelled: false,
    prompt: `${inv.name} 抽到「${encounter?.name || code}」` }
  for (const owner of aliveInvestigators(state).filter(owner => owner.location === inv.location)) {
    triggerReaction(state, owner.seat, 'encounterDrawn', events, redrawContext)
    if (redrawContext.cancelled) break
  }
  if (!redrawContext.cancelled) reactionWindow(state, 'encounterDrawn', redrawContext, events)
  if (redrawContext.cancelled) {
    // 02302：被取消的遭遇卡应混洗回遭遇牌库，而不是进入弃牌堆。
    if (redrawContext.shuffleBack) {
      deck().push(code)
      setDeck(shuffle(deck(), () => randomValue(state)))
    } else discard().push(code)
    const cancelledName = encounter?.hidden ? '一张隐私遭遇卡' : `「${encounter?.name || code}」`
    if (redrawContext.redraw) {
      info(state, events, `${cancelledName}被取消并${redrawContext.shuffleBack ? '混洗回遭遇牌库' : '弃置'}，${inv.name} 重新抽取遭遇卡。`)
      return drawEncounter(state, inv, events, options)
    }
    info(state, events, `${cancelledName}的显现效果被取消并${redrawContext.shuffleBack ? '混洗回遭遇牌库' : '弃置'}。`)
    return
  }
  const resolvingInv = redrawContext.redirectSeat == null ? inv : state.investigators[redrawContext.redirectSeat]
  // 「交给你了！」只是改由他人结算；带 +2 的同类卡（如「让我来！」）在反应效果里给出 redirectBonus。
  if (redrawContext.redirectSeat != null) resolvingInv.handlingEncounter = { code, bonus: redrawContext.redirectBonus || 0 }
  scenarioBehavior(state).encounterDrawn?.(state, resolvingInv, code, scenarioRuntime(state, events))
  if (encounter?.hidden) {
    info(state, events, `${resolvingInv.name} 翻开了一张隐私遭遇卡。`, {
      kind: 'automatic', phase: state.phase, round: state.round, text: `${resolvingInv.name} 遭遇一张隐私牌`,
      effect: 'encounter', seat: resolvingInv.seat, location: resolvingInv.location,
    })
  } else {
    info(state, events, `${resolvingInv.name} 翻开遭遇卡「${encounter?.name || code}」。`, {
      kind: 'automatic', phase: state.phase, round: state.round, text: `${resolvingInv.name} 遭遇「${encounter?.name || code}」`,
      code: encounter?.originalCode || code, name: encounter?.name, effect: 'encounter', seat: resolvingInv.seat, location: resolvingInv.location,
    })
  }
  // 「恢复元气」等需要知道本回合是否抽到过诡计。
  if (ALL_TREACHERIES[code]) resolvingInv.drewTreacheryRound = state.round
  if (ALL_ENEMIES[code]) {
    const def = enemyDef(code)
    // 带固定生成地点的敌人在该地点生成，否则与抽牌者交战；「任意无人地点」敌人去无人地点。
    let engage = null
    let loc = resolvingInv.location
    if (def.spawnAnyEmpty) {
      const empty = state.locations.filter((l) => !state.enemies.some((e) => e.location === l.id)
        && !aliveInvestigators(state).some(i => i.location === l.id))
      let picked = empty.length ? chooseAmong(state, {
        kind: 'spawn', source: { type: 'enemy', code }, seat: leadDecisionSeat(state),
        prompt: `选择「${def.name}」的生成地点（任意无人地点）。`,
        options: empty.map((l) => ({ id: l.id, label: l.name })),
      }) : null
      const act = state.acts?.[state.actIndex]
      const actCode = String(act?.originalCode || act?.code || '')
      // Phase 5（5a-24）：哪些幕会「翻探索牌库放地点」由卡号规则数据声明。
      if (!picked && !empty.length && actPlacesLocationForEmptySpawn(actCode)) {
        // 04318 强制：翻探索牌库直到地点，放在场上并让敌人在这里生成。
        picked = placeLocationForEmptySpawn(state)
        if (picked) info(state, events, `🌐 彼端的世界：从探索牌库翻出地点「${locName(state, picked)}」并让「${def.name}」在那里生成。`)
      }
      if (!picked) { discard().push(code); return }
      loc = picked
    } else if (def.spawn) {
      if (!locationExists(state, def.spawn)) { discard().push(code); return }
      loc = def.spawn
    } else {
      engage = resolvingInv.seat
    }
    const enemy = spawnEnemy(state, code, loc, engage)
    if (enemy) info(state, events, `👹 ${resolvingInv.name} 遭遇了「${enemy.name}」！它出现在「${locName(state, enemy.location)}」${enemy.engagedSeat != null ? '并与之交战' : ''}。`)
    if (enemy) autoEngageAt(state, enemy.location, events)
  } else if (ALL_TREACHERIES[code]) {
    const resolution = resolveTreachery(state, resolvingInv, ALL_TREACHERIES[code], events)
    // Older campaign handlers may already perform their printed surge; the marker prevents a second draw.
    const placed = typeof resolution === 'object' ? resolution.placed : resolution
    if (!placed) discard().push(code)
    const surge = encounter.surge || scenarioBehavior(state).encounterGainsSurge?.(state, code, resolvingInv)
    if (surge && !resolution?.surgeHandled && !resolvingInv.defeated && !resolvingInv.resigned) {
      info(state, events, `🌀 「${encounter.name || code}」涌动：再抽取一张遭遇牌。`)
      drawEncounter(state, resolvingInv, events, options)
    }
  } else if (ALL_CARDS[code]?.type === 'asset' && scenarioBehavior(state).drawStoryAsset) {
    scenarioBehavior(state).drawStoryAsset(state, resolvingInv, code, scenarioRuntime(state, events))
  } else if (ALL_CARDS[code]?.type === 'location' && scenarioBehavior(state).drawLocation) {
    scenarioBehavior(state).drawLocation(state, resolvingInv.seat, code, scenarioRuntime(state, events))
  } else throw new Error(`未知遭遇卡：${code}`)
  delete resolvingInv.handlingEncounter
}

// 快速反应窗口：同地点持有对应反应事件的调查员可显式打出（如闪躲、守护结界）。
// 返回上下文；context.cancelled 为真表示本次结算被取消。

function reactionWindow(state, when, context, events, opts = {}) {
  // 嵌套保护：大多数窗口在「正在结算一次反应/能力」时不再重复开口，
  // 但「将要被击败」必须例外——致命伤害可能来自快速卡自己的结算，
  // 若在这里直接返回，玩家就再也没有机会打出救命卡。调用方负责恢复外层上下文。
  if (state._reaction && !opts.allowNested) return context
  for (const inv of aliveInvestigators(state)) {
    if (context.peril && inv.seat !== context.seat) continue
    while (!context.cancelled) {
      const discardEvent = topDiscardEvent(state, inv)
      // Phase 5（5a-26）：「彩绘世界」这类能复制牌库下方事件的卡由条目级 copiesBeneathEvents 声明。
      const handCandidates = inv.hand.flatMap((code, index) => registeredEntry(code)?.copiesBeneathEvents
        ? (inv.beneath || []).flatMap(copyCode => {
          const copied = cardDef(copyCode)
          // Phase 6（6e-8）：快速反应事件搬成 `played` + `fast` + `trigger`，复制时同样算可打出。
          const copyReactive = descriptorOfKind(copyCode, 'played')?.fast === true
          return copied?.type === 'event' && !copied.exceptional && copyReactive
            ? [{ code, copyCode, index, id: `${index}:${copyCode}` }] : []
        })
        : [{ code, index, id: String(index) }])
      const planCandidates = inv.assets.filter(asset => registeredEntry(asset.code)?.cardPlan && !asset.exhausted)
        .flatMap(asset => (asset.attached || []).map((code, index) =>
          ({ code, index, fromPlanAssetId: asset.id, id: `plan:${asset.id}:${index}` })))
      const candidates = [...handCandidates,
        ...planCandidates,
        ...(discardEvent ? [{ code: discardEvent, fromDiscard: true, id: 'discard' }] : [])]
        .filter(({ code, copyCode }) => {
          // Phase 5（5c-8）：快速事件也可以在能力层声明——`kind:'played'` + `fast` + `trigger:<窗口>`，
          // 条件写在 criteria 的旧字段里。两条通道共用下面同一份条件判定。
          const descriptor = descriptorOfKind(copyCode || code, 'played')
          const reaction = (descriptor?.fast && descriptor.trigger?.includes(when)
              ? { when, ...(descriptor.criteria && typeof descriptor.criteria === 'object' && !Array.isArray(descriptor.criteria)
                ? descriptor.criteria : {}) }
              : null)
          if (!reaction || reaction.when !== when || !runtimeCardAvailable(state, inv, code)) return false
          if (!lolaCanUseCard(inv, code)) return false
          if (!reaction.anyLocation && context.location != null && inv.location !== context.location) return false
          if (reaction.selfOnly && inv.seat !== context.seat) return false
          if (reaction.otherInvestigator && inv.seat === context.seat) return false
          if (reaction.nonPerilOnly && context.peril) return false
          if (reaction.ownMythosOnly && inv.seat !== context.seat) return false
          if (reaction.nonWeaknessOnly && (context.weakness || !context.cardCode || isWeaknessCode(context.cardCode))) return false
          if (reaction.nonElite && context.enemy?.elite) return false
          if (reaction.nonEliteOnly && context.enemy?.elite) return false
          // 卡面「攻击与你交战的敌人」：目标必须正与出牌者交战。
          if (reaction.enemyEngagedWithYou && context.enemy?.engagedSeat !== inv.seat) return false
          if (reaction.treacheryOnly && context.cardCode
            && ALL_CARDS[context.cardCode]?.type !== 'treachery') return false
          if (reaction.requiresClue
            && !(state.locations.find(location => location.id === context.location)?.clues > 0)) return false
          if (reaction.requiresNoClues && inv.clues > 0) return false
          if (reaction.nonWeakness && context.enemy && isWeaknessCode(context.enemy.code)) return false
          if (reaction.failedByAtMost != null && (context.failedBy || 0) > reaction.failedByAtMost) return false
          if (reaction.successByAtLeast != null && (context.successBy || 0) < reaction.successByAtLeast) return false
          if (reaction.symbols && !reaction.symbols.includes(context.token)) return false
          if (reaction.requiresDifficultyAboveBase
            && !(Number(context.difficulty) > Number(context.baseValue ?? 0))) return false
          if (cannotPlayTypes(inv).has(cardDef(copyCode || code)?.type)) return false
          if (scenarioBehavior(state).canPlayCard?.(state, inv, cardDef(copyCode || code)) === false) return false
          if (inv.resources < playCost(state, inv, cardDef(copyCode || code))) return false
          // 04111 坚韧不拔等：criteria 写成函数/数组的新通道（旧的对象形字段展开保持原样）。
          if (descriptor?.criteria
            && (Array.isArray(descriptor.criteria) || typeof descriptor.criteria === 'function')
            && !evaluateCriteria(descriptor.criteria, { state, inv, source: null, windowId: when, context })) return false
          if (descriptor) {
            // resolve 型描述子自己判断可行性；数据体走效果解释器的校验。
            return Boolean(descriptor.resolve) || !effectError(state, inv, descriptor.effect)
          }
          return !effectError(state, inv, playedEffect(copyCode || code))
        })
      if (!candidates.length) break
      const answer = requestChoice(state, {
        kind: 'reaction', source: { type: 'window', when }, seat: inv.seat, canSkip: true,
        prompt: `是否打出快速反应卡？（${context.prompt}）`,
        options: [{ id: 'skip', label: '不打出' },
          ...candidates.map(({ code, copyCode, id, fromDiscard }) => ({ id, cardCode: code,
            label: (copyCode ? `彩绘世界复制「${cardName(copyCode)}」` : cardName(code))
              + (fromDiscard ? '（护身符：弃牌）' : '') }))],
      })
      if (answer === 'skip') break
      const chosen = candidates.find(item => item.id === answer)
      playReactionCard(state, inv, chosen.index, context, events, chosen.fromDiscard, chosen.copyCode, chosen.fromPlanAssetId)
    }
  }
  // 能力层：同一个窗口下，声明式反应/强制能力也在这里结算。
  return openAbilityWindow(state, when, context, events, opts)
}

// Phase 5（5a-25）：「离某调查员最远的地点」——弱点生成与 api 共用一份实现。

function triggerReaction(state, seat, when, events, context = {}) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return
  const entries = []
  const ab = investigatorRule(inv.code)
  for (const r of (ab && ab.reactions) || []) { if (!investigatorTextBlanked(state, inv)) entries.push({ r, type: 'investigator' }) }
  for (const asset of inv.assets) {
    const eff = assetEffect(inv, asset)
    if (!lolaCanUseCard(inv, asset.code)) continue
    for (const r of (eff && eff.reactions) || []) entries.push({ r, type: 'asset', asset })
    // Phase 5（5b-6）：同一张卡搬过来的反应描述子，按旧式询问顺序接在同一位置。
    for (const descriptor of descriptorsForWindow(asset.code, when, 'reaction')) {
      if (!descriptor.legacyReaction) continue
      entries.push({ r: descriptorReactionSpec(descriptor, when), type: 'asset', asset, descriptor })
    }
  }
  for (const entry of entries) {
    const r = entry.r
    if (r.when !== when) continue
    const asset = entry.asset
    if (r.selfOnly && context.seat != null && context.seat !== seat) continue
    if (r.nonElite && context.enemy?.elite) continue
    if (r.nonEliteOnly && context.enemy?.elite) continue
    if (r.treacheryOnly && context.cardCode
      && ALL_CARDS[context.cardCode]?.type !== 'treachery') continue
    if (r.requiresClue
      && !(state.locations.find(location => location.id === context.location)?.clues > 0)) continue
    if (r.requiresNoClues && inv.clues > 0) continue
    if (r.when === 'damageAssignedToSelf' && context.assetId && asset?.id !== context.assetId) continue
    if (r.nonWeakness && context.enemy && isWeaknessCode(context.enemy.code)) continue
    if (r.failedByAtMost != null && (context.failedBy || 0) > r.failedByAtMost) continue
    if (r.successByAtLeast != null && (context.successBy || 0) < r.successByAtLeast) continue
    if (r.assetCode && (context.assetCode !== r.assetCode || context.assetId !== asset?.id)) continue
    if (r.requiresAssetDamage && !context.damagedAssetIds?.includes(asset?.id)) continue
    if (r.symbols && !r.symbols.includes(context.token)) continue
    if (r.requiresAlone && aliveInvestigators(state).some(other => other.seat !== seat && other.location === inv.location)) continue
    // 描述子方向的条件函数（迁移来的数据是纯字段，这里通常为空）。
    if (r.criteriaFn && !evaluateCriteria(r.criteriaFn, { state, inv, source: asset, windowId: when, context })) continue
    const cost = r.cost || {}
    if (cost.exhaust && asset?.exhausted) continue
    if (cost.uses && (asset?.uses || 0) < cost.uses) continue
    if (cost.resources && inv.resources < cost.resources) continue
    if (cost.clues && inv.clues < cost.clues) continue
    if (!r.resolve && effectError(state, inv, r.effect)) continue
    const scope = r.limit === 'phase' ? `${state.round}:${state.phase}` : r.limit === 'turn' ? `${state.round}:turn` : state.round
    const key = (r.id || (asset?.code || inv.code)) + ':' + scope
    inv.usedReactions ||= {}
    if (r.limit && inv.usedReactions[key]) continue
    const answer = requestChoice(state, { kind: 'reaction', source: r.id || asset?.code || inv.code, seat,
      prompt: r.prompt || `是否触发 ${asset ? cardName(asset.code) : inv.name} 的反应？`, canSkip: true,
      automaticOptionId: isAutomaticReward(r) ? 'trigger' : null,
      options: [{ id: 'skip', label: '跳过反应' }, { id: 'trigger', label: '触发反应' }] })
    if (answer === 'skip') continue
    if (r.limit) inv.usedReactions[key] = true
    if (cost.exhaust && asset) asset.exhausted = true
    if (cost.uses && asset) asset.uses = Math.max(0, (asset.uses || 0) - cost.uses)
    if (cost.resources) inv.resources -= cost.resources
    if (cost.clues) {
      inv.clues -= cost.clues
      if (cost.returnClue) {
        const location = state.locations.find(loc => loc.id === inv.location)
        if (location) location.clues = (location.clues || 0) + cost.clues
      }
      syncClues(state)
    }
    if (cost.horror) applyHorror(state, inv, cost.horror, events, true)
    if (cost.damageSelf) { inv.damage += cost.damageSelf; checkDefeated(state, seat, events) }
    if (cost.discardSelf && asset) {
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
      info(state, events, `♻️ ${inv.name} 弃掉了「${cardName(asset.code)}」。`)
    }
    info(state, events, `⚡ ${inv.name} 触发「${asset ? cardName(asset.code) : (r.id || inv.name)}」的反应。`)
    const previousReaction = state._reaction
    const reactionState = { when, context, ...context }
    state._reaction = reactionState
    try {
      // Phase 5（5b-6）：迁移来的反应仍走效果解释器（数据体不变）；
      // 只有新写的 resolve 型反应才走自己的函数。
      if (r.resolve) {
        r.resolve({
          state, seat, inv,
          source: asset || { code: r.id || inv.code },
          descriptor: r.descriptor || null,
          window: when,
          context: reactionState,
          events,
          targetId: context?.targetId ?? null,
          target: null,
          api: abilityApi(state, events),
        })
      } else {
        const effect = { ...r.effect }
        if (context.enemy && effect.type === 'dealDamage' && !effect.target) effect.target = 'id:' + context.enemy.id
        if (context.enemy && effect.type === 'defeatNonEliteEnemy') effect.target = 'id:' + context.enemy.id
        resolveEffect(state, seat, effect, makeRuntime(state, events))
      }
    } finally {
      if (reactionState.testBonus) context.testBonus = (context.testBonus || 0) + reactionState.testBonus
      state._reaction = previousReaction
    }
    if (asset && assetEffect(inv, asset)?.discardWhenEmpty && asset.uses != null && asset.uses <= 0 && inv.assets.includes(asset)) {
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
      info(state, events, `「${cardName(asset.code)}」充能耗尽，弃掉。`)
    }
  }
  // 能力层：旧式 reactions 之后，同一个 when 也作为窗口开放给声明式描述子。
  openAbilityWindow(state, when, context, events)
}

// 行动点用尽后的收尾窗口里仍然可以打出的快速卡。
// 候选直接复用 legalMoves，保证打出条件、资源、槽位与「快速」判定和普通出牌同源
// （卡面 0 费、可支付、非弱点、非反应专属……都在同一处判定）。
function fastHandPlays(state, inv) {
  if (inv.seat !== state.currentSeat) return []
  const helpers = playConditionHelpers(state)
  return legalMoves(state).filter(move => move.action === 'play' && move.cardId
    && !move.fromDiscard && !move.fromPlanAssetId && !move.fromBackpackId && !move.copyCode
    && inv.hand.includes(move.cardId)
    && actionCost(state, inv, move) === 0
    // legalMoves 只做「区域/类型/费用」级筛选，打出条件由 validateMove 读；
    // 窗口里的快速卡必须同样过一遍，否则会绕过「只能在你回合期间打出」这类限制。
    && !playConditionError(state, inv, move.cardId, helpers))
}

// 玩家窗口（免费触发能力）。行动点花完时（opts.fastCards）额外列出 0 费的快速卡：
// 手牌里的「快速。只能在你回合期间打出」不能因为回合推进而失去唯一的打出时机。
function playerWindow(state, timing, events, restrictedSeat = null, opts = {}) {
  state.timingWindow = timing
  const participants = aliveInvestigators(state).filter(inv => restrictedSeat == null || inv.seat === restrictedSeat)
  const fastCardSeat = opts.fastCards === true ? state.currentSeat : null
  // 打不出去的快速卡只记一次，避免选项反复出现把窗口卡死。
  const blockedFast = new Set()
  let passed = 0
  let cursor = 0
  while (participants.length && passed < participants.length) {
    const inv = participants[cursor++ % participants.length]
    if (inv.defeated || inv.resigned) { passed++; continue }
    const options = []
    if (!cannotTriggerFreeAbility(state, inv)) {
      for (const asset of controlledAbilityCards(inv)) {
        for (const [index, ability] of (assetEffect(inv, asset)?.abilities || []).entries()) {
          // Phase 5：用 resolve 实现的免费能力没有 effect 数据体，可行性由 resolve 自己判断。
          if (ability.cost?.action !== false || !canAffordAbility(state, inv, asset, ability)
            || (!ability.descriptor?.resolve && effectError(state, inv, ability.effect))) continue
          if (!lolaCanUseCard(inv, asset.code)) continue
          // 能力层：免费能力只在它声明的窗口里出现（旧 DSL 能力没有 trigger，行为不变）。
          if (ability.windowTrigger?.length && !ability.windowTrigger.includes(timing)) continue
          if (ability.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) continue
          if (ability.oncePerTest && state.skillTest?.usedAbilities?.[`${asset.id}:${index}`]) continue
          if (ability.oncePerPhase && inv.usedAbilities?.[`${asset.id}:${index}:${state.round}:${state.phase}`]) continue
          if (ability.descriptor && limitUsed(state, inv, ability.descriptor, null, timing, asset)) continue
          const targets = abilityTargets(state, inv, ability.effect)
          for (const targetId of targets.length ? targets.map(target => target.id) : [null]) options.push({
            id: `${asset.id}:${index}:${targetId || ''}`, label: `${cardName(asset.code)}：${ability.label}`,
            assetId: asset.id, index, targetId,
          })
        }
      }
    }
    if (inv.seat === fastCardSeat) {
      for (const move of fastHandPlays(state, inv)) {
        if (blockedFast.has(move.cardId)) continue
        const resourceCost = playCost(state, inv, cardDef(move.cardId))
        options.push({ id: `fast-card:${move.cardId}`,
          label: `⚡ 快速打出「${cardName(move.cardId)}」${resourceCost ? `（${resourceCost} 资源）` : ''}`,
          cardCode: move.cardId })
      }
    }
    if (!options.length) { passed++; continue }
    const answer = requestChoice(state, { kind: 'playerWindow', source: timing, seat: inv.seat,
      prompt: inv.seat === fastCardSeat && options.some(option => option.cardCode)
        ? '回合结束前：可以打出快速卡或使用免费触发能力，或让过。'
        : `${playerWindowLabel(timing)}：可以使用免费触发能力，或让过。`, canSkip: true,
      options: [{ id: 'skip', label: '让过' }, ...options.map(({ id, label, assetId, index, targetId }) => ({ id, label, assetId, abilityIndex: index, targetId }))] })
    if (answer === 'skip') { passed++; continue }
    passed = 0
    const chosen = options.find(option => option.id === answer)
    if (chosen.cardCode) {
      const before = inv.hand.filter(code => code === chosen.cardCode).length
      doPlay(state, inv.seat, chosen.cardCode, events, false, true)
      const after = state.investigators[inv.seat].hand.filter(code => code === chosen.cardCode).length
      if (after >= before) blockedFast.add(chosen.cardCode)
      continue
    }
    doAbility(state, inv.seat, chosen.assetId, chosen.index, chosen.targetId, null, events)
  }
  state.timingWindow = null
}

// 第 2 步 P2.2：从第二遭遇牌堆抽一张并走同一条显现管线。
function drawExtraEncounter(state, inv, events, deckId) {
  return drawEncounter(state, inv, events, { deck: deckId })
}

  return { drawEncounter, drawExtraEncounter, reactionWindow, triggerReaction, playerWindow }
}
