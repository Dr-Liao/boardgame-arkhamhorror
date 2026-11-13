import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  encounterResolveCampaignsFor, encounterResolveFor, enemyScriptFor, enemySpawnRuleFor, enemyStatRuleFor,
  isPoisonThreat, threatActionByRule, threatActionFor, vengeanceWhileFor,
  resolveDeclarativeTreacheryTest, treacheryTestFor,
} from '../../../src/cards/card-rules.js'

// 失落的时代的跨章遭遇规则。共享遭遇组（Rainforest / Serpents / Expedition /
// AgentsOfYig / GuardiansOfTime / DeadlyTraps / TemporalFlux / ForgottenRuins /
// PnakoticBrotherhood / YigsVenom / Poison）在各章重复出现，效果只写在这一份文件里。
const original = card => card?.originalCode || card?.code
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
const hasTrait = (card, trait) => traits(card).includes(String(trait).toLowerCase())
const isPoisoned = inv => (inv?.threat || []).some(card => isPoisonThreat(card.code)) || inv?.poisoned === true
const attachmentCode = attachment => original(typeof attachment === 'string' ? { code: attachment } : attachment)
const recordsFor = state => (state.campaign.records ||= {})
// 04094 一片漆黑：放在密谋牌库旁（旧存档曾只用 scenarioFlags.deepDark 计数）。
const DEEP_DARK_CODE = '04094'

// ---- 04244 伊斯人身体（跨章共享）----
// 换身后引擎把调查员卡整体换成 04244：inv.form = 'yithian'，inv.code/属性/职业都是身体卡
// （见 src/engine/investigator-form.js），原调查员卡文本因此不可用。
// 下面三条是身体卡自身印刷文本的读点；因为幕间四可能要求「余下时间继续使用这张卡」，
// 它们必须在之后每一章都生效，所以放在战役级共享规则里而不是《天机之城》章节里。
const isYithianForm = inv => inv?.form === 'yithian'

// 「你的每个[[盟友]]支援获得[[伊斯]]特性」：换身时已经在场的盟友也要获得（extra 用于入场瞬间的那张）。
export function markYithianAllies(inv, extra = null) {
  for (const asset of [...(inv?.assets || []), ...(extra ? [extra] : [])]) {
    const traits = (ALL_CARDS[asset?.code]?.traits || asset?.traits || []).map(String)
    if (traits.some(trait => ['Ally', '盟友'].includes(trait))) asset.yithianTrait = true
  }
}

function distance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from]), queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of state.locations.find(entry => entry.id === id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

function nearestWithTrait(state, from, trait) {
  const candidates = state.enemies.filter(enemy => hasTrait(enemy, trait))
  if (!candidates.length) return null
  return candidates.map(enemy => ({ enemy, steps: distance(state, from, enemy.location) }))
    .sort((left, right) => left.steps - right.steps)[0].enemy
}

// P0：调查员没有 id，只有 seat；用稳定的 key 同时覆盖实体与调查员，避免
// options 里出现 undefined id 让整局无法提交。
const choiceKey = (candidate, index) => String(candidate?.id ?? candidate?.seat ?? candidate?.code ?? index)

function chooseOne(api, request, candidates, label = candidate => candidate.name || candidate.id) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const id = api.choose({ ...request,
    options: candidates.map((candidate, index) => ({ id: choiceKey(candidate, index), label: label(candidate) })) })
  return candidates.find((candidate, index) => choiceKey(candidate, index) === id) || candidates[0]
}

function attachmentsWithCode(location, code) {
  return (location?.attachments || []).filter(item => attachmentCode(item) === code)
}

function shuffleWith(items, random) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function discardAttachment(state, location, attachment) {
  const index = (location.attachments || []).indexOf(attachment)
  if (index >= 0) location.attachments.splice(index, 1)
  const code = attachmentCode(attachment)
  if (code) state.encounterDiscard.push(code)
  return code
}

function discardThreat(state, inv, threat) {
  const index = inv.threat.indexOf(threat)
  if (index >= 0) inv.threat.splice(index, 1)
  if (threat?.code && ALL_CARDS[threat.code]?.type === 'treachery') state.encounterDiscard.push(threat.code)
}

function threatWithCode(inv, code) {
  return (inv.threat || []).find(card => original(card) === code)
}

