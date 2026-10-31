// 06171 议程 III「无名之死」（The Dead with No Name）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面（正面）：每张鼠群获得蜂拥 2。
// 不可名状之物失去冷漠并获得庞大。
// 强制 - 当你的回合开始时，如果不可名状之物处于重整状态并且位于你所在地点：
// 检定意志（2）。如果你检定失败，它攻击你（无论其是否交战）。
// 背面「它是真的」：(→ 结局 2)。
//
// 依据 Haskell Agenda/Cards/.../TheDeadWithNoName.hs：
//   · 蜂拥 2：agendaRule.grantsSwarming（behavior.enemySpawned 消费）；
//   · 失去冷漠 / 获得庞大：agendaRule.enemyModifiersOnReveal 数据，behavior 在每回合开始与
//     议程推进后按数据幂等执行（引擎没有「移除冷漠/给予庞大」的 api，由章节内容层落实例字段）；
//   · 背面：advanceAgenda 时 behavior.agendaReveal → 本条目 onReveal → api.finish('resolution2')。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

const THE_UNNAMABLE = '06169b'
const SWARM_OF_RATS = '01159'

export default {
  code: '06171',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    grantsSwarming: { code: SWARM_OF_RATS, amount: 2 },
    enemyModifiersOnReveal: { code: THE_UNNAMABLE, removeKeywords: ['aloof'], addKeywords: ['massive'] },
    // 背面「它是真的」：→ 结局 2（结局分支见 behavior.resolution）。
    onReveal(state, agenda, api) {
      api.finish?.('resolution2')
      return true
    },
    forced: {
      turnBegins(state, agenda, api) {
        for (const inv of activeInvestigators(state)) {
          const unnamable = (state.enemies || []).find(enemy => String(originalOf(enemy)) === THE_UNNAMABLE
            && enemy.location === inv.location && !enemy.exhausted && !enemy.defeated)
          if (!unnamable) continue
          api.test?.(inv.seat, 'willpower', 2, result => {
            if (result.success) return
            api.attack?.(unnamable, inv)
            api.info?.(`👁️ 「${ALL_CARDS[THE_UNNAMABLE]?.nameZh || '不可名状之物'}」扑向 ${inv.name}（意志检定失败）。`)
          })
        }
      },
    },
  },
}
