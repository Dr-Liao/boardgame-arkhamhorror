// P0-1..P0-4：亡命冰原 I/II/III —— 剧本行动/幕议程 reveal/混乱标记/地点数据
import { CERTAIN_FAIL, storyEvents, locationOf } from '../lib/harness.mjs'

const IDP = Object.freeze(['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3'])

const evidence = {
  actions: 'src/engine/moves.js:222（legalMoves 读 behavior.actions）/ src/engine/dispatch.js:633（读 behavior.performAction）',
  agendaReveal: 'src/engine/phases.js:268-283（runAgendaReveal → behavior.agendaReveal）',
  actReveal: 'src/engine/reveal.js:151-176（runActReveal → behavior.actReveal）',
  tokens: 'src/engine/treachery-tokens.js:348-352（resolveSpecialToken → behavior.resolveChaosToken）',
  afterTest: 'src/engine/tests.js:1513（behavior.afterTest 失败回调）',
  location: 'content/campaigns/edgeOfTheEarth/card-data.js#location（印刷 shroud 进入地点数据）',
  entryFee: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#beforeMove（揭示前收费）',
}

function scenarioActionMoves(ctx, state, seat = null) {
  const actual = seat ?? ctx.decisionSeat(state)
  return ctx.legal(state, actual).filter(move => move.action === 'scenarioAction')
}

function resolutionOf(state) {
  return state.campaign?.scenarioResults?.at?.(-1)?.resolution || state.resolution || null
}

// ---------------------------------------------------------------------------
// P0-1：三章剧本行动进入 legalMoves，且真实 applyMove 能执行；advanceAgenda/Act 不 throw
// ---------------------------------------------------------------------------

