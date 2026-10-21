// 战斗与躲避（进战斗 / 躲敌人）从 engine.js 拆出的第三个模块（Phase 6 · 6d-3）。
//
// 这一对动作是「按域拆分」的第一个示例：roadmap 里规划的 combat/ 域。
// 两个函数都会写 state（伤害、交战、击败、移动），所以依赖清单比 describe 长得多；
// 全部通过依赖注入传入，模块本身不 import engine，保证单向依赖。
//
// 依赖清单就是契约：少一个名字会在首次进入战斗/躲避时抛 ReferenceError，
// 因此拆分的验收标准是「重放逐条一致 + 战斗/躲避相关用例全绿」。

export function createCombat(deps) {
  const {
    campaignState,
    afterEvade,
    aliveInvestigators,
    applyDamage,
    applyHarm,
    applyHorror,
    assetEffect,
    attackStyle,
    autoEvadeEnemy,
    canDisengage,
    capabilityBlocked,
    captureTableState,
    cardDef,
    cardName,
    commitProfile,
    damageEnemy,
    defeatEnemy,
    disengageEnemy,
    enemiesEngagedWith,
    enemyAttack,
    enemyCanBeDefeated,
    enemyCannotBeAttacked,
    enemyDef,
    enemyEvadeValue,
    enemyFightValue,
    enemyHealth,
    enemyRuleFlags,
    enemyStatMods,
    enemyTextBlanked,
    entityRuleActive,
    getMaxSanity,
    getStat,
    hiddenFightBlocked,
    info,
    investigatorMoveDestinations,
    leaveAsset,
    litaAuraAt,
    locName,
    locationExists,
    moveInvestigatorTo,
    payActionCost,
    performTest,
    reactionWindow,
    registeredEntry,
    relocateEnemy,
    relocateInvestigator,
    requestChoice,
    ruleIgnored,
    scenarioBehavior,
    scenarioRuntime,
    SKILL_NAMES,
    sealRevealedChaosToken,
    tokenLabel,
    triggerReaction,
  } = deps

function doFight(state, seat, opts, events, noSpend) {
  const inv = state.investigators[seat]
  // Phase 2（C1）：capability:fight。
  if (capabilityBlocked(state, inv, 'fight')) {
    info(state, events, `⛔ ${inv.name} 受当前效果影响，不能进行攻击。`)
    return
  }
  const enemy = state.enemies.find((e) => e.id === opts.enemyId)
  if (hiddenFightBlocked(state, inv, enemy)) return
  // 「不能被攻击」（失落时代 P2 通用开关，04048 守卫者；D1 起也可由敌人卡面声明）。
  if (enemy && enemyCannotBeAttacked(state, enemy)) {
    info(state, events, `⛔ 「${enemy.name}」不能被攻击。`)
    return
  }
  const invulnSource = enemyRuleFlags(enemy?.code).damageOnlyFrom
  if (invulnSource && opts.assetId !== invulnSource && !enemyTextBlanked(state, enemy)) return
  if (opts.requireNotEngagedTarget && enemy?.engagedSeat === seat) { info(state, events, '该武器不能攻击与你交战的敌人。'); return }
  if (!noSpend) payActionCost(state, inv, 'fight', events)
  if (!enemy) { info(state, events, `${inv.name} 找不到可攻击的敌人。`); return }
  if (opts.fireAxe) {
    // "Limit three times per attack" -> at most 3 resources, +2 combat each.
    const max = Math.min(inv.resources, 3)
    const spend = max ? Number(requestChoice(state, { kind: 'resource', source: opts.assetId || 'fireAxe', seat,
      prompt: '消防斧：选择为本次攻击花费的资源（每次攻击最多 3 点）。', options: Array.from({ length: max + 1 }, (_, i) => ({ id: String(i), label: `${i} 资源（战斗 +${i * 2}）` })) })) : 0
    inv.resources -= spend; opts.combatBonus = (opts.combatBonus || 0) + spend * 2
    if (inv.resources === 0) opts.damageBonus = (opts.damageBonus || 0) + 1
  }
  if (opts.maySpendActionForDamage && inv.actionsLeft > 0 && requestChoice(state, { kind: 'action', source: opts.assetId, seat,
    prompt: '是否额外花费 1 行动，使本次攻击伤害 +1？', options: [{ id: 'skip', label: '不花费' }, { id: 'spend', label: '花费 1 行动' }] }) === 'spend') {
    inv.actionsLeft--; opts.damageBonus = (opts.damageBonus || 0) + opts.maySpendActionForDamage
  }
  if (opts.additionalActionCombatBonus) {
    const maximum = inv.actionsLeft
    const extra = maximum ? Number(requestChoice(state, { kind: 'action', source: opts.assetId, seat,
      prompt: '芝加哥打字机：选择额外花费的行动数。',
      options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount} 个额外行动（战斗 +${(amount + 1) * opts.additionalActionCombatBonus}）` })) })) : 0
    inv.actionsLeft -= extra
    opts.combatBonus = (opts.combatBonus || 0) + (extra + 1) * opts.additionalActionCombatBonus
  }
  // 庞大敌人：与所在地点所有调查员交战，无需单独交战。
  // 「枪法如神」等允许攻击连接地点上的敌人。
  const here = state.locations.find(item => item.id === inv.location)
  const atConnecting = (here?.connections || []).includes(enemy.location)
  const canFight = enemy.location === inv.location || (opts.atConnectingLocation && atConnecting)
  if (!canFight) { info(state, events, `${inv.name} 找不到可攻击的交战敌人。`); return }
  const mods = enemyStatMods(state)
  const skill = opts.skill || 'combat'
  const loc = state.locations.find(item => item.id === inv.location)
  const clueCombat = opts.ifCluesAtLocationCombatBonus && loc && loc.clues > 0 ? opts.ifCluesAtLocationCombatBonus : 0
  let difficulty = enemyFightValue(state, enemy, inv)
  // 「临时武器」等：本次攻击把敌人攻击值降低。
  if (opts.enemyFightMod) difficulty = Math.max(0, difficulty + opts.enemyFightMod)
  // 「暴露弱点」：本阶段下次攻击把攻击值视为 0。
  if (enemy.exposeWeakness?.round === state.round && enemy.exposeWeakness.phase === state.phase) {
    difficulty = 0
    delete enemy.exposeWeakness
  }
  // Expose Weakness: the reduction applies to the next attack against it this phase.
  if (enemy.fightReduction && enemy.fightReduction.round === state.round && enemy.fightReduction.phase === state.phase) delete enemy.fightReduction
  const weapon = inv.assets.find(asset => asset.id === opts.assetId)
  if (weapon && (cardDef(weapon.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'firearm')) {
    const context = { when: 'activateFirearmFight', seat, location: inv.location, enemy, assetId: weapon.id,
      prompt: `${inv.name} 启动了「${cardName(weapon.code)}」的攻击能力` }
    reactionWindow(state, 'activateFirearmFight', context, events)
    opts.extraChaosChoices = context.extraChaosChoices || 0
  }
  // Phase 5（5a-20）：敌人卡面的攻击难度修正来自 ENEMY_RULE_FLAGS。
  const rangedReduction = enemyRuleFlags(enemy.code).rangedAttackDifficultyReduction || 0
  if (rangedReduction && !enemyTextBlanked(state, enemy)
    && cardDef(weapon?.code)?.traits?.some(trait => ['Ranged', 'Firearm', 'Spell'].includes(trait))) difficulty = Math.max(0, difficulty - rangedReduction)
  const weaponCode = weapon?.code || (opts.assetId && cardDef(opts.assetId) ? opts.assetId : null)
  const attackFx = { weaponCode, attackStyle: attackStyle(weaponCode && cardDef(weaponCode)) }
  // 「值得信赖」：结算宿主支援的触发能力时每项技能 +1。
  const trustedHost = inv.assets.find(item => item.id === opts.assetId)
  // Phase 5（5a-24）：同上（攻击流程里的那处）。
  const trustedBonus = (trustedHost?.attachments || [])
    .reduce((sum, entry) => sum + (registeredEntry(entry.code)?.attachedSkillBonus || 0), 0)
  return performTest(state, seat, skill, difficulty, { source: { label: '攻击', enemyId: enemy.id, name: enemy.name, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code }, baseValue: opts.baseValue,
    extraChaosChoices: opts.extraChaosChoices || 0,
    skillBonus: (opts.combatBonus || 0) + clueCombat + (opts.addSkill ? getStat(state, inv, opts.addSkill) : 0) + trustedBonus, resolve: r => {
    // Phase 5（5a-16）：敌人卡面的特殊攻击规则在 ENEMY_RULE_FLAGS 里。
    if (enemyRuleFlags(enemy.code).destroysMeleeWeapon && !enemyTextBlanked(state, enemy) && weapon && cardDef(weapon.code)?.traits?.includes('Melee')) {
      leaveAsset(state, inv, weapon, events); inv.discard.push(weapon.code)
    }
    if (opts.onChaosSymbolHorror && r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
      info(state, events, `😱 ${inv.name} 在攻击中揭示了负面符号，受到 ${opts.onChaosSymbolHorror} 点恐惧。`)
      applyHorror(state, inv, opts.onChaosSymbolHorror, events)
    }
    if (opts.stormOfSpirits && r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
      for (const investigator of aliveInvestigators(state).filter(other => other.location === enemy.location)) applyDamage(state, investigator, 1, events)
    }
    if (r.success) {
      const movedDamage = Math.min(inv.damage, r.homeFrontDamage || 0)
      if (movedDamage > 0) {
        inv.damage -= movedDamage
        info(state, events, `「${cardName(r.homeFrontCode)}」：从 ${inv.name} 身上移动 ${movedDamage} 点伤害到「${enemy.name}」。`)
        damageEnemy(state, enemy, movedDamage, inv.seat, events)
        if (!state.enemies.includes(enemy)) return
      }
      if (opts.damagePerClue) opts.damageBonus = Math.min(opts.maxDamageBonus || 3, inv.clues)
      if (opts.skullDamageBonus && r.drawn.includes('skull')) opts.damageBonus = (opts.damageBonus || 0) + opts.skullDamageBonus
      const weaponBonus = opts.successBy == null || r.value - difficulty >= opts.successBy ? opts.damageBonus || 0 : 0
      if (opts.damageOnSuccessBy != null && r.value - difficulty >= opts.damageOnSuccessBy) opts.damageBonus = (opts.damageBonus || 0) + 1
      if (opts.gainActionOnSuccessBy != null && r.value - difficulty >= opts.gainActionOnSuccessBy) {
        campaignState.grantActionGain(inv, state, opts.assetId)
      }
      const onlyEngaged = enemiesEngagedWith(state, inv)
      const conditional = opts.onlyEngagedDamage && onlyEngaged.length === 1 && onlyEngaged[0].id === enemy.id ? opts.onlyEngagedDamage : 0
      let dmg = opts.damageOverride != null
        ? Math.max(0, opts.damageOverride + (r.damageBonus || 0))
        : opts.successDamage === 'overDifficulty'
        ? Math.max(opts.minDamage || 1, Math.min(opts.maxDamage || 5, r.value - difficulty))
        : 1 + weaponBonus + conditional + (r.damageBonus || 0)
      dmg *= r.rewardMultiplier || 1
      // 「虚空碎裂」：本次攻击每揭示一个「0」标记，把它封印在卡上并额外 +1 伤害。
      // Phase 5（5c-37）：「虚空碎裂」这类「攻击时封印揭示的 0 并加伤害」由内容层声明。
      if (opts.sealZerosTo) {
        let zeros = 0
        for (const face of r.drawn || []) {
          if (face !== '0') continue
          if (sealRevealedChaosToken(state, '0', opts.sealZerosTo)) zeros += 1
        }
        if (zeros) {
          dmg += zeros
          info(state, events, `「${opts.sealZerosLabel || '虚空碎裂'}」封印了 ${zeros} 个「0」标记，本次攻击额外造成 ${zeros} 点伤害。`)
        }
      }
      const isMonster = (enemy.traits || []).some((t) => t.toLowerCase() === 'monster')
      if (isMonster && litaAuraAt(state, inv)) {
        dmg += 1
        info(state, events, `✨ 丽塔·钱德勒的激励：对怪物敌人的攻击 +1 伤害。`)
      }
      if (!enemyTextBlanked(state, enemy)
        && (entityRuleActive(state, enemy, 'cannot:beDamaged')
          || scenarioBehavior(state).enemyDamageAllowed?.(state, enemy, opts.assetId || null, seat) === false)) {
        dmg = 0
        info(state, events, `⛔ 「${enemy.name}」免疫这次攻击造成的伤害。`)
      }
      ;(state._resolution?.events || events).push({ type: 'presentation', kind: 'attack', direction: 'outgoing', seat, enemyId: enemy.id,
        assetId: opts.assetId, ...attackFx, name: enemy.name, location: enemy.location, damage: dmg, success: true,
        defeated: enemy.damageTaken + dmg >= enemyHealth(state, enemy)
          && enemyCanBeDefeated(state, enemy, opts.assetId || null, seat),
        tableState: captureTableState(state, getStat, getMaxSanity) })
      // 「特制弹药」：附属的枪械攻击怪物时 +1 伤害。
      // Phase 5（5a-29）：「特制弹药」这类附属给宿主的攻击加成由条目字段 monsterAttackDamageBonus 声明。
      const monsterBonus = (inv.assets.find(item => item.id === opts.assetId)?.attachments || [])
        .reduce((sum, entry) => sum + (registeredEntry(entry.code)?.monsterAttackDamageBonus || 0), 0)
      if (monsterBonus && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'monster')) {
        dmg += monsterBonus
        info(state, events, `「特制弹药」：攻击怪物 +${monsterBonus} 伤害。`)
      }

      if (enemyRuleFlags(enemy.code).damageOnlyFrom && opts.assetId !== enemyRuleFlags(enemy.code).damageOnlyFrom && !enemyTextBlanked(state, enemy)) return
      // 「职业杀手」：本回合该敌人下次受到的攻击伤害 +1（一次性）。
      dmg += campaignState.consumeDamageBonus(enemy, state)
      if (opts.stormOfSpirits) {
        for (const other of state.enemies.filter(item => item.location === enemy.location)) {
          damageEnemy(state, other, other.id === enemy.id ? dmg : 2, seat, events, opts.assetId || null)
        }
      } else if (opts.flamethrowerSpread) {
        // 火焰喷射器：可选择把 4 点伤害分配给所有交战敌人（简化：轮流分配）。
        const engaged = state.enemies.filter(item => item.engagedSeat === seat && !item.defeated)
        const spread = engaged.length > 1 && requestChoice(state, { kind: 'effect', source: opts.sourceCode || weaponCode, seat,
          prompt: `是否改为向 ${engaged.length} 个交战敌人分配 ${opts.flamethrowerSpread} 点伤害？`,
          options: [{ id: 'focus', label: `只对「${enemy.name}」造成 ${dmg} 点伤害` },
            { id: 'spread', label: `向所有交战敌人分配 ${opts.flamethrowerSpread} 点伤害` }] }) === 'spread'
        if (spread) {
          let remaining = opts.flamethrowerSpread
          while (remaining > 0) {
            let dealt = false
            for (const target of engaged.slice()) {
              if (remaining <= 0) break
              if (!state.enemies.includes(target)) continue
              damageEnemy(state, target, 1, seat, events, opts.assetId || null)
              remaining -= 1
              dealt = true
            }
            if (!dealt) break
          }
        } else if (state.enemies.includes(enemy)) enemy.damageTaken += dmg
      } else enemy.damageTaken += dmg
      if (!opts.stormOfSpirits) {
        scenarioBehavior(state).enemyDamaged?.(state, enemy, scenarioRuntime(state, events))
        enemy.defeatedBy = seat
      }
      // 「晕眩重击」：攻击成功时自动躲避被攻击敌人。
      for (const commitment of r.committed || []) {
        const code = typeof commitment === 'string' ? commitment : commitment.code
        if (!commitProfile(code)?.onSuccess?.autoEvadeAttackedEnemy) continue
        if (!state.enemies.includes(enemy)) continue
        enemy.exhausted = true
        disengageEnemy(state, enemy)
        info(state, events, `「${cardName(code)}」：上次攻击命中后自动躲避了「${enemy.name}」。`)
      }
      info(state, events, `⚔️ ${inv.name} 攻击成功（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}），对「${enemy.name}」造成 ${dmg} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
      scenarioBehavior(state).enemyAttackedSuccessfully?.(state, inv, enemy, scenarioRuntime(state, events))
      if (opts.defeatNonEliteOnSuccess && !enemy.elite) enemy.damageTaken = enemyHealth(state, enemy)
      if (state.enemies.includes(enemy) && enemy.damageTaken >= enemyHealth(state, enemy)
        && enemyCanBeDefeated(state, enemy, opts.assetId || null, seat)) defeatEnemy(state, enemy, events)
      if (opts.autoEvadeOnSuccessBy != null && state.enemies.includes(enemy)
        && r.value - difficulty >= opts.autoEvadeOnSuccessBy) {
        enemy.exhausted = true
        disengageEnemy(state, enemy)
        afterEvade(state, inv, enemy, events, r)
        info(state, events, `💨 ${inv.name} 以 ${opts.autoEvadeOnSuccessBy} 点以上成功，自动躲避「${enemy.name}」。`)
      }
    } else {
      ;(state._resolution?.events || events).push({ type: 'presentation', kind: 'attack', direction: 'outgoing', seat, enemyId: enemy.id,
        assetId: opts.assetId, ...attackFx, name: enemy.name, location: enemy.location, damage: 0, success: false,
        tableState: captureTableState(state, getStat, getMaxSanity) })
      info(state, events, `⚔️ ${inv.name} 攻击失败（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}，标记 ${tokenLabel(r.token)}）。`)
      const attackFail = reactionWindow(state, 'attackFail', { when: 'attackFail', seat, location: inv.location, enemy,
        failedBy: Math.max(0, difficulty - r.value), attackDamage: 1 + (opts.damageBonus || 0), redirected: false,
        prompt: `对「${enemy.name}」的攻击失败` }, events)
      // 参考 Investigator/Runner.hs：目标恰与一名其他调查员交战时，攻击者误伤该调查员 1 点。
      const engaged = state.investigators.filter(other => !other.defeated && !other.resigned
        && (other.engaged.includes(enemy.id) || (enemy.massive && other.location === enemy.location)))
      if (!attackFail.redirected && !opts.noFriendlyFire && engaged.length === 1 && engaged[0].seat !== seat) {
        const missDamage = opts.failByAmountToEngaged
          ? Math.max(1, Math.min(5, difficulty - r.value))
          : 1
        info(state, events, `${inv.name} 攻击落空，误伤 ${engaged[0].name} ${missDamage} 点。`)
        applyHarm(state, engaged[0], missDamage, 0, events)
      }
      // 反击：横置时通常不能反击，但 04062 瓦卢西亚的预示者等「横置时也能反击」的
      // 敌人（retaliateWhileExhausted）必须放行（失落时代 P2 钩子）。
      // Phase 2（C1）：ignore:retaliate 让攻击者的反击失效（卡面声明，引擎只问读点）。
      if (!opts.ignoreRetaliate && !ruleIgnored(state, inv, 'retaliate') && (enemy.retaliate || opts.grantRetaliate)
        && (!enemy.exhausted || enemy.retaliateWhileExhausted || opts.grantRetaliate)
        && !enemyTextBlanked(state, enemy)) {
        enemyAttack(state, enemy, inv, events, `⚡ 「${enemy.name}」反击 ${inv.name}：${enemy.damage} 点伤害、${enemy.horror} 点恐惧。`, { kind: 'retaliate' })
      }
    }
    if (opts.discardOnTokens?.some(token => r.drawn.includes(token)) && opts.assetId) {
      const asset = inv.assets.find(item => item.id === opts.assetId)
      if (asset) { leaveAsset(state, inv, asset); if (!asset.removedFromGame) inv.discard.push(asset.code) }
    }
  } })
}

