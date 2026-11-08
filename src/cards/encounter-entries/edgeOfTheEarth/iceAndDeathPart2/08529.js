// 08529 忧心弃物（Somber Remains） · 背面剧情卡
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// 查看牌库顶 9 张，找出所有忒咳哩-哩放到忒咳哩-哩牌库底；混洗牌库；加入胜利区。 读点：章节 behavior.resolveStory（storyRule.effect 声明效果类型，执行后加入胜利区，胜利点 0）。
export default {
  code: '08529',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyEffect: 'tekeliliTopNineToBottom',
    storyVictory: 0,
    storyAddToVictory: true,
  },
}
