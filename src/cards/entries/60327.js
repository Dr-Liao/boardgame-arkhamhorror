// 60327 神射手
// 卡面：[reaction]你使用一张[[枪械]]支援的攻击能力时，横置神射手：选择以下一项或两项：
// 卡面：- 本次攻击不使用[combat]，改为使用[agility]。本次攻击中对你的[combat]的所有修正，改为修正你的[agility]。
// 卡面：- 本次攻击不使用被攻击敌人的攻击值，改为使用其躲避值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60327',
  abilities: [{
    kind: 'reaction',
    trigger: 'activateFirearmFight',
    label: '横置：改用敏捷、改用敌人躲避值，或同时应用两项',
    cost: { exhaust: true },
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, context, helpers }) => context.seat === inv.seat
      && helpers.cardTraits(context.assetCode).some(trait => trait.toLowerCase() === 'firearm'),
    resolve: ({ state, inv, context, api }) => {
      const target = state.enemies.find(enemy => enemy.id === context.redirectEnemyId) || context.enemy
      if (target?.evade == null) {
        api.configureWeaponFight(context, { useAgility: true })
        return
      }
      const selection = api.choice({ kind: 'effect', source: '60327', seat: inv.seat,
        prompt: '选择本次攻击要应用的修正。',
        options: [
          { id: 'agility', label: '以敏捷攻击，战斗修正应用于敏捷' },
          { id: 'evade', label: '以敌人的躲避值作为难度' },
          { id: 'both', label: '同时应用两项' },
        ],
      })
      api.configureWeaponFight(context, {
        useAgility: selection !== 'evade',
        enemyEvade: selection !== 'agility',
      })
    },
  }],
}
