// Reads a restaurant's OWN website the way a person would: opens it in a real (headless) browser,
// follows its menu / happy hour / oyster links and menu PDFs, and returns the text.
// It never solves bot checks or CAPTCHAs: a blocked site is reported, not worked around.

import { chromium } from "playwright"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 ClutchedBot/1.0 (+https://github.com/nhenia/clutched)"
const LINK_WORDS = /menu|oyster|happy|raw.?bar|dinner|lunch|food|drink|special|hours|location|visit|about|contact/i
const SKIP = /instagram|facebook|twitter|tiktok|youtube|opentable|resy|tock|toasttab|doordash|ubereats|grubhub|google\.|yelp|tripadvisor|mailto:|tel:|giftcard|gift-card|careers|jobs|privacy|cookie|wp-login|\.(jpg|jpeg|png|gif|webp|svg|mp4)(\?|$)/i
const MAX_PAGES = 8
const MAX_PDFS = 4

/** Second-level domain, so www.x.com, menus.x.com and x.com count as the same site. */
const siteOf = (u) => new URL(u).hostname.replace(/^www\./, "").split(".").slice(-2).join(".")

export async function pdfText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const doc = await getDocument({ data: new Uint8Array(await res.arrayBuffer()), isEvalSupported: false }).promise
  let out = ""
  for (let p = 1; p <= Math.min(doc.numPages, 12); p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    let lastY = null
    for (const item of content.items) {
      const y = Math.round(item.transform[5])
      out += (lastY !== null && Math.abs(y - lastY) > 2 ? "\n" : " ") + item.str
      lastY = y
    }
    out += "\n"
  }
  // Some menus are typeset with letter-spacing ("O Y S T E R S"); join single letters back up.
  return out.replace(/\b(?:[A-Za-z0-9&'’] ){2,}[A-Za-z0-9&'’]\b/g, (m) => m.replace(/ /g, "")).replace(/[ \t]+/g, " ")
}

/** Visible text plus text in closed tabs/accordions (menus often hide prices behind a tab). */
async function pageText(page) {
  return page.evaluate(() => {
    const visible = document.body?.innerText ?? ""
    const hidden = [...document.querySelectorAll("body *")]
      .filter((el) => el.children.length === 0 || el.childElementCount < 4)
      .filter((el) => !el.offsetParent && el.tagName !== "SCRIPT" && el.tagName !== "STYLE" && el.tagName !== "NOSCRIPT")
      .map((el) => el.textContent.trim())
      .filter((t) => t && /\$|oyster|happy|dozen|\d{1,2}(:\d{2})?\s*(am|pm)/i.test(t))
    return visible + "\n" + [...new Set(hidden)].join("\n")
  })
}

async function pageLinks(page) {
  return page.evaluate(() => {
    const links = [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, text: (a.textContent || a.getAttribute("aria-label") || "").trim() }))
    // PDFs mentioned anywhere in the page (flipbook viewers keep them in scripts or data attributes)
    const html = document.documentElement.outerHTML
    const pdfs = [...html.matchAll(/https?:\\?\/\\?\/[^"'\s<>)]+?\.pdf/gi)].map((m) => ({ href: m[0].replace(/\\\//g, "/"), text: "pdf" }))
    const images = [...document.querySelectorAll("img")]
      .filter((i) => /menu/i.test(i.alt + " " + i.src) || (i.naturalWidth > 700 && i.naturalHeight > i.naturalWidth))
      .map((i) => i.currentSrc || i.src)
    return { links: [...links, ...pdfs], images }
  })
}

/**
 * @param {{website?: string, pages?: string[], menu?: {url?: string}, source?: string}} venue
 * @returns {Promise<{pages: {url: string, text: string}[], images: string[], problems: string[]}>}
 */
export async function readSite(browser, venue) {
  const problems = []
  const start = [venue.website, ...(venue.pages ?? [])].filter(Boolean)
  if (!start.length) return { pages: [], images: [], problems: ["no own website on file"] }
  const site = siteOf(start[0])
  const queue = [...start]
  const seen = new Set()
  const pdfs = new Set()
  const pages = []
  const images = new Set()
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 2000 } })
  try {
    while (queue.length && pages.length < MAX_PAGES) {
      const url = queue.shift()
      const key = url.replace(/#.*$/, "").replace(/\/$/, "")
      if (seen.has(key)) continue
      seen.add(key)
      if (/\.pdf(\?|$)/i.test(url)) {
        pdfs.add(url)
        continue
      }
      const page = await context.newPage()
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
        const title = await page.title()
        if (/just a moment|attention required|access denied|verify you are human|captcha/i.test(title) || res?.status() === 403) {
          problems.push(`${url}: the site showed a bot check (not bypassed)`)
          continue
        }
        if (res && res.status() >= 400) {
          problems.push(`${url}: HTTP ${res.status()}`)
          continue
        }
        const finalUrl = page.url()
        pages.push({ url: finalUrl, text: await pageText(page) })
        const { links, images: imgs } = await pageLinks(page)
        imgs.forEach((i) => images.add(i))
        for (const l of links) {
          if (!/^https?:/.test(l.href) || SKIP.test(l.href)) continue
          if (/\.pdf(\?|$)/i.test(l.href) || /\/s\/[^/]+\.pdf/i.test(l.href)) {
            pdfs.add(l.href)
          } else if (siteOf(l.href) === site && LINK_WORDS.test(l.text + " " + new URL(l.href).pathname)) {
            queue.push(l.href)
          }
        }
      } catch (e) {
        // A site's certificate often covers only "www." or only the bare domain: try the other once.
        const alt = url.includes("://www.") ? url.replace("://www.", "://") : url.replace("://", "://www.")
        if (start.includes(url) && !seen.has(alt.replace(/#.*$/, "").replace(/\/$/, "")) && /ERR_CERT|ERR_NAME|ERR_CONNECTION/.test(e.message)) queue.unshift(alt)
        else problems.push(`${url}: ${e.message.split("\n")[0]}`)
      } finally {
        await page.close()
      }
    }
    for (const url of [...pdfs].filter((u) => /menu|oyster|happy|raw|dinner|lunch|food|bar|brunch/i.test(u) || pdfs.size <= MAX_PDFS).slice(0, MAX_PDFS)) {
      try {
        pages.push({ url, text: await pdfText(url) })
      } catch (e) {
        problems.push(`${url}: couldn't read PDF (${e.message})`)
      }
    }
  } finally {
    await context.close()
  }
  return { pages, images: [...images].slice(0, 6), problems }
}

export const launch = () => chromium.launch()
// Some restaurant hosts drop headless Chrome's HTTP/2 connection; a second try over HTTP/1.1 reads them.
export const launchHttp1 = () => chromium.launch({ args: ["--disable-http2"] })
