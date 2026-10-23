// 遗留记忆（Memento）、看守人（Watcher）与战役资产入牌组 —— 第 2 步 P2.10。
//
// 这三件事共用一层：**战役记录**（`state.campaign.records`，纯 JSON、随存档往返）。
//   · Memento 不是印刷关键词，而是 10 个战役日志条目（参考实现 Memento.hs 的枚举）；
//     发现时写入 `mementosDiscovered: string[]`，划掉时移除，幕间/结局按数量分支。
//   · 看守人用两个集合记录跨章追踪：`youAreBeingHunted`（被追捕的座位）与
//     `wasTakenByTheWatcher`（被带走的调查员卡号）；都是公开信息，进观察投影。
//   · 战役资产入牌组（机关盒/黑书/钥匙）走 `campaignCardChange(campaign, seat, code, 'add')`：
//     加入战役牌组但不占 30 张、不被洗牌，下一章开始时随牌组一起带入。
//
// 本模块不新增引擎状态字段：记录键由战役 `recordSchema` 声明（TCU 的 shared.js 在 P8 写），
// 这里只提供读写与计数，并在写入前校验 memento id 合法。

export const MEMENTO_RECORD = 'mementosDiscovered'
export const WATCHER_RECORD = 'youAreBeingHunted'
export const WATCHER_TAKEN_RECORD = 'wasTakenByTheWatcher'

// 参考实现的 10 个 Memento（英文枚举即稳定 id；中文名由战役 recordLabels 提供）。
export const MEMENTOS = Object.freeze([
  'mesmerizingFlute', 'strangeIncantation', 'ritualComponents', 'scrapOfTornShadow',
  'gilmensJournal', 'keziahsFormulae', 'wornCrucifix', 'wispOfSpectralMist',
  'cornHuskDoll', 'bloodyTreeCarvings',
])

export function isMemento(id) {
  return MEMENTOS.includes(String(id))
}

function record(state) {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}

function asSet(state, key) {
  const value = record(state)[key]
  return Array.isArray(value) ? [...value] : []
}

// 发现 Memento：去重写入 `mementosDiscovered`。
export function recordMemento(state, id) {
  if (!isMemento(id)) throw new Error(`未知的遗留记忆：${JSON.stringify(id)}`)
  const list = asSet(state, MEMENTO_RECORD)
  if (!list.includes(id)) list.push(id)
  record(state)[MEMENTO_RECORD] = list
  return list
}

// 划掉 Memento（幕间/剧本可能要求移除）。
export function crossOffMemento(state, id) {
  if (!isMemento(id)) throw new Error(`未知的遗留记忆：${JSON.stringify(id)}`)
  const list = asSet(state, MEMENTO_RECORD).filter(value => value !== id)
  record(state)[MEMENTO_RECORD] = list
  return list
}

export function mementosDiscovered(state) {
  return asSet(state, MEMENTO_RECORD)
}

export function mementoCount(state) {
  return mementosDiscovered(state).length
}

export function hasMemento(state, id) {
  return mementosDiscovered(state).includes(id)
}

// 看守人：座位被追捕 / 被带走的调查员卡号（都是 string[] 记录）。
export function markHunted(state, seat) {
  const list = asSet(state, WATCHER_RECORD)
  const key = String(seat)
  if (!list.includes(key)) list.push(key)
  record(state)[WATCHER_RECORD] = list
  return list
}

export function clearHunted(state, seat) {
  const list = asSet(state, WATCHER_RECORD).filter(value => value !== String(seat))
  record(state)[WATCHER_RECORD] = list
  return list
}

export function isBeingHunted(state, seat) {
  return asSet(state, WATCHER_RECORD).includes(String(seat))
}

export function markTakenByWatcher(state, code) {
  const list = asSet(state, WATCHER_TAKEN_RECORD)
  if (!list.includes(String(code))) list.push(String(code))
  record(state)[WATCHER_TAKEN_RECORD] = list
  return list
}

export function takenByWatcher(state) {
  return asSet(state, WATCHER_TAKEN_RECORD)
}

// 公开投影：Memento 名单与被追捕座位都是桌面公开信息。
// 只有非空时才输出字段，避免给不使用这些机制的战役新增观察键。
export function watcherAndMementoProjection(state) {
  const out = {}
  const mementos = mementosDiscovered(state)
  if (mementos.length) out.mementos = [...mementos]
  const hunted = asSet(state, WATCHER_RECORD)
  const taken = takenByWatcher(state)
  if (hunted.length || taken.length) out.watcher = { huntedSeats: hunted.map(Number), taken }
  return out
}
