import { createGameState, applyMove, legalMoves, validateMove } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { PLAYER_CARD_CODES } from '../src/deck/availability.js'

const s = createGameState({ campaignHub: true, seed: 'repro2' }, [{ seat: 0, role: 'human' }])
const act = (seat, move) => {
  const err = validateMove(s, seat, move)
  if (err) throw new Error(`${move.action}: ${err}`)
  return applyMove(s, seat, move)
}
const acts = seat => legalMoves(s, seat).map(m => m.action)
const has = a => acts(0).includes(a)

act(0, { action: 'hubGoSetup' })
act(0, { action: 'hubSelectInvestigator', code: '01001' })
act(0, { action: 'hubAutoDeck' })
act(0, { action: 'hubDoneSeat' })

// 关间：原调查员死亡
s.campaign.investigators[0].status = 'killed'
s.investigators[0].defeated = true
s.uiState = 'interlude'; s.phase = 'interlude'; s.campaign.phase = 'interlude'
s.hubReady = false; s.hubSeatDone = {}; s.currentSeat = 0; s.hubUpgradedSeats = {}

act(0, legalMoves(s, 0).find(m => m.action === 'hubSelectInvestigator'))
console.log('选人后 setDeck?', has('hubSetDeck'), ' autoDeck?', has('hubAutoDeck'))
act(0, { action: 'hubAutoDeck' })
console.log('自动后 setDeck?', has('hubSetDeck'), ' view.legalMoves 含 setDeck?', viewState(s, 0).legalMoves.some(m => m.action === 'hubSetDeck'))

const record = s.campaign.investigators[0]
const ordinary = record.deck.filter(code => PLAYER_CARD_CODES.includes(code))
console.log('普通卡张数', ordinary.length, ' identity', record.id, ' 非普通卡', record.deck.filter(c => !PLAYER_CARD_CODES.includes(c)))
act(0, { action: 'hubSetDeck', codes: ordinary })
console.log('手动保存后 setDeck?', has('hubSetDeck'), ' 牌组张数', s.campaign.investigators[0].deck.length, ' id 不变?', s.campaign.investigators[0].id === record.id)
act(0, { action: 'hubDoneSeat' })
console.log('确认后 setDeck?', has('hubSetDeck'), ' hubReplacementSeats =', JSON.stringify(s.hubReplacementSeats || null), ' uiState=', s.uiState)

// 下一关间（同一调查员仍存活）：不应再开放起始牌组重构
s.uiState = 'interlude'; s.phase = 'interlude'; s.campaign.phase = 'interlude'
s.hubReady = false; s.hubSeatDone = {}; s.currentSeat = 0; s.hubUpgradedSeats = {}
console.log('下一关间（现役）setDeck?', has('hubSetDeck'), ' autoDeck?', has('hubAutoDeck'), ' doneSeat?', has('hubDoneSeat'))
