// 01079 “看看我发现了什么！”
// 卡面：快速。你调查时，技能检定失败且低于难度2点及以内后打出。
// 卡面：发现你所在地点的2个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01079 “看看我发现了什么！”

export default {
  code: '01079',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "investigateFail",
      "criteria": {
        "failedByAtMost": 2,
        "selfOnly": true
      },
      "label": "“看看我发现了什么！”",
      "effect": {
        "type": "discoverClue",
        "amount": 2
      }
    },
  ],
  modifiers: [

  ],
}
