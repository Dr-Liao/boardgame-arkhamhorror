// 资源寄存（放在一张支援上的资源）—— 第 5 步 M1 调查员批次（P6）。
//
// 印刷场景：「家族遗产」（普雷斯顿·费尔蒙特的专属资产）——
//   永久。
//   [action]：把这张卡牌上的所有资源移动到你的资源池。
//   强制 - 在你的回合开始时：把 4 资源（从供应堆）放到这张卡牌上。这张卡牌上的资源
//   可以花费，如同在你的资源池中。当你的回合结束时，弃掉这张卡牌上的所有资源。
// 加上调查员卡面：「你每次从卡牌效果获得资源，不放进资源池，改为放在家族遗产上。」
//
// 资源池和支援资源分别保存；费用可组合支付，损失仅扣资源池。

import { investigatorRule } from '../cards/card-rules.js'
import { capabilityBlocked } from './modifiers.js'
import { enemyEngagedRestricts } from './enemy-entry.js'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeResourceBankRule(raw, origin = 'investigator.resourceBank') {
  if (raw == null) return null
  if (!isPlainObject(raw)) throw new Error(`${origin}: 必须是对象`)
  const unknown = Object.keys(raw).filter(key => !['assetCode', 'perTurn', 'redirectGain'].includes(key))
  if (unknown.length) throw new Error(`${origin}: 未知字段 ${unknown.join('、')}`)
  if (typeof raw.assetCode !== 'string' || !raw.assetCode) throw new Error(`${origin}: assetCode 必须是卡号`)
  const perTurn = raw.perTurn
  if (!Number.isSafeInteger(perTurn) || perTurn < 0) throw new Error(`${origin}: perTurn 必须是非负整数`)
  return Object.freeze({
    assetCode: raw.assetCode,
    perTurn,
    redirectGain: raw.redirectGain !== false,
  })
}

function bankAssetOf(inv) {
  const rule = inv?.code ? investigatorRule(inv.code)?.resourceBank || null : null
  if (!rule) return null
  return (inv.assets || []).find(item => item.code === rule.assetCode) || null
}

// 费用可使用资源池及支援资源；调用方负责可支付性检查。
export function availableResources(inv) {
  return (inv?.resources || 0) + (bankAssetOf(inv)?.resources || 0)
}

export function spendFromPool(inv, amount, state = null, requestChoice = null) {
  const spend = Math.min(availableResources(inv), Math.max(0, Math.floor(Number(amount) || 0)))
  if (!spend) return 0
  const asset = bankAssetOf(inv)
  const banked = asset?.resources || 0
  const minBank = Math.max(0, spend - (inv.resources || 0))
  const maxBank = Math.min(spend, banked)
  let fromBank = maxBank
  if (minBank !== maxBank && state && requestChoice) {
    fromBank = Number(requestChoice(state, { kind: 'payment', source: asset.code, seat: inv.seat,
      prompt: `支付 ${spend} 资源：选择从家族遗产支付的数量。`,
      options: Array.from({ length: maxBank - minBank + 1 }, (_, i) => {
        const n = maxBank - i
        return { id: String(n), label: `家族遗产 ${n}，资源池 ${spend - n}` }
      }) }))
  }
  if (asset) asset.resources = banked - fromBank
  inv.resources -= spend - fromBank
  return spend
}

// 公开投影（纯函数，内容层投影与观察投影共用）：「家族遗产」上的资源数。
export function resourceBankProjection(inv) {
  const rule = inv?.code ? investigatorRule(inv.code)?.resourceBank || null : null
  if (!rule) return null
  const asset = (inv.assets || []).find(item => item.code === rule.assetCode)
  if (!asset) return null
  return { seat: inv.seat, code: asset.code, banked: asset.resources || 0 }
}

import { effectRecipient, playerEffectCanAffect } from './effect-recipient.js'

