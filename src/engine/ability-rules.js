// ability-rules.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 能力层的规则侧：描述子的可用性 / 费用 / 目标枚举 / 修正来源枚举。
// 读点：canAffordAbility + payAbilityCost（legalMoves 与 doAbility 共用）、
// descriptorSources（窗口枚举）、nonPlayerAbilitySources（D1 非玩家卡）。
export function createAbilityRules(deps) {
  const {
    all,
    aloofPreventsAttack,
    applyDamage,
    applyHorror,
    cannotPlayTypes,
    capabilityBlocked,
    cardDef,
    cardName,
    controlledAbilityCards,
    costIsDynamic,
    defeatEnemy,
    describeCost,
    discardChosenCards,
    discardableHandCards,
    doAbility,
    effectAbilitySources,
    enemiesEngagedWith,
    enemyRuleFlags,
    enemyTextBlanked,
    exilePlayerCard,
    getMaxSanity,
    hasNonPlayerBehavior,
    engagedWithClueBlocker,
    hiddenFightBlocked,
    info,
    isWeaknessCode,
    leaveAsset,
    legalMoves,
    limitUsed,
    normalizeCostValues,
    openAbilityWindow,
    playCost,
    registeredEntry,
    scenarioBehavior,
    scenarioResignAvailable,
    syncClues,
  } = deps

  function payAbilityCost(state, inv, source, cost = {}, events, descriptor = null) {
    // Phase 2（C3）：先把费用表达式求值成数字——校验与扣费必须用同一份结果，
    // 否则「每有 1 个线索付 1 资源」会在校验和扣费之间看到不同的线索数。
    const resolved = normalizeCostValues(cost, { state, inv, source, descriptor })
    if (!resolved) return false
    cost = resolved
    // 先整体校验，再逐项扣费：避免「付了一半失败」留下部分修改。
    if (cost.exhaust && (!source || source.exhausted)) return false
    if (cost.uses && (source?.uses || 0) < cost.uses) return false
    if (cost.resources && inv.resources < cost.resources) return false
    if (cost.clues && (inv.clues || 0) < cost.clues) return false
    if (cost.clues && engagedWithClueBlocker(state, inv)) return false
    if (cost.discardHand && discardableHandCards(inv, cost.discardHandIcon).length < cost.discardHand) return false
    if (cost.exhaust) source.exhausted = true
    if (cost.uses) source.uses -= cost.uses
    if (cost.resources) inv.resources -= cost.resources
    if (cost.clues) {
      inv.clues -= cost.clues
      syncClues(state)
    }
    if (cost.discardHand) discardChosenCards(state, inv, cost.discardHand, events, source?.code, cost.discardHandIcon)
    if (cost.horror) applyHorror(state, inv, cost.horror, events)
    if (cost.damageSelf) applyDamage(state, inv, cost.damageSelf, events, true)
    if (cost.assetDamage && source) {
      source.damage = (source.damage || 0) + cost.assetDamage
      const def = cardDef(source.code)
      if (def?.health > 0 && source.damage >= def.health) {
        leaveAsset(state, inv, source)
        if (!source.removedFromGame) inv.discard.push(source.code)
        info(state, events, `${cardName(source.code)} 因自身伤害被弃置。`)
      }
    }
    if (cost.discardSelf && source) {
      leaveAsset(state, inv, source)
      if (!source.removedFromGame) inv.discard.push(source.code)
      info(state, events, `♻️ ${inv.name} 弃掉了「${cardName(source.code)}」。`)
    }
    if (cost.exileSelf && source) {
      leaveAsset(state, inv, source)
      exilePlayerCard(state, inv, source.code, events)
    }
    return true
  }

  function descriptorCost(descriptor) {
    return descriptor.kind === 'free' ? { ...descriptor.cost, action: false } : descriptor.cost
  }

  function descriptorUsable(state, inv, source, descriptor, { windowId = null, context = {}, mode = 'window' } = {}) {
    const timing = state.timingWindow
    if (mode === 'free') {
      if (descriptor.kind !== 'free') return false
      if (descriptor.trigger.length && !descriptor.trigger.includes(timing)) return false
    } else if (mode === 'action') {
      if (!['action', 'free'].includes(descriptor.kind)) return false
      if (descriptor.kind === 'free' && descriptor.trigger.length && !descriptor.trigger.includes(timing)) return false
    } else if (!['reaction', 'forced'].includes(descriptor.kind)) {
      return false
    }
    if (descriptor.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return false
    // Phase 2（C1）：capability:triggerAbilities 只禁止"可选"的能力；
    // forced（强制）在规则上仍然结算，不能被"不能触发能力"挡住。
    if (descriptor.kind !== 'forced' && capabilityBlocked(state, inv, 'triggerAbilities')) return false
    if (descriptor.requiresNoClues) {
      const here = state.locations.find(location => location.id === inv.location)
      if (here && here.clues > 0) return false
    }
    if (limitUsed(state, inv, descriptor, context, windowId, source)) return false
    // 手牌事件按打出费用结算，不套用资产的「横置/充能」检查。
    if (descriptor.fromHand) {
      // 手牌事件必须先还在手里（反应窗口可能在结算后再次枚举）。
      if (!(inv.hand || []).includes(descriptor.code)) return false
      const def = cardDef(descriptor.code)
      if (!def) return false
      if (cannotPlayTypes(inv).has(def.type)) return false
      if (!descriptor.noPlayCost && inv.resources < playCost(state, inv, def)) return false
    } else if (!canAffordAbility(state, inv, source, { cost: descriptorCost(descriptor), descriptor })) return false
    if (descriptor.criteria && !evaluateCriteria(descriptor.criteria, {
      state, inv, source, windowId, context,
      // 条件里常用的读点：内容层不直接 import 引擎，也不需要 api 的完整面。
      helpers: {
        isWeakness: code => isWeaknessCode(code),
        cardType: code => cardDef(code)?.type || null,
        cardTraits: code => cardDef(code)?.traits || [],
        canGainResources: () => scenarioBehavior(state).canGainResources?.(state, inv) !== false,
      },
    })) return false
    return true
  }

  function evaluateCriteria(criteria, ctx) {
    if (criteria == null) return true
    const list = Array.isArray(criteria) ? criteria : [criteria]
    return all(...list)(ctx)
  }

  function descriptorSources(state, inv) {
    const out = []
    for (const card of controlledAbilityCards(inv)) {
      const entry = registeredEntry(card.code)
      if (entry?.abilities.length) out.push({ source: card, code: card.code, entry })
    }
    const investigatorEntry = registeredEntry(inv.code)
    if (investigatorEntry?.abilities.length) {
      out.push({ source: { investigator: inv.seat, code: inv.code }, code: inv.code, entry: investigatorEntry })
    }
    for (const [index, code] of (inv.hand || []).entries()) {
      const entry = registeredEntry(code)
      if (!entry?.abilities.length) continue
      out.push({ source: null, code, entry, fromHandIndex: index })
    }
    // Phase 1（A1）：持续效果也可以挂反应/强制能力（"本阶段内每当……"类卡面）。
    // 它们只在效果有效期内出现，来源是效果记录本身（上限/条件读点与卡片一致）。
    for (const { effect, abilities } of effectAbilitySources(state, inv.seat)) {
      const code = effect.sourceCode || 'effect'
      out.push({ source: { effectId: effect.id, code }, code, entry: { abilities }, effect })
    }
    // Phase 3（D1）：非玩家卡（敌人/地点/幕/议程/剧情支援）的能力来源。
    // descriptorSources 的签名没有 window context，实体能力因此读 state；
    // 窗口上下文里带但已离场的实体（被击败的敌人）在 openAbilityWindow 里补一次。
    for (const row of nonPlayerAbilitySources(state)) out.push(row)
    return out
  }

  function entityAbilityEntry(entity) {
    for (const code of [entity?.originalCode, entity?.code]) {
      if (!code || !hasNonPlayerBehavior(code)) continue
      const entry = registeredEntry(code)
      if (entry?.abilities.length) return { entry, code }
    }
    return null
  }

  function nonPlayerAbilitySources(state, context = {}) {
    const out = []
    const seen = new Set()
    const push = (entity, { requireRevealed = false } = {}) => {
      if (!entity) return
      if (requireRevealed && !entity.revealed) return
      const key = entity.id ?? entity.code
      if (key != null) {
        if (seen.has(key)) return
        seen.add(key)
      }
      const found = entityAbilityEntry(entity)
      if (!found) return
      out.push({ source: entity, code: found.code, entry: found.entry })
    }
    for (const enemy of state.enemies || []) {
      if (enemy.defeated || enemy.removedFromGame) continue
      push(enemy)
    }
    for (const location of state.locations || []) push(location, { requireRevealed: true })
    push((state.acts || [])[state.actIndex])
    push((state.agendas || [])[state.agendaIndex])
    for (const asset of state.storyAssets || []) push(asset)
    // 窗口上下文里带的实体也算来源：`defeatEnemy` 打开时敌人已经从 state 移除，
    // 但它的「被击败时」能力仍然要结算（来源就是这次结算的敌人本身）。
    push(context.enemy)
    if (context.location != null) {
      const location = (state.locations || []).find(entry => entry.id === context.location)
      push(location, { requireRevealed: true })
    }
    return out
  }

  function playConditionHelpers(state) {
    return {
      maxSanity: inv => getMaxSanity(inv),
      resignAvailable: () => scenarioResignAvailable(state),
    }
  }

  function canAffordAbility(state, inv, asset, ability) {
    const cost = normalizeCostValues(ability.cost || {}, { state, inv, source: asset, descriptor: ability.descriptor || null })
    if (!cost) return false
    if (cost.exhaust && asset?.exhausted) return false
    if (cost.uses && (asset?.uses || 0) < cost.uses) return false
    if (cost.resources && inv.resources < cost.resources) return false
    if (cost.clues && (inv.clues || 0) < cost.clues) return false
    if (cost.clues && engagedWithClueBlocker(state, inv)) return false
    if (cost.discardHand && discardableHandCards(inv, cost.discardHandIcon).length < cost.discardHand) return false
    if (cost.damageSelf && inv.damage + cost.damageSelf >= inv.health) return false
    if (ability.maximumInvestigatorDamage != null && inv.damage > ability.maximumInvestigatorDamage) return false
    if (ability.maxClicks != null && (asset.clicks || 0) >= ability.maxClicks) return false
    return true
  }

  function costPreviewSuffix(state, inv, source, ability) {
    const raw = ability?.cost
    if (!raw || !costIsDynamic(raw)) return null
    const resolved = normalizeCostValues(raw, { state, inv, source, descriptor: ability.descriptor || null })
    if (!resolved) return '（费用不合法）'
    const text = describeCost(raw, { state, inv, source })
    return text ? `（${text}）` : null
  }

  function abilityTargets(state, inv, effect) {
    if (!effect) return []
    if (effect.type === 'dealDamage') {
      if (effect.target === 'here') return state.enemies.filter((e) => e.location === inv.location)
      return enemiesEngagedWith(state, inv) // 'engaged' 或默认交战
    }
    if (effect.type === 'fight') return state.enemies.filter(enemy => enemy.location === inv.location
      && (!effect.requireNotEngagedTarget || enemy.engagedSeat !== inv.seat)
      && !aloofPreventsAttack(state, inv, enemy, effect)
      && (!enemyRuleFlags(enemy.code).damageOnlyFrom || enemyTextBlanked(state, enemy))
      && !hiddenFightBlocked(state, inv, enemy))
    if (effect.type === 'evade') return enemiesEngagedWith(state, inv)
    return []
  }

  function applyAbilityTarget(effect, targetId) {
    if (!effect) return effect
    if (effect.type === 'dealDamage') return { ...effect, target: 'id:' + targetId }
    if (effect.type === 'fight' || effect.type === 'evade') return { ...effect, enemyId: targetId }
    return effect
  }

  return { payAbilityCost, descriptorCost, descriptorUsable, evaluateCriteria, descriptorSources, entityAbilityEntry, nonPlayerAbilitySources, playConditionHelpers, canAffordAbility, costPreviewSuffix, abilityTargets, applyAbilityTarget }
}
