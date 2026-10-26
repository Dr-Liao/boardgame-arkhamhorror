// 合法行动枚举与校验（legalMoves / validateMove）从 engine.js 拆出的第六个模块
// （Phase 6 · 6d-6）。
//
// 这一对是「AI 与玩家看到同一份行动列表」的入口：legalMoves 枚举、validateMove 校验，
// 两边必须共用同一批判定函数，所以放在同一个模块里最安全。
// 依赖注入同前几个域；依赖清单由「engine 顶层声明 ∪ import 绑定 − 函数内局部」生成（先剥注释），
// 注入块用唯一标记定位，避免和 createCombat / createActions 的块混淆。
import { investigatorRule } from '../cards/card-rules.js'
import { scriptCardOwner } from './script-cards.js'
import { enemyIgnoresInvestigator } from './trait-passives.js'
import { locationEntryNotice } from './location-facts.js'
import { all as matchAll } from './matcher.js'
import { descriptorOfKind } from './ability.js'
import { entityParleyDescriptors, parleyMovesFor, parleyTargetError } from './parley.js'
// 第 5 步 P6：法术专用额外行动的算术（与 dispatch 共用同一份读点）。
import { actionsAvailable, spellOnlyActionsOf } from './spell-actions.js'

export function createMoves(deps) {
  const {
    LITA_CHANDLER_CODE,
    META,
    SKILL_NAMES,
    abilityTargets,
    actingSeats,
    actionCost,
    actionKind,
    isSpellAction,
    activeHiddenRules,
    advanceAct,
    aliveInvestigators,
    aloofPreventsAttack,
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

  // 「沉稳」卡牌场上仅限 1 张：按印刷特性判定，跨调查员也只允许一张。
  function isSteadfastCard(card) {
    return (card?.traits || []).some(trait => String(trait).toLowerCase() === 'composure')
  }

  function steadfastInPlay(state) {
    return state.investigators.some(inv => (inv.assets || []).some(asset => isSteadfastCard(cardDef(asset.code))))
  }

  // 「枪法如神」（04104）：持有 activateFirearmFight 窗口的快速事件时，枪械/远程支援的攻击
  // 可以只指向连接地点上的敌人——没有同地点目标也能激活，由窗口里的 04104 选择目标。
  function canExtendFirearmTarget(inv, asset) {
    const traits = cardDef(asset?.code)?.traits || []
    if (!traits.some(trait => ['firearm', 'ranged'].includes(String(trait).toLowerCase()))) return false
    return (inv.hand || []).some(code => {
      const descriptor = descriptorOfKind(code, 'played')
      return descriptor?.fast === true && descriptor.trigger.includes('activateFirearmFight')
    })
  }

  // 剧本行动里的「攻击」：条目用 attack: true 声明，与普通攻击/卡牌攻击共用同一份
  // 冷漠（aloof）判定——未与调查员交战的冷漠敌人不能被攻击，除非该行动写明忽略冷漠。
  // 剧本自己的攻击结算不经过 doFight，因此这里和 validateMove 必须同时拦住。
  function scenarioAttackBlocked(state, inv, move) {
    if (!move || move.attack !== true || move.enemyId == null) return false
    const enemy = state.enemies.find(item => item.id === move.enemyId)
    return aloofPreventsAttack(state, inv, enemy, move)
  }

  // 2026-10-25 本循环修复 05094（cannot-trigger-action-abilities）：威胁区卡可以禁止受影响调查员
  // 触发其控制卡牌上的 [action] 能力（免费/快速、地点与敌人行动不受影响）。
  function actionAbilityBlocked(state, inv) {
    return (inv.threat || []).some(card =>
      registeredEntry(card.code)?.threatEffect?.cannotTriggerActionAbilities === true)
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
  // attack: true 的剧本行动与普通攻击共用「冷漠」读点（见 scenarioAttackBlocked）。
  moves.push(...(scenarioBehavior(state).actions?.(state, inv) || []).filter(move => !move.reason)
    .filter(move => !scenarioAttackBlocked(state, inv, move)).map(move =>
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
  // 地点附属的「解除并放回游戏区域」（04270 骷髅钥匙）。
  for (const [attachmentIndex, attachment] of (loc?.attachments || []).entries()) {
    if (!registeredEntry(attachment.code)?.detachAction) continue
    if (attachment.ownerSeat != null && attachment.ownerSeat !== inv.seat) continue
    moves.push({ action: 'detachLocationAttachment', locationId: loc.id, attachmentIndex,
      label: `🔓 解除「${cardName(attachment.code)}」并放回游戏区域` })
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
    // 「每个地点仅限 1 张」的附属（03199）：同一地点已有同码附属时不能再打。
    if (registeredEntry(code)?.limitPerLocation
      && (state.playerLocationAttachments || []).some(item => item.code === code && item.location === inv.location)) continue
    if (registeredEntry(code)?.copiesBeneathEvents) {
      for (const copyCode of inv.beneath || []) {
        const copy = cardDef(copyCode)
        const copyPlayed = playedEffect(copyCode)
        const copyDescriptor = descriptorOfKind(copyCode, 'played')
        if (!copy || copy.type !== 'event' || copy.exceptional
          || (!copyPlayed && !copyDescriptor?.resolve) || playAccess(copyCode).reactionOnly) continue
        const cost = playCost(state, inv, copy)
        if (inv.resources < cost || (copyPlayed && effectError(state, inv, copyPlayed))) continue
        moves.push({ action: 'play', cardId: code, copyCode,
          label: `🃏 彩绘世界复制「${cardName(copyCode)}」(${cost} 资源)` })
      }
      continue
    }
    const cost = playCost(state, inv, def)
    // 2026-10-25 第五轮修复 05150：条目可通过 playCostReductionProvider 声明「支付前窗口最多能减多少」，
    // 打出合法性按「印刷费用 - 潜在减费」估算（例如资源不足但可横置黑书减费）。
    // 减费来源可以是「被打出的牌自己」或「场上受控支援」（取两者最大，保守不求和）。
    const potentialReduction = campaignPlayCostPreview(state, inv, code)?.discount || 0
      || Math.max(0,
        Number(typeof registeredEntry(code)?.playCostReductionProvider === 'function'
          ? registeredEntry(code).playCostReductionProvider(state, inv, def)
          : registeredEntry(code)?.playCostReductionProvider) || 0,
        ...inv.assets.map(asset => {
          const provider = registeredEntry(asset.code)?.playCostReductionProvider
          const value = typeof provider === 'function' ? provider(state, inv, def, asset) : provider
          return Number(value) || 0
        }))
    if (inv.resources < cost - potentialReduction
      && !charlesPayCandidate(state, inv, cost, def)) continue
    if (isSteadfastCard(def) && steadfastInPlay(state)) continue
    if (def.type === 'asset' && normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) continue
    const kindLabel = def.type === 'asset' ? '装备' : '打出'
    moves.push({ action: 'play', cardId: code, label: `🃏 ${kindLabel}「${cardName(code)}」(${cost} 资源)` })
  }
  // 2026-10-25 第七轮修复 05279：宿主附属的事件可如同手牌打出（横置/费用由宿主条目内容决定）。
  for (const host of (inv.assets || [])) {
    if (registeredEntry(host.code)?.playAttachedEvents !== true) continue
    for (const attachment of host.attachments || []) {
      const def = cardDef(attachment.code)
      if (!def || !['event', 'skill'].includes(def.type) || isWeaknessCard(def)) continue
      // 2026-10-25 第七轮修复 05279：宿主声明的附加费（横置宿主 / 花 uses）必须先可支付。
      const hostCost = registeredEntry(host.code)?.playAttachedEventCost || {}
      if (hostCost.exhaustHost && host.exhausted) continue
      if (hostCost.uses && (host.uses || 0) < hostCost.uses) continue
      moves.push({ action: 'play', cardId: attachment.code, fromAttachedEventOf: host.id,
        label: `📎 从「${cardName(host.code)}」的附属打出「${cardName(attachment.code)}」` })
    }
  }
  // 2026-10-25 第七轮修复 05002：hunch 揭示牌可「如同在手牌中」以 -2 费用打出。
  if (inv.hunchRevealed) {
    const hunchCode = inv.hunchRevealed
    const hunchDef = cardDef(hunchCode)
    if (hunchDef && !isWeaknessCard(hunchDef) && !blocked.has(hunchDef.type)) {
      const hunchCost = Math.max(0, playCost(state, inv, hunchDef) - 2)
      if (inv.resources >= hunchCost) {
        moves.push({ action: 'play', cardId: hunchCode, fromHunch: true,
          label: `🔮 从直觉牌库打出「${cardName(hunchCode)}」(${hunchCost} 资源，-2 费用)` })
      }
    }
  }
  // 2026-10-25 第七轮修复 05013：beneath 通道——持有 beneathPlayAsIfInHand 且未横置的支援时，
  // 「底下」的事件可以按手牌打出（额外费用：横置该支援）。
  {
    const beneathChannel = (inv.assets || []).find(asset =>
      registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
    if (beneathChannel) {
      for (const code of unique(inv.beneath || [])) {
        const def = cardDef(code)
        if (!def || def.type !== 'event' || isWeaknessCard(def) || blocked.has(def.type)) continue
        if (!runtimeCardAvailable(state, inv, code) || playAccess(code).reactionOnly) continue
        const cost = playCost(state, inv, def)
        if (inv.resources < cost || effectError(state, inv, playedEffect(code))) continue
        moves.push({ action: 'play', cardId: code, fromBeneath: true, channelAssetId: beneathChannel.id,
          label: `🕯️ 从底下打出「${cardName(code)}」(${cost} 资源，横置「${cardName(beneathChannel.code)}」)` })
      }
    }
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
  const freeAction = skids?.freeAction || null
  // 「预览 = 校验 = 扣费」：付得起但当前无从执行的免费行动不该出现在列表里——否则牌桌会给出
  // 一个点了必被 validateMove 拒绝的死按钮（赛菲娜下方没有事件、皮特没有可重整的支援、
  // 换行动却连一张能弃的手牌都没有）。
  if (freeAction && !investigatorTextBlanked(state, inv) && inv.resources >= (freeAction.cost.resources || 0)
    && (!freeAction.cost.discardHand
      || inv.hand.some(code => !isWeaknessCode(code) && canDiscardFromHand(inv, code)))
    && (freeAction.repeatable || !inv.usedReactions[freeAction.id + ':' + state.turnSerial])
    && !effectError(state, inv, freeAction.effect)) {
    moves.push({ action: 'freeAction', label: freeAction.label || '⚡ 花 2 资源获得 1 额外行动' })
  }

  for (const nb of new Set(loc ? loc.connections.filter(id => !movementError(state, inv, id)) : [])) {
    const target = state.locations.find((l) => l.id === nb)
    // P0：内容层可以声明「这次移动现在不能做」的理由（如《苍白面具》线索不足）。
    if (!target || investigatorEntryError(state, nb) || scenarioBehavior(state).moveError?.(state, inv, target, nb)) continue
    // 进入地点的强制效果由地点数据声明；只在已揭示时给出，避免泄露未翻开的背面。
    const entryNotice = target.revealed ? locationEntryNotice(state, target) : null
    moves.push({ action: 'move', locationId: nb, label: `🚶 移动到「${locLabel(state, nb)}」（线索 ${target.clues}${target.locked ? '，上锁' : ''}${entryNotice ? `；进入后：${entryNotice}` : ''}）` })
  }

  // 2026-10-25 第四轮修复 investigate-empty-location（05133 凯夏的房间等）：
  // 地点/剧本可以声明「0 线索也能调查」（调查本身仍要过检定，只是不发现线索）。
  const emptyInvestigate = loc && loc.clues <= 0 && !loc.locked
    && (loc.investigateWithoutClues === true
      || scenarioBehavior(state).investigateWithoutClues?.(state, inv, loc) === true)
  if (loc && (loc.clues > 0 || emptyInvestigate) && !loc.locked && !scenarioBehavior(state).investigationError?.(state, inv, loc)) {
    const skill = loc.investigateSkill || 'intellect'
    const scenarioShroud = (scenarioBehavior(state).locationShroudModifier?.(state, loc, inv) || 0)
      + entityModifierTotal(state, loc, 'locationShroud')
    const shroud = loc.shroud + (loc.shroudMod || 0) + (loc.peabodyShroud || 0) + (state.fogMod || 0) + scenarioShroud
    moves.push({ action: 'investigate', ...(emptyInvestigate ? { allowNoClues: true } : {}),
      label: `🔍 调查「${loc.name}」（${SKILL_NAMES[skill]} vs 帷幕 ${shroud}）` })
  }

  if (loc && loc.ability && locationAbilityAvailable(state, loc, inv)
    && !activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotTriggerLocationAbilities)) {
    moves.push({ action: 'locationAbility', locationId: loc.id, label: `📍 ${loc.ability.label}` })
  }

  for (const enemy of state.enemies.filter(enemy => enemy.location === inv.location)) {
    if ((!enemyRuleFlags(enemy.code).damageOnlyFrom || enemyTextBlanked(state, enemy)) && !hiddenFightBlocked(state, inv, enemy)
      && !enemyCannotBeAttacked(state, enemy) && !aloofPreventsAttack(state, inv, enemy)
      && scenarioBehavior(state).canFightEnemy?.(state, inv, enemy) !== false)
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
    // 2026-10-25 本循环修复 can-engage-enemy-hook：剧本可以声明「该敌人不能被交战」
    // （对应参考实现 CannotBeEngaged，如《恶罪报应》非幽灵地点的异端者）。
    if (!enemy.massive && enemy.engagedSeat !== seat && !enemyIgnoresInvestigator(state, inv, enemy)
      && scenarioBehavior(state).canEngageEnemy?.(state, inv, enemy) !== false) {
      moves.push({ action: 'engage', enemyId: enemy.id, label: `与「${enemy.name}」交战` })
    }
    // 谈判盘问独特异教徒。
    const def = enemyDef(enemy.code)
    if (def && def.parley && canParleyCultist(state, inv, def.parley.cost)) {
      moves.push({ action: 'parleyCultist', enemyId: enemy.id, label: `🤝 ${def.parley.label}「${enemy.name}」` })
    }
  }

  // 第 2 步 P2.7：地点 / 敌人 / 剧情资产上的「谈判」通用行动（不引发借机攻击）。
  // 2026-10-25 本循环修复 05245：剧本级「谈判限制」钩子（如「本局剩余时间不能与约瑟夫·梅吉尔谈判」）。
  for (const parley of parleyMovesFor(state, inv)) {
    const entity = state.enemies.find(item => item.id === parley.entityId)
      || state.locations.find(item => item.id === parley.entityId)
      || (state.storyAssets || []).find(item => item.id === parley.entityId)
      || null
    if (scenarioBehavior(state).parleyBlocked?.(state, inv, entity, parley.entityType) === true) continue
    moves.push(parley)
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


  // 2026-10-25 第七轮修复 05196：同地点队友的 teamActivatable 支援也可被激活（actor 支付费用）。
  const abilitySources = controlledAbilityCards(inv).map(asset => ({ asset, ownerSeat: inv.seat }))
  for (const other of aliveInvestigators(state)) {
    if (other.seat === inv.seat || other.location !== inv.location) continue
    for (const asset of other.assets || []) {
      if (registeredEntry(asset.code)?.teamActivatable !== true) continue
      abilitySources.push({ asset, ownerSeat: other.seat })
    }
  }
  for (const { asset: a, ownerSeat: abilityOwnerSeat } of abilitySources) {
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
      // 描述子的 criteria 是「这条能力当前是否可用」的唯一声明；legalMoves 不读会让
      // 条件型主动能力（如卡膛、古代地点）出现在列表里却在执行时静默失败。
      if (ab.descriptor?.criteria
        && !matchAll(ab.descriptor.criteria)({ state, inv, source: a, windowId: state.timingWindow, context: {} })) return
      if (ab.requiresNoClues && loc && loc.clues > 0) return
      if (moveToBlocked(state, inv, ab.effect)) return
      const free = ab.cost && ab.cost.action === false
      if (free && cannotTriggerFreeAbility(state, inv)) return
      // 05094：禁止触发 [action] 能力时，行动型能力不出现在列表里。
      if (!free && actionAbilityBlocked(state, inv)) return
      const prefix = free ? '⚡免费 ' : tomeActionEligible(state, inv, { action: 'ability', assetId: a.id, abilityIndex: i }) ? '[书籍额外行动] ' : ''
      // Phase 2（C3）：动态费用在行动文案里给出当前数值（"预览 = 校验 = 扣费"同一份求值）。
      const suffix = costPreviewSuffix(state, inv, a, ab) || ''
      // 威胁区弱点的「当前 / 目标」计数也写进文案（例如怒灵 2/4）：这张免费能力每次只加 1，
      // 达标后继续用只会白耗支援充能，AI 需要每一眼都能看到进度。
      const requiredUses = inv.threat.includes(a) ? registeredEntry(a.code)?.physicalTraumaIfUsesBelow : null
      const progress = Number.isFinite(requiredUses) && a.uses != null
        ? `（${a.usesType === 'charges' ? '充能' : '标记'} ${a.uses}/${requiredUses}）` : ''
      const base = { action: 'ability', assetId: a.id, abilityIndex: i,
        ...(abilityOwnerSeat !== inv.seat ? { ownerSeat: abilityOwnerSeat } : {}) }
      // 2026-10-25 第七轮修复 05230：所附属卡禁止宿主攻击与你交战的敌人。
      const hostAttackBlocked = (a.attachments || []).some(attachment => registeredEntry(attachment.code)?.hostCannotAttackEngaged)
      const hostFilter = candidate => !(hostAttackBlocked && ((candidate && candidate.engagedSeat === inv.seat) || (candidate && candidate.entity && candidate.entity.engagedSeat === inv.seat)))
      // 目标枚举（B1）：描述子声明 target 时，每个合法目标拆成一条独立行动，
      // 牌桌可以先选目标、AI 不用再多问一轮。没有目标且非 optional 就不出现。
      if (ab.descriptor && ab.descriptor.target) {
        const candidates = enumerateTargets(state, inv, ab.descriptor.target, { source: a }).filter(hostFilter)
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
      if (ab.effect?.type === 'fight' && !abilityTargets(state, inv, ab.effect).length
        && !canExtendFirearmTarget(inv, a)) return
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
      const targets = abilityTargets(state, inv, ab.effect).filter(hostFilter)
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
  // 2026-10-25 第四轮修复 action-legality-hook（05140 等）：剧本可以按任意理由禁止某个行动
  // （返回字符串作为提示，或返回 false 表示「不许做但不解释」）。legalMoves 末尾统一过本读点。
  {
    const scenarioActionError = scenarioBehavior(state).actionBlocked?.(state, inv, move)
    if (scenarioActionError) {
      return typeof scenarioActionError === 'string' ? scenarioActionError : '当前效果禁止该行动'
    }
  }
  {
    const cost = actionCost(state, inv, move)
    const kind = actionKind(state, inv, move)
    if (kind === 'explore' ? inv.actionsLeft < cost : actionsAvailable(inv, isSpellAction(state, inv, move)) < cost) {
      return kind === 'explore' ? '行动点不足'
        : spellOnlyActionsOf(inv) && !isSpellAction(state, inv, move) ? '行动点不足（额外行动只能用于探索或法术）'
          : '行动点不足（额外行动只能用于探索）'
    }
  }

  switch (move.action) {
    case 'scenarioAction': {
      // 剧本行动的校验不能只看「规则名存在」：带 enemyId 的行动还要确认该目标在
      // actions() 里被列出（冷漠敌人未交战时攻击行动不会列出），再统一过冷漠读点。
      const offered = scenarioBehavior(state).actions?.(state, inv) || []
      const matches = offered.filter(m => m.rule === move.rule && !m.reason)
      if (!matches.length) return '当前不能执行此剧本行动'
      if (move.enemyId != null) {
        const targeted = matches.find(m => m.enemyId === move.enemyId)
          // 有些剧本行动在执行时才选目标（actions() 不给 enemyId），保留给 performAction 校验。
          || matches.find(m => m.enemyId == null)
        if (!targeted) return '该行动不能以这个敌人为目标'
        if (scenarioAttackBlocked(state, inv, targeted)) {
          return '冷漠敌人未与调查员交战，需要先主动交战（或使用忽略冷漠的攻击）'
        }
      }
      return null
    }
    case 'encounterAction': return scenarioBehavior(state).encounterActions?.(state, inv).some(m => m.rule === move.rule && !m.reason)
      ? null : '当前不能执行此遭遇卡行动'
    case 'play': {
      const def = cardDef(move.cardId)
      if (!def) return '未知卡牌'
      if (!lolaCanUseCard(inv, move.cardId)) return '罗拉只能使用中立或当前角色阵营的卡牌'
      if (scenarioBehavior(state).canPlayCard?.(state, inv, def) === false) return '当前效果禁止你打出卡牌'
      // 2026-10-25 第七轮修复 05279：宿主附属的事件可如同手牌打出。
      if (move.fromAttachedEventOf) {
        const host = (inv.assets || []).find(asset => asset.id === move.fromAttachedEventOf
          && registeredEntry(asset.code)?.playAttachedEvents === true)
        if (!host || !(host.attachments || []).some(entry => entry.code === move.cardId)) return '该附属事件不在这里'
        const hostCost = registeredEntry(host.code)?.playAttachedEventCost || {}
        if (hostCost.exhaustHost && host.exhausted) return '宿主已横置，不能打出附属事件'
        if (hostCost.uses && (host.uses || 0) < hostCost.uses) return '宿主使用次数不足'
      }
      // 2026-10-25 第七轮修复 05002：hunch 揭示牌打出校验。
      if (move.fromHunch) {
        // 2026-10-25 第七轮修复 05002（交叉复核 dispute）：揭示副本与手牌同名另一张是两份可互换的牌，
        // 允许揭示副本按 -2 费打出（手里同名另一张仍按普通价单独列出）。
        if (inv.hunchRevealed !== move.cardId) return '直觉牌库没有揭示这张牌'
      }
      // 2026-10-25 第七轮修复 05013：beneath 打出需要未横置的通道支援且卡在底下。
      if (move.fromBeneath) {
        const channel = (inv.assets || []).find(asset =>
          registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
        if (!channel) return '没有可用的 beneath 通道支援'
        if (!(inv.beneath || []).includes(move.cardId)) return '底下没有这张牌'
      }
      const playBlocked = cardPlayBlockedReason(state, inv, def)
      if (playBlocked) return playBlocked
      if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotPlayTypes?.includes(def.type))) return '隐私牌禁止你打出该类型卡牌'
      if (def.permanent) return '永久卡在开局时入场'
      // 打出条件的唯一读点（Phase 1）：描述子 playCondition + 旧 DSL 的 10 个字段
      // 都在 src/engine/play-condition.js 里收敛，引擎不再逐字段判断。
      const conditionError = playConditionError(state, inv, move.cardId, playConditionHelpers(state))
      if (conditionError) return conditionError
      if (!runtimeCardAvailable(state, inv, move.cardId) || def.dataStatus === 'quarantined') return '该卡牌未获运行时许可'
      if (registeredEntry(move.cardId)?.limitPerLocation
        && (state.playerLocationAttachments || []).some(item => item.code === move.cardId && item.location === inv.location)) {
        return '该地点已经有一张同名附属'
      }
      if (registeredEntry(move.cardId)?.copiesBeneathEvents) {
        const copied = cardDef(move.copyCode)
        const copiedPlayed = playedEffect(move.copyCode)
        const copiedDescriptor = descriptorOfKind(move.copyCode, 'played')
        if (!inv.beneath?.includes(move.copyCode) || !copied || copied.type !== 'event' || copied.exceptional
          || (!copiedPlayed && !copiedDescriptor?.resolve) || playAccess(move.copyCode).reactionOnly) return '彩绘世界没有合法的复制事件'
        if (!inv.hand.includes(move.cardId)) return '手牌中没有彩绘世界'
        if (inv.resources < playCost(state, inv, copied)) return '资源不足'
        return copiedPlayed ? effectError(state, inv, copiedPlayed) : null
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
      } else if (!move.fromBeneath && !move.fromHunch && !move.fromAttachedEventOf && !inv.hand.includes(move.cardId)) return '手牌中没有这张牌'
      if (playAccess(move.cardId).reactionOnly) return '该牌只能在对应的反应窗口打出'
      if (cannotPlayTypes(inv).has(def.type)) return '当前禁止打出该类型卡牌'
      if (inv.resources < playCost(state, inv, def)
        - (campaignPlayCostPreview(state, inv, move.cardId)?.discount || 0)
        - Math.max(0,
          Number(typeof registeredEntry(move.cardId)?.playCostReductionProvider === 'function'
            ? registeredEntry(move.cardId).playCostReductionProvider(state, inv, def)
            : registeredEntry(move.cardId)?.playCostReductionProvider) || 0,
          ...inv.assets.map(asset => {
            const provider = registeredEntry(asset.code)?.playCostReductionProvider
            const value = typeof provider === 'function' ? provider(state, inv, def, asset) : provider
            return Number(value) || 0
          }))
        && !charlesPayCandidate(state, inv, playCost(state, inv, def), def)) return '资源不足'
      if (def.unique && state.investigators.some(item => item.assets.some(asset => cardDef(asset.code)?.name === def.name))) return '唯一资产已经在场'
      if (def.type === 'asset' && normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) return '槽位已满'
      if (playAccess(move.cardId).limitPerInvestigator
        && inv.assets.some(asset => asset.code === move.cardId)) return '每位调查员仅限 1 张'
      // 「沉稳」卡牌场上仅限 1 张（03107/03109/03111/03113/03115）。
      if (isSteadfastCard(def) && steadfastInPlay(state)) return '沉稳卡牌场上仅限 1 张'
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
      if (!skids.freeAction.repeatable && inv.usedReactions[skids.freeAction.id + ':' + state.turnSerial]) return '本回合已使用'
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
      return movementError(state, inv, move.locationId) || investigatorEntryError(state, move.locationId)
    }
    case 'move': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || !loc.connections.includes(move.locationId)) return '不能移动到该地点'
      const scenarioMoveError = scenarioBehavior(state).moveError?.(
        state, inv, state.locations.find(l => l.id === move.locationId), move.locationId)
      return movementError(state, inv, move.locationId) || investigatorEntryError(state, move.locationId) || scenarioMoveError || null
    }
    case 'entityAbility': {
      const entity = state.enemies.find(item => item.id === move.entityId)
        || state.locations.find(item => item.id === move.entityId)
        || (state.storyAssets || []).find(item => item.id === move.entityId)
      if (!entity) return '目标实体不在场上'
      if (entity.location != null && entity.location !== inv.location) return '目标不在此地点'
      // 2026-10-25 本循环修复 05245：剧本级谈判限制（与 legalMoves 的同一读点）。
      if (scenarioBehavior(state).parleyBlocked?.(state, inv, entity, move.entityType ?? 'entity') === true) return '当前不能与该目标谈判'
      const descriptors = entityParleyDescriptors(entity)
      const descriptor = descriptors[move.abilityIndex]
      if (!descriptor) return '该实体没有这条能力'
      const error = parleyTargetError(state, inv, entity, descriptor, move)
      if (error) return error
      return null
    }
    case 'investigate': {
      if (capabilityBlocked(state, inv, 'investigate')) return '当前效果禁止你调查'
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc) return '这里没有地点可调查'
      if (loc.clues <= 0) {
        // 2026-10-25 第四轮修复 investigate-empty-location：0 线索地点默认不能被调查，
        // 除非地点/剧本明确允许（此时调查仍可进行，只是不发现线索）。
        const allowed = loc.investigateWithoutClues === true
          || scenarioBehavior(state).investigateWithoutClues?.(state, inv, loc) === true
        if (!allowed) return '这里没有线索可调查'
      }
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
      if (aloofPreventsAttack(state, inv, enemy)) return '冷漠敌人未与调查员交战，需要先主动交战（或使用忽略冷漠的攻击）'
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
      // 2026-10-25 第七轮修复 05196：团队激活的 validate 放行（资产属于同地点队友且 teamActivatable）。
      if (move.ownerSeat != null && move.ownerSeat !== seat) {
        const owner = state.investigators[move.ownerSeat]
        const teamAsset = owner?.assets?.find(item => item.id === move.assetId)
        if (!teamAsset || registeredEntry(teamAsset.code)?.teamActivatable !== true || owner.location !== inv.location) {
          return '该支援不能由你团队激活'
        }
      }
      // 2026-10-25 第七轮修复 05196：团队激活时资产属于同地点队友。
      const asset = controlledAbilityCard(inv, move.assetId)
        || (Number.isInteger(move.ownerSeat)
          ? state.investigators[move.ownerSeat]?.assets?.find(item => item.id === move.assetId)
          : null)
      if (!asset) return '未找到该资产'
      if (capabilityBlocked(state, inv, 'triggerAbilities')) return '当前效果禁止你触发能力'
      if (!lolaCanUseCard(inv, asset.code)) return '罗拉不能触发非当前角色阵营卡牌的能力'
      const eff = assetEffect(inv, asset)
      const ability = eff && eff.abilities && eff.abilities[move.abilityIndex]
      if (!ability || !Number.isInteger(move.abilityIndex)) return '无效能力'
      if (ability.descriptor && limitUsed(state, inv, ability.descriptor, null, state.timingWindow, asset)) {
        return '该能力的次数已用完（本阶段/本回合/本局）'
      }
      if (ability.descriptor?.criteria
        && !matchAll(ability.descriptor.criteria)({ state, inv, source: asset, windowId: state.timingWindow, context: {} })) {
        return '该能力当前不可用'
      }
      if (ability.cost?.action === false && cannotTriggerFreeAbility(state, inv)) return '隐私牌禁止你触发免费能力'
      if (ability.cost?.action !== false && actionAbilityBlocked(state, inv)) return '当前效果禁止你触发 [action] 能力'
      if (!canAffordAbility(state, inv, asset, ability)) return '能力成本不足'
      if (ability.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return '只能在自己的技能检定期间使用'
      if (ability.oncePerTest && state.skillTest?.usedAbilities?.[`${asset.id}:${move.abilityIndex}`]) return '每次检定仅限一次'
      if (ability.oncePerPhase
        && inv.usedAbilities?.[`${asset.id}:${move.abilityIndex}:${state.round}:${state.phase}`]) return '每阶段仅限一次'
      if (ability.requiresNoClues) { const loc = state.locations.find(item => item.id === inv.location); if (loc && loc.clues > 0) return '所在地点仍有线索' }
      if (moveToBlocked(state, inv, ability.effect)) return '与敌人交战时不能使用这项移动'
      const effectInvalid = effectError(state, inv, ability.effect)
      // 没有同地点目标时，持有 04104 的枪械攻击仍然可以激活（窗口里改指连接地点）。
      const extendTarget = ability.effect?.type === 'fight' && canExtendFirearmTarget(inv, asset)
      if (effectInvalid && !extendTarget) return effectInvalid
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
      if (scenarioBehavior(state).canEngageEnemy?.(state, inv, enemy) === false) return '该敌人不能被交战'
      return null
    }
    case 'advanceAct': return canAdvanceWithClues(state) ? null : '当前线索或窗口不能推进场景'
    case 'detachLocationAttachment': {
      const detachLoc = state.locations.find(item => item.id === move.locationId)
      const attachment = detachLoc?.attachments?.[move.attachmentIndex]
      if (!attachment || !registeredEntry(attachment.code)?.detachAction) return '这里没有可解除的附属'
      if (attachment.ownerSeat != null && attachment.ownerSeat !== inv.seat) return '这不是你的附属'
      return null
    }
    case 'endTurn': return null
    default: return '未知行动：' + move.action
  }
}

  return { legalMoves, validateMove }
}
