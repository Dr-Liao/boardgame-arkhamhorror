// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P4 引擎交互事务层。
//
// 定位：把 P1 机制扫描里的四组交互机制（法典触发与条件段落 / 三天三夜与居民演进面板 /
// 序曲整备与下一次勘察选择 / 网格空位·矿车·敌人-地点·调查员形态与线索搬移）收敛成
// **规则侧选择事务**：候选只从权威状态枚举，选择统一走 `mechanic-choices.js#selectMechanic`
// 的 opaque `pick:N` / `confirm` / `cancel` 选项，写入统一走 P2 原语；本文件不复制状态、不写卡号、不碰 UI。
//
// 事务契约（与 resolution.js 配合，与 EotE/TSK 的 P4 交互层同一口径）：
//   · 所有玩家决策走 selectMechanic 的 pending choice；恢复时由 resolution 用同一 execute 重放，
//     因此**任何写入都发生在最后一个选择之后**，取消 / 空候选在写入前返回（无半写状态）；
//   · 空强制候选集在进入 requestChoice 之前返回 false/null，不产生 pending choice / 软锁；
//   · 隐私：法典候选只给条目名与「可读/已读」，不返回未触发条目的分支条件与正文；
//     猎杀袋只给剩余张数，袋内标记面只在合法抽取后由事件公开；勘察整备只给手牌**张数**；
//     网格空位与轨道方向是公开信息；形态选择只列内容层给出的绑定面。
//   · 真实入口：`campaign-flow.js` 的勘察整备已改用本层的 `fhvSurvey` 操作；
//     P5–P7 的卡面/剧本能力调用 `api.interactions.fhv.*`，不再各自拼选择面板。
import { registeredEntry } from './ability.js'
import { investigatorRule } from '../cards/card-rules.js'
import { cardDef } from './card-lookup.js'
import { selectMechanic } from './mechanic-choices.js'
import { investigatorAt, mechanicState } from './mechanic-state.js'
import { canResolveCodex, codexSelectionFor, resolveCodex, scenarioDate } from './scenario-calendar.js'
import {
  chooseSurveyDestination, prepareSurvey, surveyForDestination,
} from './survey-preparation.js'
import {
  adjacentGridSpaces, connectGrid, gridPosition, placeGridLocation, relocateGridCells,
} from './grid-map.js'
import { advanceRailVehicle, steerRailVehicle } from './rail-grid.js'
import { moveVehicle } from './vehicles.js'
import { revealTokenFromBag, tokenBagInfo, transferRevealedToken } from './token-bag.js'
import { replaceLethalHarmWithForm } from './investigator-form.js'
import { transferControlledClues } from './asset-clues.js'

const isNonEmptyString = value => typeof value === 'string' && value.length > 0
const assertSeat = (state, seat) => investigatorAt(state, seat)
const assertOptional = value => {
  if (typeof value !== 'boolean') throw new TypeError('optional 必须是布尔值')
  return value
}
const DIRECTION_LABEL = Object.freeze({ north: '北 ↑', east: '东 →', south: '南 ↓', west: '西 ←' })
const directionLabel = direction => DIRECTION_LABEL[direction] || direction
const RAIL_DIRECTIONS = Object.freeze(['north', 'east', 'south', 'west'])
const cardLabel = code => {
  const def = cardDef(code)
  return def ? (def.nameZh || def.name || code) : code
}

// 当前能力来源（卡/资产实体 id）。由 createFhvInteractions 的公开方法包装器临时设置，
// 让所有 selectMechanic 选择带上 `source`，浏览器端据此在取消/结算后把焦点还给来源实体。
let pendingSource = null
const chooseOne = (state, seat, { operation, stage = 'items', prompt, candidates, optional = true }) => {
  if (!candidates.length) return null
  const chosen = selectMechanic(state, seat, {
    operation, stage, prompt, candidates, min: 1, max: 1, optional, source: pendingSource,
  })
  return chosen?.[0] ?? null
}

/**
 * 创建 FHV 交互事务集合。`state` 是当前规则事务的 draft；`deps` 只放可注入的确定性依赖：
 *   · deps.placeLocation(id) —— 网格放置新地点时的实际入场管线（createMechanicsApi 已注入）；
 *   · deps.moveInvestigator / deps.entryError —— 载具移动时的调查员随行与进入限制读点；
 *   · deps.scenarioName(id) —— 下一次勘察选择的展示名（内容层清单提供；缺省回退 id）。
 */
