// treachery-tokens.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 混乱标记与诡计结算：特殊标记（auto_fail / 旧神 / 失败惩罚）与揭示后的惩罚链。
// 读点：performTest 的标记揭示、resolveTreachery（遭遇结算）、applyPenalty（失败追加）。

import { investigatorRule } from '../cards/card-rules.js'
import { registeredEntry } from './ability.js'
import { clearForcedRevelation, forcedRevelationOf, popRevelation, pushRevelation } from './resolution-scope.js'

export function createTreacheryTokens(deps) {
  const {
    BASIC_WEAKNESSES,
    basicWeaknessPool,
    SKILL_NAMES,
    SYMBOL_DEFAULTS,
    TOKEN_LABEL,
    aliveInvestigators,
    applyDamage,
    applyHarm,
    applyHorror,
    assetEffect,
    canDiscardFromHand,
    cannotTriggerFreeAbility,
    cardDef,
    cardName,
    checkDefeated,
    chooseAmong,
    discardRandomAsset,
    disengageEnemy,
    drawCards,
    drawEncounter,
    enemyDef,
    info,
    investigatorTextBlanked,
    isWeaknessCard,
    isWeaknessCode,
    leadDecisionSeat,
    lolaCanUseCard,
    newCardInstance,
    performTest,
    placeCluesOnLocation,
    placeDoomOnCard,
    placeHiddenCard,
    privateInfo,
    randomValue,
    reactionWindow,
    relocateInvestigator,
    requestChoice,
    resolveTreacheryEffect,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    totalDoom,
  } = deps

  function resolveTreachery(state, inv, t, events) {
    if (t.hidden) {
      privateInfo(state, events, inv.seat, `🃏 你抽到隐私诡计「${t.name}」：${t.text || ''}`)
    } else {
      info(state, events, `🃏 ${inv.name} 抽到诡计「${t.name}」：${t.text || ''}`)
    }
    const previousTreachery = state._treacheryResolving
    state._treacheryResolving = t.code
    // 2026-10-25 第五轮修复 05049：「正在结算显现效果」的统一读点（进程内作用域，不写 state）。
    pushRevelation(t.code)
    try {
      return resolveTreacheryBody(state, inv, t, events)
    } finally {
      if (previousTreachery === undefined) delete state._treacheryResolving
      else state._treacheryResolving = previousTreachery
      popRevelation()
      // 2026-10-25 第五轮修复 05183：强制 peril / 不可取消是「本次揭示」一次性标记。
      clearForcedRevelation(t.code)
    }
  }

  function resolveTreacheryBody(state, inv, t, events) {
    // 2026-10-25 第五轮修复 05183：抽牌时被强制「获得险境/不可取消」的卡，在真正揭示期间同样生效。
    const forced = forcedRevelationOf(t.code)
    const forcedPeril = forced?.peril === true
    const forcedCannotCancel = forced?.cannotCancel === true
    const context = reactionWindow(state, 'treachery',
      { when: 'treachery', seat: inv.seat, location: inv.location, cardCode: t.code, peril: !!t.peril || forcedPeril,
        weakness: isWeaknessCard(t) || isWeaknessCode(t.code), prompt: `${inv.name} 抽到「${t.name}」`,
        // 2026-10-25 第四轮修复 cannot-cancel-card-flag（05342）。
        cannotCancel: forcedCannotCancel
          || registeredEntry(t.code)?.cannotBeCanceledRevelation === true
          || state.scenario?.treacheries?.[t.code]?.cannotBeCanceledRevelation === true }, events)
    if (context.cancelled) {
      info(state, events, t.hidden ? '一张隐私诡计的显现效果被取消。' : `「${t.name}」的显现效果被取消。`)
      return
    }
    if (t.hidden) {
      placeHiddenCard(state, inv, t, events)
      return true
    }
    // 「无视卡牌效果」通用开关（失落时代 P2，04048「忽略每个林中暗箭」）。
    if (scenarioBehavior(state).ignoreTreachery?.(state, t.originalCode || t.code, t) === true) {
      info(state, events, `⛔ 「${t.name}」的效果被忽略。`)
      return
    }
    if (t.effect?.kind === 'campaignRule') return scenarioBehavior(state).resolveEncounter(state, inv, t, scenarioRuntime(state, events, { type: 'encounter', label: '诡计检定', code: t.originalCode || t.code }))
    if (t.rulesPending) throw new Error(`遭遇效果尚未迁移：${t.originalCode || t.code}`)
    if (t.threat) {
      inv.threat.push(newCardInstance(state, t.code))
      info(state, events, `「${t.name}」进入 ${inv.name} 的威胁区域。`)
      checkDefeated(state, inv.seat, events)
      return true
    }
    if (t.effect) {
      // 把卡号一并交给效果解释器：附着型效果（朦胧之雾 / 上锁的门）用它记录「该弃哪张卡」，
      // 引擎不再写死 'obscuringFog' / 'lockedDoor'。用运行时 code，与 encounterDiscard 的历史口径一致。
      return resolveTreacheryEffect(state, inv, { ...t.effect, code: t.code }, events)
    }
    if (registeredEntry(t.code)?.surgeIfNoClues && inv.clues === 0) {
      info(state, events, `🌀 「${t.name}」获得涌动：再抽取一张遭遇牌。`)
      drawEncounter(state, inv, events)
      return
    }
    if (t.test) {
      performTest(state, inv.seat, t.test.skill, t.test.difficulty, { source: { type: 'encounter', name: t.name, code: t.originalCode || t.code, label: '遭遇检定', scenarioAbility: true }, peril: !!t.peril || forcedPeril, resolve: r => {
        if (r.success) {
          info(state, events, `✔️ ${inv.name} 通过「${t.name}」检定（${SKILL_NAMES[t.test.skill]} ${r.value} vs ${t.test.difficulty}）。`)
        } else {
          const failedBy = Math.max(0, t.test.difficulty - r.value)
          info(state, events, `❌ ${inv.name} 未通过「${t.name}」检定（${SKILL_NAMES[t.test.skill]} ${r.value} vs ${t.test.difficulty}，低于 ${failedBy}）。`)
          const alias = registeredEntry(t.code)?.penaltyKind
          applyPenalty(state, inv, alias ? { ...t.fail, kind: alias } : t.fail, failedBy, events)
        }
      } })
    }
  }

  function nearestEnemyByTrait(state, fromId, trait) {
    const t = trait?.toLowerCase()
    const enemies = state.enemies.filter((e) => !t || (e.traits || []).some((x) => x.toLowerCase() === t))
    if (!enemies.length) return null
    const distances = new Map([[fromId, 0]])
    const queue = [fromId]
    for (const id of queue) {
      for (const next of state.locations.find(l => l.id === id)?.connections || []) {
        if (!distances.has(next)) { distances.set(next, distances.get(id) + 1); queue.push(next) }
      }
    }
    const distance = Math.min(...enemies.map(e => distances.get(e.location) ?? Infinity))
    if (!Number.isFinite(distance)) return null
    const candidates = enemies.filter(e => distances.get(e.location) === distance)
    const id = chooseAmong(state, { kind: 'target', source: 'nearest-enemy', seat: state.skillTest?.seat ?? leadDecisionSeat(state),
      prompt: '选择距离最近的敌人（距离相同）。', options: candidates.map(e => ({ id: e.id, label: e.name })) })
    return candidates.find(e => e.id === id)
  }

  // 声明式遭遇检定的难度解算在 src/cards/card-rules.js（内容层共用读点），引擎不再各留一份。

  // `options.silent`：条目声明式检定（treacheryRule.test）走同一条失败结算，但不再补一行
  // 「受到 N 点伤害/恐惧」——保持与迁移前的手写条目日志逐字一致（golden replay 不漂移）。
  function applyPenalty(state, inv, fail, failedBy, events, options = {}) {
    if (!fail) return
    const log = options.silent ? () => {} : text => info(state, events, text)
    if (fail.kind === 'takeDamage') { log(`${inv.name} 受到 ${fail.amount} 点伤害。`); applyDamage(state, inv, fail.amount, events) }
    else if (fail.kind === 'takeHorror') { log(`${inv.name} 受到 ${fail.amount} 点恐惧。`); applyHorror(state, inv, fail.amount, events) }
    else if (fail.kind === 'damageByAmount') { const n = failedBy; log(`${inv.name} 受到 ${n} 点伤害。`); applyDamage(state, inv, n, events) }
    else if (fail.kind === 'horrorByAmount') { const n = failedBy; log(`${inv.name} 受到 ${n} 点恐惧。`); applyHorror(state, inv, n, events) }
    else if (fail.kind === 'discardAsset') { discardRandomAsset(state, inv, events); log(`${inv.name} 弃掉了一件资产。`) }
    else if (fail.kind === 'discardAssetOrDamage') {
      if (inv.assets.length) discardRandomAsset(state, inv, events)
      else { log(`${inv.name} 没有资产可弃，受到 ${fail.damage} 点伤害。`); applyDamage(state, inv, fail.damage, events) }
    }
    else if (fail.kind === 'horrorAndDrawMadness') {
      applyHorror(state, inv, fail.horror, events)
      if (inv.defeated || inv.resigned) return
      drawMadnessWeakness(state, inv, events)
    }
    else if (fail.kind === 'damageHorrorDisengageAndMoveCentral') {
      // 「乘着黑暗之翼」这类：受伤/恐惧、与非夜魇敌人解除交战、被带到中心地点。
      // 规则的数值与走向由卡面数据声明，kind 不再用卡名。
      log(`${inv.name} 受到 ${fail.damage} 点伤害和 ${fail.horror} 点恐惧。`)
      applyHarm(state, inv, fail.damage, fail.horror, events)
      if (inv.defeated || inv.resigned) return
      for (const enemyId of inv.engaged.slice()) {
        const enemy = state.enemies.find(item => item.id === enemyId)
        if (enemy && !(enemy.traits || []).some(trait => String(trait).toLowerCase() === 'nightgaunt')) disengageEnemy(state, enemy)
      }
      const central = state.locations.find(loc => loc.central)
      if (central && inv.location !== central.id) {
        relocateInvestigator(state, inv.seat, central.id, events, `🪽 ${inv.name} 被黑暗之翼带到中心地点「${central.name}」。`)
      }
    }
    else if (fail.kind === 'cluesByAmount') { placeCluesOnLocation(state, inv, failedBy, events) }
    else if (fail.kind === 'damageAndHorror') {
      log(`${inv.name} 受到 ${fail.damage} 点伤害和 ${fail.horror} 点恐惧。`)
      applyHarm(state, inv, fail.damage, fail.horror, events)
    }
    else if (fail.kind === 'wrathByAmount') {
      for (let i = 0; i < failedBy; i++) {
        const options = [{ id: 'harm', label: '受到 1 伤害和 1 恐惧' },
          ...inv.hand.flatMap((code, index) => isWeaknessCode(code) || !canDiscardFromHand(inv, code)
            ? [] : [{ id: String(index), cardCode: code, label: `弃掉 ${cardName(code)}` }])]
        const answer = requestChoice(state, { kind: 'discard', source: 'wrath', seat: inv.seat,
          prompt: `乌默尔多斯之怒：选择弃牌或承受伤害／恐惧（剩余 ${failedBy - i} 次）。`, options })
        if (answer === 'harm') applyHarm(state, inv, 1, 1, events)
        else {
          const code = inv.hand.splice(Number(answer), 1)[0]; inv.discard.push(code)
          log(`${inv.name} 弃掉了「${cardName(code)}」。`)
        }
        if (inv.defeated || inv.resigned) break
      }
    }
  }

  function addBasicWeakness(state, inv, events, traits = ['madness', 'injury']) {
    const wanted = new Set(traits.map(trait => String(trait).toLowerCase()))
    // P0：只从本战役开放的基础弱点池里抽；旧实现遍历全目录 77 张，
    // 会抽到没有任何描述子/profile 的弱点，抽到时 weakness.js 直接抛错。
    const pool = basicWeaknessPool(state)
      .map(code => BASIC_WEAKNESSES[code])
      .filter(def => def
        && (def.traits || []).some(trait => wanted.has(String(trait).toLowerCase()))
        && !inv.deck.includes(def.code) && !inv.discard.includes(def.code))
    if (!pool.length) {
      info(state, events, `${inv.name} 的收藏里没有可用的基础弱点。`)
      return null
    }
    const pick = pool[Math.floor(randomValue(state) * pool.length)]
    inv.deck.push(pick.code)
    inv.deck = shuffle(inv.deck, () => randomValue(state))
    info(state, events, `🃏 ${inv.name} 从收藏中随机获得基础弱点「${pick.nameZh || pick.name}」，并洗入牌库。`)
    return pick.code
  }

  function drawMadnessWeakness(state, inv, events) {
    const candidates = inv.deck.map((code, index) => ({ code, index }))
      .filter(({ code }) => isWeaknessCode(code) && (cardDef(code)?.traits || []).some(trait => trait.toLowerCase() === 'madness'))
    if (candidates.length) {
      const answer = requestChoice(state, {
        kind: 'search', source: 'madness-weakness', seat: inv.seat,
        prompt: '选择牌库中的一张疯狂弱点并抽取。',
        options: candidates.map(({ code, index }) => ({ id: String(index), cardCode: code, label: cardName(code) })),
      })
      const code = inv.deck.splice(Number(answer), 1)[0]
      inv.deck.push(code)
      for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
    } else {
      info(state, events, `${inv.name} 的牌库中没有疯狂弱点。`)
    }
    inv.deck = shuffle(inv.deck, () => randomValue(state))
  }

  function tokenLabel(token) {
    return TOKEN_LABEL[token] || token
  }

  function applyFreeTriggers(state, inv, skill, events) {
    if (cannotTriggerFreeAbility(state, inv)) return 0
    let bonus = 0
    const spent = []
    for (const a of inv.assets) {
      const eff = assetEffect(inv, a)
      if (!eff || !eff.freeTriggers) continue
      if (!lolaCanUseCard(inv, a.code)) continue
      if (eff.minimumHandForBoost && inv.hand.length < eff.minimumHandForBoost) continue
      for (const ft of eff.freeTriggers) {
        if (ft.skill !== skill && ft.skill !== 'any') continue
        if (ft.requireTestTrait && !(cardDef(state.skillTest.source?.code)?.traits || [])
          .some(trait => String(trait).toLowerCase() === String(ft.requireTestTrait).toLowerCase())) continue
        const resourceCost = (ft.cost && ft.cost.resources) || 0
        const doomCost = (ft.cost && ft.cost.doom) || 0
        const exhaustCost = !!ft.cost?.exhaust
        if (exhaustCost && a.exhausted) continue
        state.skillTest.freeTriggerUses ||= {}
        const triggerKey = `${a.id}:${skill}`
        if (doomCost && state.skillTest.freeTriggerUses[triggerKey]) continue
        let activations = 0
        while ((resourceCost > 0 && inv.resources >= resourceCost) || (doomCost > 0 && activations === 0)
          || (exhaustCost && activations === 0)) {
          const answer = requestChoice(state, { kind: 'boost', source: a.id, seat: inv.seat,
            prompt: doomCost ? `是否在「${cardName(a.code)}」上放置 ${doomCost} 毁灭，提高${SKILL_NAMES[skill]}？`
              : `是否花 ${resourceCost} 资源提高${SKILL_NAMES[skill]}？`, canSkip: true,
            options: [{ id: 'skip', label: '不再支付' }, { id: 'pay', label: `${doomCost ? `放置 ${doomCost} 毁灭` : `支付 ${resourceCost} 资源`}，+${ft.bonus}` }] })
          if (answer === 'skip') break
          inv.resources -= resourceCost
          if (doomCost) placeDoomOnCard(state, a, doomCost, events, { silent: true })
          if (exhaustCost) a.exhausted = true
          if (doomCost) state.skillTest.freeTriggerUses[triggerKey] = true
          bonus += ft.bonus
          if (Number.isFinite(state.skillTest.value)) state.skillTest.value += ft.bonus
          activations++
          spent.push(`${cardName(a.code)}(${SKILL_NAMES[skill]}+${ft.bonus})`)
        }
      }
    }
    if (spent.length) info(state, events, `${inv.name} 激活天赋：${spent.join('、')}。`)
    return bonus
  }

  function ghoulsAtLocation(state, inv) {
    return state.enemies.filter((e) => e.location === inv.location && (e.traits || []).some((t) => t.toLowerCase() === 'ghoul'))
  }

  function monstersInPlay(state) {
    return state.enemies.filter((e) => (e.traits || []).some((t) => t.toLowerCase() === 'monster'))
  }

  function countTokenValue(name, state, inv) {
    if (name === 'ghoulsAtLocation') return ghoulsAtLocation(state, inv).length
    if (name === 'monsters') return monstersInPlay(state).length
    if (name === 'maxDoomOnCultist') {
      const cultists = state.enemies.filter((e) => (e.traits || []).some((t) => t.toLowerCase() === 'cultist'))
      return cultists.reduce((m, e) => Math.max(m, e.doom || 0), 0)
    }
    if (name === 'totalDoom') {
      return totalDoom(state)
    }
    return 0
  }

  function resolveSpecialToken(state, seat, inv, token, events) {
    const custom = scenarioBehavior(state).resolveChaosToken?.(state, inv, token, scenarioRuntime(state, events))
    if (custom) return { delta: 0, drawAnother: false, onDraw: [], onFail: [], ...custom }
    const meanings = (state.scenario.tokenMeanings && state.scenario.tokenMeanings[state.difficulty]) || {}
    const m = meanings[token]
    const onDraw = []
    const onFail = []
    if (!m) {
      return { delta: SYMBOL_DEFAULTS[token] != null ? SYMBOL_DEFAULTS[token] : 0, drawAnother: false, onDraw, onFail }
    }
    let delta = 0
    if (m.kind === 'count') {
      delta = -(m.base + countTokenValue(m.count, state, inv))
    } else {
      delta = m.mod || 0
    }
    if (m.ifGhoul) {
      if (ghoulsAtLocation(state, inv).length) {
        if (m.ifGhoul.damage) onDraw.push({ type: 'takeDamage', amount: m.ifGhoul.damage })
        if (m.ifGhoul.horror) onDraw.push({ type: 'takeHorror', amount: m.ifGhoul.horror })
      }
    }
    if (m.ifMonsterAtLocation) {
      const hereMonster = state.enemies.some((e) => e.location === inv.location && (e.traits || []).some((t) => t.toLowerCase() === 'monster'))
      if (hereMonster) {
        if (m.ifMonsterAtLocation.damage) onDraw.push({ type: 'takeDamage', amount: m.ifMonsterAtLocation.damage })
        if (m.ifMonsterAtLocation.horror) onDraw.push({ type: 'takeHorror', amount: m.ifMonsterAtLocation.horror })
      }
    }
    if (m.onDraw) {
      for (const [k, v] of Object.entries(m.onDraw)) onDraw.push({ type: k, amount: v })
    }
    if (m.onFail) {
      for (const [k, v] of Object.entries(m.onFail)) onFail.push({ type: k, amount: v })
    }
    let drawAnother = !!m.drawAnother
    if (m.drawAnotherIfNoCultist) {
      const hasCultist = state.enemies.some((e) => (e.traits || []).some((t) => t.toLowerCase() === 'cultist'))
      drawAnother = !hasCultist
    }
    if (m.drawAnotherIf === 'ancientOne') {
      drawAnother = state.enemies.some((e) => (e.traits || []).some((t) => t.toLowerCase() === 'ancientone'))
    }
    return { delta, drawAnother, onDraw, onFail }
  }

  function drawEnemyByTrait(state, inv, trait, events, includeDiscard = false) {
    const t = (trait || '').toLowerCase()
    const candidates = [...state.encounterDeck.map((code,index)=>({code,index,pile:'deck'})),
      ...(includeDiscard ? state.encounterDiscard.map((code,index)=>({code,index,pile:'discard'})) : [])].filter(({code}) => {
      const d = enemyDef(code)
      return d && (d.traits || []).some((x) => x.toLowerCase() === t)
    })
    if (candidates.length) {
      const id = chooseAmong(state, { kind: 'search', source: 'encounter-enemy', seat: inv.seat,
        prompt: '选择要抽取的敌人。', options: candidates.map(({code,index,pile})=>({id:`${pile}:${index}`,cardCode:enemyDef(code).originalCode || code,label:enemyDef(code).name})) })
      const chosen=candidates.find(c=>`${c.pile}:${c.index}`===id)
      const code = (chosen.pile==='discard'?state.encounterDiscard:state.encounterDeck).splice(chosen.index,1)[0]
      state.encounterDeck.push(code)
      drawEncounter(state, inv, events)
    } else {
      info(state, events, '没有可引出的敌人。')
    }
    state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
  }

  function minhCommitWildBonus(state, committer, events) {
    let bonus = 0
    // Phase 5（5a-33）：敏的同地点万能加成由调查员能力数据声明。
    for (const minh of aliveInvestigators(state).filter(owner => investigatorRule(owner.code)?.wildCommitCompanionBonus
      && owner.location === committer.location && !investigatorTextBlanked(state, owner))) {
      const key = `minhWild:${committer.seat}:${state.round}`
      if (minh.usedReactions?.[key]) continue
      const answer = requestChoice(state, { kind: 'reaction', source: 'minhWild', seat: minh.seat, canSkip: true,
        prompt: `是否让 ${committer.name} 投入的这张牌获得1个百搭图标？`,
        options: [{ id: 'skip', label: '不增加图标' }, { id: 'trigger', label: '增加1个百搭图标' }] })
      if (answer === 'trigger') {
        minh.usedReactions ||= {}
        minh.usedReactions[key] = true
        bonus += 1
        info(state, events, `${minh.name} 使投入牌获得1个百搭图标。`)
      }
    }
    return bonus
  }

  return { resolveTreachery, resolveTreacheryBody, nearestEnemyByTrait, applyPenalty, addBasicWeakness, drawMadnessWeakness, tokenLabel, applyFreeTriggers, ghoulsAtLocation, monstersInPlay, countTokenValue, resolveSpecialToken, drawEnemyByTrait, minhCommitWildBonus }
}
