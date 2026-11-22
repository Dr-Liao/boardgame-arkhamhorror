// 60306 毛瑟C96手枪
// 卡面：使用(5子弹)。
// 卡面：[action]横置毛瑟C96手枪并花费1子弹：攻击。本次攻击你得到+1[combat]并造成+1伤害。如果你成功超过难度至少2点，你可以重整毛瑟C96手枪，或获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60306',
  uses: 5,
  usesType: 'ammo',
  abilities: [{
    kind: 'action', countsAs: 'fight',
    label: '横置并花费 1 子弹：战斗 +1、伤害 +1；超过 2 点则重整或获得 1 资源',
    cost: { action: true, exhaust: true, uses: 1 }, target: { kind: 'enemy' },
    resolve: ({ inv, source, target, api }) => {
      if (!target?.entity) return
      api.fight(inv.seat, target.entity.id, {
        combatBonus: 1, damageBonus: 1,
        onSuccess: ({ result }) => {
          if (result.value - result.difficulty < 2) return
          const choice = api.choice({
            kind: 'effect', source: '60306', seat: inv.seat, prompt: '选择成功奖励。',
            options: [{ id: 'ready', label: '重整手枪' }, { id: 'resource', label: '获得 1 资源' }],
          })
          if (choice === 'ready' && !api.assetsCannotReady(inv)) api.ready(source)
          if (choice === 'resource') api.gainResources(inv.seat, 1)
        },
      })
    },
  }],
}
