// 03235 力量洪流
// 卡面：作为将力量洪流投入技能检定的额外费用，从你控制的所有支援上花费最多3充能。
// 卡面：每以此方式花费1充能，力量洪流获得[willpower][wild]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03235',
  abilities: [
    { kind: 'commit', label: '力量洪流', skill: { spendChargesForIcons: 3 } },
  ],
  modifiers: [

  ],
}
