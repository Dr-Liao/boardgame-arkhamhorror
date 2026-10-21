// 04192 英勇无畏
// 卡面：如果本次技能检定成功，将英勇无畏加入你的游戏区域，作为一张带有以下文字的支援卡牌：
// 卡面：“你得到+1[intellect]、+1[combat]和+1[agility]。
// 卡面：强制 - 当一轮结束时：弃掉英勇无畏。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04192',
  abilities: [
    {
      kind: 'commit',
      label: '英勇无畏',
      skill: {
        onSuccess: { becomeAsset: { stats: { intellect: 1, combat: 1, agility: 1 } } },
      },
    },
  ],
  modifiers: [

  ],
}
