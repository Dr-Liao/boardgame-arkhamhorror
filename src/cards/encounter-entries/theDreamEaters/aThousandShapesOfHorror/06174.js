// 06174 地点「坟地」（Burial Ground · [[墓地]]）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：抽取到的每个[[食尸鬼]]敌人不生成在其通常的生成地点，
// 改为生成在坟地。
// [fast] 位于坟地的调查员共同花费 1[per_investigator] 个线索：记住调查员「发现了缺失的骨头」。
//
// 依据 Haskell Location/Cards/.../BurialGround.hs：
//   · 生成改道 → locationRule.spawnRedirectTrait（behavior.spawnLocation 按数据把所有带 Ghoul 特性的敌人改到此地点）；
//   · [fast] 团队线索行动 → locationRule.actions/performAction（behavior.actions / fastActions 分派），
//     「记住」走 encounter-entries/_shared.js 的 rememberFact（scenarioFlags.remembered），
//     供不可名状之物的 enemyStatRule.rememberedFacts 读取。
import { activeInvestigators, rememberFact } from '../../_shared.js'

const BURIAL_GROUND = '06174'
const FACT = 'noticedTheMissingBones'

const groupCluesAt = (state, location) => activeInvestigators(state)
  .filter(inv => inv.location === location.id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

export default {
  code: BURIAL_GROUND,
  scope: 'location',
  implemented: true,
  locationRule: {
    // 印刷「生成 - 改为生成在坟地」：抽取到的每个 Ghoul 敌人。
    spawnRedirectTrait: 'Ghoul',
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if ((state.scenarioFlags?.remembered || []).includes(FACT)) return
      const required = state.numInvestigators
      moves.push({
        action: 'scenarioAction',
        rule: 'tshRememberMissingBones',
        actions: 0,
        fast: true,
        label: `🦴 坟地：共同花费 ${required} 个线索，记住「发现了缺失的骨头」`,
        ...(groupCluesAt(state, location) >= required ? {} : { reason: `共同线索不足（需要 ${required}）` }),
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshRememberMissingBones') return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      const required = state.numInvestigators
      if (!location || groupCluesAt(state, location) < required) return false
      api.payClues?.(required, location.id)
      rememberFact(state, FACT)
      api.info?.(`🦴 坟地：调查员记住了「发现了缺失的骨头」（不可名状之物 -1 攻击 / -1 躲避）。`)
      return true
    },
  },
}
