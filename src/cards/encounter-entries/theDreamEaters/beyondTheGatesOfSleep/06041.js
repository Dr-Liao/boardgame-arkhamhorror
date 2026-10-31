// 06041 进入幻梦境（Entering the Dreamlands）· 幕 1
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 正面：神话阶段不要从遭遇牌库抽卡。目标 - 若一名调查员进入「火焰洞穴」，立即推进。
// 背面：每位调查员失去全部线索。把放在一边的纳什特与卡曼塔放入「火焰洞穴」。你的睡眠更深了：
//   在余下战役中向混乱袋加入 1 个 [skull] 标记。
// 读点：objective 由 definition 的 act.objective（{type:'enterLocation'}，引擎 movement.js 自动推进）；
//   背面 agendaRule → actRule.onReveal（章节 behavior.actReveal 分派）。
import { activeInvestigators, addPermanentChaosTokens, originalOf } from '../../_shared.js'

const CODE = '06041'

function cavernOfFlameId(state) {
  return (state.locations || []).find(location => originalOf(location) === '06046')?.id || null
}

export default {
  code: CODE,
  scope: 'act',
  implemented: true,
  actRule: {
    onReveal(state, act, api) {
      for (const inv of activeInvestigators(state)) {
        if (Number(inv.clues || 0) > 0) api.spendClues?.(inv.seat, Number(inv.clues))
      }
      const cavern = cavernOfFlameId(state)
      for (const code of ['06057', '06058']) {
        api.takeFromSetAside?.(code)
        if (cavern) api.spawn?.(code, cavern)
      }
      addPermanentChaosTokens(state, 'skull', 1)
      api.info?.('🕯️ 「进入幻梦境」背面：两位守门祭司在火焰洞穴现身，混乱袋永久加入 1 个骷髅标记。')
      return true
    },
  },
}
