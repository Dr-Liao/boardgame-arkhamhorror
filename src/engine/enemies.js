// 敌人与伤害（applyHarm / 攻击 / 生成 / 击败 / 交战）从 engine.js 拆出的模块
// （Phase 6 · 6d-22）。
//
// 这一组是规则最「热」的底层原语：
//   applyHarm / applyDamage / applyHorror —— 一切伤害与恐惧的唯一入口（含 soaking、直接伤害、
//     反伤、击败资产）
//   enemyHealth / enemyFightValue / enemyEvadeValue —— 敌人数值读点
//   enemyAttack —— 敌人攻击流程（反应窗口、修正、结算）
//   spawnEnemy / engageEnemy / disengageEnemy / defeatEnemy / damageEnemy —— 敌人生死与交战
//
// 它们被几乎所有 do* 与剧本运行时调用，拆出来后 engine.js 只剩状态机与「动作编排」。

export function createEnemies(deps) {
  const {
    campaignState,
    entityModifierTotal,
    EFFECTS,
    PALLID_MASK_CODE,
    SMITE_THE_WICKED_CODE,
    addDoom,
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
    removeOne,
    requestChoice,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    triggerReaction,
    triggerThreatForced,
    tryAquinnahRedirect,
  } = deps

function enemyHealth(state, enemy) {
  // 印刷值 + 剧本常驻修正 + 能力层声明式修正（例如 02255 的「文本空白时按人数扣血」）。
  return enemyHealthValue(state, enemy, scenarioBehavior(state)) + enemyHealthDelta(state, enemy)
}

function enemyFightValue(state, enemy, inv) {
  let value = enemy.fight + (enemyStatMods(state).enemyFight || 0)
  value += scenarioBehavior(state).enemyStatModifier?.(state, enemy, 'fight') || 0
  // D1：敌人的战斗值修正来自它自己的卡面声明，或它所在地点的卡面声明
  // （「此处的每个蛇族敌人 +1」不再需要章节 behavior）。
  value += entityModifierTotal(state, enemy, 'enemyFight')
  const reduction = enemy.fightReduction
  if (reduction && reduction.round === state.round && reduction.phase === state.phase) value = Math.max(0, value - (reduction.amount || 0))
  return value
}

function enemyEvadeValue(state, enemy, inv) {
  let value = enemy.evade + (enemyStatMods(state).enemyEvade || 0)
  value += scenarioBehavior(state).enemyStatModifier?.(state, enemy, 'evade') || 0
  value += entityModifierTotal(state, enemy, 'enemyEvade')
  return value
}

// ---------------------------------------------------------------------------
// 槽位系统
// ---------------------------------------------------------------------------

function enemiesEngagedWith(state, inv) {
  return state.enemies.filter((e) => e.engagedSeat === inv.seat || (e.massive && !enemyTextBlanked(state, e) && e.location === inv.location))
}

// 猎物（prey）排序：数值越小越优先，便于统一计算并列集合。

function enemyAttack(state, enemy, inv, events, label, options = {}) {
  const attack = {
    kind: options.kind || 'enemy',
    source: options.source || null,
    plannedDamage: enemy.damage,
    plannedHorror: enemy.horror,
    damage: 0,
    horror: 0,
    cancelled: false,
  }
  if (!enemyTextBlanked(state, enemy) && enemy.code === 'wolfManDrew') enemy.damageTaken = Math.max(0, enemy.damageTaken - 1)
  // 「不能攻击」（失落时代 P2 通用开关，04048 守卫者）。卡牌效果造成的攻击不受此限制。
  if (attack.kind !== 'effect' && enemyCannotAttack(state, enemy)) {
    info(state, events, `⛔ 「${enemy.name}」不能攻击。`)
    attack.cancelled = true
    return false
  }
  const context = reactionWindow(state, 'enemyAttack',
    { when: 'enemyAttack', seat: inv.seat, location: inv.location, enemy, attackKind: attack.kind,
      prompt: `「${enemy.name}」攻击 ${inv.name}` }, events)
  if (context.cancelled) {
    info(state, events, `「${enemy.name}」对 ${inv.name} 的攻击被取消。`)
    attack.cancelled = true
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
  if (!inv.defeated && !tryAquinnahRedirect(state, enemy, inv, events, extraDamage, extraHorror)) {
    applyHarm(state, inv, enemy.damage + extraDamage, enemy.horror + extraHorror, events, false, { enemy, location: inv.location })
  }
  // 实际落到调查员身上的伤害/恐惧（被取消、被防止或转移时为 0）。
  attack.damage = Math.max(0, (inv.damage || 0) - damageBefore)
  attack.horror = Math.max(0, (inv.horror || 0) - horrorBefore)
  scenarioBehavior(state).enemyAttackResolved?.(state, enemy, inv, scenarioRuntime(state, events), attack)
  if (inv.defeated) checkOutcome(state, events)
  if (!enemyTextBlanked(state, enemy) && enemy.forcedDoom) {
    // "Place 1 doom on the current agenda" goes through the agenda clock, so it
    // must be able to advance the agenda immediately.
    info(state, events, `「${enemy.name}」攻击后，在密谋上放置 1 点毁灭。`)
    addDoom(state, 1, events)
  }
  return true
}

function spawnEnemy(state, code, locationId, engagedSeat, ignoreSpawn = false, temporary = false) {
  const def = enemyDef(code)
  if (!def) return null
  const override = scenarioBehavior(state).spawnOverrides?.[code]
  let loc = override && locationExists(state, override)
    ? override : !ignoreSpawn && def.spawn ? def.spawn : locationId
  if (!ignoreSpawn && scenarioBehavior(state).spawnLocation) loc = scenarioBehavior(state).spawnLocation(state, code, loc, engagedSeat, scenarioRuntime(state, []))
  if (!locationExists(state, loc)) {
    state.encounterDiscard.push(code)
    scenarioBehavior(state).spawnFailed?.(state, code, engagedSeat, scenarioRuntime(state, []))
    return null
  }
  const health = def.healthPerInvestigator
    ? def.healthPerInvestigator * state.numInvestigators
    : def.health + (def.healthPerPlayerBonus || 0) * state.numInvestigators
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
    bearerSeat: isWeaknessCode(code) || def.prey === 'bearer' ? engagedSeat : null,
    drawnBySeat: engagedSeat,
    victory: def.victory || 0, vengeance: def.vengeance || 0,
    traits: def.traits || [],
    damageTaken: 0, exhausted: false, doom: def.onSpawnDoom || 0,
    location: loc, engagedSeat: null,
  }
  if (temporary) return enemy
  state.enemies.push(enemy)
  processPlayerEnemyEntry(state, enemy, [], true)
  if (!state.enemies.includes(enemy)) return enemy
  scenarioBehavior(state).enemySpawned?.(state, enemy, scenarioRuntime(state, []))
  for (const inv of aliveInvestigators(state)) {
    if (inv.location === enemy.location) triggerReaction(state, inv.seat, 'enemySpawn', [], { enemy, location: enemy.location })
  }
  // Reaction events (e.g. Think on Your Feet) are played from hand on the same
  // window; the enemy still spawns at the original location.
  reactionWindow(state, 'enemySpawn', { when: 'enemySpawn', seat: engagedSeat ?? leadDecisionSeat(state),
    location: loc, enemy }, [])
  if (state.enemies.includes(enemy) && !enemy.exhausted && !enemy.aloof && !enemy.massive && engagedSeat != null && state.investigators[engagedSeat]?.location === loc) engageEnemy(state, enemy, engagedSeat)
  return enemy
}

// 由剧本现场生成、不在卡牌目录里的敌人（04331 纽约遗址的飞天水螅）。
// stats 提供印刷数值；extra 放实例标记（例如 underlyingCard = 被当作敌人的那张牌）。

function engageEnemy(state, enemy, seat, events = []) {
  if (enemy.engagedSeat === seat) return
  // 「潜行」等：直到你的回合结束，该敌人不能与你交战（效果体 preventEngageThisTurn 写入的标记）。
  // 到期判定沿用引擎「本回合」的统一写法：同一 round 且轮到的还是同一个座位。
  const prevented = enemy.preventEngageSeat
  if (prevented && prevented.seat === seat && prevented.round === state.round
    && prevented.turnSeat === state.currentSeat) return
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
  if (inv && state.enemies.includes(enemy)) triggerReaction(state, seat, 'enemyEngaged', events, { enemy })
  if (inv && enemy.code === 'youngDeepOne' && !enemyTextBlanked(state, enemy)) {
    info(state, events, `😱 「${enemy.name}」交战强制：${inv.name} 受到 1 点恐惧。`)
    applyHorror(state, inv, 1, events)
  }
}

function disengageEnemy(state, enemy) {
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) removeOne(inv.engaged, enemy.id)
  }
  enemy.engagedSeat = null
}

