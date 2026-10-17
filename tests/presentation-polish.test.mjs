import test from 'node:test'
import assert from 'node:assert/strict'
import { presentationChanges, publicSequence } from '../web/table-presentation.js'
import { createGameState, applyMove } from '../src/engine/engine.js'
import { mapGeometry } from '../web/map-layout.js'
import { campaignPresentation, presentationAttributes } from '../web/campaign-presentation.js'
import { buildChapter, chapterSpecs } from '../content/campaigns/theDunwichLegacy/chapters.js'
import { readFileSync } from 'node:fs'

test('map arrows retain asymmetric rule direction and merge mutual connections once', () => {
  const locations = [{ id: 'b', connections: ['a'] }, { id: 'a', connections: ['c', 'missing'] }, { id: 'c', connections: ['a'] }]
  const original = structuredClone(locations)
  assert.deepEqual(mapGeometry(locations).edges, [
    { from: 'b', to: 'a', bidirectional: false },
    { from: 'a', to: 'c', bidirectional: true },
  ])
  assert.deepEqual(locations, original, 'drawing connections must not change legal movement')
})

test('later Dunwich chapter maps use grid coordinates that fit the map viewport', () => {
  for (const id of Object.keys(chapterSpecs)) {
    const { scenario, layout } = buildChapter(id)
    const points = Object.values(layout.locations)
    assert.ok(Math.max(...points.map(point => point.x)) <= 3, `${id} x coordinates must be grid columns`)
    assert.ok(Math.min(...points.flatMap(point => [point.x, point.y])) >= 0, `${id} coordinates must stay on the grid`)
    const geometry = mapGeometry(Object.values(scenario.locations), layout)
    assert.ok(geometry.width <= 900, `${id} map must remain fittable, got width ${geometry.width}`)
  }
})

test('campaign presentation layers common assets with opening-campaign art and palette', () => {
  const theme = campaignPresentation('nightOfTheZealot', 'theGathering')
  assert.equal(theme.id, 'nightOfTheZealot')
  assert.match(theme.assets.hubHero, /campaigns\/nightOfTheZealot\/hub\/office-hero\.webp$/)
  assert.match(theme.assets.tableOverlay, /campaigns\/nightOfTheZealot\/table\/investigation-map\.webp$/)
  assert.match(theme.assets.storyDefault, /campaigns\/nightOfTheZealot\/scenarios\/theGathering\/scene\.webp$/)
  assert.match(campaignPresentation('nightOfTheZealot').assets.storyDefault, /campaigns\/nightOfTheZealot\/story\/default\.png$/)
  assert.match(campaignPresentation('nightOfTheZealot', 'theMidnightMasks').assets.storyDefault, /scenarios\/theMidnightMasks\/scene\.webp$/)
  assert.match(campaignPresentation('nightOfTheZealot', 'theDevourerBelow').assets.storyDefault, /scenarios\/theDevourerBelow\/scene\.webp$/)
  assert.match(theme.assets.casefile, /img\/ui\/hub-casefile\.webp$/)
  assert.equal(theme.musicPlaylist, 'nightOfTheZealot/theGathering')
  const attrs = presentationAttributes({ campaign: { id: 'nightOfTheZealot' }, scenario: { id: 'theGathering' } })
  assert.equal(attrs['data-campaign'], 'nightOfTheZealot')
  assert.equal(attrs['data-scenario'], 'theGathering')
  assert.match(attrs.style['--ah-table-overlay-image'], /nightOfTheZealot/)
  for (const relative of [
    'hub/office-hero.webp', 'table/investigation-map.webp',
    'scenarios/theGathering/scene.webp', 'scenarios/theMidnightMasks/scene.webp',
    'scenarios/theDevourerBelow/scene.webp',
  ]) {
    const file = new URL(`../web/img/campaigns/nightOfTheZealot/${relative}`, import.meta.url)
    assert.equal(readFileSync(file).subarray(0, 4).toString('ascii'), 'RIFF', relative)
  }
  for (const relative of ['story/default.png']) {
    const file = new URL(`../web/img/campaigns/nightOfTheZealot/${relative}`, import.meta.url)
    assert.deepEqual([...readFileSync(file).subarray(0, 8)], [137,80,78,71,13,10,26,10], relative)
  }
  assert.equal(campaignPresentation('unregisteredCampaign').id, 'common')
})

test('presentation handles duplicate cards, private hands and public move targets', () => {
  const before = { investigators: [{ seat: 0, hand: ['a', 'a'], location: 'study', assets: [], resources: 3 }, { seat: 1, hand: [], handSize: 3, assets: [] }], locations: [] }
  const after = structuredClone(before)
  after.investigators[0].hand = ['a', 'a', 'a']; after.investigators[0].location = 'hall'; after.investigators[0].resources--
  after.investigators[1].handSize++
  const changes = presentationChanges(before, after)
  assert.equal(changes.filter(c => c.kind === 'draw').length, 1)
  assert.deepEqual(changes.find(c => c.kind === 'move'), { kind: 'move', seat: 0, from: 'study', to: 'hall', name: undefined })
  assert.equal(changes.find(c => c.kind === 'resource').delta, -1)
  assert.ok(!changes.some(c => c.seat === 1), 'never infer hidden card identity')
})

