// 诡镇奇谈：卡牌版 · 时机窗口注册表（Window Registry）
//
// P0-A 的一部分。引擎此前用字符串 `when` 直接调 reactionWindow，标签表散在
// engine.js 的 WINDOW_LABELS 里，既无法约束拼写，也没有「这个窗口属于谁、按什么
// 顺序结算、上限怎么算」的统一说明。本文件把这些事实集中成一张表。
//
//   registerWindow(id, { label, kind, order })
//     kind: 'interrupt'（事件结算前，可取消/替换）
//           'reaction' （事件结算后，可追加效果）
//           'player'   （免费触发窗口，由玩家主动使用能力）
//
// 约定：
//   · 窗口 id 稳定；能力描述子里写 `trigger: 'enemyAttack'` 或 'window:enemyAttack' 等价。
//   · 未注册的 id 不会阻止结算（战役行为可以临时开窗口），但会记进 unknownWindows()，
//     供审计脚本与测试发现拼写漂移。
//   · windowInstanceKey 只用于「每次触发限一次」这类限制，不参与存档格式。

const DEFS = new Map()
const UNKNOWN = new Set()

const define = (id, label, kind = 'reaction', order = 100) => DEFS.set(id, Object.freeze({ id, label, kind, order }))

// 既有窗口：engine.js 的 reactionWindow 调用点与 card-effects.js 的 reaction.when。
for (const [id, label, kind] of [
  ['encounterDrawn', '抽取遭遇卡后', 'reaction'],
  ['treachery', '抽取诡计卡后（显现前）', 'interrupt'],
  ['testBegins', '技能检定开始时', 'reaction'],
  ['tokenReveal', '揭示混乱标记时', 'interrupt'],
  ['symbolRevealed', '揭示符号标记后', 'reaction'],
  ['negativeTokenRevealed', '揭示负修正标记后', 'reaction'],
  ['testWouldFail', '检定将要失败时', 'interrupt'],
  ['wouldSucceedTest', '检定将要成功时', 'reaction'],
  ['skillTestFailed', '检定失败后', 'reaction'],
  ['investigateFail', '调查检定失败后', 'reaction'],
  ['enemySpawn', '敌人生成时', 'reaction'],
  ['defeatEnemy', '击败敌人后', 'reaction'],
  ['wouldDefeat', '敌人将要被击败时', 'interrupt'],
  ['enemyAttack', '敌人攻击时', 'interrupt'],
  ['opportunityAttack', '趁乱攻击时', 'interrupt'],
  ['harmDealt', '伤害/恐惧分配时', 'interrupt'],
  ['evadeSuccess', '躲避成功后', 'reaction'],
  ['evadeFail', '躲避失败后', 'reaction'],
  ['attackFail', '攻击失败后', 'reaction'],
  ['activateFirearmFight', '使用枪械攻击时', 'reaction'],
  ['actionResolvedAtLocation', '本地点一次行动结算后', 'reaction'],
  ['enemyPhaseBegins', '敌人阶段开始时', 'reaction'],
  ['phaseBegins', '阶段开始时', 'reaction'],
  ['turnBegins', '回合开始时', 'reaction'],
]) define(id, label, kind)

// 旧式 triggerReaction 通道使用的窗口（engine.js 与战役 behavior 的调用点）。
// 它们与 reactionWindow 的窗口共享同一份注册表，能力层描述子因此也能挂在这些时机上。
for (const [id, label] of [
  ['assetEnteredPlay', '支援入场后'],
  ['damagePlaced', '伤害被放置后'],
  ['enemyAttackDamage', '敌人攻击造成伤害时'],
  ['locationRevealed', '地点揭示后'],
  ['move', '移动后'],
  ['revelationTest', '显现检定后'],
  ['revelationTestAlly', '队友显现检定后'],
  ['skillTestFail', '技能检定失败后'],
  ['skullRevealed', '揭示骷髅标记后'],
  ['spellPlayed', '打出法术卡后'],
  ['treacheryTestSuccess', '诡计检定成功后'],
  ['wouldDefeatByHorror', '因恐惧将要被击败时'],
  // Phase 5（5b-6）：02230「幸运骰子」等旧式反应在揭示混乱标记后触发；
  // 旧式 reactionWindow 早就在用这个时机，只是没进注册表（能力层因此挂不上去）。
  ['chaosTokenRevealed', '揭示混乱标记后'],
]) define(id, label, 'reaction', 70)

