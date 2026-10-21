// 01084 运气好！
// 卡面：快速。在你技能检定将要失败时打出。
// 卡面：该次检定你得到技能值+2。抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01084 运气好！（XP2）

export default {
  code: '01084',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "testWouldFail",
      "criteria": {
        "selfOnly": true
      },
      "label": "运气好！（XP2）",
      "effect": {
        "type": "sequence",
        "effects": [
          {
            "type": "addTestValue",
            "amount": 2
          },
          {
            "type": "draw",
            "amount": 1
          }
        ]
      }
    },
  ],
  modifiers: [

  ],
}
