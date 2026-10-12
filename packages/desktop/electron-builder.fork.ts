import base from "./electron-builder.config"
import { Fork } from "./fork"
import type { Configuration } from "electron-builder"

if (process.env.OPENCODE_CHANNEL !== "dev" || process.env.OPENCODE_FORK !== "1")
  throw new Error("Fork desktop builds require OPENCODE_CHANNEL=dev and OPENCODE_FORK=1")

export default {
  ...base,
  appId: Fork.id,
  productName: Fork.name,
  protocols: [],
  publish: null,
  mac: {
    ...base.mac,
    identity: "-",
    notarize: false,
  },
} satisfies Configuration
