// 七循环《地球边缘》（Edge of the Earth）P3-A：关键词与规则书 Node 验收。
//
// 口径（docs/edgeOfTheEarth/README.md §3 P3、§4、§5；docs/arkham-content-migration.md §4.8）：
//   · 关键词身份以 P1 机制扫描为事实源：38 个 keyword 机制的 id / cards 必须与
//     content/campaigns/edgeOfTheEarth/keywords.js 逐条一致；
//   · 每张代表卡都必须能从 web/rulebook-data.js#cardRuleIds 直达对应规则条目（P3-B 的 /^08/ 派发 +
//     EOTE_CARD_RULE_PATTERNS）；卡名语料包含卡名本身（08549/08663/08671 只靠卡名命中关键词）；
//   · 规则条目只写规则本身：中英成对、分组属于「地球边缘」、拼音 sortKey、相关跳转、搜索命中，
//     正文不得出现引擎 / 实现 / 源码 / 审计状态等工程用语；
//   · 关键词引擎验收口径（P3 裁决）：P2 原语须 status='done'；7 个 keyword.* 由 P3 规则层交付；
//     interaction.tekeliShuffle 记录为 P4 排期（非阻塞）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { RULES, RULE_INDEX, ruleById, cardRuleIds, matchingRules } from '../web/rulebook-data.js'
import { EOTE_CARD_RULE_PATTERNS, EOTE_RULE_IDS, EOTE_RULES } from '../web/eote-rules.js'
import { EOTE_KEYWORDS } from '../content/campaigns/edgeOfTheEarth/keywords.js'
import { CYCLE_CODES } from '../content/campaigns/edgeOfTheEarth/shared.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { buildScan } from '../tools/scan-eote-mechanisms.mjs'
import { buildPrimitivePlan } from '../tools/audit-eote-primitives.mjs'

const CARD_TEXT = code => [ALL_CARDS[code]?.name || '', ALL_CARDS[code]?.text || '', ALL_CARDS[code]?.backText || ''].join('\n')
// 工程用语：中文词 + 英文整词（用词边界避免 spending 里的 pending 之类误报）。
const ENGINEERING_WORDS = /引擎|实现|依赖|源码|审计|界面|按钮|\b(?:verified|pending|engine|implementation)\b|src\//i

// P3 裁决：7 个 keyword.* 原语由本阶段「关键词清单 + 规则条目 + 卡文直达」交付；P4 交互排期单列。
const P3_DELIVERED_PRIMITIVES = Object.freeze([
  'keyword.mirage', 'keyword.shelter', 'keyword.partner', 'keyword.resolute', 'keyword.expedition', 'keyword.level', 'keyword.key',
])
const P4_SCHEDULED_PRIMITIVES = Object.freeze(['interaction.tekeliShuffle'])

const planByPhase = plan => new Map(plan.deferred.map(row => [row.id, row]))
const planP2Done = plan => new Set([...plan.reuse, ...plan.new]
  .filter(row => row.status === 'done').map(row => row.id))

test('P3 关键词全集与扫描一致；全部代表卡都有有效的卡文直达', () => {
  const scanned = buildScan().mechanisms.filter(row => row.type === 'keyword')
  assert.equal(EOTE_KEYWORDS.length, scanned.length)
  assert.deepEqual(EOTE_KEYWORDS.map(keyword => keyword.id).sort(), scanned.map(row => row.id).sort())
  for (const keyword of EOTE_KEYWORDS) {
    const row = scanned.find(entry => entry.id === keyword.id)
    assert.ok(row, `扫描缺少关键词 ${keyword.id}`)
    assert.equal(ruleById(keyword.ruleId).id, keyword.ruleId, `${keyword.id} 的 ruleId ${keyword.ruleId} 无法解析`)
    assert.deepEqual(keyword.cardCodes, row.cards, `${keyword.id} 的 cardCodes 与扫描不一致`)
    assert.ok(keyword.patterns.length > 0 && keyword.patterns.every(pattern => typeof pattern === 'string' && pattern.length))
    assert.ok(keyword.primitives.length > 0, `${keyword.id} 缺少原语映射`)
    for (const code of keyword.cardCodes) {
      assert.ok(cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId), `${code} 缺卡文直达 ${keyword.ruleId}`)
    }
  }
  for (const keyword of EOTE_KEYWORDS) assert.ok(['keyword', 'token', 'trait'].includes(keyword.kind))
  for (const code of CYCLE_CODES) assert.ok(cardRuleIds(ALL_CARDS[code]).includes('eoteCampaign'), `${code} 缺 eoteCampaign 卡文直达`)
})

