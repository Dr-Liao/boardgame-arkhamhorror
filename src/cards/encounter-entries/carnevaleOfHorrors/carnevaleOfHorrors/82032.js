// 82032 迷失威尼斯 · 诡计（恐怖狂欢节）
// 卡面：险境。显现 - 你必须要么受到 2 点恐惧，要么移动到与你所在地点相对（across from）的地点。
// 读点：api.choose（二选一）、api.horror、api.moveTo（对面地点 = 场景圆环上距离一半的地点）。
function acrossFrom(state, locationId) {
  const ring = state.scenarioFlags?.carnevale?.ring || []
  if (!ring.length) return null
  const index = ring.indexOf(locationId)
  if (index < 0) return null
  return ring[(index + Math.floor(ring.length / 2)) % ring.length]
}

export default {
  code: '82032',
  scope: 'treachery',
  implemented: true,
  flags: { peril: true },
  encounterResolve(state, inv, card, api) {
    const answer = api.choose?.({
      kind: 'choice', seat: inv.seat, source: '82032', prompt: '迷失威尼斯：选择一项。',
      options: [
        { id: 'horror', label: '受到 2 点恐惧' },
        { id: 'move', label: '移动到对面地点' },
      ],
    })
    if (answer === 'move') {
      const destination = acrossFrom(state, inv.location)
      if (destination && destination !== inv.location) {
        api.moveTo?.(inv.seat, destination)
        api.info?.('🎭 迷失威尼斯：你移动到对面的地点。')
        return true
      }
    }
    api.horror?.(inv.seat, 2)
    api.info?.('🎭 迷失威尼斯：你受到 2 点恐惧。')
    return true
  },
  note: '二选一由 encounterResolve 结算；对面地点 = 场景圆环上距离一半的地点（参考 across-from 口径）。',
}
