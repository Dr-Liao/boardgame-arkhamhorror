import { poolTokenRoom } from '../../engine/chaos-token-pool.js'

function localHorror(state, inv) {
  return state.investigators.filter(owner => owner.location === inv.location && !owner.defeated && !owner.resigned)
    .reduce((sum, owner) => sum + (owner.horror || 0) + owner.assets.reduce((total, asset) => total + (asset.horror || 0), 0), 0)
}
export default { code: '07308', playCondition: [{ when: ({ state, inv }) =>
  Math.min(poolTokenRoom(state, 'curse'), poolTokenRoom(state, 'bless')) > 0
    || (localHorror(state, inv) > 0 && state.chaosBag.includes('curse') && state.chaosBag.includes('bless')),
  message: '无法添加成对标记，也无法移除成对标记来治疗恐惧',
}], abilities: [{ kind: 'played', label: '添加诅咒与祝福，或移除两者治疗恐惧', resolve: ({ state, inv, api }) => {
  const addMax = Math.min(api.chaosTokens.room('curse'), api.chaosTokens.room('bless'))
  const healMax = Math.min(localHorror(state, inv), state.chaosBag.filter(token => token === 'curse').length,
    state.chaosBag.filter(token => token === 'bless').length)
  const modes = [...(addMax ? [{ id: 'add', label: '添加等量诅咒与祝福' }] : []),
    ...(healMax ? [{ id: 'heal', label: '移除等量诅咒与祝福，治疗恐惧' }] : [])]
  if (!modes.length) return
  const mode = modes.length === 1 ? modes[0].id : api.choice({ kind: 'effect', source: '07308', seat: inv.seat,
    prompt: '选择平衡仪式的效果。', options: modes })
  const max = mode === 'add' ? addMax : healMax
  const n = Number(api.choice({ kind: 'effect', source: '07308', seat: inv.seat, prompt: '选择 X。',
    options: Array.from({ length: max }, (_, i) => ({ id: String(i + 1), label: String(i + 1) })) }))
  if (mode === 'add') { api.chaosTokens.add('curse', n, { exact: true }); api.chaosTokens.add('bless', n, { exact: true }); return }
  api.chaosTokens.pay('curse', n, { exact: true }); api.chaosTokens.pay('bless', n, { exact: true })
  for (let i = 0; i < n; i++) {
    const targets = api.investigatorsAt(inv.location).flatMap(owner => [
      ...((owner.horror || 0) > 0 ? [{ id: `investigator:${owner.seat}`, label: owner.name, owner }] : []),
      ...owner.assets.filter(asset => (asset.horror || 0) > 0).map(asset => ({ id: `asset:${asset.id}`, label: api.cardName(asset.code), owner, asset })),
    ])
    if (!targets.length) break
    const id = api.choice({ kind: 'target', source: '07308', seat: inv.seat, prompt: `分配第 ${i + 1} 点恐惧治疗。`,
      options: targets.map(target => ({ id: target.id, label: target.label })) })
    const chosen = targets.find(target => target.id === id)
    if (chosen?.asset) api.healAsset(chosen.asset, { horror: 1, owner: chosen.owner })
    else if (chosen) api.healHorror(chosen.owner.seat, 1)
  }
} }] }
