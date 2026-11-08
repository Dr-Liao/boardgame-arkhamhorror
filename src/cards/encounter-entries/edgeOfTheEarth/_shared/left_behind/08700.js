// 08700 迷失的研究员（Lost Researcher）· 敌人 · left_behind
// 卡面：生成 - 任意地点（如可能，则生成在无人地点）。入场时带有 1 个毁灭标记。
//   强制 - 被击败时：将其上的所有毁灭标记移动到其所在地点。
//   [action]：谈判。检定[willpower]或[intellect](3)。成功：控制其上的 1 个毁灭标记并将其翻至
//   线索面。然后，如果其上没有毁灭标记，将其弃掉。
// 读点：谈判行动走 abilities（actionKind:'parley'）；毁灭/线索走 api.scenario.doomOn / api.gainClues；
//   入场毁灭数据放 enemySpawnRule.doomOnSpawn（enemies.js#spawnEnemy 通用读点）。
const CODE = '08700'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '迷失的研究员被击败：将其毁灭标记移到所在地点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, source, context, api }) => {
      const doom = Math.max(0, Number(context.enemy?.doom) || 0)
      if (!doom) return
      const location = state.locations.find(loc => loc.id === context.enemy.location)
      if (location) api.scenario.doomOn(location, doom)
      api.info('「迷失的研究员」：' + doom + ' 个毁灭标记留在其所在地点。')
    },
  }, {
    kind: 'action', actionKind: 'parley', label: '谈判 意志/智力(3)：控制 1 个毁灭标记翻为线索；清空后弃掉本敌人',
    resolve: ({ state, inv, source, api }) => {
      if (!(Number(source.doom) > 0)) return
      const skill = api.choice({ kind: 'skill', source: CODE, seat: inv.seat, prompt: '选择谈判检定技能。',
        options: [{ id: 'willpower', label: '意志(3)' }, { id: 'intellect', label: '智力(3)' }] })
      if (!['willpower', 'intellect'].includes(skill)) return
      api.test(inv.seat, skill, 3, { source: { type: 'enemy', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.removeDoomFromCard(source, 1)
        api.gainClues(inv.seat, 1)
        api.info('🔍 「迷失的研究员」：1 个毁灭标记翻为线索。')
        if (!(Number(source.doom) > 0)) api.discardEnemy?.(source)
      } })
    },
  }],
}

