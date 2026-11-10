// 09002「如你所愿」（As you wish）· 技能 · 卡森专属签名（牌组 2 张）
// 卡面：仅可投入到其他调查员执行的技能检定。若检定成功，执行者抽 1 张牌；若失败，你抽 1 张牌。
//
// 读点：commit 描述子（投入检定后进入弃牌堆由引擎统一处理）；
//   成功/失败结果窗口 skillTestSuccess / skillTestFail 携带 state.skillTest（含 committed 列表）。
//   局限：引擎的 commit 数据体暂不表达能力限制「只能投入他人检定」，本条目以注释登记；
//   行为由成功/失败窗口按 committed 卡号判定（见 tests/tsk-investigator-09001.test.mjs）。
export default {
  code: '09002',
  abilities: [
    {
      kind: 'commit',
      label: '《如你所愿》：只能投入到其他调查员执行的检定',
      skill: {},
    },
    {
      kind: 'forced',
      trigger: 'skillTestSuccess',
      silent: true,
      label: '检定成功：执行者抽 1 张牌',
      criteria: [({ state, inv }) => {
        const test = state.skillTest
        return Boolean(test) && test.seat !== inv.seat
          && (test.committed || []).some(item => item.code === '09002' && item.seat === inv.seat)
      }],
      resolve: ({ state, api }) => {
        if (Number.isInteger(state.skillTest?.seat)) api.drawCards(state.skillTest.seat, 1)
      },
    },
    {
      kind: 'forced',
      trigger: 'skillTestFail',
      silent: true,
      label: '检定失败：你抽 1 张牌',
      criteria: [({ state, inv }) => {
        const test = state.skillTest
        return Boolean(test) && test.seat !== inv.seat
          && (test.committed || []).some(item => item.code === '09002' && item.seat === inv.seat)
      }],
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    },
  ],
  modifiers: [],
}
