'use client'
import { cn } from '@/lib/utils'

const LAYERS = [
  { num: 1, label: 'Why' },
  { num: 2, label: 'What' },
  { num: 3, label: 'Where' },
  { num: 4, label: 'Materials' },
  { num: 5, label: 'Exams' },
  { num: 6, label: 'Rhythm' },
  { num: 7, label: 'Plan' },
  { num: 8, label: 'Start' },
]

export function LayerProgress({ currentLayer }: { currentLayer: number }) {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      {LAYERS.map((layer, i) => (
        <div key={layer.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                layer.num < currentLayer && 'bg-primary-500',
                layer.num === currentLayer && 'bg-primary-600 w-2.5 h-2.5 ring-2 ring-primary-200',
                layer.num > currentLayer && 'bg-gray-200',
              )}
            />
            <span className={cn(
              'text-[9px] mt-0.5 font-medium',
              layer.num <= currentLayer ? 'text-primary-600' : 'text-gray-300',
            )}>
              {layer.label}
            </span>
          </div>
          {i < LAYERS.length - 1 && (
            <div
              className={cn(
                'w-4 h-px mx-0.5 mt-[-8px]',
                layer.num < currentLayer ? 'bg-primary-300' : 'bg-gray-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
