// 09063 非分之财（Embezzled Treasure）· 游荡者（Rogue）资产 · 0 经验 · 道具 · 违法。
//
// 卡面：[fast] 横置非分之财：从你资源池中将最多 2 资源移动到非分之财上（最多 10 资源）。
//       强制 - 在你撤退或游戏结束时：非分之财上每有 2 资源，选择一位调查员，该调查员在本剧本的
//       下一场冒险开始时资源池中有额外 1 资源。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
const code = '09063'
const capacity = 10
const storedResources = source => source.resources ?? (source.usesType === 'resources' ? source.uses || 0 : 0)

const candidates = state => state.investigators.filter(inv => !inv.storyInvestigator
  && inv.defeatCause !== 'killed' && state.campaign.investigators?.[inv.seat]?.status === 'active')

export default {
  code,
  abilities: [
    {
      kind: 'free',
      cost: { exhaust: true },
      label: '横置：把资源池中至多 2 个资源移到卡上（最多 10 个）',
      criteria: [({ inv, source }) => inv.resources > 0 && storedResources(source) < capacity],
      resolve: ({ inv, source, api }) => {
        const maximum = Math.min(2, capacity - storedResources(source), inv.resources)
        if (maximum < 1) return false
        const amount = maximum === 1 ? 1 : Number(api.choice({
          kind: 'amount', source: code, seat: inv.seat,
          prompt: '要从资源池移几个资源到非分之财？',
          options: Array.from({ length: maximum }, (_, index) => ({
            id: String(index + 1), label: `移动 ${index + 1} 个资源`,
          })),
        }))
        if (source.resources == null && storedResources(source) > 0) {
          api.placeResourceOnCard(source, storedResources(source))
          api.setAssetUses(source, 0)
        }
        return api.moveResourcesToAsset(inv.seat, source, amount) === amount
      },
    },
    {
      kind: 'forced',
      trigger: ['investigatorResigning', 'scenarioEnding'],
      limit: 'oncePerGame',
      label: '撤退或游戏结束时：卡上每有 2 资源，使一位调查员下一场冒险起始资源 +1',
      criteria: [({ state, inv, source, context }) => storedResources(source) >= 2
        && (context.when === 'scenarioEnding' || context.seat === inv.seat) && candidates(state).length > 0],
      resolve: ({ state, inv, source, api }) => {
        const eligible = candidates(state)
        const units = Math.floor(storedResources(source) / 2)
        const awards = new Map()
        for (let index = 0; index < units; index++) {
          const seat = eligible.length === 1 ? eligible[0].seat : Number(api.choice({
            kind: 'investigator', source: code, seat: inv.seat,
            prompt: `选择第 ${index + 1} 个起始资源的获得者（共 ${units} 个）。`,
            options: eligible.map(target => ({ id: String(target.seat), label: target.name })),
          }))
          if (!eligible.some(target => target.seat === seat)) return false
          awards.set(seat, (awards.get(seat) || 0) + 1)
        }
        const visit = state.campaign.flow?.history?.length || 0
        const receipt = `embezzled-${state.scenario.id}-${visit}-${source.id}`
        for (const [seat, resources] of awards) {
          api.mechanics.startingAdjustments.defer(seat, { receipt, resources })
        }
      },
    },
  ],
  modifiers: [],
}
