// 81009 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81009',
  scope: 'location',
  implemented: true,
  flags: {"resignLocation":true},
  note: "撤退由 definition 的地点字段 resign 声明为 true，引擎 moves.js 统一列项与 doResign 结算；胜利 1 由 definition.victory 声明。",
  abilities: [],
}
