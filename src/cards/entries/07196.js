export default { code: '07196', abilities: [{ kind: 'commit', label: '封印至多3个非自动失败标记', skill: {
  maxPerTest: 1,
  onCommit: ({ state, inv, source, api }) => {
    const id = api.playerTools.commitmentSourceId(source)
    const tokens = [...new Set(state.chaosBag.filter(token => token !== 'autofail'))]
    const sealed = api.playerTools.sealUpTo(inv.seat, id, tokens, 3)
    api.playerTools.releaseSealedAfterTest(id)
    if (sealed.length === 3 && sealed.every(token => ['+1', '0', 'bless', 'eldersign'].includes(token))) api.drawCards(inv.seat, 2)
  },
} }] }
