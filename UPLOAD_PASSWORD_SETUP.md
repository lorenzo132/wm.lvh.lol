# Upload password

Set `UPLOAD_PASSWORD` in the server environment or `.env`, then restart the server. Users enter this password when uploading, editing, or deleting media. No password is needed in the frontend build.

Remove the old `VITE_UPLOAD_PASSWORD` setting. If a previous frontend build contained your real password, change `UPLOAD_PASSWORD` and rebuild/redeploy the frontend to remove the exposed value.

Uploads authenticate before file data is accepted, using `Authorization: Bearer <URL-encoded password>`. The gallery sends this automatically. API integrations must send this header and one file per request. Editing and deletion continue to accept the password in their JSON request body.

`VITE_API_URL` optionally selects a separate API host; otherwise production uses the current origin and development uses `http://localhost:3001`. For a separate frontend host, add its origin to the server's comma-separated `FRONTEND_ORIGINS` setting. Local Vite origins on port 8080 are supported by default.

The backend also requires MongoDB. Install dependencies with `npm ci`, configure `MONGO_URI`, and start with `npm run server`. Optional video previews and dimensions require `ffmpeg` and `ffprobe`; unsupported video codecs do not prevent uploads.
