// 06292 梦境之外（Beyond Dreams，幕 3）
// 正面：目标 - 如果每位调查员都位于缟玛瑙大门，且该地点上没有线索，推进。
// 背面（Where the Gods Dwell）：每位调查员失去其所有线索。
//       阅读剧本手册中的冒险幕间故事：一盘大棋。然后推进到场景 4a「真实与谎言」。
//
// 行为位置：背面是整段「Grand Design」章节流程（揭示缟玛瑙城堡并把所有人移到大礼堂、移除其它地点、
// 5 段幕间文本、洗入 set-aside 的奈亚拉托提普与其余遭遇卡、随机放 4 座塔并标方向）。
// 由章节 behavior.actReveal 读 `actRule.chapterFlow === 'grandDesign'` 统一实现
//（不按卡号写章节分支）。
export default {
  code: '06292',
  scope: 'act',
  implemented: true,
  actRule: { chapterFlow: 'grandDesign' },
}
