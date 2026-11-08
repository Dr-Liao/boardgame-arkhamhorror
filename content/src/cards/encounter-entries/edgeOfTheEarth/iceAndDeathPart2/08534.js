// 08534 心中的疯狂（Madness Inside） · 背面剧情卡
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// 选择场上一个没有 [[精英]] 特性的 [[附身]] 敌人，控制其所有毁灭标记并翻到线索面后弃掉它；加入胜利区。 读点：章节 behavior.resolveStory（storyRule.effect 声明效果类型，执行后加入胜利区，胜利点 0）。
export default {
  code: '08534',
  scope: 'storyAsset',
  implemented: true,
  storyRule: {
    effect: 'possessedDoomToClues',
    victory: 0,
    addToVictory: true,
  },
}
