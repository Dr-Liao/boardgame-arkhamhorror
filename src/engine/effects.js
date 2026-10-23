// 诡镇奇谈：卡牌版（Arkham Horror LCG）· 卡牌效果 DSL 解释器
//
// Phase 2 · 数据驱动效果系统（对应决策 D4=A）。
//
// 本文件只负责「解释」效果，不负责「结算规则」：凡是需要引擎内部机制的操作
// （技能检定 / 调查 / 战斗 / 躲避 / 生成敌人 / 击败敌人 / 抽牌并结算弱点 / 密谋/场景推进），
// 都通过调用方注入的运行时对象 rt（runtime）转发给 engine.js，从而避免循环依赖。
//
// 效果原语（effect = { type, ... }）：
//   gainResource / loseResource / draw / heal / takeDamage / takeHorror / gainAction
//   discoverClue / addDoom / dealDamage / investigate / fight / evade / discardHand
//   discardAsset / addFog / addTestBonus / skillTest / spawnEnemy / moveInvestigator
//   chooseOne / exhaust / discardHandTo / reloadAmmo / defeatNonEliteEnemy
//   removeDiscard / onTheLam / addStatPhase / rechargeAsset
//
// 未实现/简化的效果一律显式打点，不静默吞掉。

import { requestChoice } from './resolution.js'

// 效果原语清单（用于校验与文档化）。
// 第 126 轮（DoD 第 6 条）：退役 12 个**没有任何数据引用**的旧原语
// （addFog / addTestBonus / aquinnahRedirect / becomeAsset / discardAsset / discardHand /
//  exhaust / moveHorrorToInvestigator / retryTest / search / skillTest / spawnEnemy）。
// 它们对应的卡要么已经迁到条目 resolve，要么当初只作为 DSL 样例存在；
// 删名前 `tools/hardcode-audit.mjs` 的 unusedPrimitives 就是这 12 个。
export const EFFECT_PRIMITIVES = [
  'gainResource', 'loseResource', 'draw', 'heal', 'takeDamage', 'takeHorror',
  'gainAction', 'discoverClue', 'addDoom', 'dealDamage', 'investigate', 'fight',
  'evade', 'moveInvestigator', 'chooseOne', 'discardHandTo',
  'reloadAmmo', 'defeatNonEliteEnemy', 'removeDiscard', 'onTheLam',
  'addStatPhase', 'rechargeAsset',
  'cancelEnemyAttack', 'cancelTreachery', 'substituteSkill', 'sequence',
  'targetedEffect', 'searchTop', 'investigateForResources', 'moveTo',
  'dealDamageAll', 'dealDamageExhausted', 'blankEnemy', 'ignoreChaos',
  'returnAssetToHand', 'shuffleIntoEncounter',
  'searchDiscard', 'autoEvadeNonElite', 'attachBarricade', 'drawEncounter',
  'addTestValue', 'disengageAll', 'flipTokenSign', 'scry', 'gainClues', 'targetedTest',
  'readyAsset', 'healDamageAtLocation', 'researchSolution',
  // 第 121–122 轮（第 4 批）：healHorrorNearby / dukeInvestigate / flare / redrawChaos /
  // cancelHarmGainResources / redrawEncounter / redGlovedManSkills / returnCommittedSkill /
  // cancelHarm 已退役——单卡逻辑搬进各自条目（resolve + 通用原语），不再有 `effect.type` 分派。
  'carcosaInvestigator', 'carcosaPlayer', 'addCurrentTest',
  // Phase 1：离场/效果实体相关原语
  'mill',
  'tfaInvestigator', 'tfaPlayer', 'cancelSymbolToken',
]

