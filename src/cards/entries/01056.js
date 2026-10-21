// 01056 老千手法
// 卡面：快速。在你揭示一个带有负值修正的混乱标记后打出。
// 卡面：将该标记的“-”变为“+”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01056 老千手法

export default {
  code: '01056',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "negativeTokenRevealed",
      "criteria": {
        "selfOnly": true
      },
      "label": "老千手法",
      "effect": {
        "type": "flipTokenSign"
      }
    },
  ],
  modifiers: [

  ],
}
