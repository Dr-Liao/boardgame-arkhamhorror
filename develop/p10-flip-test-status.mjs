// P10：把各章测试里「章节状态 = development」的断言与用例名改为 playable（发布开放）。
// 一次性脚本：逐文件精确替换并校验替换次数，避免手改 9 个文件漏项。
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const files = [
  'tests/tcu-black-throne.test.mjs',
  'tests/tcu-clutches-chaos.test.mjs',
  'tests/tcu-deaths-doorstep.test.mjs',
  'tests/tcu-greater-good.test.mjs',
  'tests/tcu-secret-name.test.mjs',
  'tests/tcu-union-disillusion.test.mjs',
  'tests/tcu-wages-of-sin.test.mjs',
  'tests/tcu-witching-hour.test.mjs',
  'tests/tcu-prologue.test.mjs',
]
const replacements = [
  ["test('黑色王座：development 清单、原卡身份与幕/议程/结局'", "test('黑色王座：playable 清单、原卡身份与幕/议程/结局'"],
  ["test('混沌魔掌：development 清单、原卡身份与幕/议程/结局'", "test('混沌魔掌：playable 清单、原卡身份与幕/议程/结局'"],
  ["test('死亡门前 M3：章节为 development，保留原卡身份与 7 处地点'", "test('死亡门前：章节为 playable，保留原卡身份与 7 处地点'"],
  ["test('崇高利益：章节已是 development，身份/地点/幕/议程/结局齐全'", "test('崇高利益：章节已是 playable，身份/地点/幕/议程/结局齐全'"],
  ["test('05120 章节清单：development、地点 16 实例 / 3 幕 / 4 议程 / 3 结局'", "test('05120 章节清单：playable、地点 16 实例 / 3 幕 / 4 议程 / 3 结局'"],
  ["test('聚合幻灭：章节已是 development，地点/幕/议程/结局/身份齐全'", "test('聚合幻灭：章节已是 playable，地点/幕/议程/结局/身份齐全'"],
  ["test('恶罪报应 M3：章节为 development，保留 11 处双面地点与双层遭遇牌库'", "test('恶罪报应：章节为 playable，保留 11 处双面地点与双层遭遇牌库'"],
  ["test('05050 章节清单：development、原卡、地点/幕/议程/结局数量'", "test('05050 章节清单：playable、原卡、地点/幕/议程/结局数量'"],
  ["assert.equal(prologue.manifest.status, 'development')", "assert.equal(prologue.manifest.status, 'playable')"],
  ["'development 要求卡面子句无未实现 gap'", "'playable 要求卡面子句无未实现 gap'"],
]
const statusPatterns = [
  /assert\.equal\((\w+)\.manifest\.status, 'development'\)/g,
]
let total = 0
for (const file of files) {
  const url = new URL(file, root)
  let text = readFileSync(url, 'utf8')
  const before = text
  for (const [from, to] of replacements) {
    if (text.includes(from)) {
      text = text.split(from).join(to)
      total += 1
    }
  }
  text = text.replace(/assert\.equal\((\w+)\.manifest\.status, 'development'\)/g,
    (_, variable) => { total += 1; return `assert.equal(${variable}.manifest.status, 'playable')` })
  if (text === before) continue
  writeFileSync(url, text)
  console.log(`updated ${file}`)
}
console.log(`replacements: ${total}`)
