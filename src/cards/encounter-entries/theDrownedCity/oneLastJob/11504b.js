// 11504b 希布的路边酒馆 · 地点（金盆洗手，幕 1 版本 I 背面入场）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：东镇与希布的路边酒馆相连。
//       显现 - 将希布的路边酒馆放置入场。将放在一边的萨迪·谢尔顿敌人生成在希布的路边酒馆。
//       将放在一边的幕 2a「谢尔顿帮」与幕 3a「面对后果」加入幕牌库，然后推进至幕 2a。
// 印刷：shroud 3、每调查员 2 条线索、特性 [[Arkham]][[Front]]、胜利 1。
// 读点：behavior.actReveal（幕 1 背面）调用 placeLocationLite + spawnAt；连接在 definition 声明。
export default {
  code: '11504b',
  scope: 'location',
  implemented: true,
  flags: { act2Location: true, connectedTo: 'easttown', bossCode: '11510' },
  note: '数据型条目：数值/连接取卡表与 definition；入场与生成由 behavior.actReveal 触发。',
  abilities: [],
}
