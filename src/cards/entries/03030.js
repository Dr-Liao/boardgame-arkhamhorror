// 03030 艺高胆大
// 卡面：快速。在你技能检定将要成功时打出。
// 卡面：你本次检定得到+2技能值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03030 艺高胆大

export default {
  code: '03030',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "wouldSucceedTest",
      "label": "艺高胆大",
      "effect": {
        "type": "addTestValue",
        "amount": 2
      }
    },
  ],
  modifiers: [

  ],
}
