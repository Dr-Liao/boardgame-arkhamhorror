import { nextInstanceId } from './rules-state.js'
import { mechanicState } from './mechanic-state.js'
import { recordEnemyPhaseAttack, resolveElusiveAfterAttack } from './enemy-keyword-movement.js'
import { enemyBody, enemyIsBody, enemyIsPart, enemyParts } from './enemy-parts.js'
import { discardHostedAssets } from './hosted-assets.js'
import { discardEncounterAttachment, routeEnemyDiscardToScenarioDeck } from './scenario-decks.js'
import { emitPresentation } from './presentation-events.js'
import { vehicleOf } from './vehicle-state.js'
import { createEnemyZoneApi } from './enemy-zones.js'
import { createEnemyOutcomeApi } from './enemy-outcomes.js'
import { wouldAddToVictory } from './victory-destination.js'
import { replacePlayerZoneCards } from './player-zones.js'
import { eventWindowContext } from './event-window.js'
import { keysOnExit } from './scenario-keys.js'
import { damageSourceMatches, effectSourceIsPlayer, enemyEffectAllowed, enemyIsSlumbering, enemyModifierAllowed } from './effect-provenance.js'
import { playerLocationRuleActive } from './location-attachments.js'
import { consumeHarmBonus } from './effect-state.js'
import { distributeConcealed } from './tsk-concealed.js'
import { hasWindowListener } from './window-listeners.js'
import { adjustEnemyDamage, enemyDamagePlaced, enemyDamageRedirectTarget } from './enemy-damage.js'
import { enemyAttachmentRules, enemyAttackingDamageBonus, enemyIsMassive } from './enemy-keyword-movement.js'
import { cardOutcomeAudioScoped, noteCardOutcomeSound } from './card-outcome-audio.js'

export function cancelAssignedHarm(context, kind, amount = 1) {
  if (context?.when !== 'assignedHarm' || context.cannotCancel || !['damage', 'horror'].includes(kind)
    || !Number.isSafeInteger(amount) || amount < 1) return 0
  const cancelled = Math.min(Math.max(0, context[kind] || 0), amount)
  if (cancelled > 0) context[kind] -= cancelled
  return cancelled
}
// 敌人与伤害（applyHarm / 攻击 / 生成 / 击败 / 交战）从 engine.js 拆出的模块
// （Phase 6 · 6d-22）。
//
// 这一组是规则最「热」的底层原语：
//   applyHarm / applyDamage / applyHorror —— 一切伤害与恐惧的唯一入口（含 soaking、直接伤害、
//     反伤、击败资产）
//   enemyHealth / enemyFightValue / enemyEvadeValue —— 敌人数值读点
//   enemyAttack —— 敌人攻击流程（反应窗口、修正、结算）
import { enemySpawnRuleFor } from '../cards/card-rules.js'
import { sourceCardDef, weaknessOwnerSeat } from './card-lookup.js'
import { enemyIgnoresInvestigator } from './trait-passives.js'
import { enemyCanEnterLocation, enemyProtectionBlocks } from './enemy-entry.js'
import { enemyCannotBeDamaged } from './enemy-restrictions.js'
import { ignoredEnemyAttackOffer, markIgnoredEnemyAttack, storyAssetEnemyDamageRedirect } from './story-asset-rules.js'
import { capturedActionError } from './capture.js'
import { capabilityBlocked } from './modifiers.js'
import { swarmGroup, returnSwarmCard, swarmCardsOf } from './swarm.js'
import { tracksHistory } from './action-history.js'
import { effectRecipient } from './effect-recipient.js'
import { hasTrait } from './matcher.js'
import { cardHarmSource, directDamageSource, directDamageCue } from '../integration/direct-damage.js'
import { enemyAttackStyle, tagAttackHarm, attackHarmOrigin } from '../integration/enemy-attack-presentation.js'
// P6（食梦者）：支援被击败的唯一判定点（含 assetDefeated 窗口）。
import { checkAssetDefeated } from './asset-defeat.js'
// P5 地球边缘：调查员专属记账（攻击历史 / 回合事件）—— 只对条目声明 tracksAttacks /
// roundEvents 的调查员写入，旧对局与回放指纹不变。
import { noteEnemyAttackOnInvestigator, noteRoundEvent } from './eote-investigator-support.js'
import { reactionSource } from './reaction-source.js'
//   spawnEnemy / engageEnemy / disengageEnemy / defeatEnemy / damageEnemy —— 敌人生死与交战
//
// 它们被几乎所有 do* 与剧本运行时调用，拆出来后 engine.js 只剩状态机与「动作编排」。