function defeatEnemy(state, enemy, events) {
  const defeatedBy = enemy.defeatedBy ?? enemy.engagedSeat
  // 「煤油」等需要知道本地点本轮是否有敌人被击败。
  const defeatedAt = state.locations.find(location => location.id === enemy.location)
  if (defeatedAt) defeatedAt.enemyDefeatedRound = state.round
  if (enemy.bindMonster) {
    state.investigators[enemy.bindMonster.ownerSeat]?.discard.push(enemy.bindMonster.code)
    delete enemy.bindMonster
  }
  removeOne(state.enemies, enemy)
  if (enemy.smiteTheWickedSeat != null) state.investigators[enemy.smiteTheWickedSeat]?.discard.push(SMITE_THE_WICKED_CODE)
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) removeOne(inv.engaged, enemy.id)
  }
  if ((registeredEntry(enemy.code)?.enemyWeakness?.shuffleIntoDeckOnDefeat
    ?? EFFECTS[enemy.code]?.enemyWeakness?.shuffleIntoDeckOnDefeat)) {
    const owner = state.investigators[enemy.bearerSeat]
    if (owner) owner.deck = shuffle([...owner.deck, enemy.code], () => randomValue(state))
    info(state, events, `「${enemy.name}」将被击败时改为洗回其承受者的牌库。`)
    return
  }
  // "When defeated" forced effects resolve before "after defeated" reactions.
  if (!enemyTextBlanked(state, enemy) && enemy.code === 'goatSpawn') {
    for (const inv of aliveInvestigators(state).filter(inv=>inv.location===enemy.location)) {
      info(state, events, `😱 「${enemy.name}」的临死反噬：${inv.name} 受到 1 点恐惧。`)
      applyHorror(state, inv, 1, events)
    }
  }
  if ((enemy.originalCode || enemy.code) === PALLID_MASK_CODE) {
    state.campaign.records.chasingTheStranger =
      Number(state.campaign.records.chasingTheStranger || 0) + 1
  }
  const replaced = scenarioBehavior(state).enemyDefeated?.(state, enemy, scenarioRuntime(state, events))
  if (!replaced) addVictory(state, enemy, events)
  // 04147 伊塔卡：敌人加入胜利区后，可横置伊塔卡治愈自己与它各 1 点恐惧。
  for (const holder of aliveInvestigators(state)) {
    // Phase 5（5a-29）：条目上的 exhaustOnEnemyDefeatedHealHorror 本身就是标记，不再写死卡号。
    const ichtaca = holder.assets.find(asset => !asset.exhausted
      && (EFFECTS[asset.code]?.exhaustOnEnemyDefeatedHealHorror
        ?? registeredEntry(asset.code)?.exhaustOnEnemyDefeatedHealHorror))
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
    triggerReaction(state, defeatedBy, 'defeatEnemy', events, { enemy, location: enemy.location })
    reactionWindow(state, 'defeatEnemy', {
      when: 'defeatEnemy', seat: defeatedBy, location: enemy.location, enemy,
      prompt: `「${enemy.name}」被击败后`,
    }, events)
  }
  checkAct(state, events)
  checkAgendaForcedEnemyDefeated(state, enemy, events)
}

