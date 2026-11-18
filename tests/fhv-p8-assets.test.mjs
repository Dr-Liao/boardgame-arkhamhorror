// 九循环《铁杉谷盛宴》P8 素材/图片库存与远程回退、展示数据审计。
//
// 覆盖：
//   · audit/fhv-assets.json 由 buildFhvAssets() 逐字节复算，CLI `--check` 退出码 0，status=verified；
//   · 441 条记录（fhvCampaign 301 + fhvInvestigators 20 + fhvPlayer 120）全部可解析，主面全部本地可展示；
//   · 未解析卡号与中文缺面只能以 disclosed 显式披露，不得静默通过；
//   · 运行时独立性：src/content/web/presentation 对「参考资源」目录的真实读取为 0（注释与溯源字符串不误报）；
//   · 本地库存与 SHA-256 基线一致；展示解析全 5930 张、FHV 441 张的映射来源复算无漂移。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildFhvAssets, maskComments, scanReferenceDependencies } from '../tools/audit-fhv-assets.mjs'
import { partitions } from '../content/campaigns/theFeastOfHemlockVale/shared.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = 'audit/fhv-assets.json'
const readText = relative => readFileSync(join(MOD, relative), 'utf8').replace(/^\uFEFF/, '')
const readJson = relative => JSON.parse(readText(relative))
const json = value => JSON.stringify(value, null, 2) + '\n'
const ledger = readJson(LEDGER)
const GATE_NAMES = ['imagesResolved', 'localInventoryStable', 'mediaComplete', 'presentationClean', 'runtimeIndependent']

test('P8 素材账本：status=verified、门禁全真且可逐字节复算', () => {
  assert.equal(ledger.generatedBy, 'tools/audit-fhv-assets.mjs')
  assert.equal(ledger.cycle, 'fhv')
  assert.equal(ledger.campaignId, 'theFeastOfHemlockVale')
  assert.equal(ledger.milestone, 'P8')
  assert.equal(ledger.status, 'verified')
  assert.deepEqual(Object.keys(ledger.gates).sort(), GATE_NAMES)
  const failed = Object.entries(ledger.gates).filter(([, value]) => value !== true).map(([key]) => key)
  assert.deepEqual(failed, [], `素材审计门禁失败：${failed.join('、')}`)
  // --check 口径：复算内容与账本逐字节一致（账本漂移必须先显式 --write）。
  assert.equal(json(buildFhvAssets()), readText(LEDGER),
    'audit/fhv-assets.json 必须由 buildFhvAssets() 逐字节复算（--check 口径）')
  for (const source of ledger.sources) {
    assert.match(String(source.sha256), /^[0-9a-f]{64}$/, `${source.path} 缺少 SHA-256`)
  }
})

test('P8 图片账：441 条记录（301+20+120）全部可解析、主面全部本地可展示', () => {
  assert.deepEqual(ledger.scope.partitions, {
    fhvCampaign: partitions.fhvCampaign.length,
    fhvInvestigators: partitions.fhvInvestigators.length,
    fhvPlayer: partitions.fhvPlayer.length,
  })
  assert.deepEqual(ledger.scope.partitions, { fhvCampaign: 301, fhvInvestigators: 20, fhvPlayer: 120 })
  assert.equal(ledger.scope.records, 441)
  assert.equal(ledger.scope.scopeMatches, true)
  assert.deepEqual(ledger.scope.catalogMissing, [])
  assert.equal(ledger.images.total, 441)
  assert.equal(ledger.images.resolved, 441)
  assert.equal(ledger.images.local, 441)
  assert.equal(ledger.images.remote, 0)
  assert.equal(ledger.images.localized, 440)
  assert.deepEqual(ledger.images.unresolved, [])
  assert.equal(new Set(ledger.images.cards.map(row => row.code)).size, 441)
  for (const row of ledger.images.cards) {
    assert.equal(row.resolved, true, `${row.code} 没有展示描述符`)
    assert.equal(row.local, true, `${row.code} 没有本地可展示的正面图`)
    assert.equal(row.remote, false, `${row.code} 的首选面只能走远程`)
  }
  // 双面/背面同样本地完整；末位兜底候选可以缺（disclosed 里登记），但首选面不许缺。
  assert.deepEqual(ledger.images.faces.primaryNotLocal, [])
  assert.deepEqual(ledger.images.faces.remoteOnlyFaces, [])
  assert.deepEqual(ledger.images.faces.localizedMissingOnDisk, [])
  assert.equal(ledger.images.faces.frontFaces, 441)
  assert.equal(ledger.images.faces.backFaces, 441)
  assert.equal(ledger.images.faces.backArt + ledger.images.faces.genericBack, 441)
  assert.ok(ledger.images.required.localFiles > 0)
  assert.ok(ledger.images.required.localizedFiles > 0)
})