export function createEnemies(deps) {
  const {
    campaignState,
    entityModifierTotal,
    EFFECTS,
    pallidMaskCode,
    SMITE_THE_WICKED_CODE,
    addDoom, syncClues, placeDoomOnCard,
    addVictory,
    aliveInvestigators,
    assetPassiveData,
    assignHarm,
    cardDef,
    cardIdentityFields,
    cardName,
    captureTableState,
    checkAct,
    checkAgendaForcedEnemyDefeated,
    checkDefeated,
    checkOutcome,
    discardRandomFromHand,
    enemyCanBeDefeated,
    enemyCannotAttack,
    enemyDef,
    enemyHealthDelta,
    enemyHealthValue,
    enemyRuleFlags,
    enemyStatMods,
    enemyTextBlanked,
    entityRuleActive,
    exilePlayerCard,
    getMaxSanity,
    getStat,
    info,
    isWeaknessCode,
    leadDecisionSeat,
    leaveAsset,
    locationExists,
    newEnemyId,
    processPlayerEnemyEntry,
    randomValue,
    reactionWindow,
    registeredEntry,
    releaseChaosTokens,
    removeOne,
    requestChoice,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    triggerReaction,
    triggerThreatForced,
    tryAquinnahRedirect,
  } = deps

// 2026-10-25 第五轮修复（05321/05157 等）：敌人「本回合/本轮」的运行期数值修正。
// 条目在 api.addEnemyStatModifier 写入 {fight,evade,health,floor,until}；这里按当前轮/回合过滤。
//
// 沉睡（enemyRule.slumbering）的目标还要按**这一行自己的来源**再过滤一次：玩家卡写的运行期
// 修正不能落在免疫玩家卡效果的沉睡敌人身上；行上没有来源时 fail-closed（与
// effect-provenance 的 enemyModifierAllowed 同一口径），敌人/剧本来源的行照常生效。
function activeRuntimeEnemyMods(state, enemy) {
  const mods = enemy?.statMods
  if (!Array.isArray(mods) || !mods.length) return []
  const slumbering = enemyIsSlumbering(state, enemy, { entryOf: registeredEntry, isBlanked: enemyTextBlanked })
  return mods.filter(mod => {
    const until = mod.until || {}
    if (until.round != null && state.round !== until.round) return false
    if (until.turnSerial != null && state.turnSerial !== until.turnSerial) return false
    if (until.phase != null && state.phase !== until.phase) return false
    if (slumbering && !enemyModifierAllowed(state, enemy, mod, { entryOf: registeredEntry, cardDef })) return false
    return true
  })
}

function runtimeEnemyStat(state, enemy, kind) {
  let delta = 0
  let floor = 0
  for (const mod of activeRuntimeEnemyMods(state, enemy)) {
    if (Number.isFinite(mod[kind])) delta += mod[kind]
    if (Number.isFinite(mod.floor)) floor = Math.max(floor, mod.floor)
  }
  return { delta, floor }
}

function enemyHealth(state, enemy) {
  if (enemy.health === null) return null
  // 印刷值 + 剧本常驻修正 + 能力层声明式修正（例如 02255 的「文本空白时按人数扣血」）。
  const runtime = runtimeEnemyStat(state, enemy, 'health')
  const value = enemyHealthValue(state, enemy, scenarioBehavior(state)) + enemyHealthDelta(state, enemy) + runtime.delta
  return Math.max(runtime.floor || 1, value)
}

function enemyFightValue(state, enemy, inv) {
  if(enemy.fight===null)return null
  let value = enemy.fight + (enemyStatMods(state).enemyFight || 0)
  // P8：把正在应对的调查员传给内容层钩子（按人/按手牌数的战斗值修正）。
  value += scenarioBehavior(state).enemyStatModifier?.(state, enemy, 'fight', inv) || 0
  // D1：敌人的战斗值修正来自它自己的卡面声明，或它所在地点的卡面声明
  // （「此处的每个蛇族敌人 +1」不再需要章节 behavior）。
  value += entityModifierTotal(state, enemy, 'enemyFight')
  for (const rule of enemyAttachmentRules(enemy)) value += rule.fight || 0
  const here = state.locations.find(location => location.id === enemy.location)
  if (!enemy.elite) value += Number(registeredEntry(here?.originalCode || here?.code)?.locationRule?.enemyStatModifiers?.nonElite?.fight) || 0
  // 03100 王之法令一类的「本轮全局战斗修正」已由战役内容 enemyStatModifier 读条目数据结算
  // （P2-6：不再用 enemy 实例上的单卡字段）。
  const reduction = enemy.fightReduction
  if (reduction && reduction.round === state.round && reduction.phase === state.phase) value = Math.max(0, value - (reduction.amount || 0))
  // 2026-10-25 第五轮：本回合/本轮的运行期战斗值修正（可带 floor）。
  const runtime = runtimeEnemyStat(state, enemy, 'fight')
  value = Math.max(runtime.floor || 0, value + runtime.delta)
  return value
}

function enemyEvadeValue(state, enemy, inv) {
  if(enemy.evade===null)return null
  let value = enemy.evade + (enemyStatMods(state).enemyEvade || 0)
  // P8：把正在应对的调查员传给内容层钩子（「每张手牌中的遭遇卡 +1 难度」这类按人修正）。
  value += scenarioBehavior(state).enemyStatModifier?.(state, enemy, 'evade', inv) || 0
  value += entityModifierTotal(state, enemy, 'enemyEvade')
  for (const rule of enemyAttachmentRules(enemy)) value += rule.evade || 0
  // 2026-10-25 第五轮：本回合/本轮的运行期躲避值修正（卡面「最低 1」由条目给 floor:1）。
  const runtime = runtimeEnemyStat(state, enemy, 'evade')
  value = Math.max(runtime.floor || 0, value + runtime.delta)
  return value
}

// ---------------------------------------------------------------------------
// 槽位系统
// ---------------------------------------------------------------------------

function enemiesEngagedWith(state, inv) {
  if (capabilityBlocked(state, inv, 'engage')) return []
  return state.enemies.filter(e => !enemyIsPart(e)
    && (e.engagedSeat === inv.seat || (enemyIsMassive(state, e) && e.location === inv.location)))
}

// 「敌军阶段期间，每个处于重整状态的<TRAIT>敌人可以攻击本地点的调查员，如同其已交战」
// （07327 缟玛瑙守卫）：地点条目声明 `locationRule.enemiesAttackAsIfEngagedHere`（特性数组
// 或 { traits }），读点是敌军阶段的攻击枚举（turn.js#enemyPhase / resolveEnemyPhaseOf）。
// 只影响「谁能攻击」，不建立交战关系（不写 engagedSeat、不影响攻击行动目标）。
function enemyAttacksAsIfEngaged(state, enemy, inv) {
  if (!enemy || !inv || enemyIsPart(enemy) || enemy.defeated || enemy.removedFromGame || enemy.exhausted) return false
  if (inv.defeated || inv.resigned) return false
  if (enemy.location == null || enemy.location !== inv.location) return false
  if (enemyTextBlanked(state, enemy)) return false
  // 沉睡面印刷「不能攻击」：as-if-engaged 不能覆盖它自己的禁止攻击文本。
  if (enemyIsSlumbering(state, enemy, { entryOf: registeredEntry, isBlanked: enemyTextBlanked })) return false
  const location = (state.locations || []).find(item => item.id === enemy.location)
  const rule = registeredEntry(location?.originalCode || location?.code)?.locationRule?.enemiesAttackAsIfEngagedHere
  if (!rule) return false
  const traits = Array.isArray(rule) ? rule : (rule.traits || [])
  return !traits.length || traits.some(trait => hasTrait(enemy, trait))
}

// 猎物（prey）排序：数值越小越优先，便于统一计算并列集合。

function enemyAttack(state, enemy, inv, events, label, options = {}) {
  if (enemy && options.kind === 'opportunity' && playerLocationRuleActive(state, enemy, 'blocksEnemyOpportunityAttack')) return false
  inv = effectRecipient(state, inv)
  if(enemyZoneApi(state,events).isInactive(enemy.id))return false
  if (enemy.attackProtection?.[inv.seat] === state.round) return false
  const parts = enemyParts(state, enemy)
  const baseDamage = enemyIsBody(enemy) ? parts.reduce((sum, part) => sum + part.damage, 0) : enemy.damage
  const baseHorror = enemyIsBody(enemy) ? parts.reduce((sum, part) => sum + part.horror, 0) : enemy.horror
  const attack = {
    kind: options.kind || 'enemy',
    source: options.source || null,
    plannedDamage: baseDamage,
    plannedHorror: baseHorror,
    damage: 0,
    horror: 0,
    cancelled: false,
  }
  // 「在逃中」（01010）：直到本轮结束，非精英敌人不能攻击你——包括反击、警戒与效果发起的攻击。
  if (inv?.onTheLam && !enemy.elite) {
    info(state, events, `🕶️ 「在逃中」：非精英敌人「${enemy.name}」不能攻击 ${inv.name}。`)
    return false
  }
  // 04325b/04326b：「[[蛇族]]/[[异教徒]]敌人不与你交战，也不攻击你」。
  // 由调查员实例上的 enemyPassiveTraits 声明（内容层写入），引擎在此统一拦截所有攻击来源。
  if (inv && enemyIgnoresInvestigator(state, inv, enemy)) {
    info(state, events, `🕊️ 「${enemy.name}」不会攻击 ${inv.name}（调查员被动）。`)
    attack.cancelled = true
    return false
  }
  // “狼人”德鲁「攻击时治愈 1 点伤害」由 01137 的 forced 描述子在 enemyAttack 窗口结算。
  // 「不能攻击」（失落时代 P2 通用开关，04048 守卫者）。卡牌效果造成的攻击不受此限制。
  if (enemyAttachmentRules(enemy).some(rule => rule.cannotAttack) || (attack.kind !== 'effect' && enemyCannotAttack(state, enemy))) {
    info(state, events, `⛔ 「${enemy.name}」不能攻击。`)
    attack.cancelled = true
    return false
  }
  // 沉睡（enemyRule.slumbering）的敌人印着「不能攻击」：连效果造成的攻击也不放行。
  if (!enemyEffectAllowed(state, enemy, 'initiateAttack', { entryOf: registeredEntry, isBlanked: enemyTextBlanked, cardDef })) {
    info(state, events, `⛔ 「${enemy.name}」正在沉睡，不能攻击。`)
    attack.cancelled = true
    return false
  }
  recordEnemyPhaseAttack(state, enemy)
  // P7 TDC 11638 伊克雷希特碎片：每轮第一次由[[星之眷族]]/[[深潜者]]发起的攻击可以被忽略。
  if (attack.kind !== 'effect') {
    const ignoreOffer = ignoredEnemyAttackOffer(state, enemy, inv)
    if (ignoreOffer) {
      markIgnoredEnemyAttack(ignoreOffer, state)
      const answer = requestChoice(state, {
        kind: 'reaction', source: 'ignoreFirstAttack', seat: inv.seat,
        prompt: `是否忽略本回合首次由「${enemy.name}」发起的攻击？`,
        options: [{ id: 'ignore', label: '忽略这次攻击' }, { id: 'take', label: '正常结算攻击' }],
      })
      if (answer === 'ignore') {
        info(state, events, `🛡️ 「${cardName(ignoreOffer.asset.code)}」忽略了「${enemy.name}」本回合的首次攻击。`)
        attack.cancelled = true
        return false
      }
    }
  }
  const attackKey = options.attackKey || (hasWindowListener(state, 'harmAssigned') ? nextInstanceId(state, 'attack') : null)
  const attackLimitContext = attackKey ? { attackKey } : {}
  const attackerWasInPlay = state.enemies.includes(enemy)
  const context = reactionWindow(state, 'enemyAttack',
    { when: 'enemyAttack', seat: inv.seat, location: inv.location, enemy, attack, ...attackLimitContext, attackKind: attack.kind,
      redirectToSeat: null,
      prompt: `「${enemy.name}」攻击 ${inv.name}` }, events)
  // 批次 3（60472/60473）：把本次攻击重定向给另一名调查员（只重定向一次，避免递归环）。
  if (context.redirectToSeat != null && context.redirectToSeat !== inv.seat && !options.redirected) {
    const target = state.investigators[context.redirectToSeat]
    if (target && !target.defeated && !target.resigned) {
      info(state, events, `↪️ 「${enemy.name}」的攻击改为攻击 ${target.name}。`)
      return enemyAttack(state, enemy, target, events, label, { ...options, redirected: true, attackKey })
    }
  }
  if (attackerWasInPlay && !state.enemies.includes(enemy)) return false
  // 03068b：该敌人的攻击不能被取消。
  if (context.cancelled && enemyRuleFlags(enemy.code).attacksCannotBeCancelled) {
    info(state, events, `⛔ 「${enemy.name}」的攻击不能被取消。`)
    context.cancelled = false
  }
  if (context.cancelled) {
    info(state, events, `「${enemy.name}」对 ${inv.name} 的攻击被取消。`)
    attack.cancelled = true
    // P5：攻击历史记账在「被取消也会开窗口」的窗口之前——丹妮拉/扳手读同一份记录。
    noteEnemyAttackOnInvestigator(state, inv, enemy, attack)
    // 2026-10-25 本循环修复 05258：「敌人攻击你后，即便该次攻击被取消」也必须开一次 enemyAttacked 窗口；
    // 未取消路径仍在攻击结算后开唯一一次窗口（见本函数末尾），不会重复。
    // 注意：这里用 attackCancelled 而不是 cancelled 表达「攻击被取消」——cancelled 是
    // openAbilityWindow 的「本窗口取消」语义，写成 cancelled 会导致窗口里不再枚举反应。
    reactionWindow(state, 'enemyAttacked', {
      when: 'enemyAttacked', seat: inv.seat, location: inv.location, enemy, attack,
      ...attackLimitContext, attackCancelled: true, cancelled: false,
      prompt: `「${enemy.name}」攻击 ${inv.name} 后（该次攻击被取消）`,
    }, events)
    if (attack.kind !== 'retaliate') resolveElusiveAfterAttack(state, enemy, registeredEntry,
      () => scenarioRuntime(state, events), item => enemyTextBlanked(state, item))
    return false
  }
  // 2026-11-11：敌人攻击期间**所有**窗口的 context.source 都要能标成 enemyAttack。
  // 卡面「攻击时随机弃手牌」发生在伤害之前，旧实现只包住 applyHarm，弃手牌窗口会被误标成
  // other；「否定存在」因此打不出。攻击结束恢复外层值（可能来自嵌套的敌人攻击）。
  const previousAttackSource = state._enemyAttackResolving
  state._enemyAttackResolving = { enemy, inv, kind: attack.kind }
  try {
    let extraDamage = baseDamage - enemy.damage
    let extraHorror = baseHorror - enemy.horror
    if (!enemyTextBlanked(state, enemy)) scenarioBehavior(state).enemyAttackStarted?.(state, enemy, inv, scenarioRuntime(state, events), attack)
    const attackBonus = scenarioBehavior(state).enemyAttackModifier?.(state, enemy, inv) || {}
    extraDamage += attackBonus.damage || 0
    extraHorror += attackBonus.horror || 0
    // Phase 5（5a-13）：敌人卡面的特殊攻击规则在 card-rules.js 的 ENEMY_RULE_FLAGS 里。
    if (!enemyTextBlanked(state, enemy)
      && (enemyRuleFlags(enemy.code).discardRandomOnAttack || enemyRuleFlags(enemy.ruleId).discardRandomOnAttack)) {
      if (inv.hand.length) discardRandomFromHand(state, inv, 1, events)
      else { extraDamage = baseDamage - enemy.damage + 1; extraHorror = baseHorror - enemy.horror + 1; info(state, events, `🧠 ${inv.name} 无手牌可弃，「${enemy.name}」的伤害和恐惧各 +1。`) }
    }
    const adjusted = scenarioBehavior(state).beforeEnemyHarm?.(state, enemy, inv,
      { damage: enemy.damage + extraDamage, horror: enemy.horror + extraHorror }, scenarioRuntime(state, events))
    if (adjusted?.damage != null) extraDamage = adjusted.damage - enemy.damage
    if (adjusted?.horror != null) extraHorror = adjusted.horror - enemy.horror
    // 「如果你不在载具上：其本次攻击造成 +N 伤害」（07213 追击快车）：
    // 声明在 `enemyRule.attackDamageBonus = { amount, unlessTargetInVehicle }`。
    // 放在 beforeEnemyHarm **之后**：章节内容钩子会把伤害改写成「印刷值 + 额外」，
    // 规则级加成必须在它之后叠加，否则会被内容层的绝对值覆盖。
    extraDamage += enemyAttackingDamageBonus(state, enemy, inv)
    // 「在 X 攻击时：本次攻击 +1 伤害和 +1 恐惧。弃掉本卡」（07259 尽腥尽力）：附属在敌人身上的
    // 诡计声明 `treacheryRule.attackBonus = { damage, horror, discardOnAttack }`，攻击宣言时叠加并弃置。
    for (const attachment of (enemy.attachments || []).slice()) {
      const attackBonus = registeredEntry(attachment.originalCode || attachment.code)?.treacheryRule?.attackBonus
      if (!attackBonus) continue
      extraDamage += Number(attackBonus.damage) || 0
      extraHorror += Number(attackBonus.horror) || 0
      if (attackBonus.discardOnAttack === true) {
        enemy.attachments.splice(enemy.attachments.indexOf(attachment), 1)
        discardEncounterAttachment(state, attachment)
      }
    }
    if (enemyTextBlanked(state, enemy)) {
      if (enemy.textBlanked.damagePenalty) extraDamage = Math.max(-enemy.damage, extraDamage - enemy.textBlanked.damagePenalty)
      if (enemy.textBlanked.horrorPenalty) extraHorror = Math.max(-enemy.horror, extraHorror - enemy.textBlanked.horrorPenalty)
    }
    attack.plannedDamage = enemy.damage + extraDamage
    attack.plannedHorror = enemy.horror + extraHorror
    const attackText = label || `🗡️ 「${enemy.name}」攻击 ${inv.name}：${enemy.damage + extraDamage} 点伤害、${enemy.horror + extraHorror} 点恐惧。`
    const presentationOrigin = { ...enemyAttackStyle(enemy, enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code),
      name:enemy.name, enemyId:enemy.id, code:enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code }
    info(state, events, attackText, { kind: 'attack', direction: 'incoming', phase: state.phase, round: state.round,
      ...presentationOrigin, presentationStage:'threat',
      attackKind: attack.kind,
      code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code, name: enemy.name, text: attackText,
      effect: 'attack', seat: inv.seat, enemyId: enemy.id, location: inv.location, damage: enemy.damage + extraDamage, horror: enemy.horror + extraHorror })
    const damageBefore = inv.damage || 0
    const horrorBefore = inv.horror || 0
    // 「如果哈斯塔的攻击造成的恐惧超出你的神智值，你还受到 1 点伤害」（03332/03334）。
    const excessHorrorDamage = !enemyTextBlanked(state, enemy)
      && enemyRuleFlags(enemy.code).excessHorrorDamage === true
    const remainingSanityBefore = excessHorrorDamage ? getMaxSanity(inv) - (inv.horror || 0) : 0
    if (!inv.defeated && !tryAquinnahRedirect(state, enemy, inv, events, extraDamage, extraHorror)) {
      // 08003 黑帮暴徒：本敌人攻击造成的伤害/恐惧视为直接伤害/直接恐惧（不可分配给支援）。
      applyHarm(state, inv, enemy.damage + extraDamage, enemy.horror + extraHorror, events,
        enemyRuleFlags(enemy.code).attackHarmDirect === true, tagAttackHarm({ enemy, enemyId: enemy.id, location: inv.location, ...attackLimitContext }, presentationOrigin),
        false, enemyRuleFlags(enemy.code).harmStrategy || null)
    }
    // 实际落到调查员身上的伤害/恐惧（被取消、被防止或转移时为 0）。
    attack.damage = Math.max(0, (inv.damage || 0) - damageBefore)
    attack.horror = Math.max(0, (inv.horror || 0) - horrorBefore)
    if (excessHorrorDamage && attack.horror > remainingSanityBefore && !inv.defeated && !inv.resigned) {
      info(state, events, `💥 「${enemy.name}」造成的恐惧超出 ${inv.name} 的神智值，额外受到 1 点伤害。`)
      applyHarm(state, inv, 1, 0, events, undefined, null, false, null, presentationOrigin)
    }
  } finally {
    if (previousAttackSource === undefined) delete state._enemyAttackResolving
    else state._enemyAttackResolving = previousAttackSource
  }
  scenarioBehavior(state).enemyAttackResolved?.(state, enemy, inv, scenarioRuntime(state, events), attack)
  // P5：攻击历史记账（丹妮拉旧印「本轮被攻击过」、扳手「上个回合结束后攻击过你的敌人」）。
  noteEnemyAttackOnInvestigator(state, inv, enemy, attack)
  // 第 5 步 P6：「敌人攻击你后」的反应窗口（序章故事调查员；被取消的攻击也算）。
  reactionWindow(state, 'enemyAttacked', {
    when: 'enemyAttacked', seat: inv.seat, location: inv.location, enemy, attack,
    ...attackLimitContext, cancelled: false, prompt: `「${enemy.name}」攻击 ${inv.name} 后`,
  }, events)
  if (inv.defeated) checkOutcome(state, events)
  if (!enemyTextBlanked(state, enemy) && enemy.forcedDoom) {
    // "Place 1 doom on the current agenda" goes through the agenda clock, so it
    // must be able to advance the agenda immediately.
    info(state, events, `「${enemy.name}」攻击后，在密谋上放置 1 点毁灭。`)
    addDoom(state, 1, events)
  }
  if (attack.kind !== 'retaliate') resolveElusiveAfterAttack(state, enemy, registeredEntry,
    () => scenarioRuntime(state, events), item => enemyTextBlanked(state, item))
  return true
}

function buildDistance(state, from, to) {
  if (!from || !to) return Infinity
  if (from === to) return 0
  const distance = new Map([[from, 0]])
  const queue = [from]
  while (queue.length) {
    const current = queue.shift()
    const location = state.locations.find(item => item.id === current)
    for (const next of location?.connections || []) {
      if (distance.has(next)) continue
      distance.set(next, distance.get(current) + 1)
      if (next === to) return distance.get(next)
      queue.push(next)
    }
  }
  return Infinity
}

// TIC 拘禁室：「敌人不能进入或生成在拘禁室（如果将有敌人生成在此，改为将其生成在任意
// 沉没岩洞）」。地点侧声明 `locationRule.enemiesCannotEnter` / `locationRule.enemySpawnRedirect`
// （形状校验在 ability.js 注册期）；生成落点被该地点拒绝时按声明的候选改换：
//   · toOriginalCodes：按卡号匹配已入场地点（拘禁室用沉没岩洞的三个候选卡号，具体值在内容层声明）；
//   · toTrait：按特性匹配（任意沉没岩洞类地点可复用同一声明）。
// 多位候选默认由领队选择（chooser:'lead'），也可声明 'random'。没有任何候选时保留原落点，
// 让下面既有的「不能在…生成」失败路径（spawnFailed）处理。
function redirectEnemySpawn(state, code, locationId) {
  if (!locationId) return locationId
  const location = state.locations.find(item => item.id === locationId)
  const rule = registeredEntry(location?.originalCode || location?.code)?.locationRule
  const redirect = rule?.enemiesCannotEnter === true ? rule.enemySpawnRedirect : null
  if (!redirect) return locationId
  let candidates = state.locations.filter(item => item.id !== locationId)
  if (Array.isArray(redirect.toOriginalCodes) && redirect.toOriginalCodes.length) {
    candidates = candidates.filter(item =>
      redirect.toOriginalCodes.includes(String(item.originalCode || item.code)))
  }
  if (redirect.toTrait) {
    const wanted = String(redirect.toTrait).toLowerCase()
    candidates = candidates.filter(item =>
      (item.traits || []).some(trait => String(trait).toLowerCase() === wanted))
  }
  if (!candidates.length) return locationId
  let chosen = candidates[0]
  if (candidates.length > 1) {
    if (redirect.chooser === 'random') {
      chosen = candidates[Math.floor(randomValue(state) * candidates.length)]
    } else {
      const chosenId = requestChoice(state, {
        kind: 'location', source: code, seat: leadDecisionSeat(state),
        prompt: `拘禁室禁止敌人进场：选择改为生成「${enemyDef(code)?.name || code}」的地点。`,
        options: candidates.map(item => ({ id: item.id, label: item.name || item.id })),
      })
      chosen = candidates.find(item => item.id === chosenId) || chosen
    }
  }
  info(state, [], `🔀 「${enemyDef(code)?.name || code}」不能在「${location.name || location.id}」生成，改为在「${chosen.name || chosen.id}」生成。`)
  return chosen.id
}

function redirectsNonEliteSpawn(location) {
  return (location?.barricades || [location?.barricade]).some(attachment => attachment?.redirectSpawn)
}

function spawnEnemy(state, code, locationId, engagedSeat, ignoreSpawn = false, temporary = false, sourceSeat = null, options = {}) {
  if (options.exhausted != null && typeof options.exhausted !== 'boolean') throw new TypeError('Invalid exhausted spawn option')
  const def = enemyDef(code)
  if (!def) return null
  const shadowAnchor = state.investigators?.[engagedSeat]?.investigatorShadowAnchor
  if (shadowAnchor) {
    locationId = shadowAnchor
    engagedSeat = null
  }
  const override = scenarioBehavior(state).spawnOverrides?.[code]
  let loc = override && locationExists(state, override)
    ? override : !ignoreSpawn && def.spawn ? def.spawn : locationId
  // 「生成 - 距离所有调查员最远的地点」（03059）：只在通用生成时生效；
  // 剧本用 api.spawn(..., ignoreSpawn=true) 明确指定的剧情生成点仍然优先。
  if (!ignoreSpawn && !override && registeredEntry(code)?.spawnFarthestFromAll) {
    const alive = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
    if (alive.length) {
      const farthest = []
      let best = -1
      for (const candidate of state.locations) {
        // 梦境之门（06015a/b）：敌人不能进入/生成，候选池里也不该出现（否则会把敌人弃掉）。
        if (candidate.dreamGate) continue
        let nearest = Infinity
        for (const inv of alive) {
          const distance = buildDistance(state, inv.location, candidate.id)
          if (distance < nearest) nearest = distance
        }
        if (!Number.isFinite(nearest)) continue
        if (nearest > best) { best = nearest; farthest.length = 0; farthest.push(candidate.id) }
        else if (nearest === best) farthest.push(candidate.id)
      }
      if (farthest.length) {
        loc = farthest.length === 1 ? farthest[0] : requestChoice(state, {
          kind: 'location', source: code, seat: state.currentSeat ?? state.campaign?.leadSeat ?? 0,
          prompt: `选择「${def.name}」生成的、距离所有调查员最远的地点。`,
          options: farthest.map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id })),
        })
      }
    }
  }
  // 「生成 - 线索最多的地点」（07105 印斯茅斯闹事者）：同样只在通用生成时生效，
  // 剧本用 api.spawn(..., ignoreSpawn=true) 指定的剧情生成点优先。已揭示地点之间并列时由
  // 领队选择（与「距离最远」同一套询问形状）。
  if (!override && !ignoreSpawn && registeredEntry(code)?.spawnMostClues) {
    const revealed = state.locations.filter(location => location.revealed !== false && !location.dreamGate)
    const pool = revealed.length ? revealed : state.locations.filter(location => !location.dreamGate)
    const best = Math.max(...pool.map(location => Number(location.clues) || 0))
    const candidates = pool.filter(location => (Number(location.clues) || 0) === best)
    if (candidates.length) {
      loc = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
        kind: 'location', source: code, seat: state.currentSeat ?? state.campaign?.leadSeat ?? 0,
        prompt: `选择「${def.name}」生成的、线索最多的地点。`,
        options: candidates.map(location => ({ id: location.id, label: location.name || location.id })),
      })
    }
  }
  // 「生成 - 最后方的地点」（07213 追击快车、07214 一车打手）：道路按 mechanicState(state).road
  // 的列号排序，最小列 = 最后方；未登记的列（如起点 07168 之外的自由地点）不参与。
  // 并列时由领队选择，生成时不与抽牌者交战（loc 只决定位置，engagement 由调用方决定）。
  if (!override && !ignoreSpawn && registeredEntry(code)?.spawnRearmost) {
    const columns = mechanicState(state)?.road?.columns || {}
    const columnOf = location => Number(columns[location.id] ?? columns[location.originalCode || location.code])
    const ranked = state.locations
      .map(location => ({ location, column: columnOf(location) }))
      .filter(item => Number.isFinite(item.column))
    const best = ranked.length ? Math.min(...ranked.map(item => item.column)) : null
    const candidates = ranked.filter(item => item.column === best).map(item => item.location)
    if (candidates.length) {
      loc = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
        kind: 'location', source: code, seat: state.currentSeat ?? state.campaign?.leadSeat ?? 0,
        prompt: `选择「${def.name}」生成的、最后方的地点。`,
        options: candidates.map(location => ({ id: location.id, label: location.name || location.id })),
      })
    }
  }
  // 「生成 - 某张剧情支援（载具）所在地点」（07164b/07165b「生成 - 渔船所在地点」）：
  // 取 state.storyAssets 里同一张物理卡的实例 location；实例不在场时保持默认落点。
  // 只在该实例的卡号/原名匹配时生效，避免同名多张时拿到别人的位置。
  if (!override && !ignoreSpawn && registeredEntry(code)?.spawnAtStoryAsset) {
    const wanted = registeredEntry(code).spawnAtStoryAsset
    const asset = (state.storyAssets || []).find(item => (item.originalCode || item.code) === wanted)
    if (asset && locationExists(state, asset.location)) loc = asset.location
  }
  // 「生成 - 任意无人地点（如可能，生成在[[古代]]地点）」（04086）。
  if (!override && !ignoreSpawn && registeredEntry(code)?.spawnAncientFirst) {
    const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
    const empty = state.locations.filter(loc => !loc.dreamGate && !active.some(inv => inv.location === loc.id))
    const ancient = empty.filter(loc => (cardDef(loc.originalCode || loc.code)?.traits || [])
      .some(trait => String(trait).toLowerCase() === 'ancient'))
    const pool = ancient.length ? ancient : empty
    if (pool.length) {
      loc = pool.length === 1 ? pool[0].id : requestChoice(state, {
        kind: 'location', source: code, seat: state.currentSeat ?? state.campaign?.leadSeat ?? 0,
        prompt: `选择「${def.name}」的生成地点（古代地点优先）。`,
        options: pool.map(entry => ({ id: entry.id, label: entry.name })),
      })
    }
  }
  const spawnChoices = !override && !ignoreSpawn ? registeredEntry(code)?.spawnChoices : null
  if (spawnChoices?.length) {
    const available = spawnChoices.filter(id => locationExists(state, id))
    if (available.length) {
      loc = available.length === 1 ? available[0] : requestChoice(state, {
        kind: 'location', source: code, seat: state.currentSeat ?? state.campaign?.leadSeat ?? 0,
        prompt: `选择「${def.name}」的生成地点。`,
        options: available.map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id })),
      })
    }
  }
  if (!ignoreSpawn && scenarioBehavior(state).spawnLocation) loc = scenarioBehavior(state).spawnLocation(state, code, loc, engagedSeat, scenarioRuntime(state, []), options)
  // P7 TDC 11744 等：条目级「生成落点」声明（共享遭遇卡无章节 behavior 可用时）。
  // 形状 { kind: 'nearestEmpty'|'nearestEmptyConnecting'|'nearestEmptyTrait', trait? }。
  if (!ignoreSpawn) {
    const spawnRule = registeredEntry(code)?.enemyRule?.spawnLocation
    if (!override && typeof spawnRule === 'function') {
      loc = spawnRule(state, { location: loc, seat: sourceSeat ?? engagedSeat ?? leadDecisionSeat(state) }, scenarioRuntime(state, []))
    }
    if (spawnRule?.kind && !(spawnRule.onlyIfEmpty === true && state.investigators.some(inv =>
      !inv.defeated && !inv.resigned && inv.location === loc))) {
      const origin = state.locations.find(location => location.id === loc)
      const pool = spawnRule.kind === 'nearestEmptyConnecting'
        ? (origin?.connections || []).map(id => state.locations.find(location => location.id === id)).filter(Boolean)
        : state.locations.filter(location => !spawnRule.trait
          || (location.traits || []).some(trait => String(trait).toLowerCase() === String(spawnRule.trait).toLowerCase()))
      const occupied = location => state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === location.id)
      const empty = pool.filter(location => !occupied(location) && !state.enemies.some(other => other.location === location.id))
      const candidates = (empty.length ? empty : pool)
        .filter(location => enemyCanEnterLocation(state, { ...def, code, originalCode: code }, location.id))
      if (candidates.length) {
        let best = Infinity
        let nearest = []
        for (const candidate of candidates) {
          const distance = buildDistance(state, loc, candidate.id)
          if (!Number.isFinite(distance)) continue
          if (distance < best) { best = distance; nearest = [candidate.id] } else if (distance === best) nearest.push(candidate.id)
        }
        if (nearest.length) {
          loc = nearest.length === 1 ? nearest[0] : requestChoice(state, {
            kind: 'location', source: code, seat: engagedSeat ?? leadDecisionSeat(state),
            prompt: `选择「${def.name}」的生成地点。`,
            options: nearest.map(id => ({ id, label: state.locations.find(location => location.id === id)?.name || id })),
          })
        }
      }
    }
  }
  // 「敌人不能生成在该地点」的地点侧声明（07252b 拘禁室）：按声明的候选改换落点；
  // 无候选时保留原落点，交给下面的 enemyCanEnterLocation 失败路径。
  loc = redirectEnemySpawn(state, code, loc)
  const spawnCandidate = { ...def, code, originalCode: code }
  const canSpawnAt = id => enemyCanEnterLocation(state, spawnCandidate, id)
    && !scenarioBehavior(state).spawnForbiddenAt?.(state, code, id, engagedSeat)
  const location = state.locations.find(item => item.id === loc)
  const blockedByBarricade = !def.elite && redirectsNonEliteSpawn(location)
  if (blockedByBarricade) {
    const candidates = (location.connections || []).map(id => state.locations.find(item => item.id === id))
      .filter(item => item && !redirectsNonEliteSpawn(item) && canSpawnAt(item.id))
    if (candidates.length) {
      loc = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
        kind: 'location', source: code, seat: sourceSeat ?? engagedSeat ?? leadDecisionSeat(state),
        prompt: `选择「${def.name}」改为生成的相连地点。`,
        options: candidates.map(item => ({ id: item.id, label: item.name || item.id })),
      })
    }
  }
  // 2026-10-25 本循环修复 05204/05205：剧本级「此地不能生成敌人」限制统一咨询（含 api.spawn 的 ignoreSpawn 路径）；
  // 被禁止时按生成失败处理（进遭遇弃牌堆 + spawnFailed），与参考实现 noSpawn 语义一致。
  if ((blockedByBarricade && loc === location.id) || !canSpawnAt(loc)) {
    info(state, [], `⛔ 「${def?.name || code}」不能在「${state.locations.find(item => item.id === loc)?.name || loc}」生成。`)
    if (!options.retainOnFailure && !routeEnemyDiscardToScenarioDeck(state, { code, discardToScenarioDeck: options.discardToScenarioDeck })) state.encounterDiscard.push(code)
    scenarioBehavior(state).spawnFailed?.(state, code, engagedSeat, scenarioRuntime(state, []))
    return null
  }
  if (!locationExists(state, loc)) {
    if (!options.retainOnFailure && !routeEnemyDiscardToScenarioDeck(state, { code, discardToScenarioDeck: options.discardToScenarioDeck })) state.encounterDiscard.push(code)
    scenarioBehavior(state).spawnFailed?.(state, code, engagedSeat, scenarioRuntime(state, []))
    return null
  }
  const health = def.health === null ? null : def.healthPerInvestigator
    ? def.healthPerInvestigator * state.numInvestigators
    : def.health + (def.healthPerPlayerBonus || 0) * state.numInvestigators
  // 弱点敌人的牌组归属：从调查员牌库抽出的由抽出者持有（engagedSeat 就是归属座位）；
  // 剧本直接从「放到一边」或承受者牌库生成的弱点敌人（03059 苍白面具下的男子等）没有
  // 交战座位，这里回退到「战役牌组里持有该弱点牌」的座位，免得击败时找不到弃牌堆。
  const bearerSeat = isWeaknessCode(code) || def.prey === 'bearer'
    ? (engagedSeat ?? weaknessOwnerSeat(state, code))
    : null
  const enemy = {
    id: newEnemyId(state), code, name: def.name,
    ...cardIdentityFields(def),
    fight: def.fight, evade: def.evade, health,
    damage: def.damage, horror: def.horror, hunter: def.hunter,
    retaliate: def.retaliate, alert: def.alert, elite: def.elite, aloof: !!def.aloof, printedAloof: !!def.aloof,
    // 「不能被击败」（04209b 羽翼蛇族等）：引擎在每次击败判定前读这个字段。
    cannotBeDefeated: !!def.cannotBeDefeated,
    // 「横置时也能反击 / 也能攻击」（04062 瓦卢西亚的预示者、04078 蝮蛇类）：
    // 由卡面数据登记，引擎在反击与敌人阶段两处放行。
    retaliateWhileExhausted: !!def.retaliateWhileExhausted,
    attacksWhileExhausted: !!def.attacksWhileExhausted,
    immobile: !!def.immobile,
    massive: def.massive, prey: def.prey, forcedDoom: def.forcedDoom, parleyCost: def.parleyCost || 0,
    uniqueCultist: !!def.uniqueCultist, evadeToVictory: !!def.evadeToVictory,
    bearerSeat,
    drawnBySeat: engagedSeat,
    victory: def.victory || 0, vengeance: def.vengeance || 0,
    traits: def.traits || [],
    damageTaken: 0, exhausted: options.exhausted === true, doom: def.onSpawnDoom || 0,
    location: loc, engagedSeat: null,
    ...(options.discardToScenarioDeck ? { discardToScenarioDeck: options.discardToScenarioDeck } : {}),
  }
  if (temporary) return enemy
  if (def.swarming) enemy.swarmOwnerSeat = sourceSeat ?? engagedSeat ?? state.campaign?.leadSeat ?? state.currentSeat
  const chooseEngaged = registeredEntry(code)?.enemyRule?.spawnEngagedSeat
  if (!ignoreSpawn && typeof chooseEngaged === 'function') engagedSeat = chooseEngaged(state, enemy, engagedSeat, scenarioRuntime(state, []))
  return enterExistingEnemy(state, enemy, { engageSeat: engagedSeat, forceEngage: options.forceEngage === true,
    resolveConcealed: options.fromEncounterDraw || options.resolveConcealed || !ignoreSpawn }, [])
}

