import { commitProfile } from './lifecycle.js'
import { handCommitBlocker } from './tarot-slot.js'
import { availableResources, spendFromPool } from './resource-bank.js'
import { payTokenCost, tokenCostAvailable } from './token-cost.js'

export function commitResourceCost(state, owner, code, deps) {
  const rate = (owner.threat || []).reduce((sum, card) => sum + (deps.registeredEntry(card.code)?.investigator?.commitResourceCostPerIcon || 0), 0)
  return rate * Math.abs(deps.commitIcons(state, owner, code, state.skillTest?.skill))
}
export function payCommitResourceCost(state, owner, code, deps) {
  const cost = commitResourceCost(state, owner, code, deps)
  if (availableResources(owner) < cost) return false
  if (!payTokenCost(state, owner, deps.registeredEntry(code)?.additionalTokenCost)) return false
  if (cost) spendFromPool(owner, cost, state)
  return true
}

// Shared by hand, attached cards and effects which force a card into a test.
export function canCommitToTest(state, owner, code, deps, options = {}) {
  const test = state.skillTest
  if (!test || !owner) return false
  if (test.blockCommitSeats?.includes(owner.seat)) return false
  const { cardDef, commitIcons, registeredEntry } = deps
  const profile = commitProfile(code) || {}
  const card = cardDef(code)
  if (!options.ignoreAdditionalCosts && !tokenCostAvailable(state, owner, registeredEntry(code)?.additionalTokenCost)) return false
  if (!options.ignoreAdditionalCosts && availableResources(owner) < commitResourceCost(state, owner, code, deps)) return false
  if (!card || handCommitBlocker(owner, registeredEntry)) return false
  if (owner.seat !== test.seat && owner.threat?.some(t => registeredEntry(t.code)?.cannotAffectOtherInvestigators)) return false
  if (deps.lolaCanUseCard?.(owner, code) === false) return false
  if (deps.runtimeCardAvailable?.(state, owner, code) === false) return false
  if (deps.scenarioBehavior?.(state)?.canCommitCard?.(state, owner, code) === false) return false
  if (profile.selfTestOnly && owner.seat !== test.seat) return false
  if (profile.otherTestOnly && owner.seat === test.seat) return false
  if (profile.commitCondition && !profile.commitCondition({ state, owner,
    performer: state.investigators[test.seat], test, baseSkillValue: [].concat(test.skill).reduce((sum, skill) => sum + deps.baseStatValue(state, state.investigators[test.seat], skill), 0) })) return false
  if (profile.requireClueAtLocation && !(state.locations.find(loc => loc.id === owner.location)?.clues > 0)) return false
  if (profile.requireEngagedEnemy && !deps.enemiesEngagedWith(state,owner).length) return false
  if (profile.requireDifficultyAboveBase) {
    const performer=state.investigators[test.seat]
    const skills=Array.isArray(test.skill) ? test.skill : [test.skill]
    if (test.difficulty-skills.reduce((sum,skill)=>sum+deps.getStat(state,performer,skill),0)<profile.requireDifficultyAboveBase) return false
  }
  if (deps.activeHiddenRules?.(state,owner).some(hidden=>hidden.rule.cannotCommitTypes?.includes(card.type))) return false
  if (profile.remainingSanityAtMost != null && (deps.getMaxSanity?.(owner) ?? owner.sanity) - owner.horror > profile.remainingSanityAtMost) return false
  const rows = test.committed || []
  if (profile.maxPerTest && rows.filter(row => row.code === code).length >= profile.maxPerTest) return false
  if (profile.noOtherCommits && rows.length) return false
  if (rows.some(row => commitProfile(row.code)?.noOtherCommits && row.code !== code)) return false
  if (profile.scenarioAbilityOnly && !test.source?.scenarioAbility && !test.source?.ability) return false
  if (/最多投入1张|Max 1 committed/i.test(card.textZh || card.text || '') && rows.some(row => row.code === code)) return false
  if (card.subtype && !profile.mustCommitNextTest && !profile.subtractIcons) return false
  return profile.anySkill || commitIcons(state, owner, code, test.skill) !== 0
}
