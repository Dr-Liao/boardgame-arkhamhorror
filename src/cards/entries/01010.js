// 01010 在逃中
// 卡面：“倒霉蛋”奥图尔牌库专用。
// 卡面：快速。在你回合开始后打出。
// 卡面：直到本轮结束，非[[精英]]敌人不能攻击你。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01010 在逃中

export default {
  code: '01010',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "turnBegins",
      "criteria": {
        "selfOnly": true
      },
      "label": "在逃中",
      "effect": {
        "type": "onTheLam"
      }
    },
  ],
  modifiers: [

  ],
}
