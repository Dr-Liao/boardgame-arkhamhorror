// 06129 狄拉斯-利恩（theSearchForKadath）· 地点（斯凯 / 城市 / 港口，掩藏，线索1，帷幕3）
// 卡面：掩藏。
// 卡面：[action] 花费1资源：检索你牌库顶6张卡牌，找出一张[[道具]]支援并抽取。洗回你的牌库。
//
// 一卡一文件：地点条目声明 [action]；章节 behavior 的 actions/performAction 读取并接线。
// 检索走公共原语 api.searchTop（含洗回与抽出管线）。
export default {
  code: '06129', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (!(inv.deck || []).length) return
      if ((inv.resources || 0) < 1) return
      moves.push({
        action: 'scenarioAction', rule: 'dylathLeenSearchItems', actions: 1,
        label: '🛒 狄拉斯-利恩：花费 1 资源，从牌库顶 6 张中找出 1 张[[道具]]支援并抽取',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'dylathLeenSearchItems') return false
      if ((inv.resources || 0) < 1) return true
      api.loseResources?.(inv.seat, 1)
      api.searchTop?.(inv.seat, {
        amount: 6, typeFilter: 'asset', traits: ['Item'], choose: 1, source: '06129',
      })
      api.info?.('🛒 狄拉斯-利恩：花费 1 资源检索牌库顶 6 张。')
      return true
    },
  },
}
