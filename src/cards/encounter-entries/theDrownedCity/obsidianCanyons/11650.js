// 11650 · location · obsidianCanyons
//
// 漂浮尖塔。数值/背面入场费同中央尖塔（behavior.movementError 近似）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11650',
  scope: 'location',
  implemented: true,
  flags: { central: true, immovable: true, entryToll: true, cluesByResources: true },
  
  note: "漂浮尖塔。数值/背面入场费同中央尖塔（behavior.movementError 近似）。",
}
