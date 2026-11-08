// 08527 死路（Dead End） · 背面剧情卡
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// 从混乱袋里移除 1 个 [frost] 标记；把本剧情卡加入胜利区。 读点：章节 behavior.resolveStory（storyRule.effect 声明效果类型，执行后加入胜利区，胜利点 0）。
export default {
  code: '08527',
  scope: 'storyAsset',
  implemented: true,
  storyRule: {
    effect: 'removeFrost',
    victory: 0,
    addToVictory: true,
  },
}
