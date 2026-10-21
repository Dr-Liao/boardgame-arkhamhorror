// 01023 闪躲
// 卡面：快速。在一个敌人攻击你所在地点的一位调查员时打出。
// 卡面：取消该次攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01023 闪躲

export default {
  code: '01023',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "enemyAttack",
      "label": "闪躲",
      "effect": {
        "type": "cancelEnemyAttack"
      }
    },
  ],
  modifiers: [

  ],
}
