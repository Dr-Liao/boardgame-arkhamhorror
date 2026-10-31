#!/usr/bin/env node
// 食梦者（TDE）P7 / M2 玩家卡：合并报告与队列统计生成器 —— 主进程工具。
//
//   node tools/tde-p7-reports.mjs
//
// 读取（worker 只写、主进程只读）：
//   artifacts/migration/tde/shards.json
//   artifacts/migration/tde/workers/w-m2-*.json          worker 报告
//   artifacts/migration/tde/primitive-requests/*.json   原语请求队列
// 写出（主进程维护的运行目录，不签入）：
//   artifacts/migration/tde/reports/workers.json
//   artifacts/migration/tde/reports/primitive-queue.json
//
// 门禁：4 个分片报告齐全；每个分片 doneCount 等于分片张数；请求队列没有悬挂的 pending/claimed。
// 该工具不实跑测试；逐卡证据与账本由 tools/audit-tde-player.mjs 负责。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationDir = path.join(gameRoot, 'artifacts/migration/tde')
const shardsPath = path.join(migrationDir, 'shards.json')
const workersDir = path.join(migrationDir, 'workers')
const requestsDir = path.join(migrationDir, 'primitive-requests')
const reportsDir = path.join(migrationDir, 'reports')
const rel = file => path.relative(gameRoot, file).replaceAll('\\', '/')

if (!fs.existsSync(shardsPath)) throw new Error('缺少 artifacts/migration/tde/shards.json：先跑 scan-tde-player-shards --write')
const shards = JSON.parse(fs.readFileSync(shardsPath, 'utf8'))
fs.mkdirSync(reportsDir, { recursive: true })

// ---- worker 报告 -----------------------------------------------------------------------
const problems = []
const workers = shards.workers.map(shard => {
  const reportPath = path.join(gameRoot, shard.workerReport)
  if (!fs.existsSync(reportPath)) {
    problems.push(`缺少 worker 报告：${shard.workerReport}`)
    return { worker: shard.worker, shard: shard.id, codes: shard.count, missing: true }
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const done = Array.isArray(report.done) ? report.done : []
  const blocked = Array.isArray(report.blocked) ? report.blocked : []
  const simplified = Array.isArray(report.simplified) ? report.simplified : []
  if (report.worker !== shard.worker || report.shard !== shard.id) {
    problems.push(`${shard.workerReport} 的 worker/shard 与 shards.json 不一致`)
  }
  if (report.codes?.length !== shard.count) problems.push(`${shard.worker} 报告 codes 张数 ≠ 分片张数`)
  if (done.length + blocked.length !== shard.count) {
    problems.push(`${shard.worker} done+blocked=${done.length + blocked.length}，分片应为 ${shard.count}`)
  }
  const unknownDone = done.filter(code => !shard.codes.includes(code))
  if (unknownDone.length) problems.push(`${shard.worker} done 含分片外卡号：${unknownDone.join(',')}`)
  const missingDone = shard.codes.filter(code => !done.includes(code) && !blocked.includes(code))
  if (missingDone.length) problems.push(`${shard.worker} 未交代卡号：${missingDone.join(',')}`)
  return {
    worker: shard.worker,
    shard: shard.id,
    codes: shard.count,
    doneCount: done.length,
    blockedCount: blocked.length,
    simplifiedCount: simplified.length,
    blocked,
    simplified,
    testFile: report.testFile || shard.testFile,
    testsPassed: report.testsPassed ?? null,
    primitiveRequests: report.primitiveRequests || [],
    notes: report.notes || '',
  }
})
const workersDoc = {
  schemaVersion: 1,
  cycle: 'tde',
  milestone: 'P7',
  generatedBy: 'tools/tde-p7-reports.mjs',
  shards: shards.workers,
  workers,
  summary: {
    shards: workers.length,
    totalCards: shards.totalCards,
    done: workers.reduce((sum, worker) => sum + (worker.doneCount || 0), 0),
    blocked: workers.reduce((sum, worker) => sum + (worker.blockedCount || 0), 0),
    simplified: workers.reduce((sum, worker) => sum + (worker.simplifiedCount || 0), 0),
    testsPassed: workers.reduce((sum, worker) => sum + (worker.testsPassed || 0), 0),
  },
  gate: { pass: problems.length === 0, problems },
}
fs.writeFileSync(path.join(reportsDir, 'workers.json'), `${JSON.stringify(workersDoc, null, 2)}\n`)

// ---- 原语请求队列 ----------------------------------------------------------------------
const requestFiles = fs.existsSync(requestsDir)
  ? fs.readdirSync(requestsDir).filter(file => file.endsWith('.json')).sort()
  : []
const requests = requestFiles.map(file => {
  const request = JSON.parse(fs.readFileSync(path.join(requestsDir, file), 'utf8'))
  return {
    file: `artifacts/migration/tde/primitive-requests/${file}`,
    id: request.id || null,
    worker: request.worker || null,
    card: request.card || null,
    primitive: request.primitive || null,
    status: request.status || 'pending',
    resolution: request.resolution || null,
  }
})
const countStatus = status => requests.filter(request => request.status === status).length
const queueProblems = []
if (countStatus('pending') || countStatus('claimed')) {
  queueProblems.push(`有 ${countStatus('pending') + countStatus('claimed')} 条未处理的原语请求（pending/claimed）`)
}
for (const request of requests) {
  if (request.status === 'rejected' && !request.resolution?.suggestion) {
    queueProblems.push(`${request.file} 状态 rejected 但缺少 resolution.suggestion`)
  }
  if (request.status === 'done' && !request.resolution?.api) {
    queueProblems.push(`${request.file} 状态 done 但缺少 resolution.api`)
  }
}
const queueDoc = {
  schemaVersion: 1,
  cycle: 'tde',
  milestone: 'P7',
  generatedBy: 'tools/tde-p7-reports.mjs',
  note: '原语请求队列：P7 采用「显式简化优先」，未实现的新原语在 P8/P10 重新评估。',
  requests,
  summary: {
    total: requests.length,
    pending: countStatus('pending'),
    claimed: countStatus('claimed'),
    done: countStatus('done'),
    rejected: countStatus('rejected'),
  },
  gate: { pass: queueProblems.length === 0, problems: queueProblems },
}
fs.writeFileSync(path.join(reportsDir, 'primitive-queue.json'), `${JSON.stringify(queueDoc, null, 2)}\n`)

console.log(JSON.stringify({
  workers: workersDoc.gate,
  queue: queueDoc.gate,
  summary: workersDoc.summary,
}))
process.exitCode = workersDoc.gate.pass && queueDoc.gate.pass ? 0 : 1
