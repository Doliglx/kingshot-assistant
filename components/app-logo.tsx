import { cn } from "@/lib/utils"

/** The app logo: "KS" in a rounded frame, red neon (same colours as the launcher icon). */
export function AppLogo({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="KingShot Assistant"
      className={cn(
        "neon-logo flex items-center justify-center rounded-[1.4rem] border-[3px] bg-[#090504] font-black",
        className
      )}
    >
      <span className="text-[2.1rem] leading-none tracking-tight">KS</span>
    </div>
  )
}
