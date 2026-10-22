// 03052 后台
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：强制 - 在后台揭示时：将放在一边的后台走廊门口地点中的随机2张放置入场。
// 卡面：你位于后台时，在计算你的手牌上限的时候，你手牌中每张隐私诡计改为视为3张卡牌而不是1张。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03052', scope: 'location', flags: { backstage: true },
  locationRule: {
    onReveal(state, location, api) {
      const pool = state.scenarioFlags.backstageDoorways || []
      for (let count = 0; count < 2 && pool.length; count++) {
        const id = pool.splice(Math.floor(api.random() * pool.length), 1)[0]
        api.place(id)
      }
    },
  },
}