// 威胁卡上的自定义标记写在卡实例上（api.threat 的 extra），不是 threatEffect。
function threatHasFlag(inv, flag) {
  return (inv.threat || []).some(card => card?.[flag] === true)
}

// ---- 复仇读数（跨章共享，P2）----
// 「视同胜利区」：除胜利区卡牌外，04066 地下遗迹在有敌人时也算在胜利区里。
// 04059/04083/04084/04085 与混乱标记都用这个口径；结局结算仍用各章的 totalVengeance。
function inPlayVengeance(state) {
  let total = (state.victoryDisplay || []).reduce((sum, card) => sum + Number(card.vengeance || 0), 0)
  for (const location of state.locations || []) {
    const code = original(location)
    // 只有卡面明确「视同进入胜利区」的地点才算；其他地点上的复仇点仍留在场上。
    const mode = vengeanceWhileFor(code)
    if (!mode) continue
    const amount = Number(location.vengeance || ALL_CARDS[code]?.vengeance || 0)
    if (!amount) continue
    if (mode === 'enemyHere' && (state.enemies || []).some(enemy => enemy.location === location.id)) total += amount
    if (mode === 'noClues' && (location.clues || 0) === 0) total += amount
    if (mode === 'investigatorHere' && (state.investigators || []).some(inv =>
      !inv.defeated && !inv.resigned && inv.location === location.id)) total += amount
  }
  return total
}

function supplyCount(state, inv) {
  const seat = inv.seat
  return (state.campaign.supplies?.[seat] || []).length
}

// 已逐条实现的共享遭遇卡。未列出的卡在审计里保留为待实现。
// 01xxx 是核心盒的遭遇组：失落时代的牌堆会引用它们，规则同样写在共享解析器里。