export const p01 = {
  id: 'P0-1',
  title: 'IDP I/II/III 剧本行动在 legalMoves 且真实可执行；advanceAgenda/advanceAct 不 throw',
  async run(ctx) {
    for (const id of IDP) {
      const state = ctx.open(id)
      // IDP3 营地撤退按印刷需要共同花 4 线索：先按规则条件准备（状态准备；断言仍走真实 legalMoves/applyMove）。
      if (id === 'iceAndDeathPart3') state.investigators[0].clues = 4
      const seat = ctx.decisionSeat(state)
      const moves = scenarioActionMoves(ctx, state, seat)
      ctx.check(`[${id}] legalMoves 含 scenarioAction（营地撤退/翻底牌等真实入口）`, moves.length > 0, {
        expected: 'legalMoves 至少 1 个 action=scenarioAction',
        actual: `actions=${[...new Set(ctx.legal(state, seat).map(m => m.action))].join(',')}`,
        evidence: evidence.actions,
      })
      // 真实 applyMove：执行撤退行动，并断言产生了真实后果（撤退/结算记录），而不是仅列表可见。
      const st = ctx.clone(state)
      const seat2 = ctx.decisionSeat(st)
      const resign = scenarioActionMoves(ctx, st, seat2).find(move => String(move.rule || '').includes('camp')) || scenarioActionMoves(ctx, st, seat2)[0]
      if (!resign) {
        ctx.fail(`[${id}] 可执行的 scenarioAction（真实 applyMove）`, {
          expected: '存在 rule 含 camp 的撤退行动', actual: '无 scenarioAction 可执行', evidence: evidence.actions,
        })
        continue
      }
      // IDP3 营地撤退需共同花 4 线索：先按印刷条件准备（状态准备，不是行为断言）。
      if (id === 'iceAndDeathPart3') st.investigators[0].clues = 4
      try {
        const { playMove } = await import('../lib/harness.mjs')
        playMove(ctx.world, st, resign, seat2)
        const { settleChoices } = await import('../lib/harness.mjs')
        settleChoices(ctx.world, st)
        const resigned = st.investigators.filter(inv => inv.resigned).length
        ctx.check(`[${id}] applyMove(scenarioAction) 产生真实撤退/结算后果`, resigned > 0 || st.status !== 'playing' || resolutionOf(st) != null, {
          expected: '全体撤退（resigned）或关卡结算（resolution 写入）',
          actual: `resigned=${resigned}/${st.investigators.length} status=${st.status} resolution=${resolutionOf(st)} camp=${st.campaign?.records?.camp || null}`,
          evidence: evidence.actions,
        })
      } catch (error) {
        ctx.fail(`[${id}] applyMove(scenarioAction) 执行`, {
          expected: 'applyMove 成功执行撤退', actual: `抛错：${error.message}`, evidence: evidence.actions,
        })
      }
      // advanceAgenda / advanceAct 不 throw（真实引擎函数 + 真实事务）
      try {
        ctx.drive(ctx.clone(state), (draft, events) => ctx.world.engine.advanceAgenda(draft, events))
        ctx.pass(`[${id}] advanceAgenda 不 throw`, { actual: '返回正常', evidence: evidence.agendaReveal })
      } catch (error) {
        ctx.fail(`[${id}] advanceAgenda 不 throw`, { expected: '不抛错', actual: `抛错：${error.message}`, evidence: evidence.agendaReveal })
      }
      try {
        ctx.drive(ctx.clone(state), (draft, events) => ctx.world.engine.advanceAct(draft, events))
        ctx.pass(`[${id}] advanceAct 不 throw`, { actual: '返回正常', evidence: evidence.actReveal })
      } catch (error) {
        ctx.fail(`[${id}] advanceAct 不 throw`, { expected: '不抛错', actual: `抛错：${error.message}`, evidence: evidence.actReveal })
      }
    }
    // 反向验证（P0-1 真实 gate）：把调查员分开到不同地点后，IDP1 的 campResign 必须从 legalMoves 消失。
    {
      const split = ctx.clone(ctx.open('iceAndDeathPart1'))
      ctx.drive(split, draft => ctx.world.engine.relocateInvestigator(draft, 1, 'frozenShores', []))
      const offered = scenarioActionMoves(ctx, split)
      ctx.check('[P0-1 反向验证] 调查员不在同一地点时营地撤退不在 legalMoves（gate 真实生效）',
        offered.length === 0, {
          expected: '0 个 scenarioAction（不满足同地点条件）',
          actual: `scenarioActions=${JSON.stringify(offered.map(move => move.rule))} locations=${JSON.stringify(split.investigators.map(inv => inv.location))}`,
          evidence: evidence.actions,
        })
    }
  },
}

// ---------------------------------------------------------------------------
// P0-2：幕/议程 reveal 真正生效（推进正确 + 背面剧情后果），幕推进走真实钩子
// ---------------------------------------------------------------------------

