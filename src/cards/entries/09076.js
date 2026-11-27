// 09076 职业枪手（Trigger Man）· 游荡者支援 · 3 经验。
// 卡面：[reaction] 在职业枪手入场后：将你手牌中一张[[违法]]支援附属到职业枪手（其视为在场，由你控制）。
//       [fast] 横置职业枪手并花费 1 资源：结算附属支援上的一个[action]能力，不支付其[action]费用。
//       以基础技能值为 4 结算该能力。
//
const code = '09076'
const waiveAction = { actionOnly: true, ignoreActionCost: true }
const attachedAsset = (inv, source) => inv.assets.find(asset => asset.attachedToAsset === source.id)
const illicitAssets = (inv, cardType, cardTraits) => inv.hand.filter(card =>
  cardType(card) === 'asset' && cardTraits(card).some(trait => trait.toLowerCase() === 'illicit'))

export default {
  code,
  attachedAssetsIgnoreSlots: ['hand', 'arcane', 'body', 'accessory', 'ally', 'tarot'],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetEnteredPlay',
      label: '入场后：将手中一张[[违法]]支援附属到职业枪手',
      criteria: [({ inv, source, context, helpers }) => context.assetId === source.id
        && illicitAssets(inv, helpers.cardType, helpers.cardTraits).length > 0],
      resolve: ({ inv, source, api }) => {
        const candidates = [...new Set(illicitAssets(inv, api.cardType, api.cardTraits))]
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat,
          prompt: '选择要附属到职业枪手的[[违法]]支援。',
          options: candidates.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
        })
        if (picked) api.putHandAssetOnHost(inv.seat, picked, source)
      },
    },
    {
      kind: 'free',
      label: '横置并花费 1 资源：以基础技能值 4 结算附属支援的一个行动能力，免付行动费用',
      cost: { exhaust: true, resources: 1 },
      criteria: [({ inv, source, helpers }) => {
        const attached = attachedAsset(inv, source)
        return attached && helpers.cardAbilityOptions(attached, waiveAction).length > 0
      }],
      resolve: ({ inv, source, api }) => {
        const attached = attachedAsset(inv, source)
        if (!attached) return
        const options = api.cardAbilityOptions(inv.seat, attached, waiveAction)
        if (!options.length) return
        const answer = options.length === 1 ? String(options[0].index) : api.choice({
          kind: 'ability', source: code, seat: inv.seat,
          prompt: `选择「${api.cardName(attached.code)}」的行动能力。`,
          options: options.map(option => ({ id: String(option.index), label: option.label })),
        })
        return api.resolveCardAbility(inv.seat, attached, {
          ...waiveAction, abilityIndex: Number(answer), baseValue: 4,
        })
      },
    },
  ],
  modifiers: [],
}
