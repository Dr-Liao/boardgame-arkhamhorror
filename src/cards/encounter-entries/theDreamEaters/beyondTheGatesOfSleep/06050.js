// 06050 魔幻森林·神秘森林（Enchanted Woods · Mystical Forest）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：作为你离开本地点的额外费用，你必须为本地点的每个线索选择并弃掉 1 张手牌。
// 读点：onLeave.effect（引擎 movement.js 直接读 locationRule.onLeave.effect）。
const CODE = '06050'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    onLeave: {
      effect(state, location, api, inv) {
        const clues = Math.max(0, Number(location?.clues || 0))
        if (!clues || !inv) return
        api.info?.(`🌲 神秘森林：离开本地点的额外费用为弃掉 ${clues} 张手牌。`)
        for (let index = 0; index < clues; index += 1) {
          if (!(inv.hand || []).length) break
          api.discardChosen?.(inv.seat, 1, CODE)
        }
      },
    },
  },
}
