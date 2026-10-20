import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import {
  AGENDA_HAND_SIZE_PENALTY, BLANKS_TRAITS, ENEMY_WEAKNESS_EXTRA, EXPLICIT_REACTION_PROMPT,
  agendaHandSizePenalty, blanksTraits, enemyWeaknessExtra, hasExplicitReactionPrompt,
  isPoisonThreat, isTextBlankEnemy, poisonThreatCode,
} from '../src/cards/card-rules.js'

// Phase 5（5a）：原本写在 engine.js 里的卡号级规则数据搬到内容层后，读点必须仍然可用。
nodeTest('5a 卡号级规则数据：读点与数据形状', () => {
  assert.equal(enemyWeaknessExtra('01101').parleyCost, 4)
  assert.equal(enemyWeaknessExtra('01102').forcedDoom, true)
  assert.equal(isTextBlankEnemy('01103'), true)
  assert.equal(isTextBlankEnemy('01101'), false)
  assert.deepEqual(enemyWeaknessExtra('99999'), {})

  assert.deepEqual(blanksTraits('02088'), ['ally'])
  assert.deepEqual(blanksTraits('01008'), [])

  assert.equal(hasExplicitReactionPrompt('01071'), true)
  assert.equal(hasExplicitReactionPrompt('01001'), false)

  assert.equal(isPoisonThreat('04102'), true)
  assert.equal(poisonThreatCode(), '04102')

  assert.equal(agendaHandSizePenalty('02043'), 3)
  assert.equal(agendaHandSizePenalty('03044'), 0)
})

nodeTest('5a 卡号级规则数据：表是冻结的，避免运行期被改', () => {
  assert.equal(Object.isFrozen(ENEMY_WEAKNESS_EXTRA), true)
  assert.equal(Object.isFrozen(BLANKS_TRAITS), true)
  assert.equal(Object.isFrozen(EXPLICIT_REACTION_PROMPT), true)
  assert.equal(Object.isFrozen(AGENDA_HAND_SIZE_PENALTY), true)
})
