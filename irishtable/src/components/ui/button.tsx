import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-main hover:bg-accent/85 font-display font-medium uppercase tracking-[0.06em] rounded-full",
        primary: "bg-accent text-main hover:bg-accent/85 font-display font-medium uppercase tracking-[0.06em] rounded-full",
        outline:
          "border-border2 bg-transparent text-text hover:bg-hoverfill rounded-full uppercase font-display tracking-[0.06em]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-hoverfill rounded-full uppercase font-display tracking-[0.06em]",
        ghost:
          "hover:bg-hoverfill hover:text-foreground text-textsecondary rounded-full uppercase font-display tracking-[0.06em]",
        destructive:
          "bg-remove text-text hover:bg-remove/85 rounded-full uppercase font-display tracking-[0.06em]",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-5 py-2 text-sm",
        xs: "h-6 gap-1 px-2.5 text-xs",
        sm: "h-8 gap-1.5 px-3.5 text-xs",
        md: "h-11 gap-2 px-6 text-sm",
        lg: "h-13 gap-2.5 px-8 text-base",
        icon: "size-8 rounded-full",
        "icon-xs": "size-6 rounded-full",
        "icon-sm": "size-7 rounded-full",
        "icon-lg": "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
