// 08531 被剖开的探险家（Dissected Explorer） · 背面剧情卡
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// 查找牌库，找出一张忒咳哩-哩放到忒咳哩-哩牌库底（不结算）；混洗牌库；加入胜利区。 读点：章节 behavior.resolveStory（storyRule.effect 声明效果类型，执行后加入胜利区，胜利点 0）。
export default {
  code: '08531',
  scope: 'storyAsset',
  implemented: true,
  storyRule: {
    effect: 'tekeliliToBottom',
    victory: 0,
    addToVictory: true,
  },
}
