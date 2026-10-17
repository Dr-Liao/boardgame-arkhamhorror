// Original token faces from the bundled ArkhamHorror reference media.
const ROOT = '/mods/arkhamhorror/img/chaos-tokens/'
const names = { skull:'骷髅', cultist:'异教徒', tablet:'石板', elderthing:'古神', eldersign:'旧印', autofail:'自动失败', bless:'祝福', curse:'诅咒', frost:'冰霜', blank:'未揭示混乱标记' }
const images = new Map()
const face = value => {
  const key = String(value).toLowerCase().replaceAll('_','')
  return Object.hasOwn(names,key) ? key : key === '+1' ? 'plus1' : /^-[1-8]$/.test(key) ? 'minus'+key.slice(1) : key === '0' ? '0' : null
}
export function chaosTokenFace(value) {
  const key = face(value)
  return { key: key || String(value), label: names[key] || String(value), src: key ? ROOT + 'ct-' + key + '.png' : null }
}
function preload(key) {
  if (!images.has(key)) {
    const image = new Image(); image.src = ROOT + 'ct-' + key + '.png'
    images.set(key,image.decode().catch(()=>{}))
  }
  return images.get(key)
}
export function preloadChaosTokens() {
  for(const key of [...Object.keys(names),'0','plus1',...Array.from({length:8},(_,i)=>'minus'+(i+1))]) preload(key)
}
export async function showChaosToken(holder, value) {
  const key = face(value), label = names[key] || String(value)
  holder.dataset.chaosToken = String(value)
  holder.setAttribute('role','img'); holder.setAttribute('aria-label',label); holder.title = label
  if (!key) { holder.textContent = label; return }
  await preload(key)
  if (holder.dataset.chaosToken !== String(value)) return
  const img = document.createElement('img')
  img.src = ROOT + 'ct-' + key + '.png'; img.alt = ''; img.draggable = false
  holder.replaceChildren(img)
}
