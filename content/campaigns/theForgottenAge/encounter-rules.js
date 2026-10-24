import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  encounterResolveCampaignsFor, encounterResolveFor, enemyScriptFor, enemySpawnRuleFor, enemyStatRuleFor,
  isPoisonThreat, threatActionByRule, threatActionFor, vengeanceWhileFor,
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
    if (threatHasFlag(inv, 'blockCluesHere')
      && state.enemies.some(enemy => (enemy.doom || 0) > 0 && enemy.location === inv.location)) return false
    const count = Number(state.scenarioFlags?.deepDark || 0)
    if (!count) return true
    inv.tfaCluesRound ||= {}
    const claimed = inv.tfaCluesRound[state.round] || []
    return !claimed.includes(inv.location)
  },

  cluesGained(state, inv, amount) {
    const count = Number(state.scenarioFlags?.deepDark || 0)
    if (!count) return
    inv.tfaCluesRound ||= {}
    const claimed = inv.tfaCluesRound[state.round] || (inv.tfaCluesRound[state.round] = [])
    if (!claimed.includes(inv.location)) claimed.push(inv.location)
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
    }, 0, { type: 'scenario', name: move.label, ability: true })
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
    const count = Number(state.scenarioFlags?.deepDark || 0)
    if (count > 0) {
      state.scenarioFlags.deepDark = count - 1
      if (!state.scenarioFlags.deepDark) {
        delete state.scenarioFlags.deepDark
        api.info?.('一片漆黑全部被弃掉，线索限制解除。')
      }
    }
    for (const location of state.locations) {
      for (const attachment of attachmentsWithCode(location, '04076').slice()) {
        // 疯狂生长只在探索限制期间持续；不自动弃掉。
        void attachment
      }
    }
  },

  investigatorEliminated() {},

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
