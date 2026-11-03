// 06097 棱镜光华（Prismatic Phenomenon，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamlands（TSK）。
// 卡面：Revelation - 将棱镜光华放置入场，放到你的威胁区域。
//       你每轮第一次执行以下行动（抽取、资源、打出）之一时，须支付额外 1 个行动。
//       强制 - 你成功调查一个地点后：不发现线索，改为弃掉棱镜光华。
// 实现：首次抽牌/资源/打出行动的额外费用走 threatEffect.extraActionCost；
//   调查成功时由 investigationSuccessReplacement 在发现线索前弃掉本卡并替代奖励。
export default {
  code: '06097',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    threatArea: true,
    investigationSuccessReplacement({ source, inv, api }) {
      if (!api.removeThreat?.(source)) return false
      api.info?.(`🔮 ${inv.name} 成功调查后没有发现线索，改为弃掉「棱镜光华」。`)
      return true
    },
  },
  threatEffect: { extraActionCost: ['draw', 'resource', 'play'] },
  encounterResolve(state, inv, card, api) {
    api.threat?.(inv.seat, '06097', {
      threatEffect: { extraActionCost: ['draw', 'resource', 'play'] },
    })
    api.info?.(`🔮 ${inv.name} 被「棱镜光华」笼罩。`)
    return true
  },
}
