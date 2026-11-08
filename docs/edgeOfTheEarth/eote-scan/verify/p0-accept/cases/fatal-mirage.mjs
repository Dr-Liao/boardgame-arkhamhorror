// P0-5 / P0-13：致命幻景（Fatal Mirage）——议程/版本/线索/翻面/结局记录 + 08549 混乱标记真实检定值
const FM = 'fatalMirage'

const evidence = {
  agendaReveal: 'src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）',
  actReveal: 'src/engine/reveal.js:151-176（runActReveal → behavior.actReveal）',
  resolution: 'src/engine/campaign-flow.js:241-243（引擎读 behavior.resolution 写战役记录）',
  flip: 'src/engine/moves.js:222 + src/engine/dispatch.js:633（actions → legalMoves → performAction）；locationStory → behavior.flipStoryFace',
  tokens: 'src/engine/treachery-tokens.js:348-352 / src/engine/tests.js（performTest 真实检定值）',
}

function currentAgenda(state) {
  return state.agendas?.[state.agendaIndex ?? 0] || null
}

function storyOf(events) {
  return (events || []).filter(event => event.kind === 'story')
}

export const p05 = {
  id: 'P0-5',
  title: 'FM 议程推进不 throw/v2v3 索引与印刷阈值/19 地点线索/翻面行动可达/resolution 记录',
  async run(ctx) {
    // ---- 议程推进（v1）：真实 checkAgenda，到达印刷阈值后不抛错且背面生效 ----
    {
      const state = ctx.clone(ctx.open(FM))
      const agenda = currentAgenda(state)
      ctx.check('[fatalMirage] 开局议程为 08550（v1）且阈值=印刷 15',
        String(agenda?.originalCode) === '08550' && agenda?.doomThreshold === 15, {
          expected: '08550 @15', actual: `${agenda?.originalCode} @${agenda?.doomThreshold}`,
          evidence: 'src/cards/cards-data.js 08550.doom=15',
        })
      state.doom = agenda?.doomThreshold ?? 15
      let out = null
      try {
        out = ctx.drive(state, (draft, events) => ctx.world.engine.checkAgenda(draft, events))
      } catch (error) {
        ctx.fail('[fatalMirage] checkAgenda 到达阈值不 throw（议程背面已接线）', {
          expected: '不抛「密谋规则尚未迁移：08550」', actual: `抛错：${error.message}`, evidence: evidence.agendaReveal,
        })
      }
      if (out) {
        ctx.pass('[fatalMirage] checkAgenda 到达阈值不 throw（议程背面已接线）', {
          actual: `agendaIndex=${state.agendaIndex} status=${state.status}`, evidence: evidence.agendaReveal,
        })
        const defeated = state.investigators.filter(inv => inv.defeated).length
        ctx.check('[fatalMirage] 议程 08550 背面真实效果：剩余调查员全部被击败',
          defeated === state.investigators.length && state.investigators.length > 0, {
            expected: '全部 investigators.defeated=true（08550 背面：每位剩余调查员被击败）',
            actual: `defeated=${defeated}/${state.investigators.length}`,
            evidence: 'content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js#agendaReveal',
          })
        const ended = state.resolution === 'noResolution'
          || state.campaign?.scenarioResults?.at?.(-1)?.resolution === 'noResolution'
          || state.uiState === 'scenarioResult'
        ctx.check('[fatalMirage] 全员被击败后关卡可正常结束（noResolution）', ended, {
          expected: 'noResolution 写入结算（state.resolution / scenarioResults / uiState=scenarioResult）',
          actual: `resolution=${state.resolution} results=${JSON.stringify(state.campaign?.scenarioResults?.map(item => item.resolution))} uiState=${state.uiState} status=${state.status}`,
          evidence: 'src/engine/campaign-flow.js:241-243（引擎读 behavior.resolution 写战役记录）',
        })
      }
    }
    // ---- v2/v3：真实重入（幕间门 → 第二次/第三次进入），版本化议程/幕数据 ----
    for (const entry of [2, 3]) {
      let state = null
      try {
        state = ctx.open({ id: FM, entry })
      } catch (error) {
        ctx.fail(`[fatalMirage] 第 ${entry} 次进入（真实战役重入流程）`, {
          expected: '可通过幕间门第二次/第三次进入幻景', actual: `打开失败：${error.message}`,
          evidence: 'content/campaigns/edgeOfTheEarth/interludes.js:190-262（open 选项）',
        })
        continue
      }
      const agenda = currentAgenda(state)
      const act = state.acts?.[state.actIndex ?? 0]
      const expected = entry === 2
        ? { agenda: '08551', doom: 13, act: '08554', stage: '2a' }
        : { agenda: '08552', doom: 11, act: '08555', stage: '3a' }
      ctx.check(`[fatalMirage v${entry}] 重入版本 = ${entry}（scenarioFlags.fatalMirageVersion）`,
        Number(state.scenarioFlags?.fatalMirageVersion) === entry, {
          expected: `fatalMirageVersion=${entry}`, actual: `${state.scenarioFlags?.fatalMirageVersion}`,
          evidence: 'content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js#fatalMirageVersion',
        })
      ctx.check(`[fatalMirage v${entry}] 当前议程 ${expected.agenda} @${expected.doom}（不再索引越界/阈值恒 15）`,
        String(agenda?.originalCode) === expected.agenda && agenda?.doomThreshold === expected.doom, {
          expected: `${expected.agenda} @${expected.doom}`,
          actual: `agendaIndex=${state.agendaIndex} current=${agenda?.originalCode || 'undefined'} @${agenda?.doomThreshold}`,
          evidence: 'definition.js#AGENDA_STAGES（印刷 08551/08552 doom=13/11）',
        })
      ctx.check(`[fatalMirage v${entry}] 当前幕 ${expected.act}（stage ${expected.stage}）`,
        String(act?.originalCode) === expected.act && String(act?.stage).startsWith(expected.stage), {
          expected: `${expected.act} stage ${expected.stage}`, actual: `${act?.originalCode || 'undefined'} stage=${act?.stage}`,
          evidence: 'definition.js#ACT_STAGES（印刷 08554/08555）',
        })
      // 版本 2/3 的议程能真实推进（不再 no-op）
      const advanced = ctx.clone(state)
      advanced.doom = agenda?.doomThreshold ?? expected.doom
      let out = null
      try {
        out = ctx.drive(advanced, (draft, events) => ctx.world.engine.checkAgenda(draft, events))
      } catch (error) {
        ctx.fail(`[fatalMirage v${entry}] checkAgenda 推进不 throw`, {
          expected: '不抛错', actual: `抛错：${error.message}`, evidence: evidence.agendaReveal,
        })
      }
      if (out) {
        ctx.check(`[fatalMirage v${entry}] 到达阈值后议程真实推进（不再 doom=13/11 仍 no-op）`,
          advanced.agendaIndex > (state.agendaIndex ?? 0) || advanced.status !== 'playing' || advanced.resolution != null, {
            expected: 'agendaIndex 前进或关卡结算', actual: `agendaIndex ${state.agendaIndex}→${advanced.agendaIndex} status=${advanced.status}`,
            evidence: evidence.agendaReveal,
          })
      }
    }
    // ---- 19 个幻景地点的线索（Mirage）：不再是 0 ----
    {
      const state = ctx.open(FM)
      const locations = state.scenario?.locations || {}
      const rows = Object.entries(locations).map(([id, location]) => ({
        id, clues: location.cluesPerInvestigator ?? location.clues, tier: location.tier ?? location.mirage,
      }))
      const zero = rows.filter(row => !(row.clues > 0))
      ctx.check('[fatalMirage] 19 个幻景地点 cluesPerInvestigator > 0（Mirage 印刷值）',
        rows.length === 19 && zero.length === 0, {
          expected: '19/19 地点 clues>0', actual: zero.length ? `${zero.length} 个仍为 0：${JSON.stringify(zero.slice(0, 5))}` : `19/19：${JSON.stringify(rows.slice(0, 6))}`,
          evidence: 'definition.js#LOCATIONS（clues=印刷 Mirage 每玩家线索值）',
        })
      const placed = state.locations?.[0]
      ctx.check('[fatalMirage] 入场地点（prisonOfMemories）按 Mirage 规则有线索（>0）',
        Boolean(placed) && (placed.clues || 0) > 0 && (placed.maxClues || 0) > 0, {
          expected: 'prisonOfMemories clues>0 且 maxClues>0',
          actual: placed ? `${placed.id} clues=${placed.clues} maxClues=${placed.maxClues}` : '无入场地点',
          evidence: 'behavior.js#mirageClueTotal / locationPlaced',
        })
      // ---- 幻景翻面行动（flipStoryFace 引擎可达）：真实 legalMoves + applyMove ----
      const flipState = ctx.clone(state)
      const seat = ctx.decisionSeat(flipState)
      const inv = flipState.investigators[seat]
      const here = flipState.locations.find(location => location.id === inv.location)
      const tier = here ? (here.tier ?? here.mirage ?? 1) : 1
      inv.clues = tier * 2 // 2 位调查员在场时的 Mirage 费用（tier × 人数），状态准备
      if (flipState.investigators[1]) flipState.investigators[1].location = inv.location
      const moves = ctx.legal(flipState, seat)
      const flipMove = moves.find(move => move.action === 'scenarioAction' && /mirageFlip|幻景翻面/.test(`${move.rule || ''}${move.label || ''}`))
      ctx.check('[fatalMirage] 幻景「花线索翻面」是真实 legalMoves 行动（flipStoryFace 引擎可达）', Boolean(flipMove), {
        expected: 'legalMoves 含 scenarioAction rule=mirageFlip:*（带 label，非仅 disabled 提示）',
        actual: `scenarioActions=${JSON.stringify(moves.filter(m => m.action === 'scenarioAction').map(m => [m.rule, m.label]))}`,
        evidence: evidence.flip,
      })
      if (flipMove) {
        const before = { locations: flipState.locations.length, victory: (flipState.victoryDisplay || []).length, resolved: Boolean(flipState.scenarioFlags?.fatalMirageMayAdvance) }
        try {
          const { playMove, settleChoices } = await import('../lib/harness.mjs')
          playMove(ctx.world, flipState, flipMove, seat)
          settleChoices(ctx.world, flipState)
          const after = { locations: flipState.locations.length, victory: (flipState.victoryDisplay || []).length, resolved: Boolean(flipState.scenarioFlags?.fatalMirageMayAdvance) }
          ctx.check('[fatalMirage] 真实 applyMove 翻面产生剧情后果（揭示幻景地点/胜利区/可推进标记）',
            after.locations > before.locations || after.victory > before.victory || (after.resolved && !before.resolved), {
              expected: '翻面后揭示新地点或写入剧情/胜利区或置 fatalMirageMayAdvance',
              actual: JSON.stringify({ before, after }), evidence: evidence.flip,
            })
        } catch (error) {
          ctx.fail('[fatalMirage] 真实 applyMove 翻面产生剧情后果', {
            expected: 'applyMove 成功并触发 flipStoryFace', actual: `抛错：${error.message}`, evidence: evidence.flip,
          })
        }
      }
      // 反向验证（P0-5 翻面行动的线索门槛）：调查员 0 线索时不存在「可执行」的幻景翻面行动（只有提示/disabled）。
      const gateState = ctx.clone(ctx.open(FM))
      const gateSeat = ctx.decisionSeat(gateState)
      for (const inv of gateState.investigators) inv.clues = 0
      const gateFlips = ctx.legal(gateState, gateSeat)
        .filter(move => move.action === 'scenarioAction' && /mirageFlip/.test(String(move.rule || '')))
      const executable = gateFlips.filter(move => !move.reason && move.label)
      ctx.check('[P0-5 反向验证] 线索不足（0）时没有可执行的幻景翻面行动（GroupClueCost 门槛真实生效）',
        executable.length === 0, {
          expected: '0 个带 label 的可执行 mirageFlip 行动',
          actual: `mirageFlip=${gateFlips.length} executable=${executable.length} sample=${JSON.stringify(gateFlips.slice(0, 2).map(move => [move.rule, move.reason || null, move.label || null]))}`,
          evidence: evidence.flip,
        })
    }
    // ---- resolution 记录：真实引擎 endScenario 结算后写 campaign.records ----
    {
      const state = ctx.clone(ctx.open(FM))
      const keys = Object.keys(state.scenario?.resolutions || {})
      const key = keys.includes('victory') ? 'victory' : keys[0]
      try {
        const { finishScenario } = await import('../lib/harness.mjs')
        finishScenario(ctx.world, state, key)
        const records = state.campaign?.records || {}
        ctx.check('[fatalMirage] 真实结算写入 fatalMirageTimes/fatalMirageResolution',
          Number(records.fatalMirageTimes) >= 1 && records.fatalMirageResolution === key, {
            expected: `fatalMirageTimes>=1 且 fatalMirageResolution=${key}`,
            actual: `times=${records.fatalMirageTimes} resolution=${records.fatalMirageResolution} keys=${Object.keys(records).filter(name => /fatalMirage|memories/i.test(name)).join(',')}`,
            evidence: evidence.resolution,
          })
        ctx.check('[fatalMirage] 真实结算写入 memoriesDiscovered / memoriesBanished 记录',
          Array.isArray(records.memoriesDiscovered) && Array.isArray(records.memoriesBanished), {
            expected: 'campaign.records.memoriesDiscovered/​memoriesBanished 为数组',
            actual: `discovered=${JSON.stringify(records.memoriesDiscovered)} banished=${JSON.stringify(records.memoriesBanished)}`,
            evidence: evidence.resolution,
          })
      } catch (error) {
        ctx.fail('[fatalMirage] 真实结算写入 campaign.records', {
          expected: 'endScenario 结算不抛错并写记录', actual: `抛错：${error.message}`, evidence: evidence.resolution,
        })
      }
    }
  },
}

