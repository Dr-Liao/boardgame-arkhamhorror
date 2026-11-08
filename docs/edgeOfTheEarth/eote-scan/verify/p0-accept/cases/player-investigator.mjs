// P0-9 / P0-10 抽样复核（真实引擎路径）：
//   08105/08107 真实战斗检定窗口、08091 tokenReveal 咒印替换、08130 威胁区伤害承接治疗
//   08013a 检定过期/延迟翻面的座位过滤、08006 牌库顶封锁覆盖检索/操纵、08014a 免费行动额度清理
import { injectAsset, injectHand, assetOf, locationOf } from '../lib/harness.mjs'

const evidence = {
  window105: 'src/engine/tests.js:312（playerWindow test.beforeCommit）/ src/engine/encounter.js:541-624（窗口枚举免费描述子）',
  tokenReveal: 'src/engine/tests.js:918-941（tokenReveal 窗口 + context.replacementToken 替换管线）',
  heal: 'src/engine/harm-threat.js:702-740（healDamageFrom 的 flags.threatDamageSink 承接）',
  seat013: 'src/engine/tests.js（expireEffects endOfTest / applyPendingFlipAfterTests 需按检定执行者过滤）',
  lock006: 'src/engine/deck-ops.js#searchDeck / #moveCardTo（blockedByDeckTopLock 读点）',
  quota014: 'src/engine/restricted-actions.js + src/engine/turn.js（免费战斗/躲避额度应在回合结束清理）',
}

function pickPending(state) {
  return state.pendingChoice || null
}

function choosePending(ctx, state, predicate) {
  const choice = state.pendingChoice
  if (!choice) return false
  const option = (choice.options || []).find(predicate)
  if (!option) return false
  ctx.world.engine.applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  return true
}

function settle(ctx, state, select = null) {
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 200) throw new Error(`待决选择未收敛：${state.pendingChoice.kind}`)
    if (select && select(state)) continue
    const choice = state.pendingChoice
    const option = ['done', 'skip', 'self', 'keep', 'confirm'].find(id => choice.options.some(item => item.id === id))
      || choice.options[0]?.id
    ctx.world.engine.applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option })
  }
}

function spawnEnemy(ctx, state, seat, code, locationId) {
  const before = new Set((state.enemies || []).map(enemy => enemy.id))
  ctx.drive(state, (draft, events) => ctx.world.engine.spawnEnemy(draft, code, locationId, events, { engagedSeat: seat }))
  return (state.enemies || []).find(enemy => !before.has(enemy.id)) || null
}

// ---------------------------------------------------------------------------
// P0-9 抽样
// ---------------------------------------------------------------------------

