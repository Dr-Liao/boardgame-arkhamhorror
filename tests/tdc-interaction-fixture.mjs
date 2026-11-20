import { claimProgress, changeProgress } from '../src/campaign/progress-tracks.js'
import { recordSetAdd } from '../src/campaign/record-sets.js'
import { registerCardAbilities } from '../src/engine/ability.js'
import { legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { configureGrid, placeGridLocation } from '../src/engine/grid-map.js'
import { asset, enemy, fixture } from './core-fixture.mjs'

export const TDC_CONSOLE = 'tdc-fixture-console'
// 文物卡用真实单卡条目 11550（黑曜石遗物）：P7 内容批次已为它登记 transferOnControllerDefeat，
// 因此夹具不再重复注册同一卡号（能力层同一卡号只允许一个条目）。
const artifact = '11550'
export const TDC_ARTIFACT = artifact
const sourceOf = source => ({ source: source.id })
const actions = [
  ['领取任务', ({ api, inv, source }) => api.interactions.tdc.claimTask(inv.seat, sourceOf(source))],
  ['选定远征路线', ({ api, inv, source }) => api.interactions.tdc.chooseRoute(inv.seat, sourceOf(source))],
  ['划除远征区域', ({ api, inv, source }) => api.interactions.tdc.crossRegion(inv.seat, sourceOf(source))],
  ['解读发现的字形', ({ api, inv, source }) => api.interactions.tdc.translateGlyph(inv.seat, ['A', 'Z'], sourceOf(source))],
  ['分配已获得的文物', ({ state, inv, source }) =>
    scenarioRuntime(state, []).mechanics.interactions.tdc.assignArtifact(inv.seat, sourceOf(source))],
  ['重排前方地点', ({ api, inv, source }) => api.interactions.tdc.relocate(inv.seat, [
    { id: 'slide', label: '将前方地点移至第三行', changes: [{ id: 'tdcSlope', x: 0, y: 2 }] },
    { id: 'blocked', label: '被占据的格子', changes: [{ id: 'tdcSlope', x: 0, y: 0 }] },
  ], sourceOf(source))],
  ['结算文物持有人败退', ({ api }) => api.lethalSelfDamage(1)],
]
registerCardAbilities([
  { code: TDC_CONSOLE, abilities: actions.map(([label, resolve]) => ({ kind: 'action', label, resolve })) },
])

export function tdcInteractionFixture({ scriptCard = 'act' } = {}) {
  const state = fixture('01001', 4)
  state.humanSeats = [0, 1, 2, 3]
  state.campaign.leadSeat = 0
  const at = state.investigators[0].location
  state.scenario.mechanics = { ...state.scenario.mechanics, tdc: {
    tasks: [
      { id: 'watch', label: '私人任务·守岸' },
      { id: 'charts', label: '绘制海岸地图' },
      { id: 'supplies', label: '清点补给' },
    ],
    routes: [{ id: 'east', label: '东线' }, { id: 'west', label: '西线' }],
    regions: [
      { id: 'eastShore', label: '东岸', route: 'east' },
      { id: 'westShore', label: '西岸', route: 'west' },
    ],
    glyphs: { A: '潮水', Z: '未触发译文', B: '暗置译文' },
  } }
  state.scenario.scriptCards = { explore: { card: scriptCard } }
  state.explorationDeck = ['dissonantVoices']
  state.campaign.privateStories = [
    { audienceInvestigatorIds: [state.campaign.investigators[1].id], id: 'tdc-private-branch',
      title: '异席剧情', text: '异席已触发的私人分支', flowIndex: 0 },
  ]
  state.investigators[0].name = '领队'
  state.investigators[1].name = '文物持有人'
  state.investigators[2].name = '同距调查员'
  state.investigators[3].name = '远处调查员'
  claimProgress(state.campaign, 'tdcTask', 1, 'watch')
  changeProgress(state.campaign, 'tdcTask', 1, 2, 'fixture')
  recordSetAdd(state.campaign, 'tdcArtifactsEarned', artifact)

  state.locations.push(
    { id: 'tdcSlope', code: 'tdcSlope', name: '坡道', revealed: true, clues: 0, shroud: 1, connections: [] },
    { id: 'tdcHidden', code: 'privateTdcLocation', name: '暗置门口', hiddenIdentity: true, revealed: false,
      text: '暗置地点的正面正文', clues: 0, shroud: 1, connections: [] },
  )
  state.investigators[3].location = 'tdcSlope'
  for (const seat of [0, 1, 2]) state.investigators[seat].location = at
  configureGrid(state, { adjacency: 'rows' })
  for (const [id, x, y] of [[at, 0, 0], ['tdcSlope', 0, 1], ['tdcHidden', 1, 1]]) {
    placeGridLocation(state, id, x, y, {})
  }
  const body = enemy(state, { name: '克苏鲁主体', damage: 0, horror: 0, exhausted: true })
  const part = side => enemy(state, { name: side, engagedSeat: null, damage: 0, horror: 0 })
  scenarioRuntime(state, []).linkEnemyParts(body.id, [part('左部位').id, part('右部位').id])
  state.cards[TDC_CONSOLE] = { code: TDC_CONSOLE, name: '远征操作台', nameZh: '远征操作台', type: 'asset', slots: [] }
  asset(state, TDC_CONSOLE, { id: TDC_CONSOLE })
  state.legalMoves = legalMoves(state, 0)
  return state
}
