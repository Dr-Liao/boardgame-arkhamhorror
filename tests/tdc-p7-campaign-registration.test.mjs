// 《沉没之城》（The Drowned City）· P7 战役注册验收。
//
// 只读验收：组合根 content/registered.js、战役/章节清单、audit/tdc-scope.json、
// content/scenario-guide-sources/*.json、web/scenario-guides/*.json。
// 口径来源：artifacts/migration/tdc/p7/CONTRACT.md §6、tools/tdc-p7-readiness.mjs。
//
// 运行：node --test tests/tdc-p7-campaign-registration.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { inspectChapter, inspectFlow } from '../tools/tdc-p7-readiness.mjs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const campaignId = 'theDrownedCity'
const scope = JSON.parse(readFileSync(join(projectRoot, 'audit', 'tdc-scope.json'), 'utf8'))
const scopeScenarioIds = scope.scenarios.map(chapter => chapter.id)
const scopeReferenceCode = Object.fromEntries(scope.scenarios.map(chapter => [chapter.id, chapter.code]))

const campaign = contentRegistry.getCampaign(campaignId)
const scenarios = contentRegistry.listScenarios(campaignId)
const scenariosById = new Map(scenarios.map(manifest => [manifest.id, manifest]))

// 与 tools/tdc-p7-readiness.mjs#inspectChapter 的 readOptional(path) 同口径：
// 路径相对项目根；缺文件返回 null（不吞掉其他读取错误）。
const readOptional = path => {
  try {
    return readFileSync(join(projectRoot, path), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

// 混乱标记统一按小写比较：scope 用 `elderThing`/`autoFail`/`elderSign`，
// 引擎/战役清单用 `elderthing`/`autofail`/`eldersign`（见 shared.js 注释）。
const normalizeBag = tokens => tokens.map(token => String(token).toLowerCase()).sort()

// snake_case 遭遇组 → camelCase 组 id（与内容层 encounterGroupId 同口径）。
const encounterGroupId = group => String(group || '')
  .replace(/_([a-z0-9])/g, (_, character) => character.toUpperCase())

// CONTRACT §6：每章 requiredEncounterGroupIds = 专属组 + 实际抽取的共享组；其中
// `external: true` 的组是从其他战役/核心包复用的（core 的 chillingCold 等、notz 的 arkham），
// 不属于 tdcCampaign 包自己的 tdcc 卡号集合。tdcCampaign 包的 encounterGroupIds 由 tdcc 卡
// 的 encounterCode 派生，并由 tests/tdc-p7-readiness.test.mjs 逐组钉死，因此**不能**把外部组
// 塞进该包；覆盖 10 章并集的正确口径是「外部组由 campaign 的其他 requiredPackIds 兜底」。
const externalGroupIds = new Set(scope.scenarios.flatMap(chapter =>
  (chapter.gather || []).filter(entry => entry.external).map(entry => encounterGroupId(entry.group))))

test('P7 战役 theDrownedCity 以 development 注册 10 章与四档混乱袋', () => {
  assert.ok(campaign, 'contentRegistry.getCampaign("theDrownedCity") 必须存在')
  assert.equal(campaign.id, campaignId)
  assert.equal(campaign.status, 'development')

  assert.equal(campaign.scenarioIds.length, 10)
  assert.deepEqual([...campaign.scenarioIds].sort(), [...scopeScenarioIds].sort(),
    'manifest.scenarioIds 必须与 audit/tdc-scope.json 的 10 个剧本一致')

  assert.ok(campaign.requiredPackIds.includes('core'), 'requiredPackIds 必须含 core')
  assert.ok(campaign.requiredPackIds.includes('tdcCampaign'), 'requiredPackIds 必须含 tdcCampaign')

  assert.ok(scope.initialBags, 'audit/tdc-scope.json 必须提供 initialBags 作为混乱袋事实源')
  const expectedTiers = Object.keys(scope.initialBags).sort()
  assert.deepEqual(Object.keys(campaign.chaosBags).sort(), expectedTiers,
    'chaosBags 的难度档必须与 scope.initialBags 一致（easy/standard/hard/expert）')
  for (const tier of expectedTiers) {
    const bag = campaign.chaosBags[tier]
    assert.ok(Array.isArray(bag) && bag.length > 0, `chaosBags.${tier} 必须是非空数组`)
    assert.deepEqual(normalizeBag(bag), normalizeBag(scope.initialBags[tier]),
      `chaosBags.${tier} 必须逐枚镜像 scope.initialBags.${tier}`)
  }
})

test('P7 十章清单：身份、状态、参考卡号与遭遇闭包齐备', () => {
  assert.equal(scenarios.length, 10, 'listScenarios("theDrownedCity") 必须返回 10 章')
  assert.deepEqual(scenarios.map(manifest => manifest.id).sort(), [...scopeScenarioIds].sort())

  for (const manifest of scenarios) {
    assert.equal(manifest.status, 'development', `${manifest.id} 必须是 development（不得提前 verified）`)
    assert.equal(manifest.campaignId, campaignId, `${manifest.id}.campaignId 必须是 theDrownedCity`)
    assert.equal(manifest.referenceCode, scopeReferenceCode[manifest.id],
      `${manifest.id}.referenceCode 必须等于 scope 的剧本参考卡号`)
    assert.ok(Array.isArray(manifest.behaviorIds) && manifest.behaviorIds.length > 0,
      `${manifest.id}.behaviorIds 必须非空`)
    assert.ok(Array.isArray(manifest.requiredEncounterGroupIds) && manifest.requiredEncounterGroupIds.length > 0,
      `${manifest.id}.requiredEncounterGroupIds 必须非空`)
  }

  // CONTRACT §6 的终章卡号（Part II 用 11688a，不是 11688）。
  assert.equal(scenariosById.get('theDoomOfArkhamPartII')?.referenceCode, '11688a')
  assert.equal(scopeReferenceCode.theDoomOfArkhamPartII, '11688a')
})

test('P7 十章 definition 已注册且双语指南 ready、guide 文件存在', () => {
  for (const chapterId of scopeScenarioIds) {
    const manifest = scenariosById.get(chapterId)
    assert.ok(manifest, `缺少已注册章节 ${chapterId}`)
    const readiness = inspectChapter(
      { id: chapterId, code: scopeReferenceCode[chapterId] },
      campaignId,
      contentRegistry.getScenario(chapterId),
      readOptional,
    )
    assert.deepEqual(readiness, {
      definition: 'registered',
      guideStatus: 'ready',
      guide: `web/scenario-guides/${chapterId}.json`,
    }, `${chapterId} 必须 definition=registered / guideStatus=ready`)
    assert.ok(existsSync(join(projectRoot, readiness.guide)),
      `${chapterId} 的 guide 生成物必须存在：${readiness.guide}`)
  }
})

test('P7 战役图显式覆盖 10 章且终点可达', () => {
  assert.ok(campaign.flow, '战役 manifest 必须带显式 flow')
  const flow = inspectFlow(campaign, campaign.scenarioIds)
  assert.equal(flow.explicit, true)
  assert.equal(flow.terminalReachable, true)
  assert.deepEqual(flow.missingChapters, [])
  assert.equal(flow.reachableChapters.length, 10)
  assert.deepEqual([...flow.reachableChapters].sort(), [...scopeScenarioIds].sort())
})

test('P7 战役记录键与流程场景节点闭合于 chapterIds 和 recordSchema', () => {
  const campaignNow = contentRegistry.getCampaign(campaignId)
  const recordKeys = new Set()
  for (const manifest of scenarios) {
    for (const key of [...manifest.recordReads, ...manifest.recordWrites]) recordKeys.add(key)
  }
  const undeclared = [...recordKeys].filter(key => !Object.hasOwn(campaignNow.recordSchema, key))
  assert.deepEqual(undeclared, [], '10 章 recordReads/recordWrites 并集必须全部在 campaign.recordSchema 声明')

  const declared = new Set(campaignNow.scenarioIds)
  const scenarioNodes = Object.entries(campaignNow.flow.nodes)
    .filter(([, node]) => node.type === 'scenario')
  assert.ok(scenarioNodes.length > 0, 'flow 必须包含场景节点')
  const outside = scenarioNodes
    .filter(([, node]) => !declared.has(node.scenarioId))
    .map(([nodeId, node]) => `${nodeId}:${node.scenarioId}`)
  assert.deepEqual(outside, [], 'flow 的每个场景节点 scenarioId 都必须属于 manifest.scenarioIds')
})

test('P7 tdcCampaign 包：development、目录身份、行为与遭遇组覆盖 10 章', () => {
  const campaignNow = contentRegistry.getCampaign(campaignId)
  const pack = contentRegistry.getPack('tdcCampaign')
  assert.ok(pack, 'contentRegistry.getPack("tdcCampaign") 必须存在')
  assert.equal(pack.status, 'development')
  assert.ok(Array.isArray(pack.behaviorIds) && pack.behaviorIds.length > 0, 'pack.behaviorIds 必须非空')
  assert.ok(pack.cards.length > 0, 'pack.cards 必须非空')
  const offenders = pack.cards
    .filter(card => !card.cataloged || card.rulesImplemented || card.deckbuilding)
    .map(card => card.code)
  assert.deepEqual(offenders, [], '卡牌必须全部 cataloged 且 !rulesImplemented && !deckbuilding')

  const requiredGroups = new Set()
  for (const manifest of scenarios) {
    for (const groupId of manifest.requiredEncounterGroupIds) requiredGroups.add(groupId)
  }
  assert.ok(requiredGroups.size > 0, '10 章必须声明遭遇组')

  // 本包自有组（tdcc 卡号派生的专属组 + 战役共享组）必须全部在 pack.encounterGroupIds。
  const ownedGroups = [...requiredGroups].filter(groupId => !externalGroupIds.has(groupId))
  assert.deepEqual(ownedGroups.filter(groupId => !pack.encounterGroupIds.includes(groupId)), [],
    'pack.encounterGroupIds 必须覆盖 10 章 requiredEncounterGroupIds 中的 TDC 自有组')

  // 外部复用组不得冒充本包组；它们必须由 campaign 的其他 requiredPackIds 兜底，
  // 这样 10 章的遭遇组并集在注册期仍然闭合（与 content/schema.js 的注册期校验同口径）。
  assert.deepEqual([...externalGroupIds].filter(groupId => pack.encounterGroupIds.includes(groupId)), [],
    'pack 不得把其他卡包的外部组列成自己的组')
  const siblingGroupIds = campaignNow.requiredPackIds
    .filter(packId => packId !== 'tdcCampaign')
    .map(packId => contentRegistry.getPack(packId)?.encounterGroupIds || [])
  assert.deepEqual([...externalGroupIds].filter(groupId => !siblingGroupIds.some(ids => ids.includes(groupId))), [],
    '外部复用组必须由战役的其他 requiredPackIds（core/notz）提供')
})
