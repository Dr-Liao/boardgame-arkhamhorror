// 02261 “我见过更糟的……”
// 卡面：快速。在你受到伤害和/或恐惧时打出。
// 卡面：取消你刚受到的伤害和/或恐惧中最多5点。然后，获得同等数量的资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02261 “我见过更糟的……”

export default {
  code: '02261',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "harmDealt",
      "label": "“我见过更糟的……”",
      "effect": {
        "type": "cancelHarmGainResources",
        "code": "02261",
        "maximum": 5
      }
    },
  ],
  modifiers: [

  ],
}
