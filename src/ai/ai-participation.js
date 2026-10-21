// Public participation facts shared by the prose and structured AI context.
// The engine's resolved flags, not inferred health thresholds, are authoritative.

// 局外准备阶段：座位是否已经有确定的人选。
// 建局会给每个座位预分配一位调查员（setup.js 的 pickAiInvestigator），那只是占位；
// 只有 hubSeatSelected 或已存在的战役记录才算数。进关后每座位必然已定，直接返回 true。
export function investigatorAssigned(state, seat) {
  if (!state.hubFlow || state.uiState === 'inScenario') return true
  return Boolean(state.campaign?.investigators?.[seat] || state.hubSeatSelected?.[seat])
}

export function investigatorParticipation(state, inv) {
  const campaignStatus = state.campaign?.investigators?.[inv.seat]?.status || 'active'
  const status = campaignStatus === 'killed' || campaignStatus === 'insane'
    ? campaignStatus : inv.resigned ? 'resigned' : inv.defeated ? 'defeated' : 'active'
  const labels = { active: '未离场', defeated: '已被击败（本关出局）', resigned: '已撤退（本关离场）',
    killed: '已永久死亡', insane: '已永久疯狂' }
  return { status, statusLabel: labels[status], defeated: Boolean(inv.defeated),
    resigned: Boolean(inv.resigned), defeatCause: inv.defeatCause || null, campaignStatus,
    canParticipateInScenario: state.uiState === 'inScenario' && state.status === 'playing' && status === 'active' }
}

export function describeTeamParticipation(state, observerSeat = null) {
  const lines = ['【队伍参与状态（当前事实，优先于旧聊天和计划）】']
  const hubPrep = Boolean(state.hubFlow) && state.uiState !== 'inScenario'
  const own = state.investigators.find(inv => inv.seat === observerSeat)
  if (own) {
    lines.push(hubPrep && !investigatorAssigned(state, own.seat)
      ? `你（座位 ${own.seat}）还没选调查员；建局时预分配的「${own.name}」只是占位，不代表已选。`
      : `你扮演的调查员是「${own.name}」（座位 ${own.seat}）。局面、事件和聊天中的「${own.name}」就是你自己，提到时用第一人称；其他调查员才是队友。`)
  }
  for (const inv of state.investigators) {
    if (hubPrep && !investigatorAssigned(state, inv.seat)) {
      lines.push(`- 座位 ${inv.seat}：还没选调查员（未定职业，不要按建局占位推算队伍构成）。`)
      continue
    }
    const p = investigatorParticipation(state, inv)
    const cause = { damage: '伤害', horror: '恐惧', both: '伤害与恐惧' }[p.defeatCause]
    const mine = inv.seat === observerSeat ? '（你）' : ''
    lines.push(`- 座位 ${inv.seat}／${inv.name}${mine}：${p.statusLabel}${p.defeated && cause ? `，因${cause}被击败` : ''}；`
      + (p.canParticipateInScenario ? '仍可参与本关，具体行动以当前合法选项为准。'
        : p.status !== 'active' ? '不能继续参与本关行动、投入或支援；不要给该调查员分配任务。'
          : '当前不在进行中的关卡内，按当前准备或结算选项处理。'))
  }
  return lines
}
