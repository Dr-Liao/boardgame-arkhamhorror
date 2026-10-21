// 03042 随行鬼影
// 卡面：生成 - 距离你最远的地点。
// 卡面：猎物 - 仅对承受者。
// 卡面：猎手。
// 卡面：强制 - 在随行鬼影将要被击败时：改为将其洗入承受者的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03042 随行鬼影：在离承受者最远的地点生成（读点在 resolveWeakness 的敌人弱点段）。

export default {
  code: '03042',
  weaknessSpawnsAtFarthestLocation: true,
  enemyWeakness: { hunter: true, prey: 'bearer', shuffleIntoDeckOnDefeat: true },
  abilities: [

  ],
  modifiers: [

  ],
}