const SKILL_LABELS = { willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷' }

// 「检定 A 或 B」的卡面要让玩家自己选技能：多技能条目拆成每个技能一个动作，
// 引擎按 rule 校验、按 move.skill 取技能，因此不需要额外的选择窗口。
function threatMoves(base, spec) {
  if (!(spec.skills?.length > 1)) return [{ ...base, label: `♻️ ${spec.label}` }]
  return spec.skills.map(skill => ({
    ...base, skill,
    label: `♻️ ${spec.skillLabels?.[skill] || `检定${SKILL_LABELS[skill] || skill}(${spec.difficulty})${spec.label}`}`,
  }))
}

// 04084 幽嘶蛇人：按当前胜利区复仇重新计算反击/猎手/减伤（复仇随时会变）。
function refreshVengeanceEnemies(state) {
  const vengeance = inPlayVengeance(state)
  for (const enemy of state.enemies || []) {
    const thresholds = enemySpawnRuleFor(original(enemy))?.vengeanceThresholds
    if (!thresholds) continue
    enemy.retaliate = vengeance >= thresholds.retaliate
    enemy.hunter = vengeance >= thresholds.hunter
    enemy.tfaDamageReduction = vengeance >= thresholds.damageReduction ? 1 : 0
  }
}

export const encounterRules = {
  inPlayVengeance,
  refreshVengeanceEnemies,
  victoryChanged(state) {
    refreshVengeanceEnemies(state)
  },

  // ---- 敌人常驻修正 ----
  // stat 可以是 'fight' / 'evade' / 'health'（P2：生命值也走这个钩子）。
  // 04095「每个毁灭标记 +1 战斗/躲避」已迁到 src/cards/encounter-abilities.js。
  enemyStatModifier(state, enemy, stat) {
    const rule = enemyStatRuleFor(original(enemy))
    if (rule?.fightBonusFromVengeance && stat === 'fight') return inPlayVengeance(state)
    return 0
  },

  enemySpawned(state, enemy, api) {    const code = original(enemy)
    const rule = enemySpawnRuleFor(code)
    if (rule?.doomOnSpawn) {
      enemy.doom = (enemy.doom || 0) + rule.doomOnSpawn
      api?.info?.('🧿 祭司入场：在它身上放置 1 个毁灭标记。')
    }
    if (rule?.vengeanceThresholds) {
      const vengeance = inPlayVengeance(state)
      const thresholds = rule.vengeanceThresholds
      if (vengeance >= thresholds.retaliate) enemy.retaliate = true
      if (vengeance >= thresholds.hunter) enemy.hunter = true
      if (vengeance >= thresholds.damageReduction) enemy.tfaDamageReduction = 1
    }
    if (rule?.preyPoisoned) {
      const prey = active(state).find(inv => isPoisoned(inv))
      if (prey) enemy.preySeat = prey.seat
    }
    // 04062 瓦卢西亚的预示者的入场规则在敌人条目里（enemyScript.onSpawn）。
    enemyScriptFor(code)?.onSpawn?.(state, enemy, api)
  },

  // 04062 的强制：成功攻击或躲避后放 1 资源；满 2×人数时遁去身影（保留伤害）。
  enemyAttackedSuccessfully(state, inv, enemy, api) {
    enemyScriptFor(original(enemy))?.onAttackSuccess?.(state, inv, enemy, api)
  },

  afterEvade(state, inv, enemy, result, api) {
    enemyScriptFor(original(enemy))?.onEvade?.(state, inv, enemy, result, api)
  },

  // 兄弟会异教徒（04095）的「每次对它发动攻击时放 1 毁灭」已由引擎的攻击宣言钩子
  // （combat.js:128-133 / enemyDamageAllowed 之外的路径）结算；这里不要再补一次，
  // 否则单次成功攻击会放 2 点毁灭。
  enemyDamageAllowed(state, enemy, source, seat) {
    // 「力量真言」（04097）：与带毁灭的敌人同地点时不能伤害该敌人。
    const inv = Number.isInteger(seat) ? state.investigators[seat] : null
    if (inv && threatHasFlag(inv, 'blockDoomEnemyDamage')
      && (enemy.doom || 0) > 0 && enemy.location === inv.location) return false
    return true
  },

  // 04078 蝮蛇的中毒 / 04079 的「下一轮不能准备」都在敌人条目的 enemyScript 里。
  enemyAttackResolved(state, enemy, inv, api, attack) {
    enemyScriptFor(original(enemy))?.onAttackResolved?.(state, enemy, inv, api, attack)
  },

  // 埃兹特里的守卫者：敌人阶段开始时攻击每个连接地点的调查员。
  enemyPhaseStart(state, api) {
    for (const enemy of state.enemies.filter(item => original(item) === '04086')) {
      if (enemy.exhausted || enemy.engagedSeat != null) continue
      // 04048「搜索遗迹」：守卫者不能攻击（脚本用 enemyCannotAttack 声明）。
      if (api.cannotAttack?.(enemy)) {
        api.info?.(`⛔ 「${enemy.name}」不能攻击。`)
        continue
      }
      const location = state.locations.find(entry => entry.id === enemy.location)
      for (const next of location?.connections || []) {
        for (const inv of active(state).filter(entry => entry.location === next)) {
          api.attack(enemy, inv)
          if (inv.defeated) break
        }
      }
    }
  },

  // ---- 探索 / 移动 / 发现线索的限制 ----
  canExplore(state, inv) {
    const location = here(state, inv)
    if (attachmentsWithCode(location, '04076').length) return false
    if (threatWithCode(inv, '04081')) return false
    return true
  },

  movementError(state, inv) {
    if (threatWithCode(inv, '04081')) return '「迷失荒野」：你不能移动或探索'
    if (threatWithCode(inv, '04089')) return '「半身入土」：你不能移动'
    return null
  },

  // 「半身入土」（04089）：不能解除交战（移动已经被 movementError 拦住）。
  canDisengage(state, inv) {
    return !threatHasFlag(inv, 'noDisengage') && !threatWithCode(inv, '04089')
  },

  canDiscoverClues(state, inv) {
    // 「力量真言」（04097）：与带毁灭的敌人同地点时不能发现线索。
    // 04094 一片漆黑「每位调查员每轮从单个地点最多发现 1 个线索」由条目声明
    // `treacheryRule.clueDiscoveryLimit`，引擎 locations.js 统一记账（旁置卡读点）。
    if (threatHasFlag(inv, 'blockCluesHere')
      && state.enemies.some(enemy => (enemy.doom || 0) > 0 && enemy.location === inv.location)) return false
    return true
  },

  // 伊格的獠牙（04098）：与中毒调查员交战时，该调查员不能打出卡牌，也不能在
  // 技能检定中投入卡牌。引擎在 legalMoves / validateMove / 投入候选三处读这两个钩子。
  fangOfYigEngaged(state, inv) {
    if (!inv || !isPoisoned(inv)) return false
    return state.enemies.some(enemy => original(enemy) === '04098'
      && !enemy.defeated && enemy.engagedSeat === inv.seat)
  },

  canPlayCard(state, inv) {
    return !encounterRules.fangOfYigEngaged(state, inv)
  },

  canCommitCard(state, inv) {
    return !encounterRules.fangOfYigEngaged(state, inv)
  },

  // ---- 共享诡计 ----
  resolveEncounter(state, inv, t, api) {
    const code = original(t)
    const location = here(state, inv)
    const entryResolve = encounterResolveFor(code)
    const campaigns = encounterResolveCampaignsFor(code)
    // 第 120 轮：04092 也走条目（条目里的选项 id/顺序与旧分支一致，选择恢复凭据不变）。
    if (entryResolve && (!campaigns.length || campaigns.includes('tfa'))) {
      return entryResolve(state, inv, t, api, { location })
    }
    // 声明式「显现 - 检定」（treacheryRule.test）：与旧 DSL 同口径，读点在 card-rules.js。
    const declarative = treacheryTestFor(code)
    if (declarative) return resolveDeclarativeTreacheryTest(state, inv, t, api, declarative)
    return false
  },

  // 威胁区域的「行动：检定 X 弃掉本卡」。用于共享遭遇组。
  encounterActions(state, inv) {
    const moves = []
    for (const threat of inv.threat) {
      const code = original(threat)
      const spec = threatActionFor(code)
      if (spec) moves.push(...threatMoves({
        action: 'encounterAction', rule: spec.rule, threatId: threat.id, actions: spec.actions ?? 1,
      }, spec))
    }
    const location = here(state, inv)
    for (const attachment of location?.attachments || []) {
      const code = attachmentCode(attachment)
      const spec = threatActionFor(code)
      if (spec?.target === 'location') moves.push(...threatMoves({
        action: 'encounterAction', rule: spec.rule, attachmentId: attachment.id, actions: 1,
      }, spec))
    }
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    const spec = threatActionByRule(move.rule)
    if (!spec) return false
    if (spec.noTest) {
      if (move.threatId) {
        const threat = inv.threat.find(card => card.id === move.threatId)
        if (threat) discardThreat(state, inv, threat)
      }
      return true
    }
    const threat = move.threatId ? inv.threat.find(card => card.id === move.threatId) : null
    const location = here(state, inv)
    const attachment = move.attachmentId
      ? (location?.attachments || []).find(item => item.id === move.attachmentId)
      : null
    if (!threat && !attachment) return false
    const vengeance = spec.vengeance ? inPlayVengeance(state) : 0
    const skill = move.skill || spec.skills[0]
    // 04089 半身入土：失败后本次检定难度降低 1 点，直到一轮结束。
    const reduction = spec.rule === 'escapeEntombed' ? (threat?.difficultyReduction || 0) : 0
    // 检定的来源名由服务端按卡号解析：客户端的 move 不带 label（DOP 只提交规则字段），
    // 之前用 move.label 会让时间线里的检定只显示「技能检定」，看不出是在摆脱哪张威胁卡。
    const sourceCode = original(threat || attachment)
    const sourceName = ALL_CARDS[sourceCode]?.nameZh || ALL_CARDS[sourceCode]?.name || sourceCode
    api.test(inv.seat, skill, Math.max(0, spec.difficulty + vengeance - reduction), result => {
      if (!result.success) {
        if (spec.rule === 'escapeEntombed' && threat) {
          threat.difficultyReduction = (threat.difficultyReduction || 0) + 1
          api.info?.('「半身入土」：本次检定失败，直到一轮结束难度 -1。')
        }
        return
      }
      if (threat) discardThreat(state, inv, threat)
      if (attachment) discardAttachment(state, location, attachment)
    }, 0, { type: 'scenario', name: sourceName, code: sourceCode, ability: true })
    return true
  },

  // 回合 / 轮末的强制效果。
  turnEnded(state, inv, api) {
    const lost = threatWithCode(inv, '04081')
    if (lost) discardThreat(state, inv, lost)
    const voice = threatWithCode(inv, '04077')
    if (voice && !inv.tfaExploredThisTurn) api.horror(inv.seat, voice.forcedEndTurnHorror ?? 1)
    const entombed = threatWithCode(inv, '04089')
    if (entombed) delete entombed.difficultyReduction
  },

  roundEnded(state, api) {
    for (const inv of active(state)) {
      const scourge = threatWithCode(inv, '04099')
      if (scourge) discardThreat(state, inv, scourge)
      const entombed = threatWithCode(inv, '04089')
      if (entombed) delete entombed.difficultyReduction
      delete inv.tfaExploredThisTurn
    }
    // 04094 一片漆黑「强制 - 轮末从场上弃掉 1 张」由条目声明
    // `treacheryRule.discardOneAtRoundEnd`，引擎 phases.js 的旁置卡轮末扫描结算。
    for (const location of state.locations) {
      for (const attachment of attachmentsWithCode(location, '04076').slice()) {
        // 疯狂生长只在探索限制期间持续；不自动弃掉。
        void attachment
      }
    }
  },

  // ---- 旧存档修复：一片漆黑 ----
  // 2026-11 之前「放在密谋牌库旁」只写了 state.scenarioFlags.deepDark 计数，场上没有实体卡，
  // 于是牌桌（以及卡牌详情/局势）都看不到它。读档时按计数补出真实旁置实例并清掉旧记账字段。
  needsSaveRepair(state) {
    return Number(state.scenarioFlags?.deepDark || 0) > 0
  },

  saveRepairNote: '把「一片漆黑」恢复为密谋牌库旁的真实卡牌',

  repairSavedState(state, api) {
    const copies = Math.max(0, Number(state.scenarioFlags?.deepDark || 0))
    const existing = (state.agendaAside || []).filter(card => original(card) === DEEP_DARK_CODE).length
    for (let index = existing; index < copies; index++) api.putNextToAgenda(DEEP_DARK_CODE)
    if (state.scenarioFlags) {
      delete state.scenarioFlags.deepDark
      delete state.scenarioFlags.deepDarkClaims
    }
    // 旧记账方式（inv.tfaCluesRound）也不再使用；只在旧存档里出现过，一并清掉。
    for (const inv of state.investigators || []) delete inv.tfaCluesRound
  },

  investigatorEliminated() {},

  // ---- 04244 伊斯人身体：身体卡的印刷文本（换身后跨章生效）----
  // [elder_sign] 效果：+2，抽 1 张牌。剧本钩子优先于调查员条目，因此换身后原调查员的
  // 旧印不会结算；换身还原后本钩子返回 null，回到原调查员的旧印。
  elderSign(state, inv) {
    if (!isYithianForm(inv)) return null
    return { delta: 2, draw: 1 }
  },

  // [reaction] 在你将卡牌投入你正在执行的技能检定后：该卡牌上的技能图标数量翻倍。（每次检定一次）
  // 只对持有者自己执行、自己投入的检定生效；引擎在 tests.js 的投入结算里询问玩家。
  commitIconMultiplier(state, inv) {
    if (!isYithianForm(inv)) return 1
    const test = state.skillTest
    if (!test || test.seat !== inv.seat || test.tfaYithianIconDoubled) return 1
    return {
      multiplier: 2, once: 'tfaYithianIconDoubled', source: 'yithianBody',
      prompt: '伊斯人身体：是否翻倍刚投入这张牌的技能图标？（每次检定一次）',
    }
  },

  // 你的每个[[盟友]]支援获得[[伊斯]]特性（含之后入场的盟友）。
  assetEntered(state, inv, asset) {
    if (!isYithianForm(inv)) return
    markYithianAllies(inv, asset)
  },

  // 补给被划掉的共享入口（补给短缺等）。
  suppliesUsed(state, inv, name) {
    return (state.campaign.supplies?.[inv.seat] || []).includes(name)
  },
}

export function recordSuppliesCrossOff(state, inv, name) {
  const list = state.campaign.supplies?.[inv.seat]
  if (!list) return false
  const index = list.indexOf(name)
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

export { isPoisoned, supplyCount, distance as tfaDistance, hasTrait, recordsFor }
