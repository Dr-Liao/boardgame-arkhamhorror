// 02307 守护结界
// 卡面：快速。在你抽取一张非弱点的遭遇卡牌时打出。
// 卡面：取消该卡牌的所有效果并将其弃掉。然后，受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02307 守护结界

export default {
  code: '02307',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "encounterDrawn",
      "criteria": {
        "nonWeaknessOnly": true
      },
      "label": "守护结界",
      "effect": {
        "type": "cancelTreachery",
        "horror": 1
      }
    },
  ],
  modifiers: [

  ],
}
