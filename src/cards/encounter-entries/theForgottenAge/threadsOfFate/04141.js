// 04141 维尔玛小餐馆
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：东城区与维尔玛小餐馆相互连接
// 卡面：[action][action][action]：你在小餐馆打发了些时间，听着周围顾客的交谈。从供应堆获得2个线索。(每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 本地餐馆（04141）/ 警局（04126b）/ 火车轨道（04128b）的场景行动（命运之线）。

export default {
  code: '04141', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      // 用掉后保留一条「已用」提示：牌桌在卡面详情里显示，AI 也不会把它当成可用行动。
      const used = Boolean(state.scenarioFlags?.usedAbilities?.velmasDiner)
      moves.push({ action: 'scenarioAction', rule: 'velmasGossip', actions: 3, label: '☕ 在小餐馆听人闲聊（3 行动，获得 2 个线索）',
        reason: used ? '本场游戏已使用（每场游戏仅限一次）' : null, used: used || undefined })
    },
  },
}
