import fs from 'node:fs'
let src = fs.readFileSync('findings-data.mjs', 'utf8')
const pairs = [
  ["['08615', 15, '（无 uses）',", "['08615', 12, '（本卡无 uses，仅 flags）',"],
  ["{ text: uses, status: 'implemented', evidence: `${e}:${line}-19（uses/usesType 数据）`, note: 'uses 数据存在' },",
   "{ text: uses, status: 'implemented', evidence: `${e}:${line}-19（uses/usesType/flags 数据）`, note: '数据存在；08615 无 uses 属于卡面事实' },"],
  ["${e}:11-20（条目只有 code/uses/flags，无 abilities/描述子）；${P}/behavior.js:301-345（只做 isExpeditionAsset/takeExpeditionAsset，无能力结算）",
   "${e}:11-20（条目只有 code/uses/flags，无 abilities/描述子）；${P}/behavior.js:47-56（isExpeditionAsset）,301-345（只做取得/撤退，无能力结算）"],
  ["${P}/definition.js:43,62-65", "${P}/definition.js:40-43"],
  ["${P}/definition.js:218-232（scenario 数据无 setup token）", "${P}/definition.js:196-227（scenario 数据无 setup token）"],
  ["${P}/definition.js:218-232", "${P}/definition.js:196-227"],
]
for (const [a, b] of pairs) { if (!src.includes(a)) console.log('MISS:', a.slice(0, 70)); src = src.split(a).join(b) }
// 08629 行动/onReveal 行号精确化
src = src.replace("const [v, actionText, ruleName, impl] = act2Data[code]", "const [v, actionText, ruleName, impl] = act2Data[code]")
src = src.replace("const clauses = [\n    { text: actionText, status: 'missing', evidence: `${e}:19-28（actTwoActions ${ruleName}）；${impl}`",
  "const actTwoLines = code === '08629' ? '20-29' : '19-28'\n  const onRevealLine = code === '08629' ? 31 : 29\n  const clauses = [\n    { text: actionText, status: 'missing', evidence: `${e}:${actTwoLines}（actTwoActions ${ruleName}）；${impl}`")
src = src.replace("{ text: '背面 (→R1)', status: 'implemented', evidence: `${e}:29-31（onReveal resolution1）；${C}/behavior.js:204-218（actReveal 字符串 resolution 分支）`, note: '' }",
  "{ text: '背面 (→R1)', status: 'implemented', evidence: `${e}:${onRevealLine}（onReveal resolution1）；${C}/behavior.js:204-218（actReveal 字符串 resolution 分支）`, note: '' }")
fs.writeFileSync('findings-data.mjs', src, 'utf8')
let b = fs.readFileSync('build-findings.mjs', 'utf8')
b = b.replace("${P}/behavior.js:378-437,504-527,552-582", "${P}/behavior.js:378-437,428-475")
fs.writeFileSync('build-findings.mjs', b, 'utf8')
console.log('patched')
