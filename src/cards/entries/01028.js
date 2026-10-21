// 01028 巡警
// 卡面：你得到+1[combat]。
// 卡面：[free]横置巡警并对其造成1点伤害：对你所在地点的一个敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01028 巡警：+1 战斗；横置并让这张支援受 1 伤害，对同地点敌人造成 1 点伤害。

export default {
  code: '01028',
  passive: { stats: { combat: 1 } },
  abilities: [
    {
      kind: 'action', label: '射击（横置并受 1 伤害，对同地点敌人造成 1 伤害）',
      cost: { action: false, exhaust: true, assetDamage: 1 },
      effect: { type: 'dealDamage', amount: 1, target: 'here' },
    },
  ],
  modifiers: [

  ],
}
