// 如履薄冰（On Thin Ice · 09609）· 混乱标记取值与后果。
//
// 参考：09609 卡面两档 + locale `scenarios/onThinIce.json#tokens`。
//   [skull]      简单/普通：-X，X = 场上[[危险]]诡计的数量；困难/专家：-(X+1)
//   [cultist]    简单/普通：-4，检定失败后选择手中一张非弱点卡放在一边作为空洞；
//                困难/专家：-5，**直接**（不要求失败）选择一张非弱点手牌作为空洞
//   [tablet]     简单/普通：-2（虚空奇美拉在你地点时 -5）；困难/专家：-3，虚空奇美拉在你地点时改为自动失败
//   [elderthing] 简单/普通：-3，检定失败后查看牌库顶一张，不是弱点就作为空洞；
//                困难/专家：-4，**直接**查看牌库顶一张，不是弱点就作为空洞
//
// 口径（与《血色阴影》同一套）：
//   · 标记**数值**由 behavior.resolveChaosToken 通过本文件的分支函数给出（X 依赖场上[[危险]]诡计数量、
//     tablet 依赖虚空奇美拉位置），静态 tokenMeanings 只给文字与 AI 预估用的基准值；
//   · 失败/`直接`之后的空洞由 behavior.afterTest 调 onThinIceAfterTest 取 rider 列表，再统一结算；
//   · 空洞只经 `api.mechanics.tsk.hollow.hollow`（P2 原语）写入，不新造状态字段。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

export const VOID_CHIMERA_CODES = Object.freeze(['09626', '09627', '09628', '09629', '09630'])
export const TRUE_FORM_CODE = '09626'

const standardTable = Object.freeze({
  skull: { text: '-X。X为场上[[危险]]诡计的数量。', delta: 0, dynamic: 'hazardTreacheries' },
  cultist: {
    text: '-4。如果你检定失败，选择你手中一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。',
    delta: -4, onFail: 'hollowFromHand',
  },
  tablet: { text: '-2 (如果虚空奇美拉在你的地点，改为-5)。', delta: -2, dynamic: 'chimeraAtLocation' },
  elderthing: {
    text: '-3。如果你检定失败，查看你牌库顶的卡牌。如果不是弱点，将其放在一边，位于场外，作为一个空洞。',
    delta: -3, onFail: 'hollowFromDeckTop',
  },
})
const hardTable = Object.freeze({
  skull: { text: '-X。X为场上[[危险]]诡计的数量+1。', delta: 0, dynamic: 'hazardTreacheriesPlusOne' },
  cultist: {
    text: '-5。选择你手中一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。',
    delta: -5, always: 'hollowFromHand',
  },
  tablet: { text: '-3。如果虚空奇美拉在你的地点，改为你自动失败。', delta: -3, dynamic: 'chimeraAutoFail' },
  elderthing: {
    text: '-4。查看你牌库顶的卡牌。如果不是弱点，将其放在一边，位于场外，作为一个空洞。',
    delta: -4, always: 'hollowFromDeckTop',
  },
})

export const ON_THIN_ICE_TOKEN_MEANINGS = Object.freeze({
  easy: standardTable, standard: standardTable, hard: hardTable, expert: hardTable,
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const meaningsFor = state => (isHardSide(state) ? hardTable : standardTable)

const codeOf = card => card?.originalCode || card?.code || card
const hazard = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'hazard')

/** 场上[[危险]]诡计：威胁区 + 密谋牌库旁 + 地点附属 + 敌人附属（去重按实例 id）。 */
export function hazardTreacheriesInPlay(state) {
  const seen = new Set()
  const out = []
  const consider = card => {
    const code = codeOf(card)
    if (!code || seen.has(card?.id || code)) return
    if (!hazard(code)) return
    seen.add(card?.id || code)
    out.push(code)
  }
  for (const inv of state?.investigators || []) for (const card of inv.threat || []) consider(card)
  for (const card of state?.agendaAside || []) consider(card)
  for (const loc of state?.locations || []) for (const card of loc.attachments || []) consider(card)
  for (const enemy of state?.enemies || []) for (const card of enemy.attachments || []) consider(card)
  return out
}

/** 虚空奇美拉（任一形态）是否在该调查员所在地点。 */
export function voidChimeraAtLocation(state, inv) {
  const locationId = inv?.location
  if (!locationId) return false
  return (state?.enemies || []).some(enemy => !enemy.defeated && enemy.location === locationId
    && VOID_CHIMERA_CODES.includes(String(codeOf(enemy))))
}

/**
 * 逐标记取值：`{ delta, autoFail?, rider? }`；未声明的标记交回引擎默认表（null）。
 * rider 只是「本标记要求结算哪种空洞」的稳定字符串，真正写入在 behavior.afterTest。
 */
export function onThinIceChaosToken(state, inv, token) {
  const table = meaningsFor(state)
  const entry = table[token]
  if (!entry) return null
  const hazardCount = hazardTreacheriesInPlay(state).length
  if (token === 'skull') {
    const value = -(hazardCount + (isHardSide(state) ? 1 : 0))
    // `-0` 与 `0` 在 deepEqual 里不相等：归一到 0。
    return { delta: value === 0 ? 0 : value }
  }
  if (token === 'tablet') {
    if (!isHardSide(state)) {
      return { delta: voidChimeraAtLocation(state, inv) ? -5 : Number(entry.delta) }
    }
    return voidChimeraAtLocation(state, inv)
      ? { delta: Number(entry.delta), autoFail: true }
      : { delta: Number(entry.delta) }
  }
  return { delta: Number(entry.delta) }
}

/** 本次检定实际计入的标记（去掉被取消的）。 */
function resolvedTokens(result) {
  const cancelled = new Set(result?.cancelledTokens || [])
  return (result?.drawn || []).filter(token => !cancelled.has(token))
}

/**
 * 检定结束后的标记后果（behavior.afterTest 读；只返回 rider 名称，幂等）。
 *   · 简单/普通：只有检定失败才结算 cultist / elderthing 的空洞；
 *   · 困难/专家：cultist / elderthing 一律结算（卡面没有「如果检定失败」）。
 */
export function onThinIceAfterTest(state, inv, result) {
  if (!inv || !result) return []
  const table = meaningsFor(state)
  const hard = isHardSide(state)
  const failed = result.success === false
  const riders = []
  for (const token of resolvedTokens(result)) {
    const entry = table[token]
    if (!entry) continue
    if (entry.always) riders.push(entry.always)
    else if (entry.onFail && failed) riders.push(entry.onFail)
  }
  return [...new Set(riders)]
}

export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)

/** 迷你卡 kind → 中文名（揭露/投影提示用；诱饵按副标题）。 */
export const MINI_KIND_LABELS = Object.freeze({
  VoidChimeraTrueForm: '虚空奇美拉（真实形态）',
  DecoyVoidChimeraFellbeak: '虚空奇美拉（凶残巨喙）',
  DecoyVoidChimeraEarsplitter: '虚空奇美拉（震耳欲聋）',
  DecoyVoidChimeraGorefeaster: '虚空奇美拉（尤嗜鲜血）',
  DecoyVoidChimeraFellhound: '虚空奇美拉（凶狠猎犬）',
  Decoy: '诱饵',
})
export const miniKindLabel = kind => MINI_KIND_LABELS[kind] || String(kind)
