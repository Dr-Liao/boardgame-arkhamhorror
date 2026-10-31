// 06256 · 《无归之地》地点「卡斯之塔」（Tower of Koth · 帷幕 5 · 线索 0）。
// 卡面：[action]: Test [combat] (5) to lift the heavy stone trapdoor at the top of the tower.
//   If you succeed, flip this card over and resolve the text on its other side.
// 背面故事 06256b「另一条路」：Put the set-aside Enchanted Woods (Stone Trapdoor) into play, revealed.
//   Record in your Campaign Log the investigators found a way out of the Underworld. Flip this card back over.
//
// 地点行动由 behavior.actions/performAction 转发到本条目（behavior 只做「当前地点规则分派」）；
// 翻面故事效果由 behavior.locationFlipped → storyResolve 按 flags.storyRule 分派。

export default {
  code: '06256',
  scope: 'location',
  implemented: true,
  flags: {
    flipStory: '06256b',
    flipAction: { skill: 'combat', difficulty: 5 },
    actionLabel: '🗼 卡斯之塔：[action] 检定战斗(5)掀开塔顶的石板暗门',
  },
  locationRule: {
    actions({ state, inv, location, moves }) {
      if (inv?.location !== location.id) return
      const flipped = state.scenarioFlags?.[`pnrFlipped:${location.id}`] === true
      moves.push({
        action: 'scenarioAction',
        rule: `flipLocation:${location.id}`,
        actions: 1,
        label: `🗼 卡斯之塔：[action] 检定战斗(5)掀开塔顶的石板暗门`,
        ...(flipped ? { reason: '本地点已经翻面（本局不能再翻）' } : {}),
        ...(flipped ? { used: true } : {}),
      })
    },
    performAction(state, inv, move, api) {
      if (String(move?.rule || '') !== `flipLocation:${inv.location}`) return false
      const location = (state.locations || []).find(entry => entry.id === inv.location)
      if (!location) return true
      if (state.scenarioFlags?.[`pnrFlipped:${location.id}`] === true) {
        api.info?.('「卡斯之塔」已经翻面（本局不能再翻）。')
        return true
      }
      api.test?.(inv.seat, 'combat', 5, result => {
        if (!result.success) return
        api.setScenarioFlag?.(`pnrFlipped:${location.id}`, true)
        api.info?.('石板暗门被掀开：卡斯之塔翻面。')
        api.flipLocation?.(location.id, inv.seat)
      })
      return true
    },
  },
}
