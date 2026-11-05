import { mechanicState } from './mechanic-state.js'
import { connectGrid } from './grid-map.js'

// 动态符号面的唯一读法：已揭示读 front、未揭示读 back。**缺失时回退另一面**——
// 单面印刷的地点（例如《雾中之光》的 07240/07241/07245/07246/07252b、《达贡巢穴》的
// 07283/07291）只有一份印刷图标，数据/印刷面口径不该因为「揭示」把印刷连接清空。
// 修复前只读 `symbols[revealed ? 'front' : 'back']`，只有 back 的地点一被揭示就永远失去
// 连接（并把对端连线一起清掉），导致幕 2 目标/结局 1 不可达（审计 H5）。
function symbolFace(loc) {
  const symbols = loc?.symbols
  if (!symbols) return null
  const preferred = loc.revealed ? symbols.front : symbols.back
  return preferred || symbols.front || symbols.back || null
}

export function syncDynamicLocationSymbols(state) {
  const dynamic = state.locations.filter(loc => loc.symbols?.dynamic)
  if (!dynamic.length) return
  for (const loc of dynamic) {
    loc.connections = (loc.connections || []).filter(id => !(loc.symbolLinks || []).includes(id))
    loc.symbolLinks = []
  }
  for (let i = 0; i < dynamic.length; i++) for (let j = i + 1; j < dynamic.length; j++) {
    const a = dynamic[i], b = dynamic[j], left = symbolFace(a), right = symbolFace(b)
    if (!left || !right || !left.symbol || !right.symbol || left.symbol === 'nosymbol' || right.symbol === 'nosymbol') continue
    if ((left.links || []).includes(right.symbol) || (right.links || []).includes(left.symbol)) {
      a.symbolLinks.push(b.id); b.symbolLinks.push(a.id)
      if (!a.connections.includes(b.id)) a.connections.push(b.id)
      if (!b.connections.includes(a.id)) b.connections.push(a.id)
    }
  }
  if (mechanicState(state)?.grid) connectGrid(state)
}
