// 捕获 / 押送（Capture）机制的**唯一写入口**与纯读点（TIC 第六章《雾中之光》）。
//
// 印刷（07252 惨遭俘获！ / 07252b 拘禁室 / 07253 奥赛罗思·马什 / 07260 惨遭俘虏 / 07233 不变如海）：
//   · 被俘的调查员不能被移动、攻击，也不能与敌人交战（剧本级、跨来源的持久状态）；
//   · 首次被俘时读 07252 的剧情文本，把这张双面剧情卡翻到「拘禁室」面放入场（不在任何行/列、
//     只通过连接图标与沉没岩洞相连），再把被俘者放到拘禁室；
//   · 把手槽支援返回手牌、解除交战、钥匙按来源要求转移（07260 放拘禁室、07253 放马什）。
//
// 存储位置：`state.scenarioFlags.mechanics.captured`（可选扩展 v1 的已知字段，与钥匙/水位/载具
// 同容器）。**不写 inv.* 私有字段**：
//   · inv 会随淘汰/读档重建，状态会丢失；mechanicState 与其它剧本机制同容器，
//     `startScenario` 重置 `state.scenarioFlags` 时自动清空，不会跨关残留；
//   · 存档校验统一走 mechanic-state.js#validateMechanicState，非法存档在读档时被拒。
//
// 形状（version 1）：
//   state.scenarioFlags.mechanics.captured = {
//     storyShown: true,                       // 印刷「第一次有调查员被俘」的剧情文本是否已读过
//     seats: {
//       "0": { locationId: "<拘禁室地点实例 id>", round: 4, source: "<造成被俘的卡号>" },
//     },
//   }
//
// 依赖注入（叶子模块，避免 ESM 循环；与 vehicle-state.js 同策略）：本文件只 import
// mechanic-state.js 与 grid-map.js，其余全部由 engine.js 注入。
//
// 读点：
//   · hidden-rules.js#movementError —— 被俘不能移动（覆盖合法移动枚举 / validateMove / 效果位移 /
//     canMoveTo / shortcutMove）；
//   · moves.js#validateMove —— 被俘不能攻击/交战（合法列表最后统一过 validateMove）；
//   · enemies.js#engageEnemy —— 被俘不能被交战（基础行动、自动交战、剧本强制交战同一读点）；
//   · engine.js 的 autoEngageAt / autoEngageAll 过滤被俘者；
//   · scenario-runtime.js 暴露 `api.scenario.capture/freeCaptured` 与只读查询；
//   · observation.js#viewState 投影 `captured` / `capturedAt`（公开信息：迷你卡侧放）。
import { mechanicState } from './mechanic-state.js'
import { placeGridLocation } from './grid-map.js'

const ACTION_LABELS = Object.freeze({ move: '移动', shortcutMove: '移动', fight: '攻击', engage: '与敌人交战' })

function capturedStore(state) {
  const data = mechanicState(state)?.captured
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null
}

function seatKey(seat) {
  return Number.isSafeInteger(seat) ? String(seat) : null
}

function recorded(state, seat) {
  const store = capturedStore(state)
  const key = seatKey(seat)
  return key == null || !store?.seats ? null : store.seats[key] || null
}

// 被俘者记录里的地点实例 id；拘禁室已不在场（未来的极端情况）时返回 null 而不是抛错。
export function capturedLocation(state, seat) {
  const entry = recorded(state, seat)
  if (!entry || typeof entry.locationId !== 'string') return null
  return (state.locations || []).some(location => location.id === entry.locationId) ? entry.locationId : null
}

export function isCaptured(state, seat) {
  return Boolean(recorded(state, seat))
}

// 被俘的座位号（升序；找不到调查员实例的座位被跳过，旧存档容错）。
export function capturedSeats(state) {
  const seats = capturedStore(state)?.seats
  if (!seats) return []
  return Object.keys(seats).map(Number).filter(seat => Number.isSafeInteger(seat)
    && (state.investigators || []).some(inv => inv.seat === seat)).sort((a, b) => a - b)
}

export function capturedCount(state) {
  return capturedSeats(state).length
}

// 被关押在指定地点（拘禁室）的座位号列表；07252b 的 [action] 用它选解救对象。
export function capturedAtLocation(state, locationId) {
  if (locationId == null) return []
  return capturedSeats(state).filter(seat => recorded(state, seat)?.locationId === locationId)
}

// 被俘者的全局限制读点：返回提示文本（null = 允许）。`move/fight/engage` 是印刷的三条。
export function capturedActionError(state, inv, action) {
  if (!inv || !isCaptured(state, inv.seat)) return null
  // 捕获自身的位移动（写入 captured 状态后由本模块发起的搬家）必须放行，
  // 否则「被俘者不能移动」会挡住捕获效果本身（见 w6 风险 R4）。
  if (action === 'move' && Array.isArray(state._captureRelocatingSeats)
    && state._captureRelocatingSeats.includes(inv.seat)) return null
  const label = ACTION_LABELS[action]
  return label ? `被俘的调查员不能${label}` : null
}

