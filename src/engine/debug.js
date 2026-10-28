// 调试控制台 · 引擎侧原语（2026-10-28 起，契约：artifacts/debug-console/CONTRACT.md §3 / §10）。
//
// 职责边界：
//   · 调试 move 永不出现在 legalMoves（AI 与普通 UI 看不到），只能由大厅调试入口提交；
//   · 校验是纯函数 debugMoveError：不要求 actingSeats 包含 seat，因此任何时机都可用；
//   · 执行由 dispatch.js#executeCommand 在 inHub 判断之前直接调用，完全绕过行动点 /
//     借机攻击 / 行动类型；真正的状态修改仍发生在 applyMove 事务里，所以 actionLog、
//     重放与撤销链不受影响；
//   · 公共线索（state.clues）由 applyMove 收尾的 syncClues 统一收敛，这里不手写。
//
// v1.1（2026-10-29，契约 §10）：新增 draw / actions / moveTo / heal / harm / reveal / doom
// 七种 kind，并把 card 扩展到目标区域 hand / deckTop / deckBottom / discard；既有 kind 语义不变。
//
// 注意：本文件不得出现 5 位卡号或内容实体 id 字面量（tests/architecture-guard.test.mjs、
// tools/hardcode-audit.mjs 会扫描 src/engine/**）；关卡、卡牌与敌人一律按战役清单与
// 卡面数据表查。
import { contentRegistry } from '../../content/registered.js'
import { cardDef, enemyDef } from './card-lookup.js'

// 允许通过调试指令发放的玩家卡类型（永久卡另有排除，见 debugMoveError）。
const PLAYER_CARD_TYPES = new Set(['asset', 'event', 'skill'])
const MIN_AMOUNT = 1
const MAX_AMOUNT = 999
// card kind 的放置区域（缺省 hand，行为与 §3.1 一致）。
const CARD_ZONES = ['hand', 'deckTop', 'deckBottom', 'discard']
const ZONE_LABELS = { hand: '手牌', deckTop: '牌库顶', deckBottom: '牌库底', discard: '弃牌堆' }

export function isDebugMove(move) {
  return move?.action === 'debug'
}

function campaignScenarioIds(state) {
  if (!state.campaign?.id) return []
  return contentRegistry.getCampaign(state.campaign.id)?.scenarioIds || []
}

function locationExists(state, locationId) {
  return (state.locations || []).some(location => location.id === locationId)
}

// 目标座位必须是存在且未败退/撤退的调查员；返回调查员对象，否则 null。
function targetInv(state, targetSeat) {
  if (!Number.isInteger(targetSeat)) return null
  const inv = state.investigators?.[targetSeat]
  if (!inv || inv.defeated || inv.resigned) return null
  return inv
}

