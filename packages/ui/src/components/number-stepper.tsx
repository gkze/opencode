import type { Component, JSX } from "solid-js"
import { Icon } from "@opencode/ui/icon"
import { useI18n } from "../context/i18n"

export interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  format: (value: number) => string
  "aria-label"?: string
}

const round = (value: number) => Math.round(value * 100) / 100

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const control =
  "flex size-8 items-center justify-center text-icon-base transition-colors hover:bg-surface-base-hover hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-40"

// A bounded numeric input with stepper buttons. Commits on blur so a half-typed value never leaves the field.
export const NumberStepper: Component<NumberStepperProps> = (props) => {
  const i18n = useI18n()
  const change = (value: number) => props.onChange(round(clamp(value, props.min, props.max)))

  const onBlur: JSX.EventHandler<HTMLInputElement, FocusEvent> = (event) => {
    const target = event.currentTarget
    const parsed = Number.parseFloat(target.value)

    if (Number.isFinite(parsed)) change(parsed)

    target.value = props.format(props.value)
  }

  return (
    <div
      data-component="number-stepper"
      class="flex h-8 items-center overflow-hidden rounded-md border border-border-weak-base"
    >
      <button
        type="button"
        class={control}
        onClick={() => change(props.value - props.step)}
        disabled={props.value <= props.min}
        aria-label={i18n.t("ui.numberStepper.decrease")}
      >
        <Icon name="minus" size="small" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        class="h-8 w-14 border-x border-border-weak-base bg-transparent text-center text-14-mono text-text-base outline-none"
        value={props.format(props.value)}
        onBlur={onBlur}
        aria-label={props["aria-label"]}
      />
      <button
        type="button"
        class={control}
        onClick={() => change(props.value + props.step)}
        disabled={props.value >= props.max}
        aria-label={i18n.t("ui.numberStepper.increase")}
      >
        <Icon name="plus-small" size="small" />
      </button>
    </div>
  )
}