export const p02 = {
  id: 'P0-2',
  title: 'IDP advanceAgenda/advanceAct 正确推进且幕/议程 reveal 真实生效',
  async run(ctx) {
    // ---- Part I：议程 08518 背面（冷遇）→ 生成疾行谬物；幕 08521 → 结局 1
    {
      const state = ctx.clone(ctx.open('iceAndDeathPart1'))
      const out = ctx.drive(state, (draft, events) => ctx.world.engine.advanceAgenda(draft, events))
      const story = out.events.map(event => event.presentation).filter(presentation => presentation?.kind === 'story')
      ctx.check('[iceAndDeathPart1] advanceAgenda 推进 agendaIndex 0→1', state.agendaIndex === 1, {
        expected: 'agendaIndex=1', actual: `agendaIndex=${state.agendaIndex}`, evidence: evidence.agendaReveal,
      })
      ctx.check('[iceAndDeathPart1] 议程 08518 背面剧情被翻出（story face=back）',
        story.some(presentation => String(presentation.code||'') === '08518' && presentation.face === 'back'), {
          expected: '事件流含 code=08518、face=back 的幕间剧情',
          actual: `story=${JSON.stringify(story.map(presentation => [presentation.code, presentation.face, presentation.title]))}`,
          evidence: evidence.agendaReveal,
        })
      ctx.check('[iceAndDeathPart1] 议程 I 背面真实效果：生成疾行谬物 08515',
        state.enemies.some(enemy => String(enemy.code) === '08515'), {
          expected: 'state.enemies 含 08515（冷遇背面：生成疾行谬物）',
          actual: `enemies=${JSON.stringify(state.enemies.map(enemy => enemy.code))}`,
          evidence: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#resolveColdWelcomeBack',
        })
      // 反向验证（P0-2 reveal 只结算一次 + 第二张议程走不同背面）：
      // 连续推进两次议程 → 08518 冷遇只生成 1 只 08515；08519 深入白雪生成 08522（不同 reveal 分支真实生效）。
      const twice = ctx.clone(ctx.open('iceAndDeathPart1'))
      ctx.drive(twice, (draft, events) => ctx.world.engine.advanceAgenda(draft, events))
      ctx.drive(twice, (draft, events) => ctx.world.engine.advanceAgenda(draft, events))
      const skittering = twice.enemies.filter(enemy => String(enemy.code) === '08515').length
      const terror = twice.enemies.filter(enemy => String(enemy.code) === '08522').length
      ctx.check('[P0-2 反向验证] 连续两次议程 reveal：08518 只结算一次、08519 走另一条真实分支（08522）',
        twice.agendaIndex === 2 && skittering === 1 && terror === 1, {
          expected: 'agendaIndex=2，08515×1，08522×1',
          actual: `agendaIndex=${twice.agendaIndex} enemies=${JSON.stringify(twice.enemies.map(enemy => enemy.code))}`,
          evidence: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#resolveAgendaBack',
        })
      const actState = ctx.clone(ctx.open('iceAndDeathPart1'))
      const actOut = ctx.drive(actState, (draft, events) => ctx.world.engine.advanceAct(draft, events))
      ctx.check('[iceAndDeathPart1] advanceAct 结算幕 08521 背面（→R1）',
        actOut.scenarioEnded || resolutionOf(actState) === 'resolution1' || actState.status !== 'playing', {
          expected: '幕背面生效：resolution1 写入或关卡结束',
          actual: `resolution=${resolutionOf(actState)} scenarioEnded=${actOut.scenarioEnded} status=${actState.status}`,
          evidence: evidence.actReveal,
        })
    }
    // ---- Part II：议程 08523 背面（查看地点底下的卡）；幕 08526 → 结局 1
    {
      const state = ctx.clone(ctx.open('iceAndDeathPart2'))
      const out = ctx.drive(state, (draft, events) => ctx.world.engine.advanceAgenda(draft, events))
      const story = out.events.map(event => event.presentation).filter(presentation => presentation?.kind === 'story')
      ctx.check('[iceAndDeathPart2] advanceAgenda 推进 agendaIndex 0→1', state.agendaIndex === 1, {
        expected: 'agendaIndex=1', actual: `agendaIndex=${state.agendaIndex}`, evidence: evidence.agendaReveal,
      })
      ctx.check('[iceAndDeathPart2] 议程 08523 背面剧情被翻出（story face=back）',
        story.some(presentation => String(presentation.code||'') === '08523' && presentation.face === 'back'), {
          expected: '事件流含 code=08523、face=back', actual: `story=${JSON.stringify(story.map(presentation => [presentation.code, presentation.face]))}`,
          evidence: evidence.agendaReveal,
        })
      const looked = state.scenarioFlags?.lookedAt
      ctx.check('[iceAndDeathPart2] 议程背面真实效果：查看地点底下的遭遇卡',
        Boolean(looked && looked.code && looked.locationId), {
          expected: 'scenarioFlags.lookedAt = { locationId, code }（查看一张压在地点下的卡）',
          actual: JSON.stringify(looked || null),
          evidence: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js#lookUnderLocation',
        })
      const actState = ctx.clone(ctx.open('iceAndDeathPart2'))
      const actOut = ctx.drive(actState, (draft, events) => ctx.world.engine.advanceAct(draft, events))
      ctx.check('[iceAndDeathPart2] advanceAct 结算幕 08526 背面（→R1）',
        actOut.scenarioEnded || resolutionOf(actState) === 'resolution1' || actState.status !== 'playing', {
          expected: 'resolution1 写入或关卡结束',
          actual: `resolution=${resolutionOf(actState)} scenarioEnded=${actOut.scenarioEnded}`,
          evidence: evidence.actReveal,
        })
    }
    // ---- Part III：08544「邪灵现身」强制（有正面朝下卡 → 不推进，移除 2 毁灭并翻出 1 张）；
    //      底牌清空后正常推进；幕 08546 背面可结算。
    {
      const state = ctx.clone(ctx.open('iceAndDeathPart3'))
      const nightmares = state.enemies.filter(enemy => String(enemy.code) === '08547')
      const beneathBefore = nightmares.reduce((sum, enemy) => sum + (enemy.beneath || []).length, 0)
      const doomBefore = state.doom
      state.doom = state.agendas[state.agendaIndex].doomThreshold
      const out = ctx.drive(state, (draft, events) => ctx.world.engine.checkAgenda(draft, events))
      const beneathAfter = state.enemies.filter(enemy => String(enemy.code) === '08547')
        .reduce((sum, enemy) => sum + (enemy.beneath || []).length, 0)
      ctx.check('[iceAndDeathPart3] 08544 强制：底牌存在时不推进议程（agendaIndex 保持 0）',
        state.agendaIndex === 0, {
          expected: 'agendaIndex 保持 0（08544 邪灵现身：改为移除 2 毁灭 + 翻出 1 张底牌）',
          actual: `agendaIndex=${state.agendaIndex} doom ${doomBefore}→${state.doom}`,
          evidence: 'src/engine/act-agenda.js:326-329（agendaWouldAdvance 语义：返回 true = 否决推进）',
        })
      ctx.check('[iceAndDeathPart3] 08544 强制真实后果：毁灭 -2 且翻出 1 张底牌',
        Number(state.doom) === Math.max(0, Number(doomBefore) - 2) && beneathAfter === beneathBefore - 1, {
          expected: `doom=${Math.max(0, doomBefore - 2)} 且底牌 ${beneathBefore}→${beneathBefore - 1}`,
          actual: `doom=${state.doom} 底牌 ${beneathBefore}→${beneathAfter} spawnedFrom=${JSON.stringify(state.scenarioFlags?.spawnedFrom || null)}`,
          evidence: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js#agendaWouldAdvance',
        })
      // 底牌清空后：真实 checkAgenda 正常推进到议程 2
      const cleared = ctx.clone(ctx.open('iceAndDeathPart3'))
      for (const enemy of cleared.enemies) if (Array.isArray(enemy.beneath)) { enemy.beneath = []; enemy.beneathFaceDown = [] }
      cleared.doom = cleared.agendas[cleared.agendaIndex].doomThreshold
      const out2 = ctx.drive(cleared, (draft, events) => ctx.world.engine.checkAgenda(draft, events))
      ctx.check('[iceAndDeathPart3] 底牌清空后议程正常推进（08544→08545）', cleared.agendaIndex === 1, {
        expected: 'agendaIndex=1', actual: `agendaIndex=${cleared.agendaIndex} resolution=${resolutionOf(cleared)}`,
        evidence: evidence.agendaReveal,
      })
      const actState = ctx.clone(ctx.open('iceAndDeathPart3'))
      const actOut = ctx.drive(actState, (draft, events) => ctx.world.engine.advanceAct(draft, events))
      ctx.check('[iceAndDeathPart3] advanceAct 结算幕 08546 背面（→R1/R2）',
        actOut.scenarioEnded || ['resolution1', 'resolution2'].includes(resolutionOf(actState)) || actState.status !== 'playing', {
          expected: '幕背面生效：R1/R2 写入或关卡结束',
          actual: `resolution=${resolutionOf(actState)} scenarioEnded=${actOut.scenarioEnded}`,
          evidence: evidence.actReveal,
        })
    }
  },
}

