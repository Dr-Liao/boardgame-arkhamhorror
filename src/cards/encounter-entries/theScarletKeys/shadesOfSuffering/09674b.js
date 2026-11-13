// 09674b 顽皮的阴影（Playful Shadows）· 剧情 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。物理卡 09674 的剧情面（敌人面 09674a）。
// 卡面：如果有调查员「让领事蒙羞」，阅读下列文本（否则，将本卡牌翻回敌人面，治愈其全部伤害，
//   横置并与所有调查员解除交战）：……将本卡牌加入胜利区。
//
// 读点（章节 behavior，条目只声明数据）：
//   · 「让领事蒙羞」由雪兰莪俱乐部草坪（09670）的谈判失败写入 `scenarioFlags.remembered`；
//   · 解锁事实 → `assetRule.geistStory.fact`（behavior.storyFactOf 是唯一读点）；
//   · 胜利 1 走 `api.scenario.addStoryToVictory`（behavior.resolveGeistStory）。
export default {
  code: '09674b',
  name: '顽皮的阴影',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    geistStory: { enemy: '09674a', fact: 'embarrassedTheConsulate', victory: 1 },
  },
  note: '剧情面没有单独的行动：它在灵怪谈判成功或「将要被击败」时由 behavior.resolveGeistStory 结算。',
}
