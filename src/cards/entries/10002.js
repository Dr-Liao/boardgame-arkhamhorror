// 10002 应急手段（Ad Hoc）· 事件 · 即兴 / 升级 · 威尔森·理查德牌库专用
// 卡面：
//   威尔森·理查德牌库专用。
//   将应急手段附属到你控制的[[工具]]或[[武器]]支援。
//   [reaction]在结算了所附属支援的一个[action]能力后，横置应急手段并弃掉你手牌中的一个[[工具]]或
//     [[武器]]支援：结算弃掉的支援上的一个[action]能力，忽略所有费用。
//
// 读点（卡面 → 引擎读点）：
//   · 附属：`played` 描述子 resolve 里选择一个本人控制的[[工具]]/[[武器]]支援，走
//     api.attachPlayerCardToAsset（api-misc.js → actions-extra.js#attachCardTo 的唯一写点，
//     与 09067/09042/08074 同一条「事件留在宿主上」的形状）；条目 `keepOnPlay` 阻止事件在结算后
//     进弃牌堆（读点 actions.js 的事件收尾段）。
//     只枚举 `inv.assets` 里未附属的支援：附属在别张支援上的卡不会被 descriptorSources 枚举为能力来源，
//     挂上去会让下面的反应永远不出现。
//   · 反应时机：`assetActionResolved`（ability-exec.js#doAbility 在 action 描述子结算后派发，
//     context 带 { seat, assetId, assetCode, descriptorId }）。
//     所附属支援的判定：descriptorSources 为宿主 attachments 里的每一张卡写入非枚举
//     `hostAssetId/hostCode`（ability-rules.js），因此 `source.hostAssetId === context.assetId`
//     就是「刚结算完[action]能力的那张宿主」。
//   · 横置：`cost: { exhaust: true }`（引擎统一付费读点 payAbilityCost；同时挡住重复触发）。
//   · 弃手牌 + 忽略费用结算：api.discardFromHand（手牌弃置写点）、api.cardAbilityOptions +
//     api.resolveCardAbility（{ ignoreCosts: true, actionOnly: true }；与 08089/09076 同一套
//     「忽略费用结算某张卡的能力」原语）。
//   · 打出条件：playCondition 要求控制至少一张 [[工具]]/[[武器]] 支援（docs/card-model.md §5）。
//
// 近似（note，不是 simplified）：
//   · criteria 只读得到手牌的卡种与特质（引擎不给 criteria 能力枚举读点），因此「手里有[[工具]]/[[武器]]
//     但那张卡没有可结算的 [action] 能力」时，reaction 仍会被询问一次；resolve 在弃牌之前再筛一遍，
//     没有可结算能力就只横置、不弃牌（不会出现「弃了牌却没有效果」的非法结算）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10002'

const traitsOf = code => ALL_CARDS[code]?.traits || []
const hasTrait = (code, wanted) => traitsOf(code).some(trait => String(trait).toLowerCase() === wanted)
const isToolOrWeapon = code => hasTrait(code, 'tool') || hasTrait(code, 'weapon')

export default {
  code: CODE,
  note: 'approximation: 手牌里的[[工具]]/[[武器]]都没有可结算的 [action] 能力时，reaction 仍会询问一次（criteria 没有能力枚举读点）；resolve 在弃牌前再筛，此时只横置、不弃牌。',
  // 事件结算后留在宿主上（actions.js 只在 keepOnPlay 为真时跳过「事件打出后进弃牌堆」）。
  keepOnPlay: true,
  playCondition: [{
    when: ({ inv }) => (inv?.assets || []).some(asset => isToolOrWeapon(asset.code)),
    message: '你没有控制的[[工具]]或[[武器]]支援',
  }],
  abilities: [
    {
      kind: 'played',
      label: '将应急手段附属到你控制的一个[[工具]]或[[武器]]支援',
      resolve: ({ inv, api }) => {
        const candidates = (inv.assets || []).filter(asset => !asset.attachedToAsset && isToolOrWeapon(asset.code))
        if (!candidates.length) {
          api.info('「应急手段」：你没有可以附属的[[工具]]或[[武器]]支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要附属「应急手段」的[[工具]]或[[武器]]支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const host = candidates.find(asset => asset.id === picked) || candidates[0]
        if (!host) return
        api.attachPlayerCardToAsset(CODE, host, { ownerSeat: inv.seat })
        api.info(`🧰 ${inv.name} 将「应急手段」附属到「${api.cardName(host.code)}」。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetActionResolved',
      label: '横置并弃掉手牌中的[[工具]]/[[武器]]支援：忽略费用结算它的一个[action]能力',
      cost: { exhaust: true },
      criteria: [({ inv, source, context, helpers }) => {
        if (!source || source.exhausted) return false
        // 刚结算完 [action] 能力的必须就是本附属的宿主支援。
        if (source.hostAssetId == null || context?.assetId !== source.hostAssetId) return false
        if (context?.seat !== inv.seat) return false
        // 手牌里要有[[工具]]/[[武器]]支援可弃（能力是否可结算由 resolve 再筛）。
        return (inv.hand || []).some(code => helpers.cardType(code) === 'asset'
          && isToolOrWeapon(code))
      }],
      resolve: ({ inv, api }) => {
        const candidates = [...new Set((inv.hand || []).filter(code => api.cardType(code) === 'asset'
          && api.cardTraits(code).some(trait => ['tool', 'weapon'].includes(String(trait).toLowerCase()))
          && api.cardAbilityOptions(inv.seat, code, { ignoreCosts: true, actionOnly: true }).length > 0))]
        if (!candidates.length) {
          api.info('「应急手段」：手牌中没有带有可结算 [action] 能力的[[工具]]或[[武器]]支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '选择要从手牌弃掉的[[工具]]或[[武器]]支援（结算其一个 [action] 能力，忽略费用）。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = candidates.includes(picked) ? picked : candidates[0]
        if (!code) return
        const options = api.cardAbilityOptions(inv.seat, code, { ignoreCosts: true, actionOnly: true })
        if (!options.length) return
        const chosen = options.length === 1 ? options[0] : (() => {
          const answer = api.choice({
            kind: 'ability', source: CODE, seat: inv.seat,
            prompt: `选择「${api.cardName(code)}」要结算的 [action] 能力。`,
            options: options.map(option => ({ id: String(option.index), label: option.label })),
          })
          return options.find(option => String(option.index) === String(answer)) || options[0]
        })()
        if (!chosen) return
        if (!api.discardFromHand(inv.seat, code)) return
        api.info(`🧰 ${inv.name} 横置「应急手段」并弃掉「${api.cardName(code)}」：忽略费用结算它的 [action] 能力。`)
        api.resolveCardAbility(inv.seat, code, { abilityIndex: chosen.index, ignoreCosts: true })
      },
    },
  ],
  modifiers: [],
}
