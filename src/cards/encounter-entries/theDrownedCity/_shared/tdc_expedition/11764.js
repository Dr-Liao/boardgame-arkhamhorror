// 11764 潜水服 · 远征剧情资产 · 共享遭遇组 tdc_expedition
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_expedition（CONTRACT §6，印刷 1–4 张）。
// 卡面（cards-data 11764，原文见该卡 textZh）：
//   为结算卡牌效果，你所在地点完全淹没时，你可以视其为部分淹没。
//   强制 - 任意数量伤害将要被放置在你身上时：将其中1点伤害放置在潜水服上。
//
// 读点（声明即接线）：
//   · 「任意数量伤害将要放置到你身上时：将其中 1 点放到潜水服上」= assetRule.redirectOneDamageToSelf: true
//     （enemies.js#applyHarm 的伤害分配前读点，每次结算转移至多 1 点，直接伤害同样适用）；
//   · 「为结算卡牌效果，你所在地点完全淹没时，你可以视其为部分淹没」= assetRule.effectiveFloodLevelCap: 1
//     （受控支援声明；读点 flood.js#effectiveFloodLevel 取控制者资产的 cap → 2 视为 1；
//     api.mechanics.water.effectiveLevel(seat) 与空气/涨水等读点同源，仅影响该控制者读到的有效水位）。
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
  implemented: true,
  assetRule: { redirectOneDamageToSelf: true, effectiveFloodLevelCap: 1 },
  flags: { expedition: true, traits: ['Item', 'Armor'], health: 3, slotless: true },
  abilities: [],
  note: '两条款都走引擎声明读点：① 伤害改道 = assetRule.redirectOneDamageToSelf'
    + '（enemies.js#applyHarm，每次结算至多 1 点、直接伤害同样适用；条目不写 resolve，由引擎统一结算）；'
    + '②「完全淹没视同部分淹没」= assetRule.effectiveFloodLevelCap: 1'
    + '（flood.js#effectiveFloodLevel 读控制者资产，2 → 1；api.mechanics.water.effectiveLevel 同源）。'
    + '真实引擎用例覆盖两条读点。无近似项（发放时的 uses 初始化属内容侧集成项，见 engine-needs §8.2）。',
}
