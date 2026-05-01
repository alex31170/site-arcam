// Minimal script for navigation toggles (future use)
document.addEventListener('DOMContentLoaded',()=>{
  const navToggle=document.querySelector('.nav-toggle')
  if(navToggle) navToggle.addEventListener('click',()=>{
    document.querySelector('.nav').classList.toggle('open')
  })

  // On homepage, build a hero slideshow from all sub-gallery pages.
  try{
    const path = window.location.pathname || ''
    const file = path.split('/').pop() || ''
    const isHome = file === '' || file === 'index.html'

    if(isHome){
      const hero = document.querySelector('.hero')
      const slideA = document.querySelector('.hero-slide-a')
      const slideB = document.querySelector('.hero-slide-b')
      const homeOriginalCandidates = Array.from(document.querySelectorAll('.gallery .card-thumb img'))
        .map(img => img.getAttribute('src') || '')
        .filter(Boolean)
        .map(src => src.replace('/thumbs/', '/original/'))
      const pageLinks = Array.from(document.querySelectorAll('.gallery .card-title'))
        .map(a => a.getAttribute('href') || '')
        .filter(Boolean)

      if(hero && slideA && slideB){
        const resolveRelative = (src, baseHref) => {
          try{
            const pageUrl = new URL(baseHref, window.location.href)
            return new URL(src, pageUrl.href).href
          }catch(e){
            return src
          }
        }

        const collectSourcesFromSubpage = async pageHref => {
          try{
            const response = await fetch(pageHref, { cache: 'no-store' })
            if(!response.ok) return []
            const html = await response.text()
            const doc = new DOMParser().parseFromString(html, 'text/html')
            // Keep only originals from viewer links (?img=assets/.../original/...).
            return Array.from(doc.querySelectorAll('.gallery a[href*="viewer.html?img="]'))
              .map(a => a.getAttribute('href') || '')
              .map(href => {
                try{
                  const linkUrl = new URL(href, window.location.href)
                  const imgParam = linkUrl.searchParams.get('img') || ''
                  const decoded = decodeURIComponent(imgParam)
                  if(!decoded.includes('/original/') && !decoded.includes('/orignal/')) return ''
                  // Keep full nested path under original/orignal (all levels).
                  return resolveRelative(decoded, pageHref)
                }catch(e){
                  return ''
                }
              })
              .filter(Boolean)
          }catch(e){
            return []
          }
        }

        const collectOriginalsFromHome = () => {
          return Array.from(document.querySelectorAll('.gallery a[href*="viewer.html?img="]'))
            .map(a => a.getAttribute('href') || '')
            .map(href => {
              try{
                const linkUrl = new URL(href, window.location.href)
                const imgParam = linkUrl.searchParams.get('img') || ''
                const decoded = decodeURIComponent(imgParam)
                if(!decoded.includes('/original/') && !decoded.includes('/orignal/')) return ''
                return resolveRelative(decoded, window.location.href)
              }catch(e){
                return ''
              }
            })
            .filter(Boolean)
        }

        const startSlideshow = sourceCandidates => {
          const candidates = Array.from(new Set(sourceCandidates))

          if(!candidates.length) return

          const imageExists = src => new Promise(resolve => {
            const probe = new Image()
            probe.onload = () => resolve(true)
            probe.onerror = () => resolve(false)
            probe.src = src
          })

          // Keep order and skip missing files.
          Promise.all(candidates.map(async src => {
            if(await imageExists(src)) return src
            return ''
          })).then(results => {
            const orderedSources = results.filter(Boolean)
            if(!orderedSources.length) return

            let activeSlide = slideA
            let inactiveSlide = slideB
            let currentIndex = 0

            const setSlideSource = (slide, src) => {
              slide.setAttribute('src', src)
              slide.classList.add('is-visible')
            }

            setSlideSource(activeSlide, orderedSources[currentIndex])

            if(orderedSources.length < 2) return
            window.setInterval(()=>{
              currentIndex = (currentIndex + 1) % orderedSources.length
              inactiveSlide.setAttribute('src', orderedSources[currentIndex])
              inactiveSlide.classList.add('is-visible')
              activeSlide.classList.remove('is-visible')

              const tmp = activeSlide
              activeSlide = inactiveSlide
              inactiveSlide = tmp
            }, 2000)
          })
        }

        if(!pageLinks.length){
          startSlideshow(homeOriginalCandidates)
          return
        }

        Promise.all(pageLinks.map(link => collectSourcesFromSubpage(link))).then(pageResults => {
          // Strictly originals/orignal only. If subpage crawling fails (common on file://),
          // fallback to original paths inferred from homepage thumbnails.
          const fromSubpages = pageResults.flat()
          const fromHomeViewerLinks = collectOriginalsFromHome()
          const allOriginalCandidates = [...fromSubpages, ...fromHomeViewerLinks, ...homeOriginalCandidates]
          startSlideshow(allOriginalCandidates)
        }).catch(()=>{
          startSlideshow(homeOriginalCandidates)
        })
      }
    }
  }catch(e){/* ignore */}

  // On subpages, arrange images intelligently by comparing natural widths
  try{
    const path = window.location.pathname || ''
    const file = path.split('/').pop() || ''
    if(file !== 'index.html'){
      const imgEls = Array.from(document.querySelectorAll('.gallery a img'))
      if(imgEls.length){
        // Wait until all images have loaded to read natural sizes
        const whenAllLoaded = imgEls.map(img => new Promise(resolve => {
          if(img.complete) return resolve(img)
          img.addEventListener('load', ()=> resolve(img))
          img.addEventListener('error', ()=> resolve(img))
        }))
        Promise.all(whenAllLoaded).then(imgs => {
          const widths = imgs.map(i => i.naturalWidth || 0).filter(w=>w>0)
          const ratios = imgs.map(i => (i.naturalWidth && i.naturalHeight) ? (i.naturalWidth / i.naturalHeight) : 0).filter(r=>r>0)
          if(!widths.length || !ratios.length) return
          // medians
          widths.sort((a,b)=>a-b)
          ratios.sort((a,b)=>a-b)
          const midW = Math.floor(widths.length/2)
          const medianW = widths.length%2 ? widths[midW] : (widths[midW-1]+widths[midW])/2
          const midR = Math.floor(ratios.length/2)
          const medianR = ratios.length%2 ? ratios[midR] : (ratios[midR-1]+ratios[midR])/2
          // thresholds
          const WIDTH_THRESH = 1.4
          const RATIO_THRESH = Math.max(1.8, medianR * 1.5)
          imgs.forEach(img => {
            const w = img.naturalWidth || 0
            const r = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 0
            if(w > medianW * WIDTH_THRESH || r > RATIO_THRESH){
              const a = img.closest('a')
              if(a) a.classList.add('gallery-large')
            }
          })

          // Reorder gallery deterministically to avoid single-image rows
          const gallery = document.querySelector('.gallery')
          if(gallery){
            const reorderGallery = () => {
              const items = Array.from(gallery.querySelectorAll(':scope > a'))
              if(!items.length) return

              const isWide = el => el.classList.contains('gallery-large') || el.classList.contains('gallery-wide')
              const head = []
              const wides = []
              const tail = []
              let buffer = []

              const flushBufferToHead = () => { if(buffer.length === 3){ head.push(...buffer); buffer = [] } }
              const flushBufferToTail = () => { if(buffer.length){ tail.push(...buffer); buffer = [] } }

              for(const it of items){
                if(isWide(it)){
                  // if buffer has incomplete row, move it to tail so we don't create a single-item row before a wide
                  if(buffer.length && buffer.length !== 3){ flushBufferToTail() }
                  // if buffer has full row, move to head
                  if(buffer.length === 3){ flushBufferToHead() }
                  buffer = []
                  wides.push(it)
                }else{
                  buffer.push(it)
                  if(buffer.length === 3){ flushBufferToHead() }
                }
              }

              // leftover buffer -> tail
              if(buffer.length){ flushBufferToTail() }

              const newOrder = []
              newOrder.push(...head)
              newOrder.push(...wides)
              newOrder.push(...tail)

              // Apply only if changed
              let changed = false
              if(newOrder.length === gallery.children.length){
                for(let i=0;i<newOrder.length;i++){
                  if(gallery.children[i] !== newOrder[i]){ changed = true; break }
                }
              }else{ changed = true }
              if(changed){ newOrder.forEach(n => gallery.appendChild(n)) }
            }

            // run after small delay to ensure layout is stable
            setTimeout(reorderGallery, 120)
            let resizeTimer = null
            window.addEventListener('resize', ()=>{
              clearTimeout(resizeTimer)
              resizeTimer = setTimeout(reorderGallery, 160)
            })
          }
        })
      }
    }
  }catch(e){/* ignore */}
})
