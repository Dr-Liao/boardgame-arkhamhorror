// 06192 诡计「发光的眼睛」（Glowing Eyes）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// 显现 - 将发光的眼睛放置入场，放到你的威胁区域。
// 强制 - 当一轮结束时：你的威胁区域每有 1 张卡牌，受到 1 点恐惧，最多受到 3 点恐惧。弃掉发光的眼睛。
//
// 依据 Haskell Treachery/Cards/.../GlowingEyes.hs（n = min 3 (敌人 + 支援 + 诡计数)）：
//   · 进威胁区 → encounterResolve 调 api.threat；
//   · roundEnds 在本卡仍处于威胁区时结算，计入交战敌人及附属在其上的诡计。
import { cardDefinition, originalOf } from '../../_shared.js'

export default {
  code: '06192',
  scope: 'treachery',
  implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'roundEnds', silent: true,
    label: '发光的眼睛：按威胁区域的牌数受到恐惧（最多 3 点），然后弃掉本卡',
    criteria: [({ inv, source }) => inv.threat?.includes(source)],
    resolve({ inv, source, api }) {
      const enemies = api.engagedEnemies(inv.seat)
      const attachedTreacheries = enemies.reduce((total, enemy) => total + (enemy.attachments || [])
        .filter(card => cardDefinition(originalOf(card))?.type === 'treachery').length, 0)
      api.horror(inv.seat, Math.min(3, inv.threat.length + enemies.length + attachedTreacheries))
      api.removeThreat(source)
    },
  }],
  encounterResolve(state, inv, treachery, api) {
    api.threat?.(inv.seat, '06192')
    api.info?.(`👀 「发光的眼睛」进入 ${inv.name} 的威胁区域。`)
    return true
  },
}
