import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/ui/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform,opacity] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-status-danger-solid aria-invalid:ring-status-danger-solid/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-status-danger-solid text-content-on-brand hover:bg-status-danger-solid-hover focus-visible:ring-status-danger-solid/30",
        outline:
          "border border-border-subtle bg-surface-raised shadow-xs hover:bg-surface-muted hover:text-content-primary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-surface-muted hover:text-content-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        xs: "min-h-11 gap-1 rounded-md px-2 text-sm has-[>svg]:px-1.5 sm:h-8 sm:min-h-8 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-11 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5 sm:h-9 sm:min-h-9",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-11",
        "icon-xs": "size-11 rounded-md sm:size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-11 sm:size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
