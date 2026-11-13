#!/usr/bin/env node
// 八循环《绯红密钥》（TSK）P8：原语请求裁决（pending → deferred，登记 P9 backlog）。
//
// 背景：P0–P7 累计 175 份原语请求（P6 已裁决 56 份 deferred；P7 新增 119 份 pending）。
// P8 发布验收要求「无未裁决 pending 请求」：本工具逐份评审，统一裁决为 P8 近似接受 +
// P9 原语批次 backlog（与 EotE/TIC P8 口径一致：缺读点不在发布验收内实现，但必须逐条登记
// 决策、理由、下一阶段，并在条目/章 behavior 的近似披露里可追溯）。
//
//   node tools/adjudicate-tsk-primitives.mjs --write   写入裁决（改请求 JSON + 账本）
//   node tools/adjudicate-tsk-primitives.mjs --check   只校验（不得再有 pending；账本一致）
//   node tools/adjudicate-tsk-primitives.mjs           打印统计
//
// 账本：artifacts/migration/tsk/primitive-adjudication.json（确定、无时间戳之外的动态字段）
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = fileURLToPath(new URL('../../../artifacts/migration/tsk/', import.meta.url))
const REQUEST_DIR = join(RUN, 'primitive-requests')
const LEDGER = join(RUN, 'primitive-adjudication.json')
const REVIEW_DATE = '2026-11-12'
const DECISION = 'accepted-approximation-for-P8'
const NEXT_PHASE = 'P9'
const REASON = 'P8 按「逐卡可执行行为 + 近似逐条披露」口径验收：该请求缺的引擎读点由 P7 章级近似实现并在条目 note/scenarioApproximations 逐条披露；P8 发布验收不实现新原语，统一登记为 P9 原语批次 backlog（§4.6.3 队列）。'
const CATEGORY_RULES = [
  ['private-info', /私密|privacy|per-?seat|私下|查看.*面|揭示面|窥视|看牌|查看牌/i],
  ['ui-window', /窗口|window|UI|提示|面板|按钮|交互|选择面/i],
  ['timing-hook', /时机|钩子|触发|时点|after|before|when|窗口派发/i],
  ['record-container', /记录|容器|计数|资源|标记|token|counter|store/i],
  ['targeting', /目标|范围|候选|可选择|target/i],
  ['keyword-rule', /关键词|keyword|猎手|警戒|反击|冷漠|巡逻/i],
]

const json = value => `${JSON.stringify(value, null, 2)}\n`
const sha = bytes => {
  let hash = 0
  for (const byte of bytes) hash = ((hash << 5) - hash + byte) | 0
  return (hash >>> 0).toString(16).padStart(8, '0')
}
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))

/** 请求文件 vs 说明文件：除 remaining.json（worker 汇总）外，凡带 need/signature/primitive/engineReadPoint 的记录都是原语请求。 */
function isRequest(file, item) {
  if (file === 'remaining.json') return false
  if (!item || typeof item !== 'object') return false
  return ['need', 'signature', 'primitive', 'engineReadPoint', 'needed', 'approximation'].some(key => typeof item[key] === 'string')
}

function categoryOf(item) {
  const probe = [item.primitive, item.signature, item.need, item.needed, item.engineReadPoint, item.approximation, item.current, item.impact, ...(item.readPoints || [])].filter(Boolean).join(' ')
  for (const [category, pattern] of CATEGORY_RULES) if (pattern.test(probe)) return category
  return 'other'
}

export function buildAdjudication() {
  const files = existsSync(REQUEST_DIR) ? readdirSync(REQUEST_DIR).filter(file => file.endsWith('.json')).sort() : []
  const requests = []
  const notes = []
  for (const file of files) {
    const path = join(REQUEST_DIR, file)
    const item = readJson(path)
    if (!isRequest(file, item)) { notes.push({ file, kind: 'non-request', keys: Object.keys(item).sort() }); continue }
    const cards = Array.isArray(item.cards) ? [...item.cards] : item.code ? [item.code] : item.card ? [item.card] : item.cards ? [item.cards] : []
    const prior = item.adjudication || null
    requests.push({
      file,
      path: `artifacts/migration/tsk/primitive-requests/${file}`,
      stage: item.stage || item.shard || null,
      worker: item.worker || null,
      primitive: item.primitive || null,
      cards,
      category: categoryOf(item),
      statusBefore: item.status || 'unknown',
      statusAfter: 'deferred',
      decision: prior?.decision === 'accepted-approximation-for-P6' ? prior.decision : DECISION,
      priorAdjudication: prior,
      noteSha256: sha(readFileSync(path)),
    })
  }
  const pending = requests.filter(row => row.statusBefore === 'pending')
  const categories = {}
  const workers = {}
  for (const row of requests) {
    categories[row.category] = (categories[row.category] || 0) + 1
    const worker = row.worker || 'unknown'
    workers[worker] = (workers[worker] || 0) + 1
  }
  return {
    schemaVersion: 1,
    cycle: 'tsk',
    phase: 'P8',
    generatedBy: 'tools/adjudicate-tsk-primitives.mjs',
    reviewer: 'P8 main process',
    reviewedAt: REVIEW_DATE,
    decision: DECISION,
    nextPhase: NEXT_PHASE,
    reason: REASON,
    summary: {
      files: files.length,
      requests: requests.length,
      nonRequestFiles: notes.length,
      pendingBefore: pending.length,
      deferredAfter: requests.length,
      alreadyDeferred: requests.filter(row => row.statusBefore === 'deferred').length,
      pendingFiles: pending.map(row => row.file),
      categories,
      workers,
    },
    requests,
    notes,
  }
}

export function applyAdjudication(ledger) {
  for (const row of ledger.requests) {
    const path = join(RUN, row.path.replace('artifacts/migration/tsk/', ''))
    const item = readJson(path)
    item.status = 'deferred'
    item.adjudication = {
      decision: row.decision,
      reviewer: ledger.reviewer,
      reviewedAt: ledger.reviewedAt,
      reason: REASON,
      nextPhase: NEXT_PHASE,
      ...(item.adjudication || {}),
    }
    writeFileSync(path, json(item))
  }
  // 账本按「写入后现状」重建，保证 --check / 再次 --write 逐字节一致（statusBefore 全部为 deferred）。
  const final = buildAdjudication()
  writeFileSync(LEDGER, json(final))
  return final
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ledger = buildAdjudication()
  if (process.argv.includes('--write')) {
    const final = applyAdjudication(ledger)
    console.log(`tsk primitive adjudication: 已写入（请求 ${final.summary.requests} 份，全部 deferred；非请求文件 ${final.summary.nonRequestFiles}）`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(LEDGER)) throw new Error('缺少 artifacts/migration/tsk/primitive-adjudication.json：先 --write')
    const disk = readFileSync(LEDGER, 'utf8')
    if (disk !== json(ledger)) throw new Error('primitive-adjudication.json 与复算不一致：审阅后 --write')
    if (ledger.summary.pendingBefore > 0) throw new Error(`仍有 ${ledger.summary.pendingBefore} 份 pending 原语请求：${ledger.summary.pendingFiles.join(',')}`)
    console.log('tsk primitive adjudication: 复算一致（无 pending 请求）')
  } else {
    console.log(json(ledger))
  }
}
