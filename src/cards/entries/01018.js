// 01018 巡警
// 卡面：你得到+1[combat]。
// 卡面：[free]弃掉巡警：对你所在地点的1个敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01018 巡警：+1 战斗；免费弃掉自己，对同地点敌人造成 1 点伤害。

export default {
  code: '01018',
  passive: { stats: { combat: 1 } },
  abilities: [
    {
      kind: 'action', label: '射击（对同地点敌人造成 1 伤害）',
      cost: { action: false, discardSelf: true },
      effect: { type: 'dealDamage', amount: 1, target: 'here' },
    },
  ],
  modifiers: [

  ],
}
