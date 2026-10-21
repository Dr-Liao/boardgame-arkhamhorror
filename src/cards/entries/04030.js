// 04030 钻地魔虫之石
// 卡面：封印([skull]、[cultist]、[tablet]或[elder_thing])。
// 卡面：强制 - 你在技能检定中揭示[auto_fail]符号后：将钻地魔虫之石返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04030 封印「符号」：自动失败时回到手牌。

export default {
  code: '04030',
  sealOnEnterChoice: 'symbol',
  returnToHandOnAutoFail: true,
  abilities: [

  ],
  modifiers: [

  ],
}
