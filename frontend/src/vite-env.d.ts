/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the LeadNest API, including the /api/v1 prefix. */
  readonly VITE_API_BASE_URL?: string
  /** Origin of the backend, used by the dev-server proxy. */
  readonly VITE_DEV_API_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
