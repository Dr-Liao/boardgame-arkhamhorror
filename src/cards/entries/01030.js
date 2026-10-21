// 01030 放大镜
// 卡面：快速。
// 卡面：你调查时得到+1[intellect]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01030',
  fast: true,
  passive: { investigateBonus: 1 },
  abilities: [

  ],
  modifiers: [

  ],
}
