// 01040 放大镜
// 卡面：快速。
// 卡面：你在调查时得到+1[intellect]。
// 卡面：[free]如果你所在地点没有线索：将放大镜返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01040',
  fast: true,
  passive: { investigateBonus: 1 },
  abilities: [
    {
      kind: 'action', label: '没有线索时收回手中', requiresNoClues: true, cost: { action: false },
      effect: { type: 'returnAssetToHand' },
    },
  ],
  modifiers: [

  ],
}
