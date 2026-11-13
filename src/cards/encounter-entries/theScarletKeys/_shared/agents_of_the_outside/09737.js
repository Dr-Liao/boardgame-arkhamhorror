// 09737 常态颠扑者（Paradigm Effacer） · 敌人 · agents_of_the_outside
// 归属：战役共用 · theScarletKeys/_shared/agentsOfTheOutside。
// 卡面：冷漠。猎手。
//   强制 - 你在常态颠扑者的地点结束回合后：查看你牌库顶的卡牌。如果不是弱点，将其放在一边，
//   位于场外，作为一个空洞。然后，如果有至少 3 张放在一边的空洞归你所有，常态颠扑者攻击你。
//   Aloof. Hunter. Forced - After you end your turn at Paradigm Effacer's location: Look at the top card
//   of your deck. If it is not a weakness, set it aside, out of play, as a hollow. Then, if you own 3 or
//   more set-aside hollows, Paradigm Effacer attacks you.
// 读点：
//   · 冷漠/猎手由章节遭遇定义提供（card-data#encounterDefinitions）；
//   · 「你在它的地点结束回合后」= turnEnded 窗口（turn-flow.js 派发，context 带 seat/location）；
//   · 查看牌库顶 = inv.deck 末位（只读）；「移到一边」= api.takeDeckCard(seat, code) 把实体移出牌库，
//     再 api.mechanics.tsk.hollow.hollow（tsk-hollow 唯一写入口，scope:'investigator'）；
//   · 个人空洞计数 = api.mechanics.tsk.hollow.count({ scope: 'investigator', seat })（P2 裁决口径：
//     卡面「你」= investigator，只算该座位 + 全队共享空洞）；
//   · 攻击 = api.attack。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09737'
const THRESHOLD = 3

export default {
  code: CODE, scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'turnEnded', silent: true,
    label: '你在它的地点结束回合后：牌库顶非弱点牌成为空洞；你有 3+ 空洞时它攻击你',
    criteria: ({ state, source, context }) => {
      if (!state.enemies.includes(source)) return false
      const seat = Number.isInteger(context?.seat) ? context.seat : null
      if (seat == null) return false
      const inv = state.investigators[seat]
      return Boolean(inv) && !inv.defeated && !inv.resigned && inv.location === source.location
    },
    resolve: ({ state, source, context, api }) => {
      const seat = context.seat
      const inv = state.investigators[seat]
      const top = (inv.deck || []).at(-1)
      if (top && !isWeaknessCode(top)) {
        if (api.mechanics.tsk.hollow.isHollowed(top)) {
          api.info?.(`🌀 牌库顶「${api.cardName(top)}」已有同名空洞，忽略本次（原语按卡号去重）。`)
        } else {
          api.takeDeckCard(seat, top)
          api.mechanics.tsk.hollow.hollow({ code: top, source: CODE, scope: 'investigator', seat })
          api.info?.(`🌀 ${inv.name} 的牌库顶「${api.cardName(top)}」被放在一边成为空洞。`)
        }
      } else if (top) {
        api.info?.(`🌀 ${inv.name} 的牌库顶是弱点：不设为空洞。`)
      }
      const hollows = api.mechanics.tsk.hollow.count({ scope: 'investigator', seat })
      if (hollows >= THRESHOLD) {
        api.scenario.attack(source, inv)
        api.info?.(`🌀 ${inv.name} 已有 ${hollows} 张空洞，「${source.name}」发动攻击。`)
      }
    },
  }],
  note: 'approximation: 「查看牌库顶」读取 inv.deck 末位（只读，不抽牌）；tsk-hollow 的 hollowCard 按卡号去重，'
    + '同名第二张按「忽略并披露」处理。无缺读点。',
}
