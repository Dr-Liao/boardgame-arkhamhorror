// 八循环《绯红密钥》（The Scarlet Keys）P4 引擎交互事务层。
//
// 定位：把 P1 机制扫描里的交互机制（隐匿揭露 / 密钥变换与夺取 / 空洞回收 / 世界地图启程 /
// 定制勾选 / 跨座位即时行动）收敛成**规则侧选择事务**：候选只从权威状态枚举，选择统一走
// `mechanic-choices.js#selectMechanic` 的 opaque `pick:N` / `confirm` / `cancel` 选项，
// 写入统一走 P2 原语；本文件不复制状态、不写卡号、不碰 UI。
//
// 事务契约（与 resolution.js 配合，与 EotE/TIC 的 P4 交互层同一口径）：
//   · 所有玩家决策走 selectMechanic 的 pending choice；恢复时由 resolution 用同一 execute 重放，
//     因此**任何写入都发生在最后一个选择之后**，取消 / 空候选在写入前返回（无半写状态）；
//   · 空强制候选集在进入 requestChoice 之前返回 false/null，不产生 pending choice / 软锁；
//   · 伪造或过期 option id 由 requestChoice 的恢复凭据校验拒绝（见 resolution.js）；
//   · 隐私：隐匿迷你卡候选只给「位置」，不给真身/诱饵身份（揭露结果由权威层返回）；
//     密钥持有关系是公开信息；地图候选只含目的地与耗时，不返回图结构内部字段。
import { investigatorAt } from './mechanic-state.js'
import { selectMechanic } from './mechanic-choices.js'
import { concealTargetScope, concealedAt, exposeMiniCard, reshuffleConcealed } from './tsk-concealed.js'
import { hollowCards, recallHollow } from './tsk-hollow.js'
import { bindKey, initializeScarletKeys, keyShiftedThisRound, keysHeldBy, scarletKey, shiftKey, stealKey } from './tsk-scarlet-keys.js'
import { embarkOptions, forcedDestination, travelTo, useExpeditedTicket } from './tsk-map.js'
import {
  customizationChecked, customizationOptions, upgradeCustomization,
} from './tsk-customizable.js'
import { crossSeatActionPending, grantCrossSeatAction, takeCrossSeatAction } from './tsk-investigator.js'
import { tskScenarioState } from './tsk-state.js'

const isNonEmptyString = value => typeof value === 'string' && value.length > 0
const integer = (value, min, label, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(`${label} 必须是 ${min}–${max} 的整数`)
  return value
}
const assertSeat = (state, seat) => investigatorAt(state, seat)
const assertOptional = value => {
  if (typeof value !== 'boolean') throw new TypeError('optional 必须是布尔值')
  return value
}
const POSITION_LABEL = Object.freeze({ left: '左侧阴影位置', middle: '中间阴影位置', right: '右侧阴影位置' })
const positionLabel = position => POSITION_LABEL[position] || '地点正面'
const alive = inv => inv && !inv.defeated && !inv.resigned
// 当前能力来源（卡/资产实体 id）。由 createTskInteractions 的公开方法包装器临时设置，
// 让所有 selectMechanic 选择带上 `source`，浏览器端据此在取消/结算后把焦点还给来源实体。
let pendingSource = null
const chooseOne = (state, seat, { operation, stage = 'items', prompt, candidates, optional = true, source = null }) => {
  if (!candidates.length) return null
  const chosen = selectMechanic(state, seat, { operation, stage, prompt, candidates, min: 1, max: 1, optional, source: source ?? pendingSource })
  return chosen?.[0] ?? null
}
const chooseMany = (state, seat, { operation, stage = 'items', prompt, candidates, min, max = min, optional = false, source = null }) => {
  if (candidates.length < min) return null
  return selectMechanic(state, seat, { operation, stage, prompt, candidates, min, max, optional, source: source ?? pendingSource })
}

/**
 * 创建 TSK 交互事务集合。`state` 是当前规则事务的 draft；`deps` 只放可注入的确定性依赖：
 *   · deps.shuffle(cards) —— 隐匿迷你卡轮末重排的确定性洗牌回调（不提供时走 randomValue(state)）。
 */
