// 06065 蛛巢蔓延（The Infestation Spreads）· 议程 2
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 正面：强制 - 神话阶段结束时：进行一次蛛群滋生检定（检定逻辑在章节 behavior.infestationTest，
//   由 behavior.mythosEnded 读本条目 agendaRule.mythosEndInfestationTest 分派）。
// 背面：把场上每个「可疑的护工」替换为放在一边的「堕落的护工」（保留游戏状态/标记/附属）；
//   从遭遇牌库与弃牌堆找出每张「可疑的护工」并移出游戏；
//   把放在一边的「阿特拉克·纳克亚的仆从」遭遇组、其余放在一边的「堕落的护工」与遭遇弃牌堆洗入遭遇牌库；
//   向滋生袋加入 1 个 [skull] 与 1 个 [cultist] 标记。
// 读点：agendaRule.onReveal（章节 behavior.agendaReveal 分派）。「替换敌人且保留状态」需要直接写敌人实例，
//   由章节 behavior 在 onReveal 之后按 api.setScenarioFlag('needsOrderlyReplacement') 处理（见 behavior.js）。
import { ALL_CARDS } from '../../_shared.js'

const CODE = '06065'

export default {
  code: CODE,
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    mythosEndInfestationTest: true,
    onReveal(state, agenda, api) {
      // 1) 移出游戏：每张「可疑的护工」（先出牌库、再出弃牌堆，循环到两边都没有）。
      let removed = 0
      while (api.discardEncounterCard?.('06081', { includeDiscard: true })) removed += 1
      // 2) 洗入：其余放在一边的「堕落的护工」。
      const setAside = Array.isArray(state.scenarioZones?.setAside) ? [...state.scenarioZones.setAside] : []
      const shuffleIn = []
      for (const code of setAside) {
        if (code !== '06082') continue
        api.takeFromSetAside?.(code)
        shuffleIn.push(code)
      }
      // 3) 洗入：放在一边的「阿特拉克·纳克亚的仆从」遭遇组。
      for (const [code, card] of Object.entries(ALL_CARDS)) {
        if (card.encounterCode !== 'agents_of_atlach_nacha') continue
        if (!['enemy', 'treachery'].includes(card.type)) continue
        if (!setAside.includes(code)) continue
        api.takeFromSetAside?.(code)
        shuffleIn.push(code)
      }
      if (shuffleIn.length) api.shuffleIntoEncounterDeck?.(shuffleIn)
      api.shuffleDiscard?.()
      // 4) 滋生袋 +1 骷髅 +1 异教徒。
      api.tokenBag?.add?.('infestation', 'skull')
      api.tokenBag?.add?.('infestation', 'cultist')
      // 5) 护工替换（需要写敌人实例，章节 behavior 后置处理）。
      api.setScenarioFlag?.('needsOrderlyReplacement', true)
      api.info?.(`🕷️ 「蛛巢蔓延」背面：移出 ${removed} 张可疑的护工；堕落的护工与阿特拉克·纳克亚的仆从进入遭遇牌库；滋生袋加入骷髅与异教徒。`)
      return true
    },
  },
}
