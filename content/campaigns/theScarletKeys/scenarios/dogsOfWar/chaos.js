// 战争疮痍（Dogs of War · 09635 · 亚历山大）· 混乱标记取值与后果。
//
// 参考：09635 卡面两档 + locale `scenarios/dogsOfWar.json#tokens`。
//   [skull]      简单/普通：-1（如果你所在地点有钥匙节点，改为 -3）；困难/专家：-2（改为 -4）
//   [cultist]    简单/普通：-3；困难/专家：-5。检定失败后二选一：受到 1 点伤害和 1 点恐惧，
//                或在最近的钥匙节点 / [[节点地]]地点上放置 1 个毁灭标记。
//   [tablet]     简单/普通：-2；困难/专家：-2。如果这是对**有巡逻关键词的敌人**的一次攻击，
//                本次攻击后该敌人解除交战并结算其巡逻关键词（困难/专家：它还先攻击你）。
//   [elderthing] 简单/普通：-2，你检定失败且每低于难度 1 点失去 1 资源（最多 3）；
//                困难/专家：-3，不设上限。
//
// 口径：
//   · 标记**数值**由 behavior.resolveChaosToken 通过本文件的分支函数给出（skull 依赖「你所在地点
//     是否有钥匙节点」），静态 tokenMeanings 只给文字与 AI 预估用的基准值；
//   · cultist / tablet / elderthing 的失败后果由 behavior.afterTest 取 rider 列表后统一结算，
//     与同循环《如履薄冰》《疯星乱舞》同一形状（rider 只是稳定字符串，不是函数）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { chapterSection } from '../../story-access.js'

// 标记文字直接从指南生成物（story-text 的 `tokens` 段，来源是参考实现的 locale）取，
// 保证「四档 token meanings」与指南逐字一致；`delta` 与动态分支仍由本文件的表给出。
const GUIDE_TOKENS = chapterSection('dogsOfWar', 'tokens', {}) || {}
const easyStandardTokens = GUIDE_TOKENS.easyStandard || {}
const hardExpertTokens = GUIDE_TOKENS.hardExpert || {}
const tokenText = (table, token, fallback) => {
  const value = table?.[token]
  return typeof value === 'string' && value.trim() ? value : fallback
}

// 钥匙节点：版本一用 09653b（最后堡垒，6 生命）；版本二/三用 09653a（防御屏障，3×人数生命）。
export const KEY_LOCUS_CODES = Object.freeze(['09653a', '09653b'])
// 暗红骑士的剧情支援面：场上没有其它钥匙节点时，它算作钥匙节点（密谋 1 的规则）。
export const CLARET_KNIGHT_ASSET = '09654b'

const standardTable = Object.freeze({
  skull: {
    text: tokenText(easyStandardTokens, 'skull', '-1（如果你所在地点有钥匙节点，改为-3）。'),
    delta: -1, dynamic: 'keyLocusHere',
  },
  cultist: {
    text: tokenText(easyStandardTokens, 'cultist', '-3。如果你检定失败，受到1点伤害和1点恐惧；或在最近的钥匙节点或[[节点地]]地点上放置1个毁灭标记。'),
    delta: -3, onFail: 'cultistHarmOrDoom',
  },
  tablet: {
    text: tokenText(easyStandardTokens, 'tablet', '-2。如果是攻击有巡逻关键词的敌人，本次攻击后，该敌人解除交战，并结算其巡逻关键词。'),
    delta: -2, attackRider: 'patrolDisengage',
  },
  elderthing: {
    text: tokenText(easyStandardTokens, 'elderThing', '-2。你检定失败且每低于难度1点，失去1资源(最多3)。'),
    delta: -2, onFail: 'loseResourcesPerPoint', max: 3,
  },
})
const hardTable = Object.freeze({
  skull: {
    text: tokenText(hardExpertTokens, 'skull', '-2（如果你所在地点有钥匙节点，改为-4）。'),
    delta: -2, dynamic: 'keyLocusHere',
  },
  cultist: {
    text: tokenText(hardExpertTokens, 'cultist', '-5。如果你检定失败，受到1点伤害和1点恐惧；或在最近的钥匙节点或[[节点地]]地点上放置1个毁灭标记。'),
    delta: -5, onFail: 'cultistHarmOrDoom',
  },
  tablet: {
    text: tokenText(hardExpertTokens, 'tablet', '-2。如果是攻击有巡逻关键词的敌人，本次攻击后，该敌人攻击你，与调查员解除交战，并结算其巡逻关键词。'),
    delta: -2, attackRider: 'patrolAttackDisengage',
  },
  elderthing: {
    text: tokenText(hardExpertTokens, 'elderThing', '-3。你检定失败且每低于难度1点，失去1资源。'),
    delta: -3, onFail: 'loseResourcesPerPoint', max: null,
  },
})

