// 05045 失踪事件（The Disappearance）· 幕（序章 05043 专属）。
//
// 印刷规则（中文）：
//   强制 - 在有调查员退场时：改为将该调查员的每个线索放在本场景上，而不是放在所在地点。
//   目标 - 在你不可避免的末日来临之前，发现尽可能多的线索。
//   背面 1b：在剧本日志中记录下你被追捕。翻回场景 1a。
//
// 实现位置：
//   · 正面两条都在章节 behavior：`investigatorEliminated` 接管「线索放到幕上」（返回 truthy，
//     引擎因此不再把线索放到地点）；幕没有可推进目标（序章不推进）。
//   · 背面 1b 的 onReveal 把「你被追捕」写进战役记录（本仓库 `youAreBeingHunted` 为座位 string[]），
//     并依赖 behavior.actIndexAfterAdvance 返回 0 实现「翻回场景 1a」。
//
// 一卡一文件：本卡规则只在这里声明；不 import 引擎/content。
export default {
  code: '05045',
  scope: 'act',
  implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const records = (state.campaign && (state.campaign.records ||= {})) || {}
      if (!Array.isArray(records.youAreBeingHunted)) records.youAreBeingHunted = []
      // 「记录下你被追捕」：本仓库该记录类型是「被追捕的座位」，把所有仍在场的座位写入。
      for (const inv of state.investigators || []) {
        if (inv.defeated || inv.resigned) continue
        const seat = String(inv.seat)
        if (!records.youAreBeingHunted.includes(seat)) records.youAreBeingHunted.push(seat)
      }
      api?.info?.('📖 场景 1b「失踪事件」：在剧本日志中记录「你被追捕」，然后翻回场景 1a。')
      api?.info?.(`被追捕的座位：${records.youAreBeingHunted.join('、') || '无'}。`)
    },
  },
}
