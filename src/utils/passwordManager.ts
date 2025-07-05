const SESSION_KEY = "gallery-upload-session";
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

// Get the upload password from environment variable
const getEnvUploadPassword = (): string | null => {
  return import.meta.env.VITE_UPLOAD_PASSWORD || null;
};

export const setUploadPassword = (password: string) => {
  // This function is kept for compatibility but now uses env var
  console.warn("setUploadPassword is deprecated. Use VITE_UPLOAD_PASSWORD environment variable instead.");
};

export const getUploadPassword = (): string | null => {
  return getEnvUploadPassword();
};

export const hasUploadPassword = (): boolean => {
  return getEnvUploadPassword() !== null;
};

export const removeUploadPassword = () => {
  // This function is kept for compatibility but environment variable cannot be removed from client
  console.warn("removeUploadPassword is deprecated. Environment variable cannot be removed from client.");
  localStorage.removeItem(SESSION_KEY);
};

export const setUploadSession = () => {
  const session = {
    timestamp: Date.now(),
    expires: Date.now() + SESSION_DURATION
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const isUploadSessionValid = (): boolean => {
  const sessionData = localStorage.getItem(SESSION_KEY);
  if (!sessionData) return false;

  try {
    const session = JSON.parse(sessionData);
    return Date.now() < session.expires;
  } catch {
    return false;
  }
};

export const clearUploadSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getSessionTimeRemaining = (): number => {
  const sessionData = localStorage.getItem(SESSION_KEY);
  if (!sessionData) return 0;

  try {
    const session = JSON.parse(sessionData);
    const remaining = session.expires - Date.now();
    return Math.max(0, remaining);
  } catch {
    return 0;
  }
};