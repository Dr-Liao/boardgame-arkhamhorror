// 11696 河岸城（废墟） · 地点（[[废墟]]面）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：河岸城（废墟） 的[[废墟]]版本；由议程 11689 背面在完全淹没时与正面地点交换入场（未揭示面朝上）。
// 印刷：shroud 从卡表读取；每调查员 1 条线索；特性 [[Arkham]][[Ruined]]。
// 读点：behavior.swapToRuined（交换）；behavior.isRuined（flags.ruined）。
const CODE = '11696'
const drainable = (state, source, level) => state.locations
  .filter(location => (location.id === source.id || source.connections?.includes(location.id)) && level(location.id) > 0)

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { ruined: true },
  abilities: [{
    kind: 'action', actionKind: 'activate', cost: { action: 1 },
    label: '检定敏捷或智识（3）：降低本地点或相邻地点的淹没等级',
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state, source, helpers }) => drainable(state, source, helpers.floodLevel).length > 0,
    resolve: ({ state, inv, source, api }) => {
      const skill = api.choice({
        kind: 'skill', source: CODE, seat: inv.seat, prompt: '选择排水检定的技能。',
        options: [{ id: 'agility', label: '敏捷' }, { id: 'intellect', label: '智识' }],
      })
      api.test(inv.seat, skill, 3, {
        source: { type: 'location', code: CODE },
        resolve: result => {
          if (!result.success) return
          const water = api.mechanics.water
          const locations = drainable(state, source, water.level)
          if (!locations.length) return
          const id = locations.length === 1 ? locations[0].id : api.choice({
            kind: 'location', source: CODE, seat: inv.seat, prompt: '选择一个地点降低淹没等级。',
            options: locations.map(location => ({ id: location.id, label: location.name })),
          })
          water.change(id, -1)
        },
      })
    },
  }],
}
