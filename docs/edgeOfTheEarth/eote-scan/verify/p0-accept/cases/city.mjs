// P0-6 / P0-12：古老者之城 —— 钥匙入口（claim/give）、幕 1 目标可达、议程 2 背面 R2、无 api.test TypeError
const CITY = 'cityOfTheElderThings'

const evidence = {
  hooks: 'src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（behavior.performAction）',
  keys: 'src/engine/scenario-keys.js（数值钥匙唯一状态：scenarioFlags.mechanics.keys，holder location:/investigator:）',
  agenda2: 'src/engine/act-agenda.js:426-458（checkAgenda → advanceAgenda → runAgendaReveal）',
  apiTest: 'src/engine/scenario-runtime.js:657（api.test(seat, skill, difficulty, resolve, …) 签名）',
}

function valueKeys(state) {
  const keys = state.scenarioFlags?.mechanics?.keys || {}
  return Object.entries(keys).filter(([, key]) => key?.kind === 'value')
}

function holderKeys(state, holder) {
  return valueKeys(state).filter(([, key]) => key.holder === holder)
}

function currentAgenda(state) {
  return state.agendas?.[state.agendaIndex ?? 0] || null
}

function actScenarioMoves(ctx, state, seat) {
  return ctx.legal(state, seat).filter(move => move.action === 'scenarioAction')
}

function matchMove(moves, pattern) {
  return moves.find(move => pattern.test(`${move.rule || ''} ${move.label || ''}`))
}

