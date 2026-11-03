export default { code: '07016', investigator: { commitResourceCostPerIcon: 1 },
  abilities: [{ kind: 'weakness', label: '放入威胁区', weakness: { type: 'threat' } },
    { kind: 'action', label: '花费两次行动：弃掉塞壬呼唤', cost: { action: 2 },
      resolve: ({ source, api }) => api.removeThreat(source) }] }
