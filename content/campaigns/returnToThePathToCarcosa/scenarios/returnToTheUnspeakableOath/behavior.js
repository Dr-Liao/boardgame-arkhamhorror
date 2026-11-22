// 重返邪秽誓约 · 章节行为。
//
// 基础章节的病房随机、怪物/疯子牌堆、缟玛瑙扣环、混乱标记与结局记录直接复用
// 基础 behavior；这里只覆盖：
//   1. 布置：52037/52038 放在一边，场景 2 按剧本日志在 52035（版本三）/52036（版本四）
//      之间选择，基础两个版本从游戏中移除；
//   2. 52035 背面：在丹尼尔的囚室生成疯狂之主，并把场景外牌堆与遭遇弃牌堆洗回牌库；
//   3. 52036 背面：把丹尼尔支援交给囚室中的调查员并附属根除疗法（近似：附属记账写入
//      scenarioFlags，根除疗法的回合结束恐惧由条目声明）。
import { behavior as baseBehavior } from '../../../thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js'
import { ACT_TWO_V3, ACT_TWO_V4, HOST_OF_INSANITY } from './definition.js'
import { returnToIntroduction } from '../../story.js'

const original = card => card?.originalCode || card?.code
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)

function shuffleWith(state, items, api) {
  return api?.shuffle ? api.shuffle(items) : [...items].sort()
}

export const behavior = {
  ...baseBehavior,
  id: 'returnToTheUnspeakableOath',
  introduction: returnToIntroduction('theUnspeakableOath'),

  setupPlan(state) {
    const halls = state.scenarioFlags?.oathHalls || {
      west: state.scenario.hallPools.west[0],
      east: state.scenario.hallPools.east[0],
    }
    return {
      locations: [halls.west, halls.east, 'messHall', 'kitchen', 'yard', 'garden', 'infirmary', 'basementHall'],
      setAside: ['03178', '03179', '03180', '03181', '03182a', HOST_OF_INSANITY, '52038'],
      removed: ['03164', '03165'],
    }
  },

  setupLocations(state, _events, api) {
    state.scenarioFlags = { remembered: [], tookKeysByForce: false, keysFound: 0 }
    state.scenarioZones.removed = []
    state.scenarioZones.underAct = []
    state.scenarioFlags.oathHalls = {}
    for (const [side, ids] of Object.entries(state.scenario.hallPools)) {
      const shuffled = api.shuffle([...ids], () => api.randomValue(state))
      state.scenarioFlags.oathHalls[side] = shuffled[0]
      state.scenarioZones.removed.push(state.scenario.locations[shuffled[1]].originalCode)
    }
    const rng = () => api.randomValue(state)
    state.scenarioZones.monsters = api.shuffle([...state.scenario.monsterDeck], rng)
    state.scenarioZones.lunatics = api.shuffle([...state.scenario.lunaticsDeck], rng)
    const halls = Object.values(state.scenarioFlags.oathHalls)
    for (const inv of active(state)) inv.location = halls[Math.floor(api.randomValue(state) * halls.length)]
    // 52034 背面：以剧本日志的「确信 ≥ 疑惑」决定使用版本三还是版本四；
    // 基础 03164/03165 两个版本从游戏中移除，不进入幕牌库。
    const records = state.campaign.records || {}
    const v3 = Number(records.conviction || 0) >= Number(records.doubt || 0)
    const chosen = v3 ? ACT_TWO_V3 : ACT_TWO_V4
    state.scenarioFlags.actTwoVersion = chosen
    const byCode = code => state.scenario.acts.find(act => original(act) === code)
    state.acts = ['03163', chosen, '03166', '03167']
      .map(code => structuredClone(byCode(code)))
      .filter(Boolean)
    state.actIndex = 0
    return this.setupPlan(state).locations
  },

  // 52035 / 52036 的背面：生成疯狂之主 / 交予丹尼尔，并把场景外牌堆的敌人洗回遭遇牌库。
  actReveal(state, act, api) {
    baseBehavior.actReveal?.(state, act, api)
    const code = original(act)
    if (code !== ACT_TWO_V3 && code !== ACT_TWO_V4) return
    if (code === ACT_TWO_V3) {
      api.spawn?.(HOST_OF_INSANITY, 'danielsCell')
      state.scenarioFlags.hostOfInsanitySpawned = true
    } else {
      const occupant = active(state).find(inv => inv.location === 'danielsCell') || active(state)[0]
      if (occupant) {
        const daniel = api.spawnStoryAsset?.('03182a', occupant.location)
        if (daniel) {
          daniel.controllerSeat = occupant.seat
          state.scenarioFlags.danielControlledBy = occupant.seat
          state.scenarioFlags.radicalTreatmentAttachedTo = '03182a'
          api.info?.('丹尼尔·契斯特菲尔德被置于调查员的控制之下，根除疗法附属在他身上。')
        }
      }
    }
    // 把场景外牌堆（怪物 / 疯子）与遭遇弃牌堆的敌人洗回遭遇牌库。
    const monsters = state.scenarioZones.monsters || []
    const lunatics = state.scenarioZones.lunatics || []
    const discard = (state.encounterDiscard || []).filter(codeValue => state.scenario.enemies?.[codeValue])
    state.scenarioZones.monsters = []
    state.scenarioZones.lunatics = []
    state.encounterDiscard = (state.encounterDiscard || []).filter(codeValue => !discard.includes(codeValue))
    state.encounterDeck = shuffleWith(state, [...(state.encounterDeck || []), ...monsters, ...lunatics, ...discard], api)
    api.info?.('场景外牌堆与遭遇弃牌堆的敌人被洗回遭遇牌库。')
  },
}
