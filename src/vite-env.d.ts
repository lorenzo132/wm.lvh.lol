/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UPLOAD_PASSWORD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
