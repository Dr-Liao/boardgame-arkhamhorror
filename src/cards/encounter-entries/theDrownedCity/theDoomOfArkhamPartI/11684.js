// 11684 幽灵商店 · 幕 1（阿卡姆的毁灭 第一部分）。
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartI（P7 终章上篇）。
// 卡面：[action] 位于你所在地点的调查员共同花费 1[per_investigator] 线索：抽取你所在地点
//       下方最上方的卡牌。如果它是一张支援，将其控制。
//       目标 - 一轮结束时，如果蒂林哈斯特密所的一位调查员控制至少 1 张[[神器]]支援，可以推进。
//       背面：控制 ≥5 张[[神器]] → 结局 1；否则每人 +1 额外经验 → 结局 2。
// 读点：behavior.actions/performAction（drawBeneath）、behavior.roundEnded（轮末目标）、
//       behavior.actReveal（背面分流）。
export default {
  code: '11684',
  scope: 'act',
  implemented: true,
  flags: { phantomShop: true, shopAction: true, artifactThreshold: 5 },
  note: '数据型条目：目标/背面在 behavior.roundEnded 与 behavior.actReveal；行动在 behavior.performAction。',
  abilities: [],
}
