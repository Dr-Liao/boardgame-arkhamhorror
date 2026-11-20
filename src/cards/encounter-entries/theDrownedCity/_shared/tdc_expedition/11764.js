// 11764 潜水服 · 远征剧情资产 · 共享遭遇组 tdc_expedition
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_expedition（CONTRACT §6，印刷 1–4 张）。
// 卡面（cards-data 11764，原文见该卡 textZh）：
//   为结算卡牌效果，你所在地点完全淹没时，你可以视其为部分淹没。
//   强制 - 任意数量伤害将要被放置在你身上时：将其中1点伤害放置在潜水服上。
//
// 读点（声明即接线）：
//   · 「任意数量伤害将要放置到你身上时：将其中 1 点放到潜水服上」= assetRule.redirectOneDamageToSelf: true（enemies.js#applyHarm 的伤害分配前读点，每次结算转移至多 1 点，直接伤害同样适用）；
//   · 「完全淹没时可以视其为部分淹没」——引擎没有该读点（flood.js 的 effectiveFloodLevel 只有 reduce/immune 选项，卡面无法声明），见 note。
//
// 归属与发放：Setup「每名玩家选择 1 项已获得的文物或远征物品入场」由章节 setup 用
//   api.giveAsset / scenarioRuntime.giveAsset 放到调查员控制下（sepulchreOfTheSleeper/definition.js
//   的 EXPEDITION_ITEM_CODES / EXPEDITION_ALLY_CODES）；giveAsset 走 newCardInstance，不复制条目
//   uses，因此「使用(N)」的初始化由章节/战役侧照抄条目 uses（EotE 08714–08722 同一口径）。
const CODE = '11764'

export default {
  code: CODE,
  name: '潜水服',
  scope: 'storyAsset',
  implemented: false,
  assetRule: { redirectOneDamageToSelf: true },
  flags: { expedition: true, traits: ['Item', 'Armor'], health: 3, slotless: true },
  abilities: [],
  note: 'approximation / blocked read point：① 伤害转移已接线（assetRule.redirectOneDamageToSelf，与 07338 同一读点）；'
    + '②「完全淹没视同部分淹没」没有卡级读点（effectiveFloodLevel 的 reduce 只在调用方选项里，'
    + 'beginAirTurn 的空气判定也不读条目），目前未接线。',
}
