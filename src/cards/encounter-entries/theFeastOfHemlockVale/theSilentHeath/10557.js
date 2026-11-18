// 10557 惨白斜坡 · 地点（寂静荒野，起始地点）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：强制 - 在你揭示惨白斜坡时：检定[敏捷](4)。如果你检定失败，受到 2 点伤害。
// 印刷：shroud 4、每调查员 1 条线索、特性 [[Blight]]、符号圆形（连接等号与三角）。
// 读点：behavior.locationRevealed → ashenSlopeReveal 读本节目的 revealTest 并执行检定。
export default {
  code: '10557',
  scope: 'location',
  implemented: true,
  flags: { revealTest: { skill: 'agility', difficulty: 4, failDamage: 2 } },
  note: '数据型条目：地点数值由 definition 读取；揭示检定在 behavior.ashenSlopeReveal。',
  abilities: [],
}
