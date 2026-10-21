// 03017 墓地食尸鬼
// 卡面：猎物 - 仅对威廉·约里克。
// 卡面：猎手。
// 卡面：墓地食尸鬼与你交战时，你弃牌堆中的卡牌不能离开弃牌堆。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03017 蛇族敌人弱点 / 04014 熔岩之流 / 03042 熊之信标：敌人卡面弱点数据。

export default {
  code: '03017',
  enemyRule: { locksDiscardWhileEngaged: true },
  enemyWeakness: { hunter: true, prey: 'bearer', lockDiscardWhileEngaged: true },
  abilities: [

  ],
  modifiers: [

  ],
}
