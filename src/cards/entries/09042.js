// 09042 鸦翎羽毛笔 · 定制升级效果按附属实例及其宿主结算。
import { customizationChoiceValues, customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'
import { ALL_CARDS } from '../cards-data.js'

const SOURCE = '09042'
const unlocked = (state, seat, index) => customizationOptionFullyChecked(state, seat, SOURCE, index)
const hostOf = (inv, source) => inv.assets.find(asset => asset.attachments?.includes(source))
const isHostTrait = traits => traits.some(trait => ['tome', 'spell'].includes(String(trait).toLowerCase()))
const readyTargets = (inv, hostId) => inv.assets.filter(card => card.id !== hostId && card.exhausted)
const useType = card => String(card.usesType || '').toLowerCase().replace(/s$/, '')

function attachmentTargets(inv, titles, cardDef) {
  return inv.assets.filter(asset => {
    const definition = cardDef?.(asset.code)
    const card = ALL_CARDS[asset.originalCode ?? definition?.originalCode ?? asset.code] ?? definition
    // 尚未录入升级卡的旧局仍可附属；下一次构筑或升级时登记名称。
    return titles.length ? titles.includes(card?.name) : isHostTrait(card?.traits || [])
  })
}

const hasSupernaturalRecord = (state, inv, titles) => titles.length > 0 && unlocked(state, inv.seat, 6)

function tokenSources(inv, host) {
  if (!host) return []
  return inv.assets.filter(card => card !== host).flatMap(card =>
    ['secret', 'charge'].filter(type => (!useType(host) || useType(host) === type)
      && (useType(card) === type ? card.uses : card.useTokens?.[type]) > 0)
      .map(type => ({ card, type, id: `${card.id}:${type}` })))
}

export default {
  code: SOURCE,
  keepOnPlay: true,
  note: 'approximation: 尚无撤退或游戏结束时的战役奖励。',
  assetRule: {
    hostIgnoresOpportunityAttack: ({ state, inv, source }) => unlocked(state, source.ownerSeat ?? inv.seat, 0),
  },
  customizationChoices: { kind: 'assetTitle', base: 1, options: { 3: 2 } },
  customizationOptions: [
    { name: 'Living Quill', checks: 1, text: "Using attached asset's [action] abilities does not provoke attacks of opportunity." },
    { name: 'Spectral Binding', checks: 1, text: 'Attached asset does not take up any slots.' },
    { name: 'Mystic Vane', checks: 2, text: 'You get +2 skill value while performing skill tests on attached asset.' },
    { name: 'Endless Inkwell', checks: 2, text: 'Name two more [[Tome]] or [[Spell]] assets:' },
    { name: 'Energy Sap', checks: 2, text: 'The Raven Quill gains: "[fast] Exhaust The Raven Quill: Move 1 secret or charge from an asset you control to attached asset."' },
    { name: 'Interwoven Ink', checks: 3, text: 'After you resolve an [action] ability on attached asset, you may exhaust The Raven Quill to ready another asset you control.' },
    { name: 'Supernatural Record', checks: 4, text: 'When you play The Raven Quill, instead of attaching it to a named asset you control, you may search your deck, discard pile, and hand for a copy of a named asset and play it (paying its cost). Then, attach The Raven Quill to it.' },
  ],
  playCondition: [{
    when: ({ state, inv, helpers }) => {
      const titles = customizationChoiceValues(state, inv.seat, SOURCE)
      return attachmentTargets(inv, titles, helpers.cardDef).length > 0 || (hasSupernaturalRecord(state, inv, titles)
        && helpers.canSearchPlayableAsset?.(inv, {
          titles,
          hostIgnoresSlots: unlocked(state, inv.seat, 1),
          reservedResources: helpers.playCost?.(inv, SOURCE) ?? ALL_CARDS[SOURCE].cost,
        }))
    },
    message: '没有可附属的已指定支援，也无法通过神奇记录打出已指定支援',
  }],
  abilities: [
    {
      kind: 'played',
      label: '附属到已指定的支援',
      resolve: ({ state, inv, api }) => {
        const titles = customizationChoiceValues(state, inv.seat, SOURCE)
        const candidates = attachmentTargets(inv, titles, api.cardDef)
        const hostIgnoresSlots = unlocked(state, inv.seat, 1)
        const canSearch = hasSupernaturalRecord(state, inv, titles)
          && api.canSearchPlayableAsset(inv.seat, { titles, hostIgnoresSlots })
        const options = candidates.map(asset => ({ id: asset.id, cardCode: asset.code, label: api.cardName(asset.code) }))
        if (canSearch) options.push({ id: 'search', label: '神奇记录：查找并打出一张已指定的支援' })
        const chosen = options.length > 1 ? api.choice({
          kind: canSearch ? 'effect' : 'asset', source: SOURCE, seat: inv.seat,
          prompt: canSearch ? '鸦翎羽毛笔：选择要附属的支援，或使用神奇记录。' : '鸦翎羽毛笔：选择要附属的支援。',
          options,
        }) : options[0]?.id
        const host = chosen === 'search' ? api.searchPlayableAsset(inv.seat, { source: SOURCE, titles, hostIgnoresSlots })
          : candidates.find(asset => asset.id === chosen)
        if (!host || !api.attachPlayerCardToAsset(SOURCE, host, { ownerSeat: inv.seat, ...(hostIgnoresSlots ? { hostIgnoresSlots } : {}) })) {
          api.putIntoDiscard(inv.seat, SOURCE)
          return
        }
        api.info(`鸦翎羽毛笔：附属到「${api.cardName(host.code)}」。`)
      },
    },
    {
      kind: 'free',
      label: '墨力汲取：横置本卡，把 1 充能或秘密移到所附属支援',
      cost: { exhaust: true },
      criteria: [({ state, inv, source }) => unlocked(state, inv.seat, 4)
        && tokenSources(inv, hostOf(inv, source)).length > 0],
      resolve: ({ inv, source, api }) => {
        const host = hostOf(inv, source)
        const sources = tokenSources(inv, host)
        if (!sources.length) return
        const id = sources.length === 1 ? sources[0].id : api.choice({
          kind: 'asset', source: SOURCE, seat: inv.seat,
          prompt: '墨力汲取：选择要移动哪一个充能或秘密。',
          options: sources.map(({ card, type, id }) => ({ id, label: `${api.cardName(card.code)}（${type === 'secret' ? '秘密' : '充能'}）` })),
        })
        const picked = sources.find(item => item.id === id)
        if (picked) api.useTokens.move(picked.card.id, host.id, picked.type, 1)
      },
    },
    {
      kind: 'reaction', trigger: 'assetActionResolved',
      label: '交织墨水：横置本卡，重整你控制的另一张支援',
      cost: { exhaust: true },
      criteria: [({ state, inv, source, context }) => unlocked(state, inv.seat, 5) && context.seat === inv.seat
        && context.assetId === source.hostAssetId && readyTargets(inv, context.assetId).length > 0],
      resolve: ({ inv, context, api }) => {
        const alternatives = readyTargets(inv, context.assetId)
        const id = alternatives.length === 1 ? alternatives[0].id : api.choice({
          kind: 'asset', source: SOURCE, seat: inv.seat,
          prompt: '交织墨水：选择另一张支援重整。',
          options: alternatives.map(card => ({ id: card.id, label: api.cardName(card.code) })),
        })
        api.ready(alternatives.find(card => card.id === id))
      },
    },
  ],
  modifiers: [{
    target: 'testValue', amount: 2,
    condition: { when: ({ state, inv, source }) => {
      if (!state.skillTest || !unlocked(state, inv.seat, 2)) return false
      const assetId = state.skillTest.assetSourceId ?? state.skillTest.source?.assetId ?? state._resolvingAssetId
      const host = hostOf(inv, source)
      return Boolean(host) && host.id === assetId
    } },
  }],
}