function damageEnemy(state, enemy, amount, seat, events, source = null) {
  // Phase 5（5a-23）：02255 只能被特定来源伤害（规则表 damageOnlyFrom）。
  const damageRule = enemyRuleFlags(enemy?.code)
  if (!enemy || !(amount > 0)
    || (damageRule.damageOnlyFrom && source !== damageRule.damageOnlyFrom && !enemyTextBlanked(state, enemy))) return false
  if (!enemyTextBlanked(state, enemy)
    && (entityRuleActive(state, enemy, 'cannot:beDamaged')
      || scenarioBehavior(state).enemyDamageAllowed?.(state, enemy, source, seat) === false)) return false
  // 「职业杀手」：本回合该敌人下次受到的伤害 +1（一次性）。
  let total = amount + campaignState.consumeDamageBonus(enemy, state)
  // 幽嘶蛇人：每次受到攻击少受 1 点伤害（失落时代 M3 的通用减伤字段）。
  const reduction = campaignState.damageReduction(enemy)
  if (reduction) total = Math.max(0, total - reduction)
  enemy.damageTaken = (enemy.damageTaken || 0) + total
  enemy.defeatedBy = seat
  scenarioBehavior(state).enemyDamaged?.(state, enemy, scenarioRuntime(state, events))
  if (enemy.damageTaken >= enemyHealth(state, enemy)
    && enemyCanBeDefeated(state, enemy, source, seat)) defeatEnemy(state, enemy, events)
  return true
}

