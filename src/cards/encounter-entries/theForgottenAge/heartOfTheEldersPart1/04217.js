// 04217 错时林地
// 归属：关卡专用 · heartOfTheEldersPart1（久远腹地（上）· 昆扬之口）
// 遭遇组：pillars_of_judgment
// 卡面：[action][action]：从胜利区选择一张带有复仇点数的非[[精英]]卡牌。将该卡牌放到遭遇弃牌堆。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 时间折磨的树林（04217）：团队每场一次，把胜利区带复仇点数的非精英卡牌放进遭遇弃牌堆。

export default {
  code: '04217', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      // 用掉后仍列出（带 reason / used），牌桌在「地点详情」里保留一行「已用」，
      // 否则玩家只会看到地点能力突然消失。
      const used = Boolean(state.scenarioFlags?.timeWrackedWoodsUsed)
      moves.push({
        action: 'scenarioAction', rule: 'expelVengeance', actions: 2,
        label: '⏳ 把胜利区一张带复仇点数的非精英卡牌放进遭遇弃牌堆（团队每场一次）',
        reason: used ? '本场游戏已使用（团队每场游戏仅限一次）' : null,
        used: used || undefined,
      })
    },
  },
}