// P0-A 新增窗口：能力层需要的时机，引擎在对应位置开窗。
// 注意：注册 ≠ 已接线；下面每一个都在 engine.js 有确切的 openAbilityWindow /
// triggerReaction 调用点，新增窗口时请同时补上调用点与测试。
define('cardDrawn', '抽取卡牌后', 'reaction', 60)
define('clueDiscovered', '发现线索后', 'reaction', 61)
define('investigateSuccess', '调查成功后', 'reaction', 62)
define('skillTestSuccess', '技能检定成功后', 'reaction', 62)
define('discoverClue', '发现线索前', 'interrupt', 63)
define('scenarioStarts', '冒险开始时', 'reaction', 64)
define('enemyEngaged', '与敌人交战后', 'reaction', 65)
// 「被击败时」的强制效果（黑山羊眷族的临死反噬）在敌人离场后、剧本结算/胜利区之前开窗。
define('enemyDefeated', '敌人被击败时', 'reaction', 39)
// 「你所在地点有调查员/盟友/敌人被击败后」（04026 彩饰骷髅）。
define('defeatAtLocation', '本地点有卡牌被击败后', 'reaction', 40)
// 回合结束时按敌人逐个开窗（坚韧的黑山羊幼崽「治愈 2 点伤害」）。
define('enemyRoundEnd', '回合结束时（敌人）', 'reaction', 38)
define('horrorPlaced', '受到恐惧后', 'reaction', 66)
define('damageAssignedToSelf', '伤害分配到支援时', 'interrupt', 67)
// 第四循环P2.1：地点闹鬼能力即将结算（可取消/替代）。
// 调用点在 src/engine/haunted.js 的 resolveHaunted；卡面用 interrupt 把 context.cancelled 置真。
define('haunted', '结算闹鬼能力时', 'interrupt', 41)
// 第五步 M1 调查员批次（P6）的三个窗口：
//   horrorHealed  —— 卡牌效果治疗恐惧之后（「卡洛琳·弗恩」的回合并行读点，调用点在
//                    src/engine/harm-threat.js 的 healHorrorFrom，所有治疗恐惧都走那一处）；
//   cardCancelled —— 你拥有的一张卡取消/忽略了卡牌或游戏效果之后（「黛安娜·史丹利」）；
//                    调用点见 src/engine/cancel-note.js 的调用方清单；
//   enemyAttacked —— 敌人攻击一名调查员之后（序章故事调查员的反应）。
define('horrorHealed', '治疗恐惧后', 'reaction', 68)
define('cardCancelled', '卡牌效果被取消后', 'reaction', 69)
define('enemyAttacked', '敌人攻击后', 'reaction', 70)
// 密谋将要因达到毁灭阈值而推进（05018 神秘乐曲）。调用点在 src/engine/act-agenda.js 的 checkAgenda，
// 窗口内把 state.agendaDoomLock 写成本轮/本阶段即阻止这次推进。
define('agendaWouldAdvance', '密谋将要因毁灭阈值推进时', 'reaction', 71)

// 玩家窗口（免费触发）。engine.js 的 playerWindow(timing) 使用这批 id。
for (const [id, label] of [
  ['test.beforeCommit', '检定开始、投入前'],
  ['test.afterCommit', '投入结束、揭示标记前'],
  ['mythos.afterEncounter', '遭遇牌结算后'],
  ['enemy.afterHunters', '猎手移动后、敌人攻击前'],
  ['enemy.afterAttacks', '敌人攻击结束'],
  ['upkeep.end', '重整结束'],
  ['investigation.afterAction', '行动结束'],
]) define(id, label, 'player', 200)

export function registerWindow(id, meta = {}) {
  if (typeof id !== 'string' || !id) throw new Error('窗口 id 必须是非空字符串')
  const previous = DEFS.get(id)
  DEFS.set(id, Object.freeze({
    id,
    label: meta.label || previous?.label || id,
    kind: meta.kind || previous?.kind || 'reaction',
    order: Number.isFinite(meta.order) ? meta.order : (previous?.order ?? 100),
  }))
  return id
}

export function windows() {
  return [...DEFS.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

export function windowDefinition(id) {
  return DEFS.get(id) || null
}

export function isKnownWindow(id) {
  return DEFS.has(id)
}

export function windowLabel(id) {
  return DEFS.get(id)?.label || id
}

export function windowKind(id) {
  return DEFS.get(id)?.kind || 'reaction'
}

// 能力描述子里 trigger 的规范写法；openWindow 的 id 也用它比对。
export function windowTrigger(id) {
  return `window:${id}`
}

export function normalizeTrigger(trigger) {
  if (trigger == null) return []
  const list = Array.isArray(trigger) ? trigger : [trigger]
  return list.map(value => String(value)).map(value => (value.startsWith('window:') ? value.slice('window:'.length) : value))
}

export function noteUnknownWindow(id) {
  if (id && !DEFS.has(id)) UNKNOWN.add(String(id))
}

export function unknownWindows() {
  return [...UNKNOWN].sort()
}

// ---------------------------------------------------------------------------
// 玩家窗口标签（保留旧导出名，engine 与内容层都可继续使用）。
// ---------------------------------------------------------------------------

export function registerPlayerWindow(id, label) {
  return registerWindow(id, { label, kind: 'player', order: 200 })
}

export function playerWindowLabel(id) {
  return windowLabel(id)
}

export function playerWindows() {
  return windows().filter(entry => entry.kind === 'player').map(({ id, label }) => ({ id, label }))
}

// ---------------------------------------------------------------------------
// 上限键：每次触发算一次实例。同一角色在同一回合/阶段里重复打开同名窗口，
// 通过 turnSerial 与上下文特征区分，保证「每次触发限一次」不跨触发误判。
// ---------------------------------------------------------------------------

export function windowInstanceKey(state, windowId, context = {}) {
  const parts = [windowId, state?.round ?? 0, state?.phase ?? '-', state?.turnSerial ?? 0]
  if (context.enemy?.id) parts.push(`e:${context.enemy.id}`)
  if (context.asset?.id) parts.push(`a:${context.asset.id}`)
  if (context.cardCode) parts.push(`c:${context.cardCode}`)
  if (context.token) parts.push(`t:${context.token}`)
  if (context.location) parts.push(`l:${context.location}`)
  if (context.seat != null) parts.push(`s:${context.seat}`)
  if (state?.skillTest?.id) parts.push(`st:${state.skillTest.id}`)
  return parts.join('/')
}
