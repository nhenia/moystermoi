// Tests for the weekly shell-giving check. Run: node --test scripts/shell-check/
// The partner text below is copied from CRCL's restaurant partner page (read 2026-11-17).
import test from "node:test"
import assert from "node:assert/strict"
import { onPartnerList, partnerListReadable, givingMentions, applyShells } from "./lib.mjs"

const CRCL = `Restaurant Partners
Acamaya Acamaya
3070 Dauphine St, New Orleans, LA 70117
Bourbon House
144 Bourbon St, New Orleans, LA 70130
Clesi's Seafood
4323 Bienville St, New Orleans, LA 70119
Deanie's Seafood Restaurant
1713 Lake Ave, Metairie, LA 70005 & 841 Iberville St, New Orleans, LA 70112
Pascal's Manale
1838 Napoleon Ave, New Orleans, LA 70115
Acme Oyster House
3000 Veterans Blvd, Metairie, LA 70002
Cooter Brown's Tavern
509 S. Carrollton Ave, New Orleans, LA 70118
Felix's Restaurant and Oyster Bar
739 Iberville St, New Orleans, LA 70130 & 7400 Lakeshore Dr, New Orleans, LA 70124
New Orleans Creole Cookery
510 Toulouse St, New Orleans, LA 70130
Pêche Seafood Grill
800 Magazine St, New Orleans, LA 70130
The Salted Pearl
St Roch Market, 2381 St. Claude Ave, New Orleans, LA 70117
Red Fish Grill
115 Bourbon St, New Orleans, LA 70130`

const v = (name, address) => ({ id: name.toLowerCase().replace(/\W+/g, "-"), name, address: `${address}, New Orleans, LA` })

test("a restaurant at its listed address is a partner", () => {
  assert.equal(onPartnerList(v("Bourbon House", "144 Bourbon St"), CRCL).status, "partner")
  assert.equal(onPartnerList(v("Pêche", "800 Magazine St"), CRCL).status, "partner")
  assert.equal(onPartnerList(v("Cooter Brown's", "509 S Carrollton Ave"), CRCL).status, "partner") // "S." vs "S"
  assert.equal(onPartnerList(v("The Salted Pearl (St. Roch Market)", "2381 St Claude Ave"), CRCL).status, "partner")
  assert.equal(onPartnerList(v("Deanie's Seafood", "841 Iberville St"), CRCL).status, "partner") // second address on the line
})

test("a second location under a different name still counts when its own address is listed", () => {
  assert.equal(onPartnerList(v("Felix's Lakefront", "7400 Lakeshore Dr"), CRCL).status, "partner")
  assert.equal(onPartnerList(v("Felix's Restaurant & Oyster Bar", "739 Iberville St"), CRCL).status, "partner")
})

test("same name on the same street (a door-number difference) counts, and says so", () => {
  const r = onPartnerList(v("New Orleans Creole Cookery", "508 Toulouse St"), CRCL)
  assert.equal(r.status, "partner")
  assert.match(r.why, /510 Toulouse/i)
})

test("only another location of the same restaurant recycles: not a partner, flagged for a person", () => {
  const r = onPartnerList(v("Acme Oyster House", "724 Iberville St"), CRCL)
  assert.equal(r.status, "other-location")
})

test("a neighbour's address or a shared word is not enough", () => {
  assert.equal(onPartnerList(v("Monday Restaurant & Bar", "4327 Bienville St"), CRCL).status, "no") // Clesi's is 4323
  assert.equal(onPartnerList(v("Galatoire's", "209 Bourbon St"), CRCL).status, "no") // same street as Bourbon House
  assert.equal(onPartnerList(v("Luke", "333 St Charles Ave"), CRCL).status, "no")
})

test("the partner page must look like a real list before anything is changed", () => {
  assert.equal(partnerListReadable(CRCL), true)
  assert.equal(partnerListReadable("Just a moment... checking your browser"), false)
  assert.equal(partnerListReadable(""), false)
})

test("finds charity and shell-recycling mentions on a restaurant's own pages, with the words around them", () => {
  const pages = [
    { url: "https://x.com/about", text: "We are proud partners of the Coalition to Restore Coastal Louisiana. Every shell goes back to the reef." },
    { url: "https://x.com/menu", text: "Raw oysters $2 each. Chargrilled $18." },
  ]
  const m = givingMentions(pages)
  assert.equal(m.length, 1)
  assert.equal(m[0].url, "https://x.com/about")
  assert.match(m[0].words, /Coalition to Restore Coastal Louisiana/)
  assert.deepEqual(givingMentions([{ url: "u", text: "Shell Beach Drive. Royal Dutch Shell. Oyster bar." }]), [])
  assert.equal(givingMentions([{ url: "u", text: "Ask us about our oyster shell recycling program!" }]).length, 1)
})

test("applying results: adds partners, removes dropped ones, leaves everything else alone", () => {
  const venues = [
    { id: "a", name: "A", shells: { via: "CRCL", source: "https://crcl.org/osrp-restaurants", checked: "2026-11-01" } },
    { id: "b", name: "B" },
    { id: "c", name: "C", note: "keep me" },
  ]
  const out = applyShells(venues, { a: "no", b: "partner", c: "other-location" }, "2026-11-17", "https://crcl.org/osrp-restaurants")
  assert.equal(out[0].shells, undefined)
  assert.deepEqual(out[1].shells, { via: "CRCL", source: "https://crcl.org/osrp-restaurants", checked: "2026-11-17" })
  assert.deepEqual(out[2], { id: "c", name: "C", note: "keep me" })
})