test('P8 未解析与缺图：disclosed 逐条登记，不得掩盖', () => {
  const disclosed = ledger.disclosed
  assert.ok(disclosed.length > 0, 'disclosed 不能为空：已知缺口必须显式登记')
  for (const code of ledger.images.unresolved) {
    assert.ok(disclosed.some(entry => entry.kind === 'card-image-unresolved' && entry.code === code),
      `${code} 未解析却没有披露`)
  }
  const localizedMissing = ledger.images.cards.filter(row => row.resolved && !row.localized).map(row => row.code)
  const disclosedLocalized = disclosed.find(entry => entry.kind === 'localized-front-missing')
  assert.deepEqual(disclosedLocalized?.codes ?? [], localizedMissing,
    '正面无中文图的记录必须与 disclosed 一一对应')
  assert.ok(disclosed.some(entry => entry.kind === 'zh-sha-baseline-absent'),
    '中文图不在 SHA-256 基线内的事实必须披露')
  const optional = disclosed.find(entry => entry.kind === 'optional-remote-candidate')
  assert.equal(optional?.count ?? 0, ledger.images.faces.optionalRemoteCandidates.count,
    '兜底候选数量必须与 disclosed 一致')
  assert.ok(disclosed.some(entry => entry.kind === 'presentation-report-stale'))
})

test('P8 运行时独立性：src/content/web/presentation 不读「参考资源」', () => {
  assert.deepEqual(ledger.runtimeReferenceHits, [])
  assert.deepEqual(ledger.runtimeReferenceScan.roots, ['src', 'content', 'web', 'presentation'])
  // 扫描器自证：注释与纯溯源字符串不算，真实 import／fs 读取／路径构造才算。
  const sample = [
    '// 参考资源/ArkhamHorror-main 只读溯源，注释不算命中',
    "/* import cards from '../../../参考资源/ArkhamHorror-main/frontend/public/cards_en.json' */",
    "  source: '参考资源/ArkhamHorror-main/frontend/public/cards_en.json',",
    "import cards from '../../../参考资源/ArkhamHorror-main/frontend/public/cards_en.json'",
    "const rows = JSON.parse(readFileSync(new URL('../../../参考资源/ArkhamHorror-main/frontend/public/cards_en.json', import.meta.url), 'utf8'))",
    "const referenceRoot = join(HALL, '参考资源/ArkhamHorror-main')",
    "const data = readFileSync(join(referenceRoot, 'frontend/public/cards_en.json'))",
    "const rows2 = JSON.parse(readFileSync(join(scope.referenceRoot, 'frontend/public/cards_en.json')))",
  ].join('\n')
  const hits = scanReferenceDependencies(sample, 'src/sample.js')
  assert.deepEqual(hits.map(hit => [hit.line, hit.kind]), [
    [4, 'module-import'],
    [5, 'fs-read'],
    [6, 'path-construction'],
    [7, 'fs-read'],
    [8, 'fs-read'],
  ])
  assert.equal(hits.every(hit => hit.path === 'src/sample.js'), true)
  assert.equal(maskComments('// 参考资源\n').includes('参考资源'), false)
  assert.equal(maskComments("const source = '参考资源'\n").includes('参考资源'), true)
})

test('P8 本地库存与展示数据：SHA-256 一致、映射来源无漂移、展示解析全覆盖', () => {
  const inventory = ledger.localImagesLedger
  assert.equal(inventory.inventory.present, true)
  assert.match(String(inventory.inventory.sha256), /^[0-9a-f]{64}$/)
  assert.match(String(inventory.inventory.fingerprint), /^[0-9a-f]{64}$/)
  assert.equal(inventory.digests.present, true)
  assert.deepEqual(inventory.missingOnDisk, [])
  assert.deepEqual(inventory.missingFromInventory, [])
  assert.deepEqual(inventory.missingDigest, [])
  assert.deepEqual(inventory.digestMismatch, [])
  assert.deepEqual(inventory.byteMismatch, [])
  assert.deepEqual(inventory.localizedMissingOnDisk, [])
  assert.ok(inventory.checked.sha256Verified >= inventory.checked.localFiles,
    'SHA-256 校验必须覆盖全部需要的英文面（含 FHV 库存里的替代面）')
  assert.ok(inventory.inventory.fhvEntries.total >= inventory.checked.localFiles)

  const presentation = ledger.presentation
  assert.equal(presentation.pass, true)
  assert.deepEqual(presentation.resolution.unresolved, 0)
  assert.equal(presentation.resolution.resolved, presentation.resolution.catalogCards)
  assert.equal(presentation.fhv.cards, 441)
  assert.equal(presentation.fhv.resolved, 441)
  assert.equal(presentation.fhv.localizedFilesOnDisk, presentation.fhv.localized)
  assert.equal(presentation.mapping.available, true)
  assert.deepEqual(presentation.mapping.drift, [])
  assert.equal(presentation.mapping.localizedArts.sourceMatches, true)
  assert.equal(presentation.mapping.localizedArts.artsMatch, true)
  assert.equal(presentation.mapping.remoteManifest.sourceMatches, true)
  assert.equal(presentation.browserSuite.status, 'not-run')
})

test('CLI：node tools/audit-fhv-assets.mjs --check 逐字节复算并返回 0', () => {
  const result = spawnSync(process.execPath, ['tools/audit-fhv-assets.mjs', '--check'], {
    cwd: MOD,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  assert.equal(result.status, 0, `--check 失败：${result.stderr || result.stdout}`)
  const summary = JSON.parse(result.stdout)
  assert.equal(summary.mode, 'check')
  assert.equal(summary.status, 'verified')
  assert.deepEqual(summary.gates, Object.fromEntries(GATE_NAMES.map(name => [name, true])))
  assert.equal(summary.images.total, 441)
  assert.deepEqual(summary.presentation.drift, [])
})
