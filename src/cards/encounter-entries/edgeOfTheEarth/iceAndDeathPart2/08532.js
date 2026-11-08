// 08532 深层邪恶（Evil Within） · 背面剧情卡
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// 从场上弃掉一个没有 [[精英]] 特性的 [[幻灵]] 敌人；加入胜利区。 读点：章节 behavior.resolveStory（storyRule.effect 声明效果类型，执行后加入胜利区，胜利点 0）。
export default {
  code: '08532',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyEffect: 'discardNonEliteEidolon',
    storyVictory: 0,
    storyAddToVictory: true,
  },
}
