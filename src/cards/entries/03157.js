// 03157 吉人天相
// 卡面：快速。在你受到伤害和/或恐惧时打出。
// 卡面：取消你刚受到的伤害和/或恐惧中最多10点。放逐吉人天相。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03157 吉人天相

export default {
  code: '03157',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "harmDealt",
      "label": "吉人天相",
      "effect": {
        "type": "cancelHarm",
        "maximum": 10
      },
      "exileAfterPlay": true
    },
  ],
  modifiers: [

  ],
}