function enterExistingEnemy(state, enemy, { engageSeat = null, forceEngage = false, resolveConcealed = false } = {}, events = []) {
  const code = enemy.code, engagedSeat = engageSeat
  const concealedRule = registeredEntry(enemy.originalCode || code)?.enemyRule
  if (resolveConcealed && concealedRule?.sharedConcealed && enemy.location) {
    const printedCode = enemy.originalCode || code
    const anchor = enemy.location
    const runtime = scenarioRuntime(state, events)
    const distance = location => {
      const steps = runtime.locationDistance(anchor, [location.id])
      return steps >= 0 ? steps : Infinity
    }
    const locations = state.locations.slice().sort((left, right) => distance(left) - distance(right))
    const kind = `enemyInstance${enemy.id}`
    const cards = [{ kind, code: printedCode, decoy: false },
      ...Array.from({ length: concealedRule.concealed }, () => ({ kind: 'decoy', decoy: true }))]
    const placements = locations.map(({ id }, index) => ({ locationId: id,
      count: Math.floor(cards.length / locations.length) + (index < cards.length % locations.length ? 1 : 0),
    })).filter(placement => placement.count > 0)
    distributeConcealed(state, { cards, placements })
    enemy.location = null
    enemy.shadowMiniKind = kind
    state.enemies.push(enemy)
    reactionWindow(state, 'tskEnteredShadows', {
      when: 'tskEnteredShadows', enemyId: enemy.id, enemyCode: printedCode, seat: engagedSeat ?? state.currentSeat,
    }, events, { allowNested: true })
    return enemy
  }
  state.enemies.push(enemy)
  scenarioBehavior(state).enemySpawned?.(state, enemy, scenarioRuntime(state, events))
  processPlayerEnemyEntry(state, enemy, events, true)
  if (!state.enemies.includes(enemy)) return enemy
  // 「入场后：在其上放置毁灭」。战役钩子若已放过（失落时代 / 万古之环），这里不再加。
  if (state.enemies.includes(enemy)) {
    const ruleDoom = Number(enemySpawnRuleFor(code)?.doomOnSpawn) || 0
    const missing = ruleDoom - (enemy.doom || 0)
    if (missing > 0) {
      // 与 act-agenda.placeDoomOnCard 同口径：章节声明「毁灭不能放在这张卡上」时，
      // 入场毁灭的兜底也不能绕过（05095 ×《死亡门前》05085b 的「毁灭不能放在银暮秘社敌人上」）。
      if (scenarioBehavior(state).canPlaceDoomOn?.(state, enemy) === false) {
        info(state, events, `🔒 「${enemy.name}」当前不能放置毁灭标记。`)
      } else {
        enemy.doom = (enemy.doom || 0) + missing
        info(state, events, `🧿 「${enemy.name}」入场：在它身上放置 ${missing} 个毁灭标记。`)
      }
    }
  }
  for (const inv of aliveInvestigators(state)) {
    if (inv.location === enemy.location) triggerReaction(state, inv.seat, 'enemySpawn', events, { enemy, location: enemy.location },{skipAbilityWindow:true})
  }
  // Reaction events (e.g. Think on Your Feet) are played from hand on the same
  // window; the enemy still spawns at the original location.
  reactionWindow(state, 'enemySpawn', { when: 'enemySpawn', seat: engagedSeat ?? leadDecisionSeat(state),
    location: enemy.location, enemy }, events)
  if (state.enemies.includes(enemy) && (forceEngage || (!enemy.exhausted && !enemy.aloof)) && !enemyIsMassive(state, enemy)
    && engagedSeat != null && state.investigators[engagedSeat]?.location === enemy.location) {
    engageEnemy(state, enemy, engagedSeat, events)
  }
  return enemy
}

