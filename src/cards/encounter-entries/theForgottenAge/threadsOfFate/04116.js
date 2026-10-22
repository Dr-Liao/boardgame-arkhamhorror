// 04116 暗藏纠葛
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：[action]：撤退。你不想花费过多时间来冒险，因此你带着搜集到的信息安全返回。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04116', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        api.trauma?.(inv.seat, 'mental', 1)
        api.defeat?.(inv, null)
      }
    },
  },
}
