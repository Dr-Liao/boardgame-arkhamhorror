export default {
  code: '51011',
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'discardAfterResolve' },
    label: '牌库顶的弱点正常抽取，否则移出该卡及自己拥有的同编号副本',
    resolve: ({ inv, api }) => {
      const code = inv.deck.at(-1)
      if (!code) return
      if (api.isWeaknessCode(code)) api.drawCardsLogged(inv.seat, 1)
      else api.removeOwnedCopies(inv.seat, code)
    },
  }],
}
