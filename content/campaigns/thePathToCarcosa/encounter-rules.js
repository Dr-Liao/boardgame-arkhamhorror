import { ALL_CARDS } from '../../../src/cards/cards-data.js'

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

function chooseOne(api, request, candidates, label = candidate => candidate.name || candidate.id) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const id = api.choose({ ...request, options: candidates.map(candidate => ({ id: candidate.id, label: label(candidate) })) })
  return candidates.find(candidate => candidate.id === id) || candidates[0]
}

export const implementedTreacheries = new Set([
  '01176',
  '03084a', '03084b', '03084c', '03084d', '03085', '03087', '03090', '03091',
  '03092', '03094', '03097', '03100', '03101', '03102', '03104', '03105',
  '03224', '03225', '03226', '03260', '03261', '03262',
  '03302', '03303', '03337', '03338', '03339',
])

export const implementedEnemies = new Set([
  '03086', '03089', '03093', '03095', '03096', '03098', '03099', '03103',
  '03222', '03258', '03259',
  '03335', '03336',
])

export const encounterRules = {
  enemyStatModifier(state, enemy, stat) {
    const code = original(enemy)
    if (stat === 'fight' && state.scenarioFlags?.kingsEdict
      && traits(enemy).includes('cultist')) return (enemy.clues || 0) + (enemy.doom || 0)
    if (code === '03103' && stat === 'fight') {
      const location = state.locations.find(candidate => candidate.id === enemy.location)
      return (location?.shroud || 0) + (location?.shroudMod || 0) - (enemy.fight || 0)
    }
    if (code === '03222' && stat === 'fight' && enemy.exhausted) return -3
    if (code === '03096' && stat === 'fight' && state.phase === 'investigation') {
      return (enemy.puppetFightBonuses || [])
        .filter(bonus => bonus.investigationRound === state.round)
        .reduce((sum, bonus) => sum + bonus.amount, 0)
    }
    return 0
  },
  spawnLocation(state, code, fallback, seat, api) {
    if (code === '03098') {
      const revealed = state.locations.filter(location => location.revealed)
      if (!revealed.length) return null
      const most = Math.max(...revealed.map(location => location.clues || 0))
      return chooseOne(api, {
        kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
        prompt: '选择线索最多的已揭示地点生成狂徒。',
      }, revealed.filter(location => (location.clues || 0) === most))?.id || null
    }
    if (code === '03258') {
      const origin = state.investigators[seat]?.location || fallback
      const unrevealed = state.locations.filter(location => !location.revealed)
      if (!unrevealed.length) return null
      const nearest = Math.min(...unrevealed.map(location => distance(state, origin, location.id)))
      return chooseOne(api, {
        kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
        prompt: '选择最近的未揭示地点生成地下墓穴讲师。',
      }, unrevealed.filter(location => distance(state, origin, location.id) === nearest))?.id || null
    }
    if (code === '03259') {
      const humanoids = state.enemies.filter(enemy => traits(enemy).includes('humanoid'))
      const target = chooseOne(api, {
        kind: 'enemy', source: code, seat: seat ?? state.campaign.leadSeat,
        prompt: '选择弃掉的一名类人生物敌人。',
      }, humanoids)
      if (!target) return null
      const location = target.location
      api.discardEnemy(target)
      return location
    }
    if (code === '03335') return state.locations.some(location => location.id === 'depthsOfDemhe')
      ? 'depthsOfDemhe' : fallback
    if (code === '03336') return state.locations.some(location => location.id === 'bleakPlains')
      ? 'bleakPlains' : fallback
    return fallback
  },
  spawnFailed(state, code, seat, api) {
    if (code === '03259' && seat != null) api.drawEncounter(seat)
  },
  enemyDamageAllowed(state, enemy, source, seat) {
    if (original(enemy) !== '03093') return true
    if (source === 'encounter') return true
    const inv = state.investigators[seat]
    const sourceCard = inv?.assets.find(asset => asset.id === source)
    return traits(sourceCard).some(trait => ['spell', 'relic'].includes(trait))
  },
  enemyEngaged(state, enemy, inv, api) {
    const code = original(enemy)
    if (code === '03095') {
      api.damage(inv.seat, 1)
      api.damageEnemy(enemy.id, 1, inv.seat, 'encounter')
    }
    if (code === '03096') {
      const choice = api.choose({
        kind: 'encounter',
        source: code,
        seat: inv.seat,
        prompt: '哈斯塔的傀儡与你交战：选择承受1点恐惧，或令其本调查阶段战斗+3。',
        options: [{ id: 'horror', label: '承受1点恐惧' }, { id: 'fight', label: '本调查阶段战斗+3' }],
      })
      if (choice === 'horror') api.horror(inv.seat, 1)
      else {
        const investigationRound = ['enemy', 'upkeep'].includes(state.phase) ? state.round + 1 : state.round
        enemy.puppetFightBonuses ||= []
        enemy.puppetFightBonuses.push({ amount: 3, investigationRound })
      }
    }
  },
  enemySpawned(state, enemy, api) {
    const code = original(enemy)
    if (code === '03098') {
      const location = state.locations.find(candidate => candidate.id === enemy.location)
      if (location?.clues > 0) {
        location.clues--
        enemy.clues = (enemy.clues || 0) + 1
      }
      return
    }
  },
  enemyDefeated(state, enemy, api) {
    if (!['03098', '03099'].includes(original(enemy)) || !enemy.clues) return false
    const inv = state.investigators[enemy.defeatedBy]
    if (inv) api.gainClues(inv.seat, enemy.clues)
    enemy.clues = 0
    return false
  },
  enemyAttackResolved(state, enemy, inv, api) {
    if (original(enemy) !== '03099' || inv.clues < 1) return
    api.spendClues(inv.seat, 1)
    enemy.clues = (enemy.clues || 0) + 1
  },
  hunterMove(state, enemy, api) {
    if (original(enemy) !== '03086') return false
    let moved = 0
    while (!active(state).some(inv => inv.location === enemy.location)) {
      const next = api.hunterStep(enemy)
      if (!next || next === enemy.location) break
      api.moveEnemy(enemy, next)
      moved++
    }
    if (moved > 1) enemy.skipAttackRound = state.round
    return true
  },
  afterEvade(state, inv, enemy, result, api) {
    if (original(enemy) === '03089' && result?.success && result.value - result.difficulty <= 2) {
      api.horror(inv.seat, 1)
    }
  },
  locationWillFlip(state, location, api) {
    for (const enemy of state.enemies.slice()) {
      if (enemy.exhausted) continue
      if (original(enemy) === '03335') {
        const origin = state.locations.find(candidate => candidate.id === enemy.location)
        if (enemy.location === location.id || origin?.connections?.includes(location.id)) {
          for (const inv of active(state).filter(candidate => candidate.location === location.id)) api.attack(enemy, inv)
        }
      }
    }
  },
  locationFlipped(state, location, api) {
    for (const enemy of state.enemies.slice()) {
      if (!enemy.exhausted && original(enemy) === '03336'
        && enemy.engagedSeat == null && enemy.location !== location.id) {
        const next = api.stepToward(enemy.location, location.id)
        if (next) api.moveEnemy(enemy, next)
      }
    }
  },
  encounterActions(state, inv) {
    const actions = []
    const location = here(state, inv)
    for (const [attachmentIndex, attachment] of (location?.attachments || []).entries()) {
      const code = attachmentCode(attachment)
      // 尖柱/恶灵作祟已经附属在此地点上，只差"地点上还有毁灭""手里还有线索"这两个可改变的条件。
      if (code === '03091') actions.push({
        action: 'encounterAction', actionKind: 'investigate', rule: 'clearSpiresOfCarcosa',
        locationId: location.id, attachmentIndex, actions: 1,
        label: '调查卡尔克萨尖柱：成功后移除地点上的1个毁灭',
        reason: (location.doom || 0) > 0 ? null : '此地点上没有毁灭',
      })
      if (code === '03094') actions.push({
        action: 'encounterAction', rule: 'discardSpiritsTorment',
        locationId: location.id, attachmentIndex, actions: 1,
        label: '将1个线索放回地点，弃掉恶灵作祟',
        reason: inv.clues > 0 ? null : '需要花费 1 个线索',
      })
    }
    for (const enemy of state.enemies.filter(candidate => candidate.location === inv.location)) {
      if (original(enemy) === '03059') actions.push({
        action: 'encounterAction', actionKind: 'investigate', rule: 'investigatePallidMask',
        enemyId: enemy.id, actions: 1, label: '调查苍白面具下的男子（本地点帷幕+2）',
      })
      if (original(enemy) === '03093') actions.push({
        action: 'encounterAction', actionKind: 'parley', rule: 'parleyPoltergeist',
        enemyId: enemy.id, actions: 1, label: '谈判骚灵（智识3）：成功对其造成1点伤害',
      })
      if (original(enemy) === '03258' && !state.scenarioFlags?.catacombsLecturerUsed) actions.push({
        action: 'encounterAction', actionKind: 'parley', rule: 'parleyLecturer',
        enemyId: enemy.id, actions: 1, label: '谈判地下墓穴讲师（智识4）',
      })
    }
    for (const owner of active(state).filter(owner => owner.location === inv.location)) {
      for (const threat of owner.threat.filter(card => original(card) === '03261')) actions.push({
        action: 'encounterAction', rule: 'lookBehindYou', threatId: threat.id,
        threatOwnerSeat: owner.seat, actions: 1, label: `查看${owner.seat === inv.seat ? '' : owner.name + '的'}「身后暗影」背后`,
      })
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
        if (result.success) api.damageEnemy(enemy.id, Math.max(99, enemy.health || 0), inv.seat, '03059')
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
          `地下墓穴讲师：你查看了「${location.name}」（${location.originalCode}）的揭示面。`)
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
    if (code === '01176') {
      api.test(inv.seat, 'willpower', 4, result => {
        if (result.success) return
        api.horror(inv.seat, 2)
        if (!inv.defeated && !inv.resigned) api.drawMadnessWeakness(inv.seat)
      })
      return false
    }
    if (code.startsWith('03084')) {
      inv.hand.push(code)
      inv.hiddenCards ||= []
      inv.hiddenCards.push(code)
      return true
    }
    if (code === '03085') {
      if (inv.horror >= 3) inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
      return false
    }
    if (code === '03087') {
      api.test(inv.seat, 'agility', 6, result => {
        if (result.success) return
        const count = Math.max(0, result.difficulty - result.value)
        const revealed = state.encounterDeck.splice(Math.max(0, state.encounterDeck.length - count))
        const byakhee = revealed.find(candidate =>
          ALL_CARDS[original(candidate)]?.traits?.includes('Byakhee'))
        if (byakhee) state.encounterDeck.push(byakhee)
        if (revealed.some(candidate => ALL_CARDS[original(candidate)]?.traits?.includes('Omen'))) {
          api.horror(inv.seat, 1)
        }
        state.encounterDeck.push(...revealed.filter(candidate => candidate !== byakhee))
        api.shuffleEncounterDeck()
      })
      return true
    }
    if (code === '03090') {
      api.test(inv.seat, 'intellect', 4, result => {
        if (result.success) return
        const deficit = Math.max(1, result.difficulty - result.value)
        const choice = api.choose({
          kind: 'encounter',
          source: code,
          seat: inv.seat,
          prompt: '黑星升起：选择在当前议程放置 1 毁灭，或承受等同失败差值的恐惧。',
          options: [{ id: 'doom', label: '在当前议程放置 1 毁灭' },
            { id: 'horror', label: `承受 ${deficit} 恐惧` }],
        })
        if (choice === 'doom') state.doom++
        else api.horror(inv.seat, deficit)
      })
      return false
    }
    if (code === '03091') {
      const location = here(state, inv)
      location.doom = (location.doom || 0) + 2
      location.attachments ||= []
      location.attachments.push({
        id: `spires:${state.round}:${state.moveCount}:${location.attachments.length}`,
        code,
        originalCode: code,
      })
      return true
    }
    if (code === '03092') {
      const doom = state.doom + state.locations.reduce((sum, location) => sum + (location.doom || 0), 0)
        + state.enemies.reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
      if (!doom) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.test(inv.seat, 'willpower', doom, result => {
        if (!result.success) api.discardRandom(inv.seat, 2)
      })
      return false
    }
    if (code === '03094') {
      const location = here(state, inv)
      location.attachments ||= []
      location.attachments.push({
        id: `torment:${state.round}:${state.moveCount}:${location.attachments.length}`,
        code,
        originalCode: code,
      })
      location.haunted = true
      return true
    }
    if (code === '03097') {
      const possessed = state.enemies.filter(enemy => enemy.traits?.includes('Possessed'))
      if (!possessed.length) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const enemy = possessed[0]
        enemy.exhausted = false
        api.moveEnemy(enemy, inv.location)
        api.engage(enemy, inv.seat)
        api.attack(enemy, inv)
      })
      return false
    }
    if (code === '03100') {
      let moved = 0
      for (const enemy of state.enemies.filter(enemy => enemy.traits?.includes('Cultist'))) {
        const location = state.locations.find(candidate => candidate.id === enemy.location)
        if (location?.clues) {
          location.clues--
          enemy.clues = (enemy.clues || 0) + 1
          moved++
        }
      }
      state.scenarioFlags ||= {}
      state.scenarioFlags.kingsEdict = moved > 0
      if (!moved) api.drawEncounter(inv.seat)
      return false
    }
    if (code === '03101') {
      state.fogMod = (state.fogMod || 0) + 1
      state.scenarioFlags ||= {}
      state.scenarioFlags.decayRound = state.round
      return true
    }
    if (code === '03102') {
      const candidates = [...inv.assets, ...inv.hand.map((candidate, index) => ({
        id: `hand:${index}`, code: candidate,
      }))].filter(candidate => ALL_CARDS[candidate.code]?.traits?.includes('Item'))
      if (!candidates.length) {
        api.drawEncounter(inv.seat)
        return false
      }
      const choice = api.choose({
        kind: 'discard-asset',
        source: code,
        seat: inv.seat,
        prompt: '锈蚀：选择弃掉一张道具。',
        options: candidates.map(candidate => ({
          id: candidate.id,
          label: ALL_CARDS[candidate.code]?.nameZh || candidate.code,
        })),
      })
      if (String(choice).startsWith('hand:')) inv.discard.push(inv.hand.splice(Number(choice.slice(5)), 1)[0])
      else api.discardAsset(inv.seat, choice)
      return false
    }
    if (code === '03104') {
      const stranger = state.enemies.some(enemy => original(enemy) === '03059')
      api.test(inv.seat, 'willpower', stranger ? 4 : 2, result => {
        if (!result.success) (stranger ? api.directHorror : api.horror)(inv.seat, 2)
      })
      return false
    }
    if (code === '03105') {
      const stranger = state.enemies.find(enemy => original(enemy) === '03059')
      if (stranger) for (const target of active(state)) api.attack(stranger, target)
      else state.scenarioFlags ||= {}, state.scenarioFlags.drawPallidMask = true
      return false
    }
    if (code === '03224') {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        let enemyCode = null
        while (state.encounterDeck.length) {
          const discarded = state.encounterDeck.pop()
          state.encounterDiscard.push(discarded)
          if (ALL_CARDS[original(discarded)]?.type === 'enemy') { enemyCode = discarded; break }
        }
        const enemies = state.encounterDiscard.filter(candidate => ALL_CARDS[original(candidate)]?.type === 'enemy')
        if (!enemyCode || !enemies.length) { api.horror(inv.seat, 1); return }
        const choice = api.choose({
          kind: 'encounter', source: code, seat: inv.seat,
          prompt: '致命运数：选择抽取刚弃掉的敌人，或令弃牌堆中的一名敌人攻击你。',
          options: [{ id: 'draw', label: `抽取「${ALL_CARDS[original(enemyCode)]?.nameZh || enemyCode}」` },
            { id: 'attack', label: '选择弃牌堆中的敌人攻击你' }],
        })
        if (choice === 'draw') {
          state.encounterDiscard.splice(state.encounterDiscard.lastIndexOf(enemyCode), 1)
          state.encounterDeck.push(enemyCode)
          api.drawEncounter(inv.seat)
          return
        }
        const choices = enemies.map((candidate, index) => ({
          id: `${index}:${candidate}`, code: candidate,
          name: ALL_CARDS[original(candidate)]?.nameZh || candidate,
        }))
        const picked = chooseOne(api, {
          kind: 'enemy', source: code, seat: inv.seat, prompt: '选择从弃牌堆攻击你的敌人。',
        }, choices, candidate => candidate.name)
        if (picked) api.attackFromDiscard(picked.code, inv.seat)
      })
      return false
    }
    if (code === '03225') {
      let placed = false
      api.test(inv.seat, 'willpower', 5, result => {
        if (!result.success) {
          api.threat(inv.seat, code, {
            resources: Math.max(1, result.difficulty - result.value),
            threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true },
          })
          placed = true
        }
      })
      return placed
    }
    if (code === '03226') {
      api.threat(inv.seat, code, {
        threatEffect: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
      })
      return true
    }
    if (code === '03260') {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const amount = Math.max(0, result.difficulty - result.value)
        const recipients = [{ id: `inv:${inv.seat}`, kind: 'investigator', name: inv.name,
          capacity: Math.max(0, (inv.maxSanity || 0) - inv.horror), assigned: 0 },
        ...inv.assets.flatMap(asset => {
          const sanity = ALL_CARDS[asset.code]?.sanity || 0
          return sanity > (asset.horror || 0) ? [{ id: `asset:${asset.id}`, kind: 'asset',
            assetId: asset.id, name: ALL_CARDS[asset.code]?.nameZh || asset.code,
            capacity: sanity - (asset.horror || 0), assigned: 0 }] : []
        })]
        for (let point = 0; point < amount; point++) {
          const available = recipients.filter(recipient => recipient.assigned < recipient.capacity)
          if (!available.length) break
          const minimum = Math.min(...available.map(recipient => recipient.assigned))
          const even = available.filter(recipient => recipient.assigned === minimum)
          const picked = chooseOne(api, {
            kind: 'horror', source: code, seat: inv.seat,
            prompt: `墙中之眼：分配第${point + 1}/${amount}点恐惧（必须尽量平均）。`,
          }, even, recipient => `${recipient.name}（已分配${recipient.assigned}）`)
          picked.assigned++
        }
        for (const recipient of recipients.filter(candidate => candidate.assigned)) {
          if (recipient.kind === 'investigator') api.horror(inv.seat, recipient.assigned)
          else api.horrorAsset(inv.seat, recipient.assetId, recipient.assigned)
        }
      })
      return false
    }
    if (code === '03261') {
      if (inv.threat.some(threat => original(threat) === code)) return false
      api.threat(inv.seat, code)
      return true
    }
    if (code === '03262') {
      const location = here(state, inv)
      location.attachments ||= []
      if (location.attachments.some(attachment => original(typeof attachment === 'string' ? { code: attachment } : attachment) === code)) {
        api.drawEncounter(inv.seat)
        return false
      }
      location.attachments.push({ id: `pit:${state.round}:${state.moveCount}`, code, originalCode: code })
      location.shroudMod = (location.shroudMod || 0) + 1
      return true
    }
    if (code === '03302' || code === '03303') {
      const deckId = code === '03302' ? 'a' : 'c'
      const deck = state.scenarioFlags?.agendaDecks?.[deckId]
      const amount = state.scenarioFlags?.openPath || state.actIndex >= 2
        ? 3 : Math.min(3, Number(deck?.index || 0) + 1)
      api.test(inv.seat, code === '03302' ? 'agility' : 'willpower', 3, result => {
        if (result.success) return
        if (code === '03302') {
          api.damage(inv.seat, amount)
          api.loseActions(inv.seat, amount)
        } else {
          api.horror(inv.seat, amount)
          api.discardChosen(inv.seat, amount, code)
        }
      })
      return false
    }
    if (code === '03337') {
      const sanity = Math.max(0, (inv.maxSanity || 0)
        + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
      const remainingSanity = Math.max(0, sanity - inv.horror)
      api.test(inv.seat, 'willpower', remainingSanity === 0 ? 5 : 3, result => {
        if (!result.success) api.damage(inv.seat, inv.horror > 2 * sanity ? 4 : 2)
      })
      return false
    }
    if (code === '03338') {
      let remaining = inv.horror
      let discarded = 0
      while (remaining > 0) {
        const hand = inv.hand.flatMap((candidate, index) =>
          inv.hiddenCards?.includes(candidate) ? [] : [{
            id: `hand:${index}`, code: candidate, cost: ALL_CARDS[candidate]?.cost || 0,
            label: `${ALL_CARDS[candidate]?.nameZh || candidate}（手牌，费用${ALL_CARDS[candidate]?.cost || 0}）`,
          }])
        const assets = inv.assets.flatMap(asset => asset.cannotLeavePlay ? [] : [{
          id: `asset:${asset.id}`, code: asset.code, cost: ALL_CARDS[asset.code]?.cost || 0,
          label: `${ALL_CARDS[asset.code]?.nameZh || asset.code}（场上，费用${ALL_CARDS[asset.code]?.cost || 0}）`,
        }])
        const candidates = [...hand, ...assets]
        if (!candidates.length) break
        const picked = chooseOne(api, {
          kind: 'discard', source: code, seat: inv.seat,
          prompt: `疯狂领域：还需弃掉印刷费用合计至少${remaining}的卡牌。`,
        }, candidates, candidate => candidate.label)
        if (!picked) break
        if (picked.id.startsWith('hand:')) {
          const index = Number(picked.id.slice(5))
          inv.discard.push(inv.hand.splice(index, 1)[0])
        } else api.discardAsset(inv.seat, picked.id.slice(6))
        remaining -= picked.cost
        discarded++
        if (picked.cost === 0 && candidates.every(candidate => candidate.cost === 0)) break
      }
      if (!discarded) api.horror(inv.seat, 2)
      return false
    }
    if (code === '03339') {
      const sanity = Math.max(0, (inv.maxSanity || 0)
        + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
      if (inv.horror >= sanity) api.addDoom(2)
      return false
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
      if (inv.hand.length > 0 && !inv.hand.some(code => inv.hiddenCards?.includes(code))) {
        options.push({ id: 'hand', label: `弃掉所有手牌（${inv.hand.length}）` })
      }
      if (!options.length) continue
      const choice = api.choose({
        kind: 'encounter', source: '03261', seat: inv.seat,
        prompt: '身后暗影：选择弃掉所有资源或所有手牌。',
        options,
      })
      if (choice === 'resources') inv.resources = 0
      else inv.discard.push(...inv.hand.splice(0))
      inv.threat.splice(inv.threat.indexOf(threat), 1)
      state.encounterDiscard.push(threat.code)
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
      state.fogMod = Math.max(0, (state.fogMod || 0) - 1)
      delete state.scenarioFlags.decayRound
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
  },
}
