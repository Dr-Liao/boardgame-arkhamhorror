// hidden-rules.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 「隐私卡 / 文本空白 / 布尔规则」的读点：隐藏卡（hidden）、被清空的调查员/敌人文本、
// 敌人能否攻击/被攻击/引发借机攻击，以及移动前的禁止判定。
export function createHiddenRules(deps) {
  const {
    capabilityBlocked,
    cardName,
    entityRuleActive,
    info,
    isTextBlankEnemy,
    privateInfo,
    scenarioBehavior,
  } = deps

  function hiddenDefinition(state, code) {
    const definition = state.scenario?.treacheries?.[code]
    return definition?.hidden ? definition : null
  }

  function hiddenRule(state, code) {
    return hiddenDefinition(state, code)?.hiddenRule || null
  }

  function hasHiddenCard(inv, code = null) {
    return (inv.hiddenCards || []).some(hidden => code == null || hidden === code)
  }

  function removeHiddenMarker(inv, code) {
    const index = (inv.hiddenCards || []).indexOf(code)
    if (index >= 0) inv.hiddenCards.splice(index, 1)
  }

  function canDiscardFromHand(inv, code) {
    return !hasHiddenCard(inv, code)
  }

  function discardHiddenCard(state, inv, code, events) {
    const handIndex = inv.hand.indexOf(code)
    if (handIndex < 0 || !hasHiddenCard(inv, code)) return false
    inv.hand.splice(handIndex, 1)
    removeHiddenMarker(inv, code)
    state.encounterDiscard.push(code)
    info(state, events, `${inv.name} 弃掉了隐私牌「${cardName(code)}」。`)
    return true
  }

  function placeHiddenCard(state, inv, definition, events) {
    inv.hand.push(definition.code)
    inv.hiddenCards ||= []
    inv.hiddenCards.push(definition.code)
    info(state, events, `${inv.name} 秘密将一张隐私遭遇卡加入手牌。`)
    privateInfo(state, events, inv.seat, `你秘密将「${definition.name}」加入手牌：${definition.text || ''}`, {
      kind: 'automatic', phase: state.phase, round: state.round, text: `你获得隐私牌「${definition.name}」`,
      code: definition.originalCode || definition.code, name: definition.name, effect: 'encounter', seat: inv.seat,
    })
  }

  function activeHiddenRules(state, inv) {
    return (inv.hiddenCards || []).map(code => ({ code, rule: hiddenRule(state, code) }))
      .filter(item => item.rule)
  }

  function cannotTriggerFreeAbility(state, inv) {
    // Phase 2（C1）：能力禁止走声明式修正（capability:triggerAbilities），
    // 不再需要给「不能触发能力」类卡面加引擎字段。
    if (capabilityBlocked(state, inv, 'triggerAbilities')) return true
    return activeHiddenRules(state, inv).some(item => item.rule.cannotTriggerFree)
  }

  function hiddenFightBlocked(state, inv, enemy) {
    const traits = (enemy?.traits || []).map(trait => String(trait).toLowerCase())
    return activeHiddenRules(state, inv).some(item =>
      item.rule.cannotFightTraits?.some(trait => traits.includes(String(trait).toLowerCase())))
  }

  function movementError(state, inv) {
    // Phase 2（C1）：capability:move —— 「不能移动」由卡面声明，引擎只问读点。
    if (capabilityBlocked(state, inv, 'move')) return '当前效果禁止你移动'
    // 「本轮不能离开本地点」（03256 堵塞通道）：地点实例上的轮次标记是全阶段读点。
    const currentLocation = state.locations?.find(location => location.id === inv?.location)
    if (currentLocation?.cannotLeaveRound === state.round) {
      return `本轮不能离开「${currentLocation.name || currentLocation.id}」`
    }
    if (state.phase !== 'investigation' || !state.turnSerial) return null
    const maximum = Math.min(...activeHiddenRules(state, inv)
      .map(item => item.rule.maxMovesPerTurn).filter(Number.isFinite), Infinity)
    return Number.isFinite(maximum) && inv.hiddenMoves?.turnSerial === state.turnSerial
      && inv.hiddenMoves.count >= maximum ? '隐私牌限制你本回合不能再次移动'
      : scenarioBehavior(state).movementError?.(state, inv) || null
  }

  function currentInv(state) {
    return state.investigators[state.currentSeat]
  }

  function investigatorTextBlanked(state, inv) {
    // Phase 5（5a-2）：按内容层的数据标记判断（不再是卡号字面量）。
    return !!inv && state.enemies.some(enemy => isTextBlankEnemy(enemy.code)
      && enemy.location === inv.location && !enemy.defeated && !enemyTextBlanked(state, enemy))
  }

  function enemyTextBlanked(state, enemy) {
    const blank = enemy && enemy.textBlanked
    return !!(blank && blank.round === state.round && blank.phase === state.phase)
  }

  function enemyCannotAttack(state, enemy) {
    if (entityRuleActive(state, enemy, 'cannot:attack')) return true
    return scenarioBehavior(state).enemyCannotAttack?.(state, enemy) === true
  }

  function enemyCannotBeAttacked(state, enemy) {
    if (entityRuleActive(state, enemy, 'cannot:beAttacked')) return true
    return scenarioBehavior(state).enemyCannotBeAttacked?.(state, enemy) === true
  }

  function enemyCanOpportunityAttack(state, enemy) {
    if (entityRuleActive(state, enemy, 'cannot:opportunityAttack')) return false
    return scenarioBehavior(state).canOpportunityAttack?.(state, enemy) !== false
  }

  function enemyCanBeDefeated(state, enemy, source = null, seat = null) {
    if (enemy?.cannotBeDefeated) return false
    if (entityRuleActive(state, enemy, 'cannot:beDefeated')) return false
    return scenarioBehavior(state).enemyCanBeDefeated?.(state, enemy, source, seat) !== false
  }

  return { hiddenDefinition, hiddenRule, hasHiddenCard, removeHiddenMarker, canDiscardFromHand, discardHiddenCard, placeHiddenCard, activeHiddenRules, cannotTriggerFreeAbility, hiddenFightBlocked, movementError, currentInv, investigatorTextBlanked, enemyTextBlanked, enemyCannotAttack, enemyCannotBeAttacked, enemyCanOpportunityAttack, enemyCanBeDefeated }
}
