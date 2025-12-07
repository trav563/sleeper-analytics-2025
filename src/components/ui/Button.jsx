import * as React from "react"
import { cn } from "../../lib/utils"

// Since I didn't install class-variance-authority or radix-ui yet, I should probably stick to standard prop drilling or install them. 
// Actually, for a "Premium" design system, using cva is very standard. I should install it.
// But wait, the user approved my plan which didn't explicitly list cva/radix.
// However, I can implement the same logic without cva for now to avoid extra dependencies if I want to be safe, 
// OR I can just install them as they are standard "shadcn/ui" dependencies which I alluded to.
// Let's implement a robust version WITHOUT cva first to keep dependencies low unless needed. 
// It's easy to do with just clsx/tailwind-merge.

const Button = React.forwardRef(({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    // Note: asChild support removed for now to avoid radix dependency.
    // If needed later, install @radix-ui/react-slot

    const variants = {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
    }

    const sizes = {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
    }

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                variants[variant],
                sizes[size],
                className
            )}
            ref={ref}
            {...props}
        />
    )
})
Button.displayName = "Button"

export { Button }
