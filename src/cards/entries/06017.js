// 06017 异次元监视者
// 卡面：险境。隐私。猎手。
//       显现 - 秘密地将本敌人加入你的手牌。
//       本敌人在你手牌中时，你可以攻击或躲避本敌人(如同其位于你的地点)。如果你检定成功，
//       将其从手牌中弃掉。如果你检定失败，将其生成并与你交战。
//       强制 - 在你牌库的卡牌耗尽时，如果本敌人在你的手牌中：其攻击你(从你的手牌中)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 显现时秘密加入手牌（hiddenEnemyInHand）。攻击/躲避与牌库耗尽时的攻击在 hidden-enemy.js。

export default {
  code: '06017',
  scope: 'enemy',
  hiddenEnemyInHand: true,
  enemyWeakness: { hunter: true },
  abilities: [],
  modifiers: [],
}