// 由剧本现场生成、不在卡牌目录里的敌人（04331 纽约遗址的飞天水螅）。
// stats 提供印刷数值；extra 放实例标记（例如 underlyingCard = 被当作敌人的那张牌）。

function engageEnemy(state, enemy, seat, events = [], grouped = false) {
  if (enemy.enemyLocation || enemyIsPart(enemy) || enemyIsMassive(state, enemy)) return
  if (!grouped && (enemy.hostId || enemy.swarmCards?.length)) {
    for (const member of swarmGroup(state, enemy)) engageEnemy(state, member, seat, events, true)
    return
  }
  // TIC 捕获：被俘的调查员不能被交战（印刷 07252）。基础行动、自动交战与剧本/遭遇来源的
  // 强制交战都落到这里，是全库唯一的交战写入点。
  const captureError = capturedActionError(state, state.investigators?.[seat], 'engage')
  if (captureError) return
  // 沉睡（enemyRule.slumbering）：「不能与调查员交战」是印刷的无条件规则——基础行动、
  // 剧本/遭遇来源与自动交战都不放行（`enemyEffectAllowed` 对 engage 一律 false）。
  if (!enemyEffectAllowed(state, enemy, 'engage', { entryOf: registeredEntry, isBlanked: enemyTextBlanked, cardDef })) return
  if (capabilityBlocked(state, state.investigators[seat], 'engage')
    || enemyProtectionBlocks(state, state.investigators[seat], enemy, 'engage')) return
  if (enemy.engagedSeat === seat) return
  // 2026-10-25 修复 05178a/c：剧本级「该敌人不能被交战」也要拦卡牌效果的强制交战
  // （此前只在 moves.js 的交战行动层过滤，api.engage 等效果路径可强行交战）。
  if (scenarioBehavior(state).canEngageEnemy?.(state, state.investigators[seat], enemy) === false) return
  // 「潜行」等：直到你的回合结束，该敌人不能与你交战（效果体 preventEngageThisTurn 写入的标记）。
  // 到期判定沿用引擎「本回合」的统一写法：同一 round 且轮到的还是同一个座位。
  const prevented = enemy.preventEngageSeat
  if (prevented && prevented.seat === seat && prevented.round === state.round
    && prevented.turnSeat === state.currentSeat) return
  // 04325b/04326b：「不与你交战」——该特性的敌人不能与这位调查员建立交战。
  if (enemyIgnoresInvestigator(state, state.investigators[seat], enemy)) return
  if (enemy.engagedSeat != null) {
    const old = state.investigators[enemy.engagedSeat]
    if (old) removeOne(old.engaged, enemy.id)
  }
  enemy.engagedSeat = seat
  const inv = state.investigators[seat]
  if (inv && !inv.engaged.includes(enemy.id)) inv.engaged.push(enemy.id)
  if (inv && !enemyTextBlanked(state, enemy)) {
    scenarioBehavior(state).enemyEngaged?.(state, enemy, inv, scenarioRuntime(state, events))
  }
  if (inv && state.enemies.includes(enemy)) triggerReaction(state, seat, 'enemyEngaged', events, eventWindowContext(state, { enemy, seat }))
  // 年幼的深潜者「交战时受 1 点恐惧」由 youngDeepOne 的 forced 描述子结算。
}

