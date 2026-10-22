import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { buildBatchPlan, buildTranslationJobs, parseTranslationArgs, stageGeneratedImage } from '../tools/translate-images.mjs'

test('批次参数支持并发波次，拒绝冲突或越界值', () => {
  assert.equal(parseTranslationArgs(['--plan', '--next=10', '--concurrency=4']).concurrency, 4)
  assert.throws(() => parseTranslationArgs(['--plan', '--next=10', '--limit=10']), /不能同时指定/)
  assert.equal(parseTranslationArgs(['--plan', '--concurrency=20']).concurrency, 20)
  assert.equal(parseTranslationArgs(['--plan', '--quiet']).quiet, true)
  assert.throws(() => parseTranslationArgs(['--plan', '--concurrency=21']), /concurrency/)
  assert.throws(() => parseTranslationArgs(['--stage', '--codes=03065']), /input/)
})

test('多个卡号指向同一目标图时只计划一次', () => {
  const cards = Object.fromEntries(['a', 'b'].map(code => [code, { code, pack: 'p', name: code, nameZh: code }]))
  const jobs = buildTranslationJobs({
    cards,
    options: parseTranslationArgs(['--plan', '--next=20']),
    localized: () => false,
    sourceExists: () => true,
    descriptor: () => ({ front: { candidates: [{ path: 'cards/shared.avif' }] } }),
  })
  assert.deepEqual(jobs.map(job => job.code), ['a'])
})

test('已迁入游戏的中文图清空暂存后不会重新规划', () => {
  const jobs = buildTranslationJobs({ options: parseTranslationArgs(['--plan', '--codes=03068b']) })
  assert.deepEqual(jobs, [])
})

test('缺中文图的卡分组计划跳过已暂存文件和无文字卡背', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'arkham-image-plan-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(path.join(directory, 'zh', 'cards'), { recursive: true })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(path.join(directory, 'zh', 'cards', '10001.avif'), 'staged')
  const cards = Object.fromEntries(['01000', 'a', 'b', 'c'].map((code, index) => [code, {
    code, pack: 'p', name: code, nameZh: code,
  }]))
  const jobs = buildTranslationJobs({
    cards, stagingRoot: directory,
    options: { ...parseTranslationArgs(['--plan', '--next=2']), codes: [] },
    localized: () => false,
    sourceExists: () => true,
    descriptor: code => ({ front: { candidates: [{ path: `cards/1000${code.charCodeAt(0) - 96}.avif` }] } }),
  })
  assert.deepEqual(jobs.map(job => job.code), ['b', 'c'])
  const plan = buildBatchPlan(jobs, 2)
  assert.equal(plan.waves.length, 1)
  assert.deepEqual(plan.waves[0].map(job => job.code), ['b', 'c'])
})

test('生图文件只转换并暂存，不写游戏图片目录', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'arkham-image-stage-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = path.join(directory, 'source.png')
  const input = path.join(directory, 'generated.png')
  const target = path.join(directory, 'artifacts', 'zh', 'cards', '10001.avif')
  await sharp({ create: { width: 75, height: 105, channels: 3, background: '#eee' } }).png().toFile(source)
  await sharp({ create: { width: 150, height: 210, channels: 3, background: '#aaa' } }).png().toFile(input)
  const result = await stageGeneratedImage({ code: '10001', source, sourceAvailable: true, target }, input)
  assert.equal(result.target, target)
  const metadata = await sharp(target).metadata()
  assert.deepEqual([metadata.width, metadata.height], [75, 105])
  await assert.rejects(stageGeneratedImage({ code: '10001', source, sourceAvailable: true, target }, input), /已存在/)
})
