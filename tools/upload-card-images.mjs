// 把卡图清单从旧 CDN 复制到 Cloudflare R2。
// 对象键：arkhamhorror/cards/<去掉清单里多余的 cards/ 目录>
// 公开地址：https://drliao1.com/arkhamhorror/cards/01001.avif ，中文为 zh/01001.avif
//
//   node tools/upload-card-images.mjs [--concurrency=8]
//   node tools/upload-card-images.mjs --staged [--concurrency=8]
//
// 凭证只从环境变量读取：R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、R2_BUCKET。

import { createHash, createHmac } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { remoteImagePath } from '../web/images.js'

const SOURCE = 'https://assets.arkhamhorror.app/img/arkham/'
const PREFIX = 'arkhamhorror/cards/'
const TYPES = { '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' }
const argv = process.argv.slice(2)
const staged = argv.includes('--staged')
const limit = Number(argv.find(value => value.startsWith('--limit='))?.split('=')[1] || Infinity)
if (limit !== Infinity && (!staged || !Number.isInteger(limit) || limit < 1)) throw new Error('--limit 仅用于 --staged，且需为正整数')
const concurrency = Number(argv.find(value => value.startsWith('--concurrency='))?.split('=')[1] || 8)
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('concurrency 需在 1–16')
const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKey, R2_SECRET_ACCESS_KEY: secretKey, R2_BUCKET: bucket } = process.env
if (!account || !accessKey || !secretKey || !bucket) throw new Error('缺少 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET')

const host = `${account}.r2.cloudflarestorage.com`
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())

async function s3(method, key, { query = {}, body, headers = {} } = {}) {
  const uri = '/' + [bucket, ...(key ? key.split('/') : [])].map(encode).join('/')
  const search = Object.keys(query).sort().map(name => encode(name) + '=' + encode(query[name])).join('&')
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
  const scope = `${stamp.slice(0, 8)}/auto/s3/aws4_request`
  const signed = { host, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', 'x-amz-date': stamp }
  const names = Object.keys(signed).join(';')
  const canonical = [method, uri, search, ...Object.entries(signed).map(([name, value]) => name + ':' + value), '', names, 'UNSIGNED-PAYLOAD'].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, createHash('sha256').update(canonical).digest('hex')].join('\n')
  const signingKey = ['auto', 's3', 'aws4_request'].reduce(hmac, hmac('AWS4' + secretKey, stamp.slice(0, 8)))
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names}, Signature=${hmac(signingKey, toSign).toString('hex')}`
  const response = await fetch(`https://${host}${uri}${search ? '?' + search : ''}`, {
    method, body, headers: { ...headers, ...signed, authorization }, signal: AbortSignal.timeout(120_000),
  })
  if (method === 'PUT') {
    if (!response.ok) throw new Error(`PUT ${key} HTTP ${response.status} ${(await response.text()).slice(0, 180)}`)
    return null
  }
  const text = await response.text()
  if (!response.ok) throw new Error(`R2 ${method} ${key || '/'} HTTP ${response.status} ${text.slice(0, 180)}`)
  return text
}

async function existingKeys() {
  const found = new Set()
  let token = ''
  do {
    const query = { 'list-type': '2', prefix: PREFIX, 'max-keys': '1000' }
    if (token) query['continuation-token'] = token
    const xml = await s3('GET', '', { query })
    for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) found.add(match[1])
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/) || [])[1] || '' : ''
    if (/<IsTruncated>true<\/IsTruncated>/.test(xml) && !token) throw new Error('R2 列表被截断但没有续传标记')
  } while (token)
  return found
}

const inventory = staged ? null : JSON.parse(readFileSync(new URL('../audit/local-images.json', import.meta.url), 'utf8'))
const files = staged
  ? readdirSync(new URL('../artifacts/card-translation/zh/cards/', import.meta.url))
    .filter(name => /^[0-9A-Za-z_-]+\.avif$/.test(name))
    .sort()
    .map(name => `zh/cards/${name}`)
  : inventory.files
if (staged && limit < files.length) files.length = limit
if (!Array.isArray(files) || !files.length) throw new Error('卡图清单为空')
const present = await existingKeys()
console.log(`${staged ? '暂存' : '清单'} ${files.length} 张，R2 已有 ${[...present].filter(key => key.startsWith(PREFIX)).length} 个对象`)

const stats = { uploaded: 0, skipped: 0, missing: 0, failed: 0, bytes: 0 }
const problems = []
let cursor = 0

async function once(file) {
  const key = PREFIX + remoteImagePath(file)
  if (present.has(key)) { stats.skipped++; return }
  let body
  if (staged) {
    body = readFileSync(new URL(`../artifacts/card-translation/${file}`, import.meta.url))
  } else {
    const source = await fetch(SOURCE + file.split('/').map(encodeURIComponent).join('/'), { signal: AbortSignal.timeout(60_000) })
    if (source.status === 404) { stats.missing++; return }
    if (!source.ok) throw new Error(`源 HTTP ${source.status}`)
    body = Buffer.from(await source.arrayBuffer())
  }
  if (!body.length) throw new Error('空响应')
  const extension = file.slice(file.lastIndexOf('.')).toLowerCase()
  await s3('PUT', key, {
    body,
    headers: { 'cache-control': 'public, max-age=31536000, immutable', 'content-type': TYPES[extension] || 'application/octet-stream' },
  })
  stats.uploaded++
  stats.bytes += body.length
}

async function worker() {
  for (;;) {
    const index = cursor++
    if (index >= files.length) return
    const file = files[index]
    let last
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { await once(file); last = null; break } catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, 400 * attempt * attempt)) }
    }
    if (last) { stats.failed++; problems.push(`${file}: ${last.message}`) }
    const done = stats.uploaded + stats.skipped + stats.missing + stats.failed
    if (done % 200 === 0 || done === files.length) {
      console.log(`进度 ${done}/${files.length} 上传 ${stats.uploaded} 跳过 ${stats.skipped} 源缺失 ${stats.missing} 失败 ${stats.failed} ${(stats.bytes / 1048576).toFixed(0)} MB`)
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker))
console.log(JSON.stringify(stats))
if (problems.length) {
  console.error(problems.slice(0, 20).join('\n'))
  process.exitCode = 1
}
