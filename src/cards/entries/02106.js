// 02106 弟兄塞维尔
// 卡面：你得到+1[willpower]。
// 卡面：对你所在地点其他调查员造成的伤害和/或恐惧，可以分配给弟兄塞维尔。
// 卡面：[reaction]在弟兄塞维尔被击败时：对你所在地点的一个敌人造成2点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02106',
  defeatedDamage: 2,
  passive: {"stats":{"willpower":1},"assignHarmAtLocation":true},
  abilities: [

  ],
  modifiers: [

  ],
}
