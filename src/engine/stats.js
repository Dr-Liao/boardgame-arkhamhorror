// stats.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 属性与「卡面给什么」的读点：技能值、图标、特质/关键词、手牌位与行动数、
// 生命力/神智上限，以及 assetEffect（旧 passive + 条目字段 + 描述子 shim 的合并结果）。
export function createStats(deps) {
  const {
    CLASS_NAMES,
    EFFECTS,
    HAND_SIZE_BASE,
    INVESTIGATOR_ABILITIES,
    LOLA_ROLES,
    abilityShim,
    agendaHandSizePenalty,
    applyFreeTriggers,
    assetPassiveBonus,
    blanksTraits,
    cardDef,
    collectGrants,
    doAbility,
    doPlay,
    getThreatEffect,
    isCardAvailable,
    legalMoves,
    playFlag,
    playerWindow,
    registeredEntry,
    requestChoice,
    scenarioBehavior,
    statPipeline,
  } = deps

  function assetEffect(inv, asset) {
    // Phase 5（5a-20）：「毒蛇灾厄」清空某类特长卡的文字——规则数据在 BLANKS_TRAITS 里。
    const blankedTraits = (inv.threat || []).flatMap(item => blanksTraits(item.code))
    if (blankedTraits.length
      && (cardDef(asset?.code)?.traits || []).some(trait => blankedTraits.includes(String(trait).toLowerCase()))) return {}
    // 「毒蛇灾厄」（04099）：非弱点道具的文字视为空白。
    if (inv.threat?.some(item => item.blankItemAssets) && (cardDef(asset?.code)?.traits || []).includes('Item')) return {}
    const legacy = EFFECTS[asset?.code]
    // Phase 5（D2）：使用次数元数据（uses / usesType / discardWhenEmpty）可以整组搬到
    // 注册表条目上；这里与描述子一起合并，读点（补充弹药、充能耗尽、界面文字）不需要
    // 知道自己拿到的是旧 DSL 还是新条目。
    const entry = registeredEntry(asset?.code)
    const meta = entry
      ? {
          ...(entry.uses != null ? { uses: entry.uses } : {}),
          ...(entry.usesType ? { usesType: entry.usesType } : {}),
          ...(entry.discardWhenEmpty ? { discardWhenEmpty: true } : {}),
          // Phase 6（6e-14）：入场放毁灭 / 回合结束弃置自己（读点：doPlay 入场段、回合结束扫描）。
          ...(entry.onPlayDoom != null ? { onPlayDoom: entry.onPlayDoom } : {}),
          ...(entry.discardAtRoundEnd ? { discardAtRoundEnd: true } : {}),
          // Phase 5（5b-7）：「沉静」关键字（非直接恐惧必须先分给该支援）。
          ...(entry.composure ? { composure: true } : {}),
          // Phase 5（5b-11）：击败敌人后横置治愈恐惧。
          ...(entry.exhaustOnEnemyDefeatedHealHorror != null
            ? { exhaustOnEnemyDefeatedHealHorror: entry.exhaustOnEnemyDefeatedHealHorror } : {}),
          // Phase 5（5b-10）：封印与附属声明。
          ...(entry.sealOnEnter ? { sealOnEnter: entry.sealOnEnter } : {}),
          ...(entry.substituteSealedElderSign ? { substituteSealedElderSign: true } : {}),
          ...(entry.attachTo ? { attachTo: entry.attachTo } : {}),
          ...(entry.onAttach ? { onAttach: entry.onAttach } : {}),
          // Phase 5（5b-9）：规则性字段（自愈 / 维护付费 / 被击败反伤 / 恐惧转移 / 不可离场）。
          ...(entry.healSelfHorrorAfterTurn != null ? { healSelfHorrorAfterTurn: entry.healSelfHorrorAfterTurn } : {}),
          ...(entry.forcedUpkeepPayOrDiscard != null ? { forcedUpkeepPayOrDiscard: entry.forcedUpkeepPayOrDiscard } : {}),
          ...(entry.defeatedDamage != null ? { defeatedDamage: entry.defeatedDamage } : {}),
          ...(entry.redirectOneHorrorToSelf ? { redirectOneHorrorToSelf: true } : {}),
          ...(entry.cannotLeavePlay ? { cannotLeavePlay: true } : {}),
          // Phase 5（5b-8）：神话阶段结束时弃掉这张支援（戴红手套的男子）。
          ...(entry.forcedMythosEndDiscard ? { forcedMythosEndDiscard: true } : {}),
          // Phase 5（5b-8）：资产卡面关键字（不引发借机攻击 / 快速）也在条目上。
          ...(entry.noOpportunityAttack ? { noOpportunityAttack: true } : {}),
          ...(entry.fast ? { fast: true } : {}),
          // Phase 5（5b-6d）：被动数据体（stats / handSizeBonus / sanityBonus …）。
          ...(entry.passive ? { passive: entry.passive } : {}),
        }
      : null
    // 能力层：声明式描述子折叠成旧式 ability 形状，使 legalMoves / 牌桌按钮 /
    // doAbility / playerWindow 不需要为能力层写第二套枚举。
    const shim = abilityShim(asset?.code)
    // Phase 5（5b-7）：`freeTriggers`（天赋牌「花资源提升检定」）也可以整组搬到注册表条目上。
    // 读点是 applyFreeTriggers，它拿到的就是这里的合并结果。
    const entryTriggers = entry?.freeTriggers?.length
      ? {
          freeTriggers: [...(legacy?.freeTriggers || []), ...entry.freeTriggers],
          ...(entry.minimumHandForBoost != null ? { minimumHandForBoost: entry.minimumHandForBoost } : {}),
        }
      : null
    if (!shim.length && !meta && !entryTriggers) return legacy
    return {
      ...(legacy || {}),
      ...(meta || {}),
      ...(entryTriggers || {}),
      ...(shim.length ? { abilities: [...(legacy?.abilities || []), ...shim] } : {}),
    }
  }

  function controlledAbilityCards(inv) { return [...inv.assets, ...(inv.threat || [])] }

  function controlledAbilityCard(inv, id) { return controlledAbilityCards(inv).find(card => card.id === id) }

  function lolaCanUseCard(inv, code) {
    // Phase 5（5a-33）：只有「用角色限制卡牌」的调查员走这套校验。
    if (!INVESTIGATOR_ABILITIES[inv.code]?.deckbuildingRoles) return true
    const def = cardDef(code)
    const factions = def?.factions || [def?.klass, def?.klass2, def?.klass3].filter(Boolean)
    return factions.includes('neutral') || factions.includes(inv.role)
  }

  function chooseLolaRole(state, inv, source, prompt, allowSame = false) {
    const roles = LOLA_ROLES.filter(role => allowSame || role !== inv.role)
    const role = requestChoice(state, { kind: 'role', source, seat: inv.seat, prompt,
      options: roles.map(id => ({ id, label: CLASS_NAMES[id] || id })) })
    inv.role = role
    return role
  }

  function runtimeCardAvailable(state, inv, code) {
    const signatures = cardDef(code)?.signatureFor || []
    return isCardAvailable(code) || signatures.includes(inv.code)
      || scenarioBehavior(state).canPlayScenarioCard?.(state, inv, code) === true
  }

  function getStat(state, inv, skill, skipSubstitute) {
    let v = inv[skill] || 0
    if (inv.handlingEncounter?.bonus) v += inv.handlingEncounter.bonus
    // 修正管线（modifiers.js）：声明式修正 + 旧式 passive 字段的桥接。
    // 迁移完成的卡牌分支已从引擎删除，新的修正请写在 card-abilities.js 的 modifiers 里。
    const { delta, floor } = statPipeline(state, inv, skill)
    v += delta
    if (floor != null) v = Math.max(v, floor)
    v += scenarioBehavior(state).statModifier?.(state, inv, skill) || 0
    const substitute = inv.skillSubstitute
    if (!skipSubstitute && substitute && substitute.round === state.round
        && substitute.from.includes(skill) && substitute.to !== skill) {
      v = Math.max(v, getStat(state, inv, substitute.to, true))
    }
    return v
  }

  function getMaxHealth(inv) {
    // 威胁区的生命值修正（04085 伊格的诅咒 -1 生命）与支援被动一起结算。
    return Math.max(0, inv.maxHealth + assetPassiveBonus(inv, 'healthBonus')
      + inv.threat.reduce((sum, card) => sum + (getThreatEffect(card)?.healthModifier || 0), 0))
  }

  function getMaxSanity(inv) {
    return Math.max(0, inv.maxSanity + assetPassiveBonus(inv, 'sanityBonus')
      + (inv.assets || []).reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0)
      + inv.threat.reduce((sum, card) => sum + (getThreatEffect(card)?.sanityModifier || 0), 0))
  }

  function extraActionBonus(inv) {
    return (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.extraAction || 0), 0)
  }

  function exploreOnlyActionBonus(inv) {
    return (inv.assets || []).reduce((sum, asset) =>
      sum + (assetEffect(inv, asset)?.passive?.extraActionExploreOnly || 0), 0)
  }

  function normalActionsLeft(inv) {
    return Math.max(0, (inv.actionsLeft || 0) - (inv.exploreOnlyActions || 0))
  }

  function investigateBonus(inv) {
    return (inv.assets || []).reduce((sum, asset) => {
      const passive = assetEffect(inv, asset)?.passive
      return sum + (passive?.investigateBonus || 0) + (inv.clues === 0 ? passive?.investigateBonusIfNoClues || 0 : 0)
    }, 0)
  }

  function handSize(state, inv) {
    let v = HAND_SIZE_BASE + (scenarioBehavior(state).handSizeModifier?.(state, inv) || 0)
    // Phase 5（5a-4）：议程的手牌上限惩罚在内容层数据里。
    if (state.phase === 'upkeep') v -= agendaHandSizePenalty(state.agendas[state.agendaIndex]?.originalCode)
    for (const a of inv.assets) {
      const eff = assetEffect(inv, a)
      if (eff && eff.passive && eff.passive.handSizeBonus) v += eff.passive.handSizeBonus
    }
    for (const card of inv.threat) v += getThreatEffect(card)?.handSizeModifier || 0
    return Math.max(0, v)
  }

  function getHandSize(state, inv) { return handSize(state, inv) }

  function cardPlayFlag(code, flag) {
    return playFlag(code, flag)
  }

  function iconValue(code, skill) {
    const c = cardDef(code)
    if (!c || !c.icons) return 0
    return (c.icons[skill] || 0) + (c.icons.wild || 0)
  }

  function effectiveTraits(state, inv, code) {
    const base = (cardDef(code)?.traits || []).map(trait => String(trait))
    if (!state || !inv) return base
    const granted = [...collectGrants(state, inv, 'trait', { code })]
    if (!granted.length) return base
    const seen = new Set(base.map(trait => trait.toLowerCase()))
    for (const trait of granted) if (!seen.has(trait.toLowerCase())) { base.push(trait); seen.add(trait.toLowerCase()) }
    return base
  }

  function cardHasTrait(state, inv, code, trait) {
    const wanted = String(trait).toLowerCase()
    return effectiveTraits(state, inv, code).some(item => String(item).toLowerCase() === wanted)
  }

  function cardKeyword(state, inv, code, keyword) {
    if (!state || !inv) return false
    return collectGrants(state, inv, 'keyword', { code }).has(keyword)
  }

  function commitIcons(state, inv, code, skill) {
    const base = iconValue(code, skill)
    if (!state || !inv) return base
    return base + (collectGrants(state, inv, 'skillIcon', { code }).has(skill) ? 1 : 0)
  }

  function enemyStatMods(state) {
    const ag = state.agendas[state.agendaIndex]
    return (ag && ag.passive) || {}
  }

  return { assetEffect, controlledAbilityCards, controlledAbilityCard, lolaCanUseCard, chooseLolaRole, runtimeCardAvailable, getStat, getMaxHealth, getMaxSanity, extraActionBonus, exploreOnlyActionBonus, normalActionsLeft, investigateBonus, handSize, getHandSize, cardPlayFlag, iconValue, effectiveTraits, cardHasTrait, cardKeyword, commitIcons, enemyStatMods }
}
