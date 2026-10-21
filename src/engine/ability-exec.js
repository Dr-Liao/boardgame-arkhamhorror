// 能力执行（doAbility / openAbilityWindow / effectError）从 engine.js 拆出的模块
// （Phase 6 · 6d-16）。
//
// 这三个函数构成「能力层」在引擎侧的落地：
//   · doAbility       —— 结算一次已选定的能力（含费用、目标、描述子/旧式效果）
//   · openAbilityWindow —— 在反应窗口里枚举可用的声明式能力并询问
//   · effectError     —— 判定一条效果当前是否可执行（legalMoves / 提示共用）
// 它们与 src/engine/ability.js（注册表、校验）分工不同：那边是「声明」，这边是「执行」。
//
// 依赖注入同前几批；本模块没有工厂产物依赖。

export function createAbilityExecution(deps) {
  const {
    capabilityBlocked,
    abilityTargets,
    aliveInvestigators,
    applyAbilityTarget,
    applyDamage,
    applyHorror,
    assetEffect,
    assetReplacementPlans,
    autoEvadeNonElite,
    blankEnemy,
    cardDef,
    cardName,
    controlledAbilityCard,
    damagedTargetsAtLocation,
    dealDamageAll,
    dealDamageExhausted,
    decideSeatFor,
    descriptorSources,
    descriptorUsable,
    descriptorsInEntry,
    discardChosenCards,
    discardLocked,
    discardableHandCards,
    effectDefinitionError,
    executeDescriptor,
    exilePlayerCard,
    healDamageAtLocation,
    info,
    investigateForResources,
    investigatorMoveDestinations,
    isWeaknessCard,
    isWeaknessCode,
    leaveAsset,
    lolaCanUseCard,
    makeRuntime,
    nonPlayerAbilitySources,
    normalizeCostValues,
    noteUnknownWindow,
    playCost,
    rechargeAsset,
    reloadAmmo,
    requestChoice,
    resolveEffect,
    returnAssetToHand,
    searchTop,
    shuffleIntoEncounter,
    spendAction,
    syncClues,
    windowLabelOf,
  } = deps

function doAbility(state, seat, assetId, abilityIndex, targetId, optionIndex, events) {
  const inv = state.investigators[seat]
  const asset = controlledAbilityCard(inv, assetId)
  if (!asset) return
  // Phase 2（C1）：capability:triggerAbilities。
  if (capabilityBlocked(state, inv, 'triggerAbilities')) return
  if (!lolaCanUseCard(inv, asset.code)) return
  const eff = assetEffect(inv, asset)
  const ability = eff && eff.abilities && eff.abilities[abilityIndex]
  if (!ability) return
  // 能力层描述子：成本、上限、日志与 resolve 走同一条路径，不再经过效果 DSL。
  if (ability.descriptor) {
    const descriptor = ability.descriptor
    if (!descriptorUsable(state, inv, asset, descriptor, { windowId: state.timingWindow, mode: 'action' })) return
    executeDescriptor(state, { inv, source: asset, descriptor, context: { targetId, optionIndex },
      events, windowId: state.timingWindow, legacyAbilityLog: true })
    return
  }
  // Phase 2（C3）：旧式能力也走同一份费用求值（动态费用不再只有描述子能用）。
  const cost = normalizeCostValues(ability.cost || {}, { state, inv, source: asset, descriptor: ability.descriptor || null }) || {}
  // 「围困」等：每次检定只能使用一次。
  if (ability.oncePerTest && state.skillTest?.usedAbilities?.[`${asset.id}:${abilityIndex}`]) return
  // 「雅沃托」等：每阶段只能使用一次。
  if (ability.oncePerPhase
    && inv.usedAbilities?.[`${asset.id}:${abilityIndex}:${state.round}:${state.phase}`]) return

  if (cost.exhaust) {
    if (asset.exhausted) return
    asset.exhausted = true
  }
  if (cost.uses) {
    if ((asset.uses || 0) < cost.uses) return
    asset.uses -= cost.uses
  }
  if (cost.resources) {
    if (inv.resources < cost.resources) return
    inv.resources -= cost.resources
  }
  // 「一目十行」等：以个人线索作为能力费用。
  if (cost.clues) {
    if ((inv.clues || 0) < cost.clues) return
    inv.clues -= cost.clues
    syncClues(state)
  }
  if (cost.discardHand) {
    if (discardableHandCards(inv, cost.discardHandIcon).length < cost.discardHand) return
    discardChosenCards(state, inv, cost.discardHand, events, asset.code, cost.discardHandIcon)
  }
  if (cost.horror) applyHorror(state, inv, cost.horror, events)
  if (cost.damageSelf) applyDamage(state, inv, cost.damageSelf, events, true)
  if (cost.assetDamage && asset) {
    asset.damage = (asset.damage || 0) + cost.assetDamage
    const assetDef = cardDef(asset.code)
    if (assetDef?.health > 0 && asset.damage >= assetDef.health) {
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
      info(state, events, `${cardName(asset.code)} 因自身伤害被弃置。`)
    }
  }
  if (cost.action !== false) spendAction(state, inv)
  if (ability.oncePerTest) {
    state.skillTest.usedAbilities ||= {}
    state.skillTest.usedAbilities[`${asset.id}:${abilityIndex}`] = true
  }
  if (ability.oncePerPhase) {
    inv.usedAbilities ||= {}
    inv.usedAbilities[`${asset.id}:${abilityIndex}:${state.round}:${state.phase}`] = true
  }
  if (cost.discardSelf) {
    leaveAsset(state, inv, asset)
    if (!asset.removedFromGame) inv.discard.push(asset.code)
    info(state, events, `♻️ ${inv.name} 弃掉了「${cardName(asset.code)}」。`)
  }
  if (cost.exileSelf) {
    leaveAsset(state, inv, asset)
    exilePlayerCard(state, inv, asset.code, events)
  }

  // 目标选择（targetId）与 choose 分支（optionIndex）由 AI/前端传入，注入到效果上。
  let effect = { ...ability.effect, assetId: asset.id }
  if (targetId != null) effect = applyAbilityTarget(effect, targetId)
  if (optionIndex != null) effect = { ...effect, optionIndex }

  info(state, events, `✨ ${inv.name} 使用「${cardName(asset.code)}」的能力：${ability.label}。`)
  resolveEffect(state, seat, effect, makeRuntime(state, events))

  if (eff.discardWhenEmpty && asset.uses != null && asset.uses <= 0) {
    leaveAsset(state, inv, asset)
    if (!asset.removedFromGame) inv.discard.push(asset.code)
    info(state, events, `「${cardName(asset.code)}」充能耗尽，弃掉。`)
  }
}

// ---------------------------------------------------------------------------
// 能力层（P0-A）：声明式描述子的执行与窗口收集
// ---------------------------------------------------------------------------

// 能力 resolve() 可用的窄接口。只用引擎已有的入口，避免内容层直接改状态。
// Phase 6（6d-7）：abilityApi 按域拆分的依赖表（第一批：卡牌/状态写入口）。

function openAbilityWindow(state, windowId, context, events) {
  noteUnknownWindow(windowId)
  if (state._reaction || state._abilityWindow) return context
  state._abilityWindow = true
  try {
    // 1) 强制能力：无条件结算，不询问。
    //    先玩家卡（逐座位），再非玩家卡（每张实体卡一次，由决定座位代表执行）。
    for (const inv of aliveInvestigators(state)) {
      for (const { source, code, fromHandIndex, entry, effect } of descriptorSources(state, inv)) {
        for (const descriptor of descriptorsInEntry(entry, windowId, 'forced')) {
          if (!descriptorUsable(state, inv, source, descriptor, { windowId, context })) continue
          if (descriptor.fromHand && fromHandIndex == null) continue
          executeDescriptor(state, { inv, source, descriptor, context, events, windowId, fromHandIndex, effect })
          if (state.pendingChoice) return context
        }
      }
    }
    // Phase 3（D1）：实体卡的强制能力。窗口 context 里带但已离场的实体（被击败的敌人）
    // 也从 context 补一次，否则「被击败时」这类强制能力永远不结算。
    // 同一个窗口实例只结算一次：引擎对部分事件会先后开 triggerReaction 与 reactionWindow，
    // 两边都进到这里，卡面强制效果不能因此翻倍。
    {
      const seat = decideSeatFor(state, context)
      const inv = seat == null ? null : state.investigators[seat]
      if (inv) {
        // 只按「窗口 + 本轮/阶段/回合 + 相关实体」去重：同一事件的两次窗口调用
        // 上下文可能一个带 seat 一个不带，不能用 windowInstanceKey 原样做键。
        const instanceKey = [windowId, state.round, state.phase, state.turnSerial ?? 0,
          context.enemy?.id ?? '', context.location ?? '', context.cardCode ?? ''].join('|')
        for (const { source, entry } of nonPlayerAbilitySources(state, context)) {
          for (const descriptor of descriptorsInEntry(entry, windowId, 'forced')) {
            const markKey = `entityWindow:${instanceKey}:${descriptor.id}:${source?.id ?? descriptor.code}`
            if (state.abilityLimits?.[markKey]) continue
            if (!descriptorUsable(state, inv, source, descriptor, { windowId, context })) continue
            state.abilityLimits ||= {}
            state.abilityLimits[markKey] = { used: 1, round: state.round, phase: state.phase, turn: state.turnSerial ?? 0 }
            executeDescriptor(state, { inv, source, descriptor, context, events, windowId })
            if (state.pendingChoice) return context
          }
        }
      }
    }
    // 2) 可选反应：逐个座位询问，直到让过。
    for (const inv of aliveInvestigators(state)) {
      const candidates = []
      for (const { source, code, fromHandIndex, entry, effect } of descriptorSources(state, inv)) {
        for (const descriptor of descriptorsInEntry(entry, windowId, 'reaction')) {
          // Phase 5（5b-6）：从旧式 reactions 搬来的反应由 triggerReaction 用旧式询问结算，
          // 这里跳过，避免同一张卡在两个提示里各出现一次。
          if (descriptor.legacyReaction) continue
          if (descriptor.fromHand && !(inv.hand || []).includes(code)) continue
          if (!descriptorUsable(state, inv, source, descriptor, { windowId, context })) continue
          candidates.push({ source, code, descriptor, fromHandIndex, effect })
        }
      }
      if (!candidates.length) continue
      let guard = 0
      while (guard++ < 12) {
        const usable = candidates.filter(item => descriptorUsable(state, inv, item.source, item.descriptor, { windowId, context }))
        if (!usable.length) break
        const options = [{ id: 'skip', label: '不触发' }]
        for (const item of usable) {
          const id = `desc:${item.descriptor.id}:${item.source?.id ?? item.effect?.id ?? 'hand'}`
          options.push({ id, label: `【能力】${cardName(item.code)}：${item.descriptor.label}`, cardCode: item.code })
        }
        const answer = requestChoice(state, {
          kind: 'reaction', source: { type: 'window', when: windowId }, seat: inv.seat, canSkip: true,
          prompt: `是否触发反应能力？（${windowLabelOf(windowId)}${context?.prompt ? '／' + context.prompt : ''}）`,
          options,
        })
        if (answer === 'skip') break
        const chosen = usable.find(item => `desc:${item.descriptor.id}:${item.source?.id ?? item.effect?.id ?? 'hand'}` === answer)
        if (!chosen) break
        executeDescriptor(state, { inv, source: chosen.source, descriptor: chosen.descriptor, context, events,
          windowId, fromHandIndex: chosen.fromHandIndex, effect: chosen.effect })
      }
    }
    // 3) 非玩家卡：同一个窗口里只问一次，由决定座位代表调查队作答。
    const nonPlayer = nonPlayerAbilitySources(state, context)
    if (nonPlayer.length) {
      const seat = decideSeatFor(state, context)
      const inv = seat == null ? null : state.investigators[seat]
      if (inv) {
        const usable = []
        for (const { source, code, entry } of nonPlayer) {
          for (const descriptor of descriptorsInEntry(entry, windowId, 'reaction')) {
            if (!descriptorUsable(state, inv, source, descriptor, { windowId, context })) continue
            usable.push({ source, code, descriptor })
          }
        }
        if (usable.length) {
          const options = [{ id: 'skip', label: '不触发' }]
          for (const item of usable) {
            options.push({ id: `entity:${item.descriptor.id}:${item.source?.id ?? item.code}`,
              label: `【卡面】${cardName(item.code)}：${item.descriptor.label}`, cardCode: item.code })
          }
          const answer = requestChoice(state, {
            kind: 'reaction', source: { type: 'window', when: windowId, seat: 'entity' }, seat: inv.seat, canSkip: true,
            prompt: `是否触发场景卡的反应能力？（${windowLabelOf(windowId)}${context?.prompt ? '／' + context.prompt : ''}）`,
            options,
          })
          if (answer !== 'skip') {
            const chosen = usable.find(item => `entity:${item.descriptor.id}:${item.source?.id ?? item.code}` === answer)
            if (chosen) {
              executeDescriptor(state, { inv, source: chosen.source, descriptor: chosen.descriptor, context, events, windowId })
            }
          }
        }
      }
    }
  } finally {
    delete state._abilityWindow
  }
  return context
}

function effectError(state, inv, effect) {
  const definition = effectDefinitionError(effect)
  if (definition || !effect) return definition
  if (effect.type === 'readyAsset' && !inv.assets.some(a => a.exhausted)) return '没有需要重整的支援'
  if (effect.type === 'heal' && !(effect.what === 'horror' ? inv.horror > 0 : effect.what === 'both' ? inv.damage > 0 || inv.horror > 0 : inv.damage > 0)) return '没有可治疗的伤害或恐惧'
  if (effect.type === 'healDamageAtLocation' && !damagedTargetsAtLocation(state, inv.seat).length) return '同地点没有可治疗的调查员或盟友'
  if (effect.type === 'evade' && effect.allAtLocation) {
    if (!state.enemies.some(enemy => enemy.location === inv.location)) return '这里没有可躲避的敌人'
  } else if (['fight', 'evade', 'dealDamage'].includes(effect.type) && !abilityTargets(state, inv, effect).length) return '没有合法敌人目标'
  if (effect.type === 'chooseOne' && effect.options.every(option => effectError(state, inv, option.effect))) return '没有可执行的效果选项'
  if (effect.type === 'investigate') {
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || loc.locked || loc.clues <= 0) return '这里不能调查'
  }
  if (effect.type === 'discoverClue') {
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || loc.clues <= 0) return '这里没有线索'
  }
  if (effect.type === 'reloadAmmo') {
    const roots = aliveInvestigators(state).filter(item => item.location === inv.location)
    const hasTarget = roots.some(owner => owner.assets.some(asset => {
      const eff = assetEffect(inv, asset)
      if (!eff || eff.uses == null || (eff.usesType || 'charges') !== 'ammo') return false
      if (effect.trait && !(cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === String(effect.trait).toLowerCase())) return false
      return true
    }))
    if (!hasTarget) return '这里没有可装填的枪械'
  }
  if (effect.type === 'rechargeAsset') {
    const hasTarget = inv.assets.some(asset => {
      const eff = assetEffect(inv, asset)
      if (!eff || eff.uses == null) return false
      if (effect.trait && !(cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === String(effect.trait).toLowerCase())) return false
      return true
    })
    if (!hasTarget) return '没有可充能的法术支援'
  }
  if (effect.type === 'search' && !inv.deck.length) return '牌库中没有可搜索的牌'
  if (effect.type === 'searchTop' && !inv.deck.length) return '牌库中没有可搜索的牌'
  if (effect.type === 'investigateForResources') {
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || loc.locked) return '这里不能调查'
  }
  if (effect.type === 'moveTo') {
    if (!investigatorMoveDestinations(state, inv.seat, effect).length) return '没有可移动的地点'
  }
  if (effect.type === 'dealDamageAll') {
    const locations = effect.location === 'choice'
      ? [inv.location, ...((state.locations.find(item => item.id === inv.location)?.connections) || [])]
      : [inv.location]
    const hasTarget = state.enemies.some(enemy => locations.includes(enemy.location))
      || (effect.investigators && aliveInvestigators(state).some(item => locations.includes(item.location)))
    if (!hasTarget) return '这里没有可造成伤害的目标'
  }
  if (effect.type === 'dealDamageExhausted' && !state.enemies.some(enemy => enemy.location === inv.location && enemy.exhausted)) return '这里没有已横置的敌人'
  if (effect.type === 'blankEnemy' && !state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite)) return '这里没有非精英敌人'
  if (effect.type === 'autoEvadeNonElite' && !state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite)) return '这里没有非精英敌人'
  if (effect.type === 'tfaInvestigator') {
    if (effect.action === 'playAllyDiscounted') {
      const cost = code => Math.max(0, playCost(state, inv, cardDef(code)) - (effect.amount || 0))
      const ally = inv.hand.some(code => cardDef(code)?.type === 'asset'
        && (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')
        && inv.resources >= cost(code))
      if (!ally) return '手牌中没有可打出的盟友支援'
    }
    if (effect.action === 'investigateAction') {
      const loc = state.locations.find(item => item.id === inv.location)
      if (!loc || loc.locked || loc.clues <= 0) return '这里不能调查'
    }
  }
  if (effect.type === 'searchTop' && !inv.deck.length) return '牌库中没有可搜索的牌'
  if (effect.type === 'investigateForResources') {
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || loc.locked) return '这里不能调查'
  }
  if (effect.type === 'moveTo') {
    if (!investigatorMoveDestinations(state, inv.seat, effect).length) return '没有可移动的地点'
  }
  if (effect.type === 'dealDamageAll') {
    const locations = effect.location === 'choice'
      ? [inv.location, ...((state.locations.find(item => item.id === inv.location)?.connections) || [])]
      : [inv.location]
    const hasTarget = state.enemies.some(enemy => locations.includes(enemy.location))
      || (effect.investigators && aliveInvestigators(state).some(item => locations.includes(item.location)))
    if (!hasTarget) return '这里没有可造成伤害的目标'
  }
  if (effect.type === 'dealDamageExhausted' && !state.enemies.some(enemy => enemy.location === inv.location && enemy.exhausted)) return '这里没有已横置的敌人'
  if (effect.type === 'blankEnemy' && !state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite)) return '这里没有非精英敌人'
  if (effect.type === 'autoEvadeNonElite' && !state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite)) return '这里没有非精英敌人'
  if (effect.type === 'shuffleIntoEncounter' && !state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite && !isWeaknessCode(enemy.code))) return '这里没有可洗回遭遇牌库的敌人'
  if (effect.type === 'returnAssetToHand' && effect.assetId && !inv.assets.some(asset => asset.id === effect.assetId)) return '未找到要返回手牌的资产'
  if (effect.type === 'carcosaInvestigator' && effect.action === 'yorickPlayAsset'
    && (discardLocked(state, inv) || !inv.discard.some(code => {
      const def = cardDef(code)
      return def?.type === 'asset' && !isWeaknessCard(def) && inv.resources >= playCost(state, inv, def)
        && assetReplacementPlans(inv, def).length > 0
    }))) return '弃牌堆中没有可打出的支援'
  if (effect.type === 'carcosaInvestigator' && effect.action === 'sefinaDrawBeneath' && !inv.beneath?.length) return '赛菲娜下方没有事件'
  if (effect.type === 'targetedEffect' && effect.effect) {
    const targets = aliveInvestigators(state).filter(other => effect.target === 'self' ? other.seat === inv.seat : effect.target === 'location' ? other.location === inv.location : true)
      .filter(other => !effect.activeTurnOnly || (state.phase === 'investigation' && other.seat === state.currentSeat && !other.turnEnded))
    if (!targets.some(other => !effectError(state, other, effect.effect))) return '没有合法调查员目标'
  }
  return null
}

  return { doAbility, openAbilityWindow, effectError }
}
