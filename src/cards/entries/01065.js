// 01065 守护结界
// 卡面：快速。在你抽取一张非弱点的诡计卡牌时打出。
// 卡面：取消该卡牌的显现效果。然后，受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01065 守护结界

export default {
  code: '01065',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "treachery",
      "criteria": {
        "selfOnly": true,
        "nonWeaknessOnly": true
      },
      "label": "守护结界",
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
