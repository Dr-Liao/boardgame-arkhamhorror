// 06072 实验疗法病房（Experimental Therapies Ward）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：[reaction] 当你调查「实验疗法病房」时，受到 1 点恐惧：本次调查该地点获得 -2 帷幕。
// 读点：技能检定在 ST.1 建立后、投入前触发 onInvestigationTestInitiated；
//   选择支付恐惧后，仅调整本次调查的难度，不留下场景标记。
const CODE = '06072'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    onInvestigationTestInitiated(state, inv, location, api) {
      const answer = api.choice?.({
        kind: 'reaction', source: CODE, seat: inv.seat, canSkip: true,
        prompt: '是否受到 1 点恐惧，使本次调查「实验疗法病房」帷幕 -2？',
        options: [
          { id: 'skip', label: '不触发' },
          { id: 'trigger', label: '受到 1 点恐惧；本次调查帷幕 -2' },
        ],
      })
      if (answer !== 'trigger') return 0
      api.horror?.(inv.seat, 1)
      return -2
    },
  },
}
