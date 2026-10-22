// 01168 朦胧之雾
// 归属：跨战役通用
// 遭遇组：chilling_cold
// 卡面：显现 - 附属到你所在地点。每个地点仅限1张。
// 卡面：所附属地点的隐藏值+2。
// 卡面：强制 - 所附属地点被成功调查后：弃掉朦胧之雾。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '01168', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api, { location }) {
    if (!location) return false
    location.fog = (location.fog || 0) + 1
    location.fogCode = '01168'
    location.shroudMod = (location.shroudMod || 0) + 2
    api.info?.(`🌫️ 朦胧之雾附着于「${location.name}」：隐藏值 +2（共 ${location.fog} 张）。`)
    return true
  },
}
