// 03051 楼座
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：强制 - 你执行移动行动从楼座移动到剧院后：受到2点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03051', scope: 'location',
  locationRule: {
    onLeave: { effect(state, loc, api, inv) { if (inv.location === 'theatre') api.damage(inv.seat, 2) } },
  },
}
