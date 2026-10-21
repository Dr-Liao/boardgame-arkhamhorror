// 03009b 索菲
// 卡面：索菲不能离场。
// 卡面：你得到每项技能-1。
// 卡面：强制 - 如果马克·哈里根身上有4点或更少伤害：将索菲翻面。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03009b',
  cannotLeavePlay: true,
  passive: {"stats":{"willpower":-1,"intellect":-1,"combat":-1,"agility":-1}},
  abilities: [

  ],
  modifiers: [

  ],
}
