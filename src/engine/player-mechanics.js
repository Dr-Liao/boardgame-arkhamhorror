import { putInHand } from './hand-entry.js'
import { registeredEntry } from './ability.js'
import { cardDef } from './card-lookup.js'
import { revealSealedToken, sealPoolTokens } from './chaos-token-pool.js'
import { beginChaosTest, drawChaosToken, endChaosTest } from './chaos-bag.js'
import { availableResources, spendFromPool } from './resource-bank.js'

export function hasPlayerWindow(state, window) {
  const sources = [...(state.enemies || []), ...(state.playerLocationAttachments || []),
    ...state.investigators.flatMap(inv => [{ code: inv.code }, ...inv.hand.map(code => ({ code })), ...inv.assets, ...inv.threat, ...(inv.attachments || [])])]
  return sources.some(source => registeredEntry(source.code)?.abilities.some(descriptor => descriptor.trigger.includes(window)))
}
export function playerWindowContext(state, when) {
  const occurrences = state.playerWindowOccurrences ||= {}
  occurrences[when] = (occurrences[when] || 0) + 1
  return { when, windowInstance: occurrences[when] }
}

export function createPlayerApi(state, events, deps) {
  const api = () => deps.api()
  const asset = id => state.investigators.flatMap(inv => inv.assets).find(card => card.id === id)
  const choice = (seat, source, prompt, options) => deps.choice({ kind: 'effect', seat, source, prompt, options })
  function moveRevealed(index, to) {
    const token = state.chaos.revealed[index], test = state.skillTest
    if (token == null || index < state.chaos.frames.at(-1)) return false
    state.chaos.revealed.splice(index, 1)
    if (to === 'bag') state.chaosBag.push(token)
    else { state.chaos.sealed.push({ token, source: to }); state.sealedTokens = state.chaos.sealed.map(item => item.token) }
    test.tokenTreatments = Object.fromEntries(Object.entries(test.tokenTreatments || {}).filter(([key]) => Number(key) !== index)
      .map(([key, spec]) => { const next = Number(key) > index ? Number(key) - 1 : Number(key); return [next, { ...spec, index: next }] }))
    test.tokenResults = (test.tokenResults || []).filter(item => item.index !== index).map(item => ({ ...item, index: item.index > index ? item.index - 1 : item.index }))
    return true
  }
  return { playerTools: {
    searchCommit(seat, { sourceId, count = 3 }) {
      const test = state.skillTest, source = asset(sourceId)
      if (!test || !source || state.investigators[seat].location !== state.investigators[test.seat].location) return false
      return api().lookAt(test.seat, { zone: 'deck', count, choose: 1, filter: { canCommit: true }, returnStrategy: 'shuffle',
        optional: true, source: sourceId, commitToTest: { payer: seat, sourceId, cost: 1 } })
    },
    returnRevealedBlessings(seat) {
      const test = state.skillTest
      if (!test) return false
      let returned = 0
      for (;;) {
        const indexes = state.chaos.revealed.flatMap((face, index) => face === 'bless' && index >= state.chaos.frames.at(-1) ? [index] : [])
        if (!indexes.length) break
        const selected = choice(seat, 'returnRevealed', '选择放回混乱袋并忽略修正的祝福。', [{ id: 'done', label: '完成' }, ...indexes.map(index => ({ id: String(index), token: 'bless', label: `祝福 ${index + 1}` }))])
        if (selected === 'done') break
        const index = Number(selected), row = test.tokenResults?.find(item => item.index === index)
        test.ignoredTokenModifiers = (test.ignoredTokenModifiers || 0) + (row?.modifier || 0)
        moveRevealed(index, 'bag'); returned++
      }
      return returned
    },
    sealVariableCost(seat, id, token) {
      const source = asset(id)
      return source ? api().playerTools.sealUpTo(seat, id, token, source.paidX || 0) : []
    },
    offerControl(seat, id) {
      const inv = state.investigators[seat], source = asset(id)
      if (!inv.assets.includes(source)) return false
      source.ownerSeat ??= seat
      const others = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location && deps.canPlace(other.seat, source))
      const selected = Number(choice(seat, id, '选择支援的控制者。', others.map(other => ({ id: String(other.seat), label: other.name }))))
      inv.assets.splice(inv.assets.indexOf(source), 1)
      deps.makeRoom(selected, source)
      state.investigators[selected].assets.push(source)
      return true
    },
    testAssignedHarm(context, source) {
      if (context.when !== 'assetHarmPlaced' || context.assetId !== source.id) return false
      const owner = source.ownerSeat ?? context.seat
      return api().test(owner, 'willpower', (source.damage || 0) + (source.horror || 0), {
        source: { code: source.code, assetId: source.id }, resolve: result => {
          if (result.success) return
          const controller = state.investigators.find(inv => inv.assets.includes(source))
          if (controller) {
            api().discardAsset(controller.seat, source)
            if (controller.seat !== owner) {
              const index = controller.discard.lastIndexOf(source.code)
              if (index >= 0) { controller.discard.splice(index, 1); state.investigators[owner].discard.push(source.code) }
            }
          }
          api().harm(owner, { damage: context.damage || 0, horror: context.horror || 0 })
        },
      })
    },
    enchantAttack(context, source) {
      if (context.when !== 'weaponFightInitiated' || context.assetId !== source.hostAssetId) return false
      const owner = source.ownerSeat ?? state.investigators.find(inv => inv.assets.some(asset => asset.id === source.hostAssetId))?.seat
      context.skillBonus = (context.skillBonus || 0) + api().stat(owner, 'willpower')
      context.damageBonus = (context.damageBonus || 0) + 1
      return true
    },
    drawBeneath(seat, host, code) {
      if (!api().commitOrigins.take(seat, host, code, 'hand')) return false
      deps.notifyDraw(seat, code)
      return true
    },
    cancelRevelation(context) {
      if (!['encounterDrawn', 'treachery'].includes(context.when) || context.cannotCancel || context.weakness) return false
      context.cancelled = true
      return true
    },
    skipEncounterStep(context) {
      if (context.when !== 'mythosEncounterStep') return false
      context.skip = true
      return true
    },
    recoverDiscard(seat, { max = 2, maxLevel = 5 } = {}) {
      const inv = state.investigators[seat], recovered = []
      let level = 0
      for (let i = 0; i < max; i++) {
        const cards = inv.discard.filter(code => !cardDef(code)?.subtype && Number.isSafeInteger(cardDef(code)?.xp) && cardDef(code).xp + level <= maxLevel)
        if (!cards.length) break
        const selected = choice(seat, 'recoverDiscard', '选择取回的弃牌。', [{ id: 'done', label: '完成' }, ...cards.map((code, index) => ({ id: String(index), cardCode: code, label: code }))])
        if (selected === 'done') break
        const code = cards[Number(selected)]
        inv.discard.splice(inv.discard.lastIndexOf(code), 1); putInHand(state, inv, code)
        recovered.push(code); level += cardDef(code)?.xp || 0
      }
      return recovered
    },
    attachWeaknessToAgenda(seat, code, token) {
      const agenda = state.agendas[state.agendaIndex]
      if (!agenda) return false
      const attachment = { id: deps.nextId(), code, ownerSeat: seat }
      ;(agenda.attachments ||= []).push(attachment)
      sealPoolTokens(state, attachment.id, token, 1, { exact: false })
      return attachment
    },
    lateCommitOrReturn(ownerSeat, performerSeat) {
      const seats = [...new Set([ownerSeat, performerSeat])]
      const selectedSeat = seats.length === 1 ? seats[0] : Number(choice(ownerSeat, 'lateCommit', '选择投入或收回卡牌的调查员。', seats.map(seat => ({ id: String(seat), label: state.investigators[seat].name }))))
      const inv = state.investigators[selectedSeat]
      const options = [{ id: 'done', label: '不改变投入' }]
      inv.hand.forEach((code, index) => { if (api().canCommitCard(selectedSeat, code)) options.push({ id: `commit:${index}`, label: `投入 ${code}`, cardCode: code }) })
      state.skillTest.committed.forEach((item, index) => { if (item.seat === selectedSeat) options.push({ id: `return:${index}`, label: `收回 ${item.code}`, cardCode: item.code }) })
      const selected = choice(selectedSeat, 'lateCommit', '选择投入一张卡，或收回一张已投入卡。', options)
      if (selected.startsWith('commit:')) return api().commitCards(selectedSeat, [inv.hand[Number(selected.slice(7))]])
      if (selected.startsWith('return:')) return api().commitOrigins.withdraw(selectedSeat, Number(selected.slice(7)))
      return false
    },
    baseSkillForTest(seat, sourceId, value = 5) {
      const test = state.skillTest
      if (!test || test.seat !== seat) return false
      const base = [].concat(test.skill).reduce((sum, skill) => sum + deps.baseStatValue(seat, skill), 0)
      const total = value * [].concat(test.skill).length
      test.pendingBonus = (test.pendingBonus || 0) + total - base
      test.baseSkillOverride = total
      test.tokenRewards = { sourceId, ready: false, action: false }
      return true
    },
    rerollToken(context, sourceId) {
      if (context.when !== 'tokenEffectWouldResolve' || context.cannotCancel) return false
      context.rerollToken = true
      state.skillTest.rerollGuard = { sourceId }
      return true
    },
    sealUpTo(seat, sourceId, token, max) {
      const tokens = [].concat(token)
      const available = Math.min(max, state.chaosBag.filter(face => tokens.includes(face)).length)
      const count = Number(choice(seat, sourceId, '选择封印标记数量。', Array.from({ length: available + 1 }, (_, n) => ({ id: String(n), label: String(n) }))))
      const before = (state.chaos?.sealed || []).length
      if (count > 0) api().interactions.seal(seat, sourceId, { tokens, count, optional: false })
      const result = (state.chaos?.sealed || []).slice(before).map(item => item.token)
      api().resolveEmptyUses()
      return result
    },
    testWithTokenBenefits(seat, spec) {
      const inv = state.investigators[seat], source = asset(spec.assetId)
      if (!inv.assets.includes(source) || !['fight', 'investigate', 'evade'].includes(spec.action)) return null
      let revealed = 0
      const neighbors = () => state.locations.filter(loc => state.locations.find(here => here.id === inv.location)?.connections?.includes(loc.id))
      const onToken = token => {
        if (token !== 'curse' || revealed++ > 0 && !spec.upgraded) return
        const options = [{ id: 'skip', label: '不执行额外效果' }]
        if (inv.assets.includes(source)) options.push({ id: 'charge', label: '补充 1 充能' })
        const enemies = state.enemies.filter(enemy => enemy.location === inv.location)
        const locations = neighbors().filter(loc => spec.action === 'investigate' ? api().canDiscoverClueAt(seat, loc.id) : api().canMoveTo(seat, loc.id))
        if (spec.action === 'fight') options.push(...enemies.map(enemy => ({ id: `enemy:${enemy.id}`, label: `对 ${enemy.name} 造成 1 伤害` })))
        else options.push(...locations.map(loc => ({ id: `location:${loc.id}`, label: spec.action === 'investigate' ? `发现 ${loc.name} 的 1 线索` : `移动至 ${loc.name}` })))
        const selected = choice(seat, source.id, '诅咒标记：选择额外效果。', options)
        if (selected === 'charge') api().addUses(source, 1)
        else if (selected.startsWith('enemy:')) api().damageEnemy(enemies.find(enemy => enemy.id === selected.slice(6)), 1, seat, { code: source.code })
        else if (selected.startsWith('location:')) {
          if (spec.action === 'investigate') api().discoverClue(seat, 1, selected.slice(9))
          else api().moveInvestigator(seat, selected.slice(9))
        }
      }
      const options = { assetId: source.id, trackAssetSource: true, skill: 'willpower', onToken,
        bonus: spec.bonus || 0, combatBonus: spec.bonus || 0, noSpend: true }
      let result
      if (spec.action === 'fight') result = api().fight(seat, spec.enemyId, { ...options, damageBonus: 1 })
      else if (spec.action === 'investigate') result = api().investigate(seat, { ...options, clueBonus: 1 })
      else {
        result = api().evade(seat, { ...options, enemyId: spec.enemyId })
        const enemy = state.enemies.find(enemy => enemy.id === spec.enemyId)
        if (result?.success && enemy && !enemy.elite) {
          const destinations = state.locations.filter(loc => state.locations.find(here => here.id === enemy.location)?.connections?.includes(loc.id))
          const selected = choice(seat, source.id, '可将躲避的非精英敌人移动到连接地点。', [{ id: 'skip', label: '不移动' }, ...destinations.map(loc => ({ id: loc.id, label: loc.name }))])
          if (selected !== 'skip') api().moveEnemy(enemy, selected)
        }
      }
      return result
    },
    revealSealedInstead(context, sourceId) {
      if (context.when !== 'beforeChaosTokenReveal' || context.replacementToken) return false
      const sealed = state.chaos?.sealed?.find(item => item.source === sourceId)
      if (!sealed) return false
      context.replacementToken = revealSealedToken(state, sourceId, sealed.token)
      api().resolveEmptyUses()
      return !!context.replacementToken
    },
    allowTokenRedraws(count = 2) {
      if (!state.skillTest || !Number.isSafeInteger(count) || count < 0) return false
      state.skillTest.tokenRedraws = (state.skillTest.tokenRedraws || 0) + count
      return true
    },
    releaseSealedAfterTest(id) {
      if (!state.skillTest || !id) return false
      state.skillTest.releaseAfterTest ||= []
      if (!state.skillTest.releaseAfterTest.includes(id)) state.skillTest.releaseAfterTest.push(id)
      return true
    },
    removeCommitment(item) {
      const index = state.skillTest?.committed.indexOf(item) ?? -1
      if (index < 0) return false
      item.withdrawn = true
      state.skillTest.committed.splice(index, 1)
      ;(state.removedFromGame ||= []).push(item.code)
      return true
    },
    inspectUntil(faces) {
      beginChaosTest(state)
      const tokens = []
      try { while (state.chaosBag.length) { const token = drawChaosToken(state); tokens.push(token); if (faces.includes(token)) break } }
      finally { endChaosTest(state, []) }
      return tokens
    },
    testBaseSkillValue() {
      const test = state.skillTest
      return test ? test.baseSkillOverride ?? [].concat(test.skill).reduce((sum, skill) => sum + deps.baseStatValue(test.seat, skill), 0) : 0
    },
    commitmentSourceId(item) {
      const test = state.skillTest
      const index = test?.committed.indexOf(item) ?? -1
      if (index < 0) return null
      return `commit:${state.round}:${state.moveCount}:${state.chaos?.frames?.length || 0}:${index}:${item.seat}:${item.code}`
    },
    replenishResources(id, amount = 2) {
      const card = asset(id)
      if (!card || card.usesType !== 'resources') return false
      card.uses = Math.max(card.uses || 0, amount)
      return true
    },
    resourceBoost(seat, id, skill) {
      const inv = state.investigators[seat], card = asset(id), test = state.skillTest
      if (!test || test.seat !== seat || ![].concat(test.skill).includes(skill) || !inv.assets.includes(card)) return false
      const options = []
      if ((card.uses || 0) > 0) options.push({ id: 'asset', label: '花费支援上的 1 资源' })
      if (availableResources(inv) > 0) options.push({ id: 'pool', label: '花费资源池中的 1 资源' })
      if (!options.length) return false
      const selected = choice(seat, id, '选择资源来源。', options)
      if (selected === 'asset') card.uses--
      else spendFromPool(inv, 1, state)
      test.pendingBonus = (test.pendingBonus || 0) + 1
      return true
    },
    exchangeSecret(seat, id, direction) {
      const inv = state.investigators[seat], card = asset(id)
      if (!inv.assets.includes(card)) return false
      const secrets = card.usesType === 'secrets' ? card.uses || 0 : card.useTokens?.secret || 0
      if (direction === 'resource') {
        if (!secrets) return false
        if (card.usesType === 'secrets') card.uses--
        else card.useTokens.secret--
        api().gainResources(seat, 1)
      } else {
        if (!availableResources(inv)) return false
        spendFromPool(inv, 1, state)
        if (card.usesType === 'secrets') card.uses = secrets + 1
        else { card.useTokens ||= {}; card.useTokens.secret = secrets + 1 }
      }
      return true
    },
    replaceEncounterDraw(context) {
      if (context.when !== 'encounterCardWouldDraw') return false
      context.replaced = true
      api().drawCards(context.seat, 1)
      return true
    },
    modifyPlay(context, { discount = 0, fast = false } = {}) {
      if (!['beforePlayCost', 'beforePlayAttempt'].includes(context.when)) return false
      context.costReduction = (context.costReduction || 0) + discount
      if (fast) context.noAction = true
      return true
    },
    sealRevealed(sourceId, indexes) {
      if (!state.skillTest) return false
      for (const index of indexes) {
        const token = state.chaos.revealed[index]
        if (!['bless', 'curse'].includes(token)) return false
      }
      for (const index of [...indexes].sort((a, b) => b - a)) moveRevealed(index, sourceId)
      return true
    },
    removeAssetFromGame(seat, id) {
      const inv = state.investigators[seat], card = inv.assets.find(card => card.id === id)
      if (!card || !api().discardAsset(seat, card)) return false
      const index = inv.discard.lastIndexOf(card.code)
      if (index >= 0) inv.discard.splice(index, 1)
      ;(state.removedFromGame ||= []).push(card.code)
      return true
    },
    captureWeakness(context, id) {
      const host = asset(id)
      if (!host || context.when !== 'cardWouldBeDrawn' || cardDef(context.cardCode)?.subtype !== 'basicweakness') return false
      host.capturedCards ||= []
      host.capturedCards.push({ code: context.cardCode, seat: context.seat })
      context.captured = true
      return true
    },
    returnCapturedWeaknesses(source) {
      for (const item of source.capturedCards || []) deps.drawWeakness(item.seat, item.code)
      delete source.capturedCards
      return true
    },
  } }
}