export function createFhvInteractions(state, deps = {}) {
  const placeLocation = typeof deps.placeLocation === 'function' ? deps.placeLocation : null
  const moveInvestigator = typeof deps.moveInvestigator === 'function'
    ? deps.moveInvestigator : (seat, destination) => { state.investigators[seat].location = destination }
  const entryError = typeof deps.entryError === 'function' ? deps.entryError : () => null

  // ── 法典：选择可读条目 → 引擎按居民笔记/关系等级筛选唯一合格小节 → 调用内容效果 ────────────
  const codex = {
    /** 只读：当前内容声明的法典条目（id、可读、已读）。 */
    entries() {
      const spec = state.scenario?.mechanics?.codex
      if (!Array.isArray(spec)) return []
      return spec.map(entry => ({
        id: entry.id, resident: Boolean(entry.resident),
        available: canResolveCodex(state, entry.id),
      }))
    },
    /**
     * 触读一条法典：候选 = 当前记录下可结算的条目（未触发/不满足条件的条目不出现，空候选直接返回 false）。
     * `effect(selection)` 是内容层的法典结算回调（P7 由剧本/地点条目传入；P4 夹具只记录选择）。
     */
    read(seat, { optional = true, effect = null } = {}) {
      const inv = assertSeat(state, seat)
      assertOptional(optional)
      if (effect != null && typeof effect !== 'function') throw new TypeError('法典效果必须是函数')
      void inv
      const spec = state.scenario?.mechanics?.codex
      if (!Array.isArray(spec) || !spec.length) return false
      const residents = state.scenario?.mechanics?.residents || []
      const labelOf = entry => {
        if (!entry.resident) return entry.id
        const resident = residents.find(row => row.record?.level === entry.resident.relationship)
        return resident ? `${resident.name}（法典）` : entry.id
      }
      const available = spec.filter(entry => canResolveCodex(state, entry.id))
      if (!available.length) return false
      const candidates = available.map(entry => ({
        value: entry.id, label: labelOf(entry), uiKey: `fhv-codex:${entry.id}`,
      }))
      const entryId = chooseOne(state, seat, { operation: 'fhvCodex', stage: 'entries', prompt: '选择要阅读的法典条目', candidates, optional })
      if (entryId == null) return false
      // 选择之后才计算条件段落；未选中/取消的条目不会暴露任何分支信息。
      const selection = codexSelectionFor(state, entryId)
      if (!selection) return false
      let captured = null
      const resolved = resolveCodex(state, entryId, seat, context => {
        captured = { ...context }
        effect?.(context)
      })
      if (!resolved || !captured) return false
      const entry = spec.find(row => row.id === entryId)
      return {
        entry: entryId,
        branch: captured.branch,
        seat: captured.seat,
        kind: entry?.resident ? 'resident' : 'other',
        limit: entry?.limit ?? 'scenario',
      }
    },
  }

  // ── 序曲整备与下一次勘察：保留支援/弃手牌（服务端选择事务）→ 选择下一场勘察关卡 ───────────
  const survey = {
    /** 结算一次勘察整备（保留 1 张非起始支援、弃到开手牌数、资源上限、洗回弃牌堆）。 */
    prepare(seat, { optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (!state.scenario?.mechanics?.survey) return false
      if (state.campaign?.surveyPreparation) return false
      // 取消语义：整备是「一次结算」，任何一步取消都在写入包裹之前中止（prepareSurvey 只在
      // 全部选择完成后一次性写 campaign.surveyPreparation），因此取消 = 返回 false、零写入。
      let cancelled = false
      const choose = spec => {
        const chosen = selectMechanic(state, spec.seat, {
          operation: 'fhvSurvey', stage: spec.kind, prompt: spec.prompt, min: 1, max: 1, optional: true,
          candidates: spec.options.map((option, index) => ({
            value: option.id, label: option.label,
            ...(option.cardCode ? { cardCode: option.cardCode } : {}),
            uiKey: `fhv-survey:${spec.kind}:${option.id}:${index}`,
          })),
        })?.[0] ?? null
        if (chosen == null) cancelled = true
        return chosen
      }
      let prepared
      try {
        prepared = prepareSurvey(state, { choose, cardDef, entryOf: registeredEntry, investigatorRule })
      } catch (error) {
        if (cancelled) return false
        throw error
      }
      if (!prepared) return false
      const parcel = state.campaign.surveyPreparation
      return { source: parcel.source, destinations: [...parcel.destinations], seats: Object.keys(parcel.seats).map(Number).sort() }
    },
    /** 选择下一场勘察关卡：候选 = 本次整备声明的可勘察列表（内容层已按日/时段过滤）。 */
    chooseNext(seat, { optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      const parcel = state.campaign?.surveyPreparation
      if (!parcel) return false
      if (parcel.chosenDestination != null) return false
      const nameOf = typeof deps.scenarioName === 'function' ? deps.scenarioName : id => id
      const candidates = parcel.destinations.map(id => ({
        value: id, label: nameOf(id) || id, uiKey: `fhv-survey-destination:${id}`,
      }))
      const destination = chooseOne(state, seat, {
        operation: 'fhvSurvey', stage: 'destination', prompt: '选择下一场勘察关卡', candidates, optional,
      })
      if (destination == null) return false
      return chooseSurveyDestination(state, seat, destination) || false
    },
    /** 只读：当前整备包裹（投影/测试用）。 */
    parcel() {
      const parcel = state.campaign?.surveyPreparation
      return parcel ? structuredClone(parcel) : null
    },
    /** 只读：某关卡是否属于本次整备的可勘察列表。 */
    allows(id) {
      return Boolean(surveyForDestination(state, id))
    },
  }

  // ── 网格：新地点放入正交相邻空位；整组地点平移/交换（矿车滑动、岩间密语规则）────────────
  const grid = {
    /**
     * 把地点放入当前调查员所在地点的正交相邻空位。`locationId` 可尚未入场（走 deps.placeLocation 管线）。
     * 无空位 / 已在网格 / 非法坐标 → 不产生选择面板（false）。
     */
    place(seat, { locationId = null, optional = true } = {}) {
      const inv = assertSeat(state, seat)
      assertOptional(optional)
      if (!isNonEmptyString(locationId)) throw new TypeError('网格放置需要地点 id')
      const cells = mechanicState(state)?.grid || {}
      if (cells[locationId]) return false
      const anchor = inv.location
      if (!anchor || !gridPosition(state, anchor)) return false
      if (!state.locations.some(loc => loc.id === locationId) && !placeLocation) return false
      const spaces = adjacentGridSpaces(state, anchor)
      if (!spaces.length) return false
      const candidates = spaces.map(space => ({
        value: `${space.x},${space.y}`, label: `(${space.x}, ${space.y})`, uiKey: `fhv-grid:${space.x}:${space.y}`,
      }))
      const chosen = chooseOne(state, seat, { operation: 'fhvGrid', stage: 'cells', prompt: '选择新地点的空位', candidates, optional })
      if (chosen == null) return false
      const [x, y] = chosen.split(',').map(Number)
      const placed = placeGridLocation(state, locationId, x, y, { placeLocation }, {})
      return placed ? { id: placed, x, y } : false
    },
    /**
     * 整组地点平移/交换（矿车滑动、地点滑动规则）：候选由内容层给出完整变更计划，
     * 引擎只校验全部坐标后一次性提交（事务性，不留半写）。
     */
    slide(seat, { plans = null, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (!Array.isArray(plans) || !plans.length) return false
      for (const plan of plans) {
        if (!plan || !isNonEmptyString(plan.id) || !Array.isArray(plan.changes) || !plan.changes.length) throw new TypeError('无效网格滑动计划')
      }
      const candidates = plans.map(plan => ({
        value: plan.id, label: isNonEmptyString(plan.label) ? plan.label : plan.id, uiKey: `fhv-grid-slide:${plan.id}`,
      }))
      const planId = chooseOne(state, seat, { operation: 'fhvGrid', stage: 'slide', prompt: '选择地点的滑动/交换方案', candidates, optional })
      if (planId == null) return false
      const plan = plans.find(row => row.id === planId)
      const moved = relocateGridCells(state, plan.changes, { protectStoryAssets: plan.protectStoryAssets === true })
      return moved === false ? false : { id: planId, changes: plan.changes.map(cell => ({ ...cell })) }
    },
  }

  // ── 矿车与道岔：转向（道岔）与整组调查员随车前进（多出口时选择方向）──────────────────────
  const rail = {
    /** 道岔转向：只能转向与当前朝向垂直且当前轨道存在的出口。 */
    steer(seat, { optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      const data = mechanicState(state), record = data?.rail
      const vehicle = record && data.vehicles?.[record.vehicle]
      if (!record || !vehicle || record.derailed) return false
      const ports = record.ports?.[vehicle.location] || []
      const from = RAIL_DIRECTIONS.indexOf(record.facing)
      const turns = ports.filter(direction => {
        const index = RAIL_DIRECTIONS.indexOf(direction)
        if (index < 0) return false
        const diff = Math.abs(index - from)
        return diff === 1 || diff === 3
      })
      if (!turns.length) return false
      const candidates = turns.map(direction => ({ value: direction, label: directionLabel(direction), uiKey: `fhv-rail-steer:${direction}` }))
      const facing = chooseOne(state, seat, { operation: 'fhvRail', stage: 'steer', prompt: '选择道岔转向', candidates, optional })
      if (facing == null) return false
      return steerRailVehicle(state, facing) ? { facing } : false
    },
    /** 矿车前进：多出口时由调查员选择方向；断轨/无出口时由原语记录脱轨。 */
    advance(seat, { optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      const data = mechanicState(state), record = data?.rail
      if (!record) return false
      const result = advanceRailVehicle(state, {
        move: (vehicleId, destination) => moveVehicle(state, vehicleId, destination, {
          moveInvestigator, entryError,
        }),
        connect: () => connectGrid(state),
      }, directions => {
        const turns = directions.map(direction => ({ value: direction, label: directionLabel(direction), uiKey: `fhv-rail-step:${direction}` }))
        return chooseOne(state, seat, { operation: 'fhvRail', stage: 'advance', prompt: '选择矿车前进方向', candidates: turns, optional })
      })
      return result === false ? false : result
    },
    /** 只读：轨道/矿车公开状态（投影/测试用）。 */
    status() {
      const data = mechanicState(state), record = data?.rail
      const vehicle = record && data.vehicles?.[record.vehicle]
      if (!record || !vehicle) return null
      return { vehicle: record.vehicle, location: vehicle.location, facing: record.facing, derailed: record.derailed,
        exits: [...(record.ports?.[vehicle.location] || [])] }
    },
  }

  // ── 猎杀袋：独立标记袋抽取（不创建技能检定），可选把已揭示标记转移到指定袋/混乱袋 ──────────
  const predation = {
    /**
     * 猎杀检定抽取：从 `bagId` 独立袋随机揭示 1 枚（公开信息）。
     * `targets` 非空时，再选择已揭示标记的去向（`{ id: 'chaos' | bagId, label }`）。
     */
    draw(seat, { bagId = 'predation', targets = [], optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (!isNonEmptyString(bagId)) throw new TypeError('猎杀袋需要 bagId')
      if (!Array.isArray(targets) || targets.some(target => !target || !isNonEmptyString(target.id))) throw new TypeError('无效猎杀袋去向')
      const bag = tokenBagInfo(state, bagId)
      if (!bag.exists || bag.count === 0) return false
      const token = revealTokenFromBag(state, bagId)
      if (token == null) return false
      if (!targets.length) return { bag: bagId, token, transferred: false }
      const candidates = targets.map(target => ({
        value: target.id, label: isNonEmptyString(target.label) ? target.label : target.id, uiKey: `fhv-predation:${bagId}:${target.id}`,
      }))
      const targetId = chooseOne(state, seat, { operation: 'fhvPredation', stage: 'destination', prompt: '选择已揭示标记的去向', candidates, optional })
      if (targetId == null) return { bag: bagId, token, transferred: false }
      const moved = transferRevealedToken(state, bagId, token, targetId === 'chaos' ? null : targetId)
      return { bag: bagId, token, transferred: moved === true, target: targetId }
    },
  }

  // ── 敌人-地点 / 调查员状态：绑定坚毅形态二选一、受控支援线索搬移──────────────────────────
  const investigatorState = {
    /**
     * 汉克濒败替换形态：在内容层给出的绑定坚毅面中二选一（`forms` 为调查员卡号列表），
     * 由原语清空既有伤害/恐惧并原位切换（重伤/恐惧仍按战役记录结转）。
     */
    form(seat, { forms = null, form = 'resolute', context = null, optional = true } = {}) {
      const inv = assertSeat(state, seat)
      assertOptional(optional)
      if (!Array.isArray(forms) || !forms.length) return false
      if (forms.some(code => typeof code !== 'string' || !cardDef(code))) throw new TypeError('无效坚毅形态卡号')
      const candidates = forms.map(code => {
        const def = cardDef(code)
        return {
          value: code, cardCode: code,
          label: `${def.nameZh || def.name || code} · ${def.health} 生命 / ${def.sanity} 理智`,
          uiKey: `fhv-form:${code}`,
        }
      })
      const code = chooseOne(state, seat, { operation: 'fhvForm', stage: 'faces', prompt: '选择要切换到的坚毅面', candidates, optional })
      if (code == null) return false
      const replaced = replaceLethalHarmWithForm(state, inv, context, { code, form })
      return replaced ? { seat, code, form } : false
    },
    /**
     * 线索搬移（凯特·温斯罗普式）：把调查员控制的线索移到符合条件（特质 / 无线索）的受控支援，
     * 归属、容量与离场回落由 P2 原语校验。
     */
    transferClue(seat, { count = 1, traits = ['Science', 'Tool'], emptyTarget = true, optional = true } = {}) {
      const inv = assertSeat(state, seat)
      assertOptional(optional)
      if (!Number.isSafeInteger(count) || count < 1) throw new TypeError('线索搬移数量必须为正整数')
      if ((inv.clues || 0) < count) return false
      const candidates = (inv.assets || []).flatMap(asset => {
        if (emptyTarget && (asset.clues || 0) > 0) return []
        if (Array.isArray(traits) && traits.length
          && !(asset.traits || []).some(trait => traits.some(target => target.toLowerCase() === trait.toLowerCase()))) return []
        return [{ value: asset.id, cardCode: asset.code, label: cardLabel(asset.code), uiKey: `asset:${asset.id}:fhv-clue` }]
      })
      if (!candidates.length) return false
      const assetId = chooseOne(state, seat, { operation: 'fhvClue', stage: 'assets', prompt: '选择接收线索的受控支援', candidates, optional })
      if (assetId == null) return false
      const moved = transferControlledClues(state, seat, 'investigator', assetId, count, { emptyTarget, traits })
      return moved ? { seat, asset: assetId, count: moved } : false
    },
  }

  const groups = { codex, survey, grid, rail, predation, investigatorState }
  const sourced = {}
  for (const [groupName, group] of Object.entries(groups)) {
    sourced[groupName] = {}
    for (const [method, fn] of Object.entries(group)) {
      sourced[groupName][method] = function (...args) {
        const options = args[1]
        const source = options && typeof options === 'object' && !Array.isArray(options) && typeof options.source === 'string'
          ? options.source : null
        const previous = pendingSource
        pendingSource = source
        try { return fn.apply(group, args) } finally { pendingSource = previous }
      }
    }
  }
  return sourced
}

/** 只读：当前剧本日期（投影/测试复用同一读点，不复制规则）。 */
export function currentScenarioDate(state) {
  return scenarioDate(state)
}

/** 只读：场景声明的居民清单（内容层给名称与记录键）。 */
export function scenarioResidents(state) {
  const spec = state.scenario?.mechanics?.residents
  return Array.isArray(spec) ? spec.map(row => structuredClone(row)) : []
}

/** 只读：当前网格坐标（投影用；不写状态）。 */
export function scenarioGridCells(state) {
  const cells = mechanicState(state)?.grid
  return cells ? Object.entries(cells).map(([id, cell]) => ({ id, x: cell.x, y: cell.y, isolated: cell.isolated === true })) : []
}

/** 只读：当前调查员所在地点的正交空位（投影用）。 */
export function observerAdjacentSpaces(state, seat) {
  const inv = state.investigators?.[seat]
  if (!inv?.location) return []
  return adjacentGridSpaces(state, inv.location)
}

/** 只读：载具（矿车）位置，供投影取公开数据。 */
export function scenarioVehicles(state) {
  const data = mechanicState(state)?.vehicles
  return data ? Object.entries(data).map(([id, vehicle]) => ({ id, location: vehicle.location })) : []
}
