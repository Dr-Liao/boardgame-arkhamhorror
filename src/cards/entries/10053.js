// 10053 手法稳当（Steady-Handed）· 探求者支援 · 1 经验 · 费用 2 · 天赋/科学。
//
// 卡面：每位调查员仅限 1 张。
//       [reaction] 在你技能检定将要成功时，横置手法稳当：你成功且超过难度的点数多 1 点或少 1 点。
//       如果你检定成功且超过难度正好 2 点，治愈 1 点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 「技能检定将要成功时」→ `wouldSucceedTest` 窗口（tests.js 在 value ≥ difficulty 时开窗，
//     context 带 seat / difficulty / testValue / testBonus）。
//   · 「多 1 点或少 1 点」→ 窗口的 `context.testBonus`（与 07309 同一读点；引擎在开窗后把
//     testBonus 加到本次检定值，再判成功）。
//   · 横置费用 → `cost: { exhaust: true }`（payAbilityCost 的统一费用读点）。
//   · 「成功且超过难度正好 2 点→治愈 1 点恐惧」→ 先用 api.addEffect 登记「本次检定用过手法稳当」
//     （duration:'endOfTest'，读点是 effect-state 的统一过期表），再在 `testEnds` 窗口
//     （context.result 带 success/value/difficulty）判定 successBy === 2 并 api.healHorror。
//     这样不会把「没用这张卡、但自然成功 2 点」误判成治疗。
//   · 「每位调查员仅限 1 张」→ 条目级 `limitPerInvestigator`（moves.js / play-condition 的既有读点）。
//   · 口径：「少 1 点」只在原本成功且超过难度 ≥ 1 点时提供——否则这次调整会把「将要成功」变成
//     失败，与卡面「在你技能检定将要成功时」矛盾。同一窗口里若有其它卡也改 testBonus，
//     本卡按登记时的差额计算，最终以引擎结果为准。
const CODE = '10053'

export default {
  code: CODE,
  limitPerInvestigator: true,
  note: 'approximation: 「少 1 点」只在原本成功且超过难度 ≥1 点时提供（避免把将要成功的检定变成失败）；治疗判定用 endOfTest 效果标记，只对触发过本卡的检定生效。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'wouldSucceedTest',
      label: '检定将要成功：横置，成功且超过难度多 1 点或少 1 点',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => context?.seat === inv.seat
        && Number(context.testValue) >= Number(context.difficulty)],
      resolve: ({ inv, source, context, api }) => {
        const margin = Math.max(0, Number(context.testValue || 0) - Number(context.difficulty || 0))
        const options = [{ id: 'more', label: '成功且超过难度多 1 点' }]
        if (margin >= 1) options.push({ id: 'less', label: '成功且超过难度少 1 点' })
        const answer = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '「手法稳当」：本次检定的成功点数要多 1 点还是少 1 点？',
          options,
        })
        const delta = answer === 'less' ? -1 : 1
        api.setReactionFlag('testBonus', (Number(context.testBonus) || 0) + delta, context)
        api.addEffect({
          duration: 'endOfTest',
          sourceCode: CODE,
          sourceInstanceId: source?.id || null,
          controllerSeat: inv.seat,
          label: '手法稳当：本次检定',
          modifiers: [],
        }, inv.seat)
        api.info(`🧤 「手法稳当」：${inv.name} 本次检定成功且超过难度${delta > 0 ? '多' : '少'} 1 点。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'testEnds',
      label: '本次检定成功且超过难度正好 2 点：治愈 1 点恐惧',
      criteria: [({ state, inv, context }) => {
        if (context?.seat !== inv.seat) return false
        const used = (state.effects || []).some(effect => effect.sourceCode === CODE)
        if (!used) return false
        const result = context.result
        if (!result?.success) return false
        return Number(result.value) - Number(result.difficulty) === 2
      }],
      resolve: ({ inv, api }) => {
        const healed = api.healHorror(inv.seat, 1)
        api.info(`🧤 「手法稳当」：成功且超过难度正好 2 点，${inv.name} 治愈 ${healed ?? 1} 点恐惧。`)
      },
    },
  ],
  modifiers: [],
}