export const DOGS_OF_WAR_TOKEN_MEANINGS = Object.freeze({
  easy: standardTable, standard: standardTable, hard: hardTable, expert: hardTable,
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const meaningsFor = state => (isHardSide(state) ? hardTable : standardTable)

const codeOf = card => card?.originalCode || card?.code || card
export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
const hasTrait = (card, trait) =>
  (card?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())

/** 场上所有钥匙节点实体（敌人化的钥匙节点 + 「唯一的钥匙节点」暗红骑士剧情支援）。 */
export function keyLocusEntities(state) {
  const out = []
  for (const enemy of state?.enemies || []) {
    if (enemy.defeated || enemy.removedFromGame) continue
    if (enemy.keyLocus === true || KEY_LOCUS_CODES.includes(String(codeOf(enemy)))) out.push(enemy)
  }
  for (const asset of state?.storyAssets || []) {
    if (asset.keyLocus === true) out.push(asset)
  }
  return out
}

/** 某地点的钥匙节点实体（第一个）；地点自己「算作钥匙节点」时返回该地点实例。 */
export function keyLocusAt(state, locationId) {
  if (!locationId) return null
  const entity = keyLocusEntities(state).find(entry => entry.location === locationId)
  if (entity) return entity
  const location = (state?.locations || []).find(item => item.id === locationId && item.keyLocus === true)
  return location || null
}

/** 该地点是否有钥匙节点（实体在此，或地点自己算作钥匙节点）。 */
export const locationHasKeyLocus = (state, locationId) => Boolean(keyLocusAt(state, locationId))

/** 有钥匙节点的地点 id 列表（去重、稳定顺序）。 */
export function keyLocusLocations(state) {
  const ids = keyLocusEntities(state).map(entry => entry.location).filter(Boolean)
  for (const location of state?.locations || []) if (location.keyLocus === true) ids.push(location.id)
  return [...new Set(ids)]
}

/** 钥匙节点总数（实体 + 「算作钥匙节点」的地点）。 */
export function keyLocusCount(state) {
  const marked = (state?.locations || []).filter(location => location.keyLocus === true).length
  return keyLocusEntities(state).length + marked
}

/** 调查员所在地点是否有钥匙节点（[skull] 的动态取值读点）。 */
export function atKeyLocus(state, inv) {
  return locationHasKeyLocus(state, inv?.location)
}

/** [[节点地]]（Locus Site）地点：印刷含 `Locus Site` 特性的在场地点。 */
export function locusSiteLocations(state) {
  return (state?.locations || []).filter(location => hasTrait(location, 'Locus Site')).map(location => location.id)
}

/**
 * 逐标记取值：`{ delta, autoFail? }`；未声明的标记交回引擎默认表（null）。
 */
export function dogsOfWarChaosToken(state, inv, token) {
  const table = meaningsFor(state)
  const entry = table[token]
  if (!entry) return null
  if (token === 'skull') {
    const here = atKeyLocus(state, inv)
    const base = Number(entry.delta) || 0
    // 卡面：简单/普通 -1（有钥匙节点 -3）、困难/专家 -2（有钥匙节点 -4）→ 有钥匙节点时再 -2。
    const value = here ? base - 2 : base
    return { delta: value === 0 ? 0 : value }
  }
  return { delta: Number(entry.delta) }
}

/** 本次检定实际计入的标记（去掉被取消/替换的）。 */
function resolvedTokens(result, context) {
  const resolved = context?.resolvedTokens
  if (Array.isArray(resolved)) return resolved
  const cancelled = new Set(result?.cancelledTokens || [])
  return (result?.drawn || []).filter(token => !cancelled.has(token))
}

/**
 * 检定结束后的标记后果（behavior.afterTest 读；只返回 rider 名称，幂等）。
 *   · cultist / elderthing：只有检定失败才结算（卡面写「如果你检定失败」）；
 *   · tablet：只在对「有巡逻关键词的敌人」发起攻击的那次检定后结算（见 behavior 的 target 读取）。
 */
export function dogsOfWarAfterTest(state, inv, result, context = null) {
  if (!inv || !result) return []
  const table = meaningsFor(state)
  const failed = result.success === false
  const test = context?.test || {}
  const target = test.target || null
  const isPatrolAttack = test.actionKind === 'fight' && Boolean(target && target.patrol)
  const riders = []
  for (const token of resolvedTokens(result, context)) {
    const entry = table[token]
    if (!entry) continue
    if (entry.onFail && failed) riders.push(entry.onFail)
    if (entry.attackRider && isPatrolAttack) riders.push(entry.attackRider)
  }
  return [...new Set(riders)]
}

/** 混乱标记表的中文说明（指南/特别规则用）。 */
export function tokenMeaningLines(meanings = standardTable) {
  return Object.entries(meanings).map(([token, entry]) => `[${token}] ${entry.text}`)
}
