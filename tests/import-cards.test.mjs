import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { CARD_TYPES, ROOT, buildImport, mergeCatalog, renderArtifacts, localeFields, cardReferences } from '../tools/import-cards.mjs'
import { ALL_CARDS, CARDS_BY_TYPE, META } from '../src/cards/cards-data.js'
import { getCatalogCard, queryCatalog } from '../src/cards/card-catalog.js'
import { createGameState, allCardDefs, legalMoves, validateMove, applyMove } from '../src/engine/engine.js'

const row = (code, extra = {}) => ({ code, name: 'Card', type_code: 'asset', pack_code: 'test', faction_code: 'neutral', ...extra })

test('保留编号、完整构筑限制与嵌套关联面，重复源编号失败', () => {
  const a = row('00001a', { deck_options: [{ trait: ['Item'], limit: 2, faction: ['guardian'], level: { min: 0, max: 2 } }], linked_to_code: '00001b', linked_card: row('00001b') })
  const result = mergeCatalog({ en: [a, row('00001b')] })
  assert.deepEqual(result.cards['00001a'].deckOptions[0].trait, ['Item'])
  assert.equal(result.provenance['00001a'].fields['linked_card.code'], 'en')
  assert.equal(result.quarantined.length, 0)
  assert.throws(() => mergeCatalog({ en: [a, a] }), /重复/)
  assert.throws(() => mergeCatalog({ en: [{ ...a, code: 1 }] }), /非法/)
})

test('未知类型、断裂外键、当前语言结构冲突显式隔离', () => {
  const result = mergeCatalog({ en: [row('x', { type_code: 'unknown' }), row('y', { linked_to_code: 'absent' }), row('z', { health: 2 })], 'zh-cn': [row('z', { health: 3, name: '中文名称' })] })
  assert.equal(result.quarantined.length, 3)
  assert.ok(Object.values(result.cards).every(card => card.availability === 'catalog-only' && card.dataStatus === 'quarantined'))
  assert.equal(result.cards.z.health, 2)
  assert.throws(() => mergeCatalog({ en: [row('x', { name: '' })] }), /必需字段/)
})

test('按编号中文合并，不用同名代替；繁中与英文回退明确标记', () => {
  const en = row('a', { text: 'Text', back_text: 'Back', subname: 'Subtitle' })
  const locale = localeFields(en, { name: '名称', text: 'Text' }, { back_text: '背面規則' })
  assert.equal(locale.status, 'partial')
  assert.equal(locale.fields.name.status, 'translated')
  assert.equal(locale.fields.text.status, 'english-fallback')
  assert.equal(locale.fields.back_text.status, 'traditional-fallback')
  assert.equal(locale.fields.flavor.status, 'not-applicable')
  const result = mergeCatalog({ en: [row('a'), row('b')], 'zh-cn': [row('a', { name: '名称' })] })
  assert.equal(result.cards.b.nameZh, 'Card')
  assert.equal(result.cards.b.localeStatus, 'fallback')
})

test('关联面编号或类型矛盾必须隔离，即使引用编号存在', () => {
  const result = mergeCatalog({ en: [row('a', { linked_to_code: 'b', linked_card: row('c') }), row('b', { linked_card: row('c', { type_code: 'enemy' }) }), row('c')] })
  assert.ok(result.provenance.a.isolationReasons.includes('linked-card-code-mismatch'))
  assert.ok(result.provenance.b.isolationReasons.includes('linked-card-type-mismatch'))
})

test('外键包括签名替代、重印、平行版本、绑定和内嵌面', () => {
  const refs = cardReferences(row('a', { deck_requirements: { card: { b: { c: 'c' } } }, duplicated_by: ['d'], alternate_of_code: 'e', bonded_cards: [{ code: 'f' }], linked_card: row('g', { linked_to_code: 'h' }) }))
  assert.deepEqual([...new Set(refs.map(ref => ref.code))].sort(), ['b', 'c', 'd', 'e', 'f', 'g', 'h'])
})

test('全量目录与原始记录可追溯，13 类、兼容编号及正反面可查', () => {
  assert.equal(Object.keys(ALL_CARDS).length, 5930)
  assert.equal(META.total, 5930)
  assert.deepEqual(Object.keys(CARDS_BY_TYPE).sort(), [...CARD_TYPES].sort())
  assert.ok(Object.values(CARDS_BY_TYPE).every(cards => Object.keys(cards).length > 0))
  const inv = getCatalogCard('01001')
  assert.deepEqual(inv.deckRequirements.card, inv.raw.en.deck_requirements.card)
  assert.equal(inv.provenance.fields['deck_requirements.card.01006.90030'], 'en')
  assert.equal(getCatalogCard('60336').provenance.canonicalSource, 'legacy')
  assert.equal(ALL_CARDS['60336'].dataStatus, 'compatibility')
  assert.ok(ALL_CARDS['01104'].backText && ALL_CARDS['01104'].backTextZh && ALL_CARDS['01104'].backimagesrc)
  assert.equal(ALL_CARDS['01121a'].linkedCardCode, '01121b')
  assert.equal(getCatalogCard('__proto__'), null)
  assert.equal(queryCatalog({ query: '09001' }).cards[0].code, '09001')
  assert.equal(queryCatalog({ type: '__proto__' }).total, 0)
  assert.throws(() => queryCatalog({ limit: 0 }), RangeError)
  inv.raw.en.name = 'mutated'
  assert.notEqual(getCatalogCard('01001').raw.en.name, 'mutated')
})

