// 把转码后的背景音乐上传到 Cloudflare R2（S3 兼容接口），对象键与 src/integration/music-cache.js 的镜像布局一致：
//   node tools/upload-music.mjs <bucket> [--dry-run]
// 凭证只从环境变量读取：R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY。
// 上传前按 sources.json 的 encoded 校验每个本地文件。

import { readFileSync } from 'node:fs'
import { createHash, createHmac } from 'node:crypto'
import { MIRROR_PREFIX } from '../src/integration/music-cache.js'

const bucket = process.argv[2]
const dryRun = process.argv.includes('--dry-run')
if (!bucket || bucket.startsWith('--')) throw new Error('用法：node tools/upload-music.mjs <bucket> [--dry-run]')
const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKey, R2_SECRET_ACCESS_KEY: secretKey } = process.env
if (!dryRun && !(account && accessKey && secretKey)) throw new Error('缺少环境变量 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY')

const hmac = (key, value) => createHmac('sha256', key).update(value).digest()
const sha256 = value => createHash('sha256').update(value).digest('hex')

async function put(key, body, payloadHash) {
  const host = `${account}.r2.cloudflarestorage.com`
  const pathname = '/' + [bucket, ...key.split('/')].map(encodeURIComponent).join('/')
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const date = amzDate.slice(0, 8)
  const headers = {
    'cache-control': 'public, max-age=31536000, immutable',
    'content-type': 'audio/mpeg',
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  const signed = Object.keys(headers).sort()
  const canonical = ['PUT', pathname, '', ...signed.map(name => `${name}:${headers[name]}`), '', signed.join(';'), payloadHash].join('\n')
  const scope = `${date}/auto/s3/aws4_request`
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')
  const signingKey = ['auto', 's3', 'aws4_request'].reduce(hmac, hmac('AWS4' + secretKey, date))
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${hmac(signingKey, toSign).toString('hex')}`
  const { host: _, ...sent } = headers
  const response = await fetch(`https://${host}${pathname}`, { method: 'PUT', headers: { ...sent, authorization }, body })
  if (!response.ok) throw new Error(`上传失败 ${response.status}：${key}\n${await response.text()}`)
}

const root = new URL('../web/audio/music/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('sources.json', root), 'utf8'))
for (const track of manifest.tracks) {
  const data = readFileSync(new URL(track.localFile, root))
  if (data.length !== track.encoded?.bytes || sha256(data) !== track.encoded.sha256) {
    throw new Error('本地文件与 sources.json 的 encoded 不一致：' + track.localFile)
  }
  const key = MIRROR_PREFIX + track.localFile
  console.log(`${dryRun ? '[dry-run] ' : ''}${bucket}/${key} (${data.length} bytes)`)
  if (!dryRun) await put(key, data, track.encoded.sha256)
}
