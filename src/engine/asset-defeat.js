// 支援被击败的唯一判定点（P6 原语 `assetDefeat`）。
//
// 印刷规则：支援上的伤害/恐惧达到其生命/理智时「被击败」并弃置。此前这段判定内联在
// `enemies.js` 的 applyHarm 末尾，只有「一次伤害/恐惧分配」这一条路径会触发；把伤害
// **移动**到支援上（托米·马尔登的旧印）、或用别的方式往支援上加伤害时，支援会超过上限
// 却继续留在场——这就是本文件存在的理由：判定与事件窗口只写一次。
//
// 本文件负责三件事：
//   1. `isAssetDefeated(def, asset)`：纯函数判定；
//   2. `checkAssetDefeated(...)`：达到上限时开 `assetDefeated` 窗口（反应可以把这张卡
//      改为洗回牌库而不是进弃牌堆），再离场、记录、开既有的 `defeatAtLocation` 窗口、
//      结算「被击败时反伤」；
//   3. 被击败的支援去向由击败窗口决定，默认弃置。
//
// 引擎不认卡号：判定只读卡面 health/sanity 与实例上的 damage/horror，窗口只传实体与数值。

import { registeredEntry as assetEntry } from './ability.js'

export const ASSET_DEFEATED_WINDOW = 'assetDefeated'

/** 支援的伤害/恐惧上限（0 表示该类型不能承受）。 */
export function assetHarmCapacity(def, kind, state, asset) {
  let value = kind === 'damage' ? (asset?.customHealth ?? def?.health) : def?.sanity
  const flags = kind === 'damage' && asset && state ? assetEntry(asset.code)?.flags : null
  if (flags?.glyphLine?.length) {
    const glyphs = (state?.campaign?.records?.discoveredGlyphs || [])
      .map(glyph => String(glyph).toLowerCase().replace(/^rune_/, ''))
    if (flags.glyphLine.every(glyph => glyphs.includes(glyph))) value = (value || 0) + (flags.glyphHealthBonus || 0)
  }
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** 支援是否已达到被击败条件。 */
export function isAssetDefeated(def, asset, state) {
  if (!def || !asset) return false
  const damage = asset.damage || 0
  const horror = asset.horror || 0
  const health = assetHarmCapacity(def, 'damage', state, asset)
  return (health > 0 && damage >= health)
    || (assetHarmCapacity(def, 'horror') > 0 && horror >= assetHarmCapacity(def, 'horror'))
}

/**
 * 判定并结算一次「支援被击败」。
 *
 * deps：{ cardDef, cardName, leaveAsset, info, reactionWindow, triggerReaction,
 *         registeredEntry, defeatedAssetRetaliation }
 * 返回是否发生了击败。
 */
export function checkAssetDefeated(state, owner, asset, events, deps, { force = false } = {}) {
  const {
    cardDef,
    cardName,
    leaveAsset,
    info,
    reactionWindow,
    triggerReaction,
    registeredEntry,
    defeatedAssetRetaliation,
    exilePlayerCard,
    // 可选：把这张支援洗回牌库（默认只 push 到牌库，不洗）——供应方注入可重放的洗牌。
    shuffleIntoDeck,
  } = deps
  const def = cardDef(asset.code)
  if (!owner.assets.includes(asset) || registeredEntry(asset.code)?.assetRule?.cannotBeDefeated
    || (!force && !isAssetDefeated(def, asset, state))) return false
  const damage = asset.damage || 0
  const horror = asset.horror || 0
  // 「被击败」本身就是事件：先开窗口再处理去向，反应才有机会把这张卡改成洗回牌库。
  const context = reactionWindow
    ? reactionWindow(state, ASSET_DEFEATED_WINDOW, {
      when: ASSET_DEFEATED_WINDOW,
      seat: owner.seat,
      location: owner.location,
      assetCode: asset.code,
      assetId: asset.id,
      asset,
      ownerSeat: owner.seat,
      damage,
      horror,
      prompt: `「${cardName(asset.code)}」被击败后`,
    }, events) || {}
    : {}
  if (leaveAsset(state, owner, asset, events, { defeated: true }) === false) return false
  const originalOwner = state.investigators[asset.ownerSeat] || owner
  if (context.exiledInstead) {
    exilePlayerCard(state, originalOwner, asset.code, events)
  } else if (context.shuffledIntoDeck) {
    if (typeof shuffleIntoDeck === 'function') shuffleIntoDeck(originalOwner, asset.code)
    else originalOwner.deck.push(asset.code)
  } else if (!asset.removedFromGame && !asset.returnedToHand) {
    originalOwner.discard.push(asset.code)
  }
  if (!context.exiledInstead) {
    info(state, events, context.shuffledIntoDeck
      ? `${cardName(asset.code)} 被击败并洗回 ${owner.name} 的牌库。`
      : `${cardName(asset.code)} 被击败并弃置。`)
  }
  for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.location === owner.location)) {
    triggerReaction?.(state, inv.seat, 'defeatAtLocation', events,
      { when: 'defeatAtLocation', kind: 'ally', seat: inv.seat, location: owner.location, assetCode: asset.code })
    reactionWindow?.(state, 'defeatAtLocation',
      { when: 'defeatAtLocation', kind: 'ally', seat: inv.seat, location: owner.location, assetCode: asset.code,
        prompt: `「${cardName(asset.code)}」在本地点被击败后` }, events)
  }
  const retaliation = registeredEntry(asset.code)?.defeatedDamage
  if (retaliation) defeatedAssetRetaliation?.(state, owner, retaliation, events, asset)
  return true
}
