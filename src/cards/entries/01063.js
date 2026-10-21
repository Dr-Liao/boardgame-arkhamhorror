// 01063 新晋术士
// 卡面：强制 - 在新晋术士入场后：在该卡上放置1个毁灭标记。
// 卡面：[free] 横置新晋术士：查找你牌库顶的3张卡牌，找出一张[[法术]]卡牌并将其抽取。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01063',
  onPlayDoom: 1,
  abilities: [
    {
      "kind": "action",
      "label": "召唤（检索牌库顶 3 张中的法术牌）",
      "cost": {
        "action": false,
        "exhaust": true
      },
      "effect": {
        "type": "searchTop",
        "amount": 3,
        "trait": "Spell",
        "choose": 1
      }
    },
  ],
  modifiers: [

  ],
}
