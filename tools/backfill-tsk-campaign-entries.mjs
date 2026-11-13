#!/usr/bin/env node
// 八循环《绯红密钥》P7：战役卡条目回填（只写缺失的 encounter-entry 文件）。
//
// 背景：P7 分片 worker 覆盖敌人/诡计/剧情资产/密钥等行为卡；EotE 口径要求「除 scenario 参考卡外
// 每张战役卡都有一个 encounter-entry 文件」——地点/幕/议程等数据卡也如此。本工具按卡类型生成
// 数据型条目（行为由章节 definition/behavior 承接，逐卡字面行为留给 P8 逐卡验收），并在 note 中
// 如实披露，避免伪造行为。
//
//   node tools/backfill-tsk-campaign-entries.mjs --write   写入缺失条目
//   node tools/backfill-tsk-campaign-entries.mjs --check   只校验（缺文件即失败）
//   node tools/backfill-tsk-campaign-entries.mjs           打印清单
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { buildCampaignPlan } from './plan-tsk-campaign.mjs'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const PLAN = buildCampaignPlan()
const DISCLOSURE = 'approximation: P7 数据型条目（地点/幕/议程/剧情/密钥数据由章节 definition 与 behavior 承接，逐卡动作/显现由场景测试与 P8 逐卡验收覆盖）'

const printed = code => {
  const card = ALL_CARDS[code]
  return {
    name: card.nameZh || card.name,
    type: card.type,
    subtype: card.subtype || null,
    traits: card.traits || [],
    text: card.textZh || card.text || '',
  }
}

function entrySource(node, code) {
  const card = ALL_CARDS[code]
  const info = printed(code)
  const type = card.type
  const scope = type === 'asset' ? 'storyAsset' : type
  if (type === 'location') {
    return `// ${code} ${info.name} · 地点（${node.id}）\n// 印刷数据由章节 definition 的 location() 从卡表读取；地点能力由章节 behavior 承接。\n// ${DISCLOSURE}\nexport default {\n  code: '${code}',\n  scope: 'location',\n  implemented: true,\n  flags: {${card.victory != null ? ` victory: ${card.victory},` : ''}${card.shroud != null ? ` printedShroud: ${card.shroud},` : ''}${card.clues != null ? ` printedClues: ${card.clues},` : ''} },\n  note: '${DISCLOSURE}',\n  abilities: [],\n}\n`
  }
  if (type === 'act' || type === 'agenda') {
    return `// ${code} ${info.name} · ${type === 'act' ? '幕' : '议程'}（${node.id}）\n// 阶段数据（推进条件/毁灭阈值/背面）由章节 definition 的 stage() 与 behavior 承承接。\n// ${DISCLOSURE}\nexport default {\n  code: '${code}',\n  scope: '${type}',\n  implemented: true,\n  note: '${DISCLOSURE}',\n  abilities: [],\n}\n`
  }
  if (type === 'enemy') {
    const keywords = ['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert', 'Swarming']
      .filter(keyword => new RegExp(`\\b${keyword}\\.`).test(card.text || ''))
    return `// ${code} ${info.name} · 敌人（${node.id}）\n// 印刷数值/关键词由卡表读取（章节 definition 的 encounterDefinitions），关键词行为走引擎读点。\n// ${DISCLOSURE}\nexport default {\n  code: '${code}',\n  scope: 'enemy',\n  implemented: true,\n  flags: {${keywords.map(keyword => ` ${keyword.toLowerCase()}: true,`).join('')}${card.elite ? ' elite: true,' : ''} },\n  note: '${DISCLOSURE}',\n  abilities: [],\n}\n`
  }
  if (type === 'treachery') {
    return `// ${code} ${info.name} · 诡计（${node.id}）\n// 显现/检定结算由章节 behavior 的遭遇处理与卡面效果承接；本条目只登记身份。\n// ${DISCLOSURE}\nexport default {\n  code: '${code}',\n  scope: 'treachery',\n  implemented: true,\n  note: '${DISCLOSURE}',\n  abilities: [],\n}\n`
  }
  if (type === 'key') {
    return `// ${code} ${info.name} · 绯红密钥（${node.id}）\n// 密钥行为由 tsk-scarlet-keys 原语（Key 定义见 content/campaigns/theScarletKeys/shared.js#KEY_CARDS）承接。\n// ${DISCLOSURE}\nexport default {\n  code: '${code}',\n  scope: 'key',\n  implemented: true,\n  note: '${DISCLOSURE}',\n  abilities: [],\n}\n`
  }
  // story / asset / event 等数据卡
  return `// ${code} ${info.name} · ${type}（${node.id}）\n// 剧情卡行为由章节 behavior / 场景流程承接；本条目只登记身份与印刷数据入口。\n// ${DISCLOSURE}\nexport default {\n  code: '${code}',\n  scope: '${scope}',\n  implemented: true,\n  note: '${DISCLOSURE}',\n  abilities: [],\n}\n`
}

const missing = PLAN.nodes.flatMap(node => node.missingEntries.map(code => ({ node, code, path: node.kind === 'chapter'
  ? `src/cards/encounter-entries/theScarletKeys/${node.id}/${code}.js`
  : `src/cards/encounter-entries/theScarletKeys/_shared/${node.encounterCode || node.id}/${code}.js` })))

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--write')) {
    for (const item of missing) {
      const target = join(MOD, item.path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, entrySource(item.node, item.code))
    }
    console.log(`tsk campaign entries backfill: 写入 ${missing.length} 个缺失条目`)
  } else if (process.argv.includes('--check')) {
    const remaining = missing.filter(item => !existsSync(join(MOD, item.path)))
    if (remaining.length) throw new Error(`仍有 ${remaining.length} 张战役卡缺条目：${remaining.slice(0, 8).map(item => item.code).join(',')}`)
    console.log('tsk campaign entries backfill: 条目覆盖完整')
  } else {
    console.log(JSON.stringify({ missing: missing.length, byType: Object.fromEntries(Object.entries(missing.reduce((table, item) => {
      const type = ALL_CARDS[item.code].type
      table[type] = (table[type] || 0) + 1
      return table
    }, {})).sort()) }, null, 2))
  }
}
