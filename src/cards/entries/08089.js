// 08089 快拔枪套
// 卡面：[free]：选择一张在你游戏区域，只占据1个手部槽位的[[枪械]]支援，将其附属到快拔枪套，
//       或与已附属的支援交换。附属的支援不占用手部槽位。(附属的支援仅限1张。)
//       [free]横置快拔枪套：执行一次已附属支援的攻击行动且无需支付其[action]费用。
//
// 附属只豁免手部槽，代执行仅免除行动费用。
import { ALL_CARDS } from '../cards-data.js'

const singleHandFirearm = asset => {
  const definition = ALL_CARDS[asset.code]
  const slots = asset.slotsOverride ? asset.slots : definition?.slots
  const hands = (slots || []).map(slot => String(slot).toLowerCase().replaceAll(' ', ''))
    .filter(slot => slot === 'hand' || slot === 'handx2')
  return hands.length === 1 && hands[0] === 'hand'
    && (definition?.traits || []).some(trait => String(trait).toLowerCase() === 'firearm')
}

const attachable = (inv, source) => inv.assets.filter(asset => asset !== source
  && asset.attachedToAsset == null && singleHandFirearm(asset))
const attackOptions = { ignoreActionCost: true, actionOnly: true, countsAs: 'fight' }

export default {
  code: '08089',
  attachedAssetsIgnoreSlots: ['hand'],
  abilities: [
    { kind: 'free', label: '选择一张[[枪械]]支援附属到快拔枪套（或交换）', cost: { action: false },
      criteria: ({ inv, source }) => attachable(inv, source).length > 0,
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const candidates = attachable(inv, source).map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))
        if (!candidates.length) { api.info('没有可附属的[[枪械]]支援。'); return }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '08089', seat: inv.seat, prompt: '选择要附属（或交换）的[[枪械]]支援。', options: candidates,
        })
        api.attachOrSwapControlledAsset(inv.seat, source.id, picked)
      } },
    { kind: 'free', label: '横置：免费执行附属[[枪械]]的攻击行动', cost: { action: false, exhaust: true },
      criteria: ({ inv, source, helpers }) => {
        const attached = inv.assets.find(asset => asset.attachedToAsset === source?.id)
        return Boolean(attached && helpers.cardAbilityOptions(attached, attackOptions).length)
      },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const attached = inv.assets.find(asset => asset.attachedToAsset === source.id)
        if (!attached) { api.info('快拔枪套上没有附属的[[枪械]]支援。'); return }
        const options = api.cardAbilityOptions(inv.seat, attached, attackOptions)
        if (!options.length) return
        const selected = options.length === 1 ? options[0].index : Number(api.choice({
          kind: 'effect', source: '08089', seat: inv.seat, prompt: '选择要执行的附属枪械攻击行动。',
          options: options.map(attack => ({ id: String(attack.index), label: attack.label })),
        }))
        api.resolveCardAbility(inv.seat, attached, { ...attackOptions, abilityIndex: selected })
      } },
  ],
  modifiers: [],
}
