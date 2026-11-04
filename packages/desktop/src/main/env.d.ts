interface ImportMetaEnv {
  readonly OPENCODE_FORK: boolean
  readonly OPENCODE_CHANNEL: string
  readonly OPENCODE_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
