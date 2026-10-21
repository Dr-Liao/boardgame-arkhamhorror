// 02190 逆反
// 卡面：在本次检定揭示混乱标记前，选择以下一个符号：([skull]、[cultist]、[tablet]或[elder_thing])。本次检定期间忽略所选符号的效果(包括其修正值)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02190',
  abilities: [
    { kind: 'commit', label: '逆反', skill: { defiance: true } },
  ],
  modifiers: [

  ],
}
