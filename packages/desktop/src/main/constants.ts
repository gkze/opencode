import { app } from "electron"
import { resolveIdentity, type Channel } from "./identity"
import { Fork } from "../../fork"

export const FORK_BUILD = import.meta.env.OPENCODE_FORK === true

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const identity = resolveIdentity(CHANNEL, app.isPackaged)

// Packaged fork builds keep their own identity so updates and profiles stay isolated from upstream.
const forkPackaged = FORK_BUILD && app.isPackaged

export const APP_NAME = forkPackaged ? Fork.name : identity.appName

export const APP_ID = forkPackaged ? Fork.id : identity.appID

export const APP_USER_MODEL_ID = forkPackaged ? Fork.id : identity.appUserModelID
