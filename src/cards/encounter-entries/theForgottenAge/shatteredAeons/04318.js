// 04318 彼端的世界
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：强制 - 在敌人将要生成在一个无人地点，且场上没有无人地点时：从探索牌库揭示卡牌，直到揭示一个地点。将该地点放置入场，并将该敌人生成在该地点。混洗探索牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 彼端的世界（04318）：没有可生成地点时，翻探索牌库放一个地点。

export default {
  code: '04318', name: '彼端的世界', scope: 'act', text: '敌人没有可生成地点时，翻探索牌库直到地点。',
  placesLocationForEmptySpawn: true,
  // 第 116 轮：背面（把放在一边的时间之窗洗入探索牌库）从章节 behavior 迁来。
  actRule: {
    onReveal(state, act, api, hooks) {
      const pocket = hooks.pocket()
      hooks.removeSetAsideLocation(pocket)
      if (!(state.explorationDeck || []).includes(pocket)) {
        state.explorationDeck = [...(state.explorationDeck || []), pocket]
        state.scenarioFlags.pocketInDeck = true
      }
      hooks.shuffleInPlace()
      api.info?.('🕳️ 时间之窗被洗入探索牌库。')
    },
  },
}
