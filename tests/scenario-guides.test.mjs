import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry } from '../content/registered.js'
import { scenarioGuide, scenarioSetupText } from '../content/scenario-guides.js'
import { createGameState } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'

test('每关的设置面板都有布置文本和说明', () => {
  const ids = contentRegistry.listScenarios().map(entry => entry.id)
  assert.ok(ids.length >= 30)
  for (const id of ids) {
    const scenario = contentRegistry.getScenarioData(id)
    const guide = scenarioGuide(id)
    const setup = scenarioSetupText(scenario)
    assert.ok(setup.length > 20, `${id} 缺少设置文本`)
    assert.ok(guide?.note && guide.note.length > 20, `${id} 缺少设置说明`)
    assert.doesNotMatch(setup, /gaps/, `${id} 的设置文本还带着开发备注`)
  }
})

test('观察投影带上设置说明，且不改写已有开场', () => {
  const state = createGameState({ seed: 'setup-guide' }, [{ seat: 0, role: 'human' }])
  const view = viewState(state, 0)
  assert.equal(view.scenario.id, 'theGathering')
  assert.equal(view.scenario.intro, state.scenarioIntro.paragraphs.join('\n\n'))
  assert.match(view.scenario.setup, /书房/)
  assert.match(view.scenario.setupNote, /食尸鬼/)
})

test('没有自带设置文本的关卡用补写的布置步骤', () => {
  const scenario = contentRegistry.getScenarioData('theMiskatonicMuseum')
  assert.equal(scenario.setup, undefined)
  const setup = scenarioSetupText(scenario)
  assert.match(setup, /博物馆大门/)
  assert.match(setup, /展厅/)
  assert.match(scenarioGuide('theEssexCountyExpress').setup, /车头/)
})
