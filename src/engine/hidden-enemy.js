// 手牌中的隐私敌人（06017 异次元监视者）。
// 显现时秘密进手牌。可以在手牌里攻击或躲避：成功则弃掉，失败则生成并交战。
// 牌库耗尽而它还在手牌中时，它从手牌攻击你。

export function isHiddenHandEnemy(entry) {
  return entry?.hiddenEnemyInHand === true
}

export function takeHiddenEnemyFromHand(inv, cardId) {
  const index = inv.hand?.indexOf(cardId) ?? -1
  if (index < 0) return false
  inv.hand.splice(index, 1)
  if (Array.isArray(inv.hiddenCards)) {
    const hidden = inv.hiddenCards.indexOf(cardId)
    if (hidden >= 0) inv.hiddenCards.splice(hidden, 1)
  }
  return true
}

export function spawnHiddenEnemy(state, inv, card) {
  state.instanceSeq ||= {}
  const seq = (state.instanceSeq.enemy || 0) + 1
  state.instanceSeq.enemy = seq
  const enemy = {
    id: `hidden-enemy-${seq}`,
    code: card.code,
    originalCode: card.code,
    name: card.nameZh || card.name || card.code,
    health: card.health ?? 1,
    fight: card.fight ?? 0,
    evade: card.evade ?? 0,
    damage: card.damage ?? 0,
    horror: card.horror ?? 0,
    location: inv.location,
    engagedSeat: inv.seat,
    hunter: true,
    exhausted: false,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

export function discardSpawnedEnemy(state, inv, enemy) {
  const index = state.enemies?.indexOf(enemy) ?? -1
  if (index >= 0) state.enemies.splice(index, 1)
  inv.discard ||= []
  inv.discard.push(enemy.code)
}

/** 牌库耗尽时，手牌里的隐私敌人各攻击一次（不离开手牌）。 */
export function hiddenEnemiesAttackFromHand(state, inv, { registeredEntry, cardDef, applyDamage, applyHorror, info, events }) {
  for (const code of inv.hand || []) {
    if (!isHiddenHandEnemy(registeredEntry(code))) continue
    const card = cardDef(code) || {}
    if (card.damage) applyDamage(state, inv, card.damage, events)
    if (card.horror) applyHorror(state, inv, card.horror, events)
    info(state, events, `${inv.name} 的牌库耗尽，手牌中的一个敌人攻击了${inv.name}。`)
  }
}
