import { createEffect, onCleanup, Show } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Keybind } from "@opencode/ui/keybind"
import { Tooltip } from "@opencode/ui/tooltip"
import { useCommand } from "@/shell/commands/command"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useSettings } from "@/settings/model"
import { sidebarUnread } from "@/shell/sidebar-peek"

// The toggle's dot for sidebar sessions with unread activity, shown while the sidebar is closed.
function UnreadBadge(props: { show: boolean; ring: "base" | "deep" }) {
  return (
    <Show when={props.show}>
      <span
        data-slot="sidebar-toggle-unread"
        aria-hidden="true"
        class="pointer-events-none absolute -top-0.5 -end-0.5 size-[7px] rounded-full bg-v2-background-bg-accent"
        classList={{
          "shadow-[0_0_0_1.5px_var(--v2-background-bg-base)]": props.ring === "base",
          "shadow-[0_0_0_1.5px_var(--v2-background-bg-deep)]": props.ring === "deep",
        }}
      />
    </Show>
  )
}

// The desktop window sets `trafficLightPosition: { x: 14, y: 14 }`. macOS 26 and later draw 14px buttons on a 23px
// pitch, so from there the zoom button ends 74px from the window edge. macOS 15 and earlier end at 68px.
const macTrafficLightsBaseWidth = 74

// Vertical tabs center the traffic lights on the window corner's visual radius. macOS draws the 16pt corner as a
// continuous curve that blends into the straight edges about 1.5 radii out, so a center there nests the lights in the
// corner as it reads, where macOS's own position (concentric with the nominal 16pt) hugs it. The sidebar header's
// 48pt row shares this center line. Window chrome doesn't scale with zoom, so neither does this. Window points.
const macTrafficLightsCenterLine = 1.5 * 16

// `width` is where the zoom button ends. The 14pt lights are positioned by their top-start corner.
const macVerticalTrafficLightsInset = macTrafficLightsCenterLine - 7
export const macVerticalTrafficLights = {
  x: macVerticalTrafficLightsInset,
  y: macVerticalTrafficLightsInset,
  width: macVerticalTrafficLightsInset + macTrafficLightsBaseWidth - 14,
}

/** The traffic lights' center line in CSS pixels, held low enough that a 28px control centered on it stays inside the window. */
export function macTrafficLightsCenter(zoom: number) {
  return Math.max(macTrafficLightsCenterLine / zoom, 14)
}

// Matches the horizontal titlebar, whose first control starts 16px past the traffic lights.
const macTrafficLightsGap = 16

// The toggle's 28px plus a 4px gap before the header contents.
const slotWidth = 32

// The shell's 8px inline inset plus the session header's 10px start padding.
const contentStart = 18

/** Where the collapsed toggle's slot ends without traffic lights, in pixels from the window's start edge. */
export const collapsedSidebarToggleEnd = contentStart + slotWidth

/**
 * `handoff` makes this one of the two vertical-tabs toggles that read as one icon: "out" sits in the sidebar's header
 * and shows only while the sidebar rests open; "in" shows otherwise, travelling from the header's spot to the
 * collapsed one on the sidebar's spring as its glyph turns from the open one to the closed one.
 */
export function SidebarToggle(props: { handoff?: "out" | "in" }) {
  const command = useCommand()
  const language = useLanguage()
  const settings = useSettings()
  const keybind = () => command.keybindParts("sidebar.toggle")
  const side = props.handoff
  let full: SVGSVGElement | undefined
  let outline: HTMLSpanElement | undefined
  const unread = () => !settings.appearance.sidebarOpen() && sidebarUnread()

  const paints = {
    out: (button: HTMLElement, closed: number) => {
      travel.header = button
      button.style.opacity = closed === 0 ? "" : "0"
    },
    in: (button: HTMLElement, closed: number) => {
      travel.toggle = button
      const moving = closed > 0 && closed < 1
      travel.dx = moving ? travel.x * (1 - closed) : 0
      travel.dy = moving ? travel.y * (1 - closed) : 0
      button.style.opacity = closed === 0 ? "0" : ""
      button.style.transform = moving ? `translate3d(${travel.dx}px, ${travel.dy}px, 0)` : ""

      if (full) full.style.opacity = `${1 - closed}`

      if (outline) outline.style.opacity = `${closed}`
    },
  }

  const ref = side ? collapsedRef(paints[side]) : undefined

  return (
    <Tooltip
      class="shrink-0 [app-region:no-drag]"
      placement="bottom"
      // Held shut while the closed sidebar peeks on hover, where it would cover the peek.
      forceOpen={!settings.appearance.sidebarOpen() ? false : undefined}
      value={
        <>
          {language.t("command.sidebar.toggle")}
          <Show when={keybind().length > 0}>
            <Keybind keys={keybind()} variant="neutral" />
          </Show>
        </>
      }
    >
      <IconButton
        ref={ref}
        type="button"
        variant="ghost-muted"
        size="large"
        class="shrink-0"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => settings.appearance.setSidebarOpen(!settings.appearance.sidebarOpen())}
        aria-label={language.t(unread() ? "command.sidebar.toggle.unread" : "command.sidebar.toggle")}
        aria-expanded={settings.appearance.sidebarOpen()}
        aria-controls="vertical-tabs-sidebar"
        icon={
          side === "in" ? (
            <span class="relative flex">
              <Icon ref={full} name="layout-left-full" />
              <span ref={outline} class="absolute inset-0 flex">
                <Icon name="layout-left" />
                <UnreadBadge show={unread()} ring="base" />
              </span>
            </span>
          ) : (
            <span class="relative flex">
              <Icon
                name={
                  side === "out" || (!side && settings.appearance.sidebarOpen()) ? "layout-left-full" : "layout-left"
                }
              />
              <UnreadBadge show={!side && unread()} ring="deep" />
            </span>
          )
        }
      />
    </Tooltip>
  )
}

