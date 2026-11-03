export default {
  code: '07021', uses: 3, usesType: 'secrets',
  abilities: [
    { kind: 'free', label: '编码盘：调查（隐藏值 +1）', cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => api.investigate(inv.seat, { shroudMod: 1 }) },
    { kind: 'action', countsAs: 'investigate', label: '编码盘：调查（隐藏值 -2）', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => api.investigate(inv.seat, { shroudMod: -2 }) },
  ],
}