export const p09 = {
  id: 'P0-9',
  title: '玩家卡抽样：08105/08107 真实战斗窗口、08091 tokenReveal、08130 威胁区治愈',
  async run(ctx) {
    // ---- 08105 / 08107：真实 fight 检定窗口出现「破冰锥」免费能力并可支付（横置） ----
    for (const code of ['08105', '08107']) {
      const state = ctx.clone(ctx.open('iceAndDeathPart1'))
      const seat = ctx.decisionSeat(state)
      const inv = state.investigators[seat]
      const asset = injectAsset(state, seat, code, { id: `probe-${code}`, uses: 1 })
      asset.exhausted = false
      state.investigators[seat].actionsLeft = 3
      state.chaosBag = ['0']
      const enemy = spawnEnemy(ctx, state, seat, '08515', inv.location)
      const moves = ctx.legal(state, seat)
      const fight = moves.find(move => move.action === 'fight' && move.enemyId === enemy?.id)
      ctx.check(`[${code}] 真实战斗 legalMoves 提供 fight 行动`, Boolean(fight), {
        expected: 'legalMoves 含 fight', actual: `actions=${JSON.stringify([...new Set(moves.map(move => move.action))])}`,
        evidence: evidence.window105,
      })
      if (!fight) continue
      let thrown = null
      try {
        const { playMove } = await import('../lib/harness.mjs')
        playMove(ctx.world, state, fight, seat)
      } catch (error) { thrown = error }
      ctx.check(`[${code}] applyMove(fight) 不抛错`, thrown == null, {
        expected: '真实战斗检定开始', actual: thrown ? `抛错：${thrown.message}` : 'OK', evidence: evidence.window105,
      })
      const choice = pickPending(state)
      const options = (choice?.options || []).map(option => ({ assetId: option.assetId, freeCode: option.freeCode, label: option.label }))
      const offered = options.find(option => option.assetId === asset.id || option.freeCode === code)
      ctx.check(`[${code}] 真实战斗检定窗口出现该卡免费能力（不靠伪造 skillTest.actionKind）`, Boolean(offered), {
        expected: `test.beforeCommit 窗口选项含 assetId=${asset.id}`,
        actual: `pending=${choice?.kind || null} options=${JSON.stringify(options.filter(option => String(option.label || '').includes('破冰锥') || option.assetId === asset.id))}`,
        evidence: evidence.window105,
      })
      if (offered) {
        try {
          choosePending(ctx, state, option => option.assetId === asset.id || option.freeCode === code)
          settle(ctx, state)
          const assetAfter = assetOf(state, seat, code)
          ctx.check(`[${code}] 支付横置费用并完成检定（能力真实结算）`, assetAfter?.exhausted === true, {
            expected: '破冰锥 exhausted=true 且检定完成',
            actual: `exhausted=${assetAfter?.exhausted} lastTest=${state.lastTestResult?.skill || null}`,
            evidence: evidence.window105,
          })
        } catch (error) {
          ctx.fail(`[${code}] 支付横置费用并完成检定`, {
            expected: '能力真实结算', actual: `抛错：${error.message}`, evidence: evidence.window105,
          })
        }
      }
    }
    // ---- 08091：tokenReveal 窗口把已揭示 symbol 替换为「咒印」 ----
    {
      const state = ctx.clone(ctx.open('iceAndDeathPart1'))
      const seat = ctx.decisionSeat(state)
      const inv = state.investigators[seat]
      injectHand(state, seat, '08091')
      state.chaosBag = ['skull', 'cultist', 'tablet']
      const playMoves = ctx.legal(state, seat).filter(move => move.action === 'play' && move.cardId === '08091')
      ctx.check('[08091] 真实 legalMoves 可从手牌打出（进入威胁区/资产区并触发 entersPlay）', playMoves.length > 0, {
        expected: 'legalMoves 含 play 08091', actual: JSON.stringify(playMoves.map(move => [move.action, move.cardId, move.label])),
        evidence: 'src/engine/actions.js#playCard（entersPlay 描述子）',
      })
      if (playMoves.length) {
        const { playMove } = await import('../lib/harness.mjs')
        try {
          playMove(ctx.world, state, playMoves[0], seat)
          choosePending(ctx, state, option => option.id === 'skull')
          settle(ctx, state)
          const nkosi = assetOf(state, seat, '08091')
          ctx.check('[08091] 入场后指定咒印（skull）写入支援实例', Boolean(nkosi?.sigilToken === 'skull'), {
            expected: 'asset.sigilToken=skull', actual: `sigilToken=${nkosi?.sigilToken ?? null}`,
            evidence: 'src/engine/api-misc.js:1420-1431（setSigilToken）',
          })
          // 强制揭示 [cultist]，tokenReveal 窗口应替换为咒印 [skull]
          state.chaosBag = ['cultist', 'skull']
          const chooseSigilReaction = choice => {
            if (!['reaction', 'playerWindow'].includes(choice.kind)) return null
            const option = (choice.options || []).find(item => /恩科西|咒印/.test(String(item.label || '')))
            return option ? option.id : null
          }
          let replaced = false
          let observed = null
          let replacementLog = null
          for (let attempt = 0; attempt < 8 && !replaced; attempt++) {
            const out = ctx.drive(state, (draft, events) => ctx.world.engine.performTest(draft, seat, 'willpower', 0, {}), { select: chooseSigilReaction })
            const logLine = (state.log || []).slice(-8).find(line => /改为从混乱袋查找并揭示咒印/.test(String(line)))
            if (logLine) {
              observed = out.result?.drawn || []
              replacementLog = logLine
              replaced = observed.includes(assetOf(state, seat, '08091')?.sigilToken || 'skull')
            }
            if ((state.chaosBag || []).length < 2) state.chaosBag = ['cultist', 'skull']
          }
          const nkosiAfter = assetOf(state, seat, '08091')
          ctx.check('[08091] tokenReveal：[cultist] 揭示被替换为咒印 [skull]（真实 performTest 管线）',
            replaced && nkosiAfter?.exhausted === true, {
              expected: 'drawn 含咒印 skull（不再是 cultist）且支援横置',
              actual: `observedDrawn=${JSON.stringify(observed)} sigil=${nkosiAfter?.sigilToken ?? null} exhausted=${nkosiAfter?.exhausted} log=${replacementLog || null}`,
              evidence: evidence.tokenReveal,
            })
          // 反向验证（P0-9）：未控制该卡时，真实 performTest 抽到 [cultist] 不会被替换。
          const control = ctx.clone(ctx.open('iceAndDeathPart1'))
          const controlSeat = ctx.decisionSeat(control)
          control.chaosBag = ['cultist']
          const controlOut = ctx.drive(control, (draft, events) => ctx.world.engine.performTest(draft, controlSeat, 'willpower', 0, {}))
          const controlDrawn = controlOut.result?.drawn || []
          ctx.check('[P0-9 反向验证] 未在场时 [cultist] 揭示保持原标记（替换不是无条件空断言）',
            controlDrawn.includes('cultist') && !controlDrawn.includes('skull'), {
              expected: 'drawn=[cultist]（无 08091 时无替换）', actual: `drawn=${JSON.stringify(controlDrawn)}`,
              evidence: evidence.tokenReveal,
            })
        } catch (error) {
          ctx.fail('[08091] 真实打出/tokenReveal 路径', {
            expected: '不抛错且完成替换', actual: `抛错：${error.message}`, evidence: evidence.tokenReveal,
          })
        }
      }
    }
    // ---- 08130：威胁区「如同 1 点伤害」承接治疗（flags.threatDamageSink + healDamageFrom） ----
    {
      const state = ctx.clone(ctx.open('iceAndDeathPart1'))
      const seat = ctx.decisionSeat(state)
      const inv = state.investigators[seat]
      inv.threat ||= []
      inv.threat.push({ id: 'probe-08130', code: '08130', originalCode: '08130', counters: 1 })
      inv.damage = 0
      const entry = ctx.world.registeredEntry('08130')
      ctx.check('[08130] 条目声明真实引擎读点 flags.threatDamageSink（替代 free+discardSelf 近似）',
        entry?.flags?.threatDamageSink === true, {
          expected: 'flags.threatDamageSink=true',
          actual: `flags=${JSON.stringify(entry?.flags ?? null)} note=${entry?.note ?? null}`,
          evidence: 'src/engine/harm-threat.js:721（读 registeredEntry(code).flags.threatDamageSink）',
        })
      let healed = null
      let thrown = null
      try {
        const out = ctx.drive(state, (draft, events) => {
          healed = ctx.world.engine.healDamageFrom(draft, draft.investigators[seat], 1, events)
        })
        thrown = out.error || null
      } catch (error) { thrown = error }
      const stillThreat = (state.investigators[seat].threat || []).some(card => (card.originalCode || card.code) === '08130')
      const discardHas = (state.investigators[seat].discard || []).filter(card => card === '08130')
      ctx.check('[08130] 真实治疗入口承接威胁区 1 点伤害并弃掉该卡',
        thrown == null && healed === 1 && !stillThreat, {
          expected: 'healDamageFrom 返回 1，威胁区卡被移除并进弃牌堆',
          actual: `healed=${healed} stillInThreat=${stillThreat} discard=${JSON.stringify(discardHas)} thrown=${thrown?.message || null}`,
          evidence: evidence.heal,
        })
    }
  },
}

