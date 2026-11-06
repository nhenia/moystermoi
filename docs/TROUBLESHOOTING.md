# Troubleshooting

**My page says 404.** Check that Pages uses GitHub Actions and the latest Publish micro-app run is green. Use the exact address from Settings → Pages, including your repository name. First publication can take a few minutes.

**I do not see a workflow.** Check the repository contains `.github/workflows/pages.yml`. Template copies include this folder. ZIP uploads may omit hidden folders; use the template button when possible. Enable Actions if GitHub offers that option.

**Publishing failed.** Open Actions, click the failed run and open the red step. A settings error usually means a missing quote, comma or color value in config.js. Restore the last working edit or show the error to your assistant.

**I changed the settings but the phone still shows the old name.** Wait for a successful publish, visit online, close all tabs and app windows, then reopen. Installed apps may refresh names and icons slowly; reinstalling may be necessary and can affect locally stored data. Do not clear storage just to refresh the design.

**My app works online but not offline.** Visit online first and allow the files to load. Use HTTPS or localhost, not a double-clicked file. Check that sw.js and every file in its asset list exist. Newly added files must also be included in preparation and deployment.

**My entries disappeared.** Check the browser, account profile, published address and device. Changing storageId or the repository path changes the storage location. Private browsing and clearing site data can remove entries. The app has no server backup.

**Could not save.** Storage may be blocked or full. Copy the unsaved text before closing. The app leaves it in the writing field rather than claiming it was saved.

**My new app still has the old app's behavior.** Changing labels only changes labels. Fill in APP-BRIEF.md and ask your assistant to implement the required fields and actions.

**How do I make a downloaded folder into a GitHub template?** Create a repository, upload all its contents including hidden files/folders, then choose Settings → General → Template repository. After that, use Use this template for each new app. Merely naming a repository template does not enable the template button.
