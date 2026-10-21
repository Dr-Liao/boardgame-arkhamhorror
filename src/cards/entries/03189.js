// 03189 “同归于尽！”
// 卡面：击败与你交战的每个非[[精英]]敌人。你被击败并承受1点肉体创伤。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03189 「同归于尽！」：击败所有与我交战的非精英敌人，然后受 1 点物理创伤并把伤害拉满。

export default {
  code: '03189',
  noOpportunityAttack: true,
  quietPlay: true,
  abilities: [
    {
      kind: 'played', label: '击败所有交战的非精英敌人，受 1 创伤并把伤害拉满',
      resolve: ({ inv, api }) => {
        for (const enemy of api.engagedEnemies(inv.seat).filter(foe => !foe.elite)) api.defeatEnemy(enemy, inv.seat)
        api.bumpInstanceTrauma(inv.seat, 'physical', 1)
        api.setDamageToMax(inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
