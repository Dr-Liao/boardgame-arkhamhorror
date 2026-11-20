// 11626 高空栈道（梦之档案库）· 地点（每张胜利区[[符文]] -1 隐藏值；揭示时生成星之眷族观察者；[action] 移动到[[通道]]地点）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：behavior.locationShroudModifier（胜利区符文 -1）、behavior.locationRevealed（生成观察者）、
//       behavior.movePassagewayAction（[[通道]]移动）。
export default {
  code: '11626',
  scope: 'location',
  implemented: true,
  flags: {"passageway":true,"spawnObserver":true,"shroudPerVictoryGlyph":-1},
  note: "数据型条目：地点数值取卡表；隐藏值修正、揭示生成观察者、[[通道]]移动均在 behavior。",
  abilities: [],
}
