import { declareScenario } from '../../../../scenario-declaration.js'
import { LITA_CHANDLER_CODE } from '../../../../../src/cards/card-rules.js'
import { actReveal, agendaForced, agendaReveal } from './act-reveal.js'

// Phase 3（D3/D4）：布置、推进常量与结局结果都是声明。
export const behavior = declareScenario({
  id: 'theGathering',
  data: { houseFateChoice: true, roundEndActIndex: 1, litaParleyActIndex: 2 },
  setup: { locations: ['study'] },
  hooks: {
    actReveal, agendaForced, agendaReveal,
    investigatorEntryError(state, location) {
      // Also enforce the act gate for old saves that revealed the Parlor too early.
      if (location.id === 'parlor' && (state.actIndex < 2 || !location.revealed)) {
        return '灼热屏障尚未解除，不能进入客厅'
      }
      return null
    },
    // 客厅谈判（取得丽塔控制权）：条件不满足时也返回，带上缺什么，AI 才知道她在哪个地点。
    actions(state, inv) {
      const parlorId = state.locations.find(location => location.parley)?.id
      const lita = (state.storyAssets || []).find(asset => asset.code === LITA_CHANDLER_CODE && asset.controllerSeat == null)
      if (!parlorId || !lita) return []
      const litaAt = state.locations.find(location => location.id === lita.location)?.name || lita.location
      const here = inv.location === parlorId && lita.location === inv.location
      return [{ action: 'parleyLita', label: '🤝 谈判丽塔·钱德勒（智识 4，取得控制权）',
        reason: state.actIndex !== 2 ? '需要推进到幕三' : here ? null : `需要与丽塔位于同一地点（她在「${litaAt}」）` }]
    },
    // 结局 3 的阵亡必须先于「丽塔由谁携带」的询问，因此这一段保持命令式；
    // 其余记录/创伤写成声明式条目（D4）。
    resolution(state, key, events, api) {
      if (key === 'r3') {
        state.campaign.records.litaForcedOthers = true
        for (const inv of state.investigators) {
          if (!inv.resigned) state.campaign.investigators[inv.seat].status = 'killed'
        }
      }
      if (key !== 'r2') api.addLitaToCampaign(state)
      return {
        bonus: 2,
        award: key !== 'r3',
        seatBonus: seat => key === 'r2' && seat === state.campaign.leadSeat ? 1 : 0,
        effects: [
          { record: { houseBurned: true }, when: { resolution: 'r1' } },
          { record: { houseBurned: false }, when: { not: { resolution: 'r1' } } },
          { record: { ghoulPriestAlive: false }, when: { resolutionIn: ['r1', 'r2'] } },
          { record: { ghoulPriestAlive: true }, when: { not: { resolutionIn: ['r1', 'r2'] } } },
          { when: { resolution: 'r1' }, trauma: { lead: { mental: 1 } } },
        ],
      }
    },
  },
})
