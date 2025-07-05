/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UPLOAD_PASSWORD: string
  readonly VITE_API_URL?: string
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
