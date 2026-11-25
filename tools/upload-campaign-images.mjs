// node tools/upload-campaign-images.mjs             上传主题使用的 WebP 到 R2
// node tools/upload-campaign-images.mjs --verify    从公开 CDN 下载并逐字节核对
// R2 凭证由 R2_ACCOUNT_ID、R2_BUCKET、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 提供。

import { createHash, createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { CAMPAIGN_IMAGE_ROOT, CAMPAIGN_PRESENTATIONS } from '../web/campaign-presentation.js'

const args = process.argv.slice(2)
if (args.length && (args.length !== 1 || args[0] !== '--verify')) {
  throw new Error('用法：node tools/upload-campaign-images.mjs [--verify]')
}
const verify = args.length === 1
const { R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKey, R2_SECRET_ACCESS_KEY: secretKey } = process.env
if (!verify && !(account && bucket && accessKey && secretKey)) {
  throw new Error('缺少 R2_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY')
}

const urls = [...new Set(Object.values(CAMPAIGN_PRESENTATIONS).flatMap(campaign =>
  [campaign, ...Object.values(campaign.scenarios || {})].flatMap(theme => Object.values(theme.assets)),
))].sort()
const imageDir = new URL('../web/img/campaigns/', import.meta.url)
const files = await Promise.all(urls.map(async url => {
  const relative = url.slice(CAMPAIGN_IMAGE_ROOT.length)
  if (url !== CAMPAIGN_IMAGE_ROOT + relative || !/^(?:[\w-]+\/)+[\w-]+\.webp$/.test(relative)) {
    throw new Error('无效的战役图片地址：' + url)
  }
  const body = await readFile(new URL(relative, imageDir))
  if (body.toString('ascii', 0, 4) !== 'RIFF' || body.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('无效的 WebP 文件：' + relative)
  }
  return { url, body }
}))

const hmac = (key, data) => createHmac('sha256', key).update(data).digest()
const sha256 = data => createHash('sha256').update(data).digest('hex')

async function put({ url, body }) {
  const host = `${account}.r2.cloudflarestorage.com`
  const uri = '/' + encodeURIComponent(bucket) + new URL(url).pathname
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
  const date = stamp.slice(0, 8)
  const payload = sha256(body)
  const headers = {
    'cache-control': 'public, max-age=86400',
    'content-type': 'image/webp',
    host,
    'x-amz-content-sha256': payload,
    'x-amz-date': stamp,
  }
  const names = Object.keys(headers).join(';')
  const canonical = ['PUT', uri, '', ...Object.entries(headers).map(([key, value]) => `${key}:${value}`), '', names, payload].join('\n')
  const scope = `${date}/auto/s3/aws4_request`
  const signingKey = ['auto', 's3', 'aws4_request'].reduce(hmac, hmac('AWS4' + secretKey, date))
  const signature = hmac(signingKey, ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n')).toString('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names}, Signature=${signature}`
  const response = await fetch(`https://${host}${uri}`, {
    method: 'PUT', body, headers: { ...headers, authorization }, signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`R2 HTTP ${response.status}`)
}

async function check({ url, body }) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`CDN HTTP ${response.status}`)
  if (response.headers.get('content-type') !== 'image/webp' || !body.equals(Buffer.from(await response.arrayBuffer()))) {
    throw new Error('CDN 文件或媒体类型与本地 WebP 不一致')
  }
}

const operation = verify ? check : put
let next = 0
let completed = 0
const errors = []
async function worker() {
  while (next < files.length) {
    const file = files[next++]
    try {
      await operation(file)
      completed++
    } catch (error) {
      errors.push(`${file.url} ${error.cause?.code || error.message}`)
    }
  }
}

await Promise.all(Array.from({ length: 8 }, worker))
console.log(`${verify ? '校验' : '上传'} ${completed}/${files.length} 张战役图片`)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
