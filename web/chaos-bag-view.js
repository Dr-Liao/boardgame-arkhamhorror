import { chaosTokenFace } from './chaos-token.js'
import { t } from './i18n.js'

// Read the live public bag, never the campaign's initial pool or draw order.
export function groupedChaosTokens(tokens = []) {
  const groups = new Map()
  for (const token of tokens) {
    const value = token && typeof token === 'object' ? token.token : token
    const face = chaosTokenFace(value)
    const group = groups.get(face.key) || { ...face, value, count: 0 }
    group.count++; groups.set(face.key, group)
  }
  const order = ['eldersign', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'bless', 'curse', 'frost']
  return [...groups.values()].sort((a,b)=>{
    const an = /^[+-]?\d+$/.test(String(a.value)), bn = /^[+-]?\d+$/.test(String(b.value))
    if (an && bn) return Number(b.value) - Number(a.value)
    if (an !== bn) return an ? -1 : 1
    const rank = key => order.includes(key) ? order.indexOf(key) : order.length
    return rank(a.key) - rank(b.key) || a.label.localeCompare(b.label)
  })
}

export function createChaosBagView(h, render) {
  let sessionId = null
  let cached=null, cachedKey=''
  const close = () => {
    sessionId = null; cached=null; cachedKey=''; render()
    queueMicrotask(()=>document.querySelector('.ah-chaos-bag')?.focus({preventScroll:true}))
  }
  // 令牌网格：组名走词典（chaos.token.*），枚数留在 aria-label 里。
  const tokens = (items, zone) => h('ul', {className:'ah-bag-token-grid', 'data-bag-zone':zone},
    groupedChaosTokens(items).map(token=>h('li', {className:'ah-bag-token', 'data-token':token.key, 'aria-label':t('chaos.bag.tokenAria', { label: token.label, count: token.count })},
      token.src ? h('img', {src:token.src,alt:token.label,draggable:false}) : h('span',{className:'ah-bag-token-fallback'},token.label),
      h('strong',{},token.label),h('span',{className:'ah-bag-token-count'},'×'+token.count))))
  return {
    get opened() { return sessionId !== null },
    open(id) { sessionId=id; render() },
    reset() { sessionId=null; cached=null; cachedKey='' },
    render(session, blocked) {
      if (!sessionId) return null
      if (!session || session.sessionId !== sessionId) { this.reset(); return null }
      if (blocked) return null
      const state=session.state, bag=state.chaosBag || []
      const sealed=state.chaos?.sealed || state.sealedTokens || [], revealed=state.chaos?.revealed || []
      const key=JSON.stringify([sessionId,bag,sealed,revealed])
      const scroll=cached?.querySelector('.ah-bag-modal')?.scrollTop || 0
      if(cached&&cachedKey===key){
        const focus=cached.contains(document.activeElement)?document.activeElement:null
        queueMicrotask(()=>{if(cached?.isConnected){cached.querySelector('.ah-bag-modal').scrollTop=scroll;focus?.focus({preventScroll:true})}})
        return cached
      }
      const dismiss=h('button',{type:'button',className:'ah-bag-close','aria-label':t('chaos.bag.closeAria'),onclick:close},t('common.close'))
      const modal=h('div',{className:'bg-backdrop ah-bag-backdrop'},
        h('section',{className:'ah-bag-modal',role:'dialog','aria-modal':'true','aria-label':t('chaos.bag.title'),tabindex:-1,
          onclick:event=>event.stopPropagation(),onkeydown:event=>{
            if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
            if(event.key==='Tab'){event.preventDefault();dismiss.focus({preventScroll:true})}
          }},
          h('header',{},h('img',{src:'/mods/arkhamhorror/img/ui/chaos-bag.webp',alt:''}),
            h('div',{},h('small',{},t('chaos.bag.eyebrow')),
              h('h2',{},t('chaos.bag.title')),
              h('p',{},t('chaos.bag.summary',{total:bag.length,kinds:groupedChaosTokens(bag).length}))),dismiss),
          bag.length ? tokens(bag,'bag') : h('p',{className:'ah-bag-empty'},t('chaos.bag.empty')),
          revealed.length ? h('section',{className:'ah-bag-outside'},h('h3',{},t('chaos.bag.revealed',{count:revealed.length})),tokens(revealed,'revealed')) : null,
          sealed.length ? h('section',{className:'ah-bag-outside'},h('h3',{},t('chaos.bag.sealed',{count:sealed.length})),tokens(sealed,'sealed')) : null,
          h('footer',{},t('chaos.bag.footer'))))
      cached=modal;cachedKey=key
      queueMicrotask(()=>{if(dismiss.isConnected){modal.querySelector('.ah-bag-modal').scrollTop=scroll;dismiss.focus({preventScroll:true})}})
      return modal
    },
  }
}
