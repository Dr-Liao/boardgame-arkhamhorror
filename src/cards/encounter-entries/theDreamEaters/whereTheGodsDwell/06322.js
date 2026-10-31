// 06322 众神所弃（Abandoned by the Gods，2 张）
// 卡面：险境。
//       显现 - 检定[willpower](3)。你检定失败且每低于难度 1 点，你必须从 0 到 4 中选择一个数字
//       （每次选择不同数字）。每位玩家必须弃掉手牌中印刷资源费用等于所选数字的每张事件和支援。
//
// 行为位置（本文件）：encounterResolve 实现全部显现效果。
//   · 失败差值上限 5（0–4 共 5 个数字）；
//   · 「每位玩家」指未败退/未撤退的调查员；弃牌走 api.discardFromHand（印刷费用取 cards-data 的 cost）。
import { ALL_CARDS } from '../../_shared.js'

const NUMBERS = [0, 1, 2, 3, 4]
const DIFFICULTY = 3

export default {
  code: '06322',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test?.(inv.seat, 'willpower', DIFFICULTY, result => {
      if (result?.success) return
      const failedBy = Math.max(0, Number(result?.difficulty ?? DIFFICULTY) - Number(result?.value ?? 0))
      const chooseCount = Math.min(NUMBERS.length, failedBy)
      const chosen = []
      for (let index = 0; index < chooseCount; index += 1) {
        const options = NUMBERS
          .filter(value => !chosen.includes(value))
          .map(value => ({ id: String(value), label: `数字 ${value}` }))
        if (!options.length) break
        const answer = api.choose?.({
          kind: 'number', source: '06322', seat: inv.seat,
          prompt: `「众神所弃」：选择第 ${index + 1}/${chooseCount} 个不同的数字（0–4）。`,
          options,
        })
        chosen.push(Number(answer))
      }
      let discarded = 0
      for (const other of state?.investigators || []) {
        if (other.defeated || other.resigned) continue
        for (const code of [...(other.hand || [])]) {
          const definition = ALL_CARDS[code]
          if (!definition || !['event', 'asset'].includes(definition.type)) continue
          const cost = definition.cost
          if (!chosen.includes(Number(cost))) continue
          if (api.discardFromHand?.(other.seat, code)) discarded += 1
        }
      }
      api.info?.(`🌩️ 「众神所弃」：所选数字 ${chosen.join('、') || '（无）'}，共弃掉 ${discarded} 张事件/支援。`)
    })
    return false
  },
}
