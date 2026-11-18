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
// 近似披露（simplified）：
//   1. 「印刷上限」只有**已迁移条目**能读到（条目级 uses）；未迁移的充能/秘密支援没有上限读点，
//      此时只提示、不补满（见 artifacts/migration/fhv/primitive-requests/10099.json）；
//   2. 卡面「补满/结算能力」都要求所选支援可被补满或确有可结算能力，本实现只要求
//      「带使用（充能/秘密）」这一个条件，没有合法能力时由 resolveCardAbility 自身拒绝。

import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10099'
const CURSE = 'curse'
const REFILL_TYPES = new Set(['charge', 'charges', 'secret', 'secrets'])

const usesTypeOf = asset => String(asset?.usesType || '').toLowerCase()
const refillableAssets = inv => (inv.assets || []).filter(asset => REFILL_TYPES.has(usesTypeOf(asset)))
const usesLabel = asset => (usesTypeOf(asset).startsWith('secret') ? '秘密' : '充能')

// 「补满该支援的所有充能或秘密」：只认条目级印刷上限（唯一可读的上限元数据）。
function replenish(inv, api) {
  const candidates = refillableAssets(inv)
  if (!candidates.length) {
    api.info('「呼唤彼端」：你没有带「使用（充能/秘密）」的支援。')
    return null
  }
  const id = candidates.length === 1 ? candidates[0].id : api.choice({
    kind: 'target', source: CODE, seat: inv.seat,
    prompt: '「呼唤彼端」：选择要补满充能或秘密的支援。',
    options: candidates.map(asset => ({
      id: asset.id,
      label: `${api.cardName(asset.code)}（${usesLabel(asset)} ${asset.uses || 0}）`,
    })),
  })
  const asset = candidates.find(item => item.id === id) || candidates[0]
  // 印刷上限从卡面文本读取（"使用(3充能)。" / "Uses (3 charges)."），与印刷一致；卡文件不 import 引擎。
const printedUses = code => {
  const text = String(ALL_CARDS[code]?.text || '')
  const zh = String(ALL_CARDS[code]?.textZh || '')
  const match = /Uses \((\d+)/i.exec(text) || /使用\((\d+)/.exec(zh)
  return match ? Number(match[1]) : 0
}
const maximum = Number(asset?.usesMax ?? asset?.maxUses ?? printedUses(asset?.code) ?? 0)
  if (!Number.isFinite(maximum) || maximum <= 0) {
    api.info(`「呼唤彼端」：「${api.cardName(asset.code)}」没有可读的印刷上限，本次不补满（近似）。`)
    return asset
  }
  const before = Number(asset.uses) || 0
  api.setAssetUses(asset, maximum)
  api.info(`🕯️ 「呼唤彼端」：「${api.cardName(asset.code)}」的${usesLabel(asset)}补满（${before} → ${maximum}）。`)
  return asset
}

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
  simplified: true,
  note: 'approximation: ①「补满所有充能/秘密」只认条目级印刷上限（registeredEntry(code).uses），'
    + '未迁移的支援读不到上限时只提示不补满；②打出条件只要求「控制带使用（充能/秘密）的支援」，'
    + '没有再加「未满 或 有可结算能力」的附加判定（此时结算不会发生任何事）。见 primitive-requests/10099.json。',
  playCondition: [{
    when: ({ inv }) => refillableAssets(inv).length > 0,
    message: '你没有带「使用（充能）」或「使用（秘密）」的支援',
  }],
  abilities: [
    {
      kind: 'played',
      label: '补满所选充能/秘密支援，然后可不付 [action] 费结算它的一个 [action] 或 [fast] 能力',
      resolve: ({ inv, api }) => {
        const asset = replenish(inv, api)
        if (!asset) return
        resolveAbility(inv, asset, api)
      },
    },
  ],
  modifiers: [],
}