function disengageEnemy(state, enemy, grouped = false) {
  if (!grouped && (enemy.hostId || enemy.swarmCards?.length)) {
    for (const member of swarmGroup(state, enemy)) {
      if (enemy.exhausted) member.exhausted = true
      disengageEnemy(state, member, true)
    }
    return
  }
  const engagedSeat = enemy.engagedSeat
  if (engagedSeat != null) {
    const inv = state.investigators[engagedSeat]
    if (inv) removeOne(inv.engaged, enemy.id)
  }
  enemy.engagedSeat = null
  // P7 TDC obsidianCanyons 11670：「位于开阔天空时原始恐怖解除与你的交战 → 你被击败并得 1 肉体创伤」。
  // 读点：所有解除交战来源共用本函数；章节用 behavior.enemyDisengaged 消费（旧内容无钩子时零变化）。
  if (engagedSeat != null) {
    const inv = state.investigators[engagedSeat] || null
    scenarioBehavior(state).enemyDisengaged?.(state, enemy, inv, scenarioRuntime(state, state._resolution?.events || []))
  }
}

function leaveEnemyPlay(state,enemy,events,{reason='zone',preserveKeys=false,responsibleSeat=null}={}) {
  deps.clearEnemyAssetHost(state, enemy)
  for (const part of enemyParts(state, enemy)) leaveEnemyPlay(state, part, events, { reason: 'body', responsibleSeat })
  releaseChaosTokens?.(state,enemy.id)
  if(!preserveKeys)keysOnExit(state,'enemy:'+enemy.id,enemy.location,responsibleSeat)
  if(enemy.bindMonster){state.investigators[enemy.bindMonster.ownerSeat]?.discard.push(enemy.bindMonster.code);delete enemy.bindMonster}
  discardHostedAssets(state, enemy, (owner, code) => owner.discard.push(code), { keepAssets: reason === 'zone' })
  for (const attachment of (enemy.attachments || []).filter(card => card.ownerSeat != null
    && registeredEntry(card.code)?.assetRule?.sharedEnemyAttachment)) {
    const owner = state.investigators[attachment.ownerSeat]
    if (registeredEntry(attachment.code)?.assetRule?.enemyAttachmentRule?.bondedReturn) deps.bondedStore(state, owner, attachment.code)
    else owner?.discard.push(attachment.code)
    removeOne(enemy.attachments, attachment)
  }
  removeOne(state.enemies,enemy)
  if(enemy.smiteTheWickedSeat!=null)state.investigators[enemy.smiteTheWickedSeat]?.discard.push(SMITE_THE_WICKED_CODE)
  if(enemy.engagedSeat!=null){const inv=state.investigators[enemy.engagedSeat];if(inv)removeOne(inv.engaged,enemy.id)}
  if(reason==='zone')enemy.engagedSeat=null
}
function shuffleEnemyIntoEncounterDeck(state, enemy, { seat = null, toBottom = false } = {}, events = []) {
  if (!state.enemies.includes(enemy) || enemy.elite || enemy.enemyLocation || enemyIsBody(enemy)) return false
  if (!enemyEffectAllowed(state, enemy, 'remove', { entryOf: registeredEntry, isBlanked: enemyTextBlanked, cardDef })) return false
  if (enemy.hostId) {
    returnSwarmCard(state, enemy)
    return true
  }
  if (isWeaknessCode(enemy.code)) return false
  for (const member of swarmGroup(state, enemy).slice(1)) returnSwarmCard(state, member)
  leaveEnemyPlay(state, enemy, events, { reason: 'shuffleIntoEncounter', responsibleSeat: seat })
  if (toBottom) state.encounterDeck.unshift(enemy.code)
  else state.encounterDeck = shuffle([...state.encounterDeck, enemy.code], () => randomValue(state))
  return true
}

function enemyZoneApi(state,events=[]) {
 return createEnemyZoneApi(state,{mechanicState,locationExists:id=>locationExists(state,id),canEnter:(e,id)=>enemyCanEnterLocation(state,e,id),
   leavePlay:(enemy,options)=>leaveEnemyPlay(state,enemy,events,options),
   enterExisting:(enemy,options)=>enterExistingEnemy(state,enemy,options,events)})
}
function enemyOutcomeApi(state,events=[]) {
 return createEnemyOutcomeApi(state,{
  interrupt:(when,context)=>reactionWindow(state,when,eventWindowContext(state,{...context,when}),events,{allowNested:true}),
  readyEnemy:enemy=>scenarioRuntime(state,events).readyEnemy(enemy),
  placeDoomOnCard:(enemy,n)=>placeDoomOnCard(state,enemy,n,events),
  syncClues:()=>syncClues(state),cluesGained:(seat,amount)=>triggerReaction(state,seat,'cluesGained',events,{when:'cluesGained',seat,amount}),
  zones:enemyZoneApi(state,events),wouldAddToVictory:enemy=>wouldAddToVictory(enemy,enemyDef,state),
  scenarioDecks:{put:(...args)=>scenarioRuntime(state,events).mechanics.scenarioDecks.put(...args)},
  chooseDestination:(context,candidates)=>Number(requestChoice(state,{kind:'effect',source:context.enemy.id,seat:context.sourceSeat??leadDecisionSeat(state),prompt:'选择敌人被击败后的去向。',options:candidates.map((c,index)=>({id:String(index),label:c.kind==='enemyZone'?'放到'+c.id:'洗入'+c.id}))}))
 })
}
function enemyOutcomePublicApi(state,events=[]) {const api=enemyOutcomeApi(state,events);return {replace:api.replace,destination:api.destination,takeClues:api.takeClues}}
function prepareEnemyOutcome(state,kind,enemy,events,options={}) {return enemyOutcomeApi(state,events).begin(kind,enemy,options)}

function defeatEnemy(state, enemy, events, options={}) {
  if(!state.enemies.includes(enemy))return false
  const outcome=enemyOutcomeApi(state,events),context=options.prepared||outcome.begin('defeat',enemy,{seat:options.seat??enemy.defeatedBy??null,source:options.source??enemy.lastDamageSource??null})
  if(!context||context.replaced||context.cancelled)return false
  const defeatedLocation=context.location

  const swarmHost = enemy.hostId ? state.enemies.find(item => item.id === enemy.hostId) : null
  const excess = swarmHost ? Math.max(0, (enemy.damageTaken || 0) - enemyHealth(state, enemy)) : 0
  const swarmEffect = swarmHost ? registeredEntry(enemy.originalCode || enemy.code)?.enemyScript?.onSwarmDefeated?.(
    state, enemy, swarmHost, scenarioRuntime(state, events), context) : null
  // 敌人离场：把它身上封印的混乱标记归还混乱袋（04014 伊格蛇族的旧印等）。
  const defeatedBy = context.sourceSeat
  const defeater = state.investigators[defeatedBy]
  if (defeater && tracksHistory(state, defeater, 'trackDefeatedEnemyHealth', registeredEntry)) {
    if (defeater.defeatedHealthHistory?.turn !== state.turnSerial) defeater.defeatedHealthHistory = { turn: state.turnSerial, total: 0 }
    defeater.defeatedHealthHistory.total += enemyHealth(state, enemy)
  }
  if (defeater && tracksHistory(state, defeater, 'trackDefeatedEnemyPrintedHealth', registeredEntry)) {
    const previous = defeater.defeatedPrintedHealthHistory
    const total = previous?.turn === state.turnSerial ? previous.total : 0
    defeater.defeatedPrintedHealthHistory = { turn: state.turnSerial, total: total + (enemy.health || 0) }
  }
  // 「煤油」等需要知道本地点本轮是否有敌人被击败。
  const defeatedAt = state.locations.find(location => location.id === enemy.location)
  if (defeatedAt) defeatedAt.enemyDefeatedRound = state.round
  if (enemy.attachments?.some(card => registeredEntry(card.code)?.abilities.some(ability =>
    ability.trigger.includes('attachedEnemyDefeated')))) {
    reactionWindow(state, 'attachedEnemyDefeated', { ...context, when: 'attachedEnemyDefeated', enemy, seat: defeatedBy,
      location: defeatedLocation }, events, { allowNested: true })
  }
  for (const source of (enemy.attachments || []).slice()) {
    if (!enemy.attachments.includes(source)) continue
    registeredEntry(source.originalCode || source.code)?.treacheryRule?.onAttachedEnemyDefeated?.({
      state, source, enemy, location: defeatedLocation, api: scenarioRuntime(state, events),
    })
  }
  leaveEnemyPlay(state,enemy,events,{reason:'defeat',responsibleSeat:defeatedBy})
  if (deps.replaceEnemyLeaveDestination(state, enemy, events)) return true
  if ((registeredEntry(enemy.code)?.enemyWeakness?.shuffleIntoDeckOnDefeat)) {
    const owner = state.investigators[enemy.bearerSeat]
    if (owner) owner.deck = replacePlayerZoneCards(state, owner, shuffle([...owner.deck, enemy.code], () => randomValue(state)), 'shuffle')
    info(state, events, `「${enemy.name}」将被击败时改为洗回其承受者的牌库。`)
    return true
  }
  // "When defeated" forced effects resolve before "after defeated" reactions.
  // 黑山羊眷族这类「被击败时」的卡面强制效果走 enemyDefeated 窗口（在胜利区结算之前）。
  outcome.accepted(context)
  triggerReaction(state,defeatedBy??leadDecisionSeat(state),'enemyDefeated',events,context)
  if ((enemy.originalCode || enemy.code) === pallidMaskCode()) {
    state.campaign.records.chasingTheStranger =
      Number(state.campaign.records.chasingTheStranger || 0) + 1
  }
  const replaced = !swarmHost && (outcome.commitDestination(context)||scenarioBehavior(state).enemyDefeated?.(state, enemy, scenarioRuntime(state, events), context))
  if (swarmHost) returnSwarmCard(state, enemy)
  const victoryAttachment = !enemy.elite && options.victoryAttachment
    ? { code: options.victoryAttachment, ownerSeat: defeatedBy } : null
  const addedToVictory = !swarmHost && !replaced && addVictory(state, enemy, events, victoryAttachment)
  // 04147 伊塔卡：只有敌人真正加入胜利区后，才可横置伊塔卡治愈自己与它各 1 点恐惧。
  for (const holder of addedToVictory ? aliveInvestigators(state) : []) {
    // Phase 5（5a-29）：条目上的 exhaustOnEnemyDefeatedHealHorror 本身就是标记，不再写死卡号。
    const ichtaca = holder.assets.find(asset => !asset.exhausted
      && (registeredEntry(asset.code)?.exhaustOnEnemyDefeatedHealHorror))
    if (!ichtaca) continue
    const answer = requestChoice(state, {
      kind: 'reaction', source: ichtaca.code, seat: holder.seat, canSkip: true,
      prompt: '伊塔卡：横置她，治愈你与伊塔卡各 1 点恐惧？',
      options: [{ id: 'heal', label: '横置伊塔卡并各治愈 1 点恐惧' }, { id: 'skip', label: '不发动' }],
    })
    if (answer !== 'heal') continue
    ichtaca.exhausted = true
    holder.horror = Math.max(0, (holder.horror || 0) - 1)
    ichtaca.horror = Math.max(0, (ichtaca.horror || 0) - 1)
    info(state, events, `💚 ${holder.name} 横置伊塔卡，治愈自己与伊塔卡各 1 点恐惧。`)
  }
  if (!enemy.victory) info(state, events, `💥 「${enemy.name}」被击败了！`)
  ;(state._resolution?.events || events)?.push({
    type: 'agentSignal', kind: 'enemyDefeated', seat: defeatedBy,
    enemyId: enemy.id, name: enemy.name, investigatorName: state.investigators[defeatedBy]?.name || null,
  })
  if (defeatedBy != null) {
    triggerReaction(state, defeatedBy, 'defeatEnemy', events, { enemy, location: defeatedLocation },{skipAbilityWindow:true})
    reactionWindow(state, 'defeatEnemy', {
      when: 'defeatEnemy', seat: defeatedBy, location: defeatedLocation, enemy,
      prompt: `「${enemy.name}」被击败后`,
    }, events)
  }
  // 本地点有敌人被击败（04026 彩饰骷髅）：同地点每位调查员都能触发。
  // 这里必须开独立的 `defeatAtLocation` 窗口，不能复用 `defeatEnemy`：
  //   · `defeatEnemy` 是「你击败敌人后」，带 selfOnly 的快速事件（01022 证据！等）只属于击败者；
  //   · 第二个窗口把 context.seat 换成了同地点的其他调查员，若沿用 `defeatEnemy` 会让他们
  //     通过 reactionWindow 的 selfOnly 判定位（inv.seat === context.seat），从而错误地打出「证据！」。
  for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.location === defeatedLocation)) {
    if (inv.seat !== defeatedBy) {
      reactionWindow(state, 'defeatAtLocation',
        { when: 'defeatAtLocation', seat: inv.seat, location: defeatedLocation, enemy,
          prompt: `「${enemy.name}」在本地点被击败后` }, events)
    }
  }
  if (enemy.enemyLocation) scenarioRuntime(state, events).remove(enemy.id)
  checkAct(state, events)
  checkAgendaForcedEnemyDefeated(state, enemy, events)
  if (swarmHost && excess > 0 && !swarmEffect?.cancelExcessDamage && state.enemies.includes(swarmHost)) {
    const remaining = state.enemies.filter(item => item.hostId === swarmHost.id)
    const targets = remaining.length ? remaining : [swarmHost]
    const picked = requestChoice(state, { kind: 'enemy', source: enemy.originalCode || enemy.code,
      seat: defeatedBy ?? state.campaign.leadSeat, canSkip: true,
      prompt: `是否分配 ${excess} 点超出伤害给同一蜂拥的另一名敌人？`,
      options: [{ id: 'skip', label: '不分配超出伤害' }, ...targets.map(item => ({ id: item.id, label: item.name }))] })
    const target = targets.find(item => item.id === picked)
    if (target) damageEnemy(state, target, excess, defeatedBy, events, enemy.lastDamageSource || null)
  }
  if (swarmHost && state.enemies.includes(swarmHost) && !swarmCardsOf(swarmHost).length
    && enemyHealth(state, swarmHost) != null && swarmHost.damageTaken >= enemyHealth(state, swarmHost)
    && enemyCanBeDefeated(state, swarmHost, null, defeatedBy)) defeatEnemy(state, swarmHost, events)
  return true
}

