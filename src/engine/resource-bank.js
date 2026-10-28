// 资源寄存（放在一张支援上的资源）—— 第 5 步 M1 调查员批次（P6）。
//
// 印刷场景：「家族遗产」（普雷斯顿·费尔蒙特的专属资产）——
//   永久。
//   [action]：把这张卡牌上的所有资源移动到你的资源池。
//   强制 - 在你的回合开始时：把 4 资源（从供应堆）放到这张卡牌上。这张卡牌上的资源
//   可以花费，如同在你的资源池中。当你的回合结束时，弃掉这张卡牌上的所有资源。
// 加上调查员卡面：「你每次从卡牌效果获得资源，不放进资源池，改为放在家族遗产上。」
//
// 建模（有意为之的一处简化，写在这里而不是散在卡里）：寄存中的资源**同时**计入
// `inv.resources`，`asset.resources` 只记录「其中有多少是寄存的」。这样做的理由：
//   · 卡面本身就说「可以花费，如同在你的资源池中」——合并之后不需要给 40 多个
//     `inv.resources` 读点各加一条分支（那才是真正的行为风险）；
//   · 所有「支付资源」的引擎路径统一走 spendFromPool()：扣资源池的同时先扣掉寄存量。
//     寄存资源在回合结束必被弃掉，所以「先花寄存的那份」永远是支配策略；不先扣的话
//     回合末还会按 `min(寄存量, 现有资源)` 再弃一次，普雷斯顿等于白亏一笔。
// 仍保留的近似（合并池表达不了，按近似处理）：① 只从资源池扣除、不能动用寄存量的效果
// （失去资源、把资源从资源池移走）仍直接扣 `inv.resources`，不会减少寄存标记；
// ② 卡牌效果若绕过 api.gainResources 直接加资源，也不会寄存到这张卡上。
// 「把寄存部分转成永久资源」的 [action] 仍是「清空寄存标记」——这正是它的实际用途
// （避免回合结束时流失），因此不需要第二条通道。
//
// 状态形状（纯 JSON）：`asset.resources`（寄存量）。
// 声明（内容层）：`investigator.resourceBank = { assetCode, perTurn }`。

import { investigatorRule } from '../cards/card-rules.js'

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

// 合并池模型的统一支付入口：所有「支付资源」的引擎路径（卡费/能力费/遭遇费/保留费/
// 检定加成/回合结束保留……）都走这里，保证先扣寄存标记再扣自有资源——与卡面「可以花费，
// 如同在你的资源池中」及「回合结束弃掉卡上资源」组合后的最优/合法行为等价。
// 调用方自己负责「够不够付」的校验与日志文案；返回实际扣掉的资源数。
export function spendFromPool(inv, amount) {
  const spend = Math.min(inv?.resources || 0, Math.max(0, Math.floor(Number(amount) || 0)))
  if (!spend) return 0
  inv.resources -= spend
  const asset = bankAssetOf(inv)
  if (asset && (asset.resources || 0) > 0) {
    asset.resources = Math.max(0, asset.resources - spend)
    if (!asset.resources) delete asset.resources
  }
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

export function createResourceBank(deps) {
  const { cardName, info } = deps
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
    if (!inv || !Number.isFinite(amount) || amount <= 0) return 0
    inv.resources += amount
    const asset = bankAsset(inv)
    if (asset && ruleOf(inv.code).redirectGain) {
      asset.resources = (asset.resources || 0) + amount
      info(state, events, `💰 ${inv.name} 获得的 ${amount} 资源放在「${cardName(asset.code)}」上（共 ${asset.resources}）。`)
    }
    return amount
  }

  // 2026-10-25 第七轮修复 05003/05011：v2 API（沿用合并模型，寄存量同时计入资源池）。
  function bankResources(state, inv, amount, events = []) {
    return gainResource(state, inv, amount, events)
  }

  function withdrawBanked(state, inv, amount, events = []) {
    const asset = bankAsset(inv)
    if (!asset) return 0
    const banked = asset.resources || 0
    const take = Number.isFinite(amount) ? Math.min(banked, Math.max(0, Math.floor(amount))) : banked
    asset.resources = banked - take
    if (!asset.resources) delete asset.resources
    if (take) info(state, events, `💰 ${inv.name} 从「${cardName(asset.code)}」取出 ${take} 资源（剩余 ${asset.resources || 0}）。`)
    return take
  }

  function spendBanked(state, inv, amount, events = []) {
    return withdrawBanked(state, inv, amount, events)
  }

  function spendResources(state, inv, amount, events = []) {
    // 合并池的支付口径与引擎内其它支付路径一致：先扣寄存部分（spendFromPool）。
    const spend = spendFromPool(inv, amount)
    if (spend) info(state, events, `💰 ${inv.name} 支付了 ${spend} 资源（剩余 ${inv.resources}）。`)
    return spend
  }

  // 回合开始（强制）：在寄存支援上放 perTurn 资源。
  function beginTurn(state, inv, events = []) {
    const rule = ruleOf(inv?.code)
    const asset = bankAsset(inv)
    if (!rule || !asset || !rule.perTurn) return 0
    inv.resources += rule.perTurn
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
    const lost = Math.min(banked, Math.max(0, inv.resources || 0))
    inv.resources = Math.max(0, (inv.resources || 0) - lost)
    asset.resources = 0
    info(state, events, `💰 ${inv.name} 的回合结束：「${cardName(asset.code)}」上剩余的 ${lost} 资源被弃掉。`)
    return lost
  }

  // [action]：把寄存的资源转成永久资源池资源（合并模型下只需清掉寄存标记）。
  function withdrawAll(state, inv, events = []) {
    const asset = bankAsset(inv)
    if (!asset) return 0
    const banked = asset.resources || 0
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

  return { ruleOf, bankAsset, bankedOf, gainResource, bankResources, withdrawBanked, spendBanked, spendResources, spendFromPool, beginTurn, endTurn, withdrawAll, projection }
}
