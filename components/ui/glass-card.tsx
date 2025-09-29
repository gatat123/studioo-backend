import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "subtle" | "navigation"
  children: React.ReactNode
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "subtle", children, ...props }, ref) => {
    const variantClasses = {
      primary: "glass-primary",
      subtle: "glass-subtle",
      navigation: "glass-navigation"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl", // More rounded for modern look
          variantClasses[variant],
          "hover-lift", // Smooth hover effect
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard }