import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { encounterResolveCampaignsFor, encounterResolveFor, enemyScriptFor, entryFlags, locationRuleFor, treacheryRuleFor } from '../../../src/cards/card-rules.js'

const original = card => card?.originalCode || card?.code
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
const attachmentCode = attachment => original(typeof attachment === 'string' ? { code: attachment } : attachment)

function discardLocationAttachment(state, location, index) {
  const [attachment] = location.attachments.splice(index, 1)
  const code = attachmentCode(attachment)
  if (code) state.encounterDiscard.push(code)
  if (!location.attachments.some(item => attachmentCode(item) === '03094')) delete location.haunted
  return code
}

function discardEmptySpires(state) {
  for (const location of state.locations) {
    if ((location.doom || 0) > 0) continue
    for (let index = (location.attachments || []).length - 1; index >= 0; index--) {
      if (attachmentCode(location.attachments[index]) === '03091') {
        discardLocationAttachment(state, location, index)
      }
    }
  }
}

function distance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from]), queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    const location = state.locations.find(candidate => candidate.id === id)
    for (const next of location?.connections || []) {
      if (next === to) return steps + 1
      if (!seen.has(next)) { seen.add(next); queue.push([next, steps + 1]) }
    }
  }
  return Infinity
}

// P0：与 TFA 同一份修复——调查员没有 id，只有 seat。
const choiceKey = (candidate, index) => String(candidate?.id ?? candidate?.seat ?? candidate?.code ?? index)

function chooseOne(api, request, candidates, label = candidate => candidate.name || candidate.id) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const id = api.choose({ ...request,
    options: candidates.map((candidate, index) => ({ id: choiceKey(candidate, index), label: label(candidate) })) })
  return candidates.find((candidate, index) => choiceKey(candidate, index) === id) || candidates[0]
}



export const encounterRules = {
  // P0：苍白面具进入未揭示的地下墓穴要共同支付线索。付不起时这一步不能
  // 出现在 legalMoves 里（moves.js 会读这个钩子），否则 beforeMove 会抛错。
  moveError(state, inv, destination) {
    if (state.scenario?.id !== 'thePallidMask') return null
    const source = state.locations.find(location => location.id === inv.location)
    // 第 114 轮：石铺拱道（03248）从相邻的未揭示地点进入不必共同支付线索。
    if (destination?.revealed || locationRuleFor(source?.originalCode)?.waivesEnterClueCost) return null
    const cost = state.numInvestigators
    const available = state.investigators
      .filter(owner => !owner.defeated && !owner.resigned && owner.location === source?.id)
      .reduce((sum, owner) => sum + (owner.clues || 0), 0)
    return available < cost ? `进入未揭示的地下墓穴需要 ${cost} 点共同线索（当前 ${available}）` : null
  },
  // 03103 蟑螂群 / 03222 潜行的拜亚基 / 03096 哈斯塔的傀儡的战斗修正已迁到
  // src/cards/encounter-abilities.js 的对应敌人条目；本章只保留「国王敕令」的全局规则。
  enemyStatModifier(state, enemy, stat) {
    if (stat === 'fight' && state.scenarioFlags?.kingsEdict
      && traits(enemy).includes('cultist')) return (enemy.clues || 0) + (enemy.doom || 0)
    return 0
  },
  // 03187「疯狂礼物（悲惨）」：隐私卡在场时不能触发地点上的 [action] 能力。
  // 引擎只拦了 `loc.ability` 通道；地点条目自己推出的 scenarioAction 也在这里拦下。
  actionBlocked(state, inv, move) {
    if (move?.action !== 'scenarioAction') return null
    const hidden = (inv.hiddenCards || []).filter(code =>
      state.scenario?.treacheries?.[code]?.hiddenRule?.cannotTriggerLocationAbilities)
    if (!hidden.length) return null
    const location = state.locations.find(item => item.id === inv.location)
    const rule = locationRuleFor(original(location))
    if (!rule?.actions) return null
    const produced = []
    rule.actions({ state, inv, location, moves: produced, facts: state.scenarioFlags?.remembered || [] })
    return produced.some(candidate => candidate.rule === move.rule) ? '隐私牌禁止你触发地点能力' : null
  },
  spawnLocation(state, code, fallback, seat, api) {
    const script = enemyScriptFor(code)
    if (script?.onSpawnLocation) return script.onSpawnLocation(state, code, fallback, seat, api)
    return fallback
  },
  spawnFailed(state, code, seat, api) {
    enemyScriptFor(code)?.onSpawnFailed?.(state, code, seat, api)
  },
  enemyDamageAllowed(state, enemy, source, seat) {
    const script = enemyScriptFor(original(enemy))
    if (script?.onDamageAllowed) return script.onDamageAllowed(state, enemy, source, seat) === true
    return true
  },
  enemyEngaged(state, enemy, inv, api) {
    enemyScriptFor(original(enemy))?.onEngage?.(state, enemy, inv, api)
  },
  enemySpawned(state, enemy, api) {
    enemyScriptFor(original(enemy))?.onSpawn?.(state, enemy, api)
    // 03100「王之法令」：本轮入场较晚的异教徒也要吃到 +1 攻击的持续修正
    // （引擎按 enemy.kingsEdictRound === state.round 读）。
    if (state.scenarioFlags?.kingsEdictRound === state.round && traits(enemy).includes('cultist')) {
      enemy.kingsEdictRound = state.round
    }
  },
  enemyDefeated(state, enemy, api) {
    const script = enemyScriptFor(original(enemy))
    if (script?.onDefeated) return script.onDefeated(state, enemy, api) === true
    return false
  },
  enemyAttackResolved(state, enemy, inv, api) {
    enemyScriptFor(original(enemy))?.onAttackResolved?.(state, enemy, inv, api)
  },
  hunterMove(state, enemy, api) {
    const script = enemyScriptFor(original(enemy))
    if (!script?.onHunterMove) return false
    return script.onHunterMove(state, enemy, api) === true
  },
  afterEvade(state, inv, enemy, result, api) {
    enemyScriptFor(original(enemy))?.onEvade?.(state, inv, enemy, result, api)
  },
  locationWillFlip(state, location, api) {
    for (const enemy of state.enemies.slice()) {
      enemyScriptFor(original(enemy))?.onLocationWillFlip?.(state, enemy, location, api)
    }
  },
  locationFlipped(state, location, api) {
    for (const enemy of state.enemies.slice()) {
      enemyScriptFor(original(enemy))?.onLocationFlipped?.(state, enemy, location, api)
    }
  },
  encounterActions(state, inv) {
    const actions = []
    const location = here(state, inv)
    for (const [attachmentIndex, attachment] of (location?.attachments || []).entries()) {
      const code = attachmentCode(attachment)
      // 第 74 轮：附属诡计的场景行动由 treacheryRule.attachmentAction 声明。
      const attachmentAction = treacheryRuleFor(code)?.attachmentAction?.(state, inv, location, attachmentIndex)
      if (attachmentAction) actions.push(attachmentAction)
    }
    for (const enemy of state.enemies.filter(candidate => candidate.location === inv.location)) {
      // 第 75 轮：敌人的特殊场景行动由 enemyScript.encounterAction 声明。
      const action = enemyScriptFor(original(enemy))?.encounterAction?.(state, inv, enemy)
      if (action) actions.push(action)
    }
    // 03261 身后暗影：只有该威胁区的控制者本人能执行 [action]「查看身后」。
    for (const owner of active(state).filter(owner => owner.seat === inv.seat)) {
      for (const threat of owner.threat.filter(card => original(card) === '03261')) {
        // 第 75 轮：03261 的「查看身后暗影」由 treacheryRule.encounterAction 声明。
        const action = treacheryRuleFor(original(threat))?.encounterAction?.(state, inv, owner, threat)
        if (action) actions.push(action)
      }
    }
    return actions
  },
  performEncounterAction(state, inv, move, api) {
    if (move.rule === 'clearSpiresOfCarcosa') {
      const location = state.locations.find(candidate => candidate.id === move.locationId
        && candidate.id === inv.location)
      const attachment = location?.attachments?.[move.attachmentIndex]
      if (!location || attachmentCode(attachment) !== '03091' || !(location.doom > 0)) {
        throw new Error('卡尔克萨尖柱能力当前不可用')
      }
      const difficulty = (location.shroud || 0) + (location.shroudMod || 0) + (state.fogMod || 0)
      api.test(inv.seat, 'intellect', difficulty, result => {
        if (!result.success) return
        location.doom = Math.max(0, (location.doom || 0) - 1)
        discardEmptySpires(state)
      }, 0, { type: 'scenario', action: 'investigate', label: '调查卡尔克萨尖柱', code: '03091' })
      return
    }
    if (move.rule === 'discardSpiritsTorment') {
      const location = state.locations.find(candidate => candidate.id === move.locationId
        && candidate.id === inv.location)
      const attachment = location?.attachments?.[move.attachmentIndex]
      if (!location || attachmentCode(attachment) !== '03094' || inv.clues < 1) {
        throw new Error('恶灵作祟能力当前不可用')
      }
      api.spendClues(inv.seat, 1)
      location.clues = (location.clues || 0) + 1
      discardLocationAttachment(state, location, move.attachmentIndex)
      return
    }
    if (move.rule === 'investigatePallidMask') {
      const enemy = state.enemies.find(candidate => candidate.id === move.enemyId
        && original(candidate) === '03059' && candidate.location === inv.location)
      const location = here(state, inv)
      if (!enemy || !location) throw new Error('苍白面具下的男子不在此处')
      const difficulty = (location.shroud || 0) + (location.shroudMod || 0) + (state.fogMod || 0) + 2
      api.test(inv.seat, 'intellect', difficulty, result => {
        if (!result.success) return
        // 03257：苍白面具下的男子位于暗影坟墓时，不能被他的 [action] 能力击败。
        if (entryFlags(original(location))?.tombEntrance) {
          api.info('「暗影坟墓」中的苍白面具下的男子不能被这次行动击败。')
          return
        }
        api.damageEnemy(enemy.id, Math.max(99, enemy.health || 0), inv.seat, '03059')
      }, 0, { type: 'scenario', action: 'investigate', label: '调查苍白面具下的男子', code: '03059' })
      return
    }
    if (move.rule === 'parleyPoltergeist') {
      const enemy = state.enemies.find(candidate => candidate.id === move.enemyId)
      if (enemy) api.test(inv.seat, 'intellect', 3, result => {
        if (result.success) api.damageEnemy(enemy.id, 1, inv.seat, 'encounter')
      })
      return
    }
    if (move.rule === 'parleyLecturer') {
      const enemy = state.enemies.find(candidate => candidate.id === move.enemyId)
      if (!enemy) return
      state.scenarioFlags ||= {}
      state.scenarioFlags.catacombsLecturerUsed = true
      api.test(inv.seat, 'intellect', 4, result => {
        if (!result.success) return
        const locations = state.locations.filter(location =>
          String(location.originalCode || '').startsWith('0324') && !location.revealed)
        const location = chooseOne(api, {
          kind: 'location', source: '03258', seat: inv.seat,
          prompt: '选择查看一处地下墓穴地点的揭示面。',
        }, locations)
        if (location) api.privateInfo(inv.seat,
          `地下墓穴讲师：你查看了「${location.name}」（${location.originalCode}）的揭示面：`
          + `帷幕 ${(location.shroud || 0) + (location.shroudMod || 0)}，线索 ${location.clues || 0}`
          + `，连接 ${(location.connections || []).map(id => state.locations.find(item => item.id === id)?.name || id).join('、') || '无'}。`)
      })
      return
    }
    if (move.rule === 'lookBehindYou') {
      const owner = state.investigators[move.threatOwnerSeat ?? inv.seat]
      const threat = owner?.threat.find(card => card.id === move.threatId)
      if (threat) threat.lookedRound = state.round
    }
  },
  resolveEncounter(state, inv, card, api) {
    const code = original(card)
    // 与 TFA 同口径：条目没有声明战役（`encounterResolveCampaigns: []`）表示「通用」，
    // 任何战役都应结算；只有显式声明了其它战役的卡才跳过。此前只认 'carcosa'，
    // 导致 01163–01168、01171 这类通用遭遇组在卡尔克萨整包空转。
    const campaigns = encounterResolveCampaignsFor(code)
    const resolve = encounterResolveFor(code)
    if (resolve && (!campaigns.length || campaigns.includes('carcosa'))) {
      return resolve(state, inv, card, api, { location: here(state, inv) })
    }
    if (code.startsWith('03084')) {
      inv.hand.push(code)
      inv.hiddenCards ||= []
      inv.hiddenCards.push(code)
      return true
    }
    return false
  },
  turnEnded(state, inv, api) {
    for (const threat of inv.threat.filter(card => original(card) === '03261').slice()) {
      if (threat.lookedRound === state.round) {
        delete threat.lookedRound
        continue
      }
      const options = []
      if (inv.resources > 0) options.push({ id: 'resources', label: `弃掉所有资源（${inv.resources}）` })
      // 手牌里的隐私卡不能被普通效果弃掉；只要还有非隐私手牌，就保留「弃掉所有手牌」选项。
      const discardable = inv.hand.filter(code => !(inv.hiddenCards || []).includes(code))
      if (discardable.length > 0) options.push({ id: 'hand', label: `弃掉所有手牌（${discardable.length}）` })
      // 没有可弃的资源/手牌时，卡面的「然后，弃掉身后暗影」仍然执行；
      // 旧实现直接 continue，会把这张强制牌永久留在威胁区。
      const choice = options.length ? api.choose({
        kind: 'encounter', source: '03261', seat: inv.seat,
        prompt: '身后暗影：选择弃掉所有资源或所有手牌。',
        options,
      }) : null
      if (choice === 'resources') inv.resources = 0
      else if (choice === 'hand') {
        for (const code of discardable) {
          const index = inv.hand.indexOf(code)
          if (index >= 0) (inv.discard ||= []).push(inv.hand.splice(index, 1)[0])
        }
      }
      inv.threat.splice(inv.threat.indexOf(threat), 1)
      ;(state.encounterDiscard ||= []).push(threat.code)
    }
  },
  doomCleared(state) {
    discardEmptySpires(state)
  },
  locationLeft(state, inv, location, api) {
    for (const attachment of (location?.attachments || []).filter(item => attachmentCode(item) === '03094')) {
      const options = [{ id: 'horror', label: '受到1点恐惧' }]
      if (inv.actionsLeft > 0) options.push({ id: 'action', label: '失去1个行动' })
      const choice = options.length === 1 ? 'horror' : api.choose({
        kind: 'encounter',
        source: attachment.id || '03094',
        seat: inv.seat,
        prompt: '离开恶灵作祟附属的地点：选择受到1点恐惧或失去1个行动。',
        options,
      })
      if (choice === 'action') api.loseActions(inv.seat, 1)
      else api.horror(inv.seat, 1)
    }
  },
  roundEnded(state, api) {
    if (state.scenarioFlags?.decayRound === state.round) {
      // 03101「淤泥与污物」：每张 +1 帷幕，轮末全部弃掉（可能同轮入场多张）。
      const copies = Math.max(1, state.scenarioFlags.decayCount || 1)
      state.fogMod = Math.max(0, (state.fogMod || 0) - copies)
      for (let index = 0; index < copies; index++) state.encounterDiscard.push('03101')
      delete state.scenarioFlags.decayRound
      delete state.scenarioFlags.decayCount
    }
    for (const location of state.locations) {
      const pits = (location.attachments || []).filter(attachment =>
        original(typeof attachment === 'string' ? { code: attachment } : attachment) === '03262')
      for (const pit of pits) {
        for (const inv of active(state).filter(candidate => candidate.location === location.id)) api.damage(inv.seat, 3)
        location.attachments.splice(location.attachments.indexOf(pit), 1)
        location.shroudMod = Math.max(0, (location.shroudMod || 0) - 1)
        state.encounterDiscard.push('03262')
      }
    }
    delete state.scenarioFlags?.kingsEdict
    delete state.scenarioFlags?.kingsEdictRound
  },
}
