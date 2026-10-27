// location-traits.js · 地点特性原语（运行期授予 + 特性连接规则）
//
// 有些剧本与卡牌把地点的「特性」当作动态属性使用：
//   · 卡牌效果让一个地点获得 / 失去某个特性（如 03141 皮博迪先生让地点获得 [[通道]]）；
//   · 阶段规则声明「带某特性的地点互相连接」（如 03126 誓约的「带有[[通道]]特性的地点互相连接」）。
// 两者都是通用机制，不属于任何一章：本模块把它们收敛成引擎原语，内容层只声明数据 / 调 api。
//
// 状态形状（只在真正用到的关卡出现，不给其它关卡新增存档字段）：
//   location.traitGrants = { Passageway: ['peabody', 'hidden-library-enemy-moving'] }
//     —— 运行期授予按来源记账：同一特性可由多个来源同时授予，撤销一个来源不会误删其它来源；
//        印刷特性（关卡定义 / 地点变体 / 卡面）永远不删。授予时若实例上还没有该特性，
//        会补进 location.traits，让所有现有规则读点（移动、敌人、剧情钩子）自然看到它。
//   state.locationTraitLinks = {
//     rules: [{ id: 'act:03126:Passageway', trait: 'Passageway' }],
//     added: [['meetingRoom', 'secondLibrary']],
//   }
//     —— 当前生效的特性连接规则（来源是当前幕 / 密谋条目的 actRule.locationTraitLinks /
//        agendaRule.locationTraitLinks），以及引擎自己加过的**有向**连接。
//        规则失效时只撤销 added 里记录过的边：印刷连接（含单向连接）不受影响，
//        重复同步幂等。added 排序固定，保证存档/重放指纹稳定。
//
// 同步触发点（引擎自动调用，见 engine.js 的 commonDeps 接线）：
//   · 幕 / 密谋进出（advanceAct / advanceAgenda）——规则随阶段生效或失效；
//   · 地点入场 / 移出（placeLocation / removeLocation）——新地点加入或离开连通网络；
//   · 特性授予 / 撤销（addLocationTrait / removeLocationTrait）——皮博迪、敌人移动等。
//
// 读点：观察投影用 grantedTraitsOf(location) 生成 grantedTraits / grantedTraitsZh（浏览器不读引擎）。

const normalizeTrait = trait => String(trait ?? '').trim()
const sameTrait = (left, right) => normalizeTrait(left).toLowerCase() === normalizeTrait(right).toLowerCase()
const sortedStrings = list => [...list].sort((left, right) => String(left).localeCompare(String(right)))
const pairCompare = (left, right) => String(left[0]).localeCompare(String(right[0]))
  || String(left[1]).localeCompare(String(right[1]))

/** 地点实例上「当前被授予」的特性（不含印刷特性）；投影层唯一读点。 */
export function grantedTraitsOf(location) {
  const grants = location?.traitGrants
  if (!grants || typeof grants !== 'object') return []
  return sortedStrings(Object.keys(grants).filter(trait => Array.isArray(grants[trait]) && grants[trait].length > 0))
}

/** 地点实例当前是否带某特性（印刷 + 授予都算）。 */
export function locationHasTrait(location, trait) {
  return (Array.isArray(location?.traits) ? location.traits : []).some(value => sameTrait(value, trait))
}

