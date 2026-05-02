import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  width?: number
  height?: number
  variant?: "icon" | "full"
}

export function Logo({ className, width = 40, height = 40, variant = "icon" }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex items-center justify-center overflow-hidden">
        <Image
          src="/assets/zamren_logo.png"
          alt="ZAMREN Logo"
          width={width}
          height={height}
          className="object-contain"
          priority
        />
      </div>
      {variant === "full" && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-foreground">ZAMREN</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
            Digital ID System
          </span>
        </div>
      )}
    </div>
  )
}
