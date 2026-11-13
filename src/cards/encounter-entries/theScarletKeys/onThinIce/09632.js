// 09632 冰层破裂（Cracking Ice）· 诡计 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。印刷 4 份，[[危险]]。
// 卡面（中）：显现 - 将冰层破裂放置入场，放在密谋牌库旁。然后，如果密谋牌库旁有至少 3 张冰层破裂，
//   将其全部弃掉，每位在[[荒地]]地点的调查员检定[敏捷](4)。每位检定失败的调查员每低于难度 1 点，
//   必须受到 1 点伤害、受到 1 点恐惧，或失去 1 个行动。
//
// 结算入口：`encounterResolve`（章节 behavior.resolveEncounter 分派；`treachery.effect.kind` 在
// definition 里声明为 campaignRule）。全部写入走 `ctx.api`：
//   · 「放在密谋牌库旁」= api.putNextToAgenda；「旁边有几张」= api.agendaAsideCards()（公开读点）；
//   · 「全部弃掉」= api.discardAgendaAside(id)（实例 id 从只读的 state.agendaAside 取）；
//   · 检定 = api.test；逐点三选一 = api.choice + api.harm / api.loseActions。
export default {
  code: '09632',
  name: '冰层破裂',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const code = '09632'
    if (typeof api?.putNextToAgenda === 'function') api.putNextToAgenda(code)
    const copies = (typeof api?.agendaAsideCards === 'function' ? api.agendaAsideCards() : [])
      .filter(item => item === code).length
    api?.info?.(`🧊 冰层破裂放置到密谋牌库旁（共 ${copies} 张）。`)
    if (copies < 3) return true
    const ids = (state.agendaAside || [])
      .filter(entry => (entry.originalCode || entry.code) === code)
      .map(entry => entry.id)
    for (const id of ids) if (typeof api?.discardAgendaAside === 'function') api.discardAgendaAside(id)
    api?.info?.(`🧊 密谋牌库旁已有 ${ids.length} 张冰层破裂：全部弃掉，[[荒地]]地点的调查员检定[敏捷](4)。`)
    for (const other of (state.investigators || [])) {
      if (!other || other.defeated || other.resigned) continue
      const here = (state.locations || []).find(location => location.id === other.location)
      const wilderness = (here?.traits || []).some(trait => String(trait).toLowerCase() === 'wilderness')
      if (!wilderness) continue
      api?.test?.(other.seat, 'agility', 4, result => {
        if (result?.success) {
          api?.info?.(`🧊 ${other.name || '调查员'} 稳住了脚步。`)
          return
        }
        const failedBy = Math.max(1, Number(result?.failedBy) || (4 - (Number(result?.value) || 0)))
        for (let index = 0; index < failedBy; index += 1) {
          const answer = api?.choice?.({
            kind: 'choice', source: code, seat: other.seat,
            prompt: `冰层破裂（剩余 ${failedBy - index} 次）：受到 1 点伤害、1 点恐惧，或失去 1 个行动。`,
            options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' },
              { id: 'action', label: '失去 1 个行动' }],
          }) || 'damage'
          if (answer === 'horror') api?.harm?.(other.seat, { horror: 1 })
          else if (answer === 'action') {
            if (typeof api?.loseActions === 'function') api.loseActions(other.seat, 1)
            else other.actionsLeft = Math.max(0, (Number(other.actionsLeft) || 0) - 1)
          } else api?.harm?.(other.seat, { damage: 1 })
          if (other.defeated || other.resigned) break
        }
      }, 0, { code, name: '冰层破裂', action: 'revelation' })
    }
    void inv
    void card
    return true
  },
  note: 'approximation: 「密谋牌库旁」复用 `state.agendaAside`（P2 公开读/弃原语）；'
    + '「每低于难度 1 点三选一」按失败差值逐点询问（引擎 applyPenalty 没有「三选一」的声明式 kind）。'
    + '「放在密谋牌库旁」的卡不进入威胁区，因此 09609 的 [skull] 与 09621 的涌动判定按'
    + ' behavior.chaos.hazardTreacheriesInPlay（威胁区 + 密谋旁 + 地点/敌人附属）统一计数。',
}
