'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border-2 border-foreground',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground brutal-shadow brutal-shadow-hover',
        secondary:
          'bg-secondary text-secondary-foreground brutal-shadow brutal-shadow-hover',
        destructive:
          'bg-destructive text-destructive-foreground brutal-shadow brutal-shadow-hover',
        success:
          'bg-success text-success-foreground brutal-shadow brutal-shadow-hover',
        outline:
          'bg-transparent hover:bg-secondary brutal-shadow brutal-shadow-hover',
        ghost: 'border-transparent hover:bg-secondary hover:border-foreground',
        link: 'border-transparent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
