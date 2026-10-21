// 01083 千钧一发
// 卡面：快速。在你所在地点的一个非弱点、非[[精英]]敌人被躲避后打出。
// 卡面：将该敌人混洗入遭遇牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01083 千钧一发

export default {
  code: '01083',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "evadeSuccess",
      "criteria": {
        "nonElite": true,
        "nonWeakness": true,
        "selfOnly": true
      },
      "label": "千钧一发",
      "effect": {
        "type": "shuffleIntoEncounter"
      }
    },
  ],
  modifiers: [

  ],
}