// ---------------------------------------------------------------------------
// 剧情卡「翻面成地点」的声明：07252 条目用 `flags.captureLocation` 声明翻面后的地点卡号与
// 地图坐标（chapter-data.setup.expandedMap.holdingCells 的 (5,1)、excludeFromRowColumn=true
// → isolated）。引擎读**场上剧情资产条目**的声明，内容层不需要为本章写卡号分支。
// ---------------------------------------------------------------------------
function storyCaptureSpec(state, deps) {
  for (const asset of state.storyAssets || []) {
    if (!asset || asset.location != null) continue
    const entry = deps.registeredEntry(asset.originalCode || asset.code)
    const spec = entry?.flags?.captureLocation
    if (spec && typeof spec === 'object') return { asset, spec }
  }
  return null
}

// 拘禁室定义（剧本 locations 里已建好，未入场时 state.locations 找不到实例）。
function captureLocationDefinition(state, spec) {
  const code = String(spec.code || '')
  if (!code) return null
  const definition = Object.values(state.scenario?.locations || {})
    .find(item => String(item.originalCode || item.code) === code)
  if (!definition) return null
  const inPlay = (state.locations || []).find(location => location.id === definition.id) || null
  return { definition, inPlay }
}

// 首次被俘：把双面剧情卡翻面成地点并入场。返回地点实例 id（失败返回 null）。
function ensureStoryCaptureLocation(state, events, deps) {
  const found = storyCaptureSpec(state, deps)
  if (!found) return null
  const { definition, inPlay } = captureLocationDefinition(state, found.spec) || {}
  if (!definition) return null
  if (inPlay) return inPlay.id
  const column = Number.isSafeInteger(found.spec.column) ? found.spec.column : 0
  const row = Number.isSafeInteger(found.spec.row) ? found.spec.row : 0
  const placed = placeGridLocation(state, definition.id, column, row,
    // grid-map 的 placeLocation 回调必须返回实例 id（引擎导出的 placeLocation 只写不返回）。
    { placeLocation: id => { deps.placeLocation(state, id, events); return state.locations.some(item => item.id === id) ? id : null } },
    { isolated: found.spec.isolated !== false })
  if (!placed) return null
  const location = (state.locations || []).find(item => item.id === definition.id)
  if (!location) return null
  if (!location.revealed) deps.revealLocation(state, location.id, events, null)
  // 翻面：剧情面（07252）离场，背面（拘禁室地点）已在场 —— 与印刷「翻到背面并放置入场」等价。
  const index = state.storyAssets.indexOf(found.asset)
  if (index >= 0) state.storyAssets.splice(index, 1)
  deps.info(state, events, `📜 「${deps.cardName(found.asset.originalCode || found.asset.code)}」翻面，「${location.name || location.id}」进入游戏。`)
  return location.id
}

function captureDestination(state, seat, options, events, deps) {
  const wanted = options.location
  if (wanted != null) {
    const direct = (state.locations || []).find(location => location.id === wanted
      || String(location.originalCode || location.code) === String(wanted))
    if (direct) return direct.id
  }
  // 已有在押者时一律关到同一处地点（拘禁室）：剧情卡此时已翻面、不再留在 storyAssets，
  // 不能只靠「剧情资产 flags」找落点（首次被俘后每次被俘都走这里）。
  const held = capturedStore(state)?.seats
  if (held) {
    for (const entry of Object.values(held)) {
      if (entry && (state.locations || []).some(location => location.id === entry.locationId)) return entry.locationId
    }
  }
  const behavior = deps.scenarioBehavior(state)
  if (typeof behavior.captureLocation === 'function') {
    const id = behavior.captureLocation(state, seat, deps.scenarioRuntime(state, events))
    if (id && (state.locations || []).some(location => location.id === id)) return id
  }
  return ensureStoryCaptureLocation(state, events, deps)
}

// 手槽支援返手：卡面槽位（cardDef）经 assets.js#normalizedSlots 规范化后命中 hand/handx2。
// 顺序与印刷一致：先返手，再解除交战，再搬去拘禁室。
function returnHandSlotAssets(state, inv, events, deps) {
  const returned = []
  for (const asset of [...(inv.assets || [])]) {
    const slots = deps.normalizedSlots(deps.cardDef(asset.code))
    if (!slots.some(slot => slot === 'hand' || slot === 'handx2')) continue
    const result = deps.leaveAsset(state, inv, asset, events, { reason: 'return' })
    if (result === false || asset.removedFromGame) continue
    if (asset.returnedToHand) { returned.push(asset.code); continue }
    deps.putInHand(state, inv, asset.code)
    returned.push(asset.code)
  }
  return returned
}

function firstCaptureText(state, events, deps, storyCode) {
  if (!storyCode) return
  const definition = state.scenario?.storyAssets?.[storyCode]
  const text = definition?.text || definition?.textEn
  if (!text) return
  deps.info(state, events, text, {
    kind: 'story', title: definition?.name || deps.cardName(storyCode),
    code: storyCode, text,
  })
}

