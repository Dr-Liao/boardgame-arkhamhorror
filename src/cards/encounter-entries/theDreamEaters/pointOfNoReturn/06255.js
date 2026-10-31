// 06255 · 《无归之地》地点「古革巨人之城」（City of Gugs · 帷幕 2 · 线索 1/人 · 胜利 1）。
// 卡面：Forced - After you enter City of Gugs: Flip it over and resolve the text on its other side.
// 背面故事 06255b「岗哨」：Spawn the set-aside Gug Sentinel enemy at this location, with
//   1 [per_investigator] clues on it. Test [agility] (3). If you succeed, Gug Sentinel enters play
//   exhausted and unengaged. Otherwise, it enters play engaged with you. Flip this card back over.
//
// 进入时的强制翻面走引擎读点 locationRule.onEnter.effect（movement.js:239）；翻面后的故事效果由
// behavior.js 的 locationFlipped → storyResolve 分派。用 scenarioFlags 记录「已翻面」避免重复触发。

export default {
  code: '06255',
  scope: 'location',
  implemented: true,
  flags: {
    flipStory: '06255b',
  },
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        const flippedKey = `pnrFlipped:${location.id}`
        if (api.scenarioFlag?.(flippedKey)) return
        api.setScenarioFlag?.(flippedKey, true)
        api.info?.(`强制：进入「${location.name}」后将其翻面并结算背面的故事。`)
        api.flipLocation?.(location.id, inv?.seat ?? null)
      },
    },
  },
}
