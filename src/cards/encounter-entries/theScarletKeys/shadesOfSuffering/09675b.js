// 09675b 遗失的纪念品（A Lost Memento）· 剧情 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。物理卡 09675 的剧情面（敌人面 09675a）。
// 卡面：如果有调查员「找到了一件便宜的纪念品」，阅读下列文本（否则，将本卡牌翻回敌人面，
//   治愈其全部伤害，横置并与所有调查员解除交战）：……将本卡牌加入胜利区（胜利 1）。
//
// 读点：「找到了一件便宜的纪念品」由吉隆坡火车站（西翼 09668）的团队线索行动写入
// `scenarioFlags.remembered`；解锁事实 → `assetRule.geistStory.fact`（behavior.storyFactOf）。
export default {
  code: '09675b',
  name: '遗失的纪念品',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    geistStory: { enemy: '09675a', fact: 'foundACheapMemento', victory: 1 },
  },
  note: '剧情面没有单独的行动：它在灵怪谈判成功或「将要被击败」时由 behavior.resolveGeistStory 结算。',
}
