const uses = (card, type) => card.usesType?.replace(/s$/, '') === type ? card.uses || 0 : card.useTokens?.[type] || 0
const canTake = (card, type) => !card.usesType || card.usesType.replace(/s$/, '') === type
function transfers(state, inv) {
  return inv.assets.flatMap(from => ['secret', 'charge'].flatMap(type => uses(from, type) > 0
    ? state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      .flatMap(other => other.assets.filter(to => to.id !== from.id && canTake(to, type)).map(to => ({ from, to, type }))) : []))
}
export default {
  code: '07111', uses: 3, usesType: 'secrets',
  abilities: [{ kind: 'free', label: '横置：移动 1 秘密或充能到另一个支援', cost: { action: false, exhaust: true },
    criteria: ({ state, inv }) => transfers(state, inv).length > 0,
    resolve: ({ state, inv, api }) => {
      const options = transfers(state, inv)
      const id = options.length === 1 ? 0 : Number(api.choice({ kind: 'asset', source: '07111', seat: inv.seat,
        prompt: '选择从哪个支援移动秘密／充能到哪个支援。', options: options.map(({ from, to, type }, i) => ({ id: String(i),
          label: `${api.cardName(from.code)} → ${api.cardName(to.code)}（${type}）` })) }))
      const option = options[id]
      if (option) api.useTokens.move(option.from.id, option.to.id, option.type, 1)
    } }],
}
