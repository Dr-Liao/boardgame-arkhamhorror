import { beneathCards, storeBeneath, takeBeneath } from './commit-origins.js'
import { registeredEntry } from './ability.js'
import { cardDef } from './card-lookup.js'

export function canDiscardControlledAsset(state, inv, asset) {
  const entry = registeredEntry(asset?.code)
  return !!asset && inv.assets.includes(asset) && !cardDef(asset.code)?.permanent
    && !asset.cannotLeavePlay && !entry?.cannotLeavePlay && !entry?.cannotDiscard && !entry?.passive?.cannotDiscard
    && entry?.cannotLeavePlayWhile?.(state, inv, asset) !== true
}

export function notifyPlacedAsset(state, seat, asset, events, reactionWindow) {
  if (!asset || !state.investigators.some(inv => (inv.assets || []).some(source =>
    registeredEntry(source.code)?.abilities?.some(descriptor => descriptor.trigger?.includes('assetEnteredPlay'))))) return
  reactionWindow(state, 'assetEnteredPlay', { when: 'assetEnteredPlay', seat,
    assetId: asset.id, assetCode: asset.code, location: state.investigators[seat].location }, events, { allowNested: true })
}

export function createInvestigatorApi(state, events, deps) {
  return { investigatorTools: createInvestigatorMechanics(state, deps), discardEnemy: deps.discardEnemy }
}

export function validateInvestigatorMechanics(state) {
  const test = state.skillTest
  if (test) {
    if (test.target != null && (!['fight', 'evade', 'investigate'].includes(test.actionKind) || !['enemy', 'location'].includes(test.target.kind)
      || typeof test.target.id !== 'string' || !test.target.id || Object.keys(test.target).some(key => !['kind', 'id'].includes(key)))) throw new TypeError('Invalid typed test target')
    for (const key of ['baseSkillOverride', 'tokenRedraws']) if (test[key] != null && (!Number.isSafeInteger(test[key]) || test[key] < 0)) throw new TypeError('非法玩家卡检定计数存档')
    if (test.ignoredTokenModifiers != null && !Number.isFinite(test.ignoredTokenModifiers)) throw new TypeError('非法忽略标记修正存档')
    if (test.releaseAfterTest != null && (!Array.isArray(test.releaseAfterTest) || test.releaseAfterTest.some(id => typeof id !== 'string' || !id)
      || new Set(test.releaseAfterTest).size !== test.releaseAfterTest.length)) throw new TypeError('非法检定后释放存档')
    if (test.rerollGuard != null && (Object.keys(test.rerollGuard).some(key => key !== 'sourceId') || typeof test.rerollGuard.sourceId !== 'string' || !test.rerollGuard.sourceId)) throw new TypeError('非法重抽来源存档')
    if (test.tokenRewards != null && (Object.keys(test.tokenRewards).some(key => !['sourceId', 'ready', 'action'].includes(key))
      || typeof test.tokenRewards.sourceId !== 'string' || !test.tokenRewards.sourceId || typeof test.tokenRewards.ready !== 'boolean' || typeof test.tokenRewards.action !== 'boolean')) throw new TypeError('非法标记奖励存档')
  }
  if (state.playerWindowOccurrences != null && (typeof state.playerWindowOccurrences !== 'object' || Array.isArray(state.playerWindowOccurrences)
    || Object.entries(state.playerWindowOccurrences).some(([key, value]) => !['enemyPhaseEnds', 'upkeepEnd'].includes(key) || !Number.isSafeInteger(value) || value < 1))) throw new TypeError('非法阶段窗口计数存档')
  for (const asset of (state.investigators || []).flatMap(inv => inv.assets || [])) {
    if (asset.restrictedActionSpent != null && typeof asset.restrictedActionSpent !== 'boolean') throw new TypeError('非法支援额外行动存档')
    if (asset.paidX != null && (!Number.isSafeInteger(asset.paidX) || asset.paidX < 0)) throw new TypeError('非法可变费用存档')
    if (asset.capturedCards != null && (!Array.isArray(asset.capturedCards) || asset.capturedCards.some(item => !item || Object.keys(item).some(key => !['code', 'seat'].includes(key))
      || cardDef(item.code)?.subtype !== 'basicweakness' || !Number.isInteger(item.seat) || !state.investigators[item.seat]))) throw new TypeError('非法卡下弱点存档')
    const bonus = asset.triggeredSkillBonus
    if (bonus == null) continue
    if (typeof bonus !== 'object' || Array.isArray(bonus) || Object.keys(bonus).some(key => !['round', 'amount'].includes(key))
      || !Number.isSafeInteger(bonus.round) || bonus.round < 1 || !Number.isSafeInteger(bonus.amount) || bonus.amount < 0) {
      throw new TypeError('非法的支援触发能力技能加成存档')
    }
  }
  return true
}

