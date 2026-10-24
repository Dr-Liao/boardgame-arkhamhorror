// card-defs.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 卡定义与实例构造：卡面视图（含声明式展示加成）、剧本常量表、卡池、
// 实例 id 生成，以及议程毁灭阈值。引擎其余部分只经这里拿卡定义。
//
// 注意：`contentRegistry` 是 `content/registered.js` 里的 `export let`（registerContentBundle
// 会重新赋值），所以**必须 import live binding**，不能从 deps 注入快照——否则大厅注册新内容后
// 这里还拿着旧对象（交接文档「依赖的四种类型」第 1 条）。
import { investigatorRule } from '../cards/card-rules.js'
import { contentRegistry } from '../../content/registered.js'
import { allowsCard, cardPoolContext } from '../deck/card-pool.js'

export function createCardDefs(deps) {
  const {
    ALL_CARDS,
    ALL_ENEMIES,
    ALL_STORY_ASSETS,
    ALL_TREACHERIES,
    BASIC_WEAKNESSES,
    EFFECTS,
    RANDOM_BASIC_WEAKNESS_CODE,
    campaignManifestFor,
    campaignRuleCodes,
    canSelectInvestigator,
    cardDef,
    cardIdentityFields,
    expandedPlayablePool,
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

  // 「卡面是否需要快速反应开关」的统一口径：旧 DSL（EFFECTS）与迁移后的条目/描述子一起看。
  // 只有会让玩家做选择的窗口才需要开关（reaction / playerWindow / boost 三类）；
  // 自动领取的资源奖励不打扰玩家。两个出卡分支（目录卡 / 规则卡）共用同一份判定。
  function hasReactionPromptFor(code, eff = null, descriptorEntry = registeredEntry(code)) {
    const reactions = [...(eff?.reactions || []), ...(investigatorRule(code)?.reactions || [])]
    const descriptorAbilities = descriptorEntry?.abilities || []
    // 迁移后「天赋自动投入档位」（freeTriggers，boost 询问）与「免费能力」（cost.action === false，
    // playerWindow 询问）都住在条目上：判定必须同时看旧 DSL 与描述子。只看 EFFECTS 会让
    // 01017 体能训练这类天赋牌、01018 巡警这类免费能力丢掉卡面「快速反应」开关，
    // 而那个开关是「本局不再询问」之后重新打开提示的唯一入口。
    const freeTriggerPrompt = !!(eff?.freeTriggers?.length || descriptorEntry?.freeTriggers?.length)
    const freeAbilityPrompt = !!(eff?.abilities?.some(ability => ability.cost?.action === false)
      || descriptorAbilities.some(descriptor => descriptor.kind === 'free' || descriptor.cost?.action === false))
    return !!(eff?.reaction || reactions.some(r => !isAutomaticReward(r))
      || investigatorRule(code)?.chaosTokenRedraw || freeTriggerPrompt || freeAbilityPrompt || hasExplicitReactionPrompt(code)
      // Phase 5（5b-6）：迁移来的反应描述子按同一口径判断——自动奖励（无费用/无目标/无上限）不算询问。
      // Phase 6（6e-8）：快速反应事件搬成 `played` + `fast` + `trigger`，同样算「有反应提示」。
      || descriptorAbilities.some(descriptor =>
        (descriptor.kind === 'played' && descriptor.fast && descriptor.trigger.length > 0)
        || (descriptor.kind === 'reaction'
          && !(descriptor.legacyReaction && isAutomaticReward({ effect: descriptor.effect, cost: descriptor.cost, id: descriptor.id })))))
  }

  function allCardDefs({ runtimeOnly = false, campaignId = null, playerCodes = null } = {}) {
    const out = {}
    const selected = playerCodes && new Set(playerCodes)
    for (const [code, c] of Object.entries(ALL_CARDS)) {
      // 传入具体卡号集合时，它就是「本局嵌入了哪些卡」的唯一口径：这些卡已经在手牌、牌组或场上，
      // 即使目录可用性是 catalog-only（如 02040 亨利·阿米蒂奇博士这类剧情奖赏卡），也必须带
      // hasReactionPrompt / reactionIds 进 state.cards；否则卡面的「快速反应」开关会凭空消失。
      if (selected ? !selected.has(code) : runtimeOnly && !canSelectInvestigator(code) && !isCardAvailable(code)) continue
      const eff = null
      const availability = getAvailability(code)
      const copy = { ...c, name: c.nameZh || c.name, nameEn: c.name,
        availability: availability.availability, strictAccepted: availability.strictAccepted }
      const investigatorAbility = investigatorRule(code)
      const reactions = [...(eff?.reactions || []), ...(investigatorAbility?.reactions || [])]
      copy.reactionIds = reactions.map(r => r.id || code)
      if (investigatorAbility?.chaosTokenRedraw) copy.reactionIds.push('wendyRedraw')
      const descriptorEntry = registeredEntry(code)
      const descriptorAbilities = descriptorEntry?.abilities || []
      if (descriptorAbilities.length) copy.abilityIds = descriptorAbilities.map(descriptor => descriptor.id)
      // 反应搬到描述子后，窗口询问的 source 是描述子 id（如 'scavenging'）：卡号映射
      // （reaction-preferences 的「本局不再询问」与卡面开关）要认得它，否则开关看着在、点了不生效。
      for (const descriptor of descriptorAbilities) {
        if (descriptor.kind === 'reaction' && descriptor.id) copy.reactionIds.push(descriptor.id)
      }
      copy.hasReactionPrompt = hasReactionPromptFor(code, eff, descriptorEntry)
      const entryPassive = !eff?.passive ? registeredEntry(code)?.passive : null
      if (eff && eff.passive) {
        if (eff.passive.stats) copy.statBonus = eff.passive.stats
        if (eff.passive.fightDamage) copy.fightDamageBonus = eff.passive.fightDamage
        if (eff.passive.extraSlots || eff.passive.handSlotsBonus) {
          copy.extraSlots = { ...eff.passive.extraSlots }
          if (eff.passive.handSlotsBonus) copy.extraSlots.hand = (copy.extraSlots.hand || 0) + eff.passive.handSlotsBonus
        }
        // 米奇·布朗：额外盟友槽只放非独特盟友，前端需要单独渲染这组受限槽位。
        if (eff.passive.allySlotsForNonUnique) copy.allySlotsForNonUnique = eff.passive.allySlotsForNonUnique
      } else if (entryPassive) {
        if (entryPassive.stats) copy.statBonus = entryPassive.stats
        if (entryPassive.fightDamage) copy.fightDamageBonus = entryPassive.fightDamage
        if (entryPassive.extraSlots || entryPassive.handSlotsBonus) {
          copy.extraSlots = { ...entryPassive.extraSlots }
          if (entryPassive.handSlotsBonus) copy.extraSlots.hand = (copy.extraSlots.hand || 0) + entryPassive.handSlotsBonus
        }
        if (entryPassive.allySlotsForNonUnique) copy.allySlotsForNonUnique = entryPassive.allySlotsForNonUnique
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
        // 剧情资产也会进玩家的控制区（例如救下的盟友），开关口径与目录卡一致。
        ...(hasReactionPromptFor(code) ? { hasReactionPrompt: true } : {}),
        effectStatus: catalog?.effectStatus || 'unverified', acceptanceProfile: catalog?.acceptanceProfile || null }
    }
    return out
  }

  // 展示用卡面定义表。
  //   不传 options：包含全场所有人的手牌/牌组/压牌（建局与存档快照用，权威且完整）。
  //   传 { observerSeat }：按观察者收窄，别人的手牌/牌组/压牌不进来（观察投影用）。
  //     observerSeat = null 表示没有观察者，只保留公共可见的卡。
  function embeddedCardDefs(state, campaignId, options = {}) {
    const filtered = Object.hasOwn(options, 'observerSeat')
    const seatVisible = seat => !filtered || seat === options.observerSeat
    const codes = new Set()
    for (const inv of state.investigators || []) {
      const own = seatVisible(inv.seat)
      codes.add(inv.code)
      for (const code of [...(own ? inv.hand || [] : []), ...(own ? inv.deck || [] : []), ...(inv.discard || [])]) codes.add(code)
      for (const card of [...(inv.assets || []), ...(inv.threat || [])]) {
        codes.add(card.code)
        for (const code of card.attached || []) codes.add(code)
      }
      if (own) for (const code of inv.beneath || []) codes.add(code)
    }
    for (const record of Object.values(state.campaign?.investigators || {})) {
      if (!seatVisible(record.seat)) continue
      for (const code of record.deck || []) codes.add(code)
    }
    for (const card of state.victoryDisplay || []) codes.add(card.code)
    // 剧情资产不一定写在关卡 storyAssets 里（可能是战役奖赏或行为动态放入），
    // 但已经在场就同样需要卡定义（名称、反应开关、reactionIds 等）。
    for (const card of state.storyAssets || []) codes.add(card.code)
    for (const code of [...(state.removedFromGame || []), ...(state.exiled || [])]) codes.add(code)
    return allCardDefs({ runtimeOnly: true, campaignId, playerCodes: codes })
  }

  // P10（M5 全量开放）：战役 requiredPackIds 里已开放内容包中的可构筑玩家卡进入起始牌组池。
  // 内容驱动、无战役名分支：只有包的 status 为 playable/verified 且卡自身 deckbuilding=true 才计入。
  // 目前只有《万象无终》战役（tcuPlayer verified → 83 张可入牌组的 05 卡）会命中，
  // 其它战役的自动牌组产出保持 P7 基线不变。绑定卡副本（deckLimit=0）由 expandedPlayablePool 排除。
  const DECKABLE_PLAYER_TYPES = new Set(['asset', 'event', 'skill'])
  function campaignDeckbuildingCodes(state = null) {
    const campaign = state?.campaign ? campaignManifestFor(state) : null
    if (!campaign) return []
    const codes = new Set()
    for (const packId of campaign.requiredPackIds) {
      const pack = contentRegistry.getPack(packId)
      if (!pack || !['playable', 'verified'].includes(pack.status)) continue
      for (const card of pack.cards) {
        if (!card.deckbuilding) continue
        const definition = ALL_CARDS[card.code]
        if (!definition || !DECKABLE_PLAYER_TYPES.has(definition.type)) continue
        codes.add(card.code)
      }
    }
    return [...codes]
  }

  // 可构筑玩家卡池：传入 state 时按「卡牌范围」收窄（渐进式只给当前循环及更早的卡）。
  // 不传 state 的旧调用保持全量池；战役起始牌组额外拿到本战役已开放玩家包的卡（P10）。
  function corePlayerPool(state = null) {
    const context = cardPoolContext(state)
    const base = playablePool()
    const campaignCodes = campaignDeckbuildingCodes(state)
    const baseCodes = new Set(base.map(card => card.code))
    const pool = campaignCodes.length
      ? [...base, ...expandedPlayablePool().filter(card => campaignCodes.includes(card.code) && !baseCodes.has(card.code))]
      : base
    return context ? pool.filter(card => allowsCard(card.code, context)) : pool
  }

  // P10：手动提交牌组（hubSetDeck）的许可池 = 开放玩家池按「卡牌范围」收窄。
  // '全部' 范围下允许任一已开放循环的卡（与构筑界面展示一致）；渐进式仍只到当前循环。
  function availablePlayerPool(state = null) {
    const context = cardPoolContext(state)
    const pool = expandedPlayablePool()
    return context ? pool.filter(card => allowsCard(card.code, context)) : pool
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
    const effect = {}
    const abilityEntry = registeredEntry(code)
    const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round, ...fields })
    // 「强制 - 入场后放置 1 个毁灭」（01063 新晋术士）：所有入场路径共用同一实例创建点。
    if (asset.doom == null && abilityEntry?.onPlayDoom != null) asset.doom = abilityEntry.onPlayDoom
    const uses = effect.uses ?? abilityEntry?.uses
    const usesType = effect.usesType ?? abilityEntry?.usesType
    if (uses != null && asset.uses == null) {
      asset.uses = uses
      asset.usesType = usesType || 'charges'
    }
    // 「古代巨石（研究完成）」：秘密数等于剧本日志里记录的鉴定难度。
    // Phase 6（6e-15）：标记搬到条目级字段（旧 DSL 条目回落）。
    const usesFromStoneRecord = abilityEntry?.usesFromStoneRecord ?? effect.usesFromStoneRecord
    if (usesFromStoneRecord && asset.uses == null) {
      asset.uses = Math.max(0, Number(state.campaign?.records?.identifiedTheAncientStone) || 0)
      asset.usesType = effect.usesType || abilityEntry?.usesType || 'secrets'
    }
    // Phase 5（5a-7）：入场额外充能完全由调查员能力的 additionalChargeOnEnter 决定（不再写卡号）。
    const extraCharges = investigatorRule(inv.code)?.additionalChargeOnEnter || 0
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

  return { declarativeDisplayBonuses, allCardDefs, embeddedCardDefs, corePlayerPool, availablePlayerPool, basicWeaknessPool, newCardInstance, newPlayerAssetInstance, newEnemyId, resolveAgendaDoomThresholds }
}
