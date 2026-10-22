// 04128b 火车轨道
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：显现 - 将火车轨道放置入场。将放在一边的亚历山卓·维拉附属到火车轨道。推进到场景3c——“亚历山卓被关押”。
// 卡面：北区与火车轨道相互连接。
// 卡面：[action]花费1个线索：抽取4张卡牌。(每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04128b', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      const used = Boolean(state.scenarioFlags?.usedAbilities?.trainTracks)
      moves.push({ action: 'scenarioAction', rule: 'trainTracksDraw', label: '🚂 花费 1 个线索，抽取 4 张卡牌（每场游戏一次）',
        reason: used ? '本场游戏已使用（每场游戏仅限一次）' : null, used: used || undefined })
    },
  },
}
