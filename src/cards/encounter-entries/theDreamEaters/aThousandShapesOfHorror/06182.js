// 06182 地点「无名坟墓」（Unmarked Tomb · [[墓地]]）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：目标 - 当一轮结束时，如果每位未被击败的调查员都位于
// 无名坟墓，并且调查员「发现了一把奇怪的钥匙」，推进场景。
//
// 依据 Haskell Location/Cards/.../UnmarkedTomb.hs：本地点是幕 I 的「另一张冒险卡牌上的目标」；
// 轮末强制由本章 behavior.roundEnded 分派到 locationRule.forced.roundEnd（引擎没有地点轮末读点），
// 推进走 api.advanceAct（引擎唯一幕推进入口）。
import { activeInvestigators, originalOf } from '../../_shared.js'

const UNMARKED_TOMB = '06182'
const FACT = 'recoveredAStrangeKey'

export default {
  code: UNMARKED_TOMB,
  scope: 'location',
  implemented: true,
  locationRule: {
    forced: {
      roundEnd(state, location, api) {
        const investigators = activeInvestigators(state)
        if (!investigators.length) return
        if (!investigators.every(inv => inv.location === location.id)) return
        if (!(state.scenarioFlags?.remembered || []).includes(FACT)) return
        // 幕 I 的目标在「另一张冒险卡牌」上：满足条件时推进本幕。
        if (String(originalOf(state.acts?.[state.actIndex])) !== '06172') return
        api.info?.('🪦 无名坟墓：所有未败退调查员都在此且已发现奇怪的钥匙，幕 I 推进。')
        api.advanceAct?.()
      },
    },
  },
}
