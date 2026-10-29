// 出发准备页的并行双线模型（P5.5 W2）。
//
// 只把 state/moves 整理成「左 A 线 / 右 B 线」两栏需要的数据：
//   · 每条线的座位、成员、人数；
//   · 每条线自己的队长候选与当前队长（hubSetPartLeader）；
//   · 每个座位「换到另一条线」的按钮（hubSetSeatPart）与置灰原因；
//   · 共用的开始按钮（含人数不等时引擎给的 disabled/explanation）。
// 非并行战役返回 { parallel: false }，出发准备页保持原样。
const LANE_NAMES = { A: 'A 线', B: 'B 线' }

export function departureLanes(state, moves = []) {
  const campaign = state?.campaign || {}
  const parallel = campaign.mode === 'parallel'
  if (!parallel) return { parallel: false, lanes: [] }
  const seatParts = Array.isArray(campaign.seatParts) ? campaign.seatParts : []
  const leaderMoves = moves.filter(move => move?.action === 'hubSetPartLeader')
  const seatMoves = moves.filter(move => move?.action === 'hubSetSeatPart')
  const lanes = ['A', 'B'].map(part => {
    const seats = seatParts.reduce((out, value, seat) => (value === part ? [...out, seat] : out), [])
    return {
      part,
      name: LANE_NAMES[part],
      seats,
      size: seats.length,
      leaderSeat: Number.isInteger(campaign.partLeads?.[part]) ? campaign.partLeads[part] : null,
      leaders: leaderMoves.filter(move => move.part === part),
      switches: seatMoves.filter(move => seatParts[move.seat] === part),
    }
  })
  const balanced = lanes[0].size > 0 && lanes[0].size === lanes[1].size
  return {
    parallel: true,
    lanes,
    balanced,
    startMove: moves.find(move => move.action === 'hubBeginScenario') || null,
    leaderReady: lanes.every(lane => lane.leaderSeat != null),
  }
}
