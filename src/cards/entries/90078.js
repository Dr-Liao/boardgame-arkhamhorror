// 90078 雷克斯·墨菲（平行 / The Reporter）· 探求者 · 独立发行平行调查员。
//
// 卡面：
//   [reaction] 当你将要「将你的 1 个线索放置在你所在地点」或「在混乱袋中加入 2 个 [curse] 标记」时：
//     改为执行另一项。（这仍然可以满足能力的费用。）
//   [elder_sign] 效果：本次检定期间每揭示 1 个 [curse] 标记 +2。本次检定期间每揭示 1 个 [curse] 标记抽 1 张牌。
//
// 引擎读点：
//   · 旧印按「本次检定帧已揭示的 [curse] 标记数」结算：读 state.chaos.revealed 从 frames.at(-1) 起的切片
//     （与 10038/12082 同一读点；检定结束才归还袋）；[curse] 面数值见 tests.js（-2）。
//   · 转换能力需要「将要放置线索」「将要加入混乱标记」两个拦截窗口：窗口表里没有
//     would-place-clue / would-add-chaos-token，且「放置自己的线索」与「加入 2 个 curse」都在引擎内部
//     直接写状态 → primitive-requests/core-cards-a-90078-rex-parallel-conversion.json。
//     未实现时不写无法生效的描述子（见 note）。
const code = '90078'

function revealedCurseCount(state) {
  const start = state?.chaos?.frames?.at(-1) ?? 0
  return (state?.chaos?.revealed || []).slice(start).filter(token => token === 'curse').length
}

export default {
  code,
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 0 },
  },
  elderSign: {
    id: `${code}-eldersign`,
    label: '旧印：本次检定每揭示 1 个 [curse] 标记 +2，并抽 1 张牌',
    resolve: ({ state, inv, api }) => {
      const curses = revealedCurseCount(state)
      if (curses > 0) api.drawCards(inv.seat, curses)
      return { delta: 2 * curses }
    },
  },
  abilities: [],
  modifiers: [],
  note: '近似：旧印按本次检定帧已揭示的 [curse] 数结算（state.chaos.revealed）；「放置线索 ↔ 加入 2 个 [curse]」的双向转换缺 would-place-clue / would-add-chaos-token 拦截窗口 → primitive-requests/core-cards-a-90078-rex-parallel-conversion.json。',
}
