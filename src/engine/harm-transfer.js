// 伤害/恐惧在「调查员 ↔ 其控制的支援」之间移动（P6 原语 `harm.moveBetween`）。
//
// 印刷场景：托米·马尔登的旧印「+2。你可以将托米·马尔登上的总计最多 2 点伤害和/或恐惧
// 移动到你控制的一个支援上，或者将你控制的一个支援上的总计最多 2 点伤害和/或恐惧移动到
// 托米·马尔登身上」。
//
// 这是「移动」而不是「承受/治疗」：
//   · 不触发「受到伤害/恐惧后」窗口，也不走 soaking 分配；
//   · 仍然受目标容量限制（支援的 health/sanity；调查员的生命/理智上限）；
//   · 支援达到上限后由 `asset-defeat.js` 的唯一判定点处理被击败。
//
// 纯数据：只读写实体上的 damage/horror 字段，不 import 引擎；「谁可以接多少」由调用方
// 通过 `harmRoom` 判断，条目层据此枚举选择项。

/** 某实体（调查员或支援实例）当前的伤害/恐惧。 */
export function harmOf(entity) {
  return { damage: Math.max(0, entity?.damage || 0), horror: Math.max(0, entity?.horror || 0) }
}

/**
 * 还能承接多少伤害/恐惧。
 *   · 调查员：用 maxHealth / maxSanity（缺省回落 health / sanity）；
 *   · 支援：用卡面 health / sanity（0 表示不能承受该类型）。
 */
export function harmRoom(entity, def = null) {
  const kindRoom = (kind, cap) => {
    const max = Number.isFinite(cap) ? cap : 0
    if (max <= 0) return 0
    return Math.max(0, max - Math.max(0, entity?.[kind] || 0))
  }
  if (def) {
    return { damage: kindRoom('damage', def.health), horror: kindRoom('horror', def.sanity) }
  }
  return {
    damage: kindRoom('damage', entity?.maxHealth ?? entity?.health),
    horror: kindRoom('horror', entity?.maxSanity ?? entity?.sanity),
  }
}

/**
 * 把伤害/恐惧从 from 移动到 to。
 * amounts: { damage, horror }（非负整数；超出来源持有量或目标容量的部分按可移动量截断）。
 * options: { fromDef, toDef }——目标是支援时必须给 toDef（卡面 health/sanity）。
 * 返回实际移动量 { damage, horror }。
 */
export function moveHarm(from, to, amounts = {}, { fromDef = null, toDef = null } = {}) {
  const applied = { damage: 0, horror: 0 }
  if (!from || !to || from === to) return applied
  const room = harmRoom(to, toDef)
  for (const kind of ['damage', 'horror']) {
    const wanted = Math.max(0, Math.floor(Number(amounts[kind]) || 0))
    if (!wanted) continue
    const available = Math.max(0, from[kind] || 0)
    const moved = Math.min(wanted, available, room[kind])
    if (!moved) continue
    from[kind] = available - moved
    to[kind] = Math.max(0, to[kind] || 0) + moved
    applied[kind] = moved
  }
  return applied
}
