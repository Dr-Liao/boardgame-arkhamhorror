// 卢克·罗宾逊：每回合 1 张事件，如同位于一个连接地点并与那里每个未交战的敌人交战。
// 结算期间暂时改写所在地点与交战；事件若没有把调查员带走，结束后回到原地点并解除这次临时交战。
//
// 官方 FAQ（ArkhamDB › Luke Robinson）：「如同位于」只在事件结算期间改变游戏状态——
// 例如在梦境之门以「如同位于」打出「飞蛾扑火」抽出没有生成指令的敌人时，敌人结算期间与卢克交战；
// 事件结束后卢克回到梦境之门，敌人不能继续与他交战，留在那个连接地点。
// 因此结束时必须解除**所有**在目标地点上与他交战的敌人，而不只是开始时临时接管的那批：
// 结算期间新生成/新交战的敌人（spawnEnemy → engageEnemy）同样不能把交战带出这次结算。

export function canAsIfPlay(inv, state) {
  return inv?.asIfEventTurn !== state?.turnSerial
}

export function beginAsIf(state, inv, locationId) {
  const enemies = (state.enemies || []).filter(enemy => enemy.location === locationId && enemy.engagedSeat == null)
  inv._asIf = { from: inv.location, locationId, engaged: enemies.map(enemy => enemy.id) }
  inv.location = locationId
  for (const enemy of enemies) enemy.engagedSeat = inv.seat
  inv.asIfEventTurn = state.turnSerial
}

export function endAsIf(state, inv) {
  const saved = inv?._asIf
  if (!saved) return
  delete inv._asIf
  const stayed = inv.location === saved.locationId
  if (stayed) inv.location = saved.from
  // 「如同位于」目标地点上的交战都是临时交战：结算结束后卢克已不在此处，敌人不能继续交战
  // （官方 FAQ：敌人留在该地点）。beginAsIf 接管的敌人与结算期间新生成的敌人一并清理；
  // 卢克真实的威胁区敌人（位于原地点 saved.from）不动。
  const temporary = new Set(saved.engaged || [])
  for (const enemy of state.enemies || []) {
    if (enemy.engagedSeat !== inv.seat) continue
    if (enemy.location === saved.locationId) temporary.add(enemy.id)
  }
  for (const enemy of state.enemies || []) {
    if (!temporary.has(enemy.id) || enemy.engagedSeat !== inv.seat) continue
    enemy.engagedSeat = null
    if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
  }
}
