// 06169a 议程 I「无名之屋」（The House with No Name）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。正面卡面无文本；背面是 06169b「不可名状之物」
// （双面卡：linkedCardCode 指向敌人面）。参考 Haskell Agenda/Cards/.../TheHouseWithNoName.hs：
// 推进本议程时按生成指示生成不可名状之物（生成 - 阁楼或楼上的走廊），然后推进议程牌库
// （引擎的 advanceAgenda 会自行推进 agendaIndex，这里只结算背面效果）。
//
// 一卡一文件：规则只在这里维护；章节流程在 content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/behavior.js。
// 生成地点的选择放在「哪个地点在场」上：阁楼按设置放在一边，通常要等 Upstairs Hallway 的能力把它放置入场，
// 因此多数情况下只能选「楼上的走廊」。
import { originalOf } from '../../_shared.js'

const THE_UNNAMABLE = '06169b'
const ATTIC = '06181'
const UPSTAIRS_HALLWAY = '06178'

export default {
  code: '06169a',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const candidates = (state.locations || [])
        .filter(location => [ATTIC, UPSTAIRS_HALLWAY].includes(originalOf(location)))
      if (!candidates.length) {
        api.info?.('「无名之屋」推进：阁楼与楼上的走廊都不在场，不可名状之物仍放在一边。')
        return true
      }
      const chosen = candidates.length === 1 ? candidates[0] : candidates.find(location =>
        String(location.id) === String(api.choice?.({
          kind: 'location', source: '06169a', seat: state.campaign?.leadSeat ?? 0,
          prompt: '不可名状之物生成在阁楼或楼上的走廊：选择生成地点。',
          options: candidates.map(location => ({ id: String(location.id), label: location.name || location.id })),
        }))) || candidates[0]
      const enemy = api.spawn?.(THE_UNNAMABLE, chosen.id)
      api.info?.(enemy
        ? `👁️ 「不可名状之物」在「${chosen.name || chosen.id}」生成（生成指示：阁楼或楼上的走廊）。`
        : '👁️ 「不可名状之物」生成失败。')
      return true
    },
  },
}
