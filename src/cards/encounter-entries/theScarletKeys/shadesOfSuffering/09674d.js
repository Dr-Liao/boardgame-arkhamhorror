// 09674d 羞怯的阴影（Timorous Shadows）· 剧情 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。物理卡 09674 的剧情面（敌人面 09674c）。
// 卡面：如果有调查员「眺望彼端」，阅读下列文本（否则，将本卡牌翻回敌人面，治愈其全部伤害，
//   横置并与所有调查员解除交战）：……将本卡牌加入胜利区。
//
// 读点：「眺望彼端」由美拉提的商店（09671）的团队线索行动写入 `scenarioFlags.remembered`；
// 解锁事实 → `assetRule.geistStory.fact`（behavior.storyFactOf）；胜利 1 走 api.scenario.addStoryToVictory。
export default {
  code: '09674d',
  name: '羞怯的阴影',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    geistStory: { enemy: '09674c', fact: 'peeredBeyond', victory: 1 },
  },
  note: '剧情面没有单独的行动：它在灵怪谈判成功或「将要被击败」时由 behavior.resolveGeistStory 结算。',
}
