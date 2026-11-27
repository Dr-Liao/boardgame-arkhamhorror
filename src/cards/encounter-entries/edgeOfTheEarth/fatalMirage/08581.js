// 08581 可怕发现之记忆
import { frostPoolRoom } from '../../_shared.js'

export default {
  code: '08581', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08591' },
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '加入 1 个寒霜：谈判，对它造成 4 伤害',
    criteria: ({ state }) => frostPoolRoom(state) > 0,
    resolve: ({ inv, source, api }) => {
      if (api.mechanics.frost.add(1)) api.damageEnemy(source, 4, inv.seat)
    },
  }],
}
