# Hidden Deletion Feature

The gallery includes a hidden deletion feature that allows users with the upload password to delete media files.

## How to Use

1. **Hold Ctrl+Shift** while hovering over any media card
2. A red "Delete" button will appear in the overlay
3. Click the delete button
4. Enter the upload password when prompted
5. The file will be deleted from both the server and local storage

## Security

- Deletion requires the same password used for uploads (`UPLOAD_PASSWORD` environment variable)
- The delete button is only visible when holding Ctrl+Shift
- All deletion attempts are logged on the server
- Files are permanently deleted from the server's `/uploads` directory

## Technical Details

- The delete button appears dynamically when the key combination is detected
- Password validation happens on the server side
- Failed deletion attempts show error messages
- Successful deletions update the gallery immediately

## Environment Variables

Make sure both environment variables are set:
- `VITE_UPLOAD_PASSWORD` (frontend - for upload modal)
- `UPLOAD_PASSWORD` (backend - for upload and delete validation)

## API Endpoint

The deletion uses the `DELETE /api/files/:filename` endpoint with password validation in the request body. 