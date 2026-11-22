// 60569 悬崖勒马 · 技能（0 经验，万用图标，赌徒/绝境）
// 卡面：每次技能检定最多投入 1 张。
//       如果本次检定失败，将投入本次检定的其他每张卡牌都返回其所有者的手牌。
const CODE = '60569'

export default {
  code: CODE,
  abilities: [{
    kind: 'commit',
    label: '检定失败：把投入本次检定的其他卡牌返回各自手牌',
    skill: {
      afterTest: ({ state, inv, result, api }) => {
        if (result?.success || !inv) return
        const committed = state.skillTest?.committed
        if (!Array.isArray(committed)) return
        for (const item of committed) {
          const code = item?.code || item
          if (!code || code === CODE) continue
          const owner = Number.isInteger(item?.seat) ? item.seat : inv.seat
          if (api.moveCard({ code, from: 'discard', to: 'hand', ownerSeat: owner })) {
            api.info(`悬崖勒马：把「${api.cardName(code)}」返还其所有者的手牌。`)
          }
        }
      },
    },
  }],
  modifiers: [],
  note: '近似：引擎提交期没有「每检定最多 1 张」字段（未实现限制）；失败返还已投入卡按 state.skillTest.committed 读取，具体区域字段随引擎实现可能变化。',
}
