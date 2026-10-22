// 03054 售票处
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：[action]：获得5资源。记住你“从售票处偷窃”。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 93 轮：谢幕的门厅/售票处/休息室/化妆间。

export default {
  code: '03054', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      const used = Boolean(state.scenarioFlags.boxOfficeUsed)
      moves.push({ action: 'scenarioAction', rule: 'stealBoxOffice', label: '从售票处取得5资源',
        reason: used ? '本场游戏已使用（团队每场游戏仅限一次）' : null, used: used || undefined })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'stealBoxOffice') return false
      if (state.scenarioFlags.boxOfficeUsed) throw new Error('本场游戏已从售票处取过资源')
      state.scenarioFlags.boxOfficeUsed = true
      state.scenarioFlags.stoleFromBoxOffice = true
      inv.resources += 5
      return true
    },
  },
}
