// 09740 阴晦日食（Tenebrous Eclipse） · 诡计 · agents_of_yuggoth
// 归属：战役共用 · theScarletKeys/_shared/agentsOfYuggoth。
// 卡面：显现 - 将阴晦日食放置入场，放在密谋牌库旁。
//   每位调查员每轮不能揭露超过 1 张隐匿迷你卡牌。
//   强制 - 当一轮结束时：从场上弃掉 1 张阴晦日食。（每轮最多一次。）
//   Revelation - Put Tenebrous Eclipse into play next to the agenda deck.
//   No more than 1 concealed mini-card can be exposed by each investigator each round.
//   Forced - At the end of the round: Discard 1 copy of Tenebrous Eclipse from play. (Max once per round.)
// 读点：
//   · 「放在密谋牌库旁」= api.putNextToAgenda（agendaAside 唯一写入口）；返回 { placed: true } 阻止进遭遇弃牌堆；
//   · 「一轮结束时弃掉 1 张（每轮最多一次）」= 条目级 `treacheryRule.discardOneAtRoundEnd`
//     —— src/engine/phases.js#upkeepPhase 的旁置卡扫描（同轮最多弃 1 张同名副本），
//     同类卡 07095「印斯茅斯之雾」/07107/04094；不再声明 roundEnds 描述子：
//     agendaAside 不在 nonPlayerAbilitySources 的来源枚举里（ability-rules.js#nonPlayerAbilitySources），
//     该描述子在真实引擎里永远不会被派发（旧实现因此不可达）。
// 缺读点：「每位调查员每轮最多揭露 1 张隐匿迷你卡」需要一个 Expose 事务读点
//   （当前 7 章 behavior 各自暴露，tsk-concealed 的 exposeMiniCard 不查任何限制），见汇报。
const CODE = '09740'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: {
    discardOneAtRoundEnd: true,
    // 2026-11-13 P1-16：每位调查员每轮最多揭露 1 张隐匿迷你卡。读点：
    // tsk-concealed.js#exposeLimitPerInvestigator（扫 agendaAside 的 treacheryRule）+
    // api-mechanics 的 concealed.expose 事务（超限抛错并阻止揭露）。
    exposeLimitPerInvestigatorPerRound: 1,
  },
  encounterResolve(state, inv, card, api) {
    api.putNextToAgenda(CODE)
    api.info?.('🌑 「阴晦日食」被放到密谋牌库旁。')
    return { placed: true }
  },
  note: 'approximation: 卡面三个子句均已接线；「敌军阶段」类时序若与其它窗口交织，以 phases.js 的轮末扫描为准。'
    + ' 「放在密谋牌库旁」走 agendaAside 原语；「轮末弃掉 1 张（每轮最多一次）」走'
    + ' treacheryRule.discardOneAtRoundEnd（phases.js 的旁置卡扫描）；「每位调查员每轮最多揭露 1 张」'
    + '走 treacheryRule.exposeLimitPerInvestigatorPerRound + tsk-concealed/api-mechanics 的揭露事务限制。',
}
