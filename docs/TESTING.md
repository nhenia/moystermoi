# Testing your app

## Automatic checks

Run `node scripts/prepare.cjs`, then `node tests/app.test.cjs`. GitHub's publishing workflow runs both before deployment. No packages need installing.

These are lightweight tests with a simulated browser document and storage. They cover saving, reopening, original timestamps after editing, blank input, literal HTML text, failed writes, deletion, invalid stored data, settings and required assets. They do not prove how the app looks or whether a specific phone can install it.

## Browser checks before handoff

Use disposable sample entries, not important notes.

- Open at a phone width (around 375px) and desktop width. Check long text, a long app name and enlarged text. Nothing should overlap or require sideways scrolling.
- Save two different entries. Confirm newest first and readable timestamps.
- Reload and close/reopen the app. Confirm the entries remain.
- Edit one entry. Check its text changes and original timestamp stays the same.
- Cancel an edit. Confirm the stored entry is unchanged.
- Cancel a deletion, then delete a sample. Confirm the intended result each time.
- Use Tab and Enter to reach controls. Check visible focus and field labels.
- Visit online, then stop the local server or disconnect from the network and reload. Confirm offline opening. Save another sample offline and reload.
- After deployment, open the repository subdirectory address and check every asset loads.
- Try installation on the actual phone. Do not claim a desktop preview proves phone installation.

## Record what happened

Write the date, browser, checks completed, and remaining limitations in the finished-app handoff. When adding new behavior, add focused tests for it. Do not treat an unchanged inherited test suite as proof of newly added features.
