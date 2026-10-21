// 01022 证据！
// 卡面：快速。在你击败一个敌人后打出。
// 卡面：发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01022 证据！

export default {
  code: '01022',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "defeatEnemy",
      "criteria": {
        "selfOnly": true
      },
      "label": "证据！",
      "effect": {
        "type": "discoverClue",
        "amount": 1
      }
    },
  ],
  modifiers: [

  ],
}
