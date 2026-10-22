// 03318 疯狂沉溺
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：哈斯塔得到+1攻击且不能被击败。
// 卡面：强制 - 如果哈斯塔上有至少5[per_investigator]伤害：推进本密谋。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03318', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      if (!state.enemies.some(enemy => enemy.code === '03088')) api.spawn('03088', 'palaceOfTheKing')
      api.shuffleDiscard()
    },
  },
}
