import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-accent before:absolute before:inset-y-0 before:left-0 before:w-1/2 before:-translate-x-[200%] before:bg-linear-to-r before:from-transparent before:via-foreground/10 before:to-transparent before:animate-[skeleton-shimmer_1.6s_ease-in-out_infinite] motion-reduce:before:hidden",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
