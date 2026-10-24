// 05108 愚人的命运
// 归属：战役共用 · theCircleUndone；遭遇组：inexorable_fate
// 卡面：险境（由 definition.js 从印刷文本解析）。
// 卡面：显现 - 你必须决定（选择一项）：
//   · 如果场上没有其他愚人的命运，将愚人的命运放置入场，放到你的威胁区域。
//   - 威胁区域中有另一张愚人的命运的一位调查员受到 2 点直接伤害。
//   - 在另一张愚人的命运上放置 1 个毁灭标记。

const FATE = '05108'

function copiesInPlay(state) {
  const copies = []
  for (const owner of state.investigators || []) {
    for (const threat of owner.threat || []) {
      if ((threat.originalCode || threat.code) === FATE) copies.push({ owner, threat })
    }
  }
  return copies
}

export default {
  code: '05108',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  encounterResolve(state, inv, card, api) {
    const copies = copiesInPlay(state)
    if (!copies.length) {
      api.threat(inv.seat, FATE)
      api.info?.('场上没有其他「愚人的命运」：本卡进入你的威胁区域。')
      return true
    }
    const options = [
      { id: 'otherInvestigator', label: '威胁区域中有另一张「愚人的命运」的调查员受到 2 点直接伤害' },
      { id: 'otherCopy', label: '在另一张「愚人的命运」上放置 1 个毁灭标记' },
    ]
    const answer = api.choose({
      kind: 'choice', source: FATE, seat: inv.seat, peril: true,
      prompt: '愚人的命运：选择一项。', options,
    })
    if (answer === 'otherInvestigator') {
      const owners = copies.map(entry => entry.owner)
      const target = owners.length === 1 ? owners[0] : owners.find(entry => String(entry.seat) === String(api.choose({
        kind: 'target', source: FATE, seat: inv.seat, peril: true,
        prompt: '选择受到 2 点直接伤害的调查员。',
        options: owners.map(owner => ({ id: String(owner.seat), label: owner.name })),
      }))) || owners[0]
      api.directDamage(target.seat, 2)
      api.info?.(`愚人的命运：${target.name} 受到 2 点直接伤害。`)
    } else {
      const targetCopy = copies.length === 1 ? copies[0].threat : copies.find(entry => String(entry.threat.id) === String(api.choose({
        kind: 'card', source: FATE, seat: inv.seat, peril: true,
        prompt: '选择放置 1 个毁灭标记的「愚人的命运」。',
        options: copies.map(entry => ({ id: String(entry.threat.id), label: `「愚人的命运」（${entry.owner.name}）` })),
      })))?.threat || copies[0].threat
      api.doomOn?.(targetCopy, 1)
      api.info?.('愚人的命运：在另一张「愚人的命运」上放置 1 个毁灭标记。')
    }
    return false // 本卡进遭遇弃牌堆
  },
}
