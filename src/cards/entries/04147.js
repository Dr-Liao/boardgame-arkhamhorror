// 04147 伊塔卡
// 卡面：你得到+1[combat](攻击带有胜利X的敌人时，改为+2[combat])。
// 卡面：你得到+1[agility](尝试躲避带有复仇X的敌人时，改为+2[agility])。
// 卡面：[reaction]在你将一个敌人加入胜利区后，横置伊塔卡：治愈你和伊塔卡各1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04147',
  exhaustOnEnemyDefeatedHealHorror: 1,
  passive: {"stats":{"combat":1,"agility":1}},
  abilities: [

  ],
  modifiers: [

  ],
}