function canDamageEnemy(state, enemy, seat = null, source = null) {
  if (enemyIsBody(enemy)) return false
  if (!enemy || enemy.global || !state.enemies.includes(enemy)) return false
  if (enemy.shadowMiniKind || (enemy.preventDamageRound != null && enemy.preventDamageRound === state.round)) return false
  // P7 TDC 11702–11704：非[[狂怒]]面印刷「不能受到伤害」（按当前面条目动态读；文本空白时失效）。
  if (enemyCannotBeDamaged(state, enemy, enemyTextBlanked)) return false
  // 沉睡（enemyRule.slumbering）的敌人免疫玩家卡效果与调查员行动；剧本/遭遇来源照常，
  // 来源未知时 fail-closed。读点与「能不能打/交战」共用同一套判定。
  if (!enemyEffectAllowed(state, enemy, 'damage', { entryOf: registeredEntry, isBlanked: enemyTextBlanked, cardDef })) return false
  if (seat != null && (enemyProtectionBlocks(state, state.investigators[seat], enemy, 'damage')
    || capabilityBlocked(state, state.investigators[seat], 'dealEnemyDamage')
    || (registeredEntry(enemy?.originalCode || enemy?.code)?.enemyRule?.bearerCannotFightDamageDefeat
      && enemy.bearerSeat === seat && !enemyTextBlanked(state, enemy)))) return false
  // Phase 5（5a-23）：02255 只能被特定来源伤害（规则表 damageOnlyFrom）。
  const damageRule = enemyRuleFlags(enemy?.code)
  if (damageRule.allowedDamageSources && !enemyTextBlanked(state, enemy)
    && !damageSourceMatches(state, damageRule.allowedDamageSources, source, sourceCardDef)) return false
  if (damageRule.damageOnlyFrom && source !== damageRule.damageOnlyFrom && !enemyTextBlanked(state, enemy)) return false
  // 2026-11-13 P1-8（09124）：伤害来源必须是 [[武器]] 支援或 [[策略]] 事件（来源特质读点）。
  if (damageRule.damageOnlyFromSourceTraits && !enemyTextBlanked(state, enemy)) {
    const sourceDef = sourceCardDef(state, source)
    const traitAllowed = sourceDef && (sourceDef.traits || []).some(trait =>
      (damageRule.damageOnlyFromSourceTraits.traits || []).some(wanted =>
        String(wanted).toLowerCase() === String(trait).toLowerCase()))
    const typeAllowed = !damageRule.damageOnlyFromSourceTraits.sourceTypes
      || damageRule.damageOnlyFromSourceTraits.sourceTypes.includes(sourceDef?.type)
    if (!traitAllowed || !typeAllowed) return false
  }
  if (!enemyTextBlanked(state, enemy)
    && (entityRuleActive(state, enemy, 'cannot:beDamaged')
      || scenarioBehavior(state).enemyDamageAllowed?.(state, enemy, source, seat) === false)) return false
  return true
}

function damageTable(state) {
  return captureTableState(state, getStat, getMaxSanity, { enemyHealth, enemyFightValue, enemyEvadeValue })
}

function presentCardDamage(state, inv, asset, damage, events, hint) {
  const origin = directDamageSource(state, null, hint)
  if (!origin || !(damage > 0)) return
  const target = asset ? { seat: inv?.seat, assetId: asset.id, name: cardName(asset.code), damage }
    : { seat: inv.seat, name: inv.name, damage }
  emitPresentation(state, events, directDamageCue(origin, {
    seat: origin.sourceSeat ?? inv?.seat, location: inv?.location ?? asset?.location, targets: [target],
    tableState: damageTable(state), cardName,
  }))
  return true
}

function damageEnemy(state, enemy, amount, seat, events, source = null, presentation = {}) {
  if (!(amount > 0) || !canDamageEnemy(state, enemy, seat, source)) return false
  amount += consumeHarmBonus(state, enemy, 'damage')
  if (presentation.attack && !enemyTextBlanked(state, enemy)) {
    const rule = enemyRuleFlags(enemy.code)
    if (enemyBody(state, enemy)?.exhausted && rule.damageReductionWhileExhausted > 0) {
      amount = Math.max(0, amount - rule.damageReductionWhileExhausted)
    }
    const sourceTraits = sourceCardDef(state, source)?.traits || []
    const sourceRule = registeredEntry(enemy.originalCode || enemy.code)?.enemyRule?.damageReductionExceptSourceTraits
    if (sourceRule && amount > 0 && !sourceTraits.some(trait => sourceRule.traits.some(wanted =>
      String(trait).toLowerCase() === String(wanted).toLowerCase()))) {
      amount = Math.max(sourceRule.minimum ?? 1, amount - sourceRule.amount)
    }
  }
  // 2026-11-13 P1-8（09124）：「从每个来源受到的伤害减 1」。
  const allSourcesReduction = enemyTextBlanked(state, enemy) ? 0
    : Number(enemyRuleFlags(enemy.code).damageReductionFromAllSources || 0)
  if (allSourcesReduction > 0) amount = Math.max(0, amount - allSourcesReduction)
  if (!(amount > 0)) return false
  // 「职业杀手」：本回合该敌人下次受到的伤害 +1（一次性）。
  let total = amount + campaignState.consumeDamageBonus(enemy, state)
  if (presentation.attack) total = Math.max(0, total - campaignState.damageReduction(enemy))
  const adjusted = scenarioBehavior(state).enemyDamageAmount?.(state,enemy,total,scenarioRuntime(state,events),seat,source)
  if (Number.isFinite(adjusted)) total=Math.max(0,adjusted)
  total = adjustEnemyDamage(state, enemy, total, seat, source, events, deps)
  if (!total) return false
  // P7 TDC 11568 玛莉亚·里维拉：伤害改为放在受控剧情资产上（控制器与敌人在同一地点）。
  const redirect = storyAssetEnemyDamageRedirect(state, enemy)
  if (redirect) {
    const owner = state.investigators?.[redirect.controllerSeat]
    if (owner && !presentation.suppressDirectCue && !presentation.attack) {
      const origin = directDamageSource(state, source, presentation)
      if (origin) presentCardDamage(state, owner, redirect.asset, total, events, origin)
    }
    redirect.asset.damage = (redirect.asset.damage || 0) + total
    info(state, events, `🛡️ 「${cardName(redirect.asset.code)}」代替「${enemy.name}」承受 ${total} 点伤害（${redirect.asset.damage}/${cardDef(redirect.asset.code)?.health ?? '?'}）。`)
    if (owner) checkAssetDefeated(state, owner, redirect.asset, events, deps)
    return true
  }
  const other = !presentation.redirected && enemyDamageRedirectTarget(state, enemy)
  if (other && damageEnemy(state, other, total, seat, events, source, { ...presentation, attack: false, deferDefeat: false, redirected: true })) return true
  const origin = !presentation.suppressDirectCue && !presentation.attack && directDamageSource(state, source, presentation)
  if (origin) {
    emitPresentation(state, events, directDamageCue(origin, {
      seat: origin.sourceSeat ?? seat, location: enemy.location,
      targets: [{ enemyId: enemy.id, name: enemy.name, damage: total }], tableState: damageTable(state), cardName,
    }))
  }
  enemy.damageTaken = (enemy.damageTaken || 0) + total
  if (source != null) enemy.lastDamageSource = source
  enemy.defeatedBy = seat
  enemyDamagePlaced(state, enemy, total, seat, source, events, { enemyHealth, reactionWindow })
  scenarioBehavior(state).enemyDamaged?.(state, enemy, scenarioRuntime(state, events), seat, source)
  // 条目级「敌人受到伤害后」窗口（07330b/07331b「对达贡之子也执行相同操作」这类卡面强制）。
  // 只在真有监听者时开窗：没有卡面挂载时窗口是 no-op，也不能让空窗口改动状态指纹。
  if (hasWindowListener(state, 'enemyDamaged')) {
    reactionWindow(state, 'enemyDamaged', eventWindowContext(state, {
      when: 'enemyDamaged', seat, enemy, amount: total, source, location: enemy.location,
    }), events)
  }
  if (!presentation.deferDefeat && enemyHealth(state, enemy) != null && enemy.damageTaken >= enemyHealth(state, enemy)
    && enemyCanBeDefeated(state, enemy, source, seat)) defeatEnemy(state, enemy, events,{seat,source})
  return true
}

// 胜利点 + 独特异教徒盘问记录。

