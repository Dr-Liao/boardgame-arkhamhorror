// 09595 一失足(版本一) · 幕（dancingMad）
// 德西离场时，把他放在一边，每位调查员受到 1 点恐惧。
export default {
  code: '09595',
  scope: 'act',
  implemented: true,
  actRule: { assetLeavesPlaySetAside: '09607b', horrorOnAssetLeavesPlay: 1 },
}
