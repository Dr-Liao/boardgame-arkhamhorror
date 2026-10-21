// 地点进入效果的可读摘要：moves.js / table-decisions.js / AI 上下文共用同一份文案。
// 只读 `loc.onEnter` 这类声明式数据；剧本 behavior 里手写的强制效果不在这里，
// 需要剧本作者用 `scenario.locationNotices` 补一句（见敦威治 chapters.js）。
import { SKILL_NAMES } from './presentation-constants.js'

function failSummary(fail) {
  if (!fail) return ''
  if (fail.kind === 'damageAndHorror') {
    const parts = []
    if (fail.damage) parts.push(`${fail.damage} 点伤害`)
    if (fail.horror) parts.push(`${fail.horror} 点恐惧`)
    return parts.length ? `受到 ${parts.join('、')}` : ''
  }
  if (fail.kind === 'takeHorror' && fail.amount) return `受到 ${fail.amount} 点恐惧`
  if (fail.kind === 'takeDamage' && fail.amount) return `受到 ${fail.amount} 点伤害`
  return ''
}

// 例：{ damage: 1 } → 「受到 1 点伤害」
//     { test: {...}, fail: {...} } → 「意志(3)检定，失败受到 2 点恐惧」
export function entryEffectSummary(onEnter) {
  if (!onEnter) return ''
  const parts = []
  if (onEnter.damage) parts.push(`受到 ${onEnter.damage} 点伤害`)
  if (onEnter.horror) parts.push(`受到 ${onEnter.horror} 点恐惧`)
  if (onEnter.test) {
    const skill = SKILL_NAMES[onEnter.test.skill] || onEnter.test.skill || '技能'
    const failure = failSummary(onEnter.fail)
    parts.push(`${skill}(${onEnter.test.difficulty})检定${failure ? `，失败${failure}` : ''}`)
  }
  return parts.join('；')
}

// 移动提示只给一条：剧本手写的 notice 优先，其次才是 onEnter 的声明式摘要。
// 调用方负责 `revealed` 过滤，避免泄露未翻开的背面。
export function locationEntryNotice(state, loc) {
  if (!loc) return null
  const explicit = state.scenario?.locationNotices?.[loc.id]
  if (explicit) return explicit
  return entryEffectSummary(loc.onEnter) || null
}
