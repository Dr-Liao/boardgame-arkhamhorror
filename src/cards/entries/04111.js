// 04111 坚韧不拔
// 卡面：快速。在你将被分配伤害和/或恐惧，且其数值足够击败你时打出。
// 卡面：取消该伤害和/或恐惧中的最多4点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04111 坚韧不拔

export default {
  code: '04111',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "harmDealt",
      "criteria": {
        "selfOnly": true
      },
      "label": "坚韧不拔",
      "effect": {
        "type": "cancelHarm",
        "maximum": 4
      }
    },
  ],
  modifiers: [

  ],
}
