// 50045 比利·库伯（Billy Cooper）· 敌人 · return_cult
// 卡面：生成 - 东城区。强制 - 比利·库伯所在地点有[[怪物]]敌人被击败后：将比利·库伯加入胜利区。
// 读点：forced enemyDefeated 描述子（engine/enemies.js 击败后窗口，context.enemy 为被击败敌人）。
export default {
  code: '50045',
  scope: 'enemy',
  implemented: true,
  abilities: [{
    kind: 'forced',
    trigger: 'enemyDefeated',
    label: '所在地点有[[怪物]]敌人被击败后：将比利·库伯加入胜利区',
    criteria: ({ state, source, context }) => {
      const defeated = context?.enemy
      if (!defeated || defeated === source) return false
      const isMonster = (defeated.traits || []).some(trait => String(trait).toLowerCase() === 'monster')
      if (!isMonster) return false
      const inPlay = (state.enemies || []).some(enemy => enemy.id === source?.id)
      return inPlay && defeated.location === source.location
    },
    resolve: ({ source, api }) => {
      api.scenario.addEnemyToVictory(source)
      api.info('🤝 比利·库伯所在地点的[[怪物]]敌人被击败，比利·库伯加入胜利区。')
    },
  }],
}
