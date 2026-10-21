// card-defs.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 卡定义与实例构造：卡面视图（含声明式展示加成）、剧本常量表、卡池、
// 实例 id 生成，以及议程毁灭阈值。引擎其余部分只经这里拿卡定义。
//
// 注意：`contentRegistry` 是 `content/registered.js` 里的 `export let`（registerContentBundle
// 会重新赋值），所以**必须 import live binding**，不能从 deps 注入快照——否则大厅注册新内容后
// 这里还拿着旧对象（交接文档「依赖的四种类型」第 1 条）。
import { contentRegistry } from '../../content/registered.js'

export function createCardDefs(deps) {
  const {
    ALL_CARDS,
    ALL_ENEMIES,
    ALL_STORY_ASSETS,
    ALL_TREACHERIES,
    BASIC_WEAKNESSES,
    EFFECTS,
    INVESTIGATOR_ABILITIES,
    RANDOM_BASIC_WEAKNESS_CODE,
    campaignManifestFor,
    campaignRuleCodes,
    canSelectInvestigator,
    cardDef,
    cardIdentityFields,
    getAvailability,
    hasExplicitReactionPrompt,
    isAutomaticReward,
    isCardAvailable,
    nextInstanceId,
    playablePool,
    registeredEntry,
  } = deps

  function declarativeDisplayBonuses(modifiers) {
    const statBonus = {}
    const extraSlots = {}
    for (const modifier of modifiers || []) {
      if (modifier.condition) continue
      if (typeof modifier.target !== 'string') continue
      if (modifier.target.startsWith('skill:') && modifier.target !== 'skill:*'
        && typeof modifier.amount === 'number') {
        const skill = modifier.target.slice('skill:'.length)
        statBonus[skill] = (statBonus[skill] || 0) + modifier.amount
      }
      // Phase 2（C2）的授予槽位写法：add:slot + value = 槽位名。
      if (modifier.target === 'add:slot' && typeof modifier.value === 'string') {
        extraSlots[modifier.value] = (extraSlots[modifier.value] || 0) + (typeof modifier.amount === 'number' ? modifier.amount : 1)
      }
    }
    return {
      statBonus: Object.keys(statBonus).length ? statBonus : null,
      extraSlots: Object.keys(extraSlots).length ? extraSlots : null,
    }
  }

  function allCardDefs({ runtimeOnly = false, campaignId = null, playerCodes = null } = {}) {
    const out = {}
    const selected = playerCodes && new Set(playerCodes)
    for (const [code, c] of Object.entries(ALL_CARDS)) {
      if (runtimeOnly && !canSelectInvestigator(code) && !isCardAvailable(code)) continue
      if (selected && !selected.has(code)) continue
      const eff = EFFECTS[code]
      const availability = getAvailability(code)
      const copy = { ...c, name: c.nameZh || c.name, nameEn: c.name,
        availability: availability.availability, strictAccepted: availability.strictAccepted }
      const investigatorAbility = INVESTIGATOR_ABILITIES[code]
      const reactions = [...(eff?.reactions || []), ...(investigatorAbility?.reactions || [])]
      copy.reactionIds = reactions.map(r => r.id || code)
      if (investigatorAbility?.chaosTokenRedraw) copy.reactionIds.push('wendyRedraw')
      const descriptorEntry = registeredEntry(code)
      if (descriptorEntry?.abilities.length) copy.abilityIds = descriptorEntry.abilities.map(descriptor => descriptor.id)
      copy.hasReactionPrompt = !!(eff?.reaction || reactions.some(r => !isAutomaticReward(r)) || investigatorAbility?.chaosTokenRedraw || eff?.freeTriggers?.length
        || eff?.abilities?.some(ability => ability.cost?.action === false) || hasExplicitReactionPrompt(code)
        // Phase 5（5b-6）：迁移来的反应描述子按同一口径判断——自动奖励（无费用/无目标/无上限）不算询问。
        // Phase 6（6e-8）：快速反应事件搬成 `played` + `fast` + `trigger`，同样算「有反应提示」。
        || descriptorEntry?.abilities?.some(descriptor => descriptor.kind === 'free'
          || (descriptor.kind === 'played' && descriptor.fast && descriptor.trigger.length > 0)
          || (descriptor.kind === 'reaction'
            && !(descriptor.legacyReaction && isAutomaticReward({ effect: descriptor.effect, cost: descriptor.cost, id: descriptor.id })))))
      const entryPassive = !eff?.passive ? registeredEntry(code)?.passive : null
      if (eff && eff.passive) {
        if (eff.passive.stats) copy.statBonus = eff.passive.stats
        if (eff.passive.fightDamage) copy.fightDamageBonus = eff.passive.fightDamage
        if (eff.passive.extraSlots || eff.passive.handSlotsBonus) {
          copy.extraSlots = { ...eff.passive.extraSlots }
          if (eff.passive.handSlotsBonus) copy.extraSlots.hand = (copy.extraSlots.hand || 0) + eff.passive.handSlotsBonus
        }
      } else if (entryPassive) {
        if (entryPassive.stats) copy.statBonus = entryPassive.stats
        if (entryPassive.fightDamage) copy.fightDamageBonus = entryPassive.fightDamage
        if (entryPassive.extraSlots || entryPassive.handSlotsBonus) {
          copy.extraSlots = { ...entryPassive.extraSlots }
          if (entryPassive.handSlotsBonus) copy.extraSlots.hand = (copy.extraSlots.hand || 0) + entryPassive.handSlotsBonus
        }
      } else if (descriptorEntry?.modifiers.length) {
        // Phase 5：passive.stats 迁成 modifiers 后，图鉴字段从声明式修正反推，
        // 否则前端会丢掉 statBonus / extraSlots（§7 迁移清单第 4 条）。
        const display = declarativeDisplayBonuses(descriptorEntry.modifiers)
        if (display.statBonus) copy.statBonus = display.statBonus
        if (display.extraSlots) copy.extraSlots = display.extraSlots
      }
      out[code] = copy
    }
    const ruleCodes = campaignId ? campaignRuleCodes(campaignId)
      : [...Object.keys(ALL_ENEMIES), ...Object.keys(ALL_TREACHERIES), ...Object.keys(ALL_STORY_ASSETS)]
    for (const code of ruleCodes) {
      const def = cardDef(code)
      const catalog = ALL_CARDS[def.originalCode || code]
      out[code] = { ...def, name: def.nameZh || def.name, availability: 'strict', strictAccepted: true,
        effectStatus: catalog?.effectStatus || 'unverified', acceptanceProfile: catalog?.acceptanceProfile || null }
    }
    return out
  }

  function embeddedCardDefs(state, campaignId) {
    const codes = new Set()
    for (const inv of state.investigators || []) {
      codes.add(inv.code)
      for (const code of [...(inv.hand || []), ...(inv.deck || []), ...(inv.discard || [])]) codes.add(code)
      for (const card of [...(inv.assets || []), ...(inv.threat || [])]) {
        codes.add(card.code)
        for (const code of card.attached || []) codes.add(code)
      }
      for (const code of inv.beneath || []) codes.add(code)
    }
    for (const record of Object.values(state.campaign?.investigators || {})) {
      for (const code of record.deck || []) codes.add(code)
    }
    for (const card of state.victoryDisplay || []) codes.add(card.code)
    for (const code of [...(state.removedFromGame || []), ...(state.exiled || [])]) codes.add(code)
    return allCardDefs({ runtimeOnly: true, campaignId, playerCodes: codes })
  }

  function corePlayerPool() {
    return playablePool()
  }

  function basicWeaknessPool(state = null) {
    const core = Object.values(BASIC_WEAKNESSES)
      // Phase 5（5a-10）：「随机基础弱点」自身的卡号在卡号规则数据里，不再写进引擎。
      .filter((c) => isCardAvailable(c.code) && c.pack === 'core' && c.code !== RANDOM_BASIC_WEAKNESS_CODE)
      .map((c) => c.code)
    const packs = state?.campaign ? campaignManifestFor(state).requiredPackIds.map(id => contentRegistry.getPack(id)) : []
    const extra = packs.flatMap(pack => pack?.basicWeaknessCodes || []).filter(code => isCardAvailable(code))
    return [...new Set([...core, ...extra])]
  }

  function newCardInstance(state, code, fields = {}) {
    return { id: nextInstanceId(state, 'c'), code, ...cardIdentityFields(cardDef(code)), ...fields }
  }

  function newPlayerAssetInstance(state, inv, code, fields = {}) {
    const effect = EFFECTS[code] || {}
    const abilityEntry = registeredEntry(code)
    const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round, ...fields })
    const uses = effect.uses ?? abilityEntry?.uses
    const usesType = effect.usesType ?? abilityEntry?.usesType
    if (uses != null && asset.uses == null) {
      asset.uses = uses
      asset.usesType = usesType || 'charges'
    }
    // 「古代巨石（研究完成）」：秘密数等于剧本日志里记录的鉴定难度。
    if (effect.usesFromStoneRecord && asset.uses == null) {
      asset.uses = Math.max(0, Number(state.campaign?.records?.identifiedTheAncientStone) || 0)
      asset.usesType = effect.usesType || 'secrets'
    }
    // Phase 5（5a-7）：入场额外充能完全由调查员能力的 additionalChargeOnEnter 决定（不再写卡号）。
    const extraCharges = INVESTIGATOR_ABILITIES[inv.code]?.additionalChargeOnEnter || 0
    if (extraCharges && ['charge', 'charges'].includes(String(asset.usesType || '').toLowerCase())) {
      asset.uses = (asset.uses || 0) + extraCharges
    }
    return asset
  }

  function newEnemyId(state) { return nextInstanceId(state, 'e') }

  function resolveAgendaDoomThresholds(agendas, numInvestigators) {
    for (const agenda of agendas || []) {
      if (agenda.doomThresholdPerInvestigator != null) {
        agenda.doomThreshold = agenda.doomThresholdPerInvestigator * numInvestigators
      }
    }
  }

  return { declarativeDisplayBonuses, allCardDefs, embeddedCardDefs, corePlayerPool, basicWeaknessPool, newCardInstance, newPlayerAssetInstance, newEnemyId, resolveAgendaDoomThresholds }
}
