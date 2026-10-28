// 05270 死期临近
// 归属：关卡专用 05238《聚合幻灭》（uad）。卡面：显现 - 放入任意调查员的威胁区。
// 强制 - 在你将要受到恐惧时：受到额外 2 点恐惧并弃掉死期临近。
// 一卡一文件：规则只在这里维护；恐惧拦截走条目 harmInterceptor（读点 enemies.js 的 applyHarm）。
import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '05270',
  scope: 'treachery',
  implemented: true,
  harmInterceptor: { trigger: 'horror', extra: 2, discard: true },
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const pool = state.investigators.filter(target => !target.defeated && !target.resigned)
    let chosen = pool[0]
    if (pool.length > 1 && typeof api.choose === 'function') {
      const picked = api.choose({
        kind: 'investigator', source: code, seat: inv.seat,
        prompt: `选择承受「${ALL_CARDS[code]?.nameZh || code}」的调查员。`,
        options: pool.map(target => ({ id: String(target.seat), label: target.name })),
      })
      chosen = pool.find(target => String(target.seat) === String(picked)) || inv
    }
    if (!chosen) return false
    api.threat?.(chosen.seat, code)
    api.info?.(`「${ALL_CARDS[code]?.nameZh || code}」进入 ${chosen.name} 的威胁区域。`)
    return true
  },
}