// ---------------------------------------------------------------------------
// P0-3：IDP 混乱标记修正值走真实 resolveSpecialToken；Part III 失败后果（afterTest）生效
// ---------------------------------------------------------------------------

function tokenDelta(ctx, state, seat, token) {
  try {
    return { ok: true, value: ctx.world.engine.resolveSpecialToken(state, seat, state.investigators[seat], token, []) }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

export const p03 = {
  id: 'P0-3',
  title: 'IDP resolveSpecialToken delta 非 0（真实读点）+ Part III afterTest 失败后果',
  async run(ctx) {
    for (const id of IDP) {
      const state = ctx.clone(ctx.open(id))
      const inv = state.investigators[0]
      // 选一个已揭示且庇护值最高的地点，令 skull 公式可区分 0 与非 0。
      const revealed = state.locations.filter(location => location.revealed === true && Number.isFinite(location.shelter))
      revealed.sort((a, b) => (b.shelter || 0) - (a.shelter || 0))
      const target = revealed[0] || state.locations[0]
      if (target) inv.location = target.id
      const shelter = Number(target?.shelter) || 0
      const skull = tokenDelta(ctx, state, 0, 'skull')
      const cultist = tokenDelta(ctx, state, 0, 'cultist')
      const tablet = tokenDelta(ctx, state, 0, 'tablet')
      const hard = ['hard', 'expert'].includes(String(state.difficulty))
      const expectedSkull = hard ? shelter : Math.ceil(shelter / 2)
      ctx.check(`[${id}] resolveSpecialToken([cultist]) delta = -2（真实引擎读点）`,
        cultist.ok && cultist.value.delta === -2, {
          expected: 'delta=-2', actual: cultist.ok ? `delta=${cultist.value.delta}` : `抛错 ${cultist.error}`,
          evidence: evidence.tokens,
        })
      ctx.check(`[${id}] resolveSpecialToken([tablet]) delta = ${hard ? -4 : -3}`,
        tablet.ok && tablet.value.delta === (hard ? -4 : -3), {
          expected: `delta=${hard ? -4 : -3}`, actual: tablet.ok ? `delta=${tablet.value.delta}` : `抛错 ${tablet.error}`,
          evidence: evidence.tokens,
        })
      ctx.check(`[${id}] resolveSpecialToken([skull]) 按印刷公式 = ${expectedSkull}（庇护值 ${shelter}）`,
        skull.ok && skull.value.delta === expectedSkull, {
          expected: `delta=${expectedSkull}`, actual: skull.ok ? `delta=${skull.value.delta}` : `抛错 ${skull.error}`,
          evidence: evidence.tokens,
        })
      if (shelter > 0) {
        ctx.check(`[${id}] skull delta 非 0（真实读点未回退到默认 0）`, skull.ok && skull.value.delta !== 0, {
          expected: '≠0', actual: skull.ok ? `delta=${skull.value.delta}` : `抛错`, evidence: evidence.tokens,
        })
      }
    }
    // Part III afterTest：失败抽到 [cultist] → 忒咳哩牌库顶洗入（或无法时 +1 恐惧）；
    //                      失败抽到 [tablet] → 按失败差值弃牌库顶。
    {
      const cultistState = ctx.clone(ctx.open('iceAndDeathPart3'))
      const invBefore = cultistState.investigators[0]
      const before = { deck: (invBefore.deck || []).length, horror: invBefore.horror || 0 }
      cultistState.chaosBag = ['cultist']
      const out = ctx.drive(cultistState, (draft, events) => ctx.world.engine.performTest(draft, 0, 'willpower', 100, {}))
      const invAfter = cultistState.investigators[0]
      const after = { deck: (invAfter.deck || []).length, horror: invAfter.horror || 0, drawn: out.result?.drawn }
      ctx.check('[iceAndDeathPart3] afterTest：[cultist] 失败 → 忒咳哩牌库洗入或 +1 恐惧',
        after.horror > before.horror || after.deck !== before.deck, {
          expected: '失败后果生效：deck 长度变化（洗入忒咳哩-哩）或 horror+1',
          actual: `drawn=${JSON.stringify(after.drawn)} deck ${before.deck}→${after.deck} horror ${before.horror}→${after.horror}`,
          evidence: `${evidence.afterTest}；印刷 08501 [cultist] 失败后果`,
        })
      const tabletState = ctx.clone(ctx.open('iceAndDeathPart3'))
      const inv2Before = tabletState.investigators[0]
      const deckBefore = (inv2Before.deck || []).length
      const discardBefore = (inv2Before.discard || []).length
      tabletState.chaosBag = ['tablet']
      const out2 = ctx.drive(tabletState, (draft, events) => ctx.world.engine.performTest(draft, 0, 'willpower', 100, {}))
      const inv2After = tabletState.investigators[0]
      ctx.check('[iceAndDeathPart3] afterTest：[tablet] 失败 → 按失败差值弃牌库顶',
        (inv2After.deck || []).length < deckBefore || (inv2After.discard || []).length > discardBefore, {
          expected: '失败后果生效：弃牌库顶（deck 减少 / discard 增加）',
          actual: `drawn=${JSON.stringify(out2.result?.drawn)} deck ${deckBefore}→${(inv2After.deck || []).length} discard ${discardBefore}→${(inv2After.discard || []).length}`,
          evidence: `${evidence.afterTest}；印刷 08501 [tablet] 失败后果`,
        })
    }
  },
}

// ---------------------------------------------------------------------------
// P0-4：IDP 地点 shroud 为印刷有限值；未探索地点入场费真实收取（含线索不足时拒绝）
// ---------------------------------------------------------------------------

export const p04 = {
  id: 'P0-4',
  title: 'IDP 地点 shroud = 印刷有限值；未探索地点入场费真实收取且线索不足拒绝移动',
  async run(ctx) {
    const { manifestOf } = await import('../lib/harness.mjs')
    // (a) 用 IDP2 开局（13 张地点全部入场）核对印刷帷幕
    {
      const state = ctx.open('iceAndDeathPart2')
      const manifest = manifestOf(ctx.world, 'iceAndDeathPart2')
      const expected = new Map(manifest.locations.map(location => [location.id, ctx.cards[location.frontCode]?.shroud]))
      const rows = state.locations.map(location => ({
        id: location.id, shroud: location.shroud, printed: expected.get(location.id),
      }))
      const bad = rows.filter(row => !Number.isFinite(row.shroud) || row.shroud !== row.printed)
      ctx.check('[iceAndDeathPart2] 13 张冰原地点 shroud 均等于印刷有限值', bad.length === 0 && rows.length === 13, {
        expected: '13/13 地点 Number.isFinite(shroud) 且 === cards-data 印刷 shroud',
        actual: bad.length ? `不一致：${JSON.stringify(bad)}` : `13/13 一致（${rows.map(row => `${row.id}:${row.shroud}`).join(',')}）`,
        evidence: evidence.location,
      })
    }
    // (b) 未探索地点入场费：IDP1，走到 frozenShores 触发相连地点入场，再进入 broadSnowdrifts（1/人）
    {
      const state = ctx.clone(ctx.open('iceAndDeathPart1'))
      const { playMove, settleChoices, locationOf: locOf } = await import('../lib/harness.mjs')
      const seat = ctx.decisionSeat(state)
      const toFrozen = ctx.legal(state, seat).find(move => move.action === 'move' && move.locationId === 'frozenShores')
      ctx.check('[P0-4] 真实移动至 frozenShores 并放置相连未探索地点', Boolean(toFrozen), {
        expected: 'legalMoves 含 move→frozenShores', actual: toFrozen ? '存在' : '缺失', evidence: 'src/engine/movement.js:283',
      })
      if (!toFrozen) return
      playMove(ctx.world, state, toFrozen, seat)
      settleChoices(ctx.world, state)
      const broad = locOf(state, 'broadSnowdrifts')
      ctx.check('[P0-4] 进入 frozenShores 后 broadSnowdrifts 入场且未揭示', Boolean(broad) && broad.revealed === false, {
        expected: 'broadSnowdrifts on map & revealed=false', actual: broad ? `onMap revealed=${broad.revealed}` : '未入场',
        evidence: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#placeConnectedSetAsideLocations',
      })
      if (!broad) return
      const mover = state.investigators[0]
      const totalCost = 1 * state.numInvestigators
      mover.clues = totalCost
      const seat2 = ctx.decisionSeat(state)
      const enter = ctx.legal(state, seat2).find(move => move.action === 'move' && move.locationId === 'broadSnowdrifts')
      ctx.check('[P0-4] 线索足够时 legalMoves 提供进入未探索地点', Boolean(enter), {
        expected: `legalMoves 含 move→broadSnowdrifts（需 ${totalCost} 线索）`,
        actual: enter ? '存在' : `actions=${[...new Set(ctx.legal(state, seat2).map(m => [m.action, m.locationId]))]}`,
        evidence: evidence.entryFee,
      })
      if (enter) {
        try {
          playMove(ctx.world, state, enter, seat2)
          settleChoices(ctx.world, state)
          const broadAfter = locOf(state, 'broadSnowdrifts')
          const cluesAfter = state.investigators.reduce((sum, inv) => sum + (inv.clues || 0), 0)
          ctx.check('[P0-4] 进入未探索地点真实收取入场费并揭示', broadAfter?.revealed === true && cluesAfter === 0, {
            expected: `revealed=true 且线索由 ${totalCost}→0（共同支付 ${totalCost}）`,
            actual: `revealed=${broadAfter?.revealed} clues=${cluesAfter} location=${state.investigators[seat2].location} locClues=${broadAfter?.clues}`,
            evidence: evidence.entryFee,
          })
        } catch (error) {
          ctx.fail('[P0-4] 进入未探索地点真实收取入场费并揭示', {
            expected: '移动成功且收费', actual: `applyMove 抛错：${error.message}`, evidence: evidence.entryFee,
          })
        }
      }
      // 线索不足：legalMoves 不提供该移动，且强制提交被 validateMove 拒绝（不能免费进入）
      const poor = ctx.clone(ctx.open('iceAndDeathPart1'))
      const poorSeat = ctx.decisionSeat(poor)
      const toFrozen2 = ctx.legal(poor, poorSeat).find(move => move.action === 'move' && move.locationId === 'frozenShores')
      if (toFrozen2) {
        playMove(ctx.world, poor, toFrozen2, poorSeat)
        settleChoices(ctx.world, poor)
        for (const inv of poor.investigators) inv.clues = 0
        const poorBroad = poor.locations.find(location => location.id === 'broadSnowdrifts')
        const poorSeat2 = ctx.decisionSeat(poor)
        const illegal = ctx.legal(poor, poorSeat2).some(move => move.action === 'move' && move.locationId === 'broadSnowdrifts')
        ctx.check('[P0-4] 线索不足时未探索地点不出现在 legalMoves', illegal === false, {
          expected: 'move→broadSnowdrifts 不合法（线索不足）', actual: illegal ? '仍出现在 legalMoves（可免费进入）' : '已过滤',
          evidence: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js#moveError',
        })
        let forcedError = null
        try {
          playMove(ctx.world, poor, { action: 'move', locationId: 'broadSnowdrifts' }, poorSeat2)
          settleChoices(ctx.world, poor)
        } catch (error) { forcedError = error }
        ctx.check('[P0-4] 线索不足时强制提交移动被拒绝（不会免费揭示）',
          Boolean(forcedError) && poorBroad?.revealed === false && poor.investigators[poorSeat2].location === 'frozenShores', {
            expected: 'applyMove 抛错且地点仍未揭示、调查员留在原地',
            actual: `error=${forcedError?.message || '(未抛错)'} revealed=${poorBroad?.revealed} location=${poor.investigators[poorSeat2].location}`,
            evidence: evidence.entryFee,
          })
      }
    }
  },
}

export const campaigns = [p01, p02, p03, p04]
