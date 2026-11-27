import { ALL_CARDS } from '../cards/cards-data.js'
import { hasWindowListener } from './window-listeners.js'
import { requestChoice } from './resolution.js'

const title = card => card?.name || card?.nameZh
let nameOptions

export function nameDrawPrediction(state, inv, context, { source, discount }) {
  if (context?.when !== 'cardAboutToBeDrawn' || !Array.isArray(context.drawPredictions)) return false
  if (!nameOptions) {
    const names = new Map()
    for (const card of Object.values(ALL_CARDS)) {
      const name = title(card)
      if (name && !names.has(name)) names.set(name, { id: name, label: card.nameZh || name })
    }
    nameOptions = [...names.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh'))
  }
  const chosen = requestChoice(state, {
    kind: 'cardName', source, seat: inv.seat, prompt: '指定一张卡牌的名称', options: nameOptions,
  })
  if (!chosen) return false
  context.drawPredictions.push({ name: chosen, source, discount })
  return true
}

export function beforeNamedDraw(state, inv, from, events, reactionWindow) {
  if (!hasWindowListener(state, 'cardAboutToBeDrawn')) return []
  const context = {
    when: 'cardAboutToBeDrawn', seat: inv.seat, location: inv.location, from,
    prompt: from === 'encounter' ? '将要抽取一张遭遇卡' : '将要从调查员牌库抽取一张卡',
    drawPredictions: [],
  }
  return reactionWindow(state, context.when, context, events, { allowNested: true }).drawPredictions || []
}

export function selectNamedDrawOutcome(state, inv, card, predictions, { canCancel, canPlay }) {
  for (const prediction of predictions) {
    const printed = ALL_CARDS[card?.originalCode || card?.code]
    const localizedName = nameOptions?.find(option => option.id === prediction.name)?.label
    const matches = printed ? prediction.name === title(printed)
      : prediction.name === title(card) || localizedName != null && [card?.name, card?.nameZh].includes(localizedName)
    if (!matches) continue
    const options = [
      ...(canCancel ? [{ id: 'cancel', label: '取消效果并弃掉' }] : []),
      ...(canPlay?.(prediction.discount) ? [{ id: 'play', label: '立即以降低的费用打出' }] : []),
    ]
    if (!options.length) continue
    const selected = requestChoice(state, {
      kind: 'effect', source: prediction.source, seat: inv.seat,
      prompt: '抽到了指定的「' + (card.nameZh || title(card)) + '」',
      options: [...options, { id: 'skip', label: '照常抽取' }],
    })
    if (selected === 'cancel' || selected === 'play') return { action: selected, discount: prediction.discount }
  }
  return null
}