// ---------------------------------------------------------------------------
// P0-10 抽样
// ---------------------------------------------------------------------------

function lilyState(ctx) {
  return ctx.clone(ctx.open('iceAndDeathPart1', { investigatorCodes: ['08010', '08004'] }))
}

function findDiscipline(state, seat, wanted) {
  const inv = state.investigators[seat]
  return (inv.assets || []).find(asset => new RegExp(`^${wanted}[a-b]$`).test(asset.code)) || null
}

export const p010 = {
  id: 'P0-10',
  title: '调查员抽样：08013a 座位过滤、08006 牌库封锁检索/操纵、08014a 免费行动额度清理',
  async run(ctx) {
    // ---- 08013a：别的调查员的检定不得消耗「你的下一次检定 +5/延迟翻面」 ----
    {
      const state = lilyState(ctx)
      const seat = 0
      const inv = state.investigators[seat]
      // 陈丽丽开局自带 08011a；为验证 08013a 注入该演武实例（状态准备，能力仍走真实 legalMoves/applyMove）
      const discipline = injectAsset(state, seat, '08013a', { id: 'probe-08013a' })
      state.investigators[seat].actionsLeft = 3
      state.chaosBag = ['0']
      const ability = ctx.legal(state, seat).find(move => move.action === 'ability' && move.assetId === discipline.id)
      ctx.check('[08013a] 使用演武是真实 legalMoves 行动', Boolean(ability), {
        expected: 'legalMoves 含 ability assetId=probe-08013a',
        actual: `abilities=${JSON.stringify(ctx.legal(state, seat).filter(move => move.action === 'ability').map(move => move.assetId))}`,
        evidence: 'src/cards/entries/08013a.js（action 描述子）',
      })
      if (!ability) return
      const { playMove } = await import('../lib/harness.mjs')
      const readDiscipline = () => state.investigators[seat].assets.find(asset => asset.id === 'probe-08013a') || null
      playMove(ctx.world, state, ability, seat)
      settle(ctx, state)
      const effectAfterUse = (state.effects || []).filter(effect => effect.sourceCode === '08013a').length
      const disciplineAfterUse = readDiscipline()
      ctx.check('[08013a] 使用后「下一次检定 +5」效果与延迟翻面标记写入', effectAfterUse > 0 && disciplineAfterUse?.eoteFlipAfterTest === '08013b', {
        expected: 'state.effects 含 08013a endOfTest 效果且 asset.eoteFlipAfterTest=08013b',
        actual: `effects=${effectAfterUse} flipAfter=${disciplineAfterUse?.eoteFlipAfterTest ?? null}`,
        evidence: 'src/cards/entries/08013a.js:22-32',
      })
      // 座位 1 做真实检定：不得消耗/翻面座位 0 的效果
      const seat1 = 1
      state.chaosBag = ['0']
      ctx.drive(state, (draft, events) => ctx.world.engine.performTest(draft, seat1, 'willpower', 0, {}))
      const effectAfterOther = (state.effects || []).filter(effect => effect.sourceCode === '08013a').length
      const disciplineAfterOther = readDiscipline()
      ctx.check('[08013a] 其他座位（seat=1）检定不消耗陈丽丽的 endOfTest 效果', effectAfterOther === effectAfterUse, {
        expected: `effects 保持 ${effectAfterUse}`, actual: `effects=${effectAfterOther}`,
        evidence: evidence.seat013,
      })
      ctx.check('[08013a] 其他座位检定不触发陈丽丽的延迟翻面', disciplineAfterOther?.eoteFlipAfterTest === '08013b' && disciplineAfterOther?.code === '08013a', {
        expected: 'asset 仍为 08013a 且 eoteFlipAfterTest 保留',
        actual: `code=${disciplineAfterOther?.code} flipAfter=${disciplineAfterOther?.eoteFlipAfterTest ?? null}`,
        evidence: evidence.seat013,
      })
      // 座位 0 自己做检定：效果过期 + 翻面
      state.investigators[seat].actionsLeft = 3
      ctx.drive(state, (draft, events) => ctx.world.engine.performTest(draft, seat, 'willpower', 0, {}))
      const flipped = readDiscipline()
      ctx.check('[08013a] 本人检定结束后效果过期并翻面到 08013b', flipped?.code === '08013b', {
        expected: '08013a → 08013b',
        actual: `code=${flipped?.code} effectsLeft=${(state.effects || []).filter(effect => effect.sourceCode === '08013a').length}`,
        evidence: evidence.seat013,
      })
    }
    // ---- 08006：预示者在牌库顶揭示期间，searchDeck / moveCardTo 都不得操纵牌库 ----
    {
      const state = ctx.clone(ctx.open('iceAndDeathPart1', { investigatorCodes: ['08004', '08001'] }))
      const seat = 0
      const inv = state.investigators[seat]
      inv.deck = ['01030', '01088', '08006']
      const support = await import('../../../../../../src/engine/eote-investigator-support.js')
      support.syncPassiveDeckTop(state, seat)
      const lock = support.blockedByDeckTopLock(state, inv)
      ctx.check('[08006] 牌库顶揭示预示者后封锁读点生效（blockedByDeckTopLock）', Boolean(lock), {
        expected: 'blockedByDeckTopLock 返回预示者',
        actual: `lock=${lock?.code ?? null} top=${JSON.stringify(state.scenarioFlags?.mechanics?.eote?.deckTop ?? null)}`,
        evidence: evidence.lock006,
      })
      let searched = null
      let searchOut = null
      try {
        searchOut = ctx.drive(state, (draft) => {
          searched = ctx.world.engine.searchDeck(draft, seat, { type: 'asset', choose: 1, optional: true })
          return searched
        })
        // 检索选择窗口若出现，选第一张（若实现正确应根本不提供选择）
        settle(ctx, state)
        if (searched == null) searched = searchOut.result
      } catch (error) {
        ctx.fail('[08006] 真实 searchDeck 在封锁期不抛错', {
          expected: '返回 []', actual: `抛错：${error.message}`, evidence: evidence.lock006,
        })
      }
      const deckAfterSearch = [...(state.investigators[seat].deck || [])]
      const blockedLog = (state.log || []).slice(-6).some(line => /封锁|无法检索/.test(String(line)))
      ctx.check('[08006] 封锁期真实 searchDeck 不能取走牌库牌（原先可绕过抽牌封锁）',
        (Array.isArray(searched) ? searched.length === 0 : searched == null)
        && !searchOut?.pending?.some(entry => entry.kind === 'search') && blockedLog, {
          expected: 'searchDeck 返回 []、不打开检索选择、日志注明牌库被封锁',
          actual: `searched=${JSON.stringify(searched)} pending=${JSON.stringify(searchOut?.pending?.map(entry => entry.kind))} deckAfter=${JSON.stringify(deckAfterSearch)} blockedLog=${blockedLog}`,
          evidence: evidence.lock006,
        })
      // moveCardTo：封锁期不能把牌从牌库移走/把牌放到牌库顶
      const moveState = ctx.clone(ctx.open('iceAndDeathPart1', { investigatorCodes: ['08004', '08001'] }))
      const moveInv = moveState.investigators[0]
      moveInv.deck = ['01030', '01088', '08006']
      support.syncPassiveDeckTop(moveState, 0)
      let moved = null
      try {
        ctx.drive(moveState, (draft, events) => {
          moved = ctx.world.engine.moveCardTo(draft, draft.investigators[0], { from: 'deck', to: 'discard', code: '01030' }, events)
        })
      } catch (error) {
        ctx.note('[08006] moveCardTo 调用异常（记录）', error.message)
      }
      const deckAfterMove = [...(moveState.investigators[0].deck || [])]
      const discardAfterMove = [...(moveState.investigators[0].discard || [])]
      ctx.check('[08006] 封锁期真实 moveCardTo 不能操纵牌库（不能把牌移到弃牌堆）',
        moved == null && deckAfterMove.includes('01030') && !discardAfterMove.includes('01030'), {
          expected: 'moveCardTo 返回 null，牌仍在牌库',
          actual: `moved=${JSON.stringify(moved)} deck=${JSON.stringify(deckAfterMove)} discardHas01030=${discardAfterMove.includes('01030')}`,
          evidence: evidence.lock006,
        })
      // 反向验证（P0-10）：牌库顶不是预示者时，同一条 searchDeck 真实可检索（封锁读点不是无条件拦截）。
      const unlocked = ctx.clone(ctx.open('iceAndDeathPart1', { investigatorCodes: ['08004', '08001'] }))
      unlocked.investigators[0].deck = ['01030', '01088']
      support.syncPassiveDeckTop(unlocked, 0)
      let taken = null
      const chooseSearchPick = choice => {
        if (choice.kind !== 'search') return null
        const option = (choice.options || []).find(item => !['skip', 'cancel'].includes(String(item.id)))
        return option ? option.id : null
      }
      try {
        const out = ctx.drive(unlocked, draft => {
          taken = ctx.world.engine.searchDeck(draft, 0, { type: 'asset', choose: 1, optional: true })
          return taken
        }, { select: chooseSearchPick })
        if (taken == null) taken = out.result
      } catch (error) {
        ctx.fail('[P0-10 反向验证] 牌库顶无预示者时 searchDeck 可正常检索', {
          expected: 'searchDeck 正常返回', actual: `抛错：${error.message}`, evidence: evidence.lock006,
        })
      }
      const unlockedLock = support.blockedByDeckTopLock(unlocked, unlocked.investigators[0])
      const takenCount = Array.isArray(taken) ? taken.length : 0
      const unlockedDeck = [...(unlocked.investigators[0].deck || [])]
      ctx.check('[P0-10 反向验证] 牌库顶无预示者时 searchDeck 可正常检索（封锁读点按真实状态生效）',
        !unlockedLock && (takenCount > 0 || !unlockedDeck.includes('01030')), {
          expected: '无锁 + searchDeck 真实取到牌（或在检索后离开牌库）',
          actual: `lock=${unlockedLock?.code ?? null} taken=${JSON.stringify(taken)} deck=${JSON.stringify(unlockedDeck)}`,
          evidence: evidence.lock006,
        })
    }
    // ---- 08014a：3 次免费战斗/躲避额度必须在回合结束清理（不能吃掉下一轮普通行动） ----
    {
      const state = lilyState(ctx)
      const seat = 0
      const discipline = injectAsset(state, seat, '08014a', { id: 'probe-08014a' })
      state.investigators[seat].actionsLeft = 3
      state.chaosBag = ['0']
      const ability = ctx.legal(state, seat).find(move => move.action === 'ability' && move.assetId === discipline.id)
      ctx.check('[08014a] 使用演武是真实 legalMoves 行动', Boolean(ability), {
        expected: 'legalMoves 含 ability assetId=probe-08014a',
        actual: `abilities=${JSON.stringify(ctx.legal(state, seat).filter(move => move.action === 'ability').map(move => move.assetId))}`,
        evidence: 'src/cards/entries/08014a.js（action 描述子）',
      })
      if (!ability) return
      const { playMove } = await import('../lib/harness.mjs')
      playMove(ctx.world, state, ability, seat)
      settle(ctx, state)
      const quotaAfter = Number(state.investigators[seat].fightEvadeOnlyActions) || 0
      ctx.check('[08014a] 使用后获得 3 次免费战斗/躲避额度', quotaAfter === 3, {
        expected: 'fightEvadeOnlyActions=3', actual: `quota=${quotaAfter} code=${state.investigators[seat].assets.find(asset => asset.id === discipline.id)?.code}`,
        evidence: 'src/engine/eote-investigator-support.js#grantFreeActions',
      })
      // 真实结束回合并推进到下一轮调查阶段（额度按轮清理的读点在 beginInvestigationPhase，turn.js:564-569）
      const startRound = state.round
      let thrown = null
      try {
        for (let guard = 0; guard < 16 && !(state.round > startRound && state.phase === 'investigation'); guard++) {
          settle(ctx, state)
          if (state.pendingChoice) continue
          const seatNow = state.currentSeat ?? state.investigators[0].seat
          const moves = ctx.legal(state, seatNow)
          const endTurn = moves.find(move => move.action === 'endTurn')
          if (!endTurn) {
            // 不在行动阶段时，引擎内部会在 endTurn 事务里自动推进；若仍无 endTurn 则停止。
            break
          }
          playMove(ctx.world, state, endTurn, seatNow)
        }
      } catch (error) { thrown = error }
      settle(ctx, state)
      const lilyNow = state.investigators[seat]
      const quotaAfterTurn = Number(lilyNow.fightEvadeOnlyActions) || 0
      const actingSeat = state.currentSeat ?? 0
      const actingMoves = ctx.legal(state, actingSeat)
      const normalActions = actingMoves.some(move => move.action === 'investigate')
      ctx.check('[08014a] 下一轮调查阶段开始时免费战斗/躲避额度被清理（下一轮不再吃掉普通行动）',
        thrown == null && quotaAfterTurn === 0, {
          expected: 'fightEvadeOnlyActions=0（回合开始按轮清理）',
          actual: `quota=${quotaAfterTurn} thrown=${thrown?.message || null} round=${state.round} phase=${state.phase}`,
          evidence: evidence.quota014,
        })
      ctx.check('[08014a] 下一轮普通行动可用（当前行动座位 actionsLeft=3 且 investigate 在 legalMoves）',
        thrown == null && Number(state.investigators[actingSeat].actionsLeft) === 3 && normalActions, {
          expected: '当前行动座位 actionsLeft=3 且 legalMoves 含 investigate',
          actual: `seat=${actingSeat} actionsLeft=${state.investigators[actingSeat].actionsLeft} normalActions=${normalActions} round=${state.round}`,
          evidence: evidence.quota014,
        })
    }
  },
}

export const playerInvestigator = [p09, p010]
