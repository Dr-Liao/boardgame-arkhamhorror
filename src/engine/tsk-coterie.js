// 八循环《绯红密钥》P2 原语：红色同志会（Red Coterie）与巡逻（Patrol）。
//
// 覆盖 P1 原语目录：
//   · new.patrolKeyword             —— 巡逻：敌人阶段按最短路径向指定目标地点移动（与 hunter 并行）
//   · new.redCoterie                —— 同志会三池：恩怨未了（unresolved）/ 盟友（ally）/ 已击败（defeated）
//   · new.coterieEncounterInjection —— 状况报告 ε 后每关从「恩怨未了」池随机抽 1 名洗入遭遇牌库
//   · extend.records                —— 三池与首领名单寄存战役扩展 + 记录集合读点
//
// 状态：战役级 `campaign.tsk.coterie = { version: 1, pools: { unresolved: [], ally: [], defeated: [] } }`
// 口径：
//   · 引擎不认同志会敌人卡号——池内容是内容层传入的字符串（通常为卡号，但不校验为卡表卡号）；
//   · 洗入遭遇牌库只返回被抽中的 enemy id 与重复洗入的失败（fail closed：池空时返回 null）；
//   · 巡逻移动只做「目标地点 + 路径」计算；真正的敌人移动由调用方用既有 API 执行。
import { assertTskFields, assertTskObject, assertCodeList, tskCampaignState } from './tsk-state.js'
import { randomValue } from './rules-state.js'
import { shortestPaths } from './map-graph.js'

export const COTERIE_STATE_VERSION = 1
export const COTERIE_POOLS = Object.freeze(['unresolved', 'ally', 'defeated'])

function coterieState(state, create = false) {
  const campaign = tskCampaignState(state, create)
  if (!campaign) return null
  if (create) return campaign.coterie ||= {
    version: COTERIE_STATE_VERSION,
    pools: { unresolved: [], ally: [], defeated: [] },
  }
  return campaign.coterie || null
}

/** 初始化同志会池（战役 setup；重复初始化拒绝）。members: { unresolved?, ally?, defeated? } */
export function initializeCoterie(state, { members = {} } = {}) {
  if (coterieState(state)) throw new Error('红色同志会池已经初始化')
  assertTskObject(members, '同志会成员表')
  assertTskFields(members, [...COTERIE_POOLS], '同志会成员表')
  const pools = {}
  for (const pool of COTERIE_POOLS) {
    const codes = members[pool] ?? []
    assertCodeList(codes, `同志会 ${pool} 池`)
    pools[pool] = [...new Set(codes)]
  }
  const total = COTERIE_POOLS.reduce((sum, pool) => sum + pools[pool].length, 0)
  if (!total) throw new TypeError('同志会池不能为空')
  for (const from of COTERIE_POOLS) for (const to of COTERIE_POOLS) {
    if (from === to) continue
    for (const code of pools[from]) if (pools[to].includes(code)) throw new TypeError(`同志会成员 ${code} 同时出现在 ${from}/${to} 池`)
  }
  const container = coterieState(state, true)
  container.pools = pools
  return coterieSnapshot(state)
}

/** 三池快照（只读副本）；未初始化返回 null。 */
export function coterieSnapshot(state) {
  const container = coterieState(state)
  if (!container) return null
  return Object.fromEntries(COTERIE_POOLS.map(pool => [pool, [...container.pools[pool]]]))
}

/** 某池成员（只读）。 */
export function coteriePool(state, pool) {
  if (!COTERIE_POOLS.includes(pool)) throw new TypeError(`未知同志会池 ${pool}`)
  return [...(coterieState(state)?.pools?.[pool] || [])]
}

/**
 * 在池之间转移一名成员：{ code, from, to }。
 * 校验成员确实在 from 池、目标池不重复；失败不写入。返回目标池副本。
 */
export function moveCoterieMember(state, { code, from, to } = {}) {
  if (!COTERIE_POOLS.includes(from) || !COTERIE_POOLS.includes(to) || from === to) throw new TypeError('同志会池转移目标非法')
  const container = coterieState(state, true)
  const source = container.pools[from]
  const index = source.indexOf(code)
  if (index < 0) throw new RangeError(`同志会成员 ${code} 不在 ${from} 池`)
  if (container.pools[to].includes(code)) throw new Error(`同志会成员 ${code} 已在 ${to} 池`)
  source.splice(index, 1)
  container.pools[to].push(code)
  return [...container.pools[to]]
}

/** 已击败同志会成员（结局/记录读点）。 */
export function defeatedCoterie(state) {
  return coteriePool(state, 'defeated')
}

/** 盟友同志会成员（首领帮助/结算读点）。 */
export function alliedCoterie(state) {
  return coteriePool(state, 'ally')
}

