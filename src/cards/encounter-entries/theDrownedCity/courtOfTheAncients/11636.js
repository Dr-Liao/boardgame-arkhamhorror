// 11636 宇宙预兆 · 诡计 ×4（意志(3)，已翻译 ≥10 符文难度 +2；失败：洗回场上一张[[符文]]卡，或 1 直接恐惧 + 随机弃 1 张手牌）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
export default {
  code: '11636',
  scope: 'treachery',
  implemented: true,
  flags: {"cosmicOmen":true,"test":{"skill":"willpower","difficulty":3}},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('courtCosmicOmen', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "数据型条目：印刷数值取卡表，行为读点在 definition/behavior。",
  abilities: [],
}
