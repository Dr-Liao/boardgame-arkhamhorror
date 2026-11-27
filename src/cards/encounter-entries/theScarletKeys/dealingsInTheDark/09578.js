// 09578 大巴扎 · 地点（dealingsInTheDark）
// 公共浴室：在此地的调查员控制的[[武器]]支援文本框视为空白。
export default {
  code: '09578',
  scope: 'location',
  implemented: true,
  flags: { printedShroud: 2, printedClues: 1 },
  locationRule: { blankAssetsWithTrait: 'Weapon' },
}
