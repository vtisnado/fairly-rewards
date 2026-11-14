interface ImportMetaEnv {
  readonly PUBLIC_NEAR_NETWORK: string;
  readonly PUBLIC_NEAR_RPC_URL?: string;
  readonly PUBLIC_NEAR_FALLBACK_RPC_URL?: string;
  readonly PUBLIC_FAIRLY_CONTRACT: string;
  readonly PUBLIC_TUSDC_CONTRACT: string;
  readonly PUBLIC_APP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
