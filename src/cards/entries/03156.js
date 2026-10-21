// 03156 意志考验
// 卡面：快速。在你所在地点的一位调查员抽取一张非弱点诡计卡牌时打出。
// 卡面：取消该卡牌的显现效果。放逐意志考验。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03156 意志考验

export default {
  code: '03156',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "encounterDrawn",
      "criteria": {
        "nonWeaknessOnly": true,
        "treacheryOnly": true
      },
      "label": "意志考验",
      "effect": {
        "type": "cancelTreachery"
      },
      "exileAfterPlay": true
    },
  ],
  modifiers: [

  ],
}
