// 06055 魔幻森林·真菌森林（Enchanted Woods · Fungal Forest）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 你的回合开始时，若你位于本地地点：从混乱袋随机揭示 1 个标记。若揭示的是
//   [skull]、[cultist]、[tablet]、[elder_thing] 或 [auto_fail] 标记，受到 1 点伤害并失去 1 个行动。
// 读点：onTurnBegins 由章节 behavior.turnBegins 分派（自定义 locationRule.onTurnBegins 读点）；
//   随机标记走 api.revealToken（引擎混乱袋管线，含揭示窗口/归还）。
import { activeInvestigators } from '../../_shared.js'

const CODE = '06055'
const BAD_TOKENS = ['skull', 'cultist', 'tablet', 'elderthing', 'elder_thing', 'autofail', 'auto_fail']

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    onTurnBegins(state, inv, location, api) {
      if (!inv || inv.location !== location.id) return
      const token = api.revealToken?.(inv.seat)
      const face = typeof token === 'object' && token !== null ? (token.face || token.id) : token
      api.info?.(`🍄 「真菌森林」：${inv.name} 揭示标记「${api.tokenLabel?.(face) || face}」。`)
      if (!BAD_TOKENS.includes(String(face))) return
      api.damage?.(inv.seat, 1)
      api.loseActions?.(inv.seat, 1)
    },
  },
}
