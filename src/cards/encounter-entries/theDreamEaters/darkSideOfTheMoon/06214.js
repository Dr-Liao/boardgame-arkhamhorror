// 06214 地点「月兽帆船」（Moon-Beast Galley · [[船舶]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon（背面是剧情卡 06214b「下船」Off the Galley）。
// 卡面：调查员不能通过玩家卡的效果进入或离开月兽帆船。
// [fast] 如果月兽帆船上没有线索：将其翻面。
// 强制 - 当一轮结束时，如果场上有至少 3 个毁灭标记：将月兽帆船翻面。
//
// 依据 Haskell Location/Cards/.../MoonBeastGalley.hs（AdditionalCostToEnter/Leave UnpayableCost、
// CluesOnThis 0 → FastAbility flip、DoomCountIs atLeast 3 → RoundEnds flip；Flip → readStory offTheGalley）：
//   · 「玩家卡效果不能进入/离开」→ locationRule.blockEffectEntry / blockEffectLeave，
//     behavior.movementError 读（只影响效果移动；普通移动不受限）；
//   · 翻面与背面结算由 behavior 的 `offTheGalley` 流程完成（翻面 + 弃敌人/移动调查员/移出游戏），
//     本条目只声明可翻面的条件与 flow id。翻面后请见 06214b.js。
export default {
  code: '06214',
  scope: 'location',
  implemented: true,
  locationRule: {
    blockEffectEntry: true,
    blockEffectLeave: true,
    // 翻面流程数据：behavior.actions / roundEnded 读取并调用 offTheGalley 流程。
    flipFlow: {
      flow: 'offTheGalley',
      withoutCluesFast: true,
      roundEndDoomAtLeast: 3,
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      const flow = location
      if ((flow.clues || 0) > 0) return
      if (state.scenarioFlags?.moonBeastGalleyFlipped) return
      moves.push({
        action: 'scenarioAction',
        rule: 'flipMoonBeastGalley',
        actions: 0,
        fast: true,
        flow: 'offTheGalley',
        label: '⛵ 月兽帆船：没有线索，翻面并结算「下船」',
      })
    },
  },
}
