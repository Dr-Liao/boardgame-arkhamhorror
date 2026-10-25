// 闹鬼（Haunted）原语 —— 第四循环第 2 步 P2.1。
//
// 印刷规则（中文卡面「闹鬼 - …」）：地点上的闹鬼能力在该地点的一次调查检定失败后结算，
// 每条能力各自结算；玩家决定结算顺序；能力可以「无合法目标」而不结算；整次结算
// 可以在 `haunted` 窗口被取消（卡面把 context.cancelled 置真即可）。
// 部分剧本的混乱标记/敌人还会要求在攻击/躲避失败时结算 —— 这些由卡面显式调用
// `api.haunted(...)`，本模块只负责「结算一次/多次、按顺序、可取消、可跳过」。
//
// 本文件只做三件事，不写任何 05 卡号分支：
//   1. 把「地点闹鬼能力」规范化成数据（注册/setup 期校验，未知 kind 直接抛错）；
//   2. 从 `state` 读出某个地点此刻的闹鬼能力（印刷 + 授予，例如 05102 让每个地点获得一条）；
//   3. 结算：排序询问 → 逐条执行闭集子句（damage/horror/... /choice/script）。
//
// 数据只写纯 JSON（随存档往返）；需要场景脚本的子句用 `kind: 'script'` 交给章节 behavior
// 的 `hauntedScript` 钩子，缺少实现时记进 `state.hauntedGaps`（审计可见），不静默吞掉。

// 闭集子句词表。新增子句 = 新增通用原语，必须同时补测试与文档。
export const HAUNTED_CLAUSES = Object.freeze([
  'damage', 'horror', 'directDamage', 'directHorror', 'damageAssets',
  'loseAction', 'loseResource', 'discardRandom', 'discardChosen', 'discardAsset',
  'placeClue', 'doom', 'spawn', 'attack', 'moveTo', 'choice', 'script',
])

const AMOUNT_CLAUSES = new Set([
  'damage', 'horror', 'directDamage', 'directHorror', 'damageAssets',
  'loseAction', 'loseResource', 'discardRandom', 'discardChosen', 'discardAsset', 'placeClue',
])

const CLAUSE_KEYS = Object.freeze([
  'kind', 'amount', 'overflowHorror', 'target', 'code', 'locationId', 'nearest',
  'options', 'prompt', 'id', 'deck', 'trait',
])

const ABILITY_KEYS = Object.freeze(['id', 'text', 'effect', 'clauses'])

