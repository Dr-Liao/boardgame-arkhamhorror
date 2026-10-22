// 03293 哥特式唱诗台
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 卡面：[action]在当前“c”密谋上放置1个毁灭标记：治愈2点恐惧。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03293', scope: 'location',
  locationRule: {
    choeurGothique: { deck: 'c', heal: 'horror' },
    actions({ state, moves }) {
      const used = Boolean(state.scenarioFlags.choeurGothiqueUsed)
      moves.push({ action: 'scenarioAction', rule: 'choeurGothiqueHeal',
        label: '在“c”密谋放置1毁灭，治愈2点恐惧',
        reason: used ? '本场游戏已使用（团队每场游戏仅限一次）' : null, used: used || undefined })
    },
  },
}
