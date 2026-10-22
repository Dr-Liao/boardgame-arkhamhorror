// 03257 暗影坟墓
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：强制 - 在暗影坟墓揭示时：推进到场景1b。
// 卡面：苍白面具下的男子位于暗影坟墓时，他得到+1[per_investigator]生命值且不能被他的[action]能力击败。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 暗影坟墓已在幕二揭示时直接推进（thePallidMask 的 locationRevealed 分支）。

export default {
  code: '03257', scope: 'location', flags: { tombEntrance: true },
  locationRule: {
    onReveal(state, location, api) {
      if (state.actIndex !== 0) return
      state.scenarioFlags.tombLocationId = location.id
      api.advanceAct()
    },
  },
}