function fail(origin, message) {
  throw new Error(`闹鬼能力无效（${origin}）：${message}`)
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeAmount(raw, origin, { required = true } = {}) {
  if (raw == null) {
    if (required) fail(origin, '缺少 amount')
    return 1
  }
  if (!Number.isInteger(raw) || raw < 0) fail(origin, `amount 必须是非负整数（收到 ${JSON.stringify(raw)}）`)
  return raw
}

function normalizeClause(raw, origin) {
  if (!isPlainObject(raw)) fail(origin, '子句必须是对象')
  const unknown = Object.keys(raw).filter(key => !CLAUSE_KEYS.includes(key))
  if (unknown.length) fail(origin, `未知子句字段 ${unknown.join('、')}`)
  const kind = raw.kind
  if (!HAUNTED_CLAUSES.includes(kind)) fail(origin, `未知子句 ${JSON.stringify(kind)}`)
  const clause = { kind }
  if (AMOUNT_CLAUSES.has(kind)) clause.amount = normalizeAmount(raw.amount, origin)
  if (kind === 'loseResource' && raw.overflowHorror === true) clause.overflowHorror = true
  if (kind === 'doom') {
    const target = raw.target || 'agenda'
    if (!['agenda', 'location', 'enemy'].includes(target)) fail(origin, `doom.target 只能是 agenda/location/enemy（收到 ${target}）`)
    clause.target = target
    clause.amount = normalizeAmount(raw.amount, origin)
    if (raw.code != null) clause.code = String(raw.code)
  }
  if (kind === 'spawn') {
    if (typeof raw.code !== 'string' || !raw.code) fail(origin, 'spawn 需要 code')
    clause.code = raw.code
    if (raw.locationId != null) clause.locationId = String(raw.locationId)
  }
  if (kind === 'attack') {
    const target = raw.target || 'nearest'
    if (!['nearest', 'code'].includes(target)) fail(origin, `attack.target 只能是 nearest/code（收到 ${target}）`)
    clause.target = target
    if (raw.code != null) clause.code = String(raw.code)
    if (!clause.code && target === 'code') fail(origin, 'attack.target=code 需要 code')
  }
  if (kind === 'moveTo') {
    if (raw.locationId == null && raw.code == null) fail(origin, 'moveTo 需要 locationId 或 code')
    if (raw.locationId != null) clause.locationId = String(raw.locationId)
    if (raw.code != null) clause.code = String(raw.code)
  }
  if (kind === 'choice') {
    if (!Array.isArray(raw.options) || !raw.options.length) fail(origin, 'choice 需要至少一个 option')
    clause.options = Object.freeze(raw.options.map((option, index) => {
      const optionOrigin = `${origin}.options[${index}]`
      if (!isPlainObject(option)) fail(optionOrigin, '选项必须是对象')
      const id = option.id == null ? String(index) : String(option.id)
      if (!option.label) fail(optionOrigin, '选项缺少 label')
      const effect = option.effect ?? option.clauses
      return Object.freeze({ id, label: String(option.label), effect: normalizeEffect(effect, optionOrigin) })
    }))
    if (raw.prompt != null) clause.prompt = String(raw.prompt)
  }
  if (kind === 'script') {
    if (typeof raw.id !== 'string' || !raw.id) fail(origin, 'script 需要 id')
    clause.id = raw.id
    if (raw.code != null) clause.code = String(raw.code)
  }
  return Object.freeze(clause)
}

function normalizeEffect(raw, origin) {
  if (raw == null) fail(origin, '缺少 effect')
  const list = Array.isArray(raw) ? raw : [raw]
  if (!list.length) fail(origin, 'effect 不能为空')
  return Object.freeze(list.map((clause, index) => normalizeClause(clause, `${origin}.effect[${index}]`)))
}

// 一条闹鬼能力：印刷文本 + 闭集子句。`id` 用于排序/取消/日志；缺省由调用方给出序号。
export function normalizeHauntedAbility(raw, origin = 'haunted') {
  if (!isPlainObject(raw)) fail(origin, '能力必须是对象')
  const unknown = Object.keys(raw).filter(key => !ABILITY_KEYS.includes(key))
  if (unknown.length) fail(origin, `未知字段 ${unknown.join('、')}`)
  if (typeof raw.text !== 'string' || !raw.text.trim()) fail(origin, '缺少卡面文本 text')
  const effect = normalizeEffect(raw.effect ?? raw.clauses, origin)
  return Object.freeze({
    id: raw.id == null ? null : String(raw.id),
    text: raw.text.trim(),
    effect,
  })
}

// 剧本 setup 期校验：地点数据里的 haunted 数组一旦写错，在开局就失败，而不是对局中途静默失效。
export function normalizeScenarioHaunted(locations, origin = 'scenario.locations') {
  const normalized = {}
  for (const [id, location] of Object.entries(locations || {})) {
    if (!location || location.haunted == null) continue
    if (!Array.isArray(location.haunted)) fail(`${origin}[${id}].haunted`, '必须是数组')
    normalized[id] = location.haunted.map((ability, index) =>
      normalizeHauntedAbility(ability, `${origin}[${id}].haunted[${index}]`))
  }
  return normalized
}

// 正常化一条「授予的闹鬼能力」（05102 让每个地点获得「受到 1 点恐惧」一类）。
export function hauntGrant(raw, origin = 'hauntedGrant') {
  if (!isPlainObject(raw)) fail(origin, '授予必须包含 locationId 与 ability')
  const locationId = raw.locationId == null ? 'all' : String(raw.locationId)
  const ability = normalizeHauntedAbility(
    { ...(raw.ability || {}), id: raw.ability?.id ?? raw.id ?? null },
    `${origin}.ability`)
  return Object.freeze({ locationId, ability })
}

function printedAbilities(state, locationId) {
  const placed = (state.locations || []).find(location => location.id === locationId)
  const def = placed || state.scenario?.locations?.[locationId]
  if (!def?.haunted?.length) return []
  return def.haunted.map((ability, index) => {
    const normalized = isPlainObject(ability) && Array.isArray(ability.effect)
      ? ability
      : normalizeHauntedAbility(ability, `locations[${locationId}].haunted[${index}]`)
    return { ...normalized, id: normalized.id || `${locationId}#${index}`, source: 'printed' }
  })
}

// 某地点此刻的全部闹鬼能力：印刷在前、授予在后（授予保持登记顺序）。
export function hauntedAbilitiesAt(state, locationId) {
  const abilities = [...printedAbilities(state, locationId)]
  for (const [index, grant] of (state.hauntedGrants || []).entries()) {
    if (grant.locationId !== 'all' && grant.locationId !== locationId) continue
    abilities.push({ ...grant.ability, id: grant.ability.id || `grant${index}`, source: 'grant' })
  }
  return abilities
}

// 「你所在地点闹鬼」的单一读点（05065 的 [skull] -3、05104/05105 的前置条件都读这里）。
export function isLocationHaunted(state, locationId) {
  return hauntedAbilitiesAt(state, locationId).length > 0
}

export function createHaunted(deps) {
  const { reactionWindow, requestChoice, scenarioBehavior, cardDef } = deps

  function distanceTo(state, from, to) {
    const queue = [[from, 0]]
    const seen = new Set([from])
    for (const [id, steps] of queue) {
      if (id === to) return steps
      const location = (state.locations || []).find(candidate => candidate.id === id)
      for (const next of location?.connections || []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push([next, steps + 1])
      }
    }
    return -1
  }

  function nearestEnemy(state, inv) {
    let best = null
    let bestDistance = Infinity
    for (const enemy of state.enemies || []) {
      const distance = enemy.location === inv.location ? 0 : distanceTo(state, inv.location, enemy.location)
      if (distance < 0 || distance >= bestDistance) continue
      best = enemy
      bestDistance = distance
    }
    return best
  }

  function enemyByCode(state, code) {
    return (state.enemies || []).find(enemy => (enemy.originalCode || enemy.code) === code) || null
  }

  function locationFor(state, clause) {
    if (clause.locationId) return (state.locations || []).find(location => location.id === clause.locationId) || null
    if (clause.code) {
      return (state.locations || []).find(location =>
        location.id === clause.code || (location.originalCode || location.code) === clause.code) || null
    }
    return null
  }

  // 子句是否「有合法目标」。没有目标的能力在结算时被跳过并记日志，不算失败。
  function clauseAvailable(state, inv, loc, clause) {
    switch (clause.kind) {
      case 'damageAssets':
        // 2026-10-25 第四轮修复 05083：「你每张带有生命值的卡牌」按参考实现包含调查员本人
        // （BalconySpectral：调查员与带 health 的支援各自受 1 点直接伤害）。
        return true
      case 'discardRandom':
      case 'discardChosen':
        return inv.hand.length > 0
      case 'discardAsset':
        return inv.assets.length > 0
      case 'placeClue':
        return (inv.clues || 0) >= (clause.amount || 1)
      case 'spawn':
        return Boolean(cardDef(clause.code))
      case 'attack':
        return clause.target === 'code' ? Boolean(enemyByCode(state, clause.code)) : Boolean(nearestEnemy(state, inv))
      case 'moveTo':
        return Boolean(locationFor(state, clause))
      case 'choice':
        return clause.options.some(option => abilityAvailable(state, inv, loc, { effect: option.effect }))
      case 'doom':
        if (clause.target === 'location') return true
        if (clause.target === 'enemy') return Boolean(enemyByCode(state, clause.code))
        return true
      default:
        return true
    }
  }

  function abilityAvailable(state, inv, loc, ability) {
    if (!ability.effect?.length) return false
    return ability.effect.every(clause => clauseAvailable(state, inv, loc, clause))
  }

  function applyClause(state, seat, loc, ability, clause, api, events) {
    const inv = state.investigators[seat]
    const suffix = ability.text ? `（${ability.text.replace(/^闹鬼\s*[-－—]\s*/, '')}）` : ''
    switch (clause.kind) {
      case 'damage': api.damage(seat, clause.amount); return true
      case 'horror': api.horror(seat, clause.amount); return true
      case 'directDamage': api.directDamage(seat, clause.amount); return true
      case 'directHorror': api.directHorror(seat, clause.amount); return true
      case 'damageAssets': {
        // 2026-10-25 第四轮修复 05083：调查员本人也在这条闹鬼的伤害范围内。
        api.directDamage(seat, clause.amount)
        const targets = inv.assets.filter(asset => (cardDef(asset.code)?.health || 0) > 0)
        for (const asset of targets) api.damageAsset(seat, asset.id, clause.amount)
        api.info(`👻 闹鬼：${inv.name} 与其 ${targets.length} 张带生命值的卡牌各受到 ${clause.amount} 点直接伤害。`)
        return true
      }
      case 'loseAction':
        api.loseActions(seat, clause.amount)
        api.info(`👻 闹鬼：${inv.name} 失去 ${clause.amount} 个行动。`)
        return true
      case 'loseResource': {
        const lost = Math.min(inv.resources || 0, clause.amount)
        inv.resources -= lost
        if (lost) api.info(`👻 闹鬼：${inv.name} 失去 ${lost} 点资源。`)
        if (clause.overflowHorror) {
          const missing = clause.amount - lost
          if (missing > 0) {
            api.info(`👻 闹鬼：${inv.name} 有 ${missing} 点资源无法失去，改为受到 ${missing} 点恐惧。`)
            api.horror(seat, missing)
          }
        }
        return true
      }
      case 'discardRandom':
        api.discardRandom(seat, clause.amount)
        return true
      case 'discardChosen':
        api.discardChosen(seat, clause.amount, 'haunted')
        return true
      case 'discardAsset': {
        // 2026-10-25 第四轮修复 05081：无支援时该条款不可结算（返回 false，由选择项过滤剔除，
        // 而不是进 requestChoice 空 options 抛错）。
        if (!inv.assets.length) return false
        const options = inv.assets.map(asset => ({ id: asset.id, cardCode: asset.code, label: api.cardName(asset.code) }))
        const chosen = options.length === 1 ? options[0].id : requestChoice(state, {
          kind: 'target', source: 'haunted', seat,
          prompt: `闹鬼：选择并弃掉你控制的 ${clause.amount} 个支援。`,
          options,
        })
        api.discardAsset(seat, chosen)
        return true
      }
      case 'placeClue': {
        const target = state.locations.find(location => location.id === loc.id)
        if (!target) return false
        // 2026-10-25 第四轮修复 05131：0 线索时不能选择「放线索」条款（避免 spendClues 抛错）。
        if ((inv.clues || 0) < (clause.amount || 1)) return false
        api.spendClues(seat, clause.amount)
        target.clues += clause.amount
        target.maxClues = Math.max(target.maxClues || 0, target.clues)
        api.info(`👻 闹鬼：${inv.name} 将 ${clause.amount} 个线索放到「${target.name}」。`)
        return true
      }
      case 'doom': {
        if (clause.target === 'location') { api.doomOn(loc, clause.amount); return true }
        if (clause.target === 'enemy') {
          const enemy = enemyByCode(state, clause.code)
          if (!enemy) return false
          api.doomOn(enemy, clause.amount)
          return true
        }
        api.addDoom(clause.amount)
        return true
      }
      case 'spawn':
        api.spawn(clause.code, clause.locationId || loc.id)
        return true
      case 'attack': {
        const enemy = clause.target === 'code' ? enemyByCode(state, clause.code) : nearestEnemy(state, inv)
        if (!enemy) return false
        api.attack(enemy, inv)
        return true
      }
      case 'moveTo': {
        const target = locationFor(state, clause)
        if (!target) return false
        api.moveInvestigator(seat, target.id)
        return true
      }
      case 'choice': {
        const prompt = clause.prompt || `闹鬼：${inv.name} 选择一项结算${suffix}。`
        // 2026-10-25 第四轮修复 haunted-choice-option-validation（05081/05130/05131）：
        // 只列出「此刻确实能结算」的选项——每个选项的 effect 子句都要通过可用性检查，
        // 否则「无可弃支援 / 0 线索」的选项仍会出现并在结算时抛错。
        const usableOptions = clause.options.filter(option =>
          Array.isArray(option.effect) && option.effect.length
          && option.effect.every(nested => clauseAvailable(state, inv, loc, nested)))
        if (!usableOptions.length) return false
        const options = usableOptions.map(option => ({ id: option.id, label: option.label }))
        // `source` 带地点与能力身份：界面据此高亮「这是哪条闹鬼能力」，回放时也逐字比对。
        const picked = options.length === 1 ? options[0].id : requestChoice(state, {
          kind: 'haunted',
          source: { kind: 'haunted', locationId: loc.id, abilityId: ability.id, text: ability.text },
          seat, prompt, options,
        })
        const option = usableOptions.find(candidate => candidate.id === String(picked)) || usableOptions[0]
        let resolved = false
        for (const nested of option.effect) resolved = applyClause(state, seat, loc, ability, nested, api, events) || resolved
        return resolved
      }
      case 'script': {
        const handler = scenarioBehavior(state).hauntedScript
        if (typeof handler !== 'function') {
          state.hauntedGaps ||= []
          state.hauntedGaps.push({ locationId: loc.id, abilityId: ability.id, scriptId: clause.id, round: state.round })
          api.info(`⛔ 闹鬼能力「${ability.text}」缺少章节脚本（hauntedScript: ${clause.id}）。`)
          return false
        }
        return handler(state, {
          seat, investigator: inv, locationId: loc.id, ability, scriptId: clause.id, code: clause.code || null,
        }, api) !== false
      }
      default:
        return false
    }
  }

  function resolveAbility(state, seat, loc, ability, api, events) {
    let resolved = false
    for (const clause of ability.effect) {
      if (state.investigators[seat].defeated || state.investigators[seat].resigned) break
      resolved = applyClause(state, seat, loc, ability, clause, api, events) || resolved
    }
    return resolved
  }

  // 结算一次闹鬼：印刷能力 + 授予能力，按玩家选择的顺序逐条结算；times>1 时整轮重复。
  function resolveHaunted(state, seat, options = {}, api, events = []) {
    const inv = state.investigators[seat]
    if (!inv || inv.defeated || inv.resigned) return { resolved: 0, cancelled: false, reason: 'no-investigator' }
    const locationId = options.locationId || inv.location
    const loc = (state.locations || []).find(location => location.id === locationId)
    if (!loc) return { resolved: 0, cancelled: false, reason: 'no-location' }
    const abilities = hauntedAbilitiesAt(state, loc.id)
    if (!abilities.length) return { resolved: 0, cancelled: false, reason: 'not-haunted' }
    const times = Math.max(1, Math.floor(Number(options.times) || 1))
    const kind = options.kind || 'effect'
    const context = {
      when: 'haunted', seat, location: loc.id, kind, times, source: options.source || null,
      abilities: abilities.map(ability => ability.id),
      prompt: `${inv.name} 所在地点的闹鬼能力（${loc.name}）`,
    }
    // 取消/替代窗口：卡面用 interrupt + `context.cancelled = true` 取消整次结算。
    reactionWindow(state, 'haunted', context, events)
    if (context.cancelled) {
      api.info(`🌀 闹鬼能力被取消（${loc.name}）。`)
      return { resolved: 0, cancelled: true, reason: 'cancelled' }
    }
    api.info(`👻 结算「${loc.name}」的闹鬼能力${times > 1 ? `（共 ${times} 次）` : ''}。`)
    let resolved = 0
    for (let pass = 0; pass < times; pass++) {
      let remaining = abilities.map(ability => ability.id)
      while (remaining.length) {
        const pool = abilities.filter(ability => remaining.includes(ability.id))
        const available = pool.filter(ability => abilityAvailable(state, inv, loc, ability))
        if (!available.length) {
          const skipped = pool.filter(ability => !available.includes(ability))
          if (skipped.length) api.info(`👻 闹鬼：「${loc.name}」的 ${skipped.length} 条能力没有合法目标，跳过。`)
          break
        }
        let picked = available[0]
        if (available.length > 1) {
          const chosen = requestChoice(state, {
            kind: 'haunted',
            source: { kind: 'haunted', locationId: loc.id, times, order: true },
            seat,
            prompt: '选择下一条要结算的闹鬼能力。',
            options: available.map((ability, index) => ({
              id: ability.id, label: ability.text, text: ability.text,
              abilityIndex: abilities.findIndex(candidate => candidate.id === ability.id), order: index,
            })),
          })
          picked = available.find(ability => ability.id === String(chosen)) || available[0]
        }
        remaining = remaining.filter(id => id !== picked.id)
        if (resolveAbility(state, seat, loc, picked, api, events)) resolved++
        if (inv.defeated || inv.resigned) {
          return { resolved, cancelled: false, reason: 'eliminated', kind, times }
        }
      }
    }
    return { resolved, cancelled: false, kind, times }
  }

  // 失败检定的统一入口：只有「调查」是闹鬼关键字的默认来源；攻击/躲避由卡面显式触发，
  // 剧本也可以通过 `hauntedOn` 把某几类失败纳入自动结算。
  function resolveAfterFailedAction(state, seat, actionKind, api, events = [], options = {}) {
    const allowed = state.scenario?.hauntedOn || ['investigate']
    if (!allowed.includes(actionKind)) return { resolved: 0, cancelled: false, reason: 'not-configured' }
    const inv = state.investigators[seat]
    if (!inv) return { resolved: 0, cancelled: false, reason: 'no-investigator' }
    return resolveHaunted(state, seat, {
      locationId: options.locationId || inv.location,
      times: options.times || 1,
      kind: actionKind,
      source: options.source || null,
    }, api, events)
  }

  function grantHaunted(state, raw) {
    const grant = hauntGrant(raw)
    state.hauntedGrants ||= []
    state.hauntedGrants.push(grant)
    return grant
  }

  function clearHauntedGrants(state, predicate = null) {
    if (!state.hauntedGrants) return 0
    const before = state.hauntedGrants.length
    state.hauntedGrants = predicate ? state.hauntedGrants.filter(grant => !predicate(grant)) : []
    return before - state.hauntedGrants.length
  }

  return { resolveHaunted, resolveAfterFailedAction, grantHaunted, clearHauntedGrants }
}