// ---------------------------------------------------------------------------
// P0-13：08549 混乱标记在真实 performTest 中 delta 非 0
// ---------------------------------------------------------------------------

export const p013 = {
  id: 'P0-13',
  title: 'FM 08549 混乱标记在真实 performTest 中 delta 非 0（cultist/tablet/elderthing/skull）',
  async run(ctx) {
    // 印刷 08549：整段数值为「负数」修正——[skull] -X（X=胜利区剧情卡数）、[cultist] -2、[tablet] -3、[elder_thing] -4。
    const expected = [
      { token: 'cultist', delta: -2 },
      { token: 'tablet', delta: -3 },
      { token: 'elderthing', delta: -4 },
      { token: 'skull', delta: -2, storyCards: 2 },
    ]
    for (const row of expected) {
      const state = ctx.clone(ctx.open(FM))
      const seat = ctx.decisionSeat(state)
      const inv = state.investigators[seat]
      if (row.storyCards) state.victoryDisplay = Array.from({ length: row.storyCards }, (_, index) => ({ code: `0855${6 + index}b`, type: 'story' }))
      state.chaosBag = [row.token]
      const base = ctx.world.engine.getStat(state, inv, 'willpower')
      let out = null
      try {
        out = ctx.drive(state, (draft, events) => ctx.world.engine.performTest(draft, seat, 'willpower', 0, {}))
      } catch (error) {
        ctx.fail(`[fatalMirage] performTest 抽到 [${row.token}] 不抛错`, {
          expected: '真实检定完成', actual: `抛错：${error.message}`, evidence: evidence.tokens,
        })
        continue
      }
      const result = out.result || {}
      const delta = Number(result.value) - Number(base)
      ctx.check(`[fatalMirage] performTest [${row.token}] 修正值 = ${row.delta}（非 0，真实引擎读点）`,
        delta === row.delta, {
          expected: `delta=${row.delta}（base=${base} → value=${base + row.delta}）`,
          actual: `delta=${delta}（base=${base} → value=${result.value}，drawn=${JSON.stringify(result.drawn)}）`,
          evidence: evidence.tokens,
        })
      ctx.check(`[fatalMirage] performTest [${row.token}] 修正值非 0`, delta !== 0, {
        expected: '≠0', actual: `delta=${delta}`, evidence: evidence.tokens,
      })
    }
    // 直接读点对照：resolveSpecialToken（引擎统一入口）也应返回同一套数值
    const state = ctx.clone(ctx.open(FM))
    const direct = {}
    for (const token of ['cultist', 'tablet', 'elderthing']) {
      try { direct[token] = ctx.world.engine.resolveSpecialToken(state, 0, state.investigators[0], token, [])?.delta } catch (error) { direct[token] = `THREW ${error.message}` }
    }
    ctx.check('[fatalMirage] resolveSpecialToken 与 performTest 同源（cultist=-2, tablet=-3, elderthing=-4）',
      direct.cultist === -2 && direct.tablet === -3 && direct.elderthing === -4, {
        expected: '{cultist:-2, tablet:-3, elderthing:-4}', actual: JSON.stringify(direct), evidence: evidence.tokens,
      })
  },
}

export const fatalMirage = [p05, p013]
