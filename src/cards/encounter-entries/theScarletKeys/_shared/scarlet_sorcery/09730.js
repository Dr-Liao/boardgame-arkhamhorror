// 09730 钥匙充能（Key Charge） · 诡计 · scarlet_sorcery
// 归属：战役共用 · theScarletKeys/_shared/scarletSorcery。
// 卡面：涌动。显现 - 每个 [[结社]] 敌人变换附属到自己的钥匙。
//   Surge. Revelation - Each [[Coterie]] enemy shifts each key attached to it.
// 读点：
//   · 「涌动」由卡面数据提供（content/campaigns/theScarletKeys/card-data.js 的 surge 解析），条目不重复声明；
//   · 特性判定 = _shared.js 的 hasTrait（[[结社]] = Coterie）；
//   · 敌人持有的钥匙 = api.mechanics.tsk.keys.heldBy({ type: 'enemy', enemyId })
//     （tsk-scarlet-keys 的持有关系查询，只读）；
//   · 变换（Shift）= api.mechanics.tsk.keys.shift。卡面是剧情强制翻面（不受「每轮一次」限制），
//     因此用 { force: true }；变换计数仍按轮记账（keyShiftedThisRound）。
import { hasTrait } from '../../../_shared.js'

const CODE = '09730'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const coterie = state.enemies.filter(enemy => hasTrait(enemy, 'Coterie'))
    let shifted = 0
    for (const enemy of coterie) {
      const keys = api.mechanics.tsk.keys.heldBy({ type: 'enemy', enemyId: enemy.id })
      for (const id of keys) {
        api.mechanics.tsk.keys.shift(id, { force: true })
        shifted += 1
      }
    }
    if (shifted) api.info?.(`🔑 「钥匙充能」：${shifted} 把附属在[[结社]]敌人上的钥匙翻面。`)
    else api.info?.('🔑 「钥匙充能」：场上没有附属在[[结社]]敌人上的钥匙。')
    return false
  },
  note: 'approximation: 卡面是强制翻面，调用 keys.shift 时用 force:true（绕过每轮一次的常规限制，仍记录变换计数）；'
    + '「涌动」由卡面数据提供。无缺读点。',
}
