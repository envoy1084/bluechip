import { Avatar as BaseAvatar } from "@base-ui/react/avatar"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const avatarVariants = cva(
  [
    "relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-g-700 select-none",
    "bg-[linear-gradient(180deg,#fff,#eef1f6)] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08),0_2px_5px_-1px_rgba(10,11,13,.12)]",
    "[&_svg]:text-g-400"
  ],
  {
    variants: {
      size: {
        sm: "size-[26px] text-[10.5px]",
        md: "size-[34px] text-label-sm",
        lg: "size-11 text-body-sm",
        xl: "size-[72px] text-title-3"
      }
    },
    defaultVariants: { size: "md" }
  }
)

export interface AvatarProps extends ComponentProps<typeof BaseAvatar.Root>, VariantProps<typeof avatarVariants> {}

/** A person at a glance: their photo, or initials or an icon. Agents use `AgentAvatar`. */
export function Avatar({ size, className, ...props }: AvatarProps) {
  return (
    <BaseAvatar.Root
      data-slot="avatar"
      data-size={size ?? "md"}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    />
  )
}

export function AvatarImage({ className, ...props }: ComponentProps<typeof BaseAvatar.Image>) {
  return (
    <BaseAvatar.Image
      data-slot="avatar-image"
      className={cn("size-full rounded-[inherit] object-cover", className)}
      {...props}
    />
  )
}

/** Initials or an icon, shown until the image loads (or when there is none). */
export function AvatarFallback({ className, ...props }: ComponentProps<typeof BaseAvatar.Fallback>) {
  return (
    <BaseAvatar.Fallback
      data-slot="avatar-fallback"
      className={cn("grid size-full place-items-center", className)}
      {...props}
    />
  )
}

/** A status dot on the avatar's corner. Its children ("Running") are read to screen readers only. */
export function AvatarBadge({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-green shadow-[0_0_0_2.5px_#fff]",
        className
      )}
      {...props}
    >
      <span className="sr-only">{children}</span>
    </span>
  )
}

/** Overlapping avatars (people or agents); end with an `Avatar` holding "+N" for the rest. */
export function AvatarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "flex *:not-first:-ml-2 *:shadow-[0_0_0_2px_#fff,0_2px_5px_-1px_rgba(10,11,13,.12)]",
        className
      )}
      {...props}
    />
  )
}