function keyDestinationOf(keysTo, destinationId) {
  if (keysTo == null || keysTo === 'destination') return `location:${destinationId}`
  if (keysTo === 'none' || keysTo === false) return null
  return typeof keysTo === 'string' ? keysTo : null
}

function moveKeysTo(state, seat, target, deps) {
  if (!target) return 0
  const from = `investigator:${seat}`
  let moved = 0
  for (const color of deps.keysAt(state, from, { reveal: true })) {
    if (deps.transferKey(state, color, from, target, { reveal: true })) moved += 1
  }
  return moved
}

function relocateCaptured(state, seat, destinationId, events, deps) {
  // 先写 captured 状态再搬家：顺序保证「被俘」立即对外生效，窗口里看到的是已俘状态。
  // 内部搬家通过 `_captureRelocatingSeats` 瞬态放行 movementError 的自己那条限制，
  // 结算结束（无论成功失败）立即清除；与 state._enemyAttackResolving 同一套进程内瞬态写法。
  state._captureRelocatingSeats ||= []
  if (!state._captureRelocatingSeats.includes(seat)) state._captureRelocatingSeats.push(seat)
  try {
    deps.relocateInvestigator(state, seat, destinationId, events, null, { reason: 'effect' })
  } finally {
    const index = state._captureRelocatingSeats.indexOf(seat)
    if (index >= 0) state._captureRelocatingSeats.splice(index, 1)
    if (!state._captureRelocatingSeats.length) delete state._captureRelocatingSeats
  }
}

export function createCapture(deps) {
  function captureSeat(state, seat, options = {}, events = []) {
    const inv = (state.investigators || [])[seat]
    if (!inv || inv.defeated || inv.resigned) return false
    // 幂等：已俘者再次被俘不重复返手/转移。
    if (isCaptured(state, seat)) return false
    // 首次剧情文本要读的剧情卡号必须在「翻面（剧情面离场）」之前确定。
    const story = storyCaptureSpec(state, deps)
    const storyCode = story ? String(story.asset.originalCode || story.asset.code) : null
    const destinationId = captureDestination(state, seat, options, events, deps)
    if (!destinationId) {
      deps.info(state, events, `⛓️ ${inv.name} 被俘，但拘禁室不在场且没有可用的关押地点（效果未结算）。`)
      return false
    }
    // 1) 手槽支援返手（印刷第一句）。
    const returned = returnHandSlotAssets(state, inv, events, deps)
    // 2) 解除所有交战（被俘者不能被交战）。
    for (const enemyId of [...(inv.engaged || [])]) {
      const enemy = (state.enemies || []).find(item => item.id === enemyId)
      if (enemy) deps.disengageEnemy(state, enemy)
    }
    // 3) 权威状态：mechanicState.captured（本文件的唯一写点）。
    const store = mechanicState(state, true)
    store.captured ||= { storyShown: false, seats: {} }
    const first = store.captured.storyShown !== true
    store.captured.seats[String(seat)] = {
      locationId: destinationId,
      round: state.round,
      source: options.source == null ? null : String(options.source),
    }
    store.captured.storyShown = true
    // 4) 搬到拘禁室（内部放行，见 relocateCaptured）。
    relocateCaptured(state, seat, destinationId, events, deps)
    // 5) 钥匙按来源要求转移（'destination' / `enemy:<id>` / 'none' / 显式 holder）。
    const keysMoved = moveKeysTo(state, seat, keyDestinationOf(options.keysTo, destinationId), deps)
    // 6) 首次剧情文本 + 日志。
    if (first && options.readText !== false) firstCaptureText(state, events, deps, storyCode)
    const cells = (state.locations || []).find(location => location.id === destinationId)
    deps.info(state, events, `⛓️ ${inv.name} 被俘，关入「${cells?.name || destinationId}」。`
      + (returned.length ? `（${returned.length} 张手槽支援返回手牌）` : '')
      + (keysMoved ? `（${keysMoved} 把钥匙转移）` : ''))
    // 7) 剧本级「被俘时」强制：当前议程条目声明 agendaRule.onCaptured。batch 抑制递归
    //    （07233b 的批量俘获不能再次触发自己的「被俘→推进」）。
    if (options.batch !== true) {
      const agenda = (state.agendas || [])[state.agendaIndex]
      const rule = deps.registeredEntry(agenda?.originalCode || agenda?.code)?.agendaRule
      if (typeof rule?.onCaptured === 'function') {
        rule.onCaptured(state, agenda, deps.scenarioRuntime(state, events),
          { seat, location: destinationId, source: options.source ?? null })
      }
    }
    return true
  }

  function freeCapturedSeat(state, seat, options = {}, events = []) {
    const store = capturedStore(state)
    const key = seatKey(seat)
    if (!store?.seats || key == null || !store.seats[key]) return false
    delete store.seats[key]
    const inv = (state.investigators || [])[seat]
    if (options.silent !== true) deps.info(state, events, `🔓 ${inv?.name || '调查员'} 被解救，不再被俘。`)
    return true
  }

  return { captureSeat, freeCapturedSeat }
}
