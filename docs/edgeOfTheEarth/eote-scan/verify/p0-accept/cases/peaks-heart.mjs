// P0-7 / P0-8：疯狂之心 II（08672 不提前清场、R1/R2 记录、08716 ReferenceError）
//                 + 失落之峰/古者之城专属诡计真实结算 + 遭遇牌库含共享组
const H2 = 'theHeartOfMadnessPart2'
const PEAKS = 'toTheForbiddenPeaks'
const CITY = 'cityOfTheElderThings'

const evidence = {
  h2agenda: 'src/engine/act-agenda.js:426-458（checkAgenda → advanceAgenda）；content/.../theHeartOfMadnessPart2/definition.js 08672 doomThreshold',
  h2records: 'content/campaigns/edgeOfTheEarth/records.js:221-240（recordSchema 布尔键）；behavior.preScenarioSetup#recordCampaignLogBranch',
  h2resolution: 'content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js#checkObjectives / resolution',
  ref08716: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js（成功躲避路径 here 未定义）',
  treachery: 'src/engine/treachery-tokens.js:113-124（entryRevelation / encounterResolve / effect.kind==campaignRule 才真实结算）',
  draw: 'src/engine/encounter.js:99-200（drawEncounter 真实遭遇抽取）',
  deck: 'content/scenario-manifest.js#requiredEncounterGroupIds + scenario.encounterDeck',
}

const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

function currentAgenda(state) {
  return state.agendas?.[state.agendaIndex ?? 0] || null
}

function resolutionOf(state) {
  return state.campaign?.scenarioResults?.at?.(-1)?.resolution || state.resolution || null
}

function towerData(state) {
  return state.scenarioFlags?.mechanics?.eote?.facilities?.towers || null
}

function relocateAll(ctx, state, locationId) {
  for (const seat of state.investigators.map(inv => inv.seat)) {
    if (state.investigators[seat].defeated || state.investigators[seat].resigned) continue
    ctx.drive(state, draft => ctx.world.engine.relocateInvestigator(draft, seat, locationId, []))
  }
}

