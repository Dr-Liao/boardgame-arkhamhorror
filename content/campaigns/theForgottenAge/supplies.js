// 《失落的时代》补给品点数与购买清单。
// 名称、点数与说明取自原卡中文文本（frontend/src/locales/zh/theForgottenAge/base.json
// 的 `supplies` 条目）与 Arkham/Campaigns/TheForgottenAge/Supply.hs 的 `supplyCost`。
// 运行时只把卡号无关的键（provisions 等）写进战役状态；显示名统一从这里取。

// 序幕（冒险I 之前）可购买的补给品，对应 Supply.hs 的 prologueSupplies。
export const PROLOGUE_SUPPLIES = Object.freeze([
  'provisions', 'medicine', 'rope', 'blanket', 'canteen', 'torches', 'compass', 'map',
  'binoculars', 'chalk', 'pendant',
])

// 补给点（冒险III 之后）可购买的补给品，对应 Supply.hs 的 resupplyPointSupplies。
export const RESUPPLY_SUPPLIES = Object.freeze([
  'provisions', 'medicine', 'gasoline', 'blanket', 'canteen', 'compass', 'binoculars',
  'chalk', 'pocketknife', 'pickaxe',
])

// 每种补给品消耗的补给品点数。
export const SUPPLY_COSTS = Object.freeze({
  provisions: 1, medicine: 2, rope: 3, blanket: 2, canteen: 2, torches: 3,
  compass: 2, map: 3, binoculars: 2, chalk: 2, pendant: 1, gasoline: 1,
  pocketknife: 2, pickaxe: 2,
  // 只能由章节效果获得的补给品，不参与购买。
  keyOfEztli: 0, mysteriousScepter: 0, stickyGoop: 0, journal: 0, satchel: 0,
})

// 中文显示名。
export const SUPPLY_LABELS = Object.freeze({
  provisions: '配给', medicine: '药品', rope: '绳索', blanket: '毛毯', canteen: '水壶',
  torches: '火把', compass: '指南针', map: '地图', binoculars: '双筒望远镜',
  chalk: '粉笔', pendant: '挂坠', gasoline: '汽油', pocketknife: '折叠小刀',
  pickaxe: '鹤嘴锄', keyOfEztli: '埃兹特里之钥', mysteriousScepter: '神秘权杖',
  stickyGoop: '黏液团', journal: '探险日志', satchel: '背包',
})

// 卡面的一句说明：选购界面把它当作卡牌正文，不再让玩家只凭名字猜用途。
// 文字取自原卡简中文本（参考实现的 supplies 条目），与 SUPPLY_LABELS 同源。
export const SUPPLY_HINTS = Object.freeze({
  provisions: '一人份的干粮和水，出行必备。',
  medicine: '治病，消除感染，解毒。',
  rope: '几圈又长又结实的绳索，攀爬和岩洞探险都少不了它。',
  blanket: '好在夜里保暖。',
  canteen: '可以在小溪和河边盛水。',
  torches: '照亮昏暗的区域，或点燃烛台。',
  compass: '在你迷失方向而绝望时，它能够指引你。',
  map: '地图上还没作标记，但随着时间推移，你或许能描绘出周边的环境。',
  binoculars: '帮助你看到更远的地方。',
  chalk: '用来在粗糙的石面写字。',
  pendant: '没什么用，但美好的回忆能给远离家乡的游子带来安慰。',
  gasoline: '足够一辆车跑一趟长途了。',
  pocketknife: '太小，不能当作可靠的武器，但易于藏匿。',
  pickaxe: '用来敲裂岩石的表面。',
})

// 两个购买时点各自可选的补给品，供选购界面列出完整卡面（买不起的也显示，只是标价）。
export const SUPPLY_LISTS = Object.freeze({
  prologue: PROLOGUE_SUPPLIES,
  resupplyPoint: RESUPPLY_SUPPLIES,
})

// 每位调查员的补给品点数：序幕 10/7/5/4，补给点 8/5/4/3（按人数）。
export const SUPPLY_POINTS = Object.freeze({
  prologue: Object.freeze({ 1: 10, 2: 7, 3: 5, 4: 4 }),
  resupplyPoint: Object.freeze({ 1: 8, 2: 5, 3: 4, 4: 3 }),
})

export function supplyLabel(name) {
  return SUPPLY_LABELS[name] || name
}

export function supplyCost(name) {
  return SUPPLY_COSTS[name] ?? 0
}

// 超过四人的情况按最低点数发放，避免出现未定义档位。
export function supplyPoints(context, investigatorCount) {
  const table = SUPPLY_POINTS[context] || SUPPLY_POINTS.prologue
  const count = Math.max(1, Math.min(4, investigatorCount))
  return table[count]
}

// 玩家看到的「配给」等在剧本里的复数写法：配给（×2）。
export function supplyListText(names) {
  const counts = new Map()
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1)
  return [...counts].map(([name, count]) => (count > 1 ? `${supplyLabel(name)}×${count}` : supplyLabel(name)))
}
