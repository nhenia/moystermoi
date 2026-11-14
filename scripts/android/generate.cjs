// Turns android/twa-manifest.json into an Android project (a "Trusted Web Activity": the live
// Clutched site full-screen, no browser bar). Run by .github/workflows/android-package.yml.
const path = require("node:path")
const { TwaGenerator, TwaManifest, ConsoleLog } = require("@bubblewrap/core")

const root = path.resolve(__dirname, "../..")
const out = path.resolve(process.argv[2] || path.join(root, "android", "build"))
const manifest = new TwaManifest(require(path.join(root, "android", "twa-manifest.json")))
const problem = manifest.validate()
if (problem) throw new Error(`twa-manifest.json: ${problem}`)
new TwaGenerator()
  .createTwaProject(out, manifest, new ConsoleLog("android"))
  .then(() => console.log(`Android project written to ${out}`))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
