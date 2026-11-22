// 98006 理性的挽歌（The Dirge of Reason）· 中立 · 诡计/弱点 · 疯狂 · 替换（罗兰·班克斯）。
// 卡面（cards-data 98006）：
//   罗兰·班克斯牌库专用。替换。
//   显现 - 将你的 2 个线索放置在你所在地点。如果你不能，改为将你所有的线索放置在你所在地点，
//     受到 1 点恐惧，并将理性的挽歌洗回你的牌库。
//
// 引擎读点：
//   · 自定义显现 = weakness 描述子的 resolve（weakness.js#resolveWeaknessBody 优先执行 resolve）；
//   · 「把你的线索放到所在地点」= api.spendClues（个人线索唯一扣减入口，逐张扣）
//     + api.placeClues（locations.js#placeCluesOnLocation，从供应堆放到所在地点）；
//   · 「受到 1 点恐惧」= api.horror（applyHorror 统一入口）；
//   · 「洗回你的牌库」= api.scheduleWeaknessShuffle（weakness 结算后把该卡洗回牌库的读点，
//     与 98021/05015 同一实现）。
const code = '98006'

function moveCluesToLocation(inv, api, amount) {
  const count = Math.min(amount, Number(inv.clues) || 0)
  if (count <= 0) return 0
  api.spendClues(inv.seat, count)
  api.placeClues(inv.seat, count)
  return count
}

export default {
  code,
  abilities: [{
    kind: 'weakness',
    label: '理性的挽歌：把 2 个线索放到所在地点；不足则全放、受 1 恐惧并洗回牌库',
    weakness: { type: 'custom' },
    resolve: ({ inv, api }) => {
      const clues = Number(inv.clues) || 0
      if (clues >= 2) {
        moveCluesToLocation(inv, api, 2)
        api.info('理性的挽歌：将 2 个线索放置在你所在地点。')
        return
      }
      const placed = moveCluesToLocation(inv, api, clues)
      api.horror(inv.seat, 1)
      api.scheduleWeaknessShuffle(inv.seat, code)
      api.info(`理性的挽歌：只能放置 ${placed} 个线索，受到 1 点恐惧并洗回牌库。`)
    },
  }],
  modifiers: [],
}
