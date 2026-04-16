declare var Bun:
  | {
      file(path: string): {
        text(): Promise<string>
        json(): Promise<unknown>
      }
      write(path: string, content: string | Uint8Array): Promise<void>
    }
  | undefined
