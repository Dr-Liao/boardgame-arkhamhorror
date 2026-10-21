// 04305 火焰喷射器
// 卡面：使用(4子弹)。
// 卡面：[action]花费1子弹：攻击。本次攻击选择的敌人必须是与你交战的敌人中攻击值最高的。你本次攻击得到+4[combat]。如果本次攻击成功，你可以不对其造成基础伤害，改为对所有与你交战的敌人分配总计最多4点伤害(如有任意额外的伤害，则加到此伤害上)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04305 火焰喷射器：攻击「战斗值最高的交战敌人」+4（旧 flamethrower）。

export default {
  code: '04305',
  uses: 4,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action', label: '喷射火焰', cost: { action: true, uses: 1 }, countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const engaged = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat)
        if (!engaged.length) { api.info('没有与你交战的敌人。'); return }
        const highest = engaged.reduce((left, right) => (api.enemyFight(right) > api.enemyFight(left) ? right : left))
        api.fight(inv.seat, highest.id, { combatBonus: 4, flamethrowerSpread: 4, sourceCode: '04305' })
      },
    },
  ],
  modifiers: [

  ],
}
