import { mechanicState } from './mechanic-state.js'
import { connectGrid } from './grid-map.js'

export function syncDynamicLocationSymbols(state) {
  const dynamic = state.locations.filter(loc => loc.symbols?.dynamic)
  if (!dynamic.length) return
  for (const loc of dynamic) {
    loc.connections = (loc.connections || []).filter(id => !(loc.symbolLinks || []).includes(id))
    loc.symbolLinks = []
  }
  const face = loc => loc.symbols[loc.revealed ? 'front' : 'back']
  for (let i = 0; i < dynamic.length; i++) for (let j = i + 1; j < dynamic.length; j++) {
    const a = dynamic[i], b = dynamic[j], left = face(a), right = face(b)
    if (!left || !right || !left.symbol || !right.symbol || left.symbol === 'nosymbol' || right.symbol === 'nosymbol') continue
    if ((left.links || []).includes(right.symbol) || (right.links || []).includes(left.symbol)) {
      a.symbolLinks.push(b.id); b.symbolLinks.push(a.id)
      if (!a.connections.includes(b.id)) a.connections.push(b.id)
      if (!b.connections.includes(a.id)) b.connections.push(a.id)
    }
  }
  if (mechanicState(state)?.grid) connectGrid(state)
}
