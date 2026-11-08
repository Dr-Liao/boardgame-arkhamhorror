// 诡镇奇谈界面语言包入口（docs/localization.md §8.2）。
// 拆成 core + 按模块拆分的区域片段，方便多人并行维护；聚合后仍是 default export 的扁平对象。
// 缺失 key 的回退顺序由 web/i18n.js 负责：resolved → zh-CN → key。
import core from './en.core.js'
import hub from './en.hub.js'
import gameui from './en.gameui.js'
import table from './en.table.js'
import panels from './en.panels.js'
import lore from './en.lore.js'
import misc from './en.misc.js'

export default {
  "draft.refillTask": "Fill the deck",
  "draft.refillStatus": "Fill your deck: {count} / {size} cards, {missing} remaining.",
  "draft.deckRequirement": "Deck requirement: {count} / {size} cards; add {missing} more before confirming readiness or starting a scenario.",
  "draft.refillNote": "Choose level 0 cards that count toward deck size. Each pick supplies the next offer for free until the deck is full. Optional rerolls cost 1 XP. Further upgrades still require a paid refresh.",

  "draft.type.asset": "Assets",
  "draft.typeDistribution": "Card type distribution",
  "draft.typeScope": "Includes signature cards and weaknesses. Counts include all copies.",
  "draft.type.weakness": "Weaknesses",
  "draft.type.other": "Other",
  "draft.fullDeck": "Complete deck list",
  "draft.fullDeckTitle": "Complete deck list · {count} cards",

  "draft.modeLabel": "Game mode",
  "draft.standardDescription": "Build your starting deck freely and spend experience on upgrades using the standard rules.",
  "draft.modeDescription": "Build and upgrade your deck by choosing one of three cards. Start with three free rerolls, add +1 and 0 chaos tokens, and earn (final scenario XP + 1) × 2.",

  "draft.standard": "Standard mode",
  "draft.title": "Draft mode",
  "draft.chooseInvestigator": "Choose an investigator first.",
  "draft.initialStatus": "Initial draft: {count} cards picked, {free} free rerolls left.",
  "draft.upgradeStatus": "Upgrades · {xp} XP available",
  "draft.locked": "All three offers are locked across scenarios. The next free refresh is forfeited.",
  "draft.slot": "Offer {slot}",
  "draft.noCandidate": "No legal candidate for this slot.",
  "draft.inspect": "Inspect {name}",
  "draft.cardCost": "Card level {xp} XP · Resource cost {cost}",
  "draft.replace": "Replace a card",
  "draft.replaceFor": "Choose a replacement for {name}",
  "draft.noReplacement": "Add directly",
  "draft.unavailable": "Not enough XP or no legal replacement. Lock these offers to buy later.",
  "draft.initialDone": "Initial draft complete. Confirm when ready.",
  "draft.consumed": "Offer consumed. Spend 1 XP to refresh and pick again.",
  "draft.upgradeNote": "Pick one per offer. Level 0 swaps are free; upgrades cost XP and support same-title credit. Same-title upgrades have double refresh weight. You may skip and return.",
  "draft.deckTitle": "Current deck · {count} cards toward deck size",
  "draft.costCurve": "Resource cost distribution",

  ...core,
  ...hub,
  ...gameui,
  ...table,
  ...panels,
  ...lore,
  ...misc,
}
