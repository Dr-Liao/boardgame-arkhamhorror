// 01059 圣玫瑰珠
// 卡面：你得到+1[willpower]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01059',
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
  ],
  abilities: [

  ],
}
