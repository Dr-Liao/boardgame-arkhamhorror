import { createGameState, applyMove, legalMoves, validateMove } from '../src/engine/engine.js'

const s = createGameState({ campaignHub: true, seed: 'repro' }, [{ seat: 0, role: 'human' }])
const act = (seat, move) => {
  const err = validateMove(s, seat, move)
  if (err) throw new Error(`${move.action}: ${err}`)
  return applyMove(s, seat, move)
}
act(0, { action: 'hubGoSetup' })
act(0, { action: 'hubSelectInvestigator', code: '01001' })
act(0, { action: 'hubAutoDeck' })
act(0, { action: 'hubDoneSeat' })
// 模拟一关结束：原调查员死亡，进入关间
s.campaign.investigators[0].status = 'killed'
s.investigators[0].defeated = true
s.uiState = 'interlude'; s.phase = 'interlude'; s.campaign.phase = 'interlude'
s.hubReady = false; s.hubSeatDone = {}; s.currentSeat = 0; s.hubUpgradedSeats = {}

const actions = () => legalMoves(s, 0).map(m => m.action)
console.log('关间（死亡后）可选：', actions())
const pick = legalMoves(s, 0).find(m => m.action === 'hubSelectInvestigator')
console.log('挑选替补：', pick.code)
act(0, pick)
console.log('选完替补：', actions())
act(0, { action: 'hubAutoDeck' })
console.log('自动构筑后：', actions())
console.log('hubSetDeck 校验：', validateMove(s, 0, { action: 'hubSetDeck', codes: s.campaign.investigators[0].deck.filter(c => !/signature|weakness/.test(s.cards[c]?.subtype || '')) }))
console.log('调查员 autoBuilt =', s.investigators[0].autoBuilt, ' startingDeckReady =', s.campaign.investigators[0].startingDeckReady)