export const p07 = {
  id: 'P0-7',
  title: 'Heart2 08672 不提前清场、R1/R2 记录真实写入、08716 成功躲避无 ReferenceError',
  async run(ctx) {
    const { playMove, settleChoices, cloneState } = await import('../lib/harness.mjs')
    // ---- 08672 不提前清场（真实神话入口 checkAgenda） ----
    {
      const state = ctx.clone(ctx.open(H2))
      const first = currentAgenda(state)
      ctx.check('[theHeartOfMadnessPart2] 开局议程 08671 @3', String(first?.originalCode) === '08671' && first?.doomThreshold === 3, {
        expected: '08671 @3', actual: `${first?.originalCode} @${first?.doomThreshold}`, evidence: evidence.h2agenda,
      })
      state.doom = 3
      const out = ctx.drive(state, (draft, events) => ctx.world.engine.checkAgenda(draft, events))
      ctx.check('[theHeartOfMadnessPart2] checkAgenda 推进到 08672（不 throw）', state.agendaIndex === 1, {
        expected: 'agendaIndex=1（当前 08672）', actual: `agendaIndex=${state.agendaIndex} current=${currentAgenda(state)?.originalCode} status=${state.status}`,
        evidence: evidence.h2agenda,
      })
      const second = currentAgenda(state)
      ctx.check('[theHeartOfMadnessPart2] 议程 08672 的 doomThreshold 不是 0（印刷无 doom → 不能即时推进）',
        second?.doomThreshold !== 0, {
          expected: 'doomThreshold ≠ 0（null/undefined 或按参考实现的正阈值）',
          actual: `08672 doomThreshold=${JSON.stringify(second?.doomThreshold)}`,
          evidence: evidence.h2agenda,
        })
      const before = {
        agendaIndex: state.agendaIndex,
        locations: state.locations.map(location => location.id).sort(),
        pylons: state.locations.filter(location => location.mistPylon).length,
        story: JSON.stringify((state.campaign.records || {}).theTeamEscapedTheFacility ?? null),
      }
      const out2 = ctx.drive(state, (draft, events) => ctx.world.engine.checkAgenda(draft, events))
      const after = {
        agendaIndex: state.agendaIndex,
        locations: state.locations.map(location => location.id).sort(),
        pylons: state.locations.filter(location => location.mistPylon).length,
      }
      ctx.check('[theHeartOfMadnessPart2] doom=0 的下一次神话阶段不再提前推进 08672（agendaIndex 保持 1）',
        state.agendaIndex === 1, {
          expected: 'agendaIndex 保持 1', actual: `agendaIndex=${state.agendaIndex} current=${currentAgenda(state)?.originalCode} status=${state.status}`,
          evidence: evidence.h2agenda,
        })
      ctx.check('[theHeartOfMadnessPart2] 08672 不提前清场：幕 3 的高塔地点仍在场',
        after.pylons === before.pylons && after.pylons >= 5 && JSON.stringify(after.locations) === JSON.stringify(before.locations), {
          expected: `${before.pylons} 座高塔地点全部保留`,
          actual: `pylons ${before.pylons}→${after.pylons} locationsΔ=${before.locations.length}→${after.locations.length} story=${JSON.stringify((state.campaign.records || {}).theTeamEscapedTheFacility ?? null)}`,
          evidence: 'content/.../theHeartOfMadnessPart2/behavior.js#applyRampSequence（坡道清场只应在 08672 真实推进时发生）',
        })
    }
    // ---- R1/R2 记录：真实 setup 写点 + 真实结局分流 ----
    {
      const state = ctx.open(H2)
      const records = state.campaign?.records || {}
      const written = typeof records.drKenslerHasAPlan === 'boolean' && typeof records.theTruthOfTheMirageEludesYou === 'boolean'
      ctx.check('[theHeartOfMadnessPart2] 真实 setup 写入 R1/R2 门槛记录（drKenslerHasAPlan / theTruthOfTheMirageEludesYou）',
        written && records.drKenslerHasAPlan !== records.theTruthOfTheMirageEludesYou, {
          expected: '两个布尔记录被写入且互补（一个 true 一个 false）',
          actual: JSON.stringify({ plan: records.drKenslerHasAPlan, truth: records.theTruthOfTheMirageEludesYou }),
          evidence: evidence.h2records,
        })
      const runBranch = (recordKey, expectedResolution) => {
        const branch = ctx.clone(ctx.open(H2))
        branch.campaign.records[recordKey] = true
        branch.campaign.records[recordKey === 'drKenslerHasAPlan' ? 'theTruthOfTheMirageEludesYou' : 'drKenslerHasAPlan'] = false
        branch.actIndex = 1 // 最终幻景幕 08681（状态准备：直接从终幕验证结局分流）
        // 全部 5 座高塔坍塌（写入引擎既有 facilities 状态；行为断言仍走 checkObjectives/结局）
        const towers = towerData(branch)
        for (const tower of Object.values(towers || {})) tower.collapsed = true
        // 隐藏隧道入场（状态准备：让「全员在隐藏隧道」条件可满足）
        if (!branch.locations.some(location => location.id === 'hiddenTunnel')) {
          const definition = branch.scenario.locations.hiddenTunnel
          if (definition) branch.locations.push({ ...JSON.parse(JSON.stringify(definition)), revealed: true, clues: 0, doom: 0 })
        }
        relocateAll(ctx, branch, 'hiddenTunnel')
        try {
          const out = ctx.drive(branch, (draft, events) => ctx.world.engine.checkAct(draft, events))
          ctx.check(`[theHeartOfMadnessPart2] ${expectedResolution} 真实可达（checkAct → 结局分流）`,
            resolutionOf(branch) === expectedResolution || out.scenarioEnded, {
              expected: `${expectedResolution} 写入战役结算`,
              actual: `resolution=${resolutionOf(branch)} scenarioEnded=${out.scenarioEnded} status=${branch.status}`,
              evidence: evidence.h2resolution,
            })
        } catch (error) {
          ctx.fail(`[theHeartOfMadnessPart2] ${expectedResolution} 真实可达`, {
            expected: '不抛错且结局写入', actual: `抛错：${error.message}`, evidence: evidence.h2resolution,
          })
        }
      }
      runBranch('drKenslerHasAPlan', 'resolution1')
      runBranch('theTruthOfTheMirageEludesYou', 'resolution2')
    }
    // ---- 08716 伊里亚·阿什瓦克：真实成功躲避路径无 ReferenceError ----
    {
      const state = ctx.clone(ctx.open(H2))
      const seat = ctx.decisionSeat(state)
      const inv = state.investigators[seat]
      const here = state.locations.find(location => location.id === inv.location)
      const destination = (here?.connections || []).map(id => state.locations.find(location => location.id === id)).find(Boolean)
      inv.assets ||= []
      inv.assets.push({ id: 'probe-08716', code: '08716', originalCode: '08716', exhausted: false, uses: 3, usesType: 'secrets', controllerSeat: seat })
      state.enemies ||= []
      state.enemies.push({
        id: 'probe-enemy-08716', code: '08584', originalCode: '08584', name: '记忆敌人',
        location: inv.location, engagedSeat: seat, exhausted: false, damage: 0, horror: 0,
        fight: 2, evade: 1, health: 3, traits: ['Monster'],
      })
      state.investigators[seat].actionsLeft = 3
      state.chaosBag = ['0']
      const moves = ctx.legal(state, seat)
      const ability = moves.find(move => move.action === 'ability' && move.assetId === 'probe-08716')
      ctx.check('[theHeartOfMadnessPart2] 08716 主动能力是真实 legalMoves 行动', Boolean(ability), {
        expected: 'legalMoves 含 ability（assetId=probe-08716）',
        actual: `abilities=${JSON.stringify(moves.filter(move => move.action === 'ability').map(move => move.assetId))}`,
        evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js',
      })
      if (ability) {
        let thrown = null
        try {
          playMove(ctx.world, state, ability, seat)
          settleChoices(ctx.world, state)
        } catch (error) { thrown = error }
        ctx.check('[theHeartOfMadnessPart2] 08716 成功躲避路径无 ReferenceError（here is not defined）',
          thrown == null, {
            expected: '无 ReferenceError', actual: thrown ? `${thrown.constructor?.name}: ${thrown.message}` : '正常结算',
            evidence: evidence.ref08716,
          })
        const enemyAfter = (state.enemies || []).find(item => item.id === 'probe-enemy-08716')
        const invAfter = state.investigators[seat]
        const movedOrPending = thrown == null && (
          state.pendingChoice != null
          || !(state.enemies || []).some(item => item.id === 'probe-enemy-08716')
          || enemyAfter?.exhausted === true
          || (destination && invAfter.location !== inv.location))
        ctx.check('[theHeartOfMadnessPart2] 08716 成功躲避真实后果（敌人被躲避/可移动选择出现）',
          movedOrPending, {
            expected: 'autoEvade 生效（敌人 exhausted）或出现移动选择', actual: `enemy=${JSON.stringify(enemyAfter ? { exhausted: enemyAfter.exhausted } : null)} pending=${state.pendingChoice?.kind || null} location=${invAfter.location}`,
            evidence: evidence.ref08716,
          })
      }
    }
  },
}

