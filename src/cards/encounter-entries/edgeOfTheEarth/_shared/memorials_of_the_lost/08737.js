// 08737 高田的物品（Takada 的物品）· 事件 · memorials_of_the_lost
// 卡面：快速。可在任何[free]时间段期间打出。获得 3 资源并抽取 1 张卡牌。将高田的物品从游戏中移除。
// 归属说明：事件卡加入调查员牌组后需要玩家侧生命周期条目（src/cards/entries/08737.js 的 played
//   描述子）；本战役共享目录只登记卡面身份与行为数据。
export default {
  code: '08737', scope: 'storyAsset', implemented: true,
  flags: { memorial: true, eventCard: true, effect: 'gain3ResourcesDraw1RemoveFromGame' },
  note: '事件卡的 played 生命周期条目由玩家卡批次落在 src/cards/entries/08737.js（P7 写权限外的偏差，见报告）。',
}

