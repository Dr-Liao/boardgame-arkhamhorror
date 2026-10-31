// 复现：02305 黄金怀表在场上时，卡面没有「快速反应」开关（hasReactionPrompt 缺失）。
import { createGameState, allCardDefs, applyMove, validateMove, refreshStateResources } from '../src/engine/engine.js'
import { reactionChoices } from '../web/reaction-preferences.js'
import arkham from '../index.js'

const all = allCardDefs({ runtimeOnly: false })
console.log('[allCardDefs] 02305', {
  name: all['02305']?.name,
  hasReactionPrompt: all['02305']?.hasReactionPrompt,
  hasAutoReaction: all['02305']?.hasAutoReaction,
  autoByDefault: all['02305']?.autoByDefault,
  reactionIds: all['02305']?.reactionIds,
})

const st = createGameState({ seed: 'repro-02305', playerInvestigator: '01001' }, [{ seat: 0, role: 'human' }])
const answer = (s, id) => applyMove(s, s.pendingChoice.seat, { action: 'choose', choiceId: s.pendingChoice.id, optionId: id })
for (let i = 0; st.pendingChoice; i++) {
  if (i > 60) throw new Error('opening loop')
  answer(st, ['done', 'skip', 'self'].find(id => st.pendingChoice.options.some(o => o.id === id))
    || st.pendingChoice.options[0].id)
}
const inv = st.investigators[0]
inv.actionsLeft = 20
inv.hand = []
inv.assets = [{ id: 'gold-watch', code: '02305', exhausted: false }]
st.enemies = []
st.acts[0].objective = null
refreshStateResources(st)
console.log('[view.cards 02305 before endTurn]', st.cards['02305'] && {
  name: st.cards['02305'].name,
  hasReactionPrompt: st.cards['02305'].hasReactionPrompt,
  hasAutoReaction: st.cards['02305'].hasAutoReaction,
})

applyMove(st, 0, { action: 'endTurn' })
const choice = st.pendingChoice
console.log('[window]', choice && {
  kind: choice.kind, source: choice.source, seat: choice.seat, canSkip: choice.canSkip,
  options: choice.options?.map(o => ({ id: o.id, label: o.label, cardCode: o.cardCode })),
})
console.log('[state.cards 02305]', st.cards['02305'] && {
  name: st.cards['02305'].name,
  hasReactionPrompt: st.cards['02305'].hasReactionPrompt,
  hasAutoReaction: st.cards['02305'].hasAutoReaction,
})
console.log('[reactionChoices]', reactionChoices(st).map(item => ({ code: item.code, optionId: item.move.optionId })))
console.log('[autoChoice states={02305:skip}]', arkham.autoChoice({ state: st, seat: 0, states: { '02305': 'skip' } }))
console.log('[autoChoice states={}]', arkham.autoChoice({ state: st, seat: 0, states: {} }))
const skip = { action: 'choose', choiceId: choice.id, optionId: 'skip' }
console.log('[validateMove skip]', validateMove(st, 0, skip))
