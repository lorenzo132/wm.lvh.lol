# Gallery loading

- The gallery mounts at most 24 cards per page. Search, date filters, and sorting still cover the entire collection.
- Preview URLs are assigned only when a card comes within 160px of the viewport. A shared queue permits four concurrent preview loads, with low browser priority.
- Leaving a page cancels its queued and active preview work. Failed or stalled requests release their slot; stalled requests time out after 30 seconds.
- Videos use the existing server thumbnail or a placeholder. The gallery never downloads video files to generate thumbnails. The viewer uses `preload="none"`, so playback starts on request.
- Image previews prefer existing thumbnails. Older images without thumbnails still load their original, subject to the same visibility and concurrency limits. Generating thumbnails for those images would reduce bytes further.
- Viewer and upload code are loaded only when opened. Gallery management uses one pair of keyboard listeners, regardless of collection size.

The API still returns collection metadata in one request. Media loading bounds traffic and rendered cards without migrating stored files. Upload authentication now happens before file data is accepted; see [password setup](UPLOAD_PASSWORD_SETUP.md) for deployment and API integration details.

## Verification

Run `npm ci`, `npx playwright install chromium`, then `npm test`. To use an installed browser, set `PLAYWRIGHT_CHANNEL=msedge` or `chrome`. Browser tests use mocked metadata and media, including a 2,400-item collection; no production uploads, edits, or deletes occur. Desktop/mobile screenshots are saved under `test-results/`.

Also run `npm run build` and `npx tsc --noEmit -p tsconfig.app.json`.

`npm run test:server` tests authentication, upload cleanup, metadata validation, deletion failure handling, and large upload batches using a temporary directory and mocked database/storage operations. It never connects to production MongoDB or S3.