// ---------------------------------------------------------------------------
// P0-8：Peaks/City 专属诡计真实结算 + 遭遇牌库含共享组
// ---------------------------------------------------------------------------

// 参考实现 Setup 的 gather 组（tekelili 是独立弱点牌库，不进主遭遇牌库）：
//   Peaks：本章 + Deadly Weather / Elder Things / Hazards of Antarctica / Nameless Horrors（Tekeli-li 单独建库）
//   City v1：本章 + Elder Things / Miasma / Nameless Horrors / Penguins / Locked Doors
//           （Shoggoths 组按 setup v1 放一边 setAside；08641 星之恐怖放一边；08642/08646/08647 按 setup 移出游戏）
const CHAPTER_SHARED_GROUPS = Object.freeze({
  toTheForbiddenPeaks: ['deadlyWeather', 'elderThings', 'hazardsOfAntarctica', 'namelessHorrors'],
  cityOfTheElderThings: ['elderThings', 'miasma', 'namelessHorrors', 'penguins', 'lockedDoors'],
})
const CHAPTER_OWN_IN_DECK = Object.freeze({
  toTheForbiddenPeaks: ['08609', '08610', '08611', '08612', '08613'],
  cityOfTheElderThings: ['08643', '08644', '08645'],
})

function chapterDeckGroups(ctx, scenarioId) {
  const state = ctx.open(scenarioId)
  const deck = state.encounterDeck || []
  const shared = CHAPTER_SHARED_GROUPS[scenarioId] || []
  const rows = shared.map(group => {
    const code = snake(group)
    const expected = Object.entries(ctx.cards)
      .filter(([, card]) => card.encounterCode === code && ['enemy', 'treachery'].includes(card.type))
      .map(([codeValue]) => codeValue)
    const hits = expected.filter(cardCode => deck.includes(cardCode))
    return { group, expected: expected.length, hits: hits.length, sample: hits.slice(0, 2) }
  })
  const ownExpected = CHAPTER_OWN_IN_DECK[scenarioId] || []
  const ownHits = ownExpected.filter(cardCode => deck.includes(cardCode))
  return { deck, rows, ownHits, ownExpected, state }
}