test('presentation uses authoritative test results including automatic failure', () => {
  const state = { investigators: [], locations: [], agendaIndex: 0, actIndex: 0 }
  const event = { type: 'presentation', kind: 'test', success: false, value: 0, difficulty: 0, drawn: ['autofail'], autoFail: true }
  assert.deepEqual(presentationChanges(state, state, [event]), [event])
  assert.deepEqual(presentationChanges(null, state, [event]), [], 'initial hydration never replays old outcomes')
})

test('each chaos draw stays in order before its result, including redraws', () => {
  const events = [
    { type: 'presentation', kind: 'chaos', token: 'skull' },
    { type: 'presentation', kind: 'chaos', token: '-1' },
    { type: 'presentation', kind: 'test', drawn: ['-1'], success: true },
  ]
  assert.deepEqual(publicSequence(events), events)
})

test('scenario opening presents introduction, agenda, then setup location reveals', () => {
  const events = [
    { seq: 4, type: 'info', presentation: { kind: 'location', title: '地点揭示' } },
    { seq: 5, type: 'info', presentation: { kind: 'story', title: '故事导入', intro: true } },
    { seq: 6, type: 'info', presentation: { kind: 'story', title: '密谋揭示', initialAgenda: true } },
    { seq: 7, type: 'presentation', kind: 'test', success: true },
  ]
  const sequence = publicSequence(events)
  assert.deepEqual(sequence.map(cue => cue.title || cue.kind), ['故事导入', '密谋揭示', '地点揭示', 'test'])
  assert.deepEqual(sequence.map(cue => cue.eventSeq), [5, 6, 4, 7])
})

test('engagement alerts occur on entry including massive enemies, never every repaint',()=>{
  const before={investigators:[{seat:0,name:'罗兰',location:'hall',hand:[],assets:[]}],enemies:[],locations:[]}
  const after=structuredClone(before);after.enemies=[{id:'enemy',name:'怪物',location:'hall',engagedSeat:0}]
  assert.equal(presentationChanges(before,after).filter(c=>c.kind==='engagement').length,1)
  assert.equal(presentationChanges(after,after).filter(c=>c.kind==='engagement').length,0)
  after.enemies=[{id:'massive',name:'巨型怪物',location:'hall',massive:true}]
  assert.equal(presentationChanges(before,after).filter(c=>c.kind==='engagement').length,1)
  after.enemies[0].location='other'
  assert.equal(presentationChanges(before,after).filter(c=>c.kind==='engagement').length,0)
})

test('movement is presented before engagement triggered at the destination',()=>{
  const before={investigators:[{seat:0,name:'罗兰',location:'hall',hand:[],assets:[]}],enemies:[],locations:[]}
  const after=structuredClone(before)
  after.investigators[0].location='cellar'
  after.enemies=[{id:'enemy',name:'食尸鬼',location:'cellar',engagedSeat:0}]
  assert.deepEqual(presentationChanges(before,after).map(c=>c.kind),['move','engagement'])
})

test('automatic round events survive decision pauses once, in authoritative order', () => {
  const state = createGameState({ playerInvestigator:'01001', seed:'presentation-round' }, [{seat:0}])
  const answer = () => {
    const c = state.pendingChoice, option = c.options.find(o => ['done','skip','self'].includes(o.id)) || c.options[0]
    return applyMove(state,c.seat,{action:'choose',choiceId:c.id,optionId:option.id})
  }
  for(let i=0;state.pendingChoice;i++) { assert.ok(i<100);answer() }
  const events = applyMove(state,0,{action:'endTurn'})
  for(let i=0;state.pendingChoice;i++) { assert.ok(i<100);events.push(...answer()) }
  const phases = events.filter(e=>e.presentation?.kind==='phase').map(e=>e.presentation.phase)
  assert.deepEqual(phases,['enemy','upkeep','mythos','investigation'])
  const sequence=publicSequence(events)
  assert.ok(sequence.find(c=>c.phase==='upkeep')?.steps.some(s=>s.text.includes('资源')))
  assert.ok(sequence.find(c=>c.phase==='mythos')?.steps.some(s=>s.effect==='encounter'))
  const before={investigators:[],locations:[],phase:'investigation',round:1}
  const after={...before,round:2}
  assert.deepEqual(presentationChanges(before,after,events),sequence,'do not collapse intermediate phases into the final investigation state')
})
