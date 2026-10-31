// 卢克·罗宾逊：每回合 1 张事件，如同位于一个连接地点并与那里每个未交战的敌人交战。
// 结算期间暂时改写所在地点与交战；事件若没有把调查员带走，结束后回到原地点并解除这次临时交战。

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
  if (inv.location === saved.from) {
    for (const id of saved.engaged) {
      const enemy = (state.enemies || []).find(item => item.id === id)
      if (enemy && enemy.engagedSeat === inv.seat && enemy.location === saved.locationId) enemy.engagedSeat = null
    }
  }
}
