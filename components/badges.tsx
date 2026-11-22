import { cn } from "@/lib/utils"

/** Tag for modules still being tested (Rally Timer, Auto Clicker): multicolour neon. */
export function DevBadge({ className }: { className?: string }) {
  return (
    <span className={cn("neon-tag relative", className)}>
      <span>BETA TEST</span>
    </span>
  )
}

/** Tag for a module that has just arrived: accent-coloured glow with a shine sweeping over the text. */
export function NewBadge({ className }: { className?: string }) {
  return (
    <span className={cn("new-tag relative", className)}>
      <span>NEW</span>
    </span>
  )
}
