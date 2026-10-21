// 02115 照明弹
// 卡面：选择一项：
// 卡面：- 攻击。本次攻击你得到+3[combat]并造成+2伤害。放逐照明弹。
// 卡面：- 查找任意调查员牌库顶9张卡牌，找出一个[[盟友]]支援并将其放置入场，放到你的控制之下。然后，放逐照明弹。混洗查找过的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02115 照明弹

export default {
  code: '02115',
  abilities: [
    {
      "kind": "played",
      "label": "照明弹",
      "effect": {
        "type": "flare"
      },
      "exileAfterPlay": true
    },
  ],
  modifiers: [

  ],
}
