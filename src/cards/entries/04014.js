// 04014 伊格蛇族
// 卡面：猎物 - 仅限马泰奥神父。
// 卡面：猎手。
// 卡面：显现 - 从混乱袋中查找[elder_sign]混乱标记并将其封印在伊格蛇族上。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04014',
  enemyWeakness: { sealsElderSign: true, hunter: true, prey: 'bearer' },
  abilities: [

  ],
  modifiers: [

  ],
}
