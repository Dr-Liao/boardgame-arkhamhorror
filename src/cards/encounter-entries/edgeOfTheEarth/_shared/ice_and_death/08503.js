// 08503 冰冻海岸（Frozen Shores） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：如果有遭遇卡牌附属到冰冻海岸，冰冻海岸得到 +2 隐藏。庇护 2。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

export default {
  code: '08503', scope: 'location', implemented: true,
  flags: { shelter: 2, campCandidate: true, shroudWhenAttached: 2 },
  locationRule: { shroudWhenAttached: 2 },
  note: '「有遭遇卡牌附属时 +2 隐藏」需要章节 behavior.locationShroudModifier 读 locationRule.shroudWhenAttached（P7 读点注释），条目已落数据。',
}


