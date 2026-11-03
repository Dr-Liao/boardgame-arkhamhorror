export default { code: '07121', abilities: [
  { kind: 'action', label: '横置水手罗盘：调查，无资源时额外发现1线索',
    cost: { action: true, exhaust: true }, countsAs: 'investigate',
    resolve: ({ inv, source, api }) => api.investigate(inv.seat, { assetId: source.id, trackAssetSource: true, clueIfNoResources: 1 }) },
  { kind: 'free', label: '花费1资源：本次罗盘调查智力+1（每次调查限3次）',
    duringOwnSkillTest: true, cost: { resources: 1 },
    limit: { scope: 'perTest', owner: 'instance', count: 3 },
    criteria: ({ state, source }) => state.skillTest?.source?.assetId === source.id
      && [].concat(state.skillTest?.skill || []).includes('intellect'),
    resolve: ({ api }) => api.addPendingTestBonus(1) },
] }