test('N1 输出稳定且逐项关闭差集，不覆盖 N0 冻结报告', () => {
  const frozenPath = resolve(ROOT, 'games/arkhamhorror/audit/resource-report.json')
  const before = readFileSync(frozenPath, 'utf8')
  const result = buildImport()
  assert.equal(result.report.summary.total, 5930)
  assert.equal(result.report.summary.importedNewCodes, 5115)
  assert.equal(result.report.summary.structuralConflicts, 169)
  assert.equal(result.report.summary.fieldPresenceDifferences, 6847)
  assert.equal(result.report.quarantined.length, 0)
  assert.deepEqual(result.report.coverage.missing, [])
  assert.deepEqual(result.report.coverage.compatibilityCodes, ['60336'])
  assert.ok(result.report.conflicts.every(conflict => conflict.status === 'baseline-selected' && !conflict.rulesVerified))
  assert.equal(result.report.baseline.targetCodes, 815)
  assert.equal(result.report.baseline.missingTargetCodes, 5115)
  const artifacts = renderArtifacts(result)
  const second = renderArtifacts(result)
  for (const [file, content] of Object.entries(artifacts)) {
    assert.equal(content, second[file])
    assert.equal(readFileSync(resolve(ROOT, 'games/arkhamhorror', file), 'utf8'), content, file)
  }
  assert.equal(readFileSync(frozenPath, 'utf8'), before)
})

test('服务端拒绝目录中未开放调查员和伪造牌组', () => {
  const players = [{ seat: 0, name: 'Player' }]
  for (const code of ['09001', '10001', 'unknown', '__proto__']) assert.throws(() => createGameState({ playerInvestigator: code }, players), /调查员/)
  assert.throws(() => createGameState({ playerInvestigator: '01001', playerDeck: ['09001'] }, players), /卡组/)
  assert.throws(() => createGameState({ playerInvestigator: '01001', playerDeck: 'invalid' }, players), /卡组/)
})

test('意外进入手牌的目录卡不能成为合法动作，拒绝时状态不变', () => {
  const state = createGameState({ playerInvestigator: '01001' }, [{ seat: 0, name: 'Player' }])
  let answers = 0
  while (state.pendingChoice) {
    assert.ok(answers++ < 10)
    const keep = legalMoves(state).find(move => ['keep', 'done', 'confirm'].includes(move.optionId))
    assert.ok(keep, '先明确保留起始手牌，再验证非法卡')
    applyMove(state, state.pendingChoice.seat, keep)
  }
  state.investigators[0].hand.push('02001', '09001')
  state.investigators[0].resources = 99
  const before = JSON.stringify(state)
  for (const code of ['02001', '09001']) {
    assert.match(validateMove(state, 0, { action: 'play', cardId: code }), /未获运行时许可/)
    assert.ok(!legalMoves(state).some(move => move.action === 'play' && move.cardId === code))
  }
  assert.equal(JSON.stringify(state), before)
})

test('Core、敦威治与卡尔克萨调查员和 1–4 人开局正常，状态只携带本局卡牌定义', () => {
  for (const code of ['01001', '01002', '01003', '01004', '01005', '02001', '02002', '02003', '02004', '02005',
    '03001', '03002', '03003', '03004', '03005', '03006']) {
    for (const count of [1, 2, 3, 4]) {
      const state = createGameState({ playerInvestigator: code }, Array.from({ length: count }, (_, seat) => ({ seat, name: `P${seat}` })))
      assert.equal(state.investigators[0].code, code)
      assert.equal(state.investigators.length, count)
      assert.equal(new Set(state.investigators.map(inv => inv.code)).size, count)
      assert.equal(state.resourceVersion, META.resourceVersion)
      assert.equal(state.rulesMode, 'simplified')
      assert.ok(Object.keys(state.cards).length <= 253)
      assert.equal(Object.keys(state.investigatorDefs).length, 16)
      assert.equal(state.cards['09001'], undefined)
      assert.ok(!JSON.stringify(state).includes('canonicalSource'))
      for (const inv of state.investigators) {
        assert.equal(inv.hand.length, inv.code === '03003' ? 13 : 5)
        assert.ok([...inv.deck, ...inv.hand].every(card => state.cards[card]))
      }
      assert.ok(legalMoves(state).length)
      assert.ok(JSON.stringify(state).length < 500000)
    }
  }
  assert.ok(allCardDefs()['01117'].originalCode === '01117')
})

test('只读导入校验与未知 CLI 参数具有可靠退出状态', () => {
  const entry = resolve(ROOT, 'games/arkhamhorror/tools/import-cards.mjs')
  const flags = process.allowedNodeEnvironmentFlags.has('--permission') ? ['--permission', '--allow-fs-read=*'] : []
  const checked = spawnSync(process.execPath, [...flags, entry, '--check'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 })
  assert.equal(checked.status, 0, checked.stderr)
  assert.equal(JSON.parse(checked.stdout).mode, 'check')
  const invalid = spawnSync(process.execPath, [entry, '--unknown'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(invalid.status, 1)
})
