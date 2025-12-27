'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

// NeoBrutalism color palette
const COLORS = {
  primary: '#000000',
  secondary: '#f5f5f5',
  accent: '#fbbf24', // Yellow
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
}

const CHART_COLORS = [
  COLORS.accent,
  COLORS.info,
  COLORS.success,
  COLORS.purple,
  COLORS.pink,
  COLORS.warning,
  COLORS.cyan,
  COLORS.danger,
]

// Custom tooltip with NeoBrutalism style
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border-2 border-foreground p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <p className="font-bold text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Custom legend with NeoBrutalism style
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap gap-4 justify-center mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-4 h-4 border-2 border-foreground"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

interface ChartContainerProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  minHeight?: number
}

export function ChartContainer({ title, description, children, className, minHeight = 250 }: ChartContainerProps) {
  return (
    <div className={cn("border-2 border-foreground bg-background p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]", className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="font-bold text-lg">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div style={{ minHeight: minHeight }} className="w-full">
        {children}
      </div>
    </div>
  )
}

// Bar Chart Component
interface BarChartData {
  name: string
  value: number
  [key: string]: string | number
}

interface RetroBarChartProps {
  data: BarChartData[]
  dataKey?: string
  xAxisKey?: string
  height?: number
  color?: string
  showGrid?: boolean
}

export function RetroBarChart({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  height = 300,
  color = COLORS.accent,
  showGrid = true,
}: RetroBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12, fontWeight: 500 }}
          tickLine={{ stroke: '#000' }}
          axisLine={{ stroke: '#000', strokeWidth: 2 }}
        />
        <YAxis
          tick={{ fontSize: 12, fontWeight: 500 }}
          tickLine={{ stroke: '#000' }}
          axisLine={{ stroke: '#000', strokeWidth: 2 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey={dataKey}
          fill={color}
          stroke="#000"
          strokeWidth={2}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Multi-Bar Chart
interface MultiBarChartProps {
  data: any[]
  bars: Array<{ dataKey: string; name: string; color?: string }>
  xAxisKey?: string
  height?: number
  showGrid?: boolean
}

export function RetroMultiBarChart({
  data,
  bars,
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
}: MultiBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12, fontWeight: 500 }}
          tickLine={{ stroke: '#000' }}
          axisLine={{ stroke: '#000', strokeWidth: 2 }}
        />
        <YAxis
          tick={{ fontSize: 12, fontWeight: 500 }}
          tickLine={{ stroke: '#000' }}
          axisLine={{ stroke: '#000', strokeWidth: 2 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
        {bars.map((bar, index) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.color || CHART_COLORS[index % CHART_COLORS.length]}
            stroke="#000"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// Pie Chart Component
interface PieChartData {
  name: string
  value: number
}

interface RetroPieChartProps {
  data: PieChartData[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  showLabels?: boolean
}

export function RetroPieChart({
  data,
  height = 300,
  innerRadius = 0,
  outerRadius = 100,
  showLabels = true,
}: RetroPieChartProps) {
  const renderLabel = ({ name, percent }: any) => {
    return `${name} (${(percent * 100).toFixed(0)}%)`
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data as any}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
          label={showLabels ? renderLabel : false}
          labelLine={showLabels}
          stroke="#000"
          strokeWidth={2}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Donut Chart (Pie with inner radius)
export function RetroDonutChart(props: Omit<RetroPieChartProps, 'innerRadius'>) {
  return <RetroPieChart {...props} innerRadius={60} />
}

// Line Chart Component
interface LineChartData {
  name: string
  [key: string]: string | number
}

interface RetroLineChartProps {
  data: LineChartData[]
  lines: Array<{ dataKey: string; name: string; color?: string }>
  xAxisKey?: string
  height?: number
  showGrid?: boolean
  showDots?: boolean
}

export function RetroLineChart({
  data,
  lines,
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  showDots = true,
}: RetroLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12, fontWeight: 500 }}
          tickLine={{ stroke: '#000' }}
          axisLine={{ stroke: '#000', strokeWidth: 2 }}
        />
        <YAxis
          tick={{ fontSize: 12, fontWeight: 500 }}
          tickLine={{ stroke: '#000' }}
          axisLine={{ stroke: '#000', strokeWidth: 2 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
        {lines.map((line, index) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color || CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={3}
            dot={showDots ? { fill: line.color || CHART_COLORS[index % CHART_COLORS.length], stroke: '#000', strokeWidth: 2, r: 4 } : false}
            activeDot={{ r: 6, stroke: '#000', strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// Area Chart Component
interface RetroAreaChartProps {
  data: LineChartData[]
  areas: Array<{ dataKey: string; name: string; color?: string }>
  xAxisKey?: string
  height?: number
  showGrid?: boolean
  stacked?: boolean
}

export function RetroAreaChart({
  data,
  areas,
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  stacked = false,
}: RetroAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12, fontWeight: 500 }}
          tickLine={{ stroke: '#000' }}
          axisLine={{ stroke: '#000', strokeWidth: 2 }}
        />
        <YAxis
          tick={{ fontSize: 12, fontWeight: 500 }}
          tickLine={{ stroke: '#000' }}
          axisLine={{ stroke: '#000', strokeWidth: 2 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
        {areas.map((area, index) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name}
            stroke={area.color || CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            fill={area.color || CHART_COLORS[index % CHART_COLORS.length]}
            fillOpacity={0.3}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Stat Card with mini sparkline
interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  sparklineData?: number[]
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  color = 'default',
  sparklineData,
}: StatCardProps) {
  const colorClasses = {
    default: 'bg-background',
    success: 'bg-green-50',
    warning: 'bg-yellow-50',
    danger: 'bg-red-50',
    info: 'bg-blue-50',
  }

  const accentColors = {
    default: COLORS.primary,
    success: COLORS.success,
    warning: COLORS.warning,
    danger: COLORS.danger,
    info: COLORS.info,
  }

  return (
    <div className={cn(
      "border-2 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
      colorClasses[color]
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {change !== undefined && (
            <p className={cn(
              "text-sm font-medium mt-1",
              change >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {change >= 0 ? '+' : ''}{change}% {changeLabel}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 border-2 border-foreground" style={{ backgroundColor: accentColors[color] + '20' }}>
            {icon}
          </div>
        )}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData.map((v, i) => ({ value: v, i }))}>
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColors[color]}
                strokeWidth={2}
                fill={accentColors[color]}
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// Progress Bar
interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  color = COLORS.accent,
  size = 'md',
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)
  const heights = { sm: 'h-2', md: 'h-4', lg: 'h-6' }

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between mb-1">
          {label && <span className="text-sm font-medium">{label}</span>}
          {showValue && <span className="text-sm font-medium">{percentage.toFixed(0)}%</span>}
        </div>
      )}
      <div className={cn("w-full bg-muted border-2 border-foreground", heights[size])}>
        <div
          className={cn("h-full transition-all duration-300", heights[size])}
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export { COLORS, CHART_COLORS }
