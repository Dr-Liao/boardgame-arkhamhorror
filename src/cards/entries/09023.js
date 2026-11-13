// 09023 定制改良（Custom Modifications）· 守卫者事件 · 0 经验 · 定制。
// 卡面：定制。附属到你控制的[[枪械]]支援。每个支援仅限 1 张。
//       [reaction] 你用附属的支援攻击时，在揭示了一个非[auto_fail]混乱标记时，横置定制改良：
//       取消该混乱标记，将其放回混乱袋，并揭示一个新标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 打出：选择一张你控制的[[枪械]]支援，走 api.attachPlayerCardToAsset 附属（宿主附属会被
//     descriptorSources 枚举成能力来源，hostAssetId 不可枚举、不进存档）；
//   · 反应：窗口 tokenReveal（tests.js 在标记结算前开窗，替换标记会取消原标记并归还混乱袋）；
//     从混乱袋随机取 1 枚新标记（api.removeChaosToken 移除 + api.replaceChaosToken 替换），
//     净效果与「取消 → 放回 → 重新揭示」一致；费用是横置（cost.exhaust）；
//   · 判定「用附属的支援攻击」：与 api.playerTools.testAssetSource() 同口径的只读三段落
//     `state.skillTest.assetSourceId ?? state.skillTest.source.assetId ?? state._resolvingAssetId`。
//     criteria 在窗口过滤期执行、ctx 里没有 api（ability-rules.js#descriptorUsable 的 ctx），
//     所以内联同一读点而不是调用 api.playerTools；支援能力执行期间引擎会写 `_resolvingAssetId`
//     （reveal.js#executeDescriptor:333），这是「用附属支援攻击」在真实对局里唯一可达的来源字段。
// approximation（逐项披露，缺读点见 primitive-requests/09023.json）：
//     ① Notched Sight（未命中不造成伤害）没有「攻击失败不造成伤害」的条目读点，未实现；
//     ② Extended Stock（+2[combat]）需要「攻击使用某支援期间」的条件修正读点，未实现；
//     ③ Counterbalance（附着其他[[升级]]后抽牌）缺「升级附着」窗口，未实现；
//     ④ Leather Grip 的「获得快速」无法按勾选条件改条目 fast 字段，只实现 -1 费用；
//     ⑤ Extended Magazine（其他事件花/加弹药后补 1 弹药）缺弹药花费窗口，未实现；
//     ⑥ Quicksilver Bullets（成功 ≥3 时 +1 伤害）需要在攻击结算中途写伤害，未实现。
import { customizationChecked } from '../../engine/tsk-customizable.js'

const SOURCE = '09023'
// 与 api.playerTools.testAssetSource() 同源（criteria 期无 api，不能调用；三段落顺序一致）。
const testAssetSource = state => state.skillTest?.assetSourceId
  ?? state.skillTest?.source?.assetId
  ?? state._resolvingAssetId
  ?? null
const hostOf = state => {
  for (const owner of state.investigators || []) {
    for (const asset of owner.assets || []) {
      const attachment = (asset.attachments || []).find(item => item.code === SOURCE && !item.assetReference)
      if (attachment) return { owner, asset, attachment }
    }
  }
  return null
}

export default {
  code: '09023',
  note: 'approximation: 仅实现「附属到枪械」与「取消并重抽混乱标记」；Notched Sight / Extended Stock / Counterbalance / Leather Grip 的快速 / Extended Magazine / Quicksilver Bullets 缺条目读点未实现（见 primitive-requests/09023.json）',
  playCostModifier: ({ state, inv }) => (customizationChecked(state, inv?.seat ?? state.currentSeat, SOURCE).includes(3) ? -1 : 0),
  customizationEffects: {
    playCost: checkedCounts => ((checkedCounts || []).filter(index => index === 3).length ? -1 : 0),
  },
  customizationOptions: [
    { name: 'Notched Sight', checks: 1, text: 'If you perform an attack with attached asset against an enemy engaged with another investigator and fail, you deal no damage.' },
    { name: 'Extended Stock', checks: 2, text: 'You get +2 [combat] while attacking with attached asset.' },
    { name: 'Counterbalance', checks: 2, text: 'After you attach an [[Upgrade]] card other than Custom Modifications to attached asset, draw 1 card.' },
    { name: 'Leather Grip', checks: 3, text: 'Custom Modifications gets -1 cost and gains: "Fast. Play only during your turn."' },
    { name: 'Extended Magazine', checks: 3, text: 'After ammo is spent from or placed on attached asset by another event, place 1 ammo on attached asset.' },
    { name: 'Quicksilver Bullets', checks: 4, text: 'If you succeed by 3 or more while attacking with attached asset, this attack deals +1 damage.' },
  ],
  abilities: [
    {
      kind: 'played',
      label: '附属到一张你控制的[[枪械]]支援',
      resolve: ({ state, inv, api }) => {
        const firearms = (inv.assets || []).filter(asset => (api.cardTraits(asset.code) || [])
          .some(trait => String(trait).toLowerCase() === 'firearm'))
        if (!firearms.length) {
          api.info('定制改良：你没有可附属的[[枪械]]支援。')
          return
        }
        const hostId = firearms.length === 1 ? firearms[0].id : api.choice({
          kind: 'asset', source: SOURCE, seat: inv.seat,
          prompt: '定制改良：选择要附属的[[枪械]]支援。',
          options: firearms.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const host = firearms.find(asset => asset.id === hostId) || firearms[0]
        if ((host.attachments || []).some(item => item.code === SOURCE)) {
          api.info(`定制改良：「${api.cardName(host.code)}」上已经有限定 1 张的定制改良。`)
          return
        }
        api.attachPlayerCardToAsset(SOURCE, host, { ownerSeat: inv.seat })
        api.info(`定制改良：附属到「${api.cardName(host.code)}」。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'tokenReveal',
      label: '横置：取消用附属支援攻击时揭示的非[auto_fail]标记，放回混乱袋并揭示新标记',
      cost: { exhaust: true },
      criteria: [({ state, source, context }) => {
        const host = hostOf(state)
        if (!host || !state.skillTest) return false
        if (context?.autoFail) return false
        const testSource = testAssetSource(state)
        return testSource === host.asset.id && (state.chaosBag || []).length > 0
      }],
      resolve: ({ state, inv, context, api }) => {
        const host = hostOf(state)
        if (!host) return
        const bag = state.chaosBag || []
        const token = bag[Math.floor(api.random() * bag.length)] ?? bag[0]
        if (!token) return
        api.removeChaosToken(token)
        api.replaceChaosToken(context, token)
        api.info(`定制改良：取消本次标记，放回混乱袋并改为揭示 ${api.tokenLabel(token)}。`)
      },
    },
  ],
}