// Where the collapsed sidebar's toggle sits at the start of the content area. Windows keeps its titlebar in vertical
// tabs mode, so the toggle lives there instead.
function useCollapsedSlot() {
  const platform = usePlatform()
  const settings = useSettings()
  const desktop = createMediaQuery("(min-width: 768px)")
  const windows = () => platform.platform === "desktop" && platform.os === "windows"
  const mac = () => platform.platform === "desktop" && platform.os === "macos" && !platform.windowFullscreen?.()

  return {
    visible: () => desktop() && !windows() && settings.appearance.tabLayout() !== "horizontal",
    open: settings.appearance.sidebarOpen,
    // Beside the traffic lights, the 28px toggle shares their center line, as the sidebar header's does.
    top: () => (mac() ? `${macTrafficLightsCenter(platform.webviewZoom?.() ?? 1) - 14}px` : undefined),
    // Lays the toggle out as if the traffic lights were the header's first control.
    width: () =>
      mac()
        ? macVerticalTrafficLights.width / (platform.webviewZoom?.() ?? 1) +
          macTrafficLightsGap -
          contentStart +
          slotWidth
        : slotWidth,
  }
}

const slotClass = "flex shrink-0 justify-end overflow-hidden"

// How far closed the left sidebar is, from 0 to 1. The shell paints it on every frame of the sidebar's motion; the
// space headers keep for the collapsed toggle grows with it, so header contents travel with the sidebar's edge.
const collapsed = { closed: 0, slots: new Set<() => void>() }

export function paintCollapsedSlots(closed: number) {
  collapsed.closed = closed
  collapsed.slots.forEach((paint) => paint())
}

// The two vertical-tabs toggles, how far the header one rests from the collapsed one (x, y), and the offset the
// collapsed one is drawn at now (dx, dy).
type Travel = { header?: HTMLElement; toggle?: HTMLElement; x: number; y: number; dx: number; dy: number }

const travel: Travel = {
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
}

/**
 * Measures, in the frame loop's read phase of the sidebar's motion, how far the header toggle rests from the collapsed
 * one. The header toggle rides the sidebar's contents, `offset` pixels short of where it rests open.
 */
export function measureSidebarToggles(offset: number) {
  if (!travel.header?.isConnected || !travel.toggle?.isConnected) return
  const header = travel.header.getBoundingClientRect()
  const toggle = travel.toggle.getBoundingClientRect()
  const direction = document.documentElement.dir === "rtl" ? -1 : 1
  travel.x = header.left + direction * offset - (toggle.left - travel.dx)
  travel.y = header.top - (toggle.top - travel.dy)
}

/** A ref whose element `paint` styles from how far closed the sidebar is, now and on every frame of its motion. */
function collapsedRef(paint: (element: HTMLElement, closed: number) => void) {
  let target: HTMLElement | undefined

  const repaint = () => {
    if (target) paint(target, collapsed.closed)
  }

  collapsed.slots.add(repaint)
  onCleanup(() => collapsed.slots.delete(repaint))
  createEffect(repaint)

  return (element: HTMLElement) => {
    target = element
    repaint()
  }
}

/** A ref for a slot that is `width` wide while the sidebar is closed. */
function slotRef(width: () => number) {
  return collapsedRef((slot, closed) => (slot.style.width = `${width() * closed}px`))
}

// Floats over the top of every screen, centered on the session header's 48px row, or on the traffic lights' line beside
// them, where the content starts once the sidebar has closed. It sits outside the sidebar and the content, so neither
// clips it as it travels.
export function CollapsedSidebarToggle() {
  const slot = useCollapsedSlot()

  return (
    <Show when={slot.visible()}>
      <div
        data-slot="collapsed-sidebar-toggle"
        style={{ width: `${slot.width()}px`, top: slot.top() }}
        class={`absolute top-[calc(var(--shell-top-inset,8px)+10px)] start-[calc(var(--shell-inline-inset,8px)+10px)] z-40 flex shrink-0 justify-end`}
        inert={slot.open()}
      >
        <div class="flex shrink-0 pe-1">
          <SidebarToggle handoff="in" />
        </div>
      </div>
    </Show>
  )
}

// Reserves the floating toggle's room in a header, pushing its contents along while the toggle is shown. `start` is where
// the space begins, in pixels from the content area's start edge, so every header's contents line up after the toggle.
export function CollapsedSidebarToggleSpace(props: { start?: number; class?: string }) {
  const slot = useCollapsedSlot()
  const ref = slotRef(() => slot.width() + contentStart - (props.start ?? contentStart))

  return (
    <Show when={slot.visible()}>
      <div ref={ref} aria-hidden="true" class={`${slotClass} ${props.class ?? ""}`} />
    </Show>
  )
}
