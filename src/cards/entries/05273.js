// 05273 MK1手榴弹（守护者 · 4 经验）
// 卡面：使用(3补给)。如果MK1手榴弹没有补给，将其弃掉。
// 卡面：[action]花费1补给：攻击。你本次攻击得到+2[combat]。如果本次攻击成功，本次攻击不造成标准伤害，
//       改为对受攻击敌人所在地点的每个敌人和每位其他调查员造成2点伤害(所有额外伤害只对被攻击敌人造成)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05273 MK1手榴弹：攻击 +2 战斗；命中后改为对受攻击敌人所在地点的每个敌人与每位其他调查员各 2 点伤害。
//
// 实现备注：攻击检定仍走 api.fight（保留冷漠/反击/攻击展示等战斗规则），用 damageOverride: 0
// 关掉「标准伤害」，检定成功后由本卡逐目标结算 2 点（额外伤害只对被攻击敌人——本卡没有额外伤害源）。

export default {
  code: '05273',
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '花 1 补给：攻击 +2 战斗；命中后对所在地点全体造成 2 伤害',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { uses: 1 },
      resolve: ({ state, inv, api, targetId }) => {
        const enemy = state.enemies.find(item => item.id === targetId)
        if (!enemy) return
        const attackLocation = enemy.location
        const result = api.fight(inv.seat, enemy.id, { combatBonus: 2, damageOverride: 0 })
        if (!result?.success) return
        const enemies = state.enemies.filter(item => item.location === attackLocation).slice()
        for (const other of enemies) {
          if (!state.enemies.includes(other)) continue
          api.damageEnemy(other, 2, inv.seat)
        }
        for (const other of state.investigators.filter(item => item.seat !== inv.seat
          && !item.defeated && !item.resigned && item.location === attackLocation)) {
          api.damage(other.seat, 2)
        }
        api.info(`💣 「MK1手榴弹」在「${api.locationName(attackLocation)}」爆炸：每个敌人与每位其他调查员受到 2 点伤害。`)
      },
    },
  ],
}
