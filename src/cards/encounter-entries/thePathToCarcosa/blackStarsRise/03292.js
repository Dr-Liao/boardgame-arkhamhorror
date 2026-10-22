// 03292 哥特式唱诗台
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 卡面：[action]在当前“a”密谋上放置1个毁灭标记：治愈2点伤害。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03292', scope: 'location',
  locationRule: {
    // 第 114 轮：行动脚本只留通用实现，密谋牌堆与治愈类型由条目的数据声明。
    choeurGothique: { deck: 'a', heal: 'damage' },
    actions({ state, moves }) {
      const used = Boolean(state.scenarioFlags.choeurGothiqueUsed)
      moves.push({ action: 'scenarioAction', rule: 'choeurGothiqueHeal',
        label: '在“a”密谋放置1毁灭，治愈2点伤害',
        reason: used ? '本场游戏已使用（团队每场游戏仅限一次）' : null, used: used || undefined })
    },
  },
}
