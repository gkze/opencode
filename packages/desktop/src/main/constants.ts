import { app } from "electron"
import { Fork } from "../../fork"
import { resolveIdentity, type Channel } from "./identity"

export const FORK_BUILD = import.meta.env.OPENCODE_FORK === true

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const identity = resolveIdentity(CHANNEL, app.isPackaged)
const fork = FORK_BUILD && app.isPackaged

export const APP_NAME = fork ? Fork.name : identity.appName

export const APP_ID = fork ? Fork.id : identity.appID

export const APP_USER_MODEL_ID = fork ? Fork.id : identity.appUserModelID
