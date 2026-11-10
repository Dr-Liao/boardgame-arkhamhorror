// 八循环《绯红密钥》P2 原语：绯红密钥（Scarlet Keys）与变换（Shift）。
//
// 覆盖 P1 原语目录：
//   · new.scarletKeyEntity  —— 密钥实体：物理 id、稳定/动荡面、持有者（调查员/敌人/未持有）
//   · new.keyShift          —— Shift 结算：翻面、每轮一次/强制触发
//   · new.keyBinding        —— 绑定/夺取/转移（调查员 ↔ 敌人）
//   · new.keySteal          —— 敌人夺走密钥（状况报告 ζ）与圣所追回
//   · extend.physicalFaces  —— 双面密钥的印刷面切换（复用 physical-faces 的配对校验）
//   · extend.records        —— 密钥持有/面记入战役扩展（跨关持久）
//   · extend.choices        —— 密钥转移/变换的合法动作载荷
//
// 状态：战役级 `campaign.tsk.keys = { version: 1, keys: { [id]: {
//   id, stableFace, unstableFace, stable: bool, bearer: { type: 'none'|'investigator'|'enemy', seat?, enemyId? },
//   shiftedRound: int|null } }, shifts: { [round]: number } }`
//
// 口径：
//   · 密钥不是场景在场实体：不写 state.assets/enemies/locations，只登记持有关系；
//   · 面切换只接受「物理卡面配对」校验（stableFace/unstableFace 必须由内容层在 initialize 时给出且不同）；
//   · Shift 每轮一次：`shifts[round]` 记录该轮已变换次数，`shiftKey` 默认拒绝第 2 次（强制触发见 force）。
import { assertTskFields, assertTskObject, assertCodeList, tskCampaignState } from './tsk-state.js'
import { nextPrintedFace } from './physical-faces.js'

export const KEY_STATE_VERSION = 1
export const KEY_BEARER_TYPES = Object.freeze(['none', 'investigator', 'enemy'])

function stateOf(state, create = false) {
  const data = tskCampaignState(state, create)
  if (!data) return null
  if (create) {
    data.keys ||= { version: KEY_STATE_VERSION, keys: {}, shifts: {} }
    return data.keys
  }
  return data.keys || null
}

function keyRecord(state, id) {
  const record = stateOf(state)?.keys?.[id]
  if (!record) throw new RangeError(`未知绯红密钥 ${JSON.stringify(id)}`)
  return record
}

/**
 * 初始化密钥集合（战役 setup；重复初始化同名 id 拒绝）。
 * specs: [{ id, stableFace, unstableFace, bearer? }]
 *   · id 是内容层的稳定标识（通常用物理卡号字符串，但引擎不认具体卡号）；
 *   · stableFace/unstableFace 是可打印面标识（字符串），必须不同；
 *   · bearer 缺省为 none。
 */
export function initializeScarletKeys(state, specs) {
  if (!Array.isArray(specs) || !specs.length) throw new TypeError('密钥初始化需要至少一把密钥')
  const container = stateOf(state, true)
  if (Object.keys(container.keys).length) throw new Error('绯红密钥已经初始化')
  const records = specs.map(spec => {
    assertTskObject(spec, '密钥定义')
    assertTskFields(spec, ['id', 'stableFace', 'unstableFace', 'bearer'], '密钥定义')
    if (typeof spec.id !== 'string' || !spec.id) throw new TypeError('密钥 id 无效')
    if (typeof spec.stableFace !== 'string' || !spec.stableFace) throw new TypeError('密钥稳定面无效')
    if (typeof spec.unstableFace !== 'string' || !spec.unstableFace) throw new TypeError('密钥动荡面无效')
    if (spec.stableFace === spec.unstableFace) throw new TypeError('稳定面与动荡面不能相同')
    const bearer = normalizeBearer(state, spec.bearer ?? { type: 'none' })
    return { id: spec.id, stableFace: spec.stableFace, unstableFace: spec.unstableFace, stable: true, bearer, shiftedRound: null }
  })
  const ids = new Set()
  for (const record of records) {
    if (ids.has(record.id)) throw new TypeError(`密钥 id 重复：${record.id}`)
    ids.add(record.id)
  }
  for (const record of records) container.keys[record.id] = record
  return records.map(record => ({ ...record, bearer: { ...record.bearer } }))
}

function normalizeBearer(state, bearer) {
  assertTskObject(bearer, '密钥持有者')
  assertTskFields(bearer, ['type', 'seat', 'enemyId'], '密钥持有者')
  if (!KEY_BEARER_TYPES.includes(bearer.type)) throw new TypeError('密钥持有者类型必须是 none/investigator/enemy')
  if (bearer.type === 'investigator') {
    if (!Number.isSafeInteger(bearer.seat) || !state.investigators?.[bearer.seat]) throw new RangeError('密钥持有座位无效')
    return { type: 'investigator', seat: bearer.seat }
  }
  if (bearer.type === 'enemy') {
    if (typeof bearer.enemyId !== 'string' || !bearer.enemyId) throw new TypeError('密钥持有敌人 id 无效')
    if (!(state.enemies || []).some(enemy => enemy.id === bearer.enemyId)) throw new RangeError('密钥持有敌人不在场')
    return { type: 'enemy', enemyId: bearer.enemyId }
  }
  return { type: 'none' }
}

/** 全部密钥（只读副本）；不初始化容器。 */
export function scarletKeys(state) {
  return Object.values(stateOf(state)?.keys || {}).map(record => ({ ...record, bearer: { ...record.bearer } }))
}

