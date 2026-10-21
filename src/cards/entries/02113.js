// 02113 哎呀！
// 卡面：快速。在你攻击与你交战的敌人时技能检定失败，并且低于难度2点及以内后打出。
// 卡面：对你所在地点的另一个敌人造成本次攻击的伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02113 哎呀！

export default {
  code: '02113',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "attackFail",
      "criteria": {
        "failedByAtMost": 2
      },
      "label": "哎呀！",
      "effect": {
        "type": "redirectFailedAttack",
        "code": "02113"
      }
    },
  ],
  modifiers: [

  ],
}