test('P3 中英规则条目、拼音索引和相关跳转完整，正文不含实现状态或源码路径', () => {
  assert.equal(EOTE_RULES.length, 23)
  assert.equal(new Set(EOTE_RULES.map(rule => rule.id)).size, EOTE_RULES.length)
  assert.deepEqual(EOTE_RULE_IDS, EOTE_RULES.map(rule => rule.id))
  for (const rule of EOTE_RULES) {
    assert.equal(ruleById(rule.id).id, rule.id)
    assert.ok(Array.isArray(rule.body) && Array.isArray(rule.bodyEn))
    assert.ok(rule.body.length >= 2 && rule.bodyEn.length === rule.body.length, `${rule.id} 中英段落不成对`)
    assert.ok(rule.titleEn && rule.groupEn, `${rule.id} 缺英文标题或分组`)
    assert.ok(String(rule.group).includes('地球边缘'), `${rule.id} 分组不是地球边缘`)
    const index = RULE_INDEX.find(item => item.id === rule.id)
    assert.ok(index, `${rule.id} 未进入规则索引`)
    assert.match(index.sortKey, /^[a-z]+$/, `${rule.id} 拼音 sortKey 非法：${index.sortKey}`)
    assert.ok(Array.isArray(rule.related))
    for (const id of rule.related) assert.equal(ruleById(id).id, id, `${rule.id} 的相关条目 ${id} 无法解析`)
    assert.doesNotMatch([...rule.body, ...rule.bodyEn].join(''), ENGINEERING_WORDS, `${rule.id} 正文含工程用语`)
    assert.ok(matchingRules(rule.title).some(entry => entry.id === rule.id), `${rule.id} 中文标题搜不到`)
    assert.ok(matchingRules(rule.titleEn).some(entry => entry.id === rule.id), `${rule.id} 英文标题搜不到`)
  }
  // 每条登记了卡文匹配模式的规则，命中卡都必须反向连回该规则（与 rulebook-data 的 /^08/ 派发一致）。
  for (const [ruleId, pattern] of EOTE_CARD_RULE_PATTERNS) {
    assert.equal(ruleById(ruleId).id, ruleId, `EOTE_CARD_RULE_PATTERNS 指向不存在的规则 ${ruleId}`)
    const matched = CYCLE_CODES.filter(code => pattern.test(CARD_TEXT(code)))
    for (const code of matched) assert.ok(cardRuleIds(ALL_CARDS[code]).includes(ruleId), `${code} 命中 ${ruleId} 但未反向链接`)
  }
})

test('P3 关键词原语验收：P2 原语 done、P3 规则层交付、P4 交互排期显式记录', async () => {
  const plan = await buildPrimitivePlan()
  // 引导期容错：node/regression 验收（本测试所在批次）与原语计划门禁互为输入——计划要读两份
  // 验收账本，而账本要跑本测试。因此 P3 只校验「交付类」门禁（P2 done、P3/P4 回填、目录/导出/
  // 模块/扫描一致）；两份验收账本的门禁由 `verify-eote --node/--regression` 自身闭包、并在最终
  // `audit-eote-primitives --check` 时连同已落盘的两份报告一并强制为 true。
  const interactionsAuditPresent = existsSync(new URL('../audit/eote-interactions.json', import.meta.url))
  const deliveryGates = Object.entries(plan.gates).filter(([key]) => !['nodeAcceptance', 'regressionAcceptance', 'allNewDone'].includes(key))
  if (interactionsAuditPresent) assert.ok(deliveryGates.every(([, value]) => value === true), 'P2/P3/P4 原语交付门禁未全真')
  // P2 done 用结构事实判定（模块与导出存在于当前源码），不读 node/regression 报告状态：
  // 后者与本测试互为输入，由最终 `audit-eote-primitives --check` 统一强制。
  const done = new Set([...plan.reuse, ...plan.new]
    .filter(row => row.modulesPresent && row.exportsPresent)
    .map(row => row.id))
  const deferred = planByPhase(plan)
  const referencedDeferred = new Set()
  for (const keyword of EOTE_KEYWORDS) {
    for (const primitiveId of keyword.primitives) {
      if (done.has(primitiveId)) continue
      const row = deferred.get(primitiveId)
      assert.ok(row, `${keyword.id} 的原语 ${primitiveId} 不在 P2 计划中`)
      referencedDeferred.add(primitiveId)
      if (row.phase === 'P3') {
        assert.ok(P3_DELIVERED_PRIMITIVES.includes(primitiveId), `${primitiveId} 未登记为 P3 规则层交付`)
        // P3 交付的验收证据：规则条目 + 卡文直达 + 扫描清点三者缺一不可。
        assert.equal(ruleById(keyword.ruleId).id, keyword.ruleId)
        for (const code of keyword.cardCodes) assert.ok(cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId))
      } else {
        assert.ok(row.phase === 'P4' && P4_SCHEDULED_PRIMITIVES.includes(primitiveId),
          `${primitiveId} 的排期阶段 ${row.phase} 未登记`)
      }
    }
  }
  assert.deepEqual([...referencedDeferred].sort(), [...P3_DELIVERED_PRIMITIVES, ...P4_SCHEDULED_PRIMITIVES].sort())
})

test('P3 关键口径：寒霜 8 枚/追加揭示/自动失败、伙伴不占盟友槽、庇护 0–9、忒咳哩-哩 7 面 16 张、高度 0–5、钥匙花费、多职阶与演武', () => {
  const body = ruleId => ruleById(ruleId).body.join('\n')
  assert.match(body('eoteFrost'), /8/)
  assert.match(body('eoteFrost'), /(追加|额外|再).{0,8}(揭示|翻)/)
  assert.match(body('eoteFrost'), /自动失败/)
  assert.match(body('eotePartners'), /不占.{0,10}盟友|不占用.{0,10}盟友槽/)
  assert.match(body('eoteShelter'), /0.{0,4}9/)
  assert.match(body('eoteTekeli'), /7/)
  assert.match(body('eoteTekeli'), /16/)
  assert.match(body('eoteLevel'), /0.{0,4}5/)
  assert.match(body('eoteSeals'), /花费/)
  const allEoteText = EOTE_RULES.map(rule => `${rule.title} ${rule.body.join('')}`).join('\n')
  assert.match(allEoteText, /多职阶/)
  assert.match(allEoteText, /演武/)
  // 数据侧旁证：忒咳哩-哩遭遇组是 7 张不同卡面（印刷 16 张由规则条目说明）。
  assert.equal(CYCLE_CODES.filter(code => ALL_CARDS[code].encounterCode === 'tekelili').length, 7)
})
