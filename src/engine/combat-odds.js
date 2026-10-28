// combat-odds.js · AI 专用：攻击 / 躲避的单标记成功率与命中伤害预估。
//
// 为什么单独一层：`actionPreview` 是牌桌与 describeState 共用的「费用预览」，而概率推演只
// 服务 AI 决策（用户要求「只给 AI 读」）。因此本模块不接 viewState / legalMoves / HTTP，
// 唯一调用点是 src/ai/ai-context.js；它只读 state，不写字段、不开窗口、不消耗随机数。
//
// 口径（与引擎的结算读点对齐；任何读不到的部分都写进 note，不输出看起来精确的假数字）：
//   · 检定值 = 技能值（getStat）+ 效果自带加值（攻击 combatBonus / 躲避 bonus / addSkill /
//     「所在地点有线索时」的加值 / 躲避被动的 evadeBonus）；
//   · 难度   = 敌人战斗 / 躲避值（含场景与卡面修正）+ 效果自带的难度修正 + 场景全局难度修正；
//   · 成功率 = 单标记模型：袋里每个标记都算一遍，value + 标记修正 ≥ 难度 即成功；
//   · 符号标记按剧本 tokenMeanings 取值，缺失时用 SYMBOL_DEFAULTS 兜底（与 treachery-tokens.js
//     的 resolveSpecialToken 同一顺序）；
//   · 伤害   = 1 + damageBonus（或 damageOverride），还需命中几次见 hits。
//
// 已知不建模（都会写进 note）：旧印只识别 static / perClueAtLocation 两种声明、
// 「再抽一个」类标记只按单个标记计、反应窗口里的临时加值、可选的额外加伤害。

import { investigatorRule } from '../cards/investigator-abilities.js'
import { enemyRuleFlags } from '../cards/card-rules.js'
import { SYMBOL_DEFAULTS } from '../../content/campaigns/nightOfTheZealot/shared.js'
import { totalDoom } from './rules-state.js'

const SYMBOL_FACES = new Set(['skull', 'cultist', 'tablet', 'elderthing'])

