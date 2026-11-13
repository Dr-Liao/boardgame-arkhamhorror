// 09050 实验室外套（Lab Coat）· 探寻者（Seeker）资产 · 1 经验 · 身体。
//
// 卡面：[reaction] 你的[探寻者]卡牌的技能检定将要失败，且低于难度 1 点及以内时，横置实验室外套：
//       改为你检定成功且等于难度。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：testWouldFail 窗口（tests.js 在 value < difficulty 时开窗，窗口后的 `context.testBonus`
// 会加到本次检定值上）——把差额补回 1 点即「成功且等于难度」。费用用 cost.exhaust（统一费用管线）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '09050'

// 「[探寻者]卡牌」= 发起本次检定的那张卡的印刷职阶。检定来源由 skillTest.source.code 给出
// （支援/事件发起检定时的统一读点），因此不需要卡号分支。
const isSeekerCard = code => Boolean(code) && String(ALL_CARDS[code]?.klass || '') === 'seeker'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testWouldFail',
      cost: { exhaust: true },
      label: '你的[探寻者]卡牌检定将以 1 点及以内失败时：横置，改为成功且等于难度',
      criteria: [({ state, inv, source, context }) => {
        if (!source || source.exhausted) return false
        const test = state.skillTest
        if (!test || test.seat !== inv.seat) return false
        const gap = Number.isFinite(context?.failedBy)
          ? Number(context.failedBy)
          : Number(context?.difficulty) - Number(context?.testValue)
        if (!(gap === 1)) return false
        return isSeekerCard(test.source?.code)
      }],
      resolve: ({ inv, api, context }) => {
        const gap = Number.isFinite(context?.failedBy)
          ? Number(context.failedBy)
          : Number(context.difficulty) - Number(context.testValue)
        context.testBonus = (context.testBonus || 0) + Math.max(0, gap)
        api.info(`🥼 「实验室外套」：${inv.name} 把本次检定改为成功且等于难度（+${Math.max(0, gap)}）。`)
      },
    },
  ],
  modifiers: [],
}
