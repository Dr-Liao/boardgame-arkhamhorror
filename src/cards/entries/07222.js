export default {
  code: '07222', abilities: [{ kind: 'commit', skill: {
    destination: ({ inv, result, api }) => result?.drawn?.includes('curse') && api.choice({ kind: 'card', seat: inv.seat, source: '07222',
      prompt: '本次检定揭示了诅咒：将鬼灵精怪返回手牌？', canSkip: true,
      options: [{ id: 'return', label: '返回手牌' }, { id: 'skip', label: '弃掉' }] }) === 'return' ? 'hand' : 'discard',
  } }],
}
