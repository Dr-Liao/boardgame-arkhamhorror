// 04198 逆反
// 卡面：忽略本次技能检定期间所有[skull]、[cultist]、[tablet]和[elder_thing]符号的效果(包括其修正值)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04198',
  abilities: [
    { kind: 'commit', label: '逆反', skill: { ignoreSymbolEffects: true } },
  ],
  modifiers: [

  ],
}
