export default { code: '07040', abilities: [{ kind: 'weakness', label: '附属到当前密谋并封印旧印',
  weakness: { type: 'custom' },
  resolve: ({ inv, api }) => api.playerTools.attachWeaknessToAgenda(inv.seat, '07040', 'eldersign'),
}] }
