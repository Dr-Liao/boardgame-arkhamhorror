// 合法行动枚举与校验（legalMoves / validateMove）从 engine.js 拆出的第六个模块
// （Phase 6 · 6d-6）。
//
// 这一对是「AI 与玩家看到同一份行动列表」的入口：legalMoves 枚举、validateMove 校验，
// 两边必须共用同一批判定函数，所以放在同一个模块里最安全。
// 依赖注入同前几个域；依赖清单由「engine 顶层声明 ∪ import 绑定 − 函数内局部」生成（先剥注释），
// 注入块用唯一标记定位，避免和 createCombat / createActions 的块混淆。
import { investigatorRule } from '../cards/card-rules.js'
import { scriptCardOwner } from './script-cards.js'
import { locationEntryNotice } from './location-facts.js'

export function createMoves(deps) {
  const {
    LITA_CHANDLER_CODE,
    META,
    SKILL_NAMES,
    abilityTargets,
    actingSeats,
    actionCost,
    actionKind,
    activeHiddenRules,
    advanceAct,
    aliveInvestigators,
    assetEffect,
    assetReplacementPlans,
    availableThreatAbilities,
    canAdvanceWithClues,
    canAffordAbility,
    canDiscardFromHand,
    canParleyCultist,
    canUseExtraEvade,
    cannotPlayTypes,
    cannotTriggerFreeAbility,
    entityModifierTotal,
    capabilityBlocked,
    cardDef,
    cardName,
    cardPlayBlockedReason,
    charlesPayCandidate,
    choiceError,
    choiceMoves,
    controlledAbilityCard,
    controlledAbilityCards,
    costPreviewSuffix,
    decisionSeat,
    drawBlocked,
    effectError,
    enemyCannotBeAttacked,
    enemyDef,
    enemyEvadeValue,
    enemyFightValue,
    enemyRuleFlags,
    enemyTextBlanked,
    enumerateTargets,
    getThreatEffect,
    groupClues,
    hasHiddenCard,
    hasPlayedEventsToDeckTop,
    hiddenFightBlocked,
    hiddenRule,
    hubLegalMoves,
    inHub,
    investigatorEntryError,
    investigatorTextBlanked,
    isCardAvailable,
    isWeaknessCard,
    isWeaknessCode,
    limitUsed,
    litaUncontrolled,
    locLabel,
    locName,
    locationAbilityAvailable,
    locationExists,
    lolaCanUseCard,
    movementError,
    normalActionsLeft,
    normalizedSlots,
    playAccess,
    playConditionError,
    playConditionHelpers,
    playCost,
    playedEffect,
    registeredEntry,
    resolveTarget,
    runtimeCardAvailable,
    scenarioBehavior,
    stateCompatibilityError,
    campaignPlayCostPreview,
    tomeActionEligible,
    topDiscardEvent,
    unique,
    validateHubMove,
  } = deps

  // 剧本卡行动归属：关卡数据里的 scenario.scriptCards 声明「这个行动印在当前哪张
  // 幕/密谋卡上」（'act' / 'agenda'）。牌桌据此把按钮放到剧本书对应卡片旁、让该卡发光，
  // 观察投影也会保留带 scriptCard 的提示；返回 null 表示这个行动不属于剧本卡
  // （地点、敌人、剧情支援赋予的行动保持原样）。显式 scriptCard 优先，例如献祭丽塔的
  // 'enemy' 只用于 AI 提示、不占剧本区。读点见 script-cards.js。
  function ownedMove(state, move) {
    if (move.scriptCard) return move
    const owner = scriptCardOwner(state, move)
    return owner ? { ...move, scriptCard: owner } : move
  }

  // 卡面条件「如果你未与任何敌人交战」（02108 探路者）：效果体用 requiresNoEnemies 声明。
  // legalMoves 与 validateMove 共用这一份判定，避免"列表里没有、提交却能过"。
  function moveToBlocked(state, inv, effect) {
    return effect?.type === 'moveTo' && effect.requiresNoEnemies === true
      && state.enemies.some(enemy => enemy.engagedSeat === inv.seat && !enemy.defeated)
  }

  function legalMoves(state, observerSeat) {
  if (state.status !== 'playing') return []
  if (state.pendingChoice) return choiceMoves(state, observerSeat)
  if (inHub(state)) return hubLegalMoves(state, observerSeat ?? decisionSeat(state))
  const seat = state.currentSeat
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const loc = state.locations.find((l) => l.id === inv.location)
  // 剧本/遭遇卡赋予的行动统一由行为的 actions()/encounterActions() 给出。
  // 每一项都可以带 reason（条件不满足时给）：这里只取不带 reason 的进可执行列表，
  // 带 reason 的留给 scriptActionHints 当提示——否则客户端会渲染出点不动的按钮，
  // AI 也会照抄一个必被拒绝的行动。locationId 只补在"由当前地点赋予"的行动上，
  // 让客户端在选中该地点时能展示它。scriptCard 由关卡数据的 scriptCards 补，
  // 让幕/密谋卡上的行动显示在剧本书旁而不是通用动作栏。
  moves.push(...(scenarioBehavior(state).actions?.(state, inv) || []).filter(move => !move.reason).map(move =>
    ownedMove(state, move)).map(move =>
    move.locationId || move.scriptCard ? move : { ...move, locationId: inv.location }))
  moves.push(...(scenarioBehavior(state).encounterActions?.(state, inv) || []).filter(move => !move.reason)
    .map(move => ownedMove(state, move)))
  for (const attachment of state.playerLocationAttachments || []) {
    if (!registeredEntry(attachment.code)?.grantsShortcutMove || attachment.location !== inv.location || attachment.exhausted) continue
    for (const destination of new Set(loc?.connections || [])) {
      if (!locationExists(state, destination) || investigatorEntryError(state, destination)) continue
      moves.push({ action: 'shortcutMove', locationId: destination,
        label: `🏃 捷径：移动到「${locName(state, destination)}」` })
    }
  }
  for (const { code, rule } of activeHiddenRules(state, inv)) {
    const discard = rule.discard
    if (!discard || inv.resources < (discard.resources || 0)) continue
    if (discard.damageInvestigator) {
      for (const target of aliveInvestigators(state).filter(other => other.location === inv.location)) {
        moves.push({ action: 'hiddenAction', cardId: code, targetSeat: target.seat,
          label: `隐私牌「${cardName(code)}」：对${target.name}造成${discard.damageInvestigator}点伤害并弃掉` })
      }
    } else {
      moves.push({ action: 'hiddenAction', cardId: code,
        label: `弃掉隐私牌「${cardName(code)}」${discard.resources ? `（支付${discard.resources}资源）` : ''}` })
    }
  }

  const blocked = cannotPlayTypes(inv)
  for (const code of unique(inv.hand)) {
    const def = cardDef(code)
    if (!def || !runtimeCardAvailable(state, inv, code) || def.dataStatus === 'quarantined' || def.type === 'skill' || (isWeaknessCard(def) && !playAccess(code).playableWeakness)) continue
    if (!lolaCanUseCard(inv, code)) continue
    if (scenarioBehavior(state).canPlayCard?.(state, inv, def) === false) continue
    if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotPlayTypes?.includes(def.type))) continue
    if (blocked.has(def.type)) continue
    if (cardPlayBlockedReason(state, inv, def)) continue
    if (registeredEntry(code)?.copiesBeneathEvents) {
      for (const copyCode of inv.beneath || []) {
        const copy = cardDef(copyCode)
        const copyPlayed = playedEffect(copyCode)
        if (!copy || copy.type !== 'event' || copy.exceptional || !copyPlayed || playAccess(copyCode).reactionOnly) continue
        const cost = playCost(state, inv, copy)
        if (inv.resources < cost || effectError(state, inv, copyPlayed)) continue
        moves.push({ action: 'play', cardId: code, copyCode,
          label: `🃏 彩绘世界复制「${cardName(copyCode)}」(${cost} 资源)` })
      }
      continue
    }
    const cost = playCost(state, inv, def)
    if (inv.resources < cost - (campaignPlayCostPreview(state, inv, code)?.discount || 0)
      && !charlesPayCandidate(state, inv, cost)) continue
    if (def.type === 'asset' && normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) continue
    const kindLabel = def.type === 'asset' ? '装备' : '打出'
    moves.push({ action: 'play', cardId: code, label: `🃏 ${kindLabel}「${cardName(code)}」(${cost} 资源)` })
  }

  // 04037 背包：附属的牌可以当作手牌打出。
  for (const bag of inv.assets.filter(asset => registeredEntry(asset.code)?.cardBackpack)) {
    for (const code of unique(bag.attachedCards || [])) {
      const def = cardDef(code)
      if (!def || def.type === 'skill'
        || (isWeaknessCard(def) && !playAccess(code).playableWeakness)) continue
      if (blocked.has(def.type) || cardPlayBlockedReason(state, inv, def)) continue
      const cost = playCost(state, inv, def)
      if (inv.resources < cost) continue
      moves.push({
        action: 'play', cardId: code, fromBackpackId: bag.id,
        label: `🎒 从背包打出「${cardName(code)}」(${cost} 资源)`,
      })
    }
  }

  // 「临时武器」「将就一下」等：可从自己的弃牌堆打出。
  for (const code of unique(inv.discard)) {
    if (!playAccess(code).fromDiscard || !isCardAvailable(code)) continue
    if (inv.discard.includes(code) === false) continue
    const def = cardDef(code)
    if (!def || def.type !== 'event' || isWeaknessCard(def) || blocked.has(def.type)) continue
    if (inv.resources < playCost(state, inv, def) || effectError(state, inv, playedEffect(code))) continue
    moves.push({ action: 'play', cardId: code, fromDiscard: true,
      label: `🃏 从弃牌堆打出「${cardName(code)}」(${playCost(state, inv, def)} 资源)` })
  }

  if (hasPlayedEventsToDeckTop(inv) && inv.discard.length) {
    const code = topDiscardEvent(state, inv)
    const def = cardDef(code)
    if (def && def.type === 'event' && isCardAvailable(code) && !isWeaknessCard(def)
        && !blocked.has(def.type) && inv.resources >= playCost(state, inv, def)
        && !effectError(state, inv, playedEffect(code))) {
      moves.push({ action: 'play', cardId: code, fromDiscard: true, label: `🃏 温蒂的护身符：打出弃牌堆顶事件「${cardName(code)}」(${playCost(state, inv, def)} 资源)` })
    }
  }

  for (const plan of inv.assets.filter(asset => registeredEntry(asset.code)?.cardPlan && !asset.exhausted)) {
    for (const code of unique(plan.attached || [])) {
      const def = cardDef(code)
      if (!def || def.type !== 'event' || playAccess(code).reactionOnly || blocked.has(def.type)
          || !runtimeCardAvailable(state, inv, code) || inv.resources < playCost(state, inv, def)
          || effectError(state, inv, playedEffect(code))) continue
      moves.push({ action: 'play', cardId: code, fromPlanAssetId: plan.id,
        label: `🃏 原定计划：打出「${cardName(code)}」(${playCost(state, inv, def)} 资源)` })
    }
  }

  // 「残酷拷问」（04261）等：威胁区域禁止抽取行动。
  if (!drawBlocked(state, inv)) moves.push({ action: 'draw', label: '🀄 抽 1 张牌' })
  if (scenarioBehavior(state).canGainResources?.(state, inv) !== false) moves.push({ action: 'resource', label: '💰 获得 1 资源' })
  // 失落的时代：探索牌库非空且剧本允许时提供探索行动。
  // 「探索」通常印在当前幕/密谋卡上（04044/04057/04207/04285…），由关卡数据的
  // scriptCards 补 scriptCard，牌桌才会把它放在对应剧本卡旁。
  if ((state.explorationDeck || []).length && !investigatorTextBlanked(state, inv)
    && scenarioBehavior(state).canExplore?.(state, inv) !== false) {
    moves.push(ownedMove(state, { action: 'explore', label: `🧭 探索（剩余 ${state.explorationDeck.length} 张）` }))
  }

  const skids = investigatorRule(inv.code)
  if (skids && skids.freeAction && !investigatorTextBlanked(state, inv) && inv.resources >= (skids.freeAction.cost.resources || 0)
    && (skids.freeAction.repeatable || !inv.usedReactions[skids.freeAction.id + ':' + state.round])) {
    moves.push({ action: 'freeAction', label: skids.freeAction.label || '⚡ 花 2 资源获得 1 额外行动' })
  }

  for (const nb of new Set(loc && !movementError(state, inv) ? loc.connections : [])) {
    const target = state.locations.find((l) => l.id === nb)
    // P0：内容层可以声明「这次移动现在不能做」的理由（如《苍白面具》线索不足）。
    if (!target || investigatorEntryError(state, nb) || scenarioBehavior(state).moveError?.(state, inv, target, nb)) continue
    // 进入地点的强制效果由地点数据声明；只在已揭示时给出，避免泄露未翻开的背面。
    const entryNotice = target.revealed ? locationEntryNotice(state, target) : null
    moves.push({ action: 'move', locationId: nb, label: `🚶 移动到「${locLabel(state, nb)}」（线索 ${target.clues}${target.locked ? '，上锁' : ''}${entryNotice ? `；进入后：${entryNotice}` : ''}）` })
  }

  if (loc && loc.clues > 0 && !loc.locked && !scenarioBehavior(state).investigationError?.(state, inv, loc)) {
    const skill = loc.investigateSkill || 'intellect'
    const scenarioShroud = (scenarioBehavior(state).locationShroudModifier?.(state, loc, inv) || 0)
      + entityModifierTotal(state, loc, 'locationShroud')
    const shroud = loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0) + scenarioShroud
    moves.push({ action: 'investigate', label: `🔍 调查「${loc.name}」（${SKILL_NAMES[skill]} vs 帷幕 ${shroud}）` })
  }

  if (loc && loc.ability && locationAbilityAvailable(state, loc, inv)
    && !activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotTriggerLocationAbilities)) {
    moves.push({ action: 'locationAbility', locationId: loc.id, label: `📍 ${loc.ability.label}` })
  }

  for (const enemy of state.enemies.filter(enemy => enemy.location === inv.location)) {
    if ((!enemyRuleFlags(enemy.code).damageOnlyFrom || enemyTextBlanked(state, enemy)) && !hiddenFightBlocked(state, inv, enemy)
      && !enemyCannotBeAttacked(state, enemy) && scenarioBehavior(state).canFightEnemy?.(state, inv, enemy) !== false)
      moves.push({ action: 'fight', enemyId: enemy.id, label: `⚔️ 攻击「${enemy.name}」（战斗 vs ${enemyFightValue(state, enemy, inv)}${enemy.retaliate ? '，反击' : ''}）` })
    if (scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) !== false)
      moves.push({ action: 'evade', enemyId: enemy.id, label: `💨 躲避「${enemy.name}」（敏捷 vs ${enemyEvadeValue(state, enemy, inv)}）` })
    // 芬恩·爱德华兹：每回合 1 次不消耗行动的额外躲避。
    if (canUseExtraEvade(state, inv) && (enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location))
      && scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) !== false)
      moves.push({ action: 'extraEvade', enemyId: enemy.id,
        label: `💨 额外躲避「${enemy.name}」（本回合一次，不消耗行动）` })
    if (enemy.parleyCost && inv.resources >= enemy.parleyCost) {
      moves.push({ action: 'parley', enemyId: enemy.id, label: `🤝 谈判「${enemy.name}」（花 ${enemy.parleyCost} 资源弃掉）` })
    }
    if (!enemy.massive && enemy.engagedSeat !== seat) {
      moves.push({ action: 'engage', enemyId: enemy.id, label: `与「${enemy.name}」交战` })
    }
    // 谈判盘问独特异教徒。
    const def = enemyDef(enemy.code)
    if (def && def.parley && canParleyCultist(state, inv, def.parley.cost)) {
      moves.push({ action: 'parleyCultist', enemyId: enemy.id, label: `🤝 ${def.parley.label}「${enemy.name}」` })
    }
  }

  // 午夜假面场景 1：抽异教徒牌堆。
  if (scenarioBehavior(state).drawCultistActIndex === state.actIndex && groupClues(state) >= 2 * state.numInvestigators && state.cultistDeck.length) {
    moves.push({ action: 'drawCultist', scriptCard: 'act', label: `🕵️ 抽取异教徒牌堆（花 ${2 * state.numInvestigators} 线索）` })
  }

  // 地底噬魔场景 3：破坏仪式。
  if (scenarioBehavior(state).interruptRitualActIndex === state.actIndex && state.clues >= 1) {
    moves.push({ action: 'interruptRitual', scriptCard: 'act', skill: 'willpower', label: '📜 破坏仪式（意志 3，花 1 线索）' })
    moves.push({ action: 'interruptRitual', scriptCard: 'act', skill: 'agility', label: '📜 破坏仪式（敏捷 3，花 1 线索）' })
  }

  // 上锁的门：破门。
  if (loc && loc.locked) {
    moves.push({ action: 'breakDoor', skill: 'combat', label: '🔓 破门（战斗 4）' })
    moves.push({ action: 'breakDoor', skill: 'agility', label: '🔓 破门（敏捷 4）' })
  }
  if (loc?.searchingForIzzieSeat != null) moves.push({ action: 'searchIzzie', label: '🔎 寻找伊兹（花 2 行动，调查）' })


  for (const a of controlledAbilityCards(inv)) {
    const eff = assetEffect(inv, a)
    if (!eff || !eff.abilities) continue
    if (!lolaCanUseCard(inv, a.code)) continue
    eff.abilities.forEach((ab, i) => {
      if (!canAffordAbility(state, inv, a, ab)) return
      // 能力层上限：已用完的能力不再出现在合法列表里（与玩家窗口的过滤一致）。
      if (ab.descriptor && limitUsed(state, inv, ab.descriptor, null, null, a)) return
      if (ab.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return
      if (ab.oncePerTest && state.skillTest?.usedAbilities?.[`${a.id}:${i}`]) return
      if (ab.oncePerPhase && inv.usedAbilities?.[`${a.id}:${i}:${state.round}:${state.phase}`]) return
      if (ab.requiresNoClues && loc && loc.clues > 0) return
      if (moveToBlocked(state, inv, ab.effect)) return
      const free = ab.cost && ab.cost.action === false
      if (free && cannotTriggerFreeAbility(state, inv)) return
      const prefix = free ? '⚡免费 ' : tomeActionEligible(state, inv, { action: 'ability', assetId: a.id, abilityIndex: i }) ? '[书籍额外行动] ' : ''
      // Phase 2（C3）：动态费用在行动文案里给出当前数值（"预览 = 校验 = 扣费"同一份求值）。
      const suffix = costPreviewSuffix(state, inv, a, ab) || ''
      // 威胁区弱点的「当前 / 目标」计数也写进文案（例如怒灵 2/4）：这张免费能力每次只加 1，
      // 达标后继续用只会白耗支援充能，AI 需要每一眼都能看到进度。
      const requiredUses = inv.threat.includes(a) ? registeredEntry(a.code)?.physicalTraumaIfUsesBelow : null
      const progress = Number.isFinite(requiredUses) && a.uses != null
        ? `（${a.usesType === 'charges' ? '充能' : '标记'} ${a.uses}/${requiredUses}）` : ''
      const base = { action: 'ability', assetId: a.id, abilityIndex: i }
      // 目标枚举（B1）：描述子声明 target 时，每个合法目标拆成一条独立行动，
      // 牌桌可以先选目标、AI 不用再多问一轮。没有目标且非 optional 就不出现。
      if (ab.descriptor && ab.descriptor.target) {
        const candidates = enumerateTargets(state, inv, ab.descriptor.target, { source: a })
        if (!candidates.length) {
          if (!ab.descriptor.target.optional) return
          moves.push({ ...base, label: `${prefix}${ab.label}${suffix}${progress}` })
          return
        }
        for (const candidate of candidates) {
          moves.push({ ...base, targetId: candidate.id, label: `${prefix}${ab.label} → ${candidate.label}${suffix}${progress}` })
        }
        return
      }
      if (ab.effect?.type === 'fight' && !abilityTargets(state, inv, ab.effect).length) return
      if (ab.effect && (ab.effect.type === 'investigate' || ab.effect.type === 'discoverClue') && (!loc || loc.clues <= 0)) return
      if (ab.effect && ab.effect.type === 'dealDamage' && abilityTargets(state, inv, ab.effect).length === 0) return
      // choose 分支：每个选项拆成一条独立行动（optionIndex 从 0 起）。
      if (ab.effect && ab.effect.type === 'chooseOne' && Array.isArray(ab.effect.options)) {
        ab.effect.options.forEach((opt, oi) => {
          moves.push({ ...base, optionIndex: oi, label: `${prefix}${opt.label || ab.label}（选项 ${oi + 1}）${progress}` })
        })
        return
      }
      // Explicit targets also let the table point an ability at its sole legal enemy.
      const targets = abilityTargets(state, inv, ab.effect)
      if (targets.length > 0) {
        for (const t of targets) {
          moves.push({ ...base, targetId: t.id, label: `${prefix}${ab.label} → ${t.name}${suffix}${progress}` })
        }
        return
      }
      moves.push({ ...base, label: `${prefix}${ab.label}${suffix}${progress}` })
    })
  }

  for (const t of availableThreatAbilities(state, inv)) {
    const th = getThreatEffect(t)
    if (th && th.discardCost) {
      moves.push({ action: 'discardThreat', threatId: t.id, label: `♻️ 弃掉「${cardName(t.code)}」（花 ${th.discardCost.action} 行动）` })
    }
    if (th && th.purgeAbility && (t.counters || 0) > 0) {
      moves.push({ action: 'purgeThreat', threatId: t.id, label: `📖 净化「${cardName(t.code)}」（移走 1 恐惧）` })
    }
    if (th && th.debt && inv.threat.includes(t) && inv.resources > 0 && (t.debtPaymentsThisRound || 0) < 2) {
      moves.push({ action: 'payDebt', threatId: t.id, label: `💸 向医院债务支付 1 资源（每轮至多 2 次）` })
    }
  }

  if (canAdvanceWithClues(state)) moves.push({ action: 'advanceAct', scriptCard: 'act', label: '共同支付线索推进场景' })
  moves.push({ action: 'endTurn', label: '⏭️ 结束回合' })
  // scriptCard 标出行动来自当前场景或密谋，牌桌据此把按钮放在剧本书旁。
  // 不依赖地点的撤退由密谋赋予（如《午夜假面》两张密谋的 [action]：撤退）。
  if (loc && loc.resign) moves.push({ action: 'resign', locationId: loc.id, label: '🏳️ 撤退' })
  else if (state.scenario.resignAnywhere) moves.push({ action: 'resign', scriptCard: 'agenda', label: '🏳️ 撤退' })

  return moves.filter(move => validateMove(state, seat, move) === null)
}

  function validateMove(state, seat, move) {
  const compatibility = stateCompatibilityError(state, META.resourceVersion)
  if (compatibility) return compatibility
  if (!move || Array.isArray(move) || typeof move.action !== 'string') return '无效行动'
  if (!Number.isInteger(seat) || !actingSeats(state).includes(seat)) return '现在不是你的应答时机'
  if (Object.hasOwn(move, 'revision') && (!Number.isSafeInteger(move.revision) || move.revision !== state.revision)) return '对局版本已过期'
  if (state.status !== 'playing') return '对局已结束'
  if (state.pendingChoice) return choiceError(state, seat, move)
  if (inHub(state)) return validateHubMove(state, seat, move)
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return '你已经败退'
  {
    const cost = actionCost(state, inv, move)
    const kind = actionKind(state, inv, move)
    if (kind === 'explore' ? inv.actionsLeft < cost : normalActionsLeft(inv) < cost) {
      return kind === 'explore' ? '行动点不足' : '行动点不足（额外行动只能用于探索）'
    }
  }

  switch (move.action) {
    case 'scenarioAction': return scenarioBehavior(state).actions?.(state, inv).some(m => m.rule === move.rule && !m.reason)
      ? null : '当前不能执行此剧本行动'
    case 'encounterAction': return scenarioBehavior(state).encounterActions?.(state, inv).some(m => m.rule === move.rule && !m.reason)
      ? null : '当前不能执行此遭遇卡行动'
    case 'play': {
      const def = cardDef(move.cardId)
      if (!def) return '未知卡牌'
      if (!lolaCanUseCard(inv, move.cardId)) return '罗拉只能使用中立或当前角色阵营的卡牌'
      if (scenarioBehavior(state).canPlayCard?.(state, inv, def) === false) return '当前效果禁止你打出卡牌'
      const playBlocked = cardPlayBlockedReason(state, inv, def)
      if (playBlocked) return playBlocked
      if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotPlayTypes?.includes(def.type))) return '隐私牌禁止你打出该类型卡牌'
      if (def.permanent) return '永久卡在开局时入场'
      // 打出条件的唯一读点（Phase 1）：描述子 playCondition + 旧 DSL 的 10 个字段
      // 都在 src/engine/play-condition.js 里收敛，引擎不再逐字段判断。
      const conditionError = playConditionError(state, inv, move.cardId, playConditionHelpers(state))
      if (conditionError) return conditionError
      if (!runtimeCardAvailable(state, inv, move.cardId) || def.dataStatus === 'quarantined') return '该卡牌未获运行时许可'
      if (registeredEntry(move.cardId)?.copiesBeneathEvents) {
        const copied = cardDef(move.copyCode)
        const copiedPlayed = playedEffect(move.copyCode)
        if (!inv.beneath?.includes(move.copyCode) || !copied || copied.type !== 'event' || copied.exceptional
          || !copiedPlayed || playAccess(move.copyCode).reactionOnly) return '彩绘世界没有合法的复制事件'
        if (!inv.hand.includes(move.cardId)) return '手牌中没有彩绘世界'
        if (inv.resources < playCost(state, inv, copied)) return '资源不足'
        return effectError(state, inv, copiedPlayed)
      }
      if (def.type === 'skill' || (isWeaknessCard(def) && !playAccess(move.cardId).playableWeakness)) return '该牌不能作为行动打出'
      if (move.fromDiscard) {
        if (!playAccess(move.cardId).fromDiscard && !hasPlayedEventsToDeckTop(inv)) return '你没有温蒂的护身符'
        // 卡面允许从弃牌堆任意位置打出的卡（「临时武器」等）不受牌库顶限制。
        if (!playAccess(move.cardId).fromDiscard
          && (def.type !== 'event' || topDiscardEvent(state, inv) !== move.cardId)) return '不是弃牌堆中最上方的事件'
      } else if (move.fromPlanAssetId) {
        const plan = inv.assets.find(asset => asset.id === move.fromPlanAssetId && registeredEntry(asset.code)?.cardPlan)
        if (!plan || plan.exhausted || !plan.attached?.includes(move.cardId) || def.type !== 'event') return '原定计划下没有可打出的这张事件'
      } else if (move.fromBackpackId) {
        const bag = inv.assets.find(asset => asset.id === move.fromBackpackId && registeredEntry(asset.code)?.cardBackpack)
        if (!bag || !(bag.attachedCards || []).includes(move.cardId)) return '背包里没有这张牌'
      } else if (!inv.hand.includes(move.cardId)) return '手牌中没有这张牌'
      if (playAccess(move.cardId).reactionOnly) return '该牌只能在对应的反应窗口打出'
      if (cannotPlayTypes(inv).has(def.type)) return '当前禁止打出该类型卡牌'
      if (inv.resources < playCost(state, inv, def) - (campaignPlayCostPreview(state, inv, move.cardId)?.discount || 0)
        && !charlesPayCandidate(state, inv, playCost(state, inv, def))) return '资源不足'
      if (def.unique && state.investigators.some(item => item.assets.some(asset => cardDef(asset.code)?.name === def.name))) return '唯一资产已经在场'
      if (def.type === 'asset' && normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) return '槽位已满'
      if (playAccess(move.cardId).limitPerInvestigator
        && inv.assets.some(asset => asset.code === move.cardId)) return '每位调查员仅限 1 张'
      return effectError(state, inv, playedEffect(move.cardId))
    }
    case 'draw': return drawBlocked(state, inv) ? '「残酷拷问」：你不能进行抽取行动' : null
    case 'resource': return scenarioBehavior(state).canGainResources?.(state, inv) === false ? '此地点不能获得资源' : null
    case 'freeAction': {
      const skids = investigatorRule(inv.code)
      if (!skids || !skids.freeAction || investigatorTextBlanked(state, inv)) return '你没有该异能'
      if (cannotTriggerFreeAbility(state, inv)) return '隐私牌禁止你触发免费能力'
      if (inv.resources < (skids.freeAction.cost.resources || 0)) return '资源不足'
      if (skids.freeAction.cost.discardHand
        && !inv.hand.some(code => !isWeaknessCode(code) && canDiscardFromHand(inv, code))) return '没有可弃掉的手牌'
      if (effectError(state, inv, skids.freeAction.effect)) return effectError(state, inv, skids.freeAction.effect)
      if (!skids.freeAction.repeatable && inv.usedReactions[skids.freeAction.id + ':' + state.round]) return '本回合已使用'
      return null
    }
    case 'hiddenAction': {
      const rule = hiddenRule(state, move.cardId)
      const discard = rule?.discard
      if (!discard || !hasHiddenCard(inv, move.cardId)) return '手牌中没有该隐私牌'
      if (inv.resources < (discard.resources || 0)) return '资源不足'
      if (discard.damageInvestigator && !state.investigators.some(other => other.seat === move.targetSeat
        && !other.defeated && !other.resigned && other.location === inv.location)) return '隐私牌没有合法的伤害目标'
      return null
    }
    case 'parley': {
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy || enemy.engagedSeat !== seat) return '该敌人未与你交战'
      if (!enemy.parleyCost || inv.resources < enemy.parleyCost) return '无法谈判（资源不足）'
      return null
    }
    case 'parleyCultist': {
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy || !enemy.uniqueCultist) return '该敌人不可谈判'
      if (enemy.location !== inv.location || enemyTextBlanked(state, enemy)) return '该敌人不在此处或谈判能力已失效'
      const def = enemyDef(enemy.code)
      if (!def || !def.parley) return '该敌人不可谈判'
      if (!canParleyCultist(state, inv, def.parley.cost)) return '谈判成本不足'
      return null
    }
    case 'parleyLita': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || !loc.parley) return '这里不能谈判'
      if (!litaUncontrolled(state)) return '丽塔尚未入场或已被控制'
      if (!(state.storyAssets || []).some(asset => asset.code === LITA_CHANDLER_CODE && asset.location === inv.location)) return '丽塔不在你所在的地点'
      return null
    }
    case 'drawCultist': {
      if (scenarioBehavior(state).drawCultistActIndex !== state.actIndex) return '现在不能抽取异教徒牌堆'
      if (groupClues(state) < 2 * state.numInvestigators) return '线索不足'
      if (!state.cultistDeck.length) return '异教徒牌堆已空'
      return null
    }
    case 'interruptRitual': {
      if (scenarioBehavior(state).interruptRitualActIndex !== state.actIndex) return '现在不能破坏仪式'
      if (inv.clues < 1) return '需要 1 个线索'
      return null
    }
    case 'sacrificeLita': {
      const error = scenarioBehavior(state).scenarioActionError?.(state, inv, 'sacrificeLita')
      return error === undefined ? '当前剧本不能献祭丽塔' : error
    }
    case 'breakDoor': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || !loc.locked) return '这里没有上锁的门'
      return null
    }
    case 'discardThreat': {
      const t = availableThreatAbilities(state, inv).find(card => card.id === move.threatId)
      if (!t || !getThreatEffect(t)?.discardCost) return '该威胁没有弃置能力'
      return null
    }
    case 'purgeThreat': {
      const t = inv.threat.find((x) => x.id === move.threatId)
      if (!t || (t.counters || 0) <= 0) return '无法净化'
      return null
    }
    case 'payDebt': {
      const t = inv.threat.find((x) => x.id === move.threatId)
      if (!t || !getThreatEffect(t)?.debt) return '没有该债务'
      if (inv.resources <= 0) return '资源不足'
      if ((t.debtPaymentsThisRound || 0) >= 2) return '本轮已支付两次'
      return null
    }
    case 'locationAbility': {
      const loc = state.locations.find((l) => l.id === move.locationId)
      if (!loc || !loc.ability) return '该地点没有可用能力'
      if (capabilityBlocked(state, inv, 'locationAbility')) return '当前效果禁止你使用地点能力'
      if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotTriggerLocationAbilities)) return '隐私牌禁止你触发地点能力'
      if (!locationAbilityAvailable(state, loc, inv)) return '该地点能力当前不可用'
      const abilityError = effectError(state, inv, loc.ability.effect)
      if (abilityError) return abilityError
      return null
    }
    case 'shortcutMove': {
      const loc = state.locations.find((l) => l.id === inv.location)
      const attachment = (state.playerLocationAttachments || []).find(item =>
        registeredEntry(item.code)?.grantsShortcutMove && item.location === inv.location && !item.exhausted)
      if (!attachment) return '这里没有可用的「捷径」'
      if (!loc || !loc.connections.includes(move.locationId)) return '不能移动到该地点'
      return movementError(state, inv) || investigatorEntryError(state, move.locationId)
    }
    case 'move': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || !loc.connections.includes(move.locationId)) return '不能移动到该地点'
      const scenarioMoveError = scenarioBehavior(state).moveError?.(
        state, inv, state.locations.find(l => l.id === move.locationId), move.locationId)
      return movementError(state, inv) || investigatorEntryError(state, move.locationId) || scenarioMoveError || null
    }
    case 'investigate': {
      if (capabilityBlocked(state, inv, 'investigate')) return '当前效果禁止你调查'
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || loc.clues <= 0) return '这里没有线索可调查'
      if (loc.locked) return '地点被上锁的门封锁'
      const reason = scenarioBehavior(state).investigationError?.(state, inv, loc)
      if (reason) return reason
      return null
    }
    case 'explore': {
      if (!(state.explorationDeck || []).length) return '探索牌库已经空了'
      if (scenarioBehavior(state).canExplore?.(state, inv) === false) return '当前不能探索'
      return null
    }
    case 'searchIzzie': {
      const loc = state.locations.find(item => item.id === inv.location)
      if (loc?.searchingForIzzieSeat == null) return '此处没有伊兹'
      if (loc.locked) return '地点被上锁的门封锁'
      return null
    }
    case 'fight': {
      if (capabilityBlocked(state, inv, 'fight')) return '当前效果禁止你攻击'
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (enemyRuleFlags(enemy.code).damageOnlyFrom && !enemyTextBlanked(state, enemy)) return '子嗣只能使用深奥的咒文攻击'
      if (hiddenFightBlocked(state, inv, enemy)) return '隐私牌禁止你攻击该敌人'
      if (scenarioBehavior(state).canFightEnemy?.(state, inv, enemy) === false) return '当前剧本禁止你攻击该敌人'
      const canFight = enemy.location === inv.location
      if (!canFight) return '该敌人未与你交战'
      return null
    }
    case 'evade': {
      if (capabilityBlocked(state, inv, 'evade')) return '当前效果禁止你躲避'
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) === false) return '该敌人不能被躲避'
      const canEvade = enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location)
      if (!canEvade) return '该敌人未与你交战'
      return null
    }
    case 'extraEvade': {
      if (!canUseExtraEvade(state, inv)) return '本回合的额外躲避行动已经用过'
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) === false) return '该敌人不能被躲避'
      const canEvade = enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location)
      if (!canEvade) return '该敌人未与你交战'
      return null
    }
    case 'ability': {
      const asset = controlledAbilityCard(inv, move.assetId)
      if (!asset) return '未找到该资产'
      if (capabilityBlocked(state, inv, 'triggerAbilities')) return '当前效果禁止你触发能力'
      if (!lolaCanUseCard(inv, asset.code)) return '罗拉不能触发非当前角色阵营卡牌的能力'
      const eff = assetEffect(inv, asset)
      const ability = eff && eff.abilities && eff.abilities[move.abilityIndex]
      if (!ability || !Number.isInteger(move.abilityIndex)) return '无效能力'
      if (ability.descriptor && limitUsed(state, inv, ability.descriptor, null, state.timingWindow, asset)) {
        return '该能力的次数已用完（本阶段/本回合/本局）'
      }
      if (ability.cost?.action === false && cannotTriggerFreeAbility(state, inv)) return '隐私牌禁止你触发免费能力'
      if (!canAffordAbility(state, inv, asset, ability)) return '能力成本不足'
      if (ability.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return '只能在自己的技能检定期间使用'
      if (ability.oncePerTest && state.skillTest?.usedAbilities?.[`${asset.id}:${move.abilityIndex}`]) return '每次检定仅限一次'
      if (ability.oncePerPhase
        && inv.usedAbilities?.[`${asset.id}:${move.abilityIndex}:${state.round}:${state.phase}`]) return '每阶段仅限一次'
      if (ability.requiresNoClues) { const loc = state.locations.find(item => item.id === inv.location); if (loc && loc.clues > 0) return '所在地点仍有线索' }
      if (moveToBlocked(state, inv, ability.effect)) return '与敌人交战时不能使用这项移动'
      const effectInvalid = effectError(state, inv, ability.effect)
      if (effectInvalid) return effectInvalid
      if (move.optionIndex != null) {
        const ok = ability.effect && ability.effect.type === 'chooseOne' && Array.isArray(ability.effect.options) && ability.effect.options[move.optionIndex]
        if (!Number.isInteger(move.optionIndex) || !ok) return '无效选项'
        const branchError = effectError(state, inv, ability.effect.options[move.optionIndex].effect)
        if (branchError) return branchError
      }
      if (move.targetId != null) {
        if (ability.descriptor?.target) {
          // 目标枚举（B1）：只接受 enumerateTargets 的候选，与 legalMoves 用的是同一份枚举。
          const candidate = resolveTarget(state, inv, ability.descriptor.target, move.targetId, { source: asset })
          if (!candidate) return '该目标不是合法的能力目标'
        } else if (ability.descriptor) {
          // 描述子没有声明 target 时，目标由 resolve() 自己询问，这里只要求实体存在。
          if (!state.enemies.some(enemy => enemy.id === move.targetId)) return '该敌人不是有效目标'
        } else {
          const targets = abilityTargets(state, inv, ability.effect)
          if (!targets.some((e) => e.id === move.targetId)) return '该敌人不是有效目标'
        }
      } else if (ability.descriptor?.target && !ability.descriptor.target.optional) {
        return '该能力需要选择目标'
      }
      return null
    }
    case 'resign': {
      if (capabilityBlocked(state, inv, 'resign')) return '当前效果禁止你撤退'
      const loc = state.locations.find(item => item.id === inv.location)
      return loc?.resign || state.scenario.resignAnywhere ? null : '当前地点不能撤退'
    }
    case 'engage': {
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (enemy.location !== inv.location) return '该敌人不在你所在的地点'
      if (enemy.massive) return '庞大敌人已与所在地点所有调查员交战'
      if (enemy.engagedSeat === seat) return '你已经与该敌人交战'
      return null
    }
    case 'advanceAct': return canAdvanceWithClues(state) ? null : '当前线索或窗口不能推进场景'
    case 'endTurn': return null
    default: return '未知行动：' + move.action
  }
}

  return { legalMoves, validateMove }
}
