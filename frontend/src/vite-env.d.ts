/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_BASEWILL_CONTRACT_ADDRESS: string
  readonly VITE_NOTARY_REGISTRY_ADDRESS: string
  readonly VITE_API_URL: string
  readonly VITE_NETWORK: string
  readonly VITE_BASE_RPC_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