// 胜利点 + 独特异教徒盘问记录。

function autoEvadeEnemy(state, enemy, events) {
  enemy.exhausted = true
  disengageEnemy(state, enemy)
  info(state, events, `💨 「${enemy.name}」被横置并脱离交战。`)
}

// 冷漠（aloof）敌人不会主动与调查员交战，需由调查员主动交战或攻击。

function applyHarm(state, inv, damage, horror, events, direct, attack = null, assetsFirst = false, strategy = null) {
  const changed = scenarioBehavior(state).beforeHarm?.(state, inv,
    { damage: damage || 0, horror: horror || 0, direct: !!direct }, scenarioRuntime(state, events))
  if (changed) { damage = changed.damage; horror = changed.horror; direct = changed.direct }
  if (!(damage > 0 || horror > 0)) return
  const harmContext = reactionWindow(state, 'harmDealt', { when: 'harmDealt', seat: inv.seat, location: inv.location,
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
  for (const owner of state.investigators) {
    for (const asset of owner.assets.slice()) {
      const def = cardDef(asset.code)
      if ((def?.health > 0 && asset.damage >= def.health) || (def?.sanity > 0 && asset.horror >= def.sanity)) {
        leaveAsset(state, owner, asset)
        if (!asset.removedFromGame) owner.discard.push(asset.code)
        info(state, events, `${cardName(asset.code)} 被击败并弃置。`)
        const retaliation = EFFECTS[asset.code]?.defeatedDamage ?? registeredEntry(asset.code)?.defeatedDamage
        if (retaliation) defeatedAssetRetaliation(state, owner, retaliation, events)
      }
    }
  }
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

  return { enemyHealth, enemyFightValue, enemyEvadeValue, enemiesEngagedWith, enemyAttack, spawnEnemy, engageEnemy, disengageEnemy, defeatEnemy, damageEnemy, autoEvadeEnemy, applyHarm, defeatedAssetRetaliation, applyDamage, applyHorror }
}
