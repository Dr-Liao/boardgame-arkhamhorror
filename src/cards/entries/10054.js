// 10054 精准调配（Fine Tuning）· 探求者事件 · 1 经验 · 费用 2 · 洞察/升级。
//
// 卡面：附属到你控制的[[工具]]或[[科学]]支援。每个支援仅限 1 张。
//       [reaction] 所附属的支援横置后，横置精准调配：重整所附属的支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 附属：played 描述子的 resolve 里选择本人控制、未附属、且特性含[[工具]]或[[科学]]的支援，
//     走 api.attachPlayerCardToAsset（actions-extra.js#attachCardTo 的唯一写点）；条目 `keepOnPlay`
//     阻止事件结算后进弃牌堆（actions.js 的事件收尾段）。「每个支援仅限 1 张」在 playCondition 与
//     resolve 两处都过滤（已经挂着一张精准调配的支援不再是合法宿主）。
//   · 「所附属的支援横置后」→ `assetExhausted` 窗口（ability-exec.js 的支援能力/`api.exhaust`
//     派发点，context 带 assetId/assetCode/seat/location）。所属支援由 descriptorSources 给附属卡
//     写入的非枚举 `hostAssetId` 判定（ability-rules.js），因此 `source.hostAssetId === context.assetId`
//     就是「刚横置的那张宿主」。
//   · 「横置精准调配：重整所附属的支援」→ cost `{ exhaust: true }`（描述子支付横置费用）+ api.ready(host)。
//   · 缺口：引擎目前只在旧 DSL 支援能力的 cost.exhaust（ability-exec.js）与 api.exhaust
//     （api-misc.js）派发 `assetExhausted`；能力层描述子的 cost.exhaust（ability-rules.js#payAbilityCost）
//     还不派发，因此多数支援的 [action]（描述子写的横置费用）横置时尚不能触发本卡。
//     已登记 primitive-requests/10054.json；窗口接通后本文件不需要再改。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10054'

const hasTrait = (code, wanted) => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === wanted)
const isToolOrScience = code => hasTrait(code, 'tool') || hasTrait(code, 'science')
const alreadyTuned = host => (host?.attachments || []).some(attachment => attachment.code === CODE)
const candidatesOf = inv => (inv?.assets || [])
  .filter(asset => !asset.attachedToAsset && isToolOrScience(asset.code) && !alreadyTuned(asset))

export default {
  code: CODE,
  keepOnPlay: true,
  note: 'approximation: 线索窗口齐备，但引擎只在旧式 cost.exhaust / api.exhaust 派发 assetExhausted；描述子 cost.exhaust（多数支援 [action] 的横置费用）尚不派发，已列 primitive-requests/10054.json。',
  playCondition: [
    {
      when: ({ inv }) => candidatesOf(inv).length > 0,
      message: '你没有可附属的[[工具]]或[[科学]]支援（每个支援仅限 1 张精准调配）',
    },
  ],
  abilities: [
    {
      kind: 'played',
      label: '附属到你控制的一个[[工具]]或[[科学]]支援',
      resolve: ({ inv, api }) => {
        const candidates = candidatesOf(inv)
        if (!candidates.length) {
          api.info('「精准调配」：你没有可以附属的[[工具]]或[[科学]]支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要附属「精准调配」的[[工具]]或[[科学]]支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const host = candidates.find(asset => asset.id === picked) || candidates[0]
        if (!host) return
        const attachment = api.attachPlayerCardToAsset(CODE, host, { ownerSeat: inv.seat })
        if (attachment) api.info(`⚙️ 「精准调配」附属到「${api.cardName(host.code)}」。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetExhausted',
      label: '所附属的支援横置后：横置精准调配，重整所附属的支援',
      cost: { exhaust: true },
      criteria: [({ inv, source, context }) => Boolean(source)
        && !source.exhausted
        && source.hostAssetId != null
        && context?.assetId === source.hostAssetId
        && (context?.seat == null || context.seat === inv.seat)],
      resolve: ({ inv, source, api }) => {
        const host = (inv.assets || []).find(asset => asset.id === source.hostAssetId)
        if (!host) return
        api.ready(host)
        api.info(`⚙️ 「精准调配」：横置自身，重整「${api.cardName(host.code)}」。`)
      },
    },
  ],
  modifiers: [],
}
