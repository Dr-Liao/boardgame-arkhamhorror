// 10126 宗教信物（Token of Faith）· 生存者资产 · 3 经验 · 饰品槽
// 卡面：[reaction] 在揭示了 [curse] 或 [auto_fail] 标记的技能检定结束后，横置宗教信物：
//       在混乱袋中加入同等数量的 [bless] 标记。如果本次技能检定失败，在结算失败检定的所有效果后，
//       执行检定的调查员可以再次尝试该检定。（每次检定最多一次。）
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「技能检定结束后」= `testEnds` 窗口（tests.js#closeTest 在失败效果结算之后开窗，
//     context = { when, seat, result, source }；result.drawn 是本次揭示的全部标记面）。
//     只有存在监听者时该窗口才开门，本条目声明 trigger 即接线。
//   · 「揭示了 curse/auto_fail」= result.drawn 里这两种标记的数量；「加入同等数量 bless」=
//     `api.chaosTokens.add('bless', n)`（标记池唯一写点，超出池上限自然截断）。参考实现同样先看
//     标记池剩余空间（HasRemainingBlessTokens），这里用 criteria 的 `helpers.poolTokenRoom('bless')`。
//   · 「失败则执行检定的调查员可以再次尝试」= 询问后 `api.retryTest(seat)`（api-test.js 的 B3 重试
//     原语：沿用 state.lastTestResult 的 skill/difficulty/source 重跑一次）。
//   · 每次检定最多一次 = `limit: { scope: 'perTest', owner: 'instance' }`。
//
// 显式简化（simplified，见 note）：api.retryTest 只重跑检定本身（技能/难度/来源），不会重放原检定
// 的 resolve 效果（引擎没有把 options.resolve 存进 lastTestResult）；「再次尝试」的后续效果因此缺失。
// 原语请求见 artifacts/migration/fhv/primitive-requests/10126.json。
const CODE = '10126'
const BLESS = 'bless'
const TRIGGER_TOKENS = ['curse', 'autofail']

const revealedCount = result => (result?.drawn || []).filter(token => TRIGGER_TOKENS.includes(token)).length

export default {
  code: CODE,
  name: 'Token of Faith',
  simplified: true,
  note: 'simplified: 「失败后可再次尝试该检定」用 api.retryTest 重跑技能/难度/来源，但不重放原检定的 resolve 效果（引擎未保存 lastTestResult 的 resolve）；转祝福与池上限完整实现。原语请求见 primitive-requests/10126.json',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testEnds',
      label: '检定结束后横置：把揭示的诅咒/自动失败转为等量祝福；失败可重试',
      cost: { exhaust: true },
      limit: { scope: 'perTest', owner: 'instance' },
      criteria: [({ context, helpers }) => revealedCount(context?.result) > 0
        && helpers.poolTokenRoom(BLESS) > 0],
      resolve: ({ inv, context, api }) => {
        const result = context?.result
        const count = revealedCount(result)
        if (!count) return
        const added = api.chaosTokens.add(BLESS, count)
        api.info(`🕯️ 宗教信物：本次检定揭示了 ${count} 个诅咒/自动失败标记，加入 ${added} 个祝福标记。`)
        if (!result || result.success) return
        const performer = Number.isInteger(context?.seat) ? context.seat : inv.seat
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: performer, canSkip: true,
          prompt: '宗教信物：本次检定失败。是否由执行检定的调查员再次尝试该检定？',
          options: [
            { id: 'skip', label: '不再尝试' },
            { id: 'retry', label: '再次尝试该检定' },
          ],
        })
        if (answer !== 'retry') return
        api.retryTest(performer)
        api.info('🕯️ 宗教信物：执行检定的调查员再次尝试该检定。')
      },
    },
  ],
  modifiers: [],
}
