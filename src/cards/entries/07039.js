export default { code: '07039', abilities: [{ kind: 'weakness', label: '加入5个诅咒', weakness: { type: 'custom' },
  resolve: ({ api }) => api.chaosTokens.add('curse', 5) }] }
