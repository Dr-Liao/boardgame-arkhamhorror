// 11685 蒂林哈斯特密所 · 短暂商店 · 地点（阿卡姆的毁灭 第一部分）。
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartI（P7 终章上篇）。
// 卡面：显现 - 将蒂林哈斯特密所放置入场，位于你所在地点相邻处，并将放在一边的
//       兰道尔·蒂林哈斯特生成在此。将每张放在一边的[[神器]]支援混洗，以一叠放在其下方。
//       蒂林哈斯特密所与其被抽取的地点相连，反之亦然。印刷：[fast] 在本地点上放置线索，直到其线索值。
// 印刷数值：shroud 4 / 线索 3 / 胜利 1 / 特性 [[Sanctum]][[Extradimensional]]（卡表读取）。
// 读点：behavior.takeTopBeneathCode（抽到本卡时 placeShop + 生成 11686 + 神器暗堆）、
//       behavior.shopCluesAction（[fast] 放线索）。
export default {
  code: '11685',
  scope: 'location',
  implemented: true,
  flags: { ephemeralShop: true, fastClues: true, singleSided: true },
  note: '数据型条目：数值/特性由 definition.location() 从卡表读取；显现与 [fast] 在 behavior。',
  abilities: [],
}
