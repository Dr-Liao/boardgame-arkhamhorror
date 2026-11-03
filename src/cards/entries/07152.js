export default {
  code: '07152',
  abilities: ['intellect', 'combat'].map(skill => ({ kind: 'free', label: `花费 2 资源：本阶段 ${skill} +1`,
    cost: { action: false, resources: 2 }, resolve: ({ inv, source, api }) => api.addEffect({
      duration: 'endOfPhase', controllerSeat: inv.seat, sourceCode: '07152', sourceInstanceId: source.id,
      modifiers: [{ target: `skill:${skill}`, amount: 1 }],
    }) })),
}
