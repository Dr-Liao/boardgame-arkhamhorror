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

  // 隐私牌的「不能打出某类卡」限制（03084d 疑惑：你不能打出事件）。
  // 唯一的类型级读点：普通出牌（moves.js）、快速事件反应窗口（encounter.js）、
  // fromHand 描述子（ability-rules.js）与快速事件执行器（assets.js）都问这里，
  // 避免「普通事件被挡、快速事件漏打」的两套口径。
  function playTypeBlocked(state, inv, type) {
    return activeHiddenRules(state, inv).some(item => item.rule.cannotPlayTypes?.includes(type))
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

  function movementError(state, inv, destinationId = null) {
    // Phase 2（C1）：capability:move —— 「不能移动」由卡面声明，引擎只问读点。
    if (capabilityBlocked(state, inv, 'move')) return '当前效果禁止你移动'
    // 「本轮不能离开本地点」（03256 堵塞通道）：地点实例上的轮次标记是全阶段读点。
    const currentLocation = state.locations?.find(location => location.id === inv?.location)
    if (currentLocation?.cannotLeaveRound === state.round) {
      return `本轮不能离开「${currentLocation.name || currentLocation.id}」`
    }
    // 2026-10-25 本循环修复 movement-error-destination-all-phases（05053/05054）：
    // 剧本级移动限制在任何阶段都生效（含效果位移），并携带目标地点；此前只在调查阶段、
    // 且不传目标地点，导致「不能移动到某调查员所在地点」在效果移动/神话阶段被绕过。
    const destination = destinationId == null
      ? null : state.locations?.find(location => location.id === destinationId) || null
    const scenarioError = scenarioBehavior(state).movementError?.(state, inv, destination, destinationId) || null
    if (scenarioError) return scenarioError
    if (state.phase !== 'investigation' || !state.turnSerial) return null
    const maximum = Math.min(...activeHiddenRules(state, inv)
      .map(item => item.rule.maxMovesPerTurn).filter(Number.isFinite), Infinity)
    return Number.isFinite(maximum) && inv.hiddenMoves?.turnSerial === state.turnSerial
      && inv.hiddenMoves.count >= maximum ? '隐私牌限制你本回合不能再次移动' : null
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

  // 冷漠（aloof）：未与调查员交战的冷漠敌人不能被攻击——调查员必须先主动交战，
  // 或使用写明「忽略冷漠」的攻击（04104 枪法如神等，通过 options.ignoreAloof 放行）。
  // 庞大敌人视为与所在地点每位调查员交战（规则书「庞大」），因此不受这条限制。
  function aloofPreventsAttack(state, inv, enemy, options = {}) {
    if (!enemy || options.ignoreAloof === true) return false
    if (enemyTextBlanked(state, enemy) || !enemy.aloof) return false
    if (enemy.engagedSeat != null) return false
    if (enemy.massive && enemy.location === inv?.location) return false
    return true
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

  return { hiddenDefinition, hiddenRule, hasHiddenCard, removeHiddenMarker, canDiscardFromHand, discardHiddenCard, placeHiddenCard, activeHiddenRules, playTypeBlocked, cannotTriggerFreeAbility, hiddenFightBlocked, movementError, currentInv, investigatorTextBlanked, enemyTextBlanked, enemyCannotAttack, enemyCannotBeAttacked, aloofPreventsAttack, enemyCanOpportunityAttack, enemyCanBeDefeated }
}
