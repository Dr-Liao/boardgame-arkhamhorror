export const SCENARIO_MIGRATION_CHECKS = Object.freeze([
  'sourceLocked',
  'identityRegistered',
  'setupAndZones',
  'actsAndAgendas',
  'locationsAndConnections',
  'encounterBehaviors',
  'literalCardBehavior',
  'chaosEffects',
  'resolutionsAndRecords',
  'storyText',
  'saveReplay',
  'browserAcceptance',
])

export const KEYWORD_MIGRATION_CHECKS = Object.freeze([
  'sourceInventoried',
  'engineBehavior',
  'nodeAcceptance',
  'rulebookEntry',
  'cardLinks',
])

export const RULEBOOK_MIGRATION_CHECKS = Object.freeze([
  'campaignOverview',
  'scenarioMechanics',
  'keywordEntries',
  'cardLinks',
  'desktopBrowser',
  'mobileBrowser',
])

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} 必须是对象`)
  }
  return value
}

function requireEvidence(value, path) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`${path} 必须是证据路径数组`)
  }
}

function confirmable(item, checks, path) {
  requireObject(item, path)
  requireObject(item.checks, `${path}.checks`)
  requireEvidence(item.evidence, `${path}.evidence`)
  for (const check of checks) {
    if (typeof item.checks[check] !== 'boolean') throw new TypeError(`${path}.checks.${check} 必须是布尔值`)
  }
  const complete = checks.every(check => item.checks[check])
  const expected = complete ? 'verified' : 'pending'
  if (item.status !== expected) throw new TypeError(`${path}.status 应为 ${expected}`)
  if (complete && !item.evidence.length) throw new TypeError(`${path} 已确认但没有证据`)
  return complete
}

function group(items, checks, path, expectedIds = null) {
  if (!Array.isArray(items) || !items.length) throw new TypeError(`${path}.items 必须是非空数组`)
  const ids = items.map((item, index) => {
    if (typeof item.id !== 'string' || !item.id) throw new TypeError(`${path}.items[${index}].id 必须是非空字符串`)
    return item.id
  })
  if (new Set(ids).size !== ids.length) throw new TypeError(`${path}.items 存在重复 ID`)
  if (expectedIds && (ids.length !== expectedIds.length || ids.some((id, index) => id !== expectedIds[index]))) {
    throw new TypeError(`${path}.items 与内容清单不一致`)
  }
  return items.every((item, index) => confirmable(item, checks, `${path}.items[${index}]`))
}

export function assertMigrationConfirmations(report, expectedScenarioIds = null) {
  requireObject(report, 'report')
  const confirmations = requireObject(report.confirmations, 'report.confirmations')
  const scenarios = requireObject(confirmations.scenarios, 'report.confirmations.scenarios')
  const keywords = requireObject(confirmations.keywords, 'report.confirmations.keywords')
  const rulebook = requireObject(confirmations.rulebook, 'report.confirmations.rulebook')
  const scenarioComplete = group(scenarios.items, SCENARIO_MIGRATION_CHECKS,
    'report.confirmations.scenarios', expectedScenarioIds)
  const keywordComplete = group(keywords.items, KEYWORD_MIGRATION_CHECKS,
    'report.confirmations.keywords')
  const rulebookComplete = confirmable(rulebook, RULEBOOK_MIGRATION_CHECKS,
    'report.confirmations.rulebook')
  for (const [name, section, complete] of [
    ['scenarios', scenarios, scenarioComplete],
    ['keywords', keywords, keywordComplete],
  ]) {
    const expected = complete ? 'verified' : 'pending'
    if (section.status !== expected) throw new TypeError(`report.confirmations.${name}.status 应为 ${expected}`)
  }
  if (report.playable && !(scenarioComplete && keywordComplete && rulebookComplete)
    && report.earlyAccess !== true) {
    throw new TypeError('战役不可在剧本、关键词和规则书迁移全部确认前标记为 playable')
  }
  return report
}
