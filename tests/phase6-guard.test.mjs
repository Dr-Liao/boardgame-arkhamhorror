// Phase 6 守卫：引擎层不允许再出现「具体卡号」与「战役名」。
//
// 这两条是 architecture-refactor-roadmap.md 的 Phase 6 门禁：
//   「`engine.js` / `observation.js` 内不出现 `tfa|carcosa|dunwich` 字样与具体卡号；
//     新增战役只加 `content/campaigns/<id>/`。」
//
// 为什么用正则扫源码而不是统计 AST：
// 这两类痕迹都是**字符串字面量**，AST 统计反而更容易漏掉模板字符串与注释里的残留；
// 直接的源码扫描与 `tools/audit-abilities.mjs` 的 engineCodes 口径完全一致（那边现在报 0）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ENGINE_DIR = path.join(process.cwd(), 'src', 'engine')

function engineFiles() {
  return fs.readdirSync(ENGINE_DIR).filter(name => name.endsWith('.js'))
}

test('Phase 6 门禁：引擎源码里没有具体卡号', () => {
  const offenders = []
  for (const file of engineFiles()) {
    const text = fs.readFileSync(path.join(ENGINE_DIR, file), 'utf8')
    for (const [index, line] of text.split('\n').entries()) {
      // 卡号形如 '01001' / "04231"，允许出现在注释以外的任何地方都不行（注释也算，便于指标单调）。
      const hits = line.match(/['"`]\d{5}['"`]/g)
      if (hits) offenders.push(`${file}:${index + 1}: ${line.trim().slice(0, 110)}`)
    }
  }
  assert.deepEqual(offenders, [], '引擎里仍有卡号字面量：\n' + offenders.join('\n'))
})

test('Phase 6 门禁：引擎源码里没有战役名', () => {
  const offenders = []
  for (const file of engineFiles()) {
    const text = fs.readFileSync(path.join(ENGINE_DIR, file), 'utf8')
    for (const [index, line] of text.split('\n').entries()) {
      if (/\b(tfa|carcosa|dunwich)\b/i.test(line)) {
        offenders.push(`${file}:${index + 1}: ${line.trim().slice(0, 110)}`)
      }
    }
  }
  assert.deepEqual(offenders, [], '引擎里仍有战役名：\n' + offenders.join('\n'))
})
