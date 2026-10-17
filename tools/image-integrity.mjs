import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

// AVIF is an ISO BMFF container. Check every top-level box, not just the suffix.
export function inspectImage(body, filename) {
  if (!body.length) throw new Error('empty file')
  if (/\.avif$/i.test(filename)) {
    if (body.length < 24 || body.toString('ascii', 4, 8) !== 'ftyp' ||
        !/avif|avis/.test(body.toString('ascii', 8, Math.min(body.length, 40)))) throw new Error('invalid AVIF signature')
    let offset = 0
    const types = []
    while (offset < body.length) {
      if (offset + 8 > body.length) throw new Error('truncated box header')
      let size = body.readUInt32BE(offset)
      const type = body.toString('ascii', offset + 4, offset + 8)
      let header = 8
      if (size === 1) {
        if (offset + 16 > body.length) throw new Error('truncated large box')
        size = Number(body.readBigUInt64BE(offset + 8)); header = 16
      } else if (size === 0) size = body.length - offset
      if (!Number.isSafeInteger(size) || size < header || offset + size > body.length) throw new Error('truncated or invalid box')
      types.push(type); offset += size
    }
    if (!types.includes('meta') || !types.includes('mdat')) throw new Error('missing AVIF metadata/pixels')
  } else if (/\.jpe?g$/i.test(filename)) {
    if (body.length < 4 || body.readUInt16BE(0) !== 0xffd8 || body.readUInt16BE(body.length - 2) !== 0xffd9) throw new Error('invalid or truncated JPEG')
  } else throw new Error('unsupported image format: ' + filename)
  return { bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }
}

export function verifyImages(jobs, resolve, expected = {}) {
  const missing = [], invalid = [], untracked = [], records = {}
  for (const { relative } of jobs) {
    const file = resolve(relative)
    if (!existsSync(file)) { missing.push(relative); continue }
    try {
      const record = inspectImage(readFileSync(file), relative)
      records[relative] = record
      if (!expected[relative]) untracked.push(relative)
      else if (record.sha256 !== expected[relative].sha256 || record.bytes !== expected[relative].bytes) invalid.push({ path: relative, error: 'content digest mismatch' })
    } catch (error) { invalid.push({ path: relative, error: error.message }) }
  }
  return { ok: !missing.length && !invalid.length && !untracked.length, missing, invalid, untracked, records }
}
