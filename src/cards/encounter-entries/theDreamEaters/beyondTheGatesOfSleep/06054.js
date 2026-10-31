// 06054 魔幻森林·月亮树（Enchanted Woods · The Moon-Tree）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 你进入本地地点后：你必须选择受到 2 点恐惧，或失去所有剩余行动。
// 读点：onEnter.effect（引擎 movement.js 直接读 locationRule.onEnter.effect）。
const CODE = '06054'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (!inv) return
        const answer = api.choice?.({
          kind: 'story', source: CODE, seat: inv.seat,
          prompt: '月亮树下，你必须付出代价：受到 2 点恐惧，或失去所有剩余行动。',
          options: [
            { id: 'horror', label: '受到 2 点恐惧' },
            { id: 'loseActions', label: '失去所有剩余行动' },
          ],
        })
        if (answer === 'loseActions') {
          api.loseActions?.(inv.seat, Number(inv.actionsLeft || 0))
          api.info?.(`🌙 ${inv.name} 在月亮树下失去了所有剩余行动。`)
          return
        }
        api.horror?.(inv.seat, 2)
        api.info?.(`🌙 ${inv.name} 在月亮树下受到 2 点恐惧。`)
      },
    },
  },
}
