// 08580 无法述说的恶魔之记忆
import { tekeliDeckSize } from '../../_shared.js'

export default {
  code: '08580', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08588' },
  abilities: [{
    kind: 'action', actionKind: 'parley', cost: { action: 2 },
    label: '洗入 3 张忒咳哩-哩：谈判，对它造成 3 伤害',
    criteria: ({ state }) => tekeliDeckSize(state) >= 3,
    resolve: ({ inv, source, api }) => {
      if (api.mechanics.tekeli.shuffleIn(inv.seat, 3)?.length === 3) api.damageEnemy(source, 3, inv.seat)
    },
  }],
}