function doEvade(state, seat, opts, events, noSpend) {
  const inv = state.investigators[seat]
  // Phase 2（C1）：capability:evade。
  if (capabilityBlocked(state, inv, 'evade')) {
    info(state, events, `⛔ ${inv.name} 受当前效果影响，不能进行躲避。`)
    return
  }
  const enemy = state.enemies.find((e) => e.id === opts.enemyId)
  if (!noSpend) payActionCost(state, inv, 'evade', events)
  if (!enemy) { info(state, events, `${inv.name} 找不到可躲避的敌人。`); return }
  const canEvade = enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location)
  if (!canEvade) { info(state, events, `${inv.name} 找不到可躲避的交战敌人。`); return }
  const mods = enemyStatMods(state)
  if (opts.auto) {
    enemy.exhausted = true
    if (canDisengage(state, inv, enemy)) disengageEnemy(state, enemy)
    else info(state, events, `${inv.name} 无法与「${enemy.name}」解除交战。`)
    info(state, events, `💨 ${inv.name} 摆脱了「${enemy.name}」！`)
    afterEvade(state, inv, enemy, events, null)
    return
  }
  const evadeSkill = opts.skill || 'agility'
  const evadeBase = Math.max(0, enemyEvadeValue(state, enemy, inv) + (opts.evadeModifier || 0))
  // 「战壕大衣」等支援在躲避尝试期间提供敏捷加值。
  const evadeAssetBonus = (inv.assets || []).reduce((sum, item) =>
    sum + (assetEffect(inv, item)?.passive?.evadeBonus || 0), 0)
  // 「值得信赖」：结算宿主支援的触发能力时每项技能 +1。
  const trustedBonus = (inv.assets.find(item => item.id === opts.assetId)?.attachments || [])
    .reduce((sum, entry) => sum + (registeredEntry(entry.code)?.attachedSkillBonus || 0), 0)
  // 效果来源卡号：支援能力（assetId）或事件/卡面传入的 sourceCode（effects.js 透传 effect.code）。
  const evadeSourceCode = inv.assets.find(asset => asset.id === opts.assetId)?.code || opts.sourceCode || null
  return performTest(state, seat, evadeSkill, evadeBase, { source: { label: '躲避', enemyId: enemy.id, name: enemy.name, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code }, baseValue: opts.baseValue,
    skillBonus: (opts.bonus || 0) + evadeAssetBonus + trustedBonus + (opts.addSkill ? getStat(state, inv, opts.addSkill) : 0),
    doubleNegative: Boolean(enemyRuleFlags(enemy.code).doubleNegative || enemyRuleFlags(enemy.ruleId).doubleNegative) && !enemyTextBlanked(state, enemy), resolve: r => {
    if (opts.symbolActionLoss && r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
      inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
      info(state, events, `🌀 ${inv.name} 在躲避中揭示负面符号，本回合失去 1 个行动。`)
    }
    if (opts.onChaosSymbolHorror && r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
      info(state, events, `😱 ${inv.name} 受到 ${opts.onChaosSymbolHorror} 点恐惧。`)
      applyHorror(state, inv, opts.onChaosSymbolHorror, events)
    }
    if (opts.suggestionAssetId && r.value - evadeBase < 2) {
      const suggestion = inv.assets.find(item => item.id === opts.suggestionAssetId)
      if (suggestion) suggestion.uses = Math.max(0, (suggestion.uses || 0) - 1)
    }
    if (r.success) {
      enemy.exhausted = !opts.noExhaustOnSuccess
      if (canDisengage(state, inv, enemy)) disengageEnemy(state, enemy)
      else info(state, events, `${inv.name} 无法与「${enemy.name}」解除交战。`)
      // 「职业杀手」：躲避成功后该敌人本回合下次受伤 +1。
      for (const commitment of r.committed || []) {
        const code = typeof commitment === 'string' ? commitment : commitment.code
        const bonus = commitProfile(code)?.onEvadeSuccess?.damageBonusNext
        if (bonus && state.enemies.includes(enemy)) campaignState.setDamageBonus(enemy, state, bonus)
      }
      if (opts.preventEngageThisTurn) enemy.preventEngageSeat = { seat, round: state.round, turnSeat: state.currentSeat }
      if (opts.evadeOthersOnSuccess) for (const other of state.enemies.filter(item => item.engagedSeat === seat)) autoEvadeEnemy(state, other, events)
      // 「悄然遁去」等：该敌人在下个补给阶段不重整。
      if (opts.skipReadyRounds) enemy.preventReady = { rounds: opts.skipReadyRounds, from: state.round }
      // 「拉莱耶迷雾」等：躲避后可以移动到连接地点。
      if (opts.moveAfterEvade) {
        const destinations = investigatorMoveDestinations(state, seat, {})
        if (destinations.length) {
          const answer = requestChoice(state, { kind: 'move', source: evadeSourceCode, seat, canSkip: true,
            prompt: '是否移动到连接地点？',
            options: [{ id: 'skip', label: '留在原地' }, ...destinations.map(id => ({ id, label: locName(state, id) }))] })
          if (answer !== 'skip') relocateInvestigator(state, seat, answer, events)
        }
      }
      // 「潜行」等：成功但不横置敌人时，日志不能写成"被横置"。
      const exhaustText = opts.noExhaustOnSuccess ? '' : '被横置并'
      info(state, events, `💨 ${inv.name} 躲避成功（${SKILL_NAMES[evadeSkill]} ${r.value} vs ${evadeBase}），「${enemy.name}」${exhaustText}脱离交战。`)
      triggerReaction(state, seat, 'evadeSuccess', events, { enemy, location: inv.location })
      reactionWindow(state, 'evadeSuccess', {
        when: 'evadeSuccess', seat, location: inv.location, enemy,
        prompt: `「${enemy.name}」被躲避后`,
      }, events)
      if (opts.damageOnSuccess && state.enemies.includes(enemy)) {
        enemy.defeatedBy = seat
        damageEnemy(state, enemy, opts.damageOnSuccess, seat, events)
        info(state, events, `💥 「${enemy.name}」被躲避后受到 ${opts.damageOnSuccess} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
      }
      afterEvade(state, inv, enemy, events, r)
      if (opts.moveEnemyOnSuccess && !enemy.elite) {
        const current = state.locations.find(loc => loc.id === enemy.location)
        const destinations = (current?.connections || []).filter(id => locationExists(state, id))
        if (destinations.length) {
          const id = destinations.length === 1 ? destinations[0] : requestChoice(state, { kind: 'move', source: evadeSourceCode, seat,
            prompt: '选择诱饵与换位将敌人移动到的连接地点。', options: destinations.map(id => ({ id, label: locName(state, id) })) })
          relocateEnemy(state, enemy, id, events)
        }
      }
      const disengage = r.evadeDisengage && inv.engaged.length && requestChoice(state, {
        kind: 'reaction', source: 'survivalInstinct', seat, canSkip: true, prompt: '是否躲避所有其他交战敌人？',
        options: [{ id: 'skip', label: '保持交战' }, { id: 'trigger', label: '躲避所有其他敌人' }],
      }) === 'trigger'
      if (disengage) {
        for (const eid of inv.engaged.slice()) {
          const e = state.enemies.find((x) => x.id === eid)
          if (e) autoEvadeEnemy(state, e, events)
        }
        info(state, events, `💨 ${inv.name} 的「求生本能」：躲避所有其他交战敌人。`)
      }
      if (r.mayMoveAfterEvade && investigatorMoveDestinations(state, seat, {}).length && requestChoice(state, {
        kind: 'reaction', source: 'survivalInstinctMove', seat, canSkip: true, prompt: '是否移动到相连地点？',
        options: [{ id: 'skip', label: '留在此处' }, { id: 'trigger', label: '移动' }],
      }) === 'trigger') moveInvestigatorTo(state, seat, { source: 'survivalInstinct', keepEngaged: !disengage }, events)
    } else {
      info(state, events, `💨 ${inv.name} 躲避失败（${SKILL_NAMES[evadeSkill]} ${r.value} vs ${evadeBase}，标记 ${tokenLabel(r.token)}）。`)
      // 「狗屎运」：躲避失败且低于难度 2 点及以内时可以打出。
      reactionWindow(state, 'evadeFail', { when: 'evadeFail', seat, location: inv.location, enemy,
        failedBy: Math.max(0, evadeBase - r.value), prompt: `躲避「${enemy.name}」失败` }, events)
      // Phase 2（C1）：ignore:alert 让躲避失败时的警戒反击失效。
      if (enemy.alert && !ruleIgnored(state, inv, 'alert') && !enemy.exhausted && !enemyTextBlanked(state, enemy)) {
        enemyAttack(state, enemy, inv, events, `⚡ 「${enemy.name}」警戒反击 ${inv.name}。`, { kind: 'alert' })
      }
    }
    // 「临时路障」：从弃牌堆打出时，可以再自动躲避一个躲避值不超过成功点数的敌人。
    if (r.success && opts.evadeSecondUpTo != null) {
      const successBy = Math.max(0, r.value - evadeBase)
      const extra = state.enemies.filter(other => other.id !== enemy.id && other.location === inv.location
        && enemyEvadeValue(state, other, inv) <= Math.min(successBy, opts.evadeSecondUpTo))
      if (extra.length) {
        const chosen = extra.length === 1 ? extra[0].id : requestChoice(state, { kind: 'target', source: evadeSourceCode, seat,
          prompt: `再躲避一个躲避值不超过 ${successBy} 的敌人。`, options: extra.map(other => ({ id: other.id, label: other.name })) })
        const second = extra.find(item => item.id === chosen)
        if (second) {
          autoEvadeEnemy(state, second, events)
          info(state, events, `💨 「${cardName(opts.sourceCode || evadeSourceCode)}」额外躲避了「${second.name}」。`)
        }
      }
    }
  } })
}

// 躲避后的强制（露丝·特纳：躲避成功加入胜利区）。

  return { doFight, doEvade }
}
