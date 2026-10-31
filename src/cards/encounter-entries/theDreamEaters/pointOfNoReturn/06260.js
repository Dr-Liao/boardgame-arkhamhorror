// 06260 · 《无归之地》地点「撒克山峰」（Peaks of Thok · 山谷 · 中心 · 帷幕 3 · 线索 0）。
// 卡面：[action]: Test [agility] (5) to attempt to scale the treacherous peaks. If you succeed, flip this
//   card over and resolve the text on its other side.
//   Forced - When you leave Peaks of Thok: You must test [agility] (2) to climb down safely.
//   If you fail, take 1 damage.
// 背面故事 06260b「山谷住民」：Search the encounter deck and discard pile for a Hunting Nightgaunt and
//   spawn it at Vale of Pnath, exhausted. Each investigator at Peaks of Thok may draw 2 cards.
//   Choose any enemy in play and place 2 clues on it. Flip this card back over.
//
// 行动由 behavior.actions/performAction 转发；离开检定走引擎读点 locationRule.onLeave.test/onFail
// （movement.js:280-292）；翻面故事由 behavior.locationFlipped → storyResolve 分派。

export default {
  code: '06260',
  scope: 'location',
  implemented: true,
  flags: {
    flipStory: '06260b',
    flipAction: { skill: 'agility', difficulty: 5 },
    actionLabel: '⛰️ 撒克山峰：[action] 检定敏捷(5)尝试攀登危险的山峰',
  },
  locationRule: {
    actions({ state, inv, location, moves }) {
      if (inv?.location !== location.id) return
      const flipped = state.scenarioFlags?.[`pnrFlipped:${location.id}`] === true
      moves.push({
        action: 'scenarioAction',
        rule: `flipLocation:${location.id}`,
        actions: 1,
        label: `⛰️ 撒克山峰：[action] 检定敏捷(5)尝试攀登危险的山峰`,
        ...(flipped ? { reason: '本地点已经翻面（本局不能再翻）' } : {}),
        ...(flipped ? { used: true } : {}),
      })
    },
    performAction(state, inv, move, api) {
      if (String(move?.rule || '') !== `flipLocation:${inv.location}`) return false
      const location = (state.locations || []).find(entry => entry.id === inv.location)
      if (!location) return true
      if (state.scenarioFlags?.[`pnrFlipped:${location.id}`] === true) {
        api.info?.('「撒克山峰」已经翻面（本局不能再翻）。')
        return true
      }
      api.test?.(inv.seat, 'agility', 5, result => {
        if (!result.success) return
        api.setScenarioFlag?.(`pnrFlipped:${location.id}`, true)
        api.info?.('攀上峰顶：撒克山峰翻面。')
        api.flipLocation?.(location.id, inv.seat)
      })
      return true
    },
    // 强制 - 离开撒克山峰：敏捷(2)，失败受到 1 点伤害（引擎先取消移动，再调 onFail）。
    onLeave: {
      test: { skill: 'agility', difficulty: 2 },
      cancelMessage: '⛰️ 「撒克山峰」：下山不稳，{name} 的移动被取消。',
      onFail(state, location, api, inv) {
        api.damage?.(inv.seat, 1)
        api.info?.(`⛰️ ${inv.name} 下山失败，受到 1 点伤害。`)
      },
    },
  },
}
