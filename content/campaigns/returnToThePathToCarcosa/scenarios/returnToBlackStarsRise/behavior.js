// 重返黑星升起 · 章节行为。
//
// 基础章节的两条密谋路线、双密谋牌堆、毁灭放置、结局记录直接复用基础 behavior；
// 这里只覆盖 52054 背面的布置差异：回廊 / 骑士大厅的「原版 vs 重返版」两堆先洗混，
// 再随机移出其中一堆，本场使用另一堆。
import { behavior as baseBehavior } from '../../../thePathToCarcosa/scenarios/blackStarsRise/behavior.js'
import { locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { CLOISTER_VARIANTS } from './definition.js'
import { returnToIntroduction } from '../../story.js'

const original = card => card?.originalCode || card?.code

export const behavior = {
  ...baseBehavior,
  id: 'returnToBlackStarsRise',
  introduction: returnToIntroduction('blackStarsRise'),

  setupLocations(state, events, api) {
    const placed = baseBehavior.setupLocations(state, events, api)
    // 四张回廊/骑士大厅先按「原版 / 新版」分为两堆；两堆背面相同，随机移出一堆。
    const useReturnPile = api.randomValue(state) < 0.5
    state.scenarioFlags.cloisterPile = useReturnPile ? 'return' : 'original'
    for (const id of ['cloister', 'knightsHall']) {
      const code = CLOISTER_VARIANTS[id][useReturnPile ? 1 : 0]
      const variant = state.scenario.locationVariants[id]?.find(item => item.originalCode === code)
      if (variant) state.locationVariants[id] = structuredClone(variant)
    }
    state.scenarioFlags.cloisterRemovedPile = useReturnPile ? 'original' : 'return'
    return placed
  },

  // 52055 回廊 / 52056 骑士大厅：没有线索时的谈判行动（记住「塔楼的钥匙 / 一个向导」）。
  actions(state, inv) {
    const moves = baseBehavior.actions?.(state, inv) || []
    const location = state.locations.find(item => item.id === inv.location)
    const rule = locationRuleFor(original(location))?.parley
    if (!rule) return moves
    const remembered = (state.scenarioFlags?.remembered || []).includes(rule.remember)
    const hasClues = Number(location.clues || 0) > 0
    moves.push({
      action: 'scenarioAction', rule: rule.rule, locationId: location.id, label: rule.label,
      reason: hasClues ? '此处仍有线索' : remembered ? '已经记住了这件事' : null,
    })
    return moves
  },

  performAction(state, inv, move, api) {
    const location = state.locations.find(item => item.id === inv.location)
    const rule = locationRuleFor(original(location))?.parley
    if (rule && move.rule === rule.rule && move.locationId === location.id) {
      if (Number(location.clues || 0) > 0) throw new Error('此处仍有线索，不能谈判')
      if ((state.scenarioFlags?.remembered || []).includes(rule.remember)) return
      const labels = { willpower: '意志', intellect: '智力', combat: '战斗', agility: '敏捷' }
      const skill = rule.skills.length === 1 ? rule.skills[0] : api.choose({
        kind: 'skill', source: original(location), seat: inv.seat,
        prompt: '选择本次谈判检定的技能。',
        options: rule.skills.map(id => ({ id, label: labels[id] || id })),
      })
      api.test(inv.seat, rule.skills.includes(skill) ? skill : rule.skills[0], rule.difficulty,
        result => {
          if (!result.success) return
          api.remember?.(rule.remember)
          api.info?.(`你记住了：${rule.remember}。`)
        }, 0, { type: 'scenario', action: 'parley', label: rule.label, code: original(location) })
      return
    }
    baseBehavior.performAction(state, inv, move, api)
  },
}
