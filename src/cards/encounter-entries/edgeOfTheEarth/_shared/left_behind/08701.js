// 08701 狂乱的探险家（Frenzied Explorer）· 敌人 · left_behind
// 卡面：入场时带有 1 个毁灭标记。强制 - 被击败时：将其上的所有毁灭标记移动到其所在地点。
//   [reaction]在你成功躲避狂乱的探险家、且超过难度至少 2 点后：控制其上的 1 个毁灭标记并翻至线索面；
//   然后，如果其上没有毁灭标记，将其弃掉。
// 读点：入场毁灭放 enemySpawnRule.doomOnSpawn；被躲避后走 evadeSuccess 窗口（combat.js 开窗，context.successBy）。
const CODE = '08701'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '狂乱的探险家被击败：毁灭标记留在所在地点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, context, api }) => {
      const doom = Math.max(0, Number(context.enemy?.doom) || 0)
      if (!doom) return
      const location = state.locations.find(loc => loc.id === context.enemy.location)
      if (location) api.scenario.doomOn(location, doom)
      api.info('「狂乱的探险家」：' + doom + ' 个毁灭标记留在其所在地点。')
    },
  }, {
    kind: 'reaction', trigger: 'evadeSuccess',
    label: '成功躲避且超过难度至少 2 点：控制 1 个毁灭标记翻为线索，清空后弃掉本敌人',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number(context?.successBy) >= 2
      && Number(source.doom) > 0,
    resolve: ({ source, context, api }) => {
      api.removeDoomFromCard(source, 1)
      api.gainClues(context.seat, 1)
      api.info('🔍 「狂乱的探险家」：1 个毁灭标记翻为线索。')
      if (!(Number(source.doom) > 0)) api.discardEnemy?.(source)
    },
  }],
}

