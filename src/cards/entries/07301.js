export default {
  code: '07301', additionalTokenCost: { token: 'bless', operation: 'pay', count: 10, sealed: true },
  abilities: [{ kind: 'played', label: '移除场上一张卡牌上的 1 个毁灭', resolve: ({ state, inv, api }) => {
    const targets = [...state.locations, ...state.enemies, ...(state.acts || []), ...(state.agendas || []),
      ...state.investigators.flatMap(other => [...other.assets, ...other.threat])].filter(card => card.doom > 0)
    const options = [...(state.doom > 0 ? [{ id: 'agenda', label: '当前密谋' }] : []),
      ...targets.map((card, i) => ({ id: String(i), label: card.name || api.cardName(card.code) || card.id }))]
    if (!options.length) return
    const id = options.length === 1 ? options[0].id : api.choice({ kind: 'card', source: '07301', seat: inv.seat,
      prompt: '选择移除 1 个毁灭的卡牌。', options })
    if (id === 'agenda') api.removeDoom(1)
    else api.removeDoomFromCard(targets[Number(id)], 1)
  } }],
}