export function createCombatOdds(deps) {
  const {
    abilityOfMove,
    assetEffect,
    enemyEvadeValue,
    enemyFightValue,
    enemyHealth,
    enemyTextBlanked,
    getStat,
    playedEffect,
    scenarioBehavior,
  } = deps

  // 行动 → 这次检定属于攻击还是躲避。只有能确定技能/目标/伤害的行动才给预估；
  // resolve 型能力没有可读的数值数据体，直接返回 null（宁可不给，也不猜）。
  function kindOf(move, effect) {
    if (move.action === 'fight') return 'fight'
    if (move.action === 'evade' || move.action === 'extraEvade') return 'evade'
    if (effect?.type === 'fight') return 'fight'
    if (effect?.type === 'evade') return 'evade'
    return null
  }

  function effectOf(state, inv, move) {
    if (move.action === 'ability') return abilityOfMove(state, inv, move)?.effect || null
    if (move.action === 'play') return playedEffect(move.copyCode || move.cardId) || null
    return null
  }

  function enemyFor(state, move) {
    const id = move.enemyId ?? move.targetId
    return id == null ? null : (state.enemies || []).find(enemy => enemy.id === id) || null
  }

  function skillOf(effect, kind) {
    return effect?.skill || (kind === 'fight' ? 'combat' : 'agility')
  }

  function valueOf(state, inv, effect, kind, skill) {
    let value = Number.isFinite(effect?.baseValue) ? effect.baseValue : getStat(state, inv, skill)
    if (effect?.addSkill) value += getStat(state, inv, effect.addSkill)
    if (kind === 'fight') value += Number(effect?.combatBonus) || 0
    else value += Number(effect?.bonus) || 0
    // 卡面「如果你所在地点至少有 N 个线索，改为 +X」在引擎里是独立的战斗加值。
    if (kind === 'fight' && Number(effect?.ifCluesAtLocationCombatBonus)) {
      const location = (state.locations || []).find(item => item.id === inv.location)
      if ((location?.clues || 0) > 0) value += Number(effect.ifCluesAtLocationCombatBonus)
    }
    // 躲避被动（如战壕大衣）在引擎里加在 skillBonus 上，不属于 getStat。
    if (kind === 'evade') {
      value += (inv.assets || []).reduce((sum, asset) => sum + (assetEffect?.(inv, asset)?.passive?.evadeBonus || 0), 0)
    }
    return value
  }

  function difficultyOf(state, inv, enemy, effect, kind, skill) {
    let target = kind === 'fight' ? enemyFightValue(state, enemy, inv) : enemyEvadeValue(state, enemy, inv)
    if (kind === 'fight' && Number.isFinite(effect?.enemyFightMod)) target = Math.max(0, target + effect.enemyFightMod)
    if (kind === 'evade' && Number.isFinite(effect?.evadeModifier)) target = Math.max(0, target + effect.evadeModifier)
    // performTest 在开检定前应用剧本的全局难度修正（如「本阶段所有技能检定 -1」）。
    const behavior = scenarioBehavior(state) || {}
    if (typeof behavior.testDifficultyModifier === 'function') {
      const mod = behavior.testDifficultyModifier(state, inv, skill, target, { label: kind === 'fight' ? '攻击' : '躲避' })
      if (Number.isFinite(mod) && mod) target = Math.max(0, target + mod)
    }
    return target
  }

  // 符号标记的数值。顺序与 treachery-tokens.js 的 resolveSpecialToken 一致：
  // 剧本 tokenMeanings 优先（kind:'count' 按场上情况算），否则 SYMBOL_DEFAULTS 兜底。
  function countTokenValue(name, state, inv) {
    const enemies = state.enemies || []
    const withTrait = trait => enemies.filter(enemy => (enemy.traits || [])
      .some(item => String(item).toLowerCase() === trait))
    if (name === 'ghoulsAtLocation') return withTrait('ghoul').filter(enemy => enemy.location === inv.location).length
    if (name === 'monsters') return withTrait('monster').length
    if (name === 'maxDoomOnCultist') {
      return withTrait('cultist').reduce((max, enemy) => Math.max(max, enemy.doom || 0), 0)
    }
    if (name === 'totalDoom') return totalDoom(state)
    return null
  }

  function elderSignDelta(state, inv) {
    const rule = investigatorRule(inv.code)?.elderSign
    // 没有声明时，引擎对未登记调查员按 +1 结算（turn-flow.js 的 elderSignEffect 兜底）。
    if (!rule) return { delta: 1 }
    if (rule.kind == null || rule.kind === 'static') return { delta: Number(rule.bonus) || 1 }
    if (rule.kind === 'perClueAtLocation') {
      const location = (state.locations || []).find(item => item.id === inv.location)
      return { delta: (Number(rule.bonus) || 1) * (location?.clues || 0) }
    }
    return { delta: 0, unknown: true }
  }

  function tokenOutcome(state, inv, token, meanings, doubleNegative) {
    if (token === 'autofail') return { fail: true }
    if (token === 'eldersign') return elderSignDelta(state, inv)
    if (/^[+-]?\d+$/.test(String(token))) {
      const numeric = Number(token)
      return { delta: doubleNegative && numeric < 0 ? numeric * 2 : numeric }
    }
    if (token === 'bless') return { delta: 2 }
    if (token === 'curse') return { delta: -2 }
    // 霜冻：-1；同一次检定抽到第二枚才自动失败（本实现没有多抽，按 -1 计）。
    if (token === 'frost') return { delta: -1 }
    const meaning = meanings?.[token]
    if (meaning) {
      if (meaning.kind === 'count') {
        const count = countTokenValue(meaning.count, state, inv)
        if (count == null) return { delta: 0, unknown: true }
        const delta = -((Number(meaning.base) || 0) + count)
        return { delta: doubleNegative && delta < 0 ? delta * 2 : delta, drawAnother: Boolean(meaning.drawAnother) }
      }
      // tokenMeanings 有两种写法：旧剧本用 mod，新剧本（文本 + 数值）用 delta。
      const delta = meaning.delta ?? meaning.mod
      if (!Number.isFinite(delta)) return { delta: 0, unknown: true }
      return { delta: doubleNegative && delta < 0 ? delta * 2 : delta, drawAnother: Boolean(meaning.drawAnother) }
    }
    if (Number.isFinite(SYMBOL_DEFAULTS[token])) {
      const delta = SYMBOL_DEFAULTS[token]
      return { delta: doubleNegative && delta < 0 ? delta * 2 : delta }
    }
    return { delta: 0, unknown: true }
  }

  function chanceOf(state, inv, value, difficulty, doubleNegative) {
    const bag = state.chaosBag || []
    if (!bag.length) return { chance: null, total: 0, unknown: [], drawAnother: false }
    const meanings = state.scenario?.tokenMeanings?.[state.difficulty] || {}
    const unknown = new Set()
    let drawAnother = false
    let success = 0
    for (const token of bag) {
      const outcome = tokenOutcome(state, inv, token, meanings, doubleNegative)
      if (outcome.unknown) unknown.add(token)
      if (outcome.drawAnother) drawAnother = true
      if (!outcome.fail && value + (Number(outcome.delta) || 0) >= difficulty) success += 1
    }
    return { chance: success / bag.length, total: bag.length, unknown: [...unknown], drawAnother }
  }

  // 命中伤害：与 combat.js 的 doFight 结算同序（1 + damageBonus，或 damageOverride）。
  function damageOf(state, enemy, effect, kind, notes) {
    if (kind !== 'fight') return null
    const remaining = Math.max(0, enemyHealth(state, enemy) - (enemy.damageTaken || 0))
    if (effect?.successDamage === 'overDifficulty') {
      notes.push('伤害 = 超出难度的点数')
      return { damage: null, remaining, hits: null }
    }
    if (Number(effect?.damagePerClue)) notes.push('伤害随所在地点线索数变化')
    const full = Number.isFinite(effect?.damageOverride)
      ? Math.max(0, effect.damageOverride)
      : 1 + (Number(effect?.damageBonus) || 0)
    // 「成功且超出 N 点才 +X 伤害」：只按刚过难度时的 1 点给出，加值写进 note。
    const conditional = Number.isFinite(effect?.successBy)
    if (conditional) notes.push(`伤害 +${Math.max(0, full - 1)} 需成功超出 ${effect.successBy}`)
    const damage = conditional ? 1 : full
    const hits = damage > 0 && remaining > 0 ? Math.ceil(remaining / damage) : null
    return { damage, remaining, hits }
  }

  // 失败代价：反击（攻击落空）与警戒（躲避落空）都会立刻挨一次敌人的攻击。
  function failCostOf(enemy, effect, kind) {
    if (kind === 'fight' && enemy.retaliate && !effect?.ignoreRetaliate) {
      return { retaliate: { damage: enemy.damage || 0, horror: enemy.horror || 0 } }
    }
    if (kind === 'evade' && enemy.alert) {
      return { alert: { damage: enemy.damage || 0, horror: enemy.horror || 0 } }
    }
    return null
  }

  return function combatOdds(state, seat, move) {
    if (!state || !move || state.status !== 'playing' || state.pendingChoice) return null
    const inv = (state.investigators || [])[seat]
    if (!inv || inv.defeated || inv.resigned) return null
    const effect = effectOf(state, inv, move)
    const kind = kindOf(move, effect)
    if (!kind) return null
    const enemy = enemyFor(state, move)
    if (!enemy) return null

    const skill = skillOf(effect, kind)
    const value = valueOf(state, inv, effect, kind, skill)
    const target = difficultyOf(state, inv, enemy, effect, kind, skill)
    // 双倍负值是躲避专属的敌人规则（doEvade 传 doubleNegative），攻击没有。
    const flags = enemyRuleFlags(enemy.code) || {}
    const doubleNegative = kind === 'evade'
      && !enemyTextBlanked?.(state, enemy)
      && Boolean(flags.doubleNegative || enemyRuleFlags(enemy.ruleId)?.doubleNegative)

    const notes = []
    const { chance, total, unknown, drawAnother } = chanceOf(state, inv, value, target, doubleNegative)
    if (unknown.length) notes.push(`标记取值未知（按 0 计）：${unknown.join('、')}`)
    if (drawAnother) notes.push('有标记会追加揭示，实际概率略有偏差')

    const damage = damageOf(state, enemy, effect, kind, notes)
    const onFail = failCostOf(enemy, effect, kind)
    const odds = {
      kind,
      enemy: enemy.name,
      skill,
      value,
      target,
      need: target - value,
      chance: chance == null ? null : Math.round(chance * 100) / 100,
      tokens: total,
    }
    if (damage) {
      odds.damage = damage.damage
      odds.hits = damage.hits
    }
    if (onFail) odds.onFail = onFail
    if (notes.length) odds.note = notes.join('；')
    return odds
  }
}
