import { mechanicState } from './mechanic-state.js'
import { createEnemyZoneApi } from './enemy-zones.js'
import { createEnemyOutcomeApi } from './enemy-outcomes.js'
import { wouldAddToVictory } from './victory-destination.js'
import { replacePlayerZoneCards } from './player-zones.js'
import { eventWindowContext } from './event-window.js'
import { keysOnExit } from './scenario-keys.js'
import { enemyEffectAllowed } from './effect-provenance.js'
// 敌人与伤害（applyHarm / 攻击 / 生成 / 击败 / 交战）从 engine.js 拆出的模块
// （Phase 6 · 6d-22）。
//
// 这一组是规则最「热」的底层原语：
//   applyHarm / applyDamage / applyHorror —— 一切伤害与恐惧的唯一入口（含 soaking、直接伤害、
//     反伤、击败资产）
//   enemyHealth / enemyFightValue / enemyEvadeValue —— 敌人数值读点
//   enemyAttack —— 敌人攻击流程（反应窗口、修正、结算）
import { enemySpawnRuleFor } from '../cards/card-rules.js'
import { weaknessOwnerSeat } from './card-lookup.js'
import { enemyIgnoresInvestigator } from './trait-passives.js'
import { enemyCanEnterLocation } from './enemy-entry.js'
import { capabilityBlocked } from './modifiers.js'
import { swarmGroup, returnSwarmCard, swarmCardsOf } from './swarm.js'
import { tracksHistory } from './action-history.js'
import { effectRecipient } from './effect-recipient.js'
// P6（食梦者）：支援被击败的唯一判定点（含 assetDefeated 窗口）。
import { checkAssetDefeated } from './asset-defeat.js'
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
    getMaxSanity,
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
function activeRuntimeEnemyMods(state, enemy) {
  const mods = enemy?.statMods
  if (!Array.isArray(mods) || !mods.length) return []
  return mods.filter(mod => {
    const until = mod.until || {}
    if (until.round != null && state.round !== until.round) return false
    if (until.turnSerial != null && state.turnSerial !== until.turnSerial) return false
    if (until.phase != null && state.phase !== until.phase) return false
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
  return state.enemies.filter((e) => e.engagedSeat === inv.seat || (e.massive && !enemyTextBlanked(state, e) && e.location === inv.location))
}

// 猎物（prey）排序：数值越小越优先，便于统一计算并列集合。

function enemyAttack(state, enemy, inv, events, label, options = {}) {
  inv = effectRecipient(state, inv)
  if(enemyZoneApi(state,events).isInactive(enemy.id))return false
  if (enemy.attackProtection?.[inv.seat] === state.round) return false
  const attack = {
    kind: options.kind || 'enemy',
    source: options.source || null,
    plannedDamage: enemy.damage,
    plannedHorror: enemy.horror,
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
  if (attack.kind !== 'effect' && enemyCannotAttack(state, enemy)) {
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
  const context = reactionWindow(state, 'enemyAttack',
    { when: 'enemyAttack', seat: inv.seat, location: inv.location, enemy, attackKind: attack.kind,
      prompt: `「${enemy.name}」攻击 ${inv.name}` }, events)
  // 03068b：该敌人的攻击不能被取消。
  if (context.cancelled && enemyRuleFlags(enemy.code).attacksCannotBeCancelled) {
    info(state, events, `⛔ 「${enemy.name}」的攻击不能被取消。`)
    context.cancelled = false
  }
  if (context.cancelled) {
    info(state, events, `「${enemy.name}」对 ${inv.name} 的攻击被取消。`)
    attack.cancelled = true
    // 2026-10-25 本循环修复 05258：「敌人攻击你后，即便该次攻击被取消」也必须开一次 enemyAttacked 窗口；
    // 未取消路径仍在攻击结算后开唯一一次窗口（见本函数末尾），不会重复。
    // 注意：这里用 attackCancelled 而不是 cancelled 表达「攻击被取消」——cancelled 是
    // openAbilityWindow 的「本窗口取消」语义，写成 cancelled 会导致窗口里不再枚举反应。
    reactionWindow(state, 'enemyAttacked', {
      when: 'enemyAttacked', seat: inv.seat, location: inv.location, enemy, attack,
      attackCancelled: true, cancelled: false,
      prompt: `「${enemy.name}」攻击 ${inv.name} 后（该次攻击被取消）`,
    }, events)
    return false
  }
  let extraDamage = 0
  let extraHorror = 0
  if (!enemyTextBlanked(state, enemy)) scenarioBehavior(state).enemyAttackStarted?.(state, enemy, inv, scenarioRuntime(state, events), attack)
  const attackBonus = scenarioBehavior(state).enemyAttackModifier?.(state, enemy, inv) || {}
  extraDamage += attackBonus.damage || 0
  extraHorror += attackBonus.horror || 0
  // Phase 5（5a-13）：敌人卡面的特殊攻击规则在 card-rules.js 的 ENEMY_RULE_FLAGS 里。
  if (!enemyTextBlanked(state, enemy)
    && (enemyRuleFlags(enemy.code).discardRandomOnAttack || enemyRuleFlags(enemy.ruleId).discardRandomOnAttack)) {
    if (inv.hand.length) discardRandomFromHand(state, inv, 1, events)
    else { extraDamage = 1; extraHorror = 1; info(state, events, `🧠 ${inv.name} 无手牌可弃，「${enemy.name}」的伤害和恐惧各 +1。`) }
  }
  const adjusted = scenarioBehavior(state).beforeEnemyHarm?.(state, enemy, inv,
    { damage: enemy.damage + extraDamage, horror: enemy.horror + extraHorror }, scenarioRuntime(state, events))
  if (adjusted?.damage != null) extraDamage = adjusted.damage - enemy.damage
  if (adjusted?.horror != null) extraHorror = adjusted.horror - enemy.horror
  attack.plannedDamage = enemy.damage + extraDamage
  attack.plannedHorror = enemy.horror + extraHorror
  const attackText = label || `🗡️ 「${enemy.name}」攻击 ${inv.name}：${enemy.damage + extraDamage} 点伤害、${enemy.horror + extraHorror} 点恐惧。`
  info(state, events, attackText, { kind: 'attack', direction: 'incoming', phase: state.phase, round: state.round,
    attackKind: attack.kind,
    code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code, name: enemy.name, text: attackText,
    effect: 'attack', seat: inv.seat, enemyId: enemy.id, location: inv.location, damage: enemy.damage + extraDamage, horror: enemy.horror + extraHorror })
  const damageBefore = inv.damage || 0
  const horrorBefore = inv.horror || 0
  // 「如果哈斯塔的攻击造成的恐惧超出你的神智值，你还受到 1 点伤害」（03332/03334）。
  const excessHorrorDamage = !enemyTextBlanked(state, enemy)
    && enemyRuleFlags(enemy.code).excessHorrorDamage === true
  const remainingSanityBefore = excessHorrorDamage ? getMaxSanity(inv) - (inv.horror || 0) : 0
  // 2026-10-25 第六轮修复 05032：敌人攻击期间打开 wouldDiscardFromHand/wouldLoseResources/
  // wouldLoseActions 窗口时，context.source 可标出来源（enemyAttack）。
  const previousEnemyAttackResolving = state._enemyAttackResolving
  state._enemyAttackResolving = { enemy, inv, kind: attack.kind }
  try {
    if (!inv.defeated && !tryAquinnahRedirect(state, enemy, inv, events, extraDamage, extraHorror)) {
      applyHarm(state, inv, enemy.damage + extraDamage, enemy.horror + extraHorror, events, false, { enemy, location: inv.location },
        false, enemyRuleFlags(enemy.code).harmStrategy || null)
    }
  } finally {
    if (previousEnemyAttackResolving === undefined) delete state._enemyAttackResolving
    else state._enemyAttackResolving = previousEnemyAttackResolving
  }
  // 实际落到调查员身上的伤害/恐惧（被取消、被防止或转移时为 0）。
  attack.damage = Math.max(0, (inv.damage || 0) - damageBefore)
  attack.horror = Math.max(0, (inv.horror || 0) - horrorBefore)
  if (excessHorrorDamage && attack.horror > remainingSanityBefore && !inv.defeated && !inv.resigned) {
    info(state, events, `💥 「${enemy.name}」造成的恐惧超出 ${inv.name} 的神智值，额外受到 1 点伤害。`)
    applyDamage(state, inv, 1, events)
  }
  scenarioBehavior(state).enemyAttackResolved?.(state, enemy, inv, scenarioRuntime(state, events), attack)
  // 第 5 步 P6：「敌人攻击你后」的反应窗口（序章故事调查员；被取消的攻击也算）。
  reactionWindow(state, 'enemyAttacked', {
    when: 'enemyAttacked', seat: inv.seat, location: inv.location, enemy, attack,
    cancelled: false, prompt: `「${enemy.name}」攻击 ${inv.name} 后`,
  }, events)
  if (inv.defeated) checkOutcome(state, events)
  if (!enemyTextBlanked(state, enemy) && enemy.forcedDoom) {
    // "Place 1 doom on the current agenda" goes through the agenda clock, so it
    // must be able to advance the agenda immediately.
    info(state, events, `「${enemy.name}」攻击后，在密谋上放置 1 点毁灭。`)
    addDoom(state, 1, events)
  }
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

function spawnEnemy(state, code, locationId, engagedSeat, ignoreSpawn = false, temporary = false, sourceSeat = null, options = {}) {
  if (options.exhausted != null && typeof options.exhausted !== 'boolean') throw new TypeError('Invalid exhausted spawn option')
  const def = enemyDef(code)
  if (!def) return null
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
  // 「生成 - 任意无人地点（如可能，生成在[[古代]]地点）」（04086）。
  if (!override && !ignoreSpawn && registeredEntry(code)?.spawnAncientFirst) {
    const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
    const empty = state.locations.filter(loc => !active.some(inv => inv.location === loc.id))
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
  if (!ignoreSpawn && scenarioBehavior(state).spawnLocation) loc = scenarioBehavior(state).spawnLocation(state, code, loc, engagedSeat, scenarioRuntime(state, []))
  // 2026-10-25 本循环修复 05204/05205：剧本级「此地不能生成敌人」限制统一咨询（含 api.spawn 的 ignoreSpawn 路径）；
  // 被禁止时按生成失败处理（进遭遇弃牌堆 + spawnFailed），与参考实现 noSpawn 语义一致。
  if (!enemyCanEnterLocation(state, { ...def, code, originalCode: code }, loc)
    || scenarioBehavior(state).spawnForbiddenAt?.(state, code, loc, engagedSeat)) {
    info(state, [], `⛔ 「${def?.name || code}」不能在「${state.locations.find(item => item.id === loc)?.name || loc}」生成。`)
    state.encounterDiscard.push(code)
    scenarioBehavior(state).spawnFailed?.(state, code, engagedSeat, scenarioRuntime(state, []))
    return null
  }
  if (!locationExists(state, loc)) {
    state.encounterDiscard.push(code)
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
  }
  if (temporary) return enemy
  if (def.swarming) enemy.swarmOwnerSeat = sourceSeat ?? engagedSeat ?? state.campaign?.leadSeat ?? state.currentSeat
  const chooseEngaged = registeredEntry(code)?.enemyRule?.spawnEngagedSeat
  if (!ignoreSpawn && typeof chooseEngaged === 'function') engagedSeat = chooseEngaged(state, enemy, engagedSeat, scenarioRuntime(state, []))
  return enterExistingEnemy(state,enemy,{engageSeat:engagedSeat},[])
}

function enterExistingEnemy(state,enemy,{engageSeat=null}={},events=[]) {
  const code=enemy.code,engagedSeat=engageSeat
  state.enemies.push(enemy)
  scenarioBehavior(state).enemySpawned?.(state, enemy, scenarioRuntime(state, events))
  processPlayerEnemyEntry(state, enemy, events, true)
  if (!state.enemies.includes(enemy)) return enemy
  // 「入场后：在其上放置毁灭」。战役钩子若已放过（失落时代 / 万古之环），这里不再加。
  if (state.enemies.includes(enemy)) {
    const ruleDoom = Number(enemySpawnRuleFor(code)?.doomOnSpawn) || 0
    const missing = ruleDoom - (enemy.doom || 0)
    if (missing > 0) {
      enemy.doom = (enemy.doom || 0) + missing
      info(state, events, `🧿 「${enemy.name}」入场：在它身上放置 ${missing} 个毁灭标记。`)
    }
  }
  for (const inv of aliveInvestigators(state)) {
    if (inv.location === enemy.location) triggerReaction(state, inv.seat, 'enemySpawn', events, { enemy, location: enemy.location },{skipAbilityWindow:true})
  }
  // Reaction events (e.g. Think on Your Feet) are played from hand on the same
  // window; the enemy still spawns at the original location.
  reactionWindow(state, 'enemySpawn', { when: 'enemySpawn', seat: engagedSeat ?? leadDecisionSeat(state),
    location: enemy.location, enemy }, events)
  if (state.enemies.includes(enemy) && !enemy.exhausted && !enemy.aloof && !enemy.massive && engagedSeat != null && state.investigators[engagedSeat]?.location === enemy.location) engageEnemy(state, enemy, engagedSeat,events)
  return enemy
}

// 由剧本现场生成、不在卡牌目录里的敌人（04331 纽约遗址的飞天水螅）。
// stats 提供印刷数值；extra 放实例标记（例如 underlyingCard = 被当作敌人的那张牌）。

function engageEnemy(state, enemy, seat, events = [], grouped = false) {
  if (!grouped && (enemy.hostId || enemy.swarmCards?.length)) {
    for (const member of swarmGroup(state, enemy)) engageEnemy(state, member, seat, events, true)
    return
  }
  if (capabilityBlocked(state, state.investigators[seat], 'engage')) return
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
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) removeOne(inv.engaged, enemy.id)
  }
  enemy.engagedSeat = null
}

function leaveEnemyPlay(state,enemy,events,{reason='zone',preserveKeys=false,responsibleSeat=null}={}) {
  releaseChaosTokens?.(state,enemy.id)
  if(!preserveKeys)keysOnExit(state,'enemy:'+enemy.id,enemy.location,responsibleSeat)
  if(enemy.bindMonster){state.investigators[enemy.bindMonster.ownerSeat]?.discard.push(enemy.bindMonster.code);delete enemy.bindMonster}
  removeOne(state.enemies,enemy)
  if(enemy.smiteTheWickedSeat!=null)state.investigators[enemy.smiteTheWickedSeat]?.discard.push(SMITE_THE_WICKED_CODE)
  if(enemy.engagedSeat!=null){const inv=state.investigators[enemy.engagedSeat];if(inv)removeOne(inv.engaged,enemy.id)}
  if(reason==='zone')enemy.engagedSeat=null
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
  zones:enemyZoneApi(state,events),wouldAddToVictory:enemy=>wouldAddToVictory(enemy,enemyDef),
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
    state, enemy, swarmHost, scenarioRuntime(state, events)) : null
  // 敌人离场：把它身上封印的混乱标记归还混乱袋（04014 伊格蛇族的旧印等）。
  const defeatedBy = context.sourceSeat
  const defeater = state.investigators[defeatedBy]
  if (defeater && tracksHistory(state, defeater, 'trackDefeatedEnemyHealth', registeredEntry)) {
    if (defeater.defeatedHealthHistory?.turn !== state.turnSerial) defeater.defeatedHealthHistory = { turn: state.turnSerial, total: 0 }
    defeater.defeatedHealthHistory.total += enemyHealth(state, enemy)
  }
  // 「煤油」等需要知道本地点本轮是否有敌人被击败。
  const defeatedAt = state.locations.find(location => location.id === enemy.location)
  if (defeatedAt) defeatedAt.enemyDefeatedRound = state.round
  leaveEnemyPlay(state,enemy,events,{reason:'defeat',responsibleSeat:defeatedBy})
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
  const replaced = !swarmHost && (outcome.commitDestination(context)||scenarioBehavior(state).enemyDefeated?.(state, enemy, scenarioRuntime(state, events)))
  if (swarmHost) returnSwarmCard(state, enemy)
  const addedToVictory = !swarmHost && !replaced && addVictory(state, enemy, events)
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
  if (!enemy || enemy.global || !state.enemies.includes(enemy)) return false
  // 沉睡（enemyRule.slumbering）的敌人免疫玩家卡效果与调查员行动；剧本/遭遇来源照常，
  // 来源未知时 fail-closed。读点与「能不能打/交战」共用同一套判定。
  if (!enemyEffectAllowed(state, enemy, 'damage', { entryOf: registeredEntry, isBlanked: enemyTextBlanked, cardDef })) return false
  if (seat != null && (capabilityBlocked(state, state.investigators[seat], 'dealEnemyDamage')
    || (registeredEntry(enemy?.originalCode || enemy?.code)?.enemyRule?.bearerCannotFightDamageDefeat
      && enemy.bearerSeat === seat && !enemyTextBlanked(state, enemy)))) return false
  // Phase 5（5a-23）：02255 只能被特定来源伤害（规则表 damageOnlyFrom）。
  const damageRule = enemyRuleFlags(enemy?.code)
  if (damageRule.damageOnlyFrom && source !== damageRule.damageOnlyFrom && !enemyTextBlanked(state, enemy)) return false
  if (!enemyTextBlanked(state, enemy)
    && (entityRuleActive(state, enemy, 'cannot:beDamaged')
      || scenarioBehavior(state).enemyDamageAllowed?.(state, enemy, source, seat) === false)) return false
  return true
}

function damageEnemy(state, enemy, amount, seat, events, source = null) {
  if (!(amount > 0) || !canDamageEnemy(state, enemy, seat, source)) return false
  // 「职业杀手」：本回合该敌人下次受到的伤害 +1（一次性）。
  let total = amount + campaignState.consumeDamageBonus(enemy, state)
  const adjusted = scenarioBehavior(state).enemyDamageAmount?.(state,enemy,total,scenarioRuntime(state,events),seat,source)
  if (Number.isFinite(adjusted)) total=Math.max(0,adjusted)
  if (!total) return false
  enemy.damageTaken = (enemy.damageTaken || 0) + total
  if (source != null) enemy.lastDamageSource = source
  enemy.defeatedBy = seat
  scenarioBehavior(state).enemyDamaged?.(state, enemy, scenarioRuntime(state, events), seat, source)
  if (enemyHealth(state, enemy) != null && enemy.damageTaken >= enemyHealth(state, enemy)
    && enemyCanBeDefeated(state, enemy, source, seat)) defeatEnemy(state, enemy, events,{seat,source})
  return true
}

// 胜利点 + 独特异教徒盘问记录。

function autoEvadeEnemy(state, enemy, events, options={}) {
  const context=prepareEnemyOutcome(state,'evade',enemy,events,options)
  if(!context||context.replaced||context.cancelled)return false
  enemy.exhausted = true
  disengageEnemy(state, enemy)
  info(state, events, `💨 「${enemy.name}」被横置并脱离交战。`)
  if (registeredEntry(enemy.code)?.abilities?.some(descriptor => descriptor.trigger?.includes('evadeSuccess'))) {
    reactionWindow(state, 'evadeSuccess', { when: 'evadeSuccess', seat: enemy.bearerSeat ?? state.currentSeat,
      enemy, location: enemy.location }, events, { allowNested: true })
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
    if (rule.trigger === 'damage' || (rule.trigger === 'damageOrHorror' && damage > 0)) next.damage += rule.extra
    if (rule.trigger === 'horror' || (rule.trigger === 'damageOrHorror' && horror > 0)) next.horror += rule.extra
    if (rule.discard) {
      const index = inv.threat.indexOf(card)
      if (index >= 0) inv.threat.splice(index, 1)
      state.encounterDiscard.push(card.code)
      info(state, events, `「${cardName(card.code)}」：你额外受到 ${rule.extra} 点${rule.trigger === 'damage' ? '伤害' : '恐惧'}，然后弃掉它。`)
    } else {
      info(state, events, `「${cardName(card.code)}」：你额外受到 ${rule.extra} 点${rule.trigger === 'damage' ? '伤害' : '恐惧'}。`)
    }
  }
  return next
}

function applyHarm(state, inv, damage, horror, events, direct, attack = null, assetsFirst = false, strategy = null) {
  inv = effectRecipient(state, inv)
  // 「在你受到恐惧时，如果这些恐惧中至少有 1 点没有分配给 X，受到 1 点伤害」（03182a 丹尼尔）。
  // 在分配前记下带这条强制的支援，分配后按分配结果判定。
  const horrorOverflowAssets = (horror || 0) > 0
    ? (inv.assets || []).filter(asset => registeredEntry(asset.code)?.horrorOverflowDamage)
    : []
  const changed = scenarioBehavior(state).beforeHarm?.(state, inv,
    { damage: damage || 0, horror: horror || 0, direct: !!direct }, scenarioRuntime(state, events))
  if (changed) { damage = changed.damage; horror = changed.horror; direct = changed.direct }
  // 条目声明的威胁区强制（02221 灵魂之歌）：在战役钩子之后、分配之前追加并弃卡。
  const intercepted = applyThreatHarmInterceptors(state, inv, damage || 0, horror || 0, events)
  if (intercepted) { damage = intercepted.damage; horror = intercepted.horror }
  if (!(damage > 0 || horror > 0)) return
  // 「这次伤害/恐惧是否足以击败你」（04111 坚韧不拔）：窗口开始前写入，供反应条件读取。
  state.lastHarmContext = { seat: inv.seat, damage: damage || 0, horror: horror || 0, direct: !!direct,
    round: state.round, turnSerial: state.turnSerial ?? null }
  const harmContext = reactionWindow(state, 'harmDealt', { when: 'harmDealt', seat: inv.seat, location: inv.location,
    // 2026-10-25 第七轮修复 05032：伤害/恐惧来源标记（遭遇 / 敌人攻击 / 其它）。
    source: { kind: state._enemyAttackResolving ? 'enemyAttack' : state._treacheryResolving ? 'encounter' : 'other' },
    damage: damage || 0, horror: horror || 0, direct: !!direct, attack, prompt: `${inv.name} 将受到伤害或恐惧` }, events)
  damage = Math.max(0, harmContext.damage || 0)
  horror = Math.max(0, harmContext.horror || 0)
  if (!(damage > 0 || horror > 0)) return
  if (direct && inv.assets.some(asset => !assetPassiveData(asset.code)?.assignDirectHarm
    && ((damage > 0 && cardDef(asset.code)?.health > 0) || (horror > 0 && cardDef(asset.code)?.sanity > 0))))
    info(state, events, `本次为直接${damage > 0 && horror > 0 ? '伤害与恐惧' : damage > 0 ? '伤害' : '恐惧'}，只能由${inv.name}本人承受，不能分配给支援卡。`)
  const assignedDamage = assignHarm(state, inv, damage || 0, 'damage', events, direct, assetsFirst, strategy)
  const assignedHorror = assignHarm(state, inv, horror || 0, 'horror', events, direct, false, strategy)
  for (const [recipient, amount] of assignedDamage) {
    if (recipient === inv || amount <= 0) continue
    const context = { when: 'damageAssignedToSelf', seat: inv.seat, location: inv.location,
      assetId: recipient.id, cancelDamage: 0 }
    triggerReaction(state, inv.seat, 'damageAssignedToSelf', events, context)
    if (context.cancelDamage) assignedDamage.set(recipient, Math.max(0, amount - context.cancelDamage))
    const owner = state.investigators.find(other => other.assets.includes(recipient))
    if (owner && registeredEntry(recipient.code)?.abilities?.some(descriptor => descriptor.trigger?.includes('assetDamageAssigned'))) {
      reactionWindow(state, 'assetDamageAssigned', { when: 'assetDamageAssigned', seat: owner.seat,
        assetId: recipient.id, amount: assignedDamage.get(recipient) }, events, { allowNested: true })
    }
  }
  // "When dealt damage" reactions occur after assignment, before placement and
  // defeat. A Guard Dog can retaliate even when this attack will defeat it.
  if (attack) triggerReaction(state, inv.seat, 'enemyAttackDamage', events, {
    ...attack,
    damagedAssetIds: [...assignedDamage.keys()].filter(a => a !== inv).map(a => a.id),
  })
  for (const [kind, assignments] of [['damage', assignedDamage], ['horror', assignedHorror]]) {
    for (const [recipient, amount] of assignments) {
      if (recipient !== inv && !inv.assets.includes(recipient)) {
        const owner = state.investigators.find(other => other.assets.includes(recipient))
        if (!owner) continue
        recipient[kind] = (recipient[kind] || 0) + amount
        info(state, events, `${cardName(recipient.code)}（${owner.name}）承受 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
        continue
      }
      recipient[kind] = (recipient[kind] || 0) + amount
      if (recipient !== inv) info(state, events, `${cardName(recipient.code)} 承受 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
    }
  }
  // P6（食梦者）：支援被击败的唯一判定点（asset-defeat.js）。伤害分配、伤害移动、剧本效果
  const harmedAssets = new Set([...assignedDamage.keys(), ...assignedHorror.keys()])
  for (const source of harmedAssets) {
    if (source === inv || !registeredEntry(source.code)?.abilities?.some(descriptor => descriptor.trigger.includes('assetHarmPlaced'))) continue
    const controller = state.investigators.find(other => other.assets.includes(source))
    if (!controller) continue
    reactionWindow(state, 'assetHarmPlaced', { when: 'assetHarmPlaced', seat: controller.seat, assetId: source.id,
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
    shuffleIntoDeck: (owner, code) => {
      owner.deck = replacePlayerZoneCards(state, owner, shuffle([...owner.deck, code], () => randomValue(state)), 'shuffle')
    },
  }
  for (const owner of state.investigators) {
    for (const asset of owner.assets.slice()) {
      checkAssetDefeated(state, owner, asset, events, assetDefeatDeps)
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
  if (actualDamage > 0 || actualHorror > 0) reactionWindow(state, 'harmAssigned', {
    when: 'harmAssigned', seat: inv.seat, location: inv.location,
    damage: actualDamage, horror: actualHorror, attack,
  }, events, { allowNested: true })
  checkDefeated(state, inv.seat, events)
  if (inv.defeated || inv.resigned) return
  if ([...assignedDamage.values()].some(amount => amount > 0)) {
    triggerReaction(state, inv.seat, 'damagePlaced', events, {
      amount: [...assignedDamage.values()].reduce((total, amount) => total + amount, 0),
      damagedAssetIds: [...assignedDamage.keys()].filter(recipient => recipient !== inv).map(recipient => recipient.id),
    })
  }
  if (assignedDamage.get(inv) > 0) triggerThreatForced(state, inv, 'onDamage', events)
  if (assignedHorror.get(inv) > 0) {
    triggerReaction(state, inv.seat, 'horrorPlaced', events)
    triggerThreatForced(state, inv, 'onHorror', events)
  }
}

function defeatedAssetRetaliation(state, owner, amount, events) {
  const enemies = state.enemies.filter(enemy => enemy.location === owner.location)
  if (!enemies.length) return
  const enemyId = enemies.length === 1 ? enemies[0].id : requestChoice(state, { kind: 'target', source: 'assetDefeat', seat: owner.seat,
    prompt: `选择承受 ${amount} 点伤害的敌人。`, options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  const enemy = enemies.find(item => item.id === enemyId)
  if (!enemy) return
  info(state, events, `${owner.name} 的支援被击败，对「${enemy.name}」造成 ${amount} 点伤害。`)
  damageEnemy(state, enemy, amount, owner.seat, events)
}

function applyDamage(state, inv, amount, events, direct) {
  applyHarm(state, inv, amount, 0, events, direct)
}

function applyHorror(state, inv, amount, events, direct) {
  applyHarm(state, inv, 0, amount, events, direct)
}

  return { enemyZoneApi, enemyOutcomePublicApi, prepareEnemyOutcome, canDamageEnemy, enemyHealth, enemyFightValue, enemyEvadeValue, enemiesEngagedWith, enemyAttack, spawnEnemy, engageEnemy, disengageEnemy, defeatEnemy, damageEnemy, autoEvadeEnemy, applyHarm, defeatedAssetRetaliation, applyDamage, applyHorror }
}
