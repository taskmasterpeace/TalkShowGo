'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  showValue?: boolean
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, showValue = true, ...props }, ref) => {
    const [value, setValue] = React.useState(props.defaultValue || props.value || 50)

    return (
      <div className="w-full">
        {(label || showValue) && (
          <div className="flex justify-between mb-2">
            {label && <span className="text-sm font-medium">{label}</span>}
            {showValue && <span className="text-sm font-mono">{value}</span>}
          </div>
        )}
        <input
          type="range"
          ref={ref}
          className={cn(
            'w-full h-3 bg-muted border-2 border-foreground appearance-none cursor-pointer',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-foreground [&::-moz-range-thumb]:cursor-pointer',
            className
          )}
          onChange={(e) => setValue(Number(e.target.value))}
          {...props}
        />
      </div>
    )
  }
)
Slider.displayName = 'Slider'

export { Slider }
