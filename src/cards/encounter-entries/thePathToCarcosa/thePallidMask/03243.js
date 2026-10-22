// 03243 穿越墓穴
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：目标 - 找到苍白面具下的男子。他就在地下墓穴里。(不要推进场景，直到你受到指示。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：卡尔克萨「苍白面具」的幕/密谋脚本。

export default {
  code: '03243', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const tomb = state.locations.find(location => location.originalCode === '03257')
      if (!tomb) throw new Error('暗影坟墓尚未进入游戏')
      state.scenarioFlags.tombLocationId = tomb.id
      api.spawn('03059', tomb.id)
      const records = state.campaign.records ||= {}
      if (!(records.vipsSlain || []).includes('03067')) api.spawn('03067b', state.scenarioFlags.startLocationId)
    },
  },
}
