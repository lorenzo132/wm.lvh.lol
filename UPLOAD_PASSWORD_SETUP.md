# Upload Password Setup

This gallery now uses environment variables for upload password protection instead of localStorage.

## Setup Instructions

1. Create a `.env` file in the root directory of your project
2. Add the following line to your `.env` file:

```
VITE_UPLOAD_PASSWORD=your_secure_password_here
```

Replace `your_secure_password_here` with your actual password.

## Security Notes

- The password is stored in the environment variable `VITE_UPLOAD_PASSWORD`
- Only users who know this password can upload media to the gallery
- The password is validated on the client side
- For production use, consider implementing server-side validation as well

## Example .env file

```
# Upload password for the gallery
VITE_UPLOAD_PASSWORD=my_secure_gallery_password_123
```

## Important

- Add `.env` to your `.gitignore` file to prevent the password from being committed to version control
- Restart your development server after creating the `.env` file
- The password must be at least 6 characters long

## Troubleshooting

If you see "No upload password has been configured" error:
1. Make sure your `.env` file exists in the project root
2. Make sure the variable name is exactly `VITE_UPLOAD_PASSWORD`
3. Restart your development server
4. Check that the password is not empty 