export default { code: '07028', additionalTokenCost: { token: 'curse', operation: 'add', count: 2 }, abilities: [{
  kind: 'played', label: '同地点调查员分配 5 资源', resolve: ({ inv, api }) => {
    const recipients = api.investigatorsAt(inv.location).filter(other => api.canGainResources(other.seat))
    if (!recipients.length) return
    for (let n = 0; n < 5; n++) {
      const seat = recipients.length === 1 ? recipients[0].seat : Number(api.choice({ kind: 'investigator', source: '07028',
        seat: inv.seat, prompt: `分配第 ${n + 1} 个资源。`, options: recipients.map(other => ({ id: String(other.seat), label: other.name })) }))
      api.gainResources(seat, 1)
    }
  },
}] }
