// 60321 毛瑟C96手枪
// 卡面：使用(5子弹)。
// 卡面：[action]横置毛瑟C96手枪并花费1子弹：攻击。本次攻击你得到+2[combat]并造成+1伤害。如果你成功超过难度至少2点，执行以下一项：重整毛瑟C96手枪，或获得1资源(如果你成功超过难度至少4点，改为执行两项)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60321',
  uses: 5,
  usesType: 'ammo',
  abilities: [{
    kind: 'action', countsAs: 'fight',
    label: '横置并花费 1 子弹：战斗 +2、伤害 +1；超过 2 点时重整或获得资源，超过 4 点则都做',
    cost: { action: true, exhaust: true, uses: 1 }, target: { kind: 'enemy' },
    resolve: ({ inv, source, target, api }) => {
      if (!target?.entity) return
      api.fight(inv.seat, target.entity.id, {
        combatBonus: 2, damageBonus: 1,
        onSuccess: ({ result }) => {
          const margin = result.value - result.difficulty
          if (margin < 2) return
          const choice = margin >= 4 ? 'both' : api.choice({
            kind: 'effect', source: '60321', seat: inv.seat, prompt: '选择成功奖励。',
            options: [{ id: 'ready', label: '重整手枪' }, { id: 'resource', label: '获得 1 资源' }],
          })
          if (choice !== 'resource' && !api.assetsCannotReady(inv)) api.ready(source)
          if (choice !== 'ready') api.gainResources(inv.seat, 1)
        },
      })
    },
  }],
}
