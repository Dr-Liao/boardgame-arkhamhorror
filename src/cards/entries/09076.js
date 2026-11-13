// 09076 职业枪手（Trigger Man）· 游荡者支援 · 3 经验。
// 卡面：[reaction] 在职业枪手入场后：将你手牌中一张[[违法]]支援附属到职业枪手（其视为在场，由你控制）。
//       [fast] 横置职业枪手并花费 1 资源：结算附属支援上的一个[action]能力，不支付其[action]费用。
//       以基础技能值为 4 结算该能力。
//
// 读点：
//   · 入场反应：assetEnteredPlay 窗口（context.assetCode/assetId）；
//   · 附属：api.putAssetIntoPlay + api.attachOrSwapControlledAsset（引擎唯一的附属/交换写点）；
//   · 结算附属能力：api.cardAbilityOptions + api.resolveCardAbility(ignoreCosts:true)（与 08089 同源）。
//
// approximation:
//   · 「以基础技能值为 4 结算」没有描述子级 baseValue 覆盖读点（resolveCardAbility 只支持
//     ignoreCosts），已写 primitive-request；测试覆盖「不付 action 费用结算附属攻击」。
//   · 「视为在场」用真实放置入场近似（附属支援会占用槽位；引擎没有「场外但在场」形状）。
export default {
  code: '09076',
  simplified: true,
  note: 'approximation: 见 primitive-request/09076.json（附属能力的「基础技能值 4」缺少描述子级 baseValue 覆盖，未实现）',
  abilities: [
    {
      kind: 'entersPlay',
      label: '职业枪手入场后：把手中一张[[违法]]支援附属到它（视为在场）',
      resolve: ({ inv, source, api }) => {
        const host = source
        if (!host) return
        const candidates = [...new Set((inv.hand || []).filter(code => {
          if (api.cardType(code) !== 'asset') return false
          const traits = api.cardTraits(code).map(trait => String(trait).toLowerCase())
          return traits.includes('illicit')
        }))]
        if (!candidates.length) {
          api.info('「职业枪手」：手里没有可附属的[[违法]]支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: '09076', seat: inv.seat,
          prompt: '选择一张手牌中的[[违法]]支援附属到职业枪手。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        if (!picked) return
        api.putAssetIntoPlay(inv.seat, picked)
        const placed = (inv.assets || []).filter(asset => asset.code === picked && asset.attachedToAsset == null).at(-1)
        if (placed) api.attachOrSwapControlledAsset(inv.seat, host.id, placed.id)
        api.info(`🔫 「职业枪手」：将「${api.cardName(picked)}」附属到它。`)
      },
    },
    {
      kind: 'free',
      label: '横置并花费 1 资源：不付[action]费用结算附属支援的一个[action]能力',
      cost: { action: false, exhaust: true, resources: 1 },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const attached = (inv.assets || []).find(asset => asset.attachedToAsset === source.id)
        if (!attached) {
          api.info('「职业枪手」：没有附属的支援。')
          return
        }
        const options = api.cardAbilityOptions(inv.seat, attached, { ignoreCosts: true })
        if (!options.length) {
          api.info(`「${api.cardName(attached.code)}」没有可结算的[action]能力。`)
          return
        }
        const picked = options.length === 1 ? options[0] : api.choice({
          kind: 'ability', source: '09076', seat: inv.seat,
          prompt: `选择要结算的「${api.cardName(attached.code)}」能力。`,
          options: options.map(option => ({ id: String(option.index), label: option.label })),
        })
        const chosen = options.find(option => String(option.index) === String(picked)) || options[0]
        api.resolveCardAbility(inv.seat, attached, { abilityIndex: chosen.index, ignoreCosts: true })
      },
    },
  ],
  modifiers: [],
}
