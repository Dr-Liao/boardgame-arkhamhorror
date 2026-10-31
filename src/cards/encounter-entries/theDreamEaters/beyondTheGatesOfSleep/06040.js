// 06040 穿越门扉之旅（Journey through the Gates）· 议程 1
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 正面：强制 - 神话阶段在这张议程上放置毁灭时，若有调查员位于[[台阶]]地点：在这张议程上再放 1 个毁灭。
// 背面：若当前为幕 1/2/3：每名存活调查员被击败并承受 1 点物理创伤；这些调查员可在被击败前检定意志(3)
//   以想起这一切都是梦；成功者改为被击败并承受 1 点精神创伤。
//   若当前为幕 4：在战役日志记录「入梦者偏离了道路」；每名存活调查员被击败并承受 1 点精神创伤。
// 读点：agendaRule.onReveal（章节 behavior.agendaReveal 分派）；正面强制为数据声明
//   （entry 的 agendaRule.extraDoomOnMythosPlacement），由章节 behavior 的 doomPlaced 钩子读取执行。
import { activeInvestigators, originalOf } from '../../_shared.js'

const CODE = '06040'

function stepsInvestigatorExists(state) {
  return activeInvestigators(state).some(inv => {
    const location = (state.locations || []).find(entry => entry.id === inv.location)
    const cardCode = originalOf(location)
    return (state.scenario?.locations?.[location?.id]?.traits || []).some(trait => String(trait).toLowerCase() === 'steps')
      || ['06045', '06046', '06047', '06048'].includes(cardCode)
  })
}

export default {
  code: CODE,
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    // 正面强制（数据声明；章节 behavior.doomPlaced 读本字段，见 report 的接线说明）。
    extraDoomOnMythosPlacement: { amount: 1, whileAnyInvestigatorAtTrait: 'Steps' },
    onReveal(state, agenda, api) {
      const actStep = (state.actIndex ?? 0) + 1
      const survivors = activeInvestigators(state)
      if (actStep >= 4) {
        api.setCampaignRecord?.('theDreamersStrayedFromThePath', true)
        api.info?.('🩸 「穿越门扉之旅」背面：入梦者偏离了道路。')
        for (const inv of survivors) {
          api.trauma?.(inv.seat, 'mental', 1)
          api.defeat?.(inv, 'journeyThroughTheGates')
        }
        return true
      }
      for (const inv of survivors) {
        const answer = api.choice?.({
          kind: 'story', source: CODE, seat: inv.seat,
          prompt: '台阶如蛇般扭动翻转。被击败前是否检定意志(3)以想起这一切都是梦？',
          options: [
            { id: 'test', label: '检定意志(3)：成功改为承受 1 点精神创伤，失败承受 1 点物理创伤' },
            { id: 'doNotTest', label: '不检定：承受 1 点物理创伤' },
          ],
        })
        if (answer === 'test') {
          api.test?.(inv.seat, 'willpower', 3, result => {
            api.trauma?.(inv.seat, result.success ? 'mental' : 'physical', 1)
            api.defeat?.(inv, 'journeyThroughTheGates')
          })
        } else {
          api.trauma?.(inv.seat, 'physical', 1)
          api.defeat?.(inv, 'journeyThroughTheGates')
        }
      }
      api.info?.('🩸 「穿越门扉之旅」背面：台阶开始扭曲，所有存活调查员被击败。')
      return true
    },
  },
}