export function createLocationTraits(deps) {
  const { registeredEntry, cardDef } = deps
  const directedKey = (from, to) => `${from}\u0000${to}`

  // 内容层传实例或地点 id 都接受；传实例时优先取 state 里的同一实例，避免拿到过期副本。
  function resolveLocation(state, location) {
    if (!location) return null
    if (typeof location === 'string') {
      return (state.locations || []).find(item => item.id === location) || null
    }
    const id = location.id
    if (!id) return location
    return (state.locations || []).find(item => item.id === id) || location
  }

  // 印刷特性来自关卡定义 / 地点变体 / 卡面数据；授予撤销只撤销「不是印刷」的那一份。
  function isPrintedLocationTrait(state, location, trait) {
    const definitions = []
    const scenarioLocation = state.scenario?.locations?.[location.id]
    if (scenarioLocation) definitions.push(scenarioLocation)
    const variant = state.locationVariants?.[location.id]
    if (variant) definitions.push(variant)
    const card = cardDef?.(location.originalCode || location.code)
    if (card) definitions.push(card)
    return definitions.some(definition =>
      (Array.isArray(definition?.traits) ? definition.traits : []).some(value => sameTrait(value, trait)))
  }

  // 当前阶段（幕 / 密谋）声明的特性连接规则。内容层只需要在条目里写数据：
  //   actRule:    { locationTraitLinks: ['Passageway'] }
  //   agendaRule: { locationTraitLinks: ['Passageway'] }
  function declaredRules(state) {
    const rules = []
    const collect = (scope, card, rule) => {
      if (!card || !rule) return
      const list = rule.locationTraitLinks
      if (!Array.isArray(list)) return
      const code = card.originalCode || card.code
      for (const item of list) {
        const trait = normalizeTrait(typeof item === 'string' ? item : item?.trait)
        if (!trait) continue
        rules.push({ id: `${scope}:${code}:${trait}`, trait })
      }
    }
    const act = state.acts?.[state.actIndex]
    if (act) collect('act', act, registeredEntry?.(act.originalCode || act.code)?.actRule)
    const agenda = state.agendas?.[state.agendaIndex]
    if (agenda) collect('agenda', agenda, registeredEntry?.(agenda.originalCode || agenda.code)?.agendaRule)
    return rules.sort((left, right) => left.id.localeCompare(right.id))
  }

  // 重算「特性连接规则」的自动连接。幂等；没有声明也没有历史记录时直接返回，不新增状态键。
  function syncLocationTraitLinks(state) {
    if (!state) return false
    const previous = state.locationTraitLinks && typeof state.locationTraitLinks === 'object'
      ? state.locationTraitLinks : null
    const rules = declaredRules(state)
    if (!rules.length && !previous) return false
    // 每条规则当前的目标边：带该特性的在场地点两两相连（双向）。
    const active = rules.map(rule => ({
      rule,
      ids: sortedStrings((state.locations || []).filter(location => locationHasTrait(location, rule.trait))
        .map(location => location.id)),
    }))
    const desired = new Set()
    const eachDesiredEdge = visit => {
      for (const { ids } of active) {
        for (let left = 0; left < ids.length; left++) {
          for (let right = left + 1; right < ids.length; right++) {
            visit(ids[left], ids[right])
            visit(ids[right], ids[left])
          }
        }
      }
    }
    eachDesiredEdge((from, to) => desired.add(directedKey(from, to)))
    const locationById = id => (state.locations || []).find(location => location.id === id)

    // 1) 撤销上一次由本规则加过、这次不再需要的边（只撤销记录过的方向，印刷连接不受影响）。
    for (const [from, to] of Array.isArray(previous?.added) ? previous.added : []) {
      if (desired.has(directedKey(from, to))) continue
      const location = locationById(from)
      if (!location || !Array.isArray(location.connections)) continue
      const index = location.connections.lastIndexOf(to)
      if (index >= 0) location.connections.splice(index, 1)
    }

    // 2) 补齐新边；added 只记录「引擎真正新增」以及「之前记录过且仍在目标集合里」的方向。
    const previousAdded = new Set((Array.isArray(previous?.added) ? previous.added : [])
      .map(([from, to]) => directedKey(from, to)))
    const nextAdded = []
    const seenAdded = new Set()
    eachDesiredEdge((from, to) => {
      const key = directedKey(from, to)
      if (seenAdded.has(key)) return
      const location = locationById(from)
      if (!location) return
      if (!Array.isArray(location.connections)) location.connections = []
      if (!location.connections.includes(to)) {
        location.connections.push(to)
        nextAdded.push([from, to])
        seenAdded.add(key)
        return
      }
      if (previousAdded.has(key)) {
        nextAdded.push([from, to])
        seenAdded.add(key)
      }
    })

    if (rules.length) {
      state.locationTraitLinks = {
        rules: rules.map(rule => ({ id: rule.id, trait: rule.trait })),
        added: nextAdded.sort(pairCompare),
      }
    } else {
      delete state.locationTraitLinks
    }
    return true
  }

  // 运行期授予特性。options.source 是来源记账（默认 'content'）；同一来源重复授予只记一次。
  function addLocationTrait(state, locationRef, trait, options = {}) {
    const location = resolveLocation(state, locationRef)
    const name = normalizeTrait(trait)
    if (!location || !name) return false
    const source = String(options.source ?? 'content')
    const grants = location.traitGrants && typeof location.traitGrants === 'object' ? location.traitGrants : {}
    // 记账键优先复用已有授予键，其次复用实例上的既有写法（印刷特性能保证大小写一致）。
    const key = Object.keys(grants).find(existing => sameTrait(existing, name))
      || (Array.isArray(location.traits) ? location.traits.find(value => sameTrait(value, name)) : null)
      || name
    const sources = Array.isArray(grants[key]) ? sortedStrings(grants[key]) : []
    if (!sources.includes(source)) sources.push(source)
    grants[key] = sortedStrings(sources)
    location.traitGrants = grants
    if (!locationHasTrait(location, name)) {
      location.traits = [...(Array.isArray(location.traits) ? location.traits : []), key]
    }
    syncLocationTraitLinks(state)
    return true
  }

  // 运行期撤销特性：只撤指定来源；没有来源后，不是印刷特性的才从实例 traits 里移除。
  function removeLocationTrait(state, locationRef, trait, options = {}) {
    const location = resolveLocation(state, locationRef)
    const name = normalizeTrait(trait)
    if (!location || !name) return false
    const grants = location.traitGrants
    if (!grants || typeof grants !== 'object') return false
    const key = Object.keys(grants).find(existing => sameTrait(existing, name))
    if (!key) return false
    const source = String(options.source ?? 'content')
    const sources = (Array.isArray(grants[key]) ? grants[key] : []).filter(item => item !== source)
    if (sources.length) {
      location.traitGrants = { ...grants, [key]: sortedStrings(sources) }
    } else {
      const rest = { ...grants }
      delete rest[key]
      if (Object.keys(rest).length) location.traitGrants = rest
      else delete location.traitGrants
      if (!isPrintedLocationTrait(state, location, key)) {
        location.traits = (Array.isArray(location.traits) ? location.traits : []).filter(value => !sameTrait(value, key))
      }
    }
    syncLocationTraitLinks(state)
    return true
  }

  /** 当前生效的特性连接规则快照（测试 / 调试 / AI 读点）；无规则时返回 null。 */
  function activeLocationTraitLinks(state) {
    return state?.locationTraitLinks || null
  }

  return {
    addLocationTrait,
    removeLocationTrait,
    syncLocationTraitLinks,
    activeLocationTraitLinks,
    grantedTraitsOf,
    locationHasTrait,
  }
}
