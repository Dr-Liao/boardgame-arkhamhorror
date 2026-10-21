// 04110 反击法术
// 卡面：快速。在你所在地点的技能检定期间揭示[skull]、[cultist]、[tablet]或[elder_thing]混乱标记时打出。
// 卡面：取消该混乱标记。(不揭示新的混乱标记以替换。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04110 反击法术

export default {
  code: '04110',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "symbolRevealed",
      "criteria": {
        "symbols": [
          "skull",
          "cultist",
          "tablet",
          "elderthing"
        ]
      },
      "label": "反击法术",
      "effect": {
        "type": "cancelSymbolToken",
        "code": "04110"
      }
    },
  ],
  modifiers: [

  ],
}