// Shared card lifecycle operations. Card entries supply identities and rule choices.
export function createInvestigatorMechanics(state, deps) {
  const { choice, draw, commit, canCommit, returnAsset, discardAsset, playAsset, cardName } = deps
  return {
    canDiscardAsset: (seat, asset) => canDiscardControlledAsset(state, state.investigators[seat], asset),
    canReturnAsset(seat, asset) {
      const inv = state.investigators[seat], entry = registeredEntry(asset?.code)
      return inv.assets.includes(asset) && !cardDef(asset.code)?.permanent && !asset.cannotLeavePlay
        && !entry?.cannotLeavePlay && entry?.cannotLeavePlayWhile?.(state, inv, asset) !== true
    },
    rotateBeneath(seat, host) {
      const inv = state.investigators[seat]
      draw(seat, 1)
      for (const code of beneathCards(state, seat, host)) takeBeneath(state, seat, host, code, 'discard')
      if (!inv.hand.length) return false
      const forced = inv.hand.filter(code => registeredEntry(code)?.investigator?.mustPlaceBeneath)
      const candidates = forced.length ? forced : inv.hand.filter(code => !['weakness', 'basicweakness'].includes(cardDef(code)?.subtype))
      if (!candidates.length) return false
      const index = choice({ kind: 'effect', seat, source: host, prompt: '选择一张手牌放到调查员下方。',
        options: candidates.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })) })
      return storeBeneath(state, seat, host, candidates[Number(index)])
    },
    swapBeneathEvent(seat, host, code) {
      for (const old of beneathCards(state, seat, host)) takeBeneath(state, seat, host, old, 'hand')
      // Window-played events enter the discard pile after resolve; the deferred move
      // consumes that exact event then, rather than taking a same-name hand copy.
      ;(state.deferredBeneath ||= []).push({ seat, code, host })
      return true
    },
    commitBeneath(seat, host) {
      const code = beneathCards(state, seat, host)[0]
      if (!code || !canCommit(seat, code, { ignoreAdditionalCosts: true })) return false
      return commit(seat, { host, code, retain: true, ignoreAdditionalCosts: true })
    },
    retainSkills(seat, destination = 'hand') {
      for (const item of state.skillTest?.committed || []) if (item.seat === seat && cardDef(item.code)?.type === 'skill') {
        item.destination = destination
        delete item.origin
      }
    },
    setCommitmentDestination(index, destination) {
      const item = state.skillTest?.committed?.[index]
      if (!item || !['hand', 'discard'].includes(destination)) return false
      item.destination = destination; delete item.origin
      return true
    },
    multiplyCommitment(index, multiplier = 2) {
      const test = state.skillTest, item = test?.committed?.[index]
      if (!item || !Number.isSafeInteger(multiplier) || multiplier < 1) return false
      const delta = (item.icons || 0) * (multiplier - 1)
      test.extraCommittedIcons = (test.extraCommittedIcons || 0) + delta
      return true
    },
    onSuccessTokens(token, count) {
      if (!state.skillTest || !['bless', 'curse'].includes(token)) return false
      ;(state.skillTest.successPoolTokens ||= []).push({ token, count })
      return true
    },
    replaceAsset(seat, assetId, code = null, discount = 1) {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!canDiscardControlledAsset(state, inv, asset)) return false
      if (!discardAsset(seat, asset) || inv.assets.includes(asset)) return false
      const codes = inv.hand.filter(candidate => cardDef(candidate)?.type === 'asset'
        && cardDef(candidate)?.name !== cardDef(asset.code)?.name
        && Math.max(0, deps.playCost(seat, candidate) - discount) <= inv.resources)
      if (!codes.length) return true
      if (!code) {
        const index = choice({ kind: 'effect', seat, source: assetId, prompt: '选择要打出的不同名支援。',
          options: codes.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })) })
        code = codes[Number(index)]
      }
      if (!codes.includes(code)) throw new Error('替换支援选择已失效')
      if (!playAsset(seat, code, { discount, noAction: true })) throw new Error('替换支援打出失败')
      return true
    },
    markAbilityBonus(assetId, amount) {
      const asset = state.investigators.flatMap(inv => inv.assets).find(item => item.id === assetId)
      if (!asset) return false
      asset.triggeredSkillBonus = { round: state.round, amount }
      return true
    },
    returnWeaponSkills(seat, assetId) {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return false
      if (!returnAsset(seat, asset) || inv.assets.includes(asset)) return false
      this.retainSkills(seat)
      return true
    },
  }
}
