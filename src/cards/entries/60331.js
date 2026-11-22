// 60331 贝雷塔M1918冲锋枪
// 卡面：使用(4子弹)。
// 卡面：[action]横置贝雷塔M1918冲锋枪并花费1子弹：攻击。本次攻击你得到+4[combat]并造成+1伤害。如果你成功超过难度至少2点，执行以下一项：重整贝雷塔M1918冲锋枪，或本次攻击额外造成+1伤害(如果你成功超过难度至少4点，改为执行两项)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60331',
  uses: 4,
  usesType: 'ammo',
  abilities: [{
    kind: 'action', countsAs: 'fight',
    label: '横置并花费 1 子弹：战斗 +4、伤害 +1；超过 2 点时重整或额外 +1 伤害，超过 4 点都做',
    cost: { action: true, exhaust: true, uses: 1 }, target: { kind: 'enemy' },
    resolve: ({ inv, source, target, api }) => {
      if (!target?.entity) return
      api.fight(inv.seat, target.entity.id, {
        combatBonus: 4, damageBonus: 1,
        damageBonusForResult: result => {
          const margin = result.value - result.difficulty
          if (margin < 2) return 0
          const choice = margin >= 4 ? 'both' : api.choice({
            kind: 'effect', source: '60331', seat: inv.seat, prompt: '选择成功奖励。',
            options: [{ id: 'ready', label: '重整步枪' }, { id: 'damage', label: '本次攻击额外 +1 伤害' }],
          })
          if (choice !== 'damage' && !api.assetsCannotReady(inv)) api.ready(source)
          return choice === 'ready' ? 0 : 1
        },
      })
    },
  }],
}
