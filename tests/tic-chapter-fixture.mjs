import { fixture } from './core-fixture.mjs'
import { contentRegistry } from '../content/registered.js'
import { manifest as campaign } from '../content/campaigns/theInnsmouthConspiracy/manifest.js'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { registerCampaignScenarios, startScenario } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

// P8：《印斯茅斯暗潮》八章已在 content/registered.js 静态注册（生产 playable），
// 夹具不再用 developmentChapter + registerContentBundle 做进程内临时注册；
// 引擎的关卡表（SCENARIOS）仍按战役显式接线，读取同一份注册表数据。
// 若本夹具被用于未注册 TIC 的最小注册表进程，这里会明确失败而不是静默降级。
if (!contentRegistry.getCampaign(campaign.id)) throw new Error('测试夹具要求生产注册表已包含 theInnsmouthConspiracy')
registerCampaignScenarios(campaign.id)

export function chapterFixture(id, count = 1, { records = {}, memoriesRecovered = [], investigatorRecords = {} } = {}) {
  const state = fixture('01001', count)
  state.campaign.id = campaign.id
  state.campaign.recordSchema = { ...campaign.recordSchema }
  state.campaign.flow = { nodeId: id, history: [{ nodeId: id, visit: 1 }], visits: { [id]: 1 } }
  Object.assign(state.campaign.records, records, { memoriesRecovered: [...memoriesRecovered] })
  for (const [seat, values] of Object.entries(investigatorRecords)) Object.assign(state.campaign.investigators[seat], values)
  const index = chapters.findIndex(chapter => chapter.id === id)
  if (index < 0) throw new RangeError(`Unknown chapter ${id}`)
  const execute = draft => startScenario(draft, index, [])
  resolveTransaction(state, 0, { action: 'testChapterStart' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 100) throw new Error('TIC chapter setup choice loop')
    const choice = state.pendingChoice
    const option = choice.options.find(o => ['done', 'skip', 'self'].includes(o.id)) || choice.options[0]
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id }, execute)
  }
  for (const inv of state.investigators) { inv.actionsLeft = 20; inv.resources = 30 }
  state.chaosBag = ['0']
  return state
}