/** 单把密钥（只读副本）。 */
export function scarletKey(state, id) {
  const record = keyRecord(state, id)
  return { ...record, bearer: { ...record.bearer } }
}

/** 当前朝向的印刷面（稳定面或动荡面）。 */
export function keyFace(state, id) {
  const record = keyRecord(state, id)
  return record.stable ? record.stableFace : record.unstableFace
}

/**
 * Shift（变换）：结算当前面效果后翻面。规则：每轮每把密钥只能被变换一次（强制触发用 force=true 表示
 * 由剧情强制翻面，不受「每轮一次」限制，但仍记录次数）。
 * 返回 { id, from, to, stable }。
 */
export function shiftKey(state, id, { round = null, force = false } = {}) {
  const container = stateOf(state, true)
  const record = keyRecord(state, id)
  const currentRound = Number.isSafeInteger(round) ? round : Number.isSafeInteger(state.round) ? state.round : 0
  if (!force) {
    if (record.shiftedRound === currentRound) throw new Error('该密钥本轮已经变换过')
  }
  const from = record.stable ? record.stableFace : record.unstableFace
  record.stable = !record.stable
  const to = record.stable ? record.stableFace : record.unstableFace
  record.shiftedRound = currentRound
  container.shifts[currentRound] = (container.shifts[currentRound] || 0) + 1
  // extend.physicalFaces 读点：翻面必须经印刷面配对校验（防止内容层把两个面配错）。
  nextPrintedFace(state, { from, faces: [record.stableFace, record.unstableFace] })
  return { id, from, to, stable: record.stable }
}

/** 该密钥本轮是否已变换（面板/合法动作读点）。 */
export function keyShiftedThisRound(state, id, round = null) {
  const record = keyRecord(state, id)
  const currentRound = Number.isSafeInteger(round) ? round : Number.isSafeInteger(state.round) ? state.round : 0
  return record.shiftedRound === currentRound
}

/** 绑定/转移：把密钥交给某个持有者（调查员或敌人），返回旧的持有者。 */
export function bindKey(state, id, bearer) {
  const record = keyRecord(state, id)
  const previous = { ...record.bearer }
  record.bearer = normalizeBearer(state, bearer)
  return previous
}

/** 夺取（敌人盗走/调查员夺回）：语义与 bindKey 相同，单独命名便于审计与内容层阅读。 */
export function stealKey(state, id, bearer) {
  const record = keyRecord(state, id)
  if (record.bearer.type !== 'none' && record.stable !== true) {
    // 被夺走的密钥按参考实现回到稳定面（敌人持有时为动荡面；回到调查员/未持有时为稳定面）。
    record.stable = true
  }
  const previous = bindKey(state, id, bearer)
  // 敌人夺走后翻到动荡面；夺回/绑定调查员回稳定面（参考 Key.hs stability 与持有者绑定）。
  record.stable = record.bearer.type === 'enemy' ? false : true
  return { from: previous, to: { ...record.bearer }, stable: record.stable }
}

/** 某持有者当前持有的密钥 id 列表。 */
export function keysHeldBy(state, bearer) {
  assertTskObject(bearer, '持有者')
  const all = stateOf(state)?.keys || {}
  return Object.values(all)
    .filter(record => record.bearer.type === bearer.type
      && (bearer.type !== 'investigator' || record.bearer.seat === bearer.seat)
      && (bearer.type !== 'enemy' || record.bearer.enemyId === bearer.enemyId))
    .map(record => record.id)
}

/** 密钥合法动作载荷（extend.choices）：转移目标/变换可用性，供服务端选择事务与 P4 面板。 */
export function keyChoices(state, id) {
  const record = keyRecord(state, id)
  return {
    id,
    bearer: { ...record.bearer },
    face: record.stable ? record.stableFace : record.unstableFace,
    canShift: !keyShiftedThisRound(state, id),
    transferTargets: [
      ...(state.investigators || []).map(inv => ({ type: 'investigator', seat: inv.seat })),
      ...(state.enemies || []).map(enemy => ({ type: 'enemy', enemyId: enemy.id })),
    ],
  }
}

/** 读档校验：密钥容器形状（存在才校验；持有者必须有效）。 */
export function validateTskKeys(state, value = stateOf(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'keys', 'shifts'], '绯红密钥状态')
  if (value.version !== KEY_STATE_VERSION) throw new TypeError(`不支持的绯红密钥版本 ${value.version}`)
  assertTskObject(value.keys, '绯红密钥表')
  for (const [id, record] of Object.entries(value.keys)) {
    if (typeof id !== 'string' || !id || id !== record.id) throw new TypeError('绯红密钥 id 不一致')
    assertTskFields(record, ['id', 'stableFace', 'unstableFace', 'stable', 'bearer', 'shiftedRound'], '绯红密钥记录')
    if (typeof record.stableFace !== 'string' || typeof record.unstableFace !== 'string' || record.stableFace === record.unstableFace) {
      throw new TypeError('绯红密钥面配对无效')
    }
    if (typeof record.stable !== 'boolean') throw new TypeError('绯红密钥朝向无效')
    if (record.shiftedRound != null && (!Number.isSafeInteger(record.shiftedRound) || record.shiftedRound < 0)) throw new TypeError('绯红密钥变换轮次无效')
    normalizeBearer(state, record.bearer)
  }
  assertTskObject(value.shifts, '绯红密钥变换计数')
  for (const count of Object.values(value.shifts)) if (!Number.isSafeInteger(count) || count < 0) throw new TypeError('绯红密钥变换计数无效')
  return true
}
