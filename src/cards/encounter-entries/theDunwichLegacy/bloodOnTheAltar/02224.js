// 02224 百口之物的仆人
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：生成 - 任意无人地点。
// 卡面：反击。
// 卡面：[reaction] 你击败百口之物的仆人后：发现任意地点的1个线索。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 「发现任意地点的线索」仍然要过剧情的发现限制（02213 学校：除调查外不能发现线索），
// 所以候选地点由 api.canDiscoverClueAt 过滤，发现本身走 api.discoverClue 的引擎管线。

export default {
  code: '02224', scope: 'enemy', enemySpawnRule: { spawnMode: 'empty' },
  enemyScript: {
    onDefeated(state, enemy, api) {
      const seat = enemy.defeatedBy ?? state.campaign.leadSeat
      const locations = state.locations.filter(loc => api.canDiscoverClueAt(seat, loc.id))
      if (!locations.length) return
      const chosen = api.choose({ kind: 'location', source: '02224', seat,
        prompt: '（可选）选择任意一个可以发现线索的地点，发现 1 个线索。',
        options: [{ id: 'skip', label: '不发现线索' }, ...locations.map(loc => ({ id: loc.id, label: loc.name }))] })
      if (chosen === 'skip') return
      const location = locations.find(item => item.id === chosen)
      if (location) api.discoverClue(seat, 1, location.id)
    },
  },
}