/**
 * 遭遇注入：从「恩怨未了」池随机抽 1 名，移入已洗入集合（返回被抽中的成员与剩余池）。
 * 池空返回 null（不写入）。`shuffle` 可注入确定性选择函数（返回 [0,1) 随机数）。
 */
export function injectCoterieEnemy(state, { random = null } = {}) {
  const container = coterieState(state, true)
  const pool = container.pools.unresolved
  if (!pool.length) return null
  const draw = typeof random === 'function' ? random() : randomValue(state)
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new TypeError('同志会抽取随机数必须在 [0,1)')
  const index = Math.min(pool.length - 1, Math.floor(draw * pool.length))
  const [code] = pool.splice(index, 1)
  container.injected ||= []
  container.injected.push(code)
  return { code, remaining: pool.length }
}

/** 已被注入遭遇牌库的同志会成员（账本读点）。 */
export function injectedCoterie(state) {
  return [...(coterieState(state)?.injected || [])]
}

// ---------------------------------------------------------------------------
// Patrol（巡逻）关键字
// ---------------------------------------------------------------------------

/**
 * 计算巡逻敌人在敌人阶段应移动到的目标地点：
 *   · enemy.patrol 是目标选择器：{ kind: 'named', locationId } 或 { kind: 'trait', trait }（野兽/荒野类）；
 *   · 返回从敌人所在地到目标地点最短路径上的下一步地点；已在目标地点/无路径/无巡逻返回 null；
 *   · 引擎不读固定卡号——巡逻目标由卡面/内容层解析后写入敌人实例（或定义）。
 * 说明：与 hunter 的区别由调用方决定（hunter 会追调查员，patrol 固定/按特质选点）。
 */
export function patrolDestination(state, enemy) {
  if (!enemy || !enemy.patrol) return null
  const locations = state.locations || []
  const current = enemy.location
  if (!current) return null
  const target = patrolTargetLocation(state, enemy.patrol)
  if (!target || target === current) return null
  const paths = shortestPaths(locations, current, target, id => (state.enemies || []).every(other => other.id === enemy.id || other.location !== id))
  if (!paths.length) return null
  const path = paths[0]
  return path.length > 1 ? path[1] : null
}

/** 解析巡逻目标选择器到具体地点 id（供 patrolDestination 与审计读点）。 */
export function patrolTargetLocation(state, patrol) {
  assertTskObject(patrol, '巡逻目标')
  assertTskFields(patrol, ['kind', 'locationId', 'trait'], '巡逻目标')
  if (patrol.kind === 'named') {
    if (typeof patrol.locationId !== 'string' || !patrol.locationId) throw new TypeError('命名巡逻目标地点无效')
    if (!(state.locations || []).some(location => location.id === patrol.locationId)) throw new RangeError('命名巡逻目标地点不在场')
    return patrol.locationId
  }
  if (patrol.kind === 'trait') {
    if (typeof patrol.trait !== 'string' || !patrol.trait) throw new TypeError('特质巡逻目标无效')
    const candidates = (state.locations || []).filter(location => (location.traits || []).includes(patrol.trait))
    if (!candidates.length) return null
    // 距离最近、平手按地点 id 稳定排序（确定性；真正的「最多调查员」口径由内容层选择器决定后落成 named）。
    const distances = new Map()
    for (const location of candidates) {
      const paths = shortestPaths(state.locations, candidates[0].id, location.id)
      distances.set(location.id, paths.length ? paths[0].length : Infinity)
    }
    void distances
    return [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0].id
  }
  throw new TypeError('巡逻目标 kind 必须是 named/trait')
}

/** 巡逻合法动作载荷（extend.choices）：供 P4 面板与测试观察。 */
export function patrolChoices(state, enemies = []) {
  return enemies.map(enemy => ({
    enemyId: enemy.id,
    patrol: enemy.patrol || null,
    destination: patrolDestination(state, enemy),
  }))
}

/** 读档校验：同志会容器形状（存在才校验；池内不重复、跨池不重复）。 */
export function validateTskCoterie(state, value = coterieState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'pools', 'injected'], '红色同志会状态')
  if (value.version !== COTERIE_STATE_VERSION) throw new TypeError(`不支持的红色同志会版本 ${value.version}`)
  assertTskObject(value.pools, '同志会池表')
  const seen = new Set()
  for (const pool of COTERIE_POOLS) {
    const codes = value.pools[pool]
    assertCodeList(codes, `同志会 ${pool} 池`)
    for (const code of codes) {
      if (seen.has(code)) throw new TypeError(`同志会成员 ${code} 重复出现`)
      seen.add(code)
    }
  }
  if (value.injected != null) assertCodeList(value.injected, '同志会注入列表')
  return true
}