export const p06 = {
  id: 'P0-6',
  title: 'City 钥匙 claim/give 真实入口、幕 1 目标可达、议程 2 背面 R2',
  async run(ctx) {
    const { playMove, settleChoices } = await import('../lib/harness.mjs')
    // ---- 钥匙 claim：真实 legalMoves + applyMove（钥匙从地点进入调查员控制） ----
    {
      const state = ctx.clone(ctx.open(CITY))
      const seat = ctx.decisionSeat(state)
      // 数值钥匙 holder=location:*（16 把）→ 是「取得钥匙」行动的真实对象。
      const holders = valueKeys(state).filter(([, key]) => String(key.holder).startsWith('location:'))
      ctx.check('[cityOfTheElderThings] 开局 16 把数值钥匙分布在场地点（holder=location:*）', holders.length >= 16, {
        expected: '≥16 把 kind=value 钥匙 holder=location:*',
        actual: `keys=${holders.length} locations=${state.locations.length}`,
        evidence: evidence.keys,
      })
      // 真实 relocate 到一个有钥匙的地点；地点线索清 0（状态准备：印刷「所在地点无线索时」才可取得）。
      const targetEntry = holders
        .map(([id, key]) => ({ id, locationId: key.holder.slice('location:'.length) }))
        .find(entry => state.locations.some(location => location.id === entry.locationId)) || null
      if (targetEntry) {
        const target = targetEntry
        ctx.drive(state, draft => ctx.world.engine.relocateInvestigator(draft, seat, target.locationId, []))
        const here = state.locations.find(location => location.id === target.locationId)
        if (here) here.clues = 0
        const seatAfter = ctx.decisionSeat(state)
        const moves = actScenarioMoves(ctx, state, seatAfter)
        const claimMove = matchMove(moves, /claimKey|key:claim|取得|拿取|领取/i)
        ctx.check('[cityOfTheElderThings] claimKey 进入真实 legalMoves（钥匙取得入口）', Boolean(claimMove), {
          expected: 'scenarioAction rule/label 含 claimKey/key:claim/取得钥匙',
          actual: `invLoc=${state.investigators[seatAfter].location} locClues=${here?.clues} scenarioActions=${JSON.stringify(moves.map(move => [move.rule, move.label]))}`,
          evidence: evidence.hooks,
        })
        if (claimMove) {
          const before = holderKeys(state, `investigator:${seatAfter}`).length
          try {
            playMove(ctx.world, state, claimMove, seatAfter)
            settleChoices(ctx.world, state, selectConfirm)
            const after = holderKeys(state, `investigator:${seatAfter}`).length
            ctx.check('[cityOfTheElderThings] applyMove claimKey：钥匙从地点转移到调查员控制',
              after === before + 1, {
                expected: `investigator:${seatAfter} 钥匙数 ${before}→${before + 1}`,
                actual: `after=${after} locationKeyLeft=${holderKeys(state, `location:${target.locationId}`).length}`,
                evidence: evidence.keys,
              })
          } catch (error) {
            ctx.fail('[cityOfTheElderThings] applyMove claimKey', {
              expected: '真实行动成功', actual: `抛错：${error.message}`, evidence: evidence.hooks,
            })
          }
        }
        // ---- giveKeys：同地点两位调查员，真实 legalMoves + applyMove ----
        const giveState = state
        const otherBefore = giveState.investigators.find(inv => inv.seat !== seatAfter)
        if (otherBefore) ctx.drive(giveState, draft => ctx.world.engine.relocateInvestigator(draft, otherBefore.seat, target.locationId, []))
        const seatGive = decisionSeatOf(giveState)
        const giveMoves = actScenarioMoves(ctx, giveState, seatGive)
        const giveMove = matchMove(giveMoves, /giveKey|key:give|交给|转交/i)
        ctx.check('[cityOfTheElderThings] giveKeys 进入真实 legalMoves（钥匙转交入口）', Boolean(giveMove), {
          expected: 'scenarioAction rule/label 含 giveKeys/key:give/交给',
          actual: `scenarioActions=${JSON.stringify(giveMoves.map(move => [move.rule, move.label]))}`,
          evidence: evidence.hooks,
        })
        const other = giveState.investigators.find(inv => inv.seat !== seatAfter)
        if (giveMove && other) {
          const before = holderKeys(giveState, `investigator:${other.seat}`).length
          try {
            playMove(ctx.world, giveState, giveMove, seatGive)
            settleChoices(ctx.world, giveState, selectGiveTarget)
            const after = holderKeys(giveState, `investigator:${other.seat}`).length
            ctx.check('[cityOfTheElderThings] applyMove giveKeys：钥匙转移给同地点另一位调查员', after > before, {
              expected: `investigator:${other.seat} 钥匙数 >${before}`,
              actual: `after=${after}`, evidence: evidence.keys,
            })
          } catch (error) {
            ctx.fail('[cityOfTheElderThings] applyMove giveKeys', {
              expected: '真实行动成功', actual: `抛错：${error.message}`, evidence: evidence.hooks,
            })
          }
        }
      }
    }
    // ---- 幕 1 目标可达：用真实 claim 行动收集 2×elderthing + 2×tablet，再 actKey 花费 → 记录 → 真实 checkAct 推进 ----
    {
      const state = ctx.clone(ctx.open(CITY))
      const seat = ctx.decisionSeat(state)
      // 为了让「取得钥匙」行动在真实状态里可达，清空目标地点线索（状态准备；线索只是计数器，行为断言仍走真实行动）。
      const valueKeysNeeded = valueKeys(state)
        .filter(([, key]) => ['elderthing', 'tablet'].includes(key.value) && String(key.holder).startsWith('location:'))
      for (const [, key] of valueKeysNeeded) {
        const locationId = key.holder.slice('location:'.length)
        const location = state.locations.find(item => item.id === locationId)
        if (location) location.clues = 0
      }
      const claimed = []
      for (const [, key] of valueKeysNeeded) {
        const locationId = key.holder.slice('location:'.length)
        ctx.drive(state, draft => ctx.world.engine.relocateInvestigator(draft, seat, locationId, []))
        const arrived = state.locations.find(item => item.id === locationId)
        if (arrived) arrived.clues = 0 // 状态准备：印刷「所在地点无线索」才可取得钥匙
        const seatNow = ctx.decisionSeat(state)
        const claimMove = matchMove(actScenarioMoves(ctx, state, seatNow), /claimKey|key:claim|取得|拿取|领取/i)
        if (!claimMove) continue
        try {
          playMove(ctx.world, state, claimMove, seatNow)
          settleChoices(ctx.world, state, selectConfirm)
          claimed.push(key.value)
        } catch { /* 单把钥匙失败不中断，下面用总数断言 */ }
      }
      ctx.check('[cityOfTheElderThings] 真实 claim 行动可收集到 2×[elder_thing]+2×[tablet] 钥匙',
        holderKeys(state, `investigator:${seat}`).length >= 4, {
          expected: '控制 ≥4 把 symbol 钥匙', actual: `claimed=${JSON.stringify(claimed)} held=${holderKeys(state, `investigator:${seat}`).map(([, key]) => key.value)}`,
          evidence: evidence.keys,
        })
      // 真实 actKey 行动（费用校验/记录写入都走 behavior.performAction）
      const actMoves = actScenarioMoves(ctx, state, seat).filter(move => String(move.rule || '').startsWith('actKey:'))
      const study = actMoves.find(move => /studyHistory/.test(move.rule))
      const discern = actMoves.find(move => /discernShoggoths/.test(move.rule))
      ctx.check('[cityOfTheElderThings] 幕 1 的两条 keyActions 进入真实 legalMoves', Boolean(study) && Boolean(discern), {
        expected: 'actKey:studyHistory 与 actKey:discernShoggoths', actual: JSON.stringify(actMoves.map(move => move.rule)),
        evidence: evidence.hooks,
      })
      let acted = 0
      for (const move of [study, discern]) {
        if (!move) continue
        try {
          playMove(ctx.world, state, move, seat)
          settleChoices(ctx.world, state)
          acted += 1
        } catch { /* 记录在后续断言中体现 */ }
      }
      const records = state.campaign?.records || {}
      ctx.check('[cityOfTheElderThings] actKey 真实结算后写入幕 1 目标记录',
        records.theTeamStudiedTheHistoryOfTheElderThings === true && records.theTeamDiscernedTheOriginOfTheShoggoths === true, {
          expected: 'theTeamStudiedTheHistoryOfTheElderThings / theTeamDiscernedTheOriginOfTheShoggoths = true',
          actual: `acted=${acted} records=${JSON.stringify({ study: records.theTeamStudiedTheHistoryOfTheElderThings, discern: records.theTeamDiscernedTheOriginOfTheShoggoths })}`,
          evidence: 'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08624.js#actRule.keyActions',
        })
      // 真实 checkAct：目标满足后幕应推进（幕 1 目标可达）
      try {
        ctx.drive(state, (draft, events) => ctx.world.engine.checkAct(draft, events))
        ctx.check('[cityOfTheElderThings] 幕 1 目标可达：真实 checkAct 推进 actIndex', state.actIndex > 0, {
          expected: 'actIndex ≥ 1（08624 → 08627）', actual: `actIndex=${state.actIndex} status=${state.status} resolution=${state.resolution || null}`,
          evidence: 'src/engine/act-agenda.js:177-233（checkLinearAct → behavior.checkObjectives）',
        })
      } catch (error) {
        ctx.fail('[cityOfTheElderThings] 幕 1 目标可达：真实 checkAct 推进', {
          expected: '不抛错且 actIndex 前进', actual: `抛错：${error.message}`, evidence: 'src/engine/act-agenda.js:177-233',
        })
      }
    }
    // ---- 议程 2 背面 R2：真实 checkAgenda → advanceAgenda → 结局 2 ----
    {
      const state = ctx.clone(ctx.open(CITY))
      const agenda2 = state.agendas?.[1]
      ctx.check('[cityOfTheElderThings] 议程 2 = 08623 @10', String(agenda2?.originalCode) === '08623' && agenda2?.doomThreshold === 10, {
        expected: '08623 @10', actual: `${agenda2?.originalCode} @${agenda2?.doomThreshold}`, evidence: 'src/cards/cards-data.js 08623.doom=10',
      })
      state.agendaIndex = 1
      state.doom = 10
      let out = null
      try {
        out = ctx.drive(state, (draft, events) => ctx.world.engine.checkAgenda(draft, events))
      } catch (error) {
        ctx.fail('[cityOfTheElderThings] 议程 2 到达阈值不 throw', {
          expected: '不抛「密谋规则尚未迁移：08623」', actual: `抛错：${error.message}`, evidence: evidence.agenda2,
        })
      }
      if (out) {
        const lastResult = state.campaign?.scenarioResults?.at?.(-1)
        ctx.check('[cityOfTheElderThings] 议程 2 背面结算为 R2（resolution2 写入真实结算记录）',
          lastResult?.resolution === 'resolution2' || state.resolution === 'resolution2', {
            expected: 'resolution2（08623 背面 → 结局 2）',
            actual: `scenarioResults=${JSON.stringify(state.campaign?.scenarioResults?.map(item => item.resolution))} state.resolution=${state.resolution} status=${state.status}`,
            evidence: 'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08623.js（agendaRule.onReveal → R2）',
          })
      }
    }
    // ---- 反向验证（P0-6 真实门槛）----
    {
      const { playMove, settleChoices } = await import('../lib/harness.mjs')
      // 1) 所在地点仍有线索时，claim 不是合法行动（Keys 特别规则：无线索才可快速取得）。
      const gated = ctx.clone(ctx.open(CITY))
      const gatedSeat = ctx.decisionSeat(gated)
      const holder = valueKeys(gated).find(([, key]) => String(key.holder).startsWith('location:'))
      const holderLocationId = holder ? holder[1].holder.slice('location:'.length) : null
      if (holderLocationId) {
        ctx.drive(gated, draft => ctx.world.engine.relocateInvestigator(draft, gatedSeat, holderLocationId, []))
        const here = gated.locations.find(location => location.id === holderLocationId)
        if (here) here.clues = 2
        const claims = actScenarioMoves(ctx, gated, gatedSeat).filter(move => /key:claim|claimKey/.test(String(move.rule || '')))
        ctx.check('[P0-6 反向验证] 地点仍有线索时 claim 不进入 legalMoves（印刷「无线索」门槛）',
          claims.length === 0, {
            expected: '0 个 key:claim（所在地点 clues=2）',
            actual: `claims=${JSON.stringify(claims.map(move => [move.rule, move.label]))} clues=${here?.clues}`,
            evidence: '英文 setup specialRules.Keys / 08621：While at a location with no clues: claim a key',
          })
      }
      // 2) 幕 1 目标未完成时，真实 checkAct 不推进 actIndex。
      const early = ctx.clone(ctx.open(CITY))
      ctx.drive(early, (draft, events) => ctx.world.engine.checkAct(draft, events))
      ctx.check('[P0-6 反向验证] 幕 1 目标未完成时 checkAct 不推进（不会假推进）',
        early.actIndex === 0, {
          expected: 'actIndex 保持 0', actual: `actIndex=${early.actIndex} records=${JSON.stringify(early.campaign?.records?.theTeamStudiedTheHistoryOfTheElderThings ?? null)}`,
          evidence: 'src/engine/act-agenda.js:177-233',
        })
      void playMove; void settleChoices
    }
  },
}