export function createTskInteractions(state, deps = {}) {
  void state
  void deps

  // ── 隐匿迷你卡：揭露（Expose）/ 轮末重排 / 读数 ───────────────────────────────────────────
  const concealed = {
    /** 揭露同地点的一张隐匿迷你卡：候选只显示位置，不泄露真身/诱饵身份。 */
    expose(seat, { optional = true } = {}) {
      const inv = assertSeat(state, seat)
      assertOptional(optional)
      const cards = concealedAt(state, inv.location)
      if (!cards.length) return false
      const candidates = cards.map(card => ({
        value: card.id,
        label: `隐匿迷你卡（${positionLabel(card.position)}）`,
        uiKey: `tsk-concealed:${card.id}`,
      }))
      const id = chooseOne(state, seat, { operation: 'tskConcealed', stage: 'items', prompt: '选择要揭露的隐匿迷你卡', candidates, optional })
      return id == null ? false : exposeMiniCard(state, id)
    },
    /** 轮末重排：不增删迷你卡，只在其当前地点/位置之间洗混。 */
    reshuffle(seat, { shuffle = undefined } = {}) {
      assertSeat(state, seat)
      return reshuffleConcealed(state, { shuffle: shuffle ?? deps.shuffle }).length
    },
    /** 读数：该地点可被攻防的迷你卡位置范围（供 P4 面板与测试）。 */
    scope(seat, miniCardId) {
      assertSeat(state, seat)
      if (!isNonEmptyString(miniCardId)) throw new TypeError('迷你卡 id 必须是非空字符串')
      return concealTargetScope(state, miniCardId)
    },
  }

  // ── 绯红密钥：变换（Shift）/ 转移（含敌人夺取）──────────────────────────────────────────
  const keys = {
    shift(seat, { keyId = null, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (keyId != null && !isNonEmptyString(keyId)) throw new TypeError('密钥 id 必须是非空字符串')
      const held = keysHeldBy(state, { type: 'investigator', seat })
        .filter(id => keyId == null || id === keyId)
        .filter(id => !keyShiftedThisRound(state, id))
      if (!held.length) return false
      const candidates = held.map(id => {
        const record = scarletKey(state, id)
        return {
          value: id,
          label: `${id} · ${record.stable ? '稳定面' : '动荡面'}`,
          uiKey: `tsk-key:${id}`,
        }
      })
      const chosen = chooseOne(state, seat, { operation: 'tskKey', stage: 'keys', prompt: '选择要变换（翻面）的绯红密钥', candidates, optional })
      return chosen == null ? false : shiftKey(state, chosen)
    },
    /**
     * 转移密钥：把 seat 持有的一把密钥交给另一名调查员（bind）或一名敌人（steal，翻动荡面）。
     * `to` 为 null 时开第二个选择步骤；目标必须是活着的其他调查员或在场敌人。
     */
    transfer(seat, { keyId = null, to = null, steal = false, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (typeof steal !== 'boolean') throw new TypeError('steal 必须是布尔值')
      if (keyId != null && !isNonEmptyString(keyId)) throw new TypeError('密钥 id 必须是非空字符串')
      const held = keysHeldBy(state, { type: 'investigator', seat }).filter(id => keyId == null || id === keyId)
      if (!held.length) return false
      const candidates = held.map(id => ({ value: id, label: `密钥 ${id}`, uiKey: `tsk-key:${id}` }))
      const chosenKey = chooseOne(state, seat, { operation: 'tskKey', stage: 'keys', prompt: '选择要转移的绯红密钥', candidates, optional })
      if (chosenKey == null) return false
      let recipient = to
      if (recipient == null) {
        const others = (state.investigators || []).filter(inv => inv.seat !== seat && alive(inv))
        const enemies = (deps.enemies || state.enemies || []).filter(enemy => enemy && isNonEmptyString(enemy.id) && enemy.location)
        if (!others.length && !enemies.length) return false
        const options = [
          ...others.map(inv => ({ value: `investigator:${inv.seat}`, label: inv.name || `调查员 ${inv.seat + 1}`, uiKey: `investigator:${inv.seat}` })),
          ...enemies.map(enemy => ({ value: `enemy:${enemy.id}`, label: '敌人', uiKey: `enemy:${enemy.id}` })),
        ]
        recipient = chooseOne(state, seat, { operation: 'tskKey', stage: 'recipient', prompt: '选择密钥的接收者', candidates: options, optional })
        if (recipient == null) return false
      }
      if (typeof recipient === 'string') {
        const [kind, ...rest] = recipient.split(':')
        const id = rest.join(':')
        if (kind === 'investigator') return steal ? stealKey(state, chosenKey, { type: 'investigator', seat: Number(id) }) : bindKey(state, chosenKey, { type: 'investigator', seat: Number(id) })
        if (kind === 'enemy') return stealKey(state, chosenKey, { type: 'enemy', enemyId: id })
        throw new TypeError(`未知密钥接收者 ${recipient}`)
      }
      if (typeof recipient === 'object') return steal ? stealKey(state, chosenKey, recipient) : bindKey(state, chosenKey, recipient)
      throw new TypeError('密钥接收者无效')
    },
  }

  // ── 空洞：回收一张空洞卡（洗回牌库 / 放回手牌 / 进弃牌堆）──────────────────────────────────
  const hollows = {
    recall(seat, { to = 'discard', optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (!['deck', 'hand', 'discard'].includes(to)) throw new TypeError('空洞回收目标必须是 deck/hand/discard')
      const cards = hollowCards(state)
      if (!cards.length) return false
      const candidates = cards.map(card => ({ value: card.code, label: `空洞卡 ${card.code}`, uiKey: `tsk-hollow:${card.code}` }))
      const chosen = chooseOne(state, seat, { operation: 'tskHollow', stage: 'items', prompt: '选择要回收的空洞卡', candidates, optional })
      if (chosen == null) return false
      return recallHollow(state, chosen, { to })
    },
  }

  // ── 世界地图：启程目的地选择（含快捷旅票直达）─────────────────────────────────────────────
  const map = {
    /**
     * 启程：从当前节点选择目的地。时间达到强制阈值时只能选择强制目的地（候选自动收敛）。
     * `expedite=true` 走快捷旅票（记 1 时间、无需解锁）；图结构由调用方（内容层/夹具）传入。
     */
    embark(seat, { graph = null, expedite = false, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (typeof expedite !== 'boolean') throw new TypeError('expedite 必须是布尔值')
      if (!graph || !Array.isArray(graph.nodes)) throw new TypeError('启程需要 { nodes } 世界地图图结构')
      const options = embarkOptions(state, { graph })
      const forced = forcedDestination(state) ?? options.forced ?? null
      // 普通启程只能去已解锁节点；强制目的地由剧情指定、无需解锁；快捷旅票可直达任意（含锁定）节点。
      const reachable = options.options.filter(option => option.reachable && option.destination !== options.from
        && (forced != null ? option.destination === forced : (expedite ? true : option.unlocked)))
      if (!reachable.length) return false
      const candidates = reachable.map(option => ({
        value: option.destination,
        label: expedite
          ? `${option.destination}（快捷旅票 · 1 时间）`
          : `${option.destination}（耗时 ${option.cost}${option.unlocked ? '' : ' · 未解锁'}）`,
        uiKey: `tsk-map:${option.destination}`,
      }))
      const chosen = chooseOne(state, seat, { operation: 'tskMap', stage: 'destination', prompt: expedite ? '选择快捷旅票的目的地' : '选择启程目的地', candidates, optional })
      if (chosen == null) return false
      return expedite ? useExpeditedTicket(state, { graph, destination: chosen }) : travelTo(state, { graph, destination: chosen })
    },
  }

  // ── 定制升级卡：勾选面板（逐格选择，写入走 upgradeCustomization）───────────────────────────
  const customizable = {
    upgrade(seat, { code = null, availableXp = 0, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (!isNonEmptyString(code)) throw new TypeError('定制卡需要卡号')
      integer(availableXp, 0, '可用经验', 99)
      const options = customizationOptions(code)
      if (!options) throw new RangeError(`卡 ${code} 没有注册定制选项`)
      const checked = customizationChecked(state, seat, code)
      const used = new Map()
      for (const index of checked) used.set(index, (used.get(index) || 0) + 1)
      const candidates = options.flatMap((option, index) => {
        const already = used.get(index) || 0
        return Array.from({ length: Math.max(0, option.checks - already) }, (_, box) => ({
          value: index,
          label: `${option.name} · 第 ${already + box + 1} 格`,
          uiKey: `tsk-custom:${code}:${index}:${already + box + 1}`,
        }))
      })
      if (!candidates.length) return false
      const chosen = chooseMany(state, seat, {
        operation: 'tskCustomizable', stage: 'boxes', prompt: '选择要勾选的定制格', candidates,
        min: 1, max: Math.min(candidates.length, 10), optional,
      })
      if (!chosen || !chosen.length) return false
      const next = [...checked, ...chosen].sort((left, right) => left - right)
      return upgradeCustomization(state, { seat, code, checked: next, availableXp })
    },
  }

  // ── 跨座位即时行动：授权同地点队友（每轮每目标一次）与消耗授权 ─────────────────────────────
  const crossSeat = {
    grant(seat, { optional = true } = {}) {
      const inv = assertSeat(state, seat)
      assertOptional(optional)
      const grants = tskScenarioState(state)?.crossSeat?.grants || {}
      const round = Number.isSafeInteger(state.round) ? state.round : 0
      const others = (state.investigators || []).filter(other => other.seat !== seat && alive(other)
        && other.location === inv.location
        && !(grants[other.seat] || []).some(grant => grant.round === round))
      if (!others.length) return false
      const candidates = others.map(other => ({ value: other.seat, label: other.name || `调查员 ${other.seat + 1}`, uiKey: `investigator:${other.seat}` }))
      const chosen = chooseOne(state, seat, { operation: 'tskCrossSeat', stage: 'target', prompt: '选择获得即时行动的队友', candidates, optional })
      return chosen == null ? false : grantCrossSeatAction(state, { fromSeat: seat, targetSeat: chosen })
    },
    /** 消耗当前座位的跨座位授权（目标座位开始执行行动时调用）。 */
    take(seat) {
      assertSeat(state, seat)
      return takeCrossSeatAction(state, seat)
    },
    pending(seat) {
      assertSeat(state, seat)
      return crossSeatActionPending(state, seat)
    },
  }

  // 公开方法统一包装：允许调用方在选项对象里传 `source`（来源实体 id），期间设置 pendingSource。
  const groups = { concealed, keys, hollows, map, customizable, crossSeat }
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

/** 供 P4 夹具/测试复用的密钥初始化便捷入口（不写卡号，只登记内容层给的面）。 */
export function seedTskKeys(state, specs) {
  return initializeScarletKeys(state, specs)
}
