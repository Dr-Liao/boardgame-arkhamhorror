import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { inspectImage, verifyImages } from '../tools/image-integrity.mjs'

test('P7 image verification rejects absent, empty, truncated and same-size corrupted contents without writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-images-'))
  const box = (type, data = Buffer.alloc(0)) => {
    const b = Buffer.alloc(8 + data.length); b.writeUInt32BE(b.length); b.write(type, 4); data.copy(b, 8); return b
  }
  const good = Buffer.concat([box('ftyp', Buffer.from('avif\0\0\0\0avif')), box('meta'), box('mdat', Buffer.from('pixels'))])
  const file = path.join(directory, 'card.avif'), jobs = [{ relative: 'card.avif' }]
  const resolve = () => file
  try {
    assert.equal(verifyImages(jobs, resolve).missing.length, 1)
    for (const body of [Buffer.alloc(0), Buffer.from('<html>404</html>'), good.subarray(0, good.length - 1)]) {
      fs.writeFileSync(file, body); assert.equal(verifyImages(jobs, resolve).invalid.length, 1)
    }
    fs.writeFileSync(file, good)
    const expected = { 'card.avif': inspectImage(good, file) }
    const before = fs.statSync(file).mtimeMs
    assert.equal(verifyImages(jobs, resolve, expected).ok, true)
    assert.equal(fs.statSync(file).mtimeMs, before)
    assert.equal(verifyImages(jobs, resolve).untracked.length, 1)
    const changed = Buffer.from(good); changed[changed.length - 1] ^= 1
    fs.writeFileSync(file, changed)
    assert.equal(verifyImages(jobs, resolve, expected).invalid[0].error, 'content digest mismatch')
    assert.deepEqual(fs.readFileSync(file), changed)
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('P7 image CLI works under filesystem read-only permission and rejects invalid arguments', () => {
  const entry = fileURLToPath(new URL('../tools/fetch-images.mjs', import.meta.url))
  const inventory = new URL('../audit/local-images.json', import.meta.url)
  const digests = new URL('../audit/image-digests.json', import.meta.url)
  const before = [inventory, digests].map(file => ({ mtime: fs.statSync(file).mtimeMs, text: fs.readFileSync(file, 'utf8') }))
  const result = spawnSync(process.execPath, ['--permission', '--allow-fs-read=*', entry, '--verify', '--scope=manifest', '--limit=1'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).readOnly, true)
  assert.equal(JSON.parse(result.stdout).contentComplete, true)
  for (const [index, file] of [inventory, digests].entries()) {
    assert.equal(fs.statSync(file).mtimeMs, before[index].mtime)
    assert.equal(fs.readFileSync(file, 'utf8'), before[index].text)
  }
  const invalid = spawnSync(process.execPath, [entry, '--invalid'], { encoding: 'utf8' })
  assert.equal(invalid.status, 1)
})
