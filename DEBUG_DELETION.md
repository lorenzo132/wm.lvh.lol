# Debugging Deletion Issues

If deletion is not working, follow these steps to debug:

## 1. Check Server Environment Variable

Visit `http://localhost:3001/api/test` in your browser to see if the upload password is configured.

Expected response:
```json
{
  "message": "Server is running!",
  "timestamp": "...",
  "uploadPasswordConfigured": true,
  "uploadPasswordLength": 8
}
```

If `uploadPasswordConfigured` is `false`, check your `.env` file.

## 2. Check Browser Console

1. Open browser developer tools (F12)
2. Go to Console tab
3. Try to delete a file (hold Ctrl+Shift, click delete, enter password)
4. Look for these log messages:
   - "Deleting media: ..."
   - "Media URL: ..."
   - "Extracted filename: ..."
   - "Deleting file: ..."
   - "Password provided: ***"
   - "Delete response status: ..."
   - "Delete API result: ..."

## 3. Check Server Console

Look at your server terminal for these messages:
- "Delete request received for: filename.jpg"
- "Request body: { password: '***' }"
- "Provided password: ***"
- "Expected password: ***"
- "File deleted: filename.jpg"

## 4. Test with curl

```bash
# First, get list of files
curl http://localhost:3001/api/files

# Then try to delete a file (replace FILENAME and PASSWORD)
curl -X DELETE http://localhost:3001/api/files/FILENAME \
  -H "Content-Type: application/json" \
  -d '{"password":"PASSWORD"}'
```

## 5. Common Issues

1. **Password not set**: Make sure `UPLOAD_PASSWORD` is in your `.env` file
2. **Wrong password**: The password you enter must match `UPLOAD_PASSWORD`
3. **Server not restarted**: Restart the server after changing `.env`
4. **File not found**: The filename might be URL-encoded incorrectly

## 6. Environment Variables

Make sure your `.env` file has:
```
UPLOAD_PASSWORD=your-password-here
VITE_UPLOAD_PASSWORD=your-password-here
```

The frontend uses `VITE_UPLOAD_PASSWORD` for uploads, but deletion uses the user-entered password. 