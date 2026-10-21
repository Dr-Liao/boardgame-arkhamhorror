// 03270 守护结界
// 卡面：快速。在位于任意地点的一位调查员抽取一张非弱点诡计卡牌时打出。
// 卡面：取消该卡牌的显现效果。然后，受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03270 守护结界（XP4）

export default {
  code: '03270',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "encounterDrawn",
      "criteria": {
        "nonWeaknessOnly": true,
        "anyLocation": true,
        "treacheryOnly": true
      },
      "label": "守护结界（XP4）",
      "effect": {
        "type": "sequence",
        "effects": [
          {
            "type": "cancelTreachery"
          },
          {
            "type": "takeHorror",
            "amount": 1
          }
        ]
      }
    },
  ],
  modifiers: [

  ],
}
