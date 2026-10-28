// 01168 朦胧之雾
// 归属：跨战役通用
// 遭遇组：chilling_cold
// 卡面：显现 - 附属到你所在地点。
// 卡面：所附属地点的隐藏值+2。
// 卡面：强制 - 所附属地点被成功调查后：弃掉朦胧之雾。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
// 附属/帷幕写入走引擎原语（scenario-runtime 的 attachShroud → location-attachments.js），
// 卡文件不再直接改 location.fog / shroudMod。

export default {
  code: '01168', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api, { location }) {
    if (!location) return false
    const fog = api.attachShroud?.(location.id, 2, '01168')
    if (!fog) return false
    api.info?.(`🌫️ 朦胧之雾附着于「${location.name}」：隐藏值 +2（共 ${fog} 张）。`)
    return true
  },
}