function validAmount(amount) {
  return Number.isSafeInteger(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT
}

// draw / actions 的 amount 缺省为 1（契约 §10.1 的默认值；解析层通常已显式给出）。
function amountOrDefault(move) {
  return move?.amount === undefined ? 1 : move.amount
}

// heal / harm 的可选伤害/恐惧：缺省或 0 视为不结算该项；出现时必须 1..999。
// 返回 null 表示数量非法；全为 0 表示「至少一项」不满足（由调用方给出对应错误文案）。
function damageHorrorValues(move) {
  const values = { damage: move?.damage ?? 0, horror: move?.horror ?? 0 }
  for (const key of ['damage', 'horror']) {
    if (values[key] === 0) continue
    if (!validAmount(values[key])) return null
  }
  return values
}

// card kind 的目标区域：缺省 hand，未知值在 debugMoveError 里拒绝。
function cardZoneOf(move) {
  return move?.zone === undefined ? 'hand' : move.zone
}

// 纯函数校验：供 moves.js#validateMove 在「无效行动」之后、actingSeats/pendingChoice 之前调用。
// 返回中文错误文本或 null。不检查 revision（由 validateMove 统一处理）。
export function debugMoveError(state, seat, move) {
  if (state.status !== 'playing') return '对局已结束'
  if (state.pendingChoice) return '请先处理当前待决选择，再使用调试控制台'
  if (!state.campaign?.id) return '当前对局没有战役信息'
  switch (move?.kind) {
    case 'scenario': {
      if (typeof move.scenarioId !== 'string' || !campaignScenarioIds(state).includes(move.scenarioId)) return '未知关卡'
      return null
    }
    case 'spawn': {
      if (typeof move.code !== 'string' || !enemyDef(move.code)) return '未知敌人'
      const inv = targetInv(state, move.targetSeat)
      if (!inv) return '无效的目标调查员'
      if (!inv.location || !locationExists(state, inv.location)) return '目标调查员所在地点无效'
      return null
    }
    case 'defeat': {
      if (move.all === true) return (state.enemies || []).length ? null : '场上没有敌人'
      if (!Array.isArray(move.enemyIds) || !move.enemyIds.length) return '请指定要消灭的敌人'
      const present = move.enemyIds.some(id => (state.enemies || []).some(enemy => enemy.id === id))
      return present ? null : '场上没有指定的敌人'
    }
    case 'card': {
      const zone = cardZoneOf(move)
      if (!CARD_ZONES.includes(zone)) return '未知的放置区域（hand / deckTop / deckBottom / discard）'
      if (typeof move.code !== 'string') return '未知卡牌'
      const def = cardDef(move.code)
      if (!def) return '未知卡牌'
      if (!PLAYER_CARD_TYPES.has(def.type)) return '只能发放玩家卡（资产 / 事件 / 技能）'
      if (def.permanent) return '永久卡不能发放'
      const inv = targetInv(state, move.targetSeat)
      if (!inv) return '无效的目标调查员'
      // 缺省 hand 的「手牌已有」拦截保持 §3.1 语义；其它区域允许把同一张牌从手牌挪过去。
      if (zone === 'hand' && (inv.hand || []).includes(move.code)) return '目标手牌中已有这张牌'
      return null
    }
    case 'xp': {
      if (!validAmount(move.amount)) return '经验数量必须是 1 到 999 的整数'
      if (!Number.isInteger(move.targetSeat) || !state.campaign.investigators?.[move.targetSeat]) return '目标调查员没有战役记录'
      return null
    }
    case 'resources':
    case 'clues': {
      if (!validAmount(move.amount)) return '数量必须是 1 到 999 的整数'
      if (!targetInv(state, move.targetSeat)) return '无效的目标调查员'
      return null
    }
    // —— v1.1（契约 §10.1）——
    case 'draw': {
      if (!validAmount(amountOrDefault(move))) return '抽牌数量必须是 1 到 999 的整数'
      if (!targetInv(state, move.targetSeat)) return '无效的目标调查员'
      return null
    }
    case 'actions': {
      if (!validAmount(amountOrDefault(move))) return '行动点数量必须是 1 到 999 的整数'
      if (!targetInv(state, move.targetSeat)) return '无效的目标调查员'
      return null
    }
    case 'moveTo': {
      if (!targetInv(state, move.targetSeat)) return '无效的目标调查员'
      if (typeof move.locationId !== 'string' || !locationExists(state, move.locationId)) return '目标地点未入场'
      return null
    }
    case 'heal':
    case 'harm': {
      const values = damageHorrorValues(move)
      if (!values) return '伤害 / 恐惧数量必须是 1 到 999 的整数'
      if (!values.damage && !values.horror) return '至少需要指定伤害或恐惧'
      if (!targetInv(state, move.targetSeat)) return '无效的目标调查员'
      return null
    }
    case 'reveal': {
      // 全部揭示按「当前所有未揭示地点」逐张处理；没有未揭示地点时是空操作（不报错）。
      if (move.all === true) return null
      if (typeof move.locationId !== 'string' || !locationExists(state, move.locationId)) return '目标地点未入场'
      if (state.locations.find(location => location.id === move.locationId)?.revealed) return '该地点已经揭示'
      return null
    }
    case 'doom': {
      const amount = move.amount
      if (!Number.isSafeInteger(amount) || amount === 0 || amount < -MAX_AMOUNT || amount > MAX_AMOUNT) {
        return '毁灭调整必须是 -999 到 999 之间的非零整数'
      }
      return null
    }
    default:
      return '未知调试指令'
  }
}

// 把战役流程节点对齐到目标关卡：campaignGraph 里 type==='scenario' 且 scenarioId 匹配的节点 key。
// 找不到节点时不改 nodeId（只按 index 跳关）。同时把 visit 计数 +1：调试跳关视为一次新到访，
// 否则重打已完成的关卡时 finishScenario 的 visitId 会与旧记录重复而被判「本关已经结算」。
function enterScenarioNode(state, scenarioId, graph) {
  const nodeId = Object.entries(graph?.nodes || {})
    .find(([, node]) => node.type === 'scenario' && node.scenarioId === scenarioId)?.[0]
  if (!nodeId) return
  const campaign = state.campaign
  campaign.flow ||= { nodeId, history: [], visits: {} }
  campaign.flow.nodeId = nodeId
  campaign.flow.history ||= []
  campaign.flow.visits ||= {}
  const visit = (campaign.flow.visits[nodeId] || 0) + 1
  campaign.flow.visits[nodeId] = visit
  // effectsApplied：跳关不重放该节点的剧情文本/战役效果，只借用节点身份与后续出口。
  campaign.flow.history.push({ nodeId, visit, effectsApplied: true })
}

// 从调查员的指定区域里移走一张同 code 的牌（按传入顺序先找到先移，找不到就跳过）。
// card kind 用它避免「发一张牌」在多个区域各留一份。
function takeCardFromZones(inv, code, zones) {
  for (const zone of zones) {
    const list = inv[zone] || []
    const index = list.indexOf(code)
    if (index < 0) continue
    list.splice(index, 1)
    return
  }
}

export function createDebugExecutor(deps) {
  const {
    campaignGraph,
    campaignManifestFor,
    startScenario,
    spawnEnemy,
    defeatEnemy,
    drawCards,
    relocateInvestigator,
    revealLocation,
    checkDefeated,
    locationExists,
    info,
    locName,
    cardName,
    awardExperience,
  } = deps
  // deps.syncClues 由 engine.js 一并注入，但执行器不直接调用：公共线索是个人线索之和的
  // 派生值，统一由 applyMove 收尾的 syncClues 收敛（见 debug.js 文件头）。

  function executeScenario(state, move, events) {
    const manifest = campaignManifestFor(state)
    if (!manifest) throw new Error('当前对局没有战役信息')
    const scenarioIds = manifest.scenarioIds || []
    const index = scenarioIds.indexOf(move.scenarioId)
    if (index < 0) throw new Error('未知关卡')
    enterScenarioNode(state, move.scenarioId, campaignGraph(manifest))
    state.campaign.scenarioIndex = index
    state.campaign.flowStage = 'scenario'
    delete state.campaign.pendingNode
    delete state.campaign.pendingNextIndex
    // startScenario 会重建关卡、地点、敌人、遭遇牌堆、混乱袋与起始手牌；
    // 不调用 runMulligans：起始手牌已由 startScenario → prepareInvestigator 抽好。
    startScenario(state, index, events)
    info(state, events, `🛠️ 调试：跳到第 ${index + 1} 关「${state.scenario?.name || move.scenarioId}」。`)
  }

  function executeSpawn(state, move, events) {
    const inv = state.investigators?.[move.targetSeat]
    const enemy = spawnEnemy(state, move.code, inv?.location, move.targetSeat, true)
    if (!enemy || !state.enemies.includes(enemy)) throw new Error(`生成「${cardName(move.code)}」失败`)
    info(state, events, `🛠️ 调试：在「${locName(state, enemy.location)}」生成「${enemy.name}」。`)
  }

  function executeDefeat(state, move, events) {
    const ids = move.all === true ? state.enemies.map(enemy => enemy.id) : move.enemyIds
    const names = []
    for (const id of ids || []) {
      // 每步重新查表：defeatEnemy 可能触发反应/替代效果并改动 state.enemies。
      const enemy = state.enemies.find(item => item.id === id)
      if (!enemy) continue
      names.push(enemy.name)
      defeatEnemy(state, enemy, events)
    }
    if (!names.length) throw new Error('场上没有可消灭的敌人')
    info(state, events, `🛠️ 调试：消灭${names.map(name => `「${name}」`).join('')}。`)
  }

  function executeCard(state, move, events) {
    const inv = state.investigators[move.targetSeat]
    const code = move.code
    const zone = cardZoneOf(move)
    if (zone === 'hand') {
      // §3.1 语义不变：目标牌库/弃牌堆里已有这张牌时先取走一张再进手牌。
      takeCardFromZones(inv, code, ['deck', 'discard'])
      inv.hand.push(code)
    } else {
      // §10.1：同 code 已在手牌/牌库/弃牌堆时先移走一张，再放入目标区域，避免多出一份。
      takeCardFromZones(inv, code, ['hand', 'deck', 'discard'])
      // 牌库数组末尾是牌库顶（drawCards 用 pop 抽牌），开头是牌库底。
      if (zone === 'deckTop') inv.deck.push(code)
      else if (zone === 'deckBottom') inv.deck.unshift(code)
      else inv.discard.push(code)
    }
    info(state, events, `🛠️ 调试：将「${cardName(code)}」放入 ${inv.name} 的${ZONE_LABELS[zone]}。`)
  }

  function executeXp(state, move, events) {
    const record = state.campaign.investigators[move.targetSeat]
    awardExperience(state.campaign, move.targetSeat, move.amount)
    const name = state.investigators?.[move.targetSeat]?.name || record.name || `座位 ${move.targetSeat}`
    info(state, events, `🛠️ 调试：${name} 获得 ${move.amount} 经验（当前 ${record.xp}）。`)
  }

  function executeResources(state, move, events) {
    const inv = state.investigators[move.targetSeat]
    inv.resources += move.amount
    info(state, events, `🛠️ 调试：${inv.name} 获得 ${move.amount} 资源（当前 ${inv.resources}）。`)
  }

  function executeClues(state, move, events) {
    const inv = state.investigators[move.targetSeat]
    inv.clues += move.amount
    info(state, events, `🛠️ 调试：${inv.name} 获得 ${move.amount} 线索（当前 ${inv.clues}）。`)
  }

  // —— v1.1（契约 §10.1）——

  function executeDraw(state, move, events) {
    const inv = state.investigators[move.targetSeat]
    const amount = amountOrDefault(move)
    const texts = drawCards(state, inv, amount, events)
    for (const text of texts) info(state, events, text)
    info(state, events, `🛠️ 调试：${inv.name} 抽了 ${amount} 张牌（当前手牌 ${inv.hand.length} 张）。`)
  }

  function executeActions(state, move, events) {
    const inv = state.investigators[move.targetSeat]
    const amount = amountOrDefault(move)
    inv.actionsLeft += amount
    info(state, events, `🛠️ 调试：${inv.name} 行动点 +${amount}（当前 ${inv.actionsLeft}）。`)
  }

  function executeMoveTo(state, move, events) {
    const inv = state.investigators[move.targetSeat]
    if (!locationExists(state, move.locationId)) throw new Error('目标地点未入场')
    // 被移动限制 / 地点门禁阻止时 relocateInvestigator 会写引擎日志并原地返回：
    // 保留那条日志，不叠加「传送成功」的调试信息（契约 §10.1）。
    relocateInvestigator(state, move.targetSeat, move.locationId, events)
    if (inv.location !== move.locationId) return
    info(state, events, `🛠️ 调试：${inv.name} 传送到「${locName(state, move.locationId)}」。`)
  }

  function executeHeal(state, move, events) {
    const inv = state.investigators[move.targetSeat]
    const values = damageHorrorValues(move)
    inv.damage = Math.max(0, inv.damage - values.damage)
    inv.horror = Math.max(0, inv.horror - values.horror)
    info(state, events, `🛠️ 调试：${inv.name} 治疗后：伤害 ${inv.damage}，恐惧 ${inv.horror}。`)
  }

  function executeHarm(state, move, events) {
    const inv = state.investigators[move.targetSeat]
    const values = damageHorrorValues(move)
    // 契约：直接加值，不走 applyHarm 的支援分配；致命时由 checkDefeated 打开普通待决窗口。
    inv.damage += values.damage
    inv.horror += values.horror
    checkDefeated(state, move.targetSeat, events)
    info(state, events, `🛠️ 调试：${inv.name} 当前伤害 ${inv.damage}、恐惧 ${inv.horror}。`)
  }

  function executeReveal(state, move, events) {
    if (move.all === true) {
      const ids = state.locations.filter(location => !location.revealed).map(location => location.id)
      for (const id of ids) revealLocation(state, id, events)
      info(state, events, `🛠️ 调试：揭示全部地点（${ids.length} 张）。`)
      return
    }
    revealLocation(state, move.locationId, events)
    info(state, events, `🛠️ 调试：揭示「${locName(state, move.locationId)}」。`)
  }

  function executeDoom(state, move, events) {
    // 契约：直接改 state.doom，不调用 addDoom / checkAgenda——自动推进密谋可能抛
    // ScenarioEnded 打断调试事务。
    state.doom = Math.max(0, state.doom + move.amount)
    const delta = move.amount > 0 ? `+${move.amount}` : String(move.amount)
    info(state, events, `🛠️ 调试：毁灭 ${delta}（当前 ${state.doom}；手动调整，未自动结算密谋）。`)
  }

  function executeDebugMove(state, seat, move, events) {
    switch (move.kind) {
      case 'scenario': return executeScenario(state, move, events)
      case 'spawn': return executeSpawn(state, move, events)
      case 'defeat': return executeDefeat(state, move, events)
      case 'card': return executeCard(state, move, events)
      case 'xp': return executeXp(state, move, events)
      case 'resources': return executeResources(state, move, events)
      case 'clues': return executeClues(state, move, events)
      case 'draw': return executeDraw(state, move, events)
      case 'actions': return executeActions(state, move, events)
      case 'moveTo': return executeMoveTo(state, move, events)
      case 'heal': return executeHeal(state, move, events)
      case 'harm': return executeHarm(state, move, events)
      case 'reveal': return executeReveal(state, move, events)
      case 'doom': return executeDoom(state, move, events)
      default: throw new Error('未知调试指令')
    }
  }

  return { executeDebugMove }
}
