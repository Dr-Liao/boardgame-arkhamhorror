// 06097 棱镜光华（Prismatic Phenomenon，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamlands（TSK）。
// 卡面：Revelation - 将棱镜光华放置入场，放到你的威胁区域。
//       你每轮第一次执行以下行动（抽取、资源、打出）之一时，须支付额外 1 个行动。
//       强制 - 你成功调查一个地点后：不发现线索，改为弃掉棱镜光华。
// 实现：威胁区放置走 api.threat；「首次某类行动 +1 行动费」需要引擎 AdditionalActionCostOf
//   的内容通道、「成功调查后不发现线索」需要 investigateResult 数据分派 → 已登记 coordinator request。
export default {
  code: '06097',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  encounterResolve(state, inv, card, api) {
    api.threat?.(inv.seat, '06097')
    api.info?.(`🔮 ${inv.name} 被「棱镜光华」笼罩。`)
    return true
  },
  flags: {
    firstActionCostIncrease: { actions: ['draw', 'resource', 'play'], amount: 1 },
    discardInsteadOfClues: true,
  },
  simplified: true,
  note: '两类效果都需要共享层数据分派（行动额外费用通道 / 调查成功替代），已登记 coordinator request。',
}
