import { investigatorAt, mechanicState } from './mechanic-state.js'
export function makeTurnPromise(state, seat, source, event) {
  const inv = investigatorAt(state, seat)
  if (!['draw', 'play', 'commit'].includes(event) || !inv.assets.some(asset => asset.id === source)) throw new TypeError('无效承诺声明')
  const data = mechanicState(state, true); data.promises ||= {}
  data.promises[source] = { seat, event, broken: false }
  return true
}
export function notePromiseEvent(state, seat, event, notify = () => {}) {
  if (state.currentSeat !== seat || state.phase !== 'investigation') return []
  const inv = investigatorAt(state, seat), promises = mechanicState(state)?.promises || {}, broken = []
  for (const [source, promise] of Object.entries(promises)) {
    if (!inv.assets.some(asset => asset.id === source)) { if (promise.seat === seat) delete promises[source]; continue }
    if (promise.seat !== seat || promise.event !== event || promise.broken) continue
    promise.broken = true; broken.push(source)
    notify({ sourceId: source, seat, event, location: inv.location })
  }
  return broken
}
