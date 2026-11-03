import { putInHand } from '../../../src/engine/hand-entry.js'

// Recollections temporarily obtain Harper from the rebuilt scenario deck.
// Campaign ownership remains intact for the next ReloadDecks.
// 卡号是内容数据：这里只声明「哪些战役同伴会被回忆章节暂取」，不写按卡号的规则分支
//（内容层 `code === '0xxxx'` 分支的守卫基线是 0）。
const RECALLED_COMPANIONS = ['07083']
const DAWSON = '07082'
export function prepareCompanions(state, events, api) {
  const id=state.scenario.id
  if (!['devilReef','theLairOfDagon'].includes(id)) return
  for (const inv of state.investigators) {
    const cards=inv.deck.filter(code=>RECALLED_COMPANIONS.includes(code))
    if (!cards.length) continue
    inv.deck=inv.deck.filter(code=>!RECALLED_COMPANIONS.includes(code))
    ;(state.scenarioZones.limbo ||= []).push(...cards)
  }
  if (id!=='devilReef') return
  const records=state.campaign.records
  if (!records.TheMissionFailed && !records.TheMissionWasSuccessful) return
  const candidates=state.investigators.filter(inv=>!inv.defeated&&!inv.resigned)
  if (!candidates.length) return
  const seat=candidates.length===1?candidates[0].seat:Number(api.choose({
    kind:'investigator',seat:state.campaign.leadSeat,source:DAWSON,
    prompt:records.TheMissionFailed?'选择一位调查员，将托马斯·道森洗入其牌库。':'选择一位调查员，其起始手牌额外获得托马斯·道森。',
    options:candidates.map(inv=>({id:String(inv.seat),label:inv.name}))
  }))
  const inv=state.investigators[seat]
  if (!candidates.includes(inv)) throw new Error('Invalid companion recipient')
  if (records.TheMissionFailed) inv.deck=api.shuffle([...inv.deck,DAWSON])
  else putInHand(state,inv,DAWSON)
}
