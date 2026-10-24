// 把当前磁盘上的 TCU 章节/账本测试同步登记进三个清单（幂等）。
//   tests/suites.mjs（fast tier）、tests/node-suite.mjs（全量）、tests/tcu-suite.mjs（tcu 统一入口）
// 只处理 tests/tcu-*.test.mjs；浏览器 spec 不在这里。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const KNOWN_ORDER = [
  'tcu-scenario-acceptance.test.mjs',
  'tcu-prologue.test.mjs',
  'tcu-witching-hour.test.mjs',
  'tcu-secret-name.test.mjs',
  'tcu-deaths-doorstep.test.mjs',
  'tcu-wages-of-sin.test.mjs',
  'tcu-greater-good.test.mjs',
  'tcu-union-disillusion.test.mjs',
  'tcu-clutches-chaos.test.mjs',
  'tcu-black-throne.test.mjs',
  'tcu-shared-encounters.test.mjs',
]
const onDisk = new Set(readdirSync('tests').filter(name => /^tcu-.*\.test\.mjs$/.test(name)))
const chapterTests = KNOWN_ORDER.filter(name => onDisk.has(name))

// 1) suites.mjs：加在每个 tier 的对应位置；章节测试归 fast。
let suites = readFileSync('tests/suites.mjs', 'utf8')
const missingSuites = chapterTests.filter(name => !suites.includes(`'${name}'`))
if (missingSuites.length) {
  suites = suites.replace(/\n\]\)\n\nexport const SLOW_TESTS/, `
  ${missingSuites.map(name => `'${name}', // 万象无终 P8：章节/共享组/账本测试`).join('\n  ')}
])

export const SLOW_TESTS`)
  writeFileSync('tests/suites.mjs', suites)
}

// 2) node-suite.mjs 与 3) tcu-suite.mjs：加 import 行。
const addImports = (file, missing) => {
  if (!missing.length) return
  let text = readFileSync(file, 'utf8')
  const anchor = file.endsWith('node-suite.mjs')
    ? "import './tcu-scenario-hooks.test.mjs'"
    : "import './tcu-player-ledger.test.mjs'"
  const block = missing.map(name => `import './${name}'`).join('\n')
  text = text.replace(anchor, `${anchor}\n${block}`)
  writeFileSync(file, text)
}
for (const file of ['tests/node-suite.mjs', 'tests/tcu-suite.mjs']) {
  const text = readFileSync(file, 'utf8')
  addImports(file, chapterTests.filter(name => !text.includes(`'./${name}'`)))
}
console.log('chapter tests:', chapterTests.join(', '))
console.log('suites updated:', missingSuites.length)
