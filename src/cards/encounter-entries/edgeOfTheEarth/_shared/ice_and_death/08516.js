// 08516 无限恐惧症（Apeirophobia）· 诡计 · ice_and_death
// 卡面：显现 - 检定[willpower](X)，X 为你所在地点的庇护值。失败你必须选择一项：
//   · 每低于难度 1 点受到 1 点恐惧；· 将你的 2 个线索放到你所在地点；· 在混乱袋里加入 1 个[frost]。
// 读点：庇护值读 state.locations[].shelter（P2 location.shelter 的印刷数据口径）。
export default {
  code: '08516', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const location = state.locations.find(loc => loc.id === inv.location)
    const difficulty = Math.max(0, Number(location?.shelter) || 0)
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (result.success) return
      const failedBy = Math.max(0, difficulty - Number(result.value || 0))
      const options = [
        { id: 'horror', label: '每低于难度 1 点受到 1 点恐惧（' + failedBy + ' 点）' },
        { id: 'clues', label: '将你的 2 个线索放到所在地点' },
        { id: 'frost', label: '在混乱袋里加入 1 个 [frost] 标记' },
      ]
      const pick = api.choice({ kind: 'effect', source: '08516', seat: inv.seat,
        prompt: '「无限恐惧症」：选择失败代价。', options })
      if (pick === 'horror') api.horror(inv.seat, failedBy)
      else if (pick === 'clues') {
        const moved = Math.min(2, Number(inv.clues) || 0)
        api.returnClueToLocation(inv.seat, moved)
      } else {
        const added = api.mechanics.frost.add(1)
        api.info(added ? '🧊 「无限恐惧症」：加入 1 个 [frost] 标记。' : '寒霜标记池已满。')
      }
    })
    return false
  },
}

