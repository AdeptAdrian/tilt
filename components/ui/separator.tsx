import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.HTMLAttributes<HTMLHRElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <hr
      data-slot="separator"
      data-orientation={orientation}
      className={cn(
        "shrink-0 border-none bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
