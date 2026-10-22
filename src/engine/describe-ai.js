// describe-ai.js · Phase 6 从 engine.js 拆出（依赖注入同前几批）。
// 给 AI 与界面看的描述层：猎物排序、可选能力提示、剧本动作提示、移动/动作文案。
// 纯函数（只读 state），但依赖不少展示常量与卡牌数据。
import { investigatorRule } from '../cards/card-rules.js'
import { scriptCardOwner } from './script-cards.js'

export function createDescribeAi(deps) {
  const {
    SKILL_NAMES,
    assetEffect,
    canAffordAbility,
    cannotTriggerFreeAbility,
    cardName,
    choiceSeats,
    controlledAbilityCards,
    groupClues,
    inHub,
    limitUsed,
    lolaCanUseCard,
    scenarioBehavior,
    validateMove,
  } = deps

  function describePrey(prey) {
    const map = {
      bearer: '持有者',
      highestCombat: '战斗最高者',
      lowestHealth: '生命最低者',
      mostClues: '线索最多者',
      mostHorror: '恐惧最多者',
      lowestSanity: '理智最低者',
      lowestAgility: '敏捷最低者',
      lowestCombat: '战斗最低者',
      fewestHand: '手牌最少者',
      mostHand: '手牌最多者',
    }
    return map[prey] || prey
  }

  function describeFreeAbilities(state, inv) {
    if (cannotTriggerFreeAbility(state, inv)) return []
    const out = []
    const ab = investigatorRule(inv.code) || {}
    if (ab.freeAction) {
      const cost = ab.freeAction.cost || {}
      if (inv.resources >= (cost.resources || 0) && !inv.usedReactions[ab.freeAction.id + ':' + state.turnSerial]) {
        out.push('⚡异能「花 ' + (cost.resources || 0) + ' 资源 +1 行动」')
      }
    }
    for (const a of controlledAbilityCards(inv)) {
      const eff = assetEffect(inv, a)
      if (!eff) continue
      if (!lolaCanUseCard(inv, a.code)) continue
      if (eff.freeTriggers && !a.exhausted) {
        const skills = eff.freeTriggers.map((ft) => SKILL_NAMES[ft.skill] + '+' + (ft.bonus || 1) + '(花' + ((ft.cost && ft.cost.resources) || 0) + '资源)').join('、')
        out.push('天赋「' + cardName(a.code) + '」检定前自动 ' + skills)
      }
      if (eff.abilities) {
        eff.abilities.forEach((ability) => {
          // 上限已用掉的能力不能再说成「可用」：legalMoves 里已经没有它，
          // 否则提示词会同时出现「可用」和「已用完」两句自相矛盾的话。
          if (ability.descriptor && limitUsed(state, inv, ability.descriptor, null, null, a)) return
          if (ability.cost && ability.cost.action === false && canAffordAbility(state, inv, a, ability)) {
            out.push('免费能力「' + cardName(a.code) + '」' + ability.label)
          }
        })
      }
    }
    return out
  }

  function scriptActionHints(state, seat) {
    if (state.status !== 'playing' || inHub(state) || !state.scenario) return []
    const inv = state.investigators.find(item => item.seat === seat)
    if (!inv || inv.defeated || inv.resigned) return []
    const behavior = scenarioBehavior(state), hints = []
    // 行动归属：与 moves.js 共用关卡数据的 scriptCards，避免可执行列表带归属、
    // 不可执行提示却不带，导致牌桌只剩通用动作栏里的按钮。
    const owned = move => {
      const scriptCard = move.scriptCard || scriptCardOwner(state, move)
      return scriptCard ? { ...move, scriptCard } : move
    }
    if (behavior.drawCultistActIndex === state.actIndex) {
      const cost = 2 * state.numInvestigators
      hints.push({ action: 'drawCultist', scriptCard: 'act', label: `抽取异教徒牌堆（调查员共同花费 ${cost} 线索）`,
        reason: !state.cultistDeck.length ? '异教徒牌堆已空' : groupClues(state) < cost ? `需要调查员共同花费 ${cost} 个线索` : null })
    }
    if (behavior.interruptRitualActIndex === state.actIndex) {
      for (const [skill, name] of [['willpower', '意志'], ['agility', '敏捷']])
        hints.push({ action: 'interruptRitual', skill, scriptCard: 'act', label: `破坏仪式（${name} 3，花 1 线索）`, reason: inv.clues < 1 ? '需要花费 1 个线索' : null })
    }
    if (state.scenario.resignAnywhere) hints.push({ action: 'resign', scriptCard: 'agenda', label: '撤退', reason: null })
    hints.push(...(behavior.actions?.(state, inv) || []), ...(behavior.encounterActions?.(state, inv) || []))
    // 引擎自带的探索行动没有卡号：当前幕/密谋印着「探索」时也要作为剧本行动列出，
    // 能执行时与 legalMoves 里的探索合并成同一项，不能执行时给出缺口原因。
    if (!hints.some(move => move.action === 'explore') && scriptCardOwner(state, { action: 'explore' })) {
      const remaining = (state.explorationDeck || []).length
      hints.push({ action: 'explore', label: remaining ? `🧭 探索（剩余 ${remaining} 张）` : '🧭 探索' })
    }
    const choice = state.pendingChoice
    return hints.map(move => owned({ ...move })).map(({ reason, ...move }) => ({ ...move,
      reason: reason || (choice ? (choice.kind === 'turnOrder' && choiceSeats(choice).includes(seat) ? '先点击「开始行动」' : '等待当前选择结算')
        : seat !== state.currentSeat ? '尚未轮到你行动' : validateMove(state, seat, move)) || null }))
  }

  function moveToText(move) {
    if (!move) return ''
    if (move.label) return move.label.replace(/^[^\s]+\s/, '')
    switch (move.action) {
      case 'draw': return '抽牌'
      case 'resource': return '获得资源'
      case 'investigate': return '调查'
      case 'fight': return '攻击'
      case 'evade': return '躲避'
      case 'move': return '移动'
      case 'resign': return '撤退'
      case 'endTurn': return '结束回合'
      case 'freeAction': return '使用调查员异能'
      case 'parley': return '谈判'
      case 'parleyCultist': return '谈判盘问'
      case 'parleyLita': return '谈判丽塔'
      case 'drawCultist': return '抽取异教徒牌堆'
      case 'interruptRitual': return '破坏仪式'
      case 'sacrificeLita': return '献祭丽塔'
      case 'breakDoor': return '破门'
      case 'discardThreat': return '弃掉威胁'
      case 'purgeThreat': return '净化威胁'
      case 'play': return '打出' + (move.cardId ? '「' + cardName(move.cardId) + '」' : '')
      case 'ability': return '使用能力'
      default: return move.action
    }
  }

  function stripLabel(m) {
    const copy = { ...m }
    delete copy.label
    return copy
  }

  return { describePrey, describeFreeAbilities, scriptActionHints, moveToText, stripLabel }
}
