import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import {
  actPlacesLocationForEmptySpawn, agendaHandSizePenalty, blanksTraits, counterTreacheryCode,
  enemyRuleFlags, enemyWeaknessExtra, hasExplicitReactionPrompt, investigateExtraActionsFor,
  isPoisonThreat, isTextBlankEnemy, locationCounterTreacheries, pallidMaskCode, poisonThreatCode,
  relocateDestinationCode, relicDiscountLocation, weaknessUpgradeCode,
} from '../src/cards/card-rules.js'

// Phase 5（5a）/ Phase 3（第 3 批）：卡号级规则的读点必须仍然可用，但数据已经搬进卡条目。
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

  assert.equal(investigateExtraActionsFor('02050'), 1)
  assert.equal(investigateExtraActionsFor('01001'), 0)

  assert.equal(enemyRuleFlags('02255').damageOnlyFrom, '02254')
  assert.equal(enemyRuleFlags('02255').healthPerPlayerBonus, 1)
  assert.equal(enemyRuleFlags('01172').doubleNegative, true)
  assert.equal(enemyRuleFlags('huntingNightgaunt').doubleNegative, true)

  assert.deepEqual(locationCounterTreacheries({ arcaneBarriers: 2, sordidAndSilent: 1 }), ['02102', '02102', '02089'])
  assert.equal(counterTreacheryCode('arcaneBarriers'), '02102')
  assert.equal(counterTreacheryCode('sordidAndSilent'), '02089')
  assert.equal(counterTreacheryCode('nonexistent'), null)

  assert.equal(weaknessUpgradeCode('priceOfFailure'), '04038')
  assert.equal(weaknessUpgradeCode('impendingDoom'), '04041')
  assert.equal(weaknessUpgradeCode('cursedFate'), '04042')
  assert.equal(weaknessUpgradeCode('nonexistent'), null)

  assert.equal(actPlacesLocationForEmptySpawn('04318'), true)
  assert.equal(pallidMaskCode(), '03059')
  assert.equal(relicDiscountLocation('04142'), true)
  assert.equal(relocateDestinationCode(), '02320')
})
