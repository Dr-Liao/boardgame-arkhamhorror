// 04204 华饰弓
// 卡面：使用(1子弹)。华饰弓上仅限1子弹。
// 卡面：[action]花费1子弹：攻击。本次攻击不使用[combat]，改为使用[agility]。你本次攻击得到+2[agility]并造成+2伤害。
// 卡面：[action]：你重新搭上一支箭。在华饰弓上放置1子弹。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04204 华饰弓：敏捷 +2、伤害 +2；[行动]重新搭箭（1 子弹）。

export default {
  code: '04204',
  uses: 1,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action', label: '射箭（敏捷 +2，伤害 +2）', cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 2, damageBonus: 2, skill: 'agility' },
    },
    {
      kind: 'action', label: '重新搭箭',
      resolve: ({ source, api }) => {
        if (!source) return
        api.setAssetUses(source, 1)
        api.info('「华饰弓」重新搭上一支箭。')
      },
    },
  ],
  modifiers: [

  ],
}
