// 06042 纳什特和卡曼塔的考验（The Trial of Nasht and Kaman-Thah）· 幕 2
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 正面：神话阶段不要从遭遇牌库抽卡。目标 - 若纳什特与卡曼塔都不在场，立即推进。
// 背面：每位调查员失去全部线索。把放在一边的「七百级台阶」「楼梯底部」「魔幻小路」放入场。
//   你的睡眠更深了：在余下战役中向混乱袋加入 1 个 [skull] 标记。
// 读点：目标为数据声明 actRule.objective（章节 behavior.checkObjectives 读取）；
//   背面 actRule.onReveal（章节 behavior.actReveal 分派）。
import { activeInvestigators, addPermanentChaosTokens, originalOf } from '../../_shared.js'

const CODE = '06042'

// 幕 2 背面的三张地点：从 definition 的 location 表按原卡号反查地点 id。
function locationIdByCode(state, code) {
  const entry = Object.entries(state.scenario?.locations || {}).find(([, definition]) => originalOf(definition) === code)
  return entry ? entry[0] : null
}

export default {
  code: CODE,
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'noEnemiesInPlay', originalCodes: ['06057', '06058'] },
    onReveal(state, act, api) {
      for (const inv of activeInvestigators(state)) {
        if (Number(inv.clues || 0) > 0) api.spendClues?.(inv.seat, Number(inv.clues))
      }
      for (const code of ['06047', '06048', '06049']) {
        api.takeFromSetAside?.(code)
        const id = locationIdByCode(state, code)
        if (id) api.place?.(id)
      }
      addPermanentChaosTokens(state, 'skull', 1)
      api.info?.('🕯️ 「纳什特和卡曼塔的考验」背面：通往幻梦境深处的台阶与小路出现。')
      return true
    },
  },
}
