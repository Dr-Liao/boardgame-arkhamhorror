// 08733 戴尔的素描（Dyer 的素描）· 事件 · memorials_of_the_lost
// 卡面：快速。可在任何[free]时间段期间打出。抽取 3 张卡牌。
// 归属说明：事件卡加入调查员牌组后需要玩家侧生命周期条目（src/cards/entries/08733.js 的
//   played 描述子）；本战役共享目录只登记卡面身份与行为数据，避免把 lifecycle kind 写进非玩家 scope。
export default {
  code: '08733', scope: 'storyAsset', implemented: true,
  flags: { memorial: true, eventCard: true, effect: 'draw3AnyFreeWindow' },
  note: '事件卡的 played 生命周期条目由玩家卡批次落在 src/cards/entries/08733.js（P7 写权限外的偏差，见报告）。',
}

