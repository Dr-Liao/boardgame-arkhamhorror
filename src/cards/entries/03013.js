// 03013 毕宿星团
// 卡面：显现 - 随机选择赛菲娜·卢梭底下的一张事件，将其从游戏中移除。如果你不能这么做，受到1点伤害和1点恐惧。如果你的牌库有5张或以上卡牌，不要弃掉毕宿星团，改为将其洗回你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03013',
  abilities: [
    { kind: 'weakness', label: '毕宿星团', weakness: { type: 'starsOfHyades' } },
  ],
  modifiers: [

  ],
}
