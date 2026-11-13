// 血色阴影（Sanguine Shadows · 09545）· 混乱标记取值与后果。
//
// 参考：09545 卡面两档 + locale `scenarios/sanguineShadows.json#tokens`。
//   [skull]     -X（困难/专家 -(X+1)），X = 冒险参考卡上的标的数量
//   [cultist]   -5 / -7，检定失败且低于难度至少 2 点时：把你所在地点与每个连接地点的所有隐匿迷你卡牌
//               正面朝下混洗，然后随机放回它们刚才的位置
//   [tablet]    -1 / -2，取消投入本次技能检定的每张卡牌的效果和图标
//   [elderthing] -2 / -3，检定失败时必须选择：在当前密谋上放 1 个毁灭，或最近的[[结社]]敌人攻击你（即便在阴影中）
//
// 口径：
//   · 标记的**数值**由 behavior.resolveChaosToken 通过本文件的分支函数给出（X 依赖标的数量，
//     静态 tokenMeanings 无法表达），静态表只给文字与 AI 预估用的基准值；
//   · 失败后的连带效果由 behavior.afterTest 调 sanguineShadowsAfterTest 取 rider 列表，再统一结算。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

export const TARGET_TOKEN = 'target'
export const COTERIE_TRAIT = 'Coterie'

const standardTable = Object.freeze({
  skull: { text: '-X。X为本卡牌上的标的数量。', delta: 0, dynamic: 'targets' },
  cultist: { text: '-5。如果你检定失败且低于难度至少2点，将你所在地点和每个连接地点的所有隐匿迷你卡牌正面朝下混洗，然后随机放置到其刚才位置。', delta: -5, rider: 'reshuffleConcealedOnFail' },
  tablet: { text: '-1。取消投入本次技能检定的每张卡牌上的效果和图标。', delta: -1, rider: 'cancelCommitted' },
  elderthing: { text: '-2。如果你检定失败，你必须在当前密谋上放置1个毁灭标记，或最近的[[结社]]敌人攻击你(即便其在阴影中)。', delta: -2, rider: 'doomOrCoterie' },
})
const hardTable = Object.freeze({
  skull: { text: '-X。X为本卡牌上的标的数量+1。', delta: 0, dynamic: 'targetsPlusOne' },
  cultist: { text: '-7。如果你检定失败且低于难度至少2点，将你所在地点和每个连接地点的所有隐匿迷你卡牌正面朝下混洗，然后随机放置到其刚才位置。', delta: -7, rider: 'reshuffleConcealedOnFail' },
  tablet: { text: '-2。取消投入本次技能检定的每张卡牌上的效果和图标。', delta: -2, rider: 'cancelCommitted' },
  elderthing: { text: '-3。如果你检定失败，你必须在当前密谋上放置1个毁灭标记，或最近的[[结社]]敌人攻击你(即便其在阴影中)。', delta: -3, rider: 'doomOrCoterie' },
})

export const SANGUINE_SHADOWS_TOKEN_MEANINGS = Object.freeze({
  easy: standardTable, standard: standardTable, hard: hardTable, expert: hardTable,
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const meaningsFor = state => (isHardSide(state) ? hardTable : standardTable)

/** 冒险参考卡（09545）上的标的数量：由章节行为写入；缺失按 0。 */
export function referenceTargets(state) {
  const value = Number(state?.scenarioFlags?.sanguineShadows?.referenceTargets)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * 逐标记取值：`{ delta, autoFail?, cancelCommitted?, rider? }`；未声明的标记交回引擎默认表（null）。
 * 与 COTE 的 `cityOfTheElderThingsChaosToken` 同口径：只给数值与 rider，真正扣伤害/放毁灭在章节层。
 */
export function sanguineShadowsChaosToken(state, inv, token) {
  void inv
  const table = meaningsFor(state)
  const entry = table[token]
  if (!entry) return null
  const targets = referenceTargets(state)
  if (token === 'skull') return { delta: 0 - targets - (isHardSide(state) ? 1 : 0) }
  if (token === 'tablet') return { delta: entry.delta, cancelCommitted: true, rider: 'cancelCommitted' }
  return { delta: entry.delta, rider: entry.rider }
}

/** 本次检定实际计入的标记（去掉被取消的）。 */
function resolvedTokens(result) {
  const cancelled = new Set(result?.cancelledTokens || [])
  return (result?.drawn || []).filter(token => !cancelled.has(token))
}

/**
 * 检定结束后的标记后果（behavior.afterTest 读；幂等，只返回 rider 名称）。
 * `failedBy` 取自结果（难度 - 技能值）；失败且低于难度至少 2 点才触发 cultist。
 */
export function sanguineShadowsAfterTest(state, inv, result) {
  if (!inv || !result) return []
  const table = meaningsFor(state)
  const failedBy = Number.isFinite(result.failedBy) ? Number(result.failedBy)
    : Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))
  const riders = []
  for (const token of resolvedTokens(result)) {
    const entry = table[token]
    if (!entry?.rider || token === 'tablet') continue
    if (token === 'cultist') {
      if (result.success === false && failedBy >= 2) riders.push('reshuffleConcealed')
      continue
    }
    if (token === 'elderthing' && result.success === false) riders.push('doomOrCoterie')
  }
  return [...new Set(riders)]
}

export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