function autoEvadeEnemy(state, enemy, events, options={}) {
  if (enemy?.attachedToAssetId) return false
  const context=prepareEnemyOutcome(state,'evade',enemy,events,options)
  if(!context||context.replaced||context.cancelled)return false
  const body = enemyBody(state, enemy)
  body.exhausted = true
  disengageEnemy(state, body)
  info(state, events, `💨 「${enemy.name}」被横置并脱离交战。`)
  const observers = state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === enemy.location
    && inv.assets.some(asset => registeredEntry(asset.code)?.assetRule?.reactToAutomaticEvade))
  if (observers || registeredEntry(enemy.code)?.abilities?.some(descriptor => descriptor.trigger?.includes('evadeSuccess'))) {
    const frame = state._resolution
    if (observers && frame) frame.automaticEvadeSerial = (frame.automaticEvadeSerial || 0) + 1
    reactionWindow(state, 'evadeSuccess', { when: 'evadeSuccess', seat: options.seat ?? enemy.bearerSeat ?? state.currentSeat,
      enemy, location: enemy.location,
      ...(observers && frame ? { windowInstance: `autoEvade:${frame.id}:${frame.automaticEvadeSerial}` } : {}),
    }, events, { allowNested: true })
  }
  return true
}

// 冷漠（aloof）敌人不会主动与调查员交战；未交战时也不能被攻击，需要调查员主动交战
// （或使用写明「忽略冷漠」的攻击，见 hidden-rules.js 的 aloofPreventsAttack）。