function drawTreachery(ctx, scenarioId, code) {
  const state = ctx.clone(ctx.open(scenarioId))
  const seat = ctx.decisionSeat(state)
  const inv = state.investigators[seat]
  state.chaosBag = ['autofail']
  state.encounterDeck = [code]
  const before = {
    horror: inv.horror || 0, damage: inv.damage || 0,
    clues: (state.locations.find(location => location.id === inv.location)?.clues) || 0,
    threat: (inv.threat || []).map(card => card.originalCode || card.code),
    chaosBag: [...(state.chaosBag || [])],
    surge: state.scenarioFlags?.avalancheSurge === true,
  }
  let thrown = null
  try {
    ctx.drive(state, (draft, events) => ctx.world.engine.drawEncounter(draft, draft.investigators[seat], events))
  } catch (error) { thrown = error }
  const invAfter = state.investigators[seat]
  const after = {
    horror: invAfter.horror || 0, damage: invAfter.damage || 0,
    clues: (state.locations.find(location => location.id === invAfter.location)?.clues) || 0,
    threat: (invAfter.threat || []).map(card => card.originalCode || card.code),
    chaosBag: [...(state.chaosBag || [])],
    surge: state.scenarioFlags?.avalancheSurge === true,
  }
  return { thrown, before, after, state, inv: invAfter }
}

