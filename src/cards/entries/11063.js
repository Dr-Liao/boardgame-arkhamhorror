const code = '11063'

export default {
  code,
  abilities: [
    {
      kind: 'reaction', trigger: 'harmDealt', fromHand: true, quickEvent: true, range: 'anywhere',
      label: '同地点或连接地点的调查员可转给你最多 5 资源，取消等量伤害或恐惧',
      criteria: ({ state, inv, context }) => {
        const recipient = state.investigators[context.seat]
        return recipient && (recipient.location === inv.location
          || state.locations.find(item => item.id === inv.location)?.connections?.includes(recipient.location))
          && (context.damage > 0 || context.horror > 0) && recipient.resources > 0
      },
      resolve: ({ state, inv, context, api }) => {
        const recipient = state.investigators[context.seat]
        const damage = context.damage || 0
        const horror = context.horror || 0
        const maximum = Math.min(5, recipient.resources)
        const options = [{ id: '0:0', label: '不取消' }]
        for (let d = 0; d <= Math.min(damage, maximum); d++) {
          for (let h = 0; h <= Math.min(horror, maximum - d); h++) {
            if (!d && !h) continue
            const transfer = recipient.seat === inv.seat ? '' : `转移 ${d + h} 资源，`
            options.push({ id: `${d}:${h}`, label: `${transfer}取消 ${d} 点伤害及 ${h} 点恐惧` })
          }
        }
        if (options.length === 1) return
        const id = api.choice({
          kind: 'harm', source: code, seat: recipient.seat, prompt: '选择要取消的伤害和恐惧。',
          options,
        })
        if (!options.some(item => item.id === id)) return
        const [cancelDamage, cancelHorror] = id.split(':').map(Number)
        const amount = cancelDamage + cancelHorror
        if (!amount || (recipient.seat !== inv.seat && api.transferResources(recipient.seat, inv.seat, amount) !== amount)) return
        api.setReactionFlag('damage', damage - cancelDamage, context)
        api.setReactionFlag('horror', horror - cancelHorror, context)
        api.noteCancelled('harm')
      },
    },
  ],
}