export function effectDefinitionError(effect) {
  if (!effect) return null
  if (!EFFECT_PRIMITIVES.includes(effect.type)) return `未实现的效果原语：${effect.type}`
  if (effect.type === 'chooseOne' && (!Array.isArray(effect.options) || !effect.options.length)) return '选择缺少合法选项'
  if (effect.type === 'sequence' && (!Array.isArray(effect.effects) || !effect.effects.length)) return '顺序结算缺少子效果'
  if (effect.type === 'substituteSkill' && (!Array.isArray(effect.from) || !effect.from.length || !effect.to)) return '属性替代缺少来源或目标'
  if (effect.type === 'targetedEffect' && !effect.effect) return '目标效果缺少子效果'
  for (const child of [...(effect.options || []).map(option => option.effect), ...(effect.effects || []), effect.success, effect.fail, effect.effect, effect.successEffect, effect.failEffect]) {
    const error = effectDefinitionError(child)
    if (error) return error
  }
  return null
}

// 结算单条效果。rt 由 engine.js 注入（见 engine.js buildRuntime）。
export function resolveEffect(state, seat, effect, rt) {
  if (!effect) return
  const inv = state.investigators[seat]
  if (!inv) return

  switch (effect.type) {
    // 第 121–122 轮（第 4 批）：原先按 `effect.type` 分派的单卡逻辑已全部搬进各自条目
    // （`flare` → 02115、`lookTopDeckAndDoom` → 02232、`dukeInvestigate` → 02014，
    // 其余走通用原语 api.cancelHarm / cancelEncounterDraw / recallCommittedSkill）。
    // `src/cards/player-effects.js` 与其 `rt.playerCardEffect` 接线随之删除。
    case 'carcosaInvestigator': {
      rt.carcosaInvestigatorEffect(seat, effect)
      break
    }
    case 'carcosaPlayer': {
      rt.carcosaPlayerEffect(seat, effect)
      break
    }
    case 'tfaInvestigator': {
      rt.tfaInvestigatorEffect(seat, effect)
      break
    }
    case 'tfaPlayer': {
      rt.tfaPlayerEffect(seat, effect)
      break
    }
    case 'cancelSymbolToken': {
      if (state.skillTest) {
        state.skillTest.cancelledSymbol = state.skillTest.currentToken
        // Phase 6（6a-1）：记录是哪张牌取消的，引擎日志不再写死卡号。
        state.skillTest.cancelledSymbolSource = effect.code || null
      }
      rt.info?.('取消当前符号标记')
      break
    }
    case 'retryTest': {
      rt.retryTest?.(seat, effect)
      break
    }
    case 'becomeAsset': {
      rt.becomeAsset?.(seat, effect)
      break
    }
    case 'researchSolution': {
      rt.researchSolution(seat, effect.assetId)
      break
    }
    case 'readyAsset': {
      if (rt.canReadyAssets?.(seat) === false) {
        rt.info(`${inv.name} 受「梦魇缠身」影响，其支援无法重整。`)
        break
      }
      const candidates = inv.assets.filter(a => a.exhausted)
      if (!candidates.length) break
      const id = requestChoice(state, { kind: 'target', source: 'readyAsset', seat,
        prompt: '选择要重整的支援。', options: candidates.map(a => ({ id: a.id, label: state.cards?.[a.code]?.name || a.code })) })
      candidates.find(a => a.id === id).exhausted = false
      break
    }
    case 'gainResource': {
      if (rt.canGainResources?.(seat) === false) break
      const n = effect.amount || 1
      inv.resources += n
      rt.info(`${inv.name} 获得 ${n} 资源（当前 ${inv.resources}）。`)
      break
    }
    case 'loseResource': {
      if (effect.all) {
        const n = inv.resources
        inv.resources = 0
        rt.info(`${inv.name} 失去了全部 ${n} 资源。`)
      } else {
        const n = Math.min(inv.resources, effect.amount || 1)
        inv.resources -= n
        rt.info(`${inv.name} 失去 ${n} 资源。`)
      }
      break
    }
    case 'draw': {
      const texts = rt.drawCards(inv, effect.amount || 1)
      for (const t of texts) rt.info(t)
      break
    }
    case 'heal': {
      doHeal(state, inv, effect.amount || 1, effect.what || 'damage', rt)
      break
    }
    case 'healDamageAtLocation': {
      rt.healDamageAtLocation(seat, effect.amount || 1)
      break
    }
    case 'takeDamage': {
      const n = effect.amount || 1
      // silent：调用方已经写过更具体的日志（例如地点进入失败的选项），不要再打一遍通用行。
      if (!effect.silent) rt.info(`${inv.name} 受到 ${n} 点伤害。`)
      rt.applyDamage(seat, n, !!effect.direct)
      break
    }
    case 'takeHorror': {
      const n = effect.amount || 1
      if (!effect.silent) rt.info(`${inv.name} 受到 ${n} 点恐惧。`)
      rt.applyHorror(seat, n, !!effect.direct)
      break
    }
    case 'gainAction': {
      inv.actionsLeft += (effect.amount || 1)
      rt.info(`${inv.name} 获得 ${effect.amount || 1} 个额外行动。`)
      break
    }
    case 'discoverClue': {
      rt.discoverClue(inv, effect.amount || 1)
      break
    }
    case 'addDoom': {
      rt.addDoom(effect.amount || 1)
      break
    }
    case 'dealDamage': {
      const amount = effect.amount || 1
      const enemy = rt.enemyForTarget(seat, effect.target || 'engaged')
      if (enemy) {
        if (rt.damageEnemy(enemy, amount, seat)) rt.info(`对「${enemy.name}」造成 ${amount} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
      } else {
        rt.info('没有可攻击的敌人。')
      }
      break
    }
    case 'investigate': {
      // 整份效果体透传：调查是"可配置的核心流程"（改写技能、额外线索、成功点数换线索、
      // 成功后自动躲避、消耗式支援…）。逐字段列举会把新字段静默丢掉——礼寻术的
      // `skill: 'willpower'` 就是这么被丢掉的，这里不再维护第二份字段清单。
      rt.investigate(seat, { ...effect })
      break
    }
    case 'fight': {
      // 没有合法敌人时按"无事发生"处理：随机走子器在"场上有需要敌人的事件卡、却没有合法目标"
      // 时走到过这条路径，抛错会让一个合法动作直接崩掉（Phase 4 · 重放安全网）。
      // 「枪法如神」允许在没有同地点目标时激活枪械攻击（窗口里改指连接地点），
      // 因此没有目标也把攻击交给 doFight，由它打开 activateFirearmFight 窗口后再判定。
      let enemyId = effect.enemyId
      if (!enemyId && (rt.hasEnemyTargets?.(seat, effect) ?? true)) {
        enemyId = rt.chooseEnemy(seat, effect)?.id
      }
      if (!enemyId) { rt.fight(seat, { ...effect }); break }
      rt.fight(seat, { ...effect, enemyId })
      break
    }
    case 'evade': {
      if (effect.allAtLocation) {
        const here = state.enemies.filter((e) => e.location === inv.location)
        for (const e of here) rt.autoEvade(e)
        if (!here.length) rt.info('这里没有可躲避的敌人。')
      } else {
        const enemy = rt.enemyForTarget(seat, effect.enemyId ? ('id:' + effect.enemyId) : 'engaged')
        if (enemy) {
          if (effect.auto) rt.autoEvade(enemy)
          // 同上：整份效果体透传（躲避值修正、成功不横置、本回合不能交战等都在 doEvade 里读），
          // 只额外补上已解析的敌人与来源卡号。
          else rt.evade(seat, { ...effect, enemyId: enemy.id, sourceCode: effect.code })
        } else {
          rt.info('没有交战的敌人。')
        }
      }
      break
    }
    case 'discardHand': {
      rt.discardRandomFromHand(inv, effect.amount || 1)
      break
    }
    case 'discardHandTo': {
      rt.discardHandTo(inv, effect.keep ?? 1)
      break
    }
    case 'discardAsset': {
      rt.discardRandomAsset(inv)
      break
    }
    case 'reloadAmmo': {
      rt.reloadAmmo(inv, effect.amount || 1, effect)
      break
    }
    case 'defeatNonEliteEnemy': {
      rt.defeatNonEliteEnemy(seat, effect.target || 'here')
      break
    }
    case 'removeDiscard': {
      const n = inv.discard.length
      rt.exileCards(inv, inv.discard)
      inv.discard = []
      rt.info(`${inv.name} 的 ${n} 张弃牌被移出游戏。`)
      break
    }
    case 'onTheLam': {
      inv.onTheLam = true
      rt.info(`${inv.name} 进入逃亡状态：本轮内非精英敌人无法攻击。`)
      break
    }
    case 'addStatPhase': {
      // Phase 1（A1）：本阶段的属性加值不再是「写在调查员身上的裸字段」，
      // 而是一条有到期时间的持续效果（duration endOfPhase），由统一过期点清理。
      const amount = effect.amount || 1
      rt.addEffect(seat, {
        duration: 'endOfPhase',
        sourceCode: effect.source || null,
        label: `本阶段${effect.skill}属性 +${amount}`,
        modifiers: [{ target: `skill:${effect.skill}`, amount }],
      })
      rt.info(`${inv.name} 本阶段${effect.skill}属性 +${amount}。`)
      break
    }
    case 'mill': {
      // 弃掉牌库顶 N 张（03315 离场钩子：「弃掉你牌库顶10张卡牌」）。
      rt.mill(seat, effect.amount || 1)
      break
    }
    case 'rechargeAsset': {
      rt.rechargeAsset(inv, effect.amount || 1, effect)
      break
    }
    case 'addFog': {
      state.fogMod = Math.max(state.fogMod, effect.amount || 2)
      rt.info(`🌫️ 本回合调查难度 +${effect.amount || 2}。`)
      break
    }
    case 'addTestBonus': {
      inv.testBonus = Math.max(inv.testBonus || 0, effect.amount || 1)
      rt.info(`${inv.name} 本回合下一次技能检定 +${effect.amount || 1}。`)
      break
    }
    case 'skillTest': {
      rt.performTest(seat, effect.skill, effect.difficulty, { resolve: r => {
      if (r.success) {
        if (effect.success) resolveEffect(state, seat, effect.success, rt)
      } else if (effect.fail) {
        resolveEffect(state, seat, effect.fail, rt)
      }
      } })
      break
    }
    case 'spawnEnemy': {
      const loc = effect.location && effect.location !== 'here' ? effect.location : inv.location
      rt.spawnEnemy(effect.enemyCode, loc, effect.engage ? seat : null)
      break
    }
    case 'moveInvestigator': {
      const dest = effect.destination
      if (dest && dest !== 'here') {
        rt.moveInvestigator(seat, dest)
      }
      break
    }
    case 'search': {
      rt.search(seat, effect)
      break
    }
    case 'chooseOne': {
      const choiceSeat = rt.choiceSeat ?? seat
      const options = effect.options.map((option, index) => ({ id: String(index), label: option.label || `选项 ${index + 1}` }))
        .filter(option => !rt.effectError?.(seat, effect.options[Number(option.id)].effect))
      const id = effect.optionIndex == null ? requestChoice(state, {
        kind: 'effect', source: effect.source || 'chooseOne', seat: choiceSeat,
        prompt: '选择要结算的效果。', options, canSkip: false,
      }) : String(effect.optionIndex)
      if (!options.some(option => option.id === id)) throw new Error('效果选项非法或无法支付')
      resolveEffect(state, seat, effect.options[Number(id)].effect, rt)
      break
    }
    case 'cancelEnemyAttack': {
      rt.cancelPending('enemyAttack')
      rt.info(`${inv.name} 取消了这次敌人攻击。`)
      break
    }
    case 'cancelTreachery': {
      // Ward of Protection is played on the encounter-draw window (before the
      // revelation) as well as on the treachery window itself.
      if (state._reaction && ['encounterDrawn', 'treachery'].includes(state._reaction.when)) {
        state._reaction.cancelled = true
        if (state._reaction.when === 'encounterDrawn') state._reaction.redraw = false
        rt.info(`${inv.name} 取消了这张遭遇牌的效果。`)
      } else if (rt.cancelPending) rt.cancelPending('treachery')
      if (effect.horror) rt.applyHorror(seat, effect.horror)
      break
    }
    case 'addCurrentTest': {
      // Ritual Candles: +N to the skill test that is currently being resolved.
      if (state._reaction) state._reaction.testBonus = (state._reaction.testBonus || 0) + (effect.amount || 1)
      break
    }
    case 'substituteSkill': {
      rt.substituteSkill(seat, effect.from, effect.to)
      break
    }
    case 'sequence': {
      for (const child of effect.effects) resolveEffect(state, seat, child, rt)
      break
    }
    case 'exhaust': {
      if (effect.target === 'self') rt.exhaustSelf()
      break
    }
    case 'targetedEffect': {
      const targetSeat = rt.chooseInvestigator ? rt.chooseInvestigator(seat, effect.target || 'location', effect.effect, effect) : seat
      const targetRuntime = effect.chooseBy === 'controller' ? { ...rt, choiceSeat: seat } : rt
      resolveEffect(state, targetSeat, effect.effect, targetRuntime)
      break
    }
    case 'searchTop': {
      rt.searchTop(seat, effect)
      break
    }
    case 'investigateForResources': {
      rt.investigateForResources(seat, effect)
      break
    }
    case 'moveTo': {
      rt.moveTo(seat, effect)
      break
    }
    case 'dealDamageAll': {
      rt.dealDamageAll(seat, effect)
      break
    }
    case 'dealDamageExhausted': {
      rt.dealDamageExhausted(seat, effect)
      break
    }
    case 'blankEnemy': {
      rt.blankEnemy(seat, effect)
      break
    }
    case 'ignoreChaos': {
      rt.ignoreChaos(seat, effect)
      break
    }
    case 'returnAssetToHand': {
      rt.returnAssetToHand(seat, effect)
      break
    }
    case 'shuffleIntoEncounter': {
      rt.shuffleIntoEncounter(seat, effect)
      break
    }
    case 'moveHorrorToInvestigator': {
      rt.moveHorrorToInvestigator(seat, effect)
      break
    }
    case 'searchDiscard': {
      rt.searchDiscard(seat, effect)
      break
    }
    case 'autoEvadeNonElite': {
      rt.autoEvadeNonElite(seat, effect)
      break
    }
    case 'attachBarricade': {
      rt.attachBarricade(seat, effect)
      break
    }
    case 'drawEncounter': {
      rt.drawEncounter(seat)
      break
    }
    case 'addTestValue': {
      rt.addTestValue(effect.amount || 1)
      break
    }
    case 'disengageAll': {
      rt.disengageAll(seat)
      break
    }
    case 'flipTokenSign': {
      rt.flipTokenSign()
      break
    }
    case 'scry': {
      rt.scry(seat, effect)
      break
    }
    case 'gainClues': {
      rt.gainClues(inv, effect.amount || 1)
      break
    }
    case 'targetedTest': {
      rt.targetedTest(seat, effect)
      break
    }
    case 'aquinnahRedirect': {
      if (rt.aquinnahRedirect) rt.aquinnahRedirect(seat, effect)
      break
    }
    default: {
      throw new Error(`未实现的效果原语：${effect.type}`)
    }
  }
}

function doHeal(state, inv, amount, what, rt) {
  if (what === 'damage' || what === 'both') {
    const h = Math.min(inv.damage, amount)
    inv.damage -= h
    rt.info(`${inv.name} 治疗了 ${h} 点伤害。`)
  }
  if (what === 'horror' || what === 'both') {
    // 第 5 步 P6：治疗恐惧走统一入口（治疗支援的 owner 由调用方给出），
    // rt 没有这个读点时仍然直接扣（旧数据体的行为不变）。日志文案逐字保留。
    const healed = rt.healHorror
      ? rt.healHorror(inv, amount, { log: false })
      : (() => { const h = Math.min(inv.horror, amount); inv.horror -= h; return h })()
    rt.info(`${inv.name} 治疗了 ${healed} 点恐惧。`)
  }
}
