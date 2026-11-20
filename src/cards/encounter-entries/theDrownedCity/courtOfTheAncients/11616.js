// 11616 巨人阶梯 · 幕 1：[action] 花费 1[per_investigator] 线索弃遭遇牌顶 5/8 张并抽符文；目标：大升降机翻至已激活面后立刻推进。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
export default {
  code: '11616',
  scope: 'act',
  implemented: true,
  flags: {"objective":"liftActive","discardCount":5,"discardCountSolo":8},
  note: "数据型条目：印刷数值/正文取卡表，规则读点在 definition/behavior。",
  abilities: [],
}
