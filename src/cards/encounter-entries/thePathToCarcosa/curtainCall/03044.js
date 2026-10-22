// 03044 第三幕
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03044', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const victory = state.victoryDisplay.findIndex(card => (card.originalCode || card.code) === '03060')
      if (victory >= 0) state.victoryDisplay.splice(victory, 1)
      if (!state.enemies.some(enemy => enemy.code === '03060')) api.spawn('03060', 'theatre')
    },
  },
}
