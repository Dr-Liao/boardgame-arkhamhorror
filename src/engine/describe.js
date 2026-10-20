// 状态描述（describeState）从 engine.js 拆出的第二个模块（Phase 6 · 6d-2）。
//
// 它是一个**纯投影**：只读 state、只拼字符串，不写 state、不触发事件、不消耗随机数。
// 依赖通过依赖注入传入（而不是 import engine），这样：
//   1. 本模块与 engine 没有循环依赖；
//   2. 需要哪些能力一眼可见（下面这行解构就是契约）。
//
// 依赖清单里的每个名字都必须由调用方（engine.js）提供；少一个会在首次调用时报错，
// 所以外部 import 路径不变时，拆分是安全的。

export function createDescribeState(deps) {
  const {
    campaignFor,
    inHub,
    describeTeamParticipation,
    actingSeats,
    legalMoves,
    actObjectiveContext,
    totalDoom,
    agendaDoom,
    scenarioBehavior,
    locName,
    getMaxHealth,
    getMaxSanity,
    getStat,
    cardName,
    assetEffect,
    CLASS_NAMES,
    investigatorParticipation,
    decisionSeat,
    aliveInvestigators,
    describeFreeAbilities,
    describePrey,
    enemyEvadeValue,
    enemyFightValue,
    enemyHealth,
    narrativeLogTexts,
    scriptActionHints,
    stripLabel,
  } = deps

  function describeState(state, observerSeat = decisionSeat(state)) {
  const CAMPAIGN = campaignFor(state)
  if (inHub(state)) {
    const lines = [...describeTeamParticipation(state, observerSeat), `【战役局外】${state.campaign.name} · ${state.uiState} · 难度 ${state.difficulty}`]
    lines.push('待操作席位：' + actingSeats(state).join('、') + '；下一关：' + (state.hubSelectedScenarioId || '未选择'))
    for (const inv of state.investigators) {
      const record = state.campaign.investigators[inv.seat]
      lines.push(`${inv.seat}：${inv.name} · ${record ? `牌组 ${record.deck.length} 张 · ${record.xp} XP` : '未保存牌组'}`)
    }
    lines.push('【可执行行动】')
    if (actingSeats(state).includes(observerSeat)) for (const move of legalMoves(state, observerSeat)) lines.push(JSON.stringify(move))
    return lines.join('\n')
  }
  const lines = describeTeamParticipation(state, observerSeat)
  const act = state.acts[state.actIndex]
  const ag = state.agendas[state.agendaIndex]
  const scIdx = state.campaign ? state.campaign.scenarioIndex : 0
  const totalScenarios = CAMPAIGN.scenarioOrder.length

  lines.push('【合作调查】《诡镇奇谈：卡牌版》第 ' + (scIdx + 1) + '/' + totalScenarios + ' 关：' + state.scenario.name + '，第 ' + state.round + ' 回合（难度：' + state.difficulty + '）。')
  lines.push('目标是合作通关：收集线索推进「场景」，同时避免「密谋」因毁灭推进、避免调查员全部倒下。')

  lines.push('')
  lines.push('【场景 ' + (act ? act.stage : '?') + '】' + (act ? act.name + '：' + act.text : '（已通关）'))
  const objective = actObjectiveContext(state)
  if (objective) lines.push('【当前场景推进条件】' + JSON.stringify(objective))
  const onBoardDoom = totalDoom(state) - agendaDoom(state)
  lines.push('【密谋 ' + (ag ? ag.stage : '?') + '】' + (ag ? ag.name + '：' + ag.text : '（已失败）') + ' 密谋毁灭 ' + agendaDoom(state) + '/' + (ag ? ag.doomThreshold : '?')
    + (onBoardDoom > 0 ? `（场上另有毁灭 ${onBoardDoom}，不计入阈值）` : '') + '。')
  lines.push('队内线索：' + state.clues + '；本关胜利点：' + state.victory + '。')

  // 战役进度：经验 / 累计胜利点 / 创伤（跨关继承）。
  if (state.campaign) {
    const traumas = []
    for (const inv of state.investigators) {
      const t = state.campaign.trauma[inv.seat] || { physical: 0, mental: 0 }
      if ((t.physical || 0) || (t.mental || 0)) traumas.push(`${inv.name} 肉体${t.physical || 0}/精神${t.mental || 0}`)
    }
    lines.push('战役进度：未花费经验合计 ' + state.campaign.xp + '、累计胜利点 ' + state.campaign.victory + (traumas.length ? '；创伤 ' + traumas.join('、') : '；无创伤') + '。')
    lines.push('个人经验：' + Object.values(state.campaign.investigators).map(record => `${record.name} ${record.xp} XP（已花费 ${record.spentXp}）`).join('；'))
    if (state.campaign.phase === 'interlude') lines.push('当前为关间准备，只能回答待决选择；经验不会自动升级，也不会重建既有牌组。')
  }

  lines.push(...(scenarioBehavior(state).describe?.(state) || []))

  lines.push('')
  lines.push('【调查员队伍】')
  for (const inv of state.investigators) {
    const participation = investigatorParticipation(state, inv)
    const alive = participation.status === 'active'
    const mark = alive && inv.seat === state.currentSeat ? ' ◀ 当前行动' : ''
    lines.push(`- ${inv.name}（${CLASS_NAMES[inv.klass] || inv.klass}，位置「${locName(state, inv.location)}」）` +
      ` 生命 ${getMaxHealth(inv) - inv.damage}/${getMaxHealth(inv)} 理智 ${getMaxSanity(inv) - inv.horror}/${getMaxSanity(inv)}` +
      ` 资源 ${inv.resources} 行动 ${inv.actionsLeft}${alive ? '' : '（' + participation.statusLabel + '）'}${mark}`)
    lines.push(`  属性：意志${getStat(state, inv, 'willpower')} 智识${getStat(state, inv, 'intellect')} 战斗${getStat(state, inv, 'combat')} 敏捷${getStat(state, inv, 'agility')}`)
    lines.push(`  线索 ${inv.clues}；手牌(${inv.hand.length})：${inv.seat === observerSeat ? inv.hand.map((c) => cardName(c)).join('、') || '（空）' : '（隐藏）'}`)
    if (inv.assets.length) {
      lines.push(`  资产：${inv.assets.map((a) => {
        const eff = assetEffect(inv, a)
        const usesTxt = (eff && eff.uses) ? `(${a.uses}/${eff.uses})` : ''
        return (a.exhausted ? '✗' : '') + cardName(a.code) + usesTxt
      }).join('、')}`)
    }
    if (inv.engaged.length) {
      const es = inv.engaged.map((eid) => { const e = state.enemies.find((x) => x.id === eid); return e ? e.name : eid }).join('、')
      lines.push(`  交战：${es}`)
    }
    if (inv.threat.length) {
      lines.push(`  威胁区域：${inv.threat.map((t) => cardName(t.code) + ((t.counters != null) ? `(${t.counters})` : '')).join('、')}`)
    }
    const freeAbilities = alive ? describeFreeAbilities(state, inv) : []
    if (freeAbilities.length) {
      lines.push(`  可用免费能力：${freeAbilities.join('；')}`)
    }
  }

  lines.push('')
  lines.push('【地点与连接图】')
  for (const loc of state.locations) {
    const here = aliveInvestigators(state).filter((i) => i.location === loc.id).map((i) => i.name).join('、')
    const enemiesHere = state.enemies.filter((e) => e.location === loc.id && e.engagedSeat == null).map((e) => e.name).join('、')
    const conns = loc.connections.map((c) => locName(state, c)).join('、')
    lines.push(`- ${loc.name}（${loc.id}）：帷幕 ${loc.shroud}，线索 ${loc.clues}${loc.locked ? '，🔒上锁' : ''}；连接「${conns || '无'}」${here ? '；调查员：' + here : ''}${enemiesHere ? '；敌人：' + enemiesHere : ''}`)
  }

  if (state.enemies.length) {
    lines.push('')
    lines.push('【敌人意图】')
    for (const e of state.enemies) {
      const eng = e.massive ? '与所在地点所有人交战' : (e.engagedSeat != null ? state.investigators[e.engagedSeat]?.name : '无')
      const kw = [e.hunter && '猎手', e.retaliate && '反击', e.alert && '警戒', e.elite && '精英', e.massive && '庞大'].filter(Boolean).join(' ')
      const intent = [
        e.hunter && '会主动向最近调查员移动',
        e.prey && ('猎物「' + describePrey(e.prey) + '」'),
        e.retaliate && '攻击落空会反击',
      ].filter(Boolean).join('；')
      const healthText = enemyHealth(state, e) > 0
        ? `生命 ${enemyHealth(state, e) - e.damageTaken}/${enemyHealth(state, e)}`
        : '生命 无'
      lines.push(`- ${e.name}：战斗${enemyFightValue(state, e, state.investigators[observerSeat])} 躲避${enemyEvadeValue(state, e, state.investigators[observerSeat])} ${healthText}${e.doom ? ` 毁灭${e.doom}` : ''}${kw ? '（' + kw + '）' : ''}，交战「${eng}」${e.exhausted ? '（已横置）' : ''}${intent ? '；意图：' + intent : ''}`)
    }
  }

  if (state.pendingChoice && (state.pendingChoice.seat === observerSeat || !state.skillTest || state.skillTest.helpRequested || state.skillTest.seat === observerSeat)) lines.push(`待决选择：${state.pendingChoice.prompt}；回答座位 ${state.pendingChoice.seat}。`)
  const legal = observerSeat === decisionSeat(state) ? legalMoves(state) : []
  if (legal.length) {
    lines.push('')
    lines.push('【可执行行动】（从下列选择一项，用其 JSON 表示）')
    legal.forEach((m, i) => { lines.push(`${i + 1}. ${m.label}  →  ${JSON.stringify(stripLabel(m))}`) })
  }

  // 卡面赋予却暂时走不通的行动：只讲清缺哪个条件，让 AI 能反过来做准备。
  // 未满足条件时该行动不在 legalMoves 里，AI 无从得知它存在；能执行时已在上面的列表，不重复列出。
  if (observerSeat === decisionSeat(state) && !state.pendingChoice) {
    const blocked = scriptActionHints(state, observerSeat).filter(hint => hint.reason)
    if (blocked.length) {
      lines.push('')
      lines.push('【暂时不可执行的卡面行动】（不能直接提交；条件满足后才会出现在上面的可执行列表）')
      blocked.forEach(hint => lines.push(`- ${hint.label}：${hint.reason}`))
    }
  }

  if (state.log.length) {
    lines.push('')
    lines.push('【最近局势】')
    const log = state.skillTest && !state.skillTest.helpRequested && state.skillTest.seat !== observerSeat ? state.skillTest.publicLog || [] : state.log
    const narrative = narrativeLogTexts(state)
    lines.push(log.slice(-12).map((t) => '· ' + (narrative.has(t) ? '（剧情文本已省略）' : t)).join('\n'))
  }

  return lines.join('\n')
}
  return describeState
}
