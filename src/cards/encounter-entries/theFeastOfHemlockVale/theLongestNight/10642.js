// 10642 埃阿斯
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：每轮你的第一个行动不触发趁乱攻击。[action] 横置埃阿斯：移动（两次，或到任意[[田野]]地点）。[action] 若埃阿斯在你的地点：控制他。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

const CODE = '10642'

function destinations(state, inv, canMoveTo, type) {
  const here = state.locations.find(location => location.id === inv.location)
  return state.locations.filter(location => {
    const matches = type === 'field' ? location.traits?.includes('Field') : here?.connections.includes(location.id)
    return matches && canMoveTo(inv.seat, location.id)
  })
}

function chooseDestination(inv, api, candidates) {
  if (candidates.length < 2) return candidates[0]?.id
  return api.choose({
    kind: 'location', source: CODE, seat: inv.seat,
    prompt: '选择埃阿斯带你前往的地点。',
    options: candidates.map(location => ({ id: location.id, label: location.name || location.id })),
  })
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  teamActivatable: true,
  trackRoundActionHistory: true,
  assetRule: { firstActionNoAoO: 'any' },
  flags: {
    ajax: true,
    noAllySlot: true,
    firstActionNoOpportunity: true,
    moveAbility: true,
    takeControlAction: true
  },
  abilities: [{
    kind: 'action',
    actionKind: 'move',
    label: '横置埃阿斯：移动两次，或移动至任意田野地点',
    cost: { action: 1, exhaust: true },
    criteria: ({ state, inv, source, helpers }) => inv.assets.includes(source)
      && ['near', 'field'].some(type => destinations(state, inv, helpers.canMoveTo, type).length > 0),
    resolve: ({ state, inv, api }) => {
      const fields = destinations(state, inv, api.canMoveTo, 'field')
      const adjacent = destinations(state, inv, api.canMoveTo, 'near')
      const options = []
      if (adjacent.length) options.push({ id: 'near', label: '移动两次' })
      if (fields.length) options.push({ id: 'field', label: '移动至田野' })
      const mode = options.length === 1 ? options[0].id : api.choose({
        kind: 'move', source: CODE, seat: inv.seat, prompt: '选择如何移动。', options,
      })
      const first = chooseDestination(inv, api, mode === 'field' ? fields : adjacent)
      if (!first) return
      api.moveInvestigator(inv.seat, first)
      if (mode !== 'near' || inv.location !== first || inv.defeated || inv.resigned) return
      const second = chooseDestination(inv, api, destinations(state, inv, api.canMoveTo, 'near'))
      if (second) api.moveInvestigator(inv.seat, second)
    },
  }, {
    kind: 'action',
    actionKind: 'activate',
    label: '控制你所在地点的埃阿斯',
    cost: { action: 1 },
    criteria: ({ inv, source }) => !inv.assets.includes(source),
    resolve: ({ inv, source, api }) => api.transferAssetControl(source, inv.seat),
  }],
}