function selectConfirm(choice) {
  const ids = (choice.options || []).map(option => option.id)
  if (ids.includes('confirm')) return 'confirm'
  if (ids.includes('done')) return 'done'
  if (ids.includes('skip')) return 'skip'
  return null
}

/** 交出钥匙的目标座位选择：选不是 0 的座位 id。 */
function selectGiveTarget(choice) {
  const ids = (choice.options || []).map(option => String(option.id))
  const target = ids.find(id => id !== '0' && id !== 'confirm' && id !== 'cancel' && id !== 'skip')
  if (target) return target
  return selectConfirm(choice)
}

function decisionSeatOf(state) {
  return state.currentSeat ?? 0
}

// ---------------------------------------------------------------------------
// P0-12：地点动作 api.test 签名正确（真实 applyMove 不再抛 options.resolve is not a function）
// ---------------------------------------------------------------------------

export const p012 = {
  id: 'P0-12',
  title: 'City 地点动作无 api.test TypeError（真实 applyMove 触发真实 performTest）',
  async run(ctx) {
    const { playMove, settleChoices } = await import('../lib/harness.mjs')
    const state = ctx.clone(ctx.open(CITY))
    const seat = ctx.decisionSeat(state)
    const actions = ctx.legal(state, seat).filter(move => move.action === 'scenarioAction' && String(move.rule || '').startsWith('loc:'))
    ctx.check('[cityOfTheElderThings] 开局提供地点动作 scenarioAction:loc:*（真实 legalMoves）', actions.length > 0, {
      expected: '至少 1 条 loc:* 地点动作（如 loc:bridgeDiscover）',
      actual: JSON.stringify(actions.map(move => move.rule)), evidence: evidence.hooks,
    })
    const target = actions.find(move => /bridgeDiscover/.test(move.rule)) || actions[0]
    if (!target) return
    state.chaosBag = ['0']
    let thrown = null
    try {
      playMove(ctx.world, state, target, seat)
      settleChoices(ctx.world, state, selectConfirm)
    } catch (error) {
      thrown = error
    }
    ctx.check('[cityOfTheElderThings] applyMove 地点动作不抛 api.test TypeError',
      thrown == null, {
        expected: '无「options.resolve is not a function」/TypeError',
        actual: thrown ? `${thrown.constructor?.name || 'Error'}: ${thrown.message}` : '正常返回',
        evidence: evidence.apiTest,
      })
    const skillTest = state.lastTestResult || state.skillTest || null
    const performed = Boolean(skillTest && (skillTest.skill || skillTest.difficulty != null))
    ctx.check('[cityOfTheElderThings] 地点动作真实触发了技能检定（api.test 第 4 参 resolve 生效）',
      performed && !Number.isNaN(Number(skillTest?.difficulty ?? NaN)), {
        expected: `真实 skillTest 已结算（skill/difficulty 有效）`,
        actual: skillTest ? JSON.stringify({ skill: skillTest.skill, difficulty: skillTest.difficulty, success: skillTest.success, value: skillTest.value }) : '无 skillTest',
        evidence: evidence.apiTest,
      })
  },
}

export const city = [p06, p012]
