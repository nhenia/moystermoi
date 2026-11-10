// Asks an AI model to read a restaurant's own web pages and pull out oyster prices, happy hour,
// hours and address, each with the exact words it read them from (checked later in lib.mjs).
//
// Two ways to run it, picked automatically:
//   1. ANTHROPIC_API_KEY repository secret set  -> Claude (reads more of each site, best at messy menus).
//   2. Otherwise                                -> GitHub Models, free with the workflow's own token.

const quote = { type: "string", description: "Exact words copied from the page that show this. Never paraphrase." }
const url = { type: "string", description: "The page URL the quote is on (one of the URLs given)." }
const nul = (schema) => ({ anyOf: [schema, { type: "null" }] })
const priceSet = (keys) =>
  nul({
    type: "object",
    properties: { ...Object.fromEntries(keys.map((k) => [k, nul({ type: "number" })])), quote, url },
    required: [...keys, "quote", "url"],
    additionalProperties: false,
  })

export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    oyster_items: {
      type: "array",
      description: "Every dish on the menu that contains oysters, with its price exactly as printed.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Dish name, short, as on the menu" },
          price: { type: "string", description: 'Price as printed, e.g. "$18 for 6 · $32 a dozen", "$3 each", "Market price", "Free"' },
          quote,
          url,
        },
        required: ["name", "price", "quote", "url"],
        additionalProperties: false,
      },
    },
    raw: { ...priceSet(["each", "half", "dozen"]), description: "Regular (not happy hour) raw oysters on the half shell: price each, per half dozen, per dozen." },
    chargrilled: { ...priceSet(["half", "dozen"]), description: "Regular chargrilled/charbroiled oysters: per half dozen and per dozen." },
    market_price: nul({ type: "object", properties: { value: { type: "boolean" }, quote, url }, required: ["value", "quote", "url"], additionalProperties: false }),
    happy_hour: {
      type: "object",
      description: "An oyster happy hour or oyster special with set days and times. listed=false if none is shown.",
      properties: {
        listed: { type: "boolean" },
        deal: nul({ type: "string", description: 'Short, e.g. "$1.25 raw, $1.75 chargrilled oysters"' }),
        days: nul({ type: "array", items: { type: "integer" }, description: "0=Sunday … 6=Saturday" }),
        start: nul({ type: "string", description: "24-hour HH:MM" }),
        end: nul({ type: "string", description: "24-hour HH:MM" }),
        price: nul({ type: "number", description: "The cheapest oyster deal price" }),
        unit: nul({ type: "string", enum: ["each", "half-dozen", "dozen", "variable"] }),
        quote,
        url,
      },
      required: ["listed", "deal", "days", "start", "end", "price", "unit", "quote", "url"],
      additionalProperties: false,
    },
    hours: nul({
      type: "object",
      description: "Opening hours for THIS location, Sunday first, 7 entries of \"HH:MM-HH:MM\" (24-hour) or \"closed\".",
      properties: { days: { type: "array", items: { type: "string" } }, quote, url },
      required: ["days", "quote", "url"],
      additionalProperties: false,
    }),
    address: nul({ type: "object", properties: { value: { type: "string", description: "Street address only" }, quote, url }, required: ["value", "quote", "url"], additionalProperties: false }),
    closed_for_good: nul({ type: "object", properties: { value: { type: "boolean" }, quote, url }, required: ["value", "quote", "url"], additionalProperties: false }),
  },
  required: ["oyster_items", "raw", "chargrilled", "market_price", "happy_hour", "hours", "address", "closed_for_good"],
  additionalProperties: false,
}

function prompt(venue, pages) {
  return [
    `You are checking the oyster information for ONE restaurant: ${venue.name}, ${venue.address}.`,
    "Below is text from the restaurant's OWN website. Report only what these pages say.",
    "Rules:",
    "- Never guess, never use outside knowledge. If something isn't on the pages, use null / [] / listed=false.",
    "- Every value needs a `quote`: words copied exactly from the page text that contain the value. A quote that isn't on the page makes the value worthless.",
    "- If the site covers several locations, use only the one at the address above; ignore other locations' prices and hours.",
    "- Only dishes that contain oysters. Happy hour only if it includes oysters.",
    "- closed_for_good only if the page plainly says this location has closed permanently or is closing.",
    "",
    ...pages.map((p) => `===== PAGE ${p.url} =====\n${p.text}`),
  ].join("\n")
}

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5"
const GITHUB_MODEL = process.env.GITHUB_MODEL || "openai/gpt-4.1-mini"

export const provider = () => (process.env.ANTHROPIC_API_KEY ? `Claude (${CLAUDE_MODEL})` : `GitHub Models (${GITHUB_MODEL})`)
/** How much page text one request may carry: GitHub's free models accept far less than Claude. */
export const textBudget = () => (process.env.ANTHROPIC_API_KEY ? 60000 : 16000)

async function post(url, headers, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) })
    const text = await res.text()
    if (res.ok) {
      try {
        return JSON.parse(text)
      } catch {
        throw new Error(`unreadable reply (HTTP ${res.status}, ${res.headers.get("content-type")}): ${text.slice(0, 200)}`)
      }
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get("retry-after")) || 20 * attempt
      await new Promise((r) => setTimeout(r, wait * 1000))
      continue
    }
    throw new Error(`${res.status} ${text.slice(0, 300)}`)
  }
}

/** @returns {Promise<object>} an object matching EXTRACTION_SCHEMA */
export async function extract(venue, pages) {
  const text = prompt(venue, pages)
  if (process.env.ANTHROPIC_API_KEY) {
    const content = [{ type: "text", text }]
    const res = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      {
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        tools: [{ name: "report", description: "Report what the restaurant's own pages say.", input_schema: EXTRACTION_SCHEMA }],
        tool_choice: { type: "tool", name: "report" },
        messages: [{ role: "user", content }],
      },
    )
    const call = res.content?.find((c) => c.type === "tool_use")
    if (!call) throw new Error("Claude returned no report")
    return call.input
  }
  if (!process.env.GITHUB_TOKEN) throw new Error("Set ANTHROPIC_API_KEY, or run inside GitHub Actions (GITHUB_TOKEN) to use GitHub Models")
  const body = (model) => ({
    model,
    temperature: 0,
    messages: [{ role: "user", content: text }],
    response_format: { type: "json_schema", json_schema: { name: "report", strict: true, schema: EXTRACTION_SCHEMA } },
  })
  const headers = { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/json" }
  let res
  try {
    res = await post("https://models.github.ai/inference/chat/completions", headers, body(GITHUB_MODEL))
  } catch (e) {
    // GitHub's older address for the same free models
    if (!/unreadable reply|404/.test(e.message)) throw e
    res = await post("https://models.inference.ai.azure.com/chat/completions", headers, body(GITHUB_MODEL.replace(/^[^/]+\//, "")))
  }
  return JSON.parse(res.choices[0].message.content)
}
