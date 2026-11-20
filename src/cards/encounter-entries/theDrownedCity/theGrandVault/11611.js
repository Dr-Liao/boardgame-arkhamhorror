// 11611 潮汐碑匾 · 剧情资产（放在一边；碑匾腔室最后一个线索后交给调查员；结局时仍受控则记录 tidalTablet）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 印刷行为：
//   · [reaction] 你所在地点的淹没等级被提高时：移动到一处连接地点。
//   · [fast] 横置潮汐碑匾：提高你所在地点的淹没等级。然后，选择另一处淹没地点并降低其淹没等级。
// 读点（PRIMITIVES.md「受控剧情资产行动」）：scope storyAsset + controlledAsset:true 后，
// 条目 action/free 能力随 inv.assets 实例进入玩家合法动作与反应窗口（controlledAbilityCards）；
// [fast] 写 kind:'free' + cost.exhaust（abilityShim 把 free 映射为 cost.action=false）；
// [reaction] 走 floodChanged 反应窗口（flood.js 水位变化 → api-mechanics/engine 的 reactionWindow）。
export default {
  code: '11611',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  flags: { tidalTablet: true },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'floodChanged',
      label: '你所在地点淹没等级被提高时：移动到一处连接地点',
      criteria: ({ state, inv, context }) => {
        if (!context || context.location !== inv.location) return false
        const increased = Number(context.delta) > 0
          || (Number.isFinite(context.before) && Number.isFinite(context.after) && context.after > context.before)
        if (!increased) return false
        const here = (state.locations || []).find(location => location.id === inv.location)
        return Boolean(here) && (here.connections || []).length > 0
      },
      resolve: ({ state, inv, api }) => {
        const here = (state.locations || []).find(location => location.id === inv.location)
        const targets = (here?.connections || [])
          .map(id => (state.locations || []).find(location => location.id === id))
          .filter(Boolean)
        if (!targets.length) return
        const picked = targets.length === 1
          ? targets[0].id
          : api.choice?.({
            kind: 'location', source: '11611', seat: inv.seat,
            prompt: '潮汐碑匾：移动到一处连接地点。',
            options: targets.map(location => ({ id: location.id, label: location.name })),
          })
        const target = targets.find(location => location.id === picked) || targets[0]
        api.moveInvestigator(inv.seat, target.id)
        api.info?.(`${inv.name} 横置潮汐碑匾前先随上涨的水位移动到「${target.name}」。`)
      },
    },
    {
      kind: 'free',
      label: '横置潮汐碑匾：提高你所在地点的淹没等级，然后选择另一处淹没地点降低其淹没等级',
      cost: { exhaust: true },
      resolve: ({ state, inv, api }) => {
        const water = api.mechanics?.water
        if (!water) return
        const here = inv.location
        if (!water.canChange(here, 1)) {
          api.info?.(`潮汐碑匾：你所在地点「${api.locName(here)}」的淹没等级无法提高。`)
          return
        }
        water.change(here, 1)
        api.info?.(`潮汐碑匾：提高「${api.locName(here)}」的淹没等级。`)
        const flooded = (state.locations || []).filter(location => location.id !== here
          && water.level(location.id) > 0 && water.canChange(location.id, -1))
        if (!flooded.length) {
          api.info?.('潮汐碑匾：没有其它可以降低淹没等级的地点。')
          return
        }
        const picked = flooded.length === 1
          ? flooded[0].id
          : api.choice?.({
            kind: 'location', source: '11611', seat: inv.seat,
            prompt: '潮汐碑匾：选择另一处淹没地点降低其淹没等级。',
            options: flooded.map(location => ({ id: location.id, label: location.name })),
          })
        const target = flooded.find(location => location.id === picked) || flooded[0]
        water.change(target.id, -1)
        api.info?.(`潮汐碑匾：降低「${target.name}」的淹没等级。`)
      },
    },
  ],
  note: '受控剧情资产：[reaction] 走 floodChanged 反应窗口（淹没提高→移动到连接地点）；'
    + '[fast] 为 kind:free + cost.exhaust，经 controlledAbilityCards 进入合法动作，水位操作走 api.mechanics.water。',
}
