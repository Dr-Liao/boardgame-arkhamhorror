// Keep Faith — fast, in any player window; limited physical token pool is authoritative.
export default { code: '07034', abilities: [{ kind: 'played', label: '加入4个祝福', fast: true,
  resolve: ({ api }) => api.chaosTokens.add('bless', 4) }] }
