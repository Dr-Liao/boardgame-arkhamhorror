// 05269 灵魂之歌
// 归属：关卡专用 05238《聚合幻灭》（uad）。卡面：显现 - 放入任意调查员的威胁区。
// 强制 - 在你将要受到伤害时：受到额外 2 点伤害并弃掉灵魂之歌。
// 一卡一文件：规则只在这里维护；伤害拦截走条目 harmInterceptor（读点 enemies.js 的 applyHarm）。
import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '05269',
  scope: 'treachery',
  implemented: true,
  harmInterceptor: { trigger: 'damage', extra: 2, discard: true },
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