// 威胁区卡面的「当你将受到伤害/恐惧时」强制（02221 灵魂之歌 / 05269 同文重印）。
// 数据由条目的 harmInterceptor 声明（注册期校验，ability.js），引擎不写卡号分支；
// 「额外 N 点并弃掉本卡」在分配伤害之前生效，弃掉的遭遇卡进遭遇弃牌堆。
function applyThreatHarmInterceptors(state, inv, damage, horror, events) {
  let next = null
  for (const card of (inv.threat || []).slice()) {
    const rule = registeredEntry(card.originalCode || card.code)?.harmInterceptor
    if (!rule) continue
    if (rule.trigger === 'damage' && !(damage > 0)) continue
    if (rule.trigger === 'horror' && !(horror > 0)) continue
    if (rule.trigger === 'damageOrHorror' && !(damage > 0 || horror > 0)) continue
    next ||= { damage, horror }
    let kind = rule.trigger
    if (kind === 'damageOrHorror') {
      kind = damage > 0 && horror > 0 ? requestChoice(state, {
        kind: 'effect', source: card.code, seat: inv.seat,
        prompt: '选择额外承受伤害或恐惧。',
        options: [{ id: 'damage', label: '受到额外伤害' }, { id: 'horror', label: '受到额外恐惧' }],
      }) : damage > 0 ? 'damage' : 'horror'
    }
    if (kind !== 'damage' && kind !== 'horror') continue
    next[kind] += rule.extra
    if (rule.discard) {
      const index = inv.threat.indexOf(card)
      if (index >= 0) inv.threat.splice(index, 1)
      state.encounterDiscard.push(card.code)
      info(state, events, `「${cardName(card.code)}」：你额外受到 ${rule.extra} 点${kind === 'damage' ? '伤害' : '恐惧'}，然后弃掉它。`)
    } else {
      info(state, events, `「${cardName(card.code)}」：你额外受到 ${rule.extra} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
    }
  }
  return next
}

function applyHarm(state, inv, damage, horror, events, direct, attack = null, assetsFirst = false, strategy = null, presentationOrigin = null, reassignment = null) {
  if (state.scenario?.mechanics?.protectInvestigators) return
  if (!reassignment) inv = effectRecipient(state, inv)
  // P5 地球边缘：回合事件记账（陈丽丽的 Broken 面轮末条件）。
  // 只对声明 investigator.roundEvents 的调查员写入；伤害/恐惧的「实际收入」在分配前记账，
  // 与 applyHarm 的净变化口径一致（被取消/防止的伤害不会走到这里）。
  if (!reassignment && damage > 0) noteRoundEvent(state, inv, 'damage', damage)
  if (!reassignment && horror > 0) noteRoundEvent(state, inv, 'horror', horror)
  const attackOrigin = reassignment ? null : (presentationOrigin?.attackStyle ? presentationOrigin : attackHarmOrigin(attack))
  // 「在你受到恐惧时，如果这些恐惧中至少有 1 点没有分配给 X，受到 1 点伤害」（03182a 丹尼尔）。
  // 在分配前记下带这条强制的支援，分配后按分配结果判定。
  const horrorOverflowAssets = !reassignment && (horror || 0) > 0
    ? (inv.assets || []).filter(asset => registeredEntry(asset.code)?.horrorOverflowDamage)
    : []
  const changed = !reassignment && scenarioBehavior(state).beforeHarm?.(state, inv,
    { damage: damage || 0, horror: horror || 0, direct: !!direct }, scenarioRuntime(state, events))
  if (changed) { damage = changed.damage; horror = changed.horror; direct = changed.direct }
  // 条目声明的威胁区强制（02221 灵魂之歌）：在战役钩子之后、分配之前追加并弃卡。
  const intercepted = !reassignment && applyThreatHarmInterceptors(state, inv, damage || 0, horror || 0, events)
  if (intercepted) { damage = intercepted.damage; horror = intercepted.horror }
  if (!(damage > 0 || horror > 0)) return
  // 「这次伤害/恐惧是否足以击败你」（04111 坚韧不拔）：窗口开始前写入，供反应条件读取。
  if (!reassignment) state.lastHarmContext = { seat: inv.seat, damage: damage || 0, horror: horror || 0, direct: !!direct,
    round: state.round, turnSerial: state.turnSerial ?? null }
  const harmContext = reassignment ? { ...reassignment, damage, horror }
    : reactionWindow(state, 'harmDealt', { when: 'harmDealt', seat: inv.seat, location: inv.location,
    // 来源判定统一走 reaction-source.js（遭遇卡/敌人攻击/其它）；「否定存在」按这个字段决定是否可打出。
    source: reactionSource(state),
    damage: damage || 0, horror: horror || 0, direct: !!direct, attack, prompt: `${inv.name} 将受到伤害或恐惧` }, events)
  damage = Math.max(0, harmContext.damage || 0)
  horror = Math.max(0, harmContext.horror || 0)
  if (!(damage > 0 || horror > 0)) return
  const directOrigin = !attackOrigin && !reassignment && damage > 0
    ? cardHarmSource(state, presentationOrigin) : null
  let harmSnapshot = attackOrigin ? damageTable(state) : null
  const placements = new Map()
  const encounterHarm = harmContext.source?.kind === 'encounter'
  const revealHarm = !attackOrigin && !directOrigin && (encounterHarm || cardOutcomeAudioScoped(state)) ? new Map() : null
  const dealtHarm = !reassignment && hasWindowListener(state, 'harmDealtToInvestigator') ? new Map() : null
  const recordPlacement = (recipient, kind, amount, owner = inv) => {
    if (revealHarm && amount > 0) {
      const total = revealHarm.get(owner.seat) || { seat: owner.seat, damage: 0, horror: 0, selfDamage: 0, selfHorror: 0 }
      total[kind] += amount
      if (recipient === owner) total[kind === 'damage' ? 'selfDamage' : 'selfHorror'] += amount
      revealHarm.set(owner.seat, total)
    }
    if (dealtHarm && amount > 0) {
      const total = dealtHarm.get(owner.seat) || { damage: 0, horror: 0 }
      total[kind] += amount
      dealtHarm.set(owner.seat, total)
    }
    if (!(amount > 0) || (!attackOrigin && !(directOrigin && kind === 'damage'))) return
    const key = recipient === owner ? `investigator:${owner.seat}` : `asset:${recipient.id}`
    if (!placements.has(key)) placements.set(key, { seat:owner.seat,
      ...(recipient !== owner ? { assetId:recipient.id } : {}), damage:0, horror:0,
      ...(directOrigin ? { name: recipient === owner ? owner.name : cardName(recipient.code) } : {}) })
    placements.get(key)[kind] += amount
  }
  const presentRevealHarm = () => {
    if (!revealHarm?.size) return
    const targets = [...revealHarm.values()]
    const damage = targets.some(target => target.damage > 0)
    const horror = targets.some(target => target.horror > 0)
    noteCardOutcomeSound(state, damage && horror ? 'injuryAndFear' : damage ? 'injury' : 'fright', { targets },
      encounterHarm ? events : null)
  }
  const notifyDealtHarm = () => {
    for (const [seat, totals] of dealtHarm || []) {
      reactionWindow(state, 'harmDealtToInvestigator', {
        when: 'harmDealtToInvestigator', seat, location: state.investigators[seat].location, ...totals,
      }, events, { allowNested: true })
    }
  }
  const presentPlacement = () => {
    if (!placements.size) return
    if (attackOrigin) {
      emitPresentation(state, events, {type:'presentation',kind:'enemyHarm',direction:'incoming',
        presentationStage:'harm', ...attackOrigin, seat:inv.seat, location:inv.location,
        targets:[...placements.values()], tableState:harmSnapshot})
    } else {
      const targets = [...placements.values()].map(({ horror, ...target }) => target)
      emitPresentation(state, events, directDamageCue(directOrigin, {
        seat: directOrigin.sourceSeat ?? inv.seat, location: inv.location, targets, tableState: harmSnapshot, cardName,
      }))
    }
  }
  // 07338 潜水服：「当任意数量的伤害将要放置到你身上时：将其中 1 点放到潜水服上」。
  // 条目声明 `assetRule.redirectOneDamageToSelf: true`；每次结算最多转移 1 点，直接伤害也适用
  // （印刷是「any amount of damage」，不分直接/非直接），转移后总量不变、剩余照常分配。
  if (damage > 0) {
    const carriers = [...(inv.assets || []),
      ...(state.storyAssets || []).filter(asset => asset.controllerSeat === inv.seat)]
    const suit = carriers.find(asset => registeredEntry(asset.code)?.assetRule?.redirectOneDamageToSelf === true
      && !asset.removedFromGame)
    if (suit) {
      if (directOrigin) harmSnapshot = damageTable(state)
      suit.damage = (suit.damage || 0) + 1
      recordPlacement(suit, 'damage', 1)
      damage -= 1
      info(state, events, `🩱 「${cardName(suit.code)}」转移了 1 点伤害（剩余 ${damage} 点由${inv.name}承受）。`)
    }
  }
  if (!(damage > 0 || horror > 0)) { presentPlacement(); presentRevealHarm(); notifyDealtHarm(); return }
  if (direct && inv.assets.some(asset => !assetPassiveData(asset.code)?.assignDirectHarm
    && ((damage > 0 && cardDef(asset.code)?.health > 0) || (horror > 0 && cardDef(asset.code)?.sanity > 0))))
    info(state, events, `本次为直接${damage > 0 && horror > 0 ? '伤害与恐惧' : damage > 0 ? '伤害' : '恐惧'}，只能由${inv.name}本人承受，不能分配给支援卡。`)
  const playerEffect = reassignment?.playerEffect ?? (effectSourceIsPlayer(state) && !state._enemyAttackResolving)
  const assignedDamage = assignHarm(state, inv, damage || 0, 'damage', events, direct, assetsFirst, strategy, null, playerEffect)
  const assignedHorror = assignHarm(state, inv, horror || 0, 'horror', events, direct, false, strategy, assignedDamage, playerEffect)
  for (const [recipient, amount] of assignedDamage) {
    if (state.investigators.includes(recipient) || amount <= 0) continue
    const context = { when: 'damageAssignedToSelf', seat: inv.seat, location: inv.location,
      assetId: recipient.id, cancelDamage: 0 }
    triggerReaction(state, inv.seat, 'damageAssignedToSelf', events, context)
    if (context.cancelDamage) assignedDamage.set(recipient, Math.max(0, amount - context.cancelDamage))
    const owner = state.investigators.find(other => other.assets.includes(recipient))
    if (owner && registeredEntry(recipient.code)?.abilities?.some(descriptor => descriptor.trigger?.includes('assetDamageAssigned'))) {
      // 窗口实例：07006「每次分配伤害」按 **每次分配** 触发。没有实例键时，同一事务里
      // 多次分配（敌人阶段多名敌人攻击 / 一次攻击多段伤害）会被 limit.perWindow 折叠成
      // 同一次触发（审计 H9）。eventWindowContext 只在 `scenario.eventWindowInstances`
      // （TIC）时写实例 id，其余战役的存档/重放形状不变。
      reactionWindow(state, 'assetDamageAssigned', eventWindowContext(state, { when: 'assetDamageAssigned', seat: owner.seat,
        assetId: recipient.id, amount: assignedDamage.get(recipient) }), events, { allowNested: true })
    }
  }
  for (const target of new Set([...assignedDamage.keys(), ...assignedHorror.keys()])) {
    if (!(target.attachments || []).some(card => registeredEntry(card.code)?.abilities
      .some(descriptor => descriptor.trigger.includes('assignedHarm')))) continue
    const owner = state.investigators.includes(target) ? target
      : state.investigators.find(other => other.assets.includes(target))
    const assigned = { damage: assignedDamage.get(target) || 0, horror: assignedHorror.get(target) || 0 }
    if (!owner || (!assigned.damage && !assigned.horror)) continue
    const remaining = reactionWindow(state, 'assignedHarm', {
      when: 'assignedHarm', seat: owner.seat, target, location: owner.location, attack,
      source: harmContext.source, cannotCancel: harmContext.cannotCancel === true,
      ...assigned, prompt: '将伤害或恐惧放置到所选卡牌前。',
    }, events, { allowNested: true })
    for (const [kind, assignments] of [['damage', assignedDamage], ['horror', assignedHorror]]) {
      const amount = Math.max(0, Math.min(assigned[kind], Number(remaining[kind]) || 0))
      if (amount > 0) assignments.set(target, amount)
      else if (assigned[kind] > 0) assignments.delete(target)
    }
  }
  // "When dealt damage" reactions occur after assignment, before placement and
  // defeat. A Guard Dog can retaliate even when this attack will defeat it.
  if (attack && !reassignment) triggerReaction(state, inv.seat, 'enemyAttackDamage', events, {
    ...attack,
    damagedAssetIds: [...assignedDamage.keys()].filter(a => !state.investigators.includes(a)).map(a => a.id),
  })
  // Area damage can be assigned to assets, so count actual placement rather
  // than just the investigator's health delta. Capture before lethal removal.
  if (directOrigin && !harmSnapshot) harmSnapshot = damageTable(state)
  for (const [kind, assignments] of [['damage', assignedDamage], ['horror', assignedHorror]]) {
    for (const [recipient, assigned] of assignments) {
      const amount = kind === 'damage' && assigned > 0 ? assigned + consumeHarmBonus(state, recipient, 'damage') : assigned
      if (recipient !== inv && state.investigators.includes(recipient)) {
        recipient[kind] = (recipient[kind] || 0) + amount
        recordPlacement(recipient, kind, amount, recipient)
        continue
      }
      if (recipient !== inv && !inv.assets.includes(recipient)
        && !(recipient.controlledByAll && state.storyAssets?.includes(recipient))) {
        const owner = state.investigators.find(other => other.assets.includes(recipient))
        if (!owner) continue
        recipient[kind] = (recipient[kind] || 0) + amount
        recordPlacement(recipient, kind, amount, owner)
        info(state, events, `${cardName(recipient.code)}（${owner.name}）承受 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
        continue
      }
      recipient[kind] = (recipient[kind] || 0) + amount
      recordPlacement(recipient, kind, amount)
      if (recipient !== inv) info(state, events, `${cardName(recipient.code)} 承受 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
    }
  }
  if (directOrigin) presentPlacement()
  presentRevealHarm()
  // 批次 3（60451）：伤害/恐惧实际放置到调查员本人后开反应窗口。
  if (hasWindowListener(state, 'damagePlacedOnSelf')
    && ((assignedDamage.get(inv) || 0) + (assignedHorror.get(inv) || 0)) > 0) {
    reactionWindow(state, 'damagePlacedOnSelf', { when: 'damagePlacedOnSelf', seat: inv.seat,
      location: inv.location, damage: assignedDamage.get(inv) || 0, horror: assignedHorror.get(inv) || 0,
      direct: !!direct, attack, prompt: `${inv.name} 受到伤害或恐惧后` }, events, { allowNested: true })
  }
  // 批次 3（60454）：同地点任意调查员受伤后，触发威胁区的「每轮第一次」恐惧。
  if ((assignedDamage.get(inv) || 0) > 0) {
    for (const owner of state.investigators) {
      if (!owner || owner.defeated || owner.resigned || owner.location !== inv.location) continue
      for (const threat of owner.threat || []) {
        const rule = registeredEntry(threat.code)?.locationHarmFirstPerRound
        if (!rule || threat.locationHarmRound === state.round) continue
        threat.locationHarmRound = state.round
        const horror = Math.max(0, Number(rule.horror) || 0)
        if (horror > 0) {
          applyHarm(state, inv, 0, horror, events)
          info(state, events, `💀 「${cardName(threat.code)}」：${inv.name} 受到 ${horror} 点恐惧（同地点受伤）。`)
        }
      }
    }
  }
  if (attackOrigin) presentPlacement()
  notifyDealtHarm()
  // P6（食梦者）：支援被击败的唯一判定点（asset-defeat.js）。伤害分配、伤害移动、剧本效果
  const harmedAssets = new Set([...assignedDamage.keys(), ...assignedHorror.keys()])
  const assignedAlly = !!attack && [...harmedAssets].some(card => !state.investigators.includes(card)
    && (assignedDamage.get(card) > 0 || assignedHorror.get(card) > 0)
    && (cardDef(card.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))
  for (const source of harmedAssets) {
    if (source !== inv && state.investigators.includes(source)) {
      reactionWindow(state, 'harmAssigned', { when: 'harmAssigned', seat: source.seat, location: source.location,
        damage: assignedDamage.get(source) || 0, horror: assignedHorror.get(source) || 0, attack,
        ...(attack?.attackKey ? { attackKey: attack.attackKey } : {}) }, events, { allowNested: true })
      checkDefeated(state, source.seat, events)
      continue
    }
    const attacker = attack && state.enemies.find(enemy => enemy.id === attack.enemyId)
    const sendsAssetHarm = card => registeredEntry(card?.originalCode || card?.code)?.abilities
      ?.some(descriptor => descriptor.trigger.includes('assetHarmPlaced'))
    if (source === inv || (!sendsAssetHarm(source) && !sendsAssetHarm(attacker))) continue
    const controller = state.investigators.find(other => other.assets.includes(source))
    if (!controller) continue
    reactionWindow(state, 'assetHarmPlaced', { when: 'assetHarmPlaced', seat: controller.seat, assetId: source.id,
      ...(sendsAssetHarm(attacker) ? { cardId: source.id, enemy: attacker, location: controller.location } : {}),
      assigningSeat: inv.seat, direct: !!direct, attack, playerEffect, source: harmContext.source,
      cannotCancel: harmContext.cannotCancel === true,
      damage: assignedDamage.get(source) || 0, horror: assignedHorror.get(source) || 0 }, events, { allowNested: true })
  }
  // 都走这里，`assetDefeated` 窗口才有统一的触发位置。
  const assetDefeatDeps = {
    cardDef,
    cardName,
    leaveAsset,
    info,
    reactionWindow,
    triggerReaction,
    registeredEntry,
    defeatedAssetRetaliation,
    exilePlayerCard,
    shuffleIntoDeck: (owner, code) => {
      owner.deck = replacePlayerZoneCards(state, owner, shuffle([...owner.deck, code], () => randomValue(state)), 'shuffle')
    },
  }
  for (const owner of state.investigators) {
    for (const asset of owner.assets.slice()) {
      checkAssetDefeated(state, owner, asset, events, assetDefeatDeps)
    }
  }
  for (const asset of harmedAssets) {
    if (!asset.controlledByAll || !state.storyAssets?.includes(asset)) continue
    if ((asset.health > 0 && asset.damage >= asset.health) || (asset.sanity > 0 && asset.horror >= asset.sanity)) {
      scenarioBehavior(state).sharedStoryAssetDefeated?.(state, asset, scenarioRuntime(state, events))
    }
  }
  const totalHorror = [...assignedHorror.values()].reduce((total, amount) => total + amount, 0)
  for (const asset of horrorOverflowAssets) {
    const assignedHere = assignedHorror.get(asset) || 0
    if (assignedHere >= totalHorror) continue
    const overflowDamage = registeredEntry(asset.code)?.horrorOverflowDamage || 1
    info(state, events, `💥 「${cardName(asset.code)}」强制：这些恐惧中至少有 1 点没有分配给他，你受到 ${overflowDamage} 点伤害。`)
    applyDamage(state, inv, overflowDamage, events)
    break
  }
  const actualDamage = assignedDamage.get(inv) || 0
  const actualHorror = assignedHorror.get(inv) || 0
  // 非攻击来源、且真正落在调查员身上的伤害/恐惧补一条纯展示 cue：
  // 时间线此前只有攻击（attack / enemyHarm）或卡面自己写的文字，剧本行为、直接伤害、
  // 强制效果造成的「卢克·罗宾逊 受到 3 点伤害」完全不可见（2026-11-09 实机排查时，
  // 落入陷阱的 3 点伤害在日志里没有任何痕迹）。被支援吸收的份额不记（支援自己有承受日志）。
  // 展示 cue 不进 state.log、不进重放指纹；时间线按 kind === 'harm' 渲染成一行文字。
  if (!attackOrigin && (actualDamage > 0 || actualHorror > 0)) {
    emitPresentation(state, events, { type: 'presentation', kind: 'harm',
      seat: inv.seat, location: inv.location, name: inv.name,
      damage: actualDamage, horror: actualHorror, direct: !!direct })
  }
  if (actualDamage > 0 || actualHorror > 0) reactionWindow(state, 'harmAssigned', {
    when: 'harmAssigned', seat: inv.seat, location: inv.location,
    damage: actualDamage, horror: actualHorror, attack, ...(assignedAlly ? { assignedAlly } : {}),
    ...(attack?.attackKey ? { attackKey: attack.attackKey } : {}),
  }, events, { allowNested: true })
  checkDefeated(state, inv.seat, events)
  if (inv.defeated || inv.resigned) return
  if ([...assignedDamage.values()].some(amount => amount > 0)) {
    triggerReaction(state, inv.seat, 'damagePlaced', events, {
      amount: [...assignedDamage.values()].reduce((total, amount) => total + amount, 0),
      damagedAssetIds: [...assignedDamage.keys()].filter(recipient => !state.investigators.includes(recipient)).map(recipient => recipient.id),
    })
  }
  if (assignedDamage.get(inv) > 0) triggerThreatForced(state, inv, 'onDamage', events)
  if (assignedHorror.get(inv) > 0) {
    triggerReaction(state, inv.seat, 'horrorPlaced', events)
    triggerThreatForced(state, inv, 'onHorror', events)
  }
}

function defeatedAssetRetaliation(state, owner, amount, events, asset = null) {
  const enemies = state.enemies.filter(enemy => enemy.location === owner.location)
  if (!enemies.length) return
  const enemyId = enemies.length === 1 ? enemies[0].id : requestChoice(state, { kind: 'target', source: 'assetDefeat', seat: owner.seat,
    prompt: `选择承受 ${amount} 点伤害的敌人。`, options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  const enemy = enemies.find(item => item.id === enemyId)
  if (!enemy) return
  info(state, events, `${owner.name} 的支援被击败，对「${enemy.name}」造成 ${amount} 点伤害。`)
  damageEnemy(state, enemy, amount, owner.seat, events, null,
    asset ? { code: asset.code, assetId: asset.id, sourceSeat: owner.seat } : {})
}

function applyDamage(state, inv, amount, events, direct, presentation) {
  applyHarm(state, inv, amount, 0, events, direct, null, false, null, presentation)
}

function applyHorror(state, inv, amount, events, direct) {
  applyHarm(state, inv, 0, amount, events, direct)
}

  return { enemyZoneApi, enemyOutcomePublicApi, prepareEnemyOutcome, shuffleEnemyIntoEncounterDeck, canDamageEnemy, enemyHealth, enemyFightValue, enemyEvadeValue, enemiesEngagedWith, enemyAttacksAsIfEngaged, enemyAttack, spawnEnemy, engageEnemy, disengageEnemy, defeatEnemy, damageEnemy, autoEvadeEnemy, applyHarm, defeatedAssetRetaliation, applyDamage, applyHorror, presentCardDamage }
}