export const p08 = {
  id: 'P0-8',
  title: 'Peaks/City 专属诡计真实遭遇结算 + 遭遇牌库含共享组',
  async run(ctx) {
    // ---- 遭遇牌库含共享组 ----
    for (const scenarioId of [PEAKS, CITY]) {
      const { rows, deck, ownHits, ownExpected, state } = chapterDeckGroups(ctx, scenarioId)
      const missing = rows.filter(row => row.expected > 0 && row.hits === 0)
      ctx.check(`[${scenarioId}] 遭遇牌库含参考 Setup 声明的共享组`,
        rows.length > 0 && missing.length === 0, {
          expected: `全部共享组（${(CHAPTER_SHARED_GROUPS[scenarioId] || []).join(',')}）在 encounterDeck 中各有 ≥1 张`,
          actual: `deck=${deck.length} rows=${JSON.stringify(rows.map(row => `${row.group}:${row.hits}/${row.expected}`))}`,
          evidence: evidence.deck,
        })
      ctx.check(`[${scenarioId}] 遭遇牌库含本章专属敌人/诡计`, ownHits.length === ownExpected.length, {
        expected: `本章在牌库卡 ${ownExpected.join(',')} 全部在场`,
        actual: `own=${JSON.stringify(ownHits)} setAside=${JSON.stringify((state.scenarioZones?.setAside || []).slice(0, 12))}`,
        evidence: evidence.deck,
      })
      if (scenarioId === CITY) {
        // v1 setup：Shoggoths 组与 08641 放一边；08642（benign elder thing）按 removeEvery 移出游戏。
        const setAside = state.scenarioZones?.setAside || []
        const removed = state.scenarioZones?.removed || []
        ctx.check('[cityOfTheElderThings] v1 setup 的放一边/移出游戏分流正确（Shoggoths 组 + 08641 放一边；08642 移出）',
          ['08710', '08711', '08641'].every(code => setAside.includes(code)) && removed.includes('08642'), {
            expected: 'setAside 含 08710/08711/08641；removed 含 08642',
            actual: `setAside=${JSON.stringify(setAside.slice(-8))} removed=${JSON.stringify(removed)}`,
            evidence: 'definition.js#SET_ASIDE_BY_VERSION / REMOVED_BY_VERSION',
          })
      }
    }
    // ---- 诡计定义的可结算标记（引擎读点） ----
    for (const [scenarioId, codes, expectedEffects] of [
      [PEAKS, ['08610', '08611', '08612', '08613'], {
        '08610': { clues: 2 }, '08611': { surge: true }, '08612': { damage: 2 }, '08613': { frostOrHorror: true },
      }],
      [CITY, ['08644', '08645', '08646', '08647'], {
        '08644': { horror: 2 }, '08645': { damage: 1 }, '08646': { threat: '08646' }, '08647': { threat: '08647' },
      }],
    ]) {
      const state = ctx.open(scenarioId)
      const defs = state.scenario?.treacheries || {}
      const markers = codes.map(code => {
        const def = defs[code] || {}
        const entry = ctx.world.registeredEntry(code) || {}
        const resolvable = def.entryRevelation === true
          && (def.effect?.kind === 'campaignRule' || Boolean(entry.encounterResolve) || Boolean(entry.treacheryRule?.test))
        return { code, entryRevelation: def.entryRevelation, effectKind: def.effect?.kind, encounterResolve: Boolean(entry.encounterResolve), test: Boolean(entry.treacheryRule?.test), resolvable }
      })
      ctx.check(`[${scenarioId}] 8 张专属诡计声明引擎可结算标记（entryRevelation + campaignRule/encounterResolve）`,
        markers.every(row => row.resolvable), {
          expected: '每张都有真实引擎结算读点', actual: JSON.stringify(markers), evidence: evidence.treachery,
        })
      // ---- 真实 drawEncounter：每张都应有可观测效果 ----
      for (const code of codes) {
        const expected = expectedEffects[code]
        const { thrown, before, after, state, inv } = drawTreachery(ctx, scenarioId, code)
        if (thrown) {
          ctx.fail(`[${scenarioId}] drawEncounter ${code} 不抛错`, {
            expected: '真实遭遇抽取成功结算', actual: `抛错：${thrown.message}`, evidence: evidence.draw,
          })
          continue
        }
        let observed = false
        if (expected.clues) observed = after.clues - before.clues === expected.clues
        else if (expected.damage) observed = after.damage - before.damage >= expected.damage
        else if (expected.horror) observed = after.horror - before.horror >= expected.horror
        else if (expected.surge) observed = after.surge === true
        else if (expected.frostOrHorror) {
          const frostAdded = after.chaosBag.filter(token => token === 'frost').length > before.chaosBag.filter(token => token === 'frost').length
          observed = frostAdded || after.horror > before.horror
        } else if (expected.threat) observed = after.threat.includes(expected.threat)
        ctx.check(`[${scenarioId}] 真实 drawEncounter ${code} 结算非零（非仅展示文本）`, observed, {
          expected: JSON.stringify(expected),
          actual: JSON.stringify({ before, after }),
          evidence: evidence.draw,
        })
      }
    }
  },
}

export const peaksHeart = [p07, p08]
