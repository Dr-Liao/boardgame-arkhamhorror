import { investigatorRule } from '../cards/card-rules.js'
import { describeLimitShort, limitUsed } from './limits.js'
import { totalDoom } from './rules-state.js'
// stats.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 属性与「卡面给什么」的读点：技能值、图标、特质/关键词、手牌位与行动数、
// 生命力/神智上限，以及 assetEffect（旧 passive + 条目字段 + 描述子 shim 的合并结果）。
export function createStats(deps) {
  const {
    CLASS_NAMES,
    EFFECTS,
    HAND_SIZE_BASE,
    LOLA_ROLES,
    abilityShim,
    agendaHandSizePenalty,
    applyFreeTriggers,
    assetPassiveBonus,
    blanksTraits,
    cardDef,
    cardName,
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
    // Phase 5（D2）：使用次数元数据（uses / usesType / discardWhenEmpty）可以整组搬到
    // 注册表条目上；这里与描述子一起合并，读点（补充弹药、充能耗尽、界面文字）不需要
    // 知道自己拿到的是旧 DSL 还是新条目。
    const legacy = null
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
    if (!investigatorRule(inv.code)?.deckbuildingRoles) return true
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

  // 2026-10-25 第五轮修复（05281）：「把某项基础技能值设为 X」的临时覆盖（替换印刷基值，再走修正管线）。
  function runtimeBaseStat(state, inv, skill) {
    const entries = inv.statOverrides?.[skill]
    if (!Array.isArray(entries) || !entries.length) return null
    const active = entries.filter(entry => {
      if (entry.round != null && entry.round !== state.round) return false
      if (entry.turnSerial != null && entry.turnSerial !== state.turnSerial) return false
      if (entry.phase != null && entry.phase !== state.phase) return false
      return true
    })
    return active.length ? active[active.length - 1].value : null
  }

  function getStat(state, inv, skill, skipSubstitute) {
    let v = inv[skill] || 0
    const baseOverride = runtimeBaseStat(state, inv, skill)
    if (baseOverride != null) v = baseOverride
    if (inv.handlingEncounter?.bonus) v += inv.handlingEncounter.bonus
    // 修正管线（modifiers.js）：声明式修正 + 旧式 passive 字段的桥接。
    // 迁移完成的卡牌分支已从引擎删除，新的修正请写在 src/cards/entries/<code>.js 的 modifiers 里。
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

  // 2026-10-25 第五轮修复 05281（交叉复核）：只取「印刷基值 + 临时基值覆盖」，不叠任何修正。
  // 用于「倍化基础技能值」类地点规则（03213/03130/03132）等直接读基值的路径。
  function baseStatValue(state, inv, skill) {
    const runtime = runtimeBaseStat(state, inv, skill)
    return runtime != null ? runtime : (inv[skill] || 0)
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

  // 第 2 步 P2.5：skill 可以是单个技能名，也可以是技能数组（阵法/合成检定）。
  // 数组时把每个技能的图标相加，万能图标只算一次（不能按技能数重复计入）。
  function iconsValue(icons, skill) {
    if (!icons) return 0
    const list = Array.isArray(skill) ? skill : [skill]
    let total = icons.wild || 0
    for (const name of list) total += icons[name] || 0
    return total
  }

  function iconValue(code, skill) {
    const c = cardDef(code)
    if (!c || !c.icons) return 0
    return iconsValue(c.icons, skill)
  }

  // 第 5 步 P7：条件技能图标（05022/05026/05030/05034/05038）。
  // 数据格式：commit 描述子的 `skill.conditionalIcons: [{ when, icons }]`。
  // 按数组顺序取**最后一个条件成立的条目**，把它的图标叠加到印刷图标上——卡面的
  // 「改为获得…」用后一条（更严格条件）覆盖前一条表达，不需要额外的覆盖/组语义。
  const COMMIT_ICON_CONDITIONS = Object.freeze({
    remainingHealthSanityAtLeast: (state, inv, value) =>
      getMaxHealth(inv) - (inv.damage || 0) + getMaxSanity(inv) - (inv.horror || 0) >= Number(value),
    handAtLeast: (state, inv, value) => (inv.hand || []).length >= Number(value),
    resourcesAtLeast: (state, inv, value) => (inv.resources || 0) >= Number(value),
    doomAtLeast: (state, inv, value) => totalDoom(state) >= Number(value),
    controlledTraitAtMost: (state, inv, value) => {
      const trait = String(value?.trait || '').toLowerCase()
      if (!trait) return false
      const count = (inv.assets || []).filter(asset =>
        (cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === trait)).length
      return count <= Number(value?.count ?? 0)
    },
  })

  function conditionalCommitIcons(state, inv, code, skill) {
    const entry = registeredEntry(code)
    const profile = (entry?.abilities || []).find(ability => ability.kind === 'commit')?.skill
    const list = profile?.conditionalIcons
    if (!Array.isArray(list) || !list.length) return 0
    let matched = null
    for (const item of list) {
      const when = item?.when
      if (!when || typeof when !== 'object') continue
      const ok = Object.entries(when).every(([key, value]) => {
        const check = COMMIT_ICON_CONDITIONS[key]
        return typeof check === 'function' ? check(state, inv, value) : false
      })
      if (ok) matched = item
    }
    return matched ? iconsValue(matched.icons, skill) : 0
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
    const granted = collectGrants(state, inv, 'skillIcon', { code })
    const wanted = Array.isArray(skill) ? skill : [skill]
    return base + (wanted.some(name => granted.has(name)) ? 1 : 0) + conditionalCommitIcons(state, inv, code, skill)
  }

  function enemyStatMods(state) {
    const ag = state.agendas[state.agendaIndex]
    return (ag && ag.passive) || {}
  }

  // 能力上限的使用情况（上限账本的展示侧）。
  // 只回答「这条能力现在还剩几次」——费用、目标、时机由 legalMoves 决定，这里不重复判定。
  // 读点：limitUsed 与 legalMoves / validateMove / 结算共用同一份 state.abilityLimits。
  // 只投影不依赖调用上下文的 scope：perWindow/perAttack/perSearch/perAction 的账键里带
  // 窗口/攻击/搜索/行动标识，这里拿不到，硬算会把「用过」误报成「没用过」。
  const USAGE_SCOPES = new Set(['perTest', 'perTurn', 'perPhase', 'perRound', 'perGame', 'perCampaign'])

  function abilityUsage(state, inv) {
    if (!state || !inv || !Array.isArray(inv.assets)) return []
    const cards = []
    for (const card of controlledAbilityCards(inv)) {
      if (!card?.id) continue
      const abilities = assetEffect(inv, card)?.abilities
      if (!Array.isArray(abilities)) continue
      const limited = []
      abilities.forEach((ability, index) => {
        const descriptor = ability?.descriptor
        const limit = descriptor?.limit
        if (!limit || !USAGE_SCOPES.has(limit.scope)) return
        limited.push({
          index,
          label: ability.label || descriptor.label || `能力 ${index + 1}`,
          scope: limit.scope,
          limitText: describeLimitShort(descriptor),
          used: limitUsed(state, inv, descriptor, null, null, card),
        })
      })
      if (!limited.length) continue
      cards.push({
        assetId: card.id,
        code: card.code,
        name: cardName(card.code),
        used: limited.some(item => item.used),
        abilities: limited,
      })
    }
    return cards
  }

  return { assetEffect, controlledAbilityCards, controlledAbilityCard, lolaCanUseCard, chooseLolaRole, runtimeCardAvailable, getStat, baseStatValue, getMaxHealth, getMaxSanity, extraActionBonus, exploreOnlyActionBonus, normalActionsLeft, investigateBonus, handSize, getHandSize, cardPlayFlag, iconValue, effectiveTraits, cardHasTrait, cardKeyword, commitIcons, enemyStatMods, abilityUsage }
}
