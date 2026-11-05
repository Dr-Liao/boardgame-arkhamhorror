import { hasTrait } from '../../_shared.js'
import { keysAt } from '../../_shared.js'

export default {
  code: '07322', scope: 'location', implemented: true,
  // 背面：伊哈·恩斯雷地点以部分淹没入场（即使未揭示）。读点 locations.js#placeLocation。
  locationRule: { entersPlayFlooded: 1 },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '将紫色钥匙放在宝库：自动躲避并移入一名非精英敌人',
    // 印刷是「团队每场游戏仅限一次」：owner 必须是 group，不是每份物理副本各一次（审计 M34）。
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state, inv }) => keysAt(state, `investigator:${inv.seat}`).includes('purple'),
    resolve: ({ state, inv, source, api }) => {
      if (!api.keys.transfer('purple', `investigator:${inv.seat}`, `location:${source.id}`, { reveal: true })) return
      const enemies = state.enemies.filter(enemy => !enemy.defeated && !enemy.removedFromGame && !enemy.elite && !hasTrait(enemy, 'Elite'))
      if (!enemies.length) return
      const id = api.choice({ kind: 'enemy', source: '07322', seat: inv.seat,
        prompt: '选择任意地点一名非精英敌人，自动躲避并将其移到宝库。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(enemy => enemy.id === id)
      if (!enemy) return
      api.scenario.evadeEnemy(enemy)
      api.scenario.moveEnemy(enemy, source.id)
      api.scenario.preventEnemyReadyNextUpkeep(enemy)
    },
  }],
}
