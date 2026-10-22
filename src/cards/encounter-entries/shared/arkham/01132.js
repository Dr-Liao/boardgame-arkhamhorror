// 01132 东城区
// 归属：跨战役通用
// 遭遇组：arkham
// 卡面：你位于东城区时，你打出每张[[盟友]]支援的费用-2。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 东城区（01132）：在此地打出盟友支援费用 -2。

export default {
  code: '01132',
  name: '东城区',
  scope: 'location',
  text: '你位于东城区时，你打出每张盟友支援的费用 -2。',
  locationRule: { playDiscount: { cardType: 'asset', trait: 'ally', amount: 2 } },
}
