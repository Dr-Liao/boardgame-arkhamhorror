import { ALL_CARDS } from '../cards-data.js'
import { registeredEntry } from '../../engine/ability.js'
import { hasTrait } from '../../engine/matcher.js'

const code = '11111'

function testedTool(state) {
  const assetId = state.skillTest?.assetSourceId ?? state.skillTest?.source?.assetId
  if (!assetId) return null
  const asset = state.investigators.flatMap(owner => owner.assets).find(card => card.id === assetId)
  return hasTrait(ALL_CARDS[asset?.code], 'Tool') ? asset : null
}

function failureReward(state, inv, api) {
  const tool = testedTool(state)
  const printed = registeredEntry(tool?.code)
  const options = []
  if (tool?.usesType === 'supplies' && tool.uses < (printed?.uses || 0)) {
    options.push({ id: 'replenish', label: `为「${api.cardName(tool.code)}」补充 1 补给` })
  }
  if (api.canGainResources(inv.seat)) options.push({ id: 'resource', label: '获得 1 资源' })
  if (!options.length) return
  const answer = options.length === 1 ? options[0].id : api.choice({
    kind: 'effect', source: code, seat: inv.seat, prompt: '选择埋头苦干的失败补偿。', options,
  })
  if (answer === 'replenish') api.addUses(tool, 1)
  else api.gainResources(inv.seat, 1)
}

export default {
  code,
  trackTestAssetSource: true,
  abilities: [{
    kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'],
    duringOwnSkillTest: true,
    cost: { exhaust: true },
    label: '在工具支援的检定中横置：技能值 +2；失败时补给该支援或获得资源',
    criteria: ({ state }) => testedTool(state) != null,
    resolve: ({ state, inv, api }) => {
      api.addPendingTestBonus(2)
      api.afterCurrentTest(result => {
        if (result?.success === false) failureReward(state, inv, api)
      })
    },
  }],
}
