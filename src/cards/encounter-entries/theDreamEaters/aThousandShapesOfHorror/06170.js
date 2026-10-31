// 06170 议程 II「无名之物」（The Thing with No Name）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面（正面）：每张鼠群获得蜂拥 1。
// 强制 - 当你的回合开始时，如果不可名状之物处于重整状态并且位于你所在地点：
// 检定意志（2）。如果你检定失败，它攻击你（无论其是否交战）。
// 背面「它变凶了」：将遭遇弃牌堆洗入遭遇牌库。
//
// 依据 Haskell Agenda/Cards/.../TheThingWithNoName.hs：
//   · 正面「每张鼠群获得蜂拥 1」：本条目声明 grantsSwarming，共享层 enemySpawned 已负责入场的
//     蜂拥放置，本章 behavior.enemySpawned 在转发后按「当前议程的 grantsSwarming」补放鼠群的蜂拥卡；
//   · 回合开始强制：agendaRule.forced.turnBegins，由本章 behavior.turnBegins 分派；
//   · 背面洗回：advanceAgenda 时引擎调 behavior.agendaReveal → 本条目 onReveal。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

const THE_UNNAMABLE = '06169b'
const SWARM_OF_RATS = '01159'

export default {
  code: '06170',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    // 正面持续：每张「鼠群」获得蜂拥 1（由 behavior.enemySpawned 消费）。
    grantsSwarming: { code: SWARM_OF_RATS, amount: 1 },
    // 背面「它变凶了」：将遭遇弃牌堆洗入遭遇牌库。
    onReveal(state, agenda, api) {
      api.shuffleDiscard?.()
      api.info?.('🌫️ 「它变凶了」：遭遇弃牌堆已混洗入遭遇牌库。')
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
