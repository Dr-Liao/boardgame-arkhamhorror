// 11518 淹没的道路 · 议程 1（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：每处地点与其上方和下方行的每处其他地点相连。
//       强制 - 你的回合开始时，如果你位于一处完全淹没的地点：你挣扎着呼吸空气：你的回合结束时，
//       如果你未进入一处未淹没或部分淹没的地点、且未降低你当前所在地点的淹没等级，受到 5 点直接伤害。
// 印刷：毁灭阈值 13；背面「走错一步」——每位存活调查员被击败并承受 1 点精神创伤。
// 读点：连接规则由引擎 P7 `mechanics.map.configure({adjacency:'rows'})` 实现（behavior.afterDeckSetup）；
//       挣扎呼吸由 `scenario.mechanics.water = { air: true, damage: 5 }` 引擎读点；
//       flags 由 behavior 读取；背面在 behavior.agendaReveal（无结局）。
export default {
  code: '11518',
  scope: 'agenda',
  implemented: true,
  flags: { floodedPaths: true, airDamage: 5, doomThreshold: 13 },
  note: '数据型条目：阈值 13 由 stage() 读卡表；按行相连与挣扎呼吸走引擎 P7 原语；背面在 behavior.agendaReveal。',
  abilities: [],
}
