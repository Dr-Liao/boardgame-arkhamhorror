// 10099 呼唤彼端（Call the Beyond）· 神秘者事件 · 0 资源 · 2 经验 · [[仪式]]/[[诅咒萦绕]]
// 卡面：
//   作为打出呼唤彼端的额外费用，在混乱袋中加入 3 个 [curse] 标记。
//   选择一个你控制的带有「使用（充能）」或「使用（秘密）」的支援。补满该支援的所有充能或秘密。
//   然后，你可以结算该支援上的一个 [action] 或 [fast] 能力，而不支付其 [action] 费用（如有）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「额外费用：加入 3 个 [curse]」= 条目级 `additionalTokenCost`（token-cost.js#validateTokenCost；
//     actions.js / play-condition.js / moves.js 是可用性与支付读点；袋里祝福/诅咒物理池上限 10，
//     放不下 3 个时这张卡不能打出）。
//   · 「你控制的使用（充能/秘密）支援」= inv.assets 按 usesType 过滤（charge/charges/secret/secrets，
//     与 stats.js#assetEffect 的 usesType 同一份元数据）。
//   · 「补满所有充能或秘密」= api.setAssetUses(asset, 印刷上限)：印刷上限读条目级 `uses`
//     （registeredEntry(code).uses，与 stats.js#assetEffect / 桌面「N/N」文本同源）。
//   · 「结算其 [action] 或 [fast] 能力且不付 [action] 费用」= api.cardAbilityOptions(seat, asset,
//     { ignoreActionCost: true }) + api.resolveCardAbility(seat, asset, { abilityIndex, ignoreActionCost: true })
//     （api-card.js#abilityOptions / resolveCardAbility 的唯一读点；[fast] 能力在描述子里就是
//     kind:'free'，action 与 free 都在候选内；资源/使用次数等其它费用仍照付）。
//
// 上限优先读取印刷使用量，未登记使用量的卡采用印刷文本。
import { ALL_CARDS } from '../../cards/cards-data.js'
import { entryData } from './_shared.js'

const CODE = '10099'
const CURSE = 'curse'
const REFILL_TYPES = new Set(['charge', 'charges', 'secret', 'secrets'])

const printedUsesOf = asset => /Uses\s*\((\d+) (charges?|secrets?)\)/i.exec(ALL_CARDS[asset.code]?.text || '')
const usesTypeOf = asset => String(asset.usesType || entryData(asset.code, 'usesType') || printedUsesOf(asset)?.[2] || '').toLowerCase()
const printedUses = asset => Number(entryData(asset.code, 'uses') ?? printedUsesOf(asset)?.[1] ?? 0)
const needsRefill = asset => (asset.uses || 0) < printedUses(asset)
const eligibleAssets = (inv, abilityOptions) => inv.assets.filter(asset => REFILL_TYPES.has(usesTypeOf(asset))
  && (needsRefill(asset) || abilityOptions(asset).length > 0))
// 「你可以结算该支援上的一个 [action] 或 [fast] 能力，而不支付其 [action] 费用」。
function resolveAbility(inv, asset, api) {
  const rows = api.cardAbilityOptions(inv.seat, asset, { ignoreActionCost: true })
  if (!rows.length) {
    api.info(`「呼唤彼端」：「${api.cardName(asset.code)}」当前没有可结算的 [action] 或 [fast] 能力。`)
    return false
  }
  const picked = api.choice({
    kind: 'ability', source: CODE, seat: inv.seat,
    prompt: `「呼唤彼端」：选择「${api.cardName(asset.code)}」要结算的能力（不支付 [action] 费用）。`,
    options: [{ id: 'skip', label: '不结算能力' },
      ...rows.map(row => ({ id: String(row.index), label: row.label }))],
  })
  if (picked === 'skip') return false
  const row = rows.find(item => String(item.index) === String(picked)) || rows[0]
  const resolved = api.resolveCardAbility(inv.seat, asset, {
    abilityIndex: row.index,
    ignoreActionCost: true,
  })
  if (resolved) api.info(`🕯️ 「呼唤彼端」：「${api.cardName(asset.code)}」的能力已结算（未支付 [action] 费用）。`)
  return resolved
}

export default {
  code: CODE,
  name: '呼唤彼端',
  additionalTokenCost: { token: CURSE, operation: 'add', count: 3 },
  playCondition: [{
    when: ({ inv, helpers }) => eligibleAssets(inv, asset => helpers?.cardAbilityOptions?.(inv.seat, asset, { ignoreActionCost: true }) || []).length > 0,
    message: '你没有可补满充能或秘密，或可结算能力的支援',
  }],
  abilities: [
    {
      kind: 'played',
      label: '补满所选充能/秘密支援，然后可不付 [action] 费结算它的一个 [action] 或 [fast] 能力',
      resolve: ({ inv, api }) => {
        const candidates = eligibleAssets(inv, asset => api.cardAbilityOptions(inv.seat, asset, { ignoreActionCost: true }))
        if (!candidates.length) return
        const id = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「呼唤彼端」：选择一个带充能或秘密的支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const asset = candidates.find(card => card.id === id)
        if (!asset) return
        if (needsRefill(asset)) {
          if (!asset.usesType) api.setUsesType(asset, usesTypeOf(asset))
          api.setAssetUses(asset, printedUses(asset))
        }
        resolveAbility(inv, asset, api)
      },
    },
  ],
  modifiers: [],
}