export function createResourceBank(deps) {
  const { cardName, info, requestChoice } = deps
  // 规范化结果按卡号缓存（每次获得资源都要问一次）。
  const ruleCache = new Map()
  const ruleOf = code => {
    if (!code) return null
    if (ruleCache.has(code)) return ruleCache.get(code)
    const rule = normalizeResourceBankRule(investigatorRule(code)?.resourceBank || null)
    ruleCache.set(code, rule)
    return rule
  }

  function bankAsset(inv) {
    const rule = ruleOf(inv?.code)
    if (!rule) return null
    return (inv.assets || []).find(asset => asset.code === rule.assetCode) || null
  }

  function bankedOf(inv) {
    return bankAsset(inv)?.resources || 0
  }

  // 「获得资源」的唯一入口（卡牌效果）：寄存的规则在这里落实。
  function gainResource(state, inv, amount, events = []) {
    inv = effectRecipient(state, inv)
    if (inv && !playerEffectCanAffect(state, inv.seat)) return 0
    if (!inv || !Number.isFinite(amount) || amount <= 0) return 0
    if (capabilityBlocked(state, inv, 'gainResources')) return 0
    // 「与你交战期间你不能获得资源」（07183 追猎的深潜者）：敌方持续限制的读点。
    if (enemyEngagedRestricts(state, inv, 'gainResources')) return 0
    const asset = bankAsset(inv)
    if (asset && ruleOf(inv.code).redirectGain) {
      asset.resources = (asset.resources || 0) + amount
      info(state, events, `💰 ${inv.name} 获得的 ${amount} 资源放在「${cardName(asset.code)}」上（共 ${asset.resources}）。`)
    } else inv.resources += amount
    return amount
  }

  // 卡效果获得资源时优先放在声明的支援上。
  function bankResources(state, inv, amount, events = []) {
    return gainResource(state, inv, amount, events)
  }

  function withdrawBanked(state, inv, amount, events = []) {
    const asset = bankAsset(inv)
    if (!asset) return 0
    const banked = asset.resources || 0
    const take = Number.isFinite(amount) ? Math.min(banked, Math.max(0, Math.floor(amount))) : banked
    asset.resources = banked - take
    inv.resources += take
    if (!asset.resources) delete asset.resources
    if (take) info(state, events, `💰 ${inv.name} 从「${cardName(asset.code)}」取出 ${take} 资源（剩余 ${asset.resources || 0}）。`)
    return take
  }

  function spendBanked(state, inv, amount, events = []) {
    const asset = bankAsset(inv)
    const take = Math.min(asset?.resources || 0, Math.max(0, Number(amount) || 0))
    if (asset) asset.resources -= take
    return take
  }

  function spendResources(state, inv, amount, events = []) {
    // 共用资源来源选择。
    const spend = spendFromPool(inv, amount, state, requestChoice)
    if (spend) info(state, events, `💰 ${inv.name} 支付了 ${spend} 资源（剩余 ${inv.resources}）。`)
    return spend
  }

  // 回合开始（强制）：在寄存支援上放 perTurn 资源。
  function beginTurn(state, inv, events = []) {
    const rule = ruleOf(inv?.code)
    const asset = bankAsset(inv)
    if (!rule || !asset || !rule.perTurn) return 0
    asset.resources = (asset.resources || 0) + rule.perTurn
    info(state, events, `💰 ${inv.name} 的回合开始：「${cardName(asset.code)}」放置 ${rule.perTurn} 资源（共 ${asset.resources}）。`)
    return rule.perTurn
  }

  // 回合结束（强制）：弃掉寄存支援上剩下的资源。
  function endTurn(state, inv, events = []) {
    const asset = bankAsset(inv)
    if (!asset) return 0
    const banked = asset.resources || 0
    if (!banked) return 0
    const lost = banked
    asset.resources = 0
    info(state, events, `💰 ${inv.name} 的回合结束：「${cardName(asset.code)}」上剩余的 ${lost} 资源被弃掉。`)
    return lost
  }

  // [action]：把卡上资源移到资源池。
  function withdrawAll(state, inv, events = []) {
    const asset = bankAsset(inv)
    if (!asset) return 0
    const banked = asset.resources || 0
    inv.resources += banked
    asset.resources = 0
    if (banked) info(state, events, `💰 ${inv.name} 把「${cardName(asset.code)}」上的 ${banked} 资源移进资源池。`)
    return banked
  }

  // 展示：卡面上的「资源 N」与「本回合会流失多少」。
  function projection(inv) {
    const asset = bankAsset(inv)
    if (!asset) return null
    return { code: asset.code, banked: asset.resources || 0 }
  }

  return { ruleOf, bankAsset, bankedOf, availableResources, gainResource, bankResources, withdrawBanked, spendBanked, spendResources,
    spendFromPool: (inv, amount, state) => spendFromPool(inv, amount, state, requestChoice), beginTurn, endTurn, withdrawAll, projection }
}
