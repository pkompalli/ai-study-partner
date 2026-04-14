'use client'
import { useState } from 'react'
import { Upload, Check, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckpointDef, CollectedData } from '@/types/onboarding'

interface CheckpointRendererProps {
  checkpoint: CheckpointDef
  onRespond: (displayText: string, data: Record<string, unknown>) => void
  disabled?: boolean
}

export function CheckpointRenderer({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  let content: React.ReactNode = null

  switch (checkpoint.inputType) {
    case 'pills':
      content = <PillsCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
    case 'multi_pills':
      content = <MultiPillsCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
    case 'text':
      content = <TextCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
    case 'file_upload':
      content = <FileUploadCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
    case 'date_picker':
      content = <DatePickerCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
    case 'number_slider':
      content = <SliderCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
    case 'confirm':
      content = <ConfirmCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
    case 'structure_preview':
      content = <StructurePreviewCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
    case 'exam_format_preview':
      content = <ExamFormatPreviewCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
      break
  }

  // Fallback: if the checkpoint component returned null (e.g. missing data), show a text input
  return content ?? <TextCheckpoint checkpoint={checkpoint} onRespond={onRespond} disabled={disabled} />
}

function PillsCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(checkpoint.options ?? []).map((option) => (
          <button
            key={option}
            onClick={() => onRespond(option, { [checkpoint.id]: option })}
            disabled={disabled}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium border transition-all',
              'border-primary-200 bg-white text-primary-700 hover:bg-primary-50 hover:border-primary-300',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function MultiPillsCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (option: string) => {
    setSelected(prev =>
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(checkpoint.options ?? []).map((option) => (
          <button
            key={option}
            onClick={() => toggle(option)}
            disabled={disabled}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium border transition-all',
              selected.includes(option)
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {selected.includes(option) && <Check className="h-3 w-3 inline mr-1" />}
            {option}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <button
          onClick={() => onRespond(selected.join(', '), { [checkpoint.id]: selected })}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Continue
        </button>
      )}
    </div>
  )
}

function TextCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    if (!value.trim()) return
    onRespond(value.trim(), { [checkpoint.id]: value.trim() })
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder={checkpoint.prompt}
        disabled={disabled}
        className="flex-1 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        Send
      </button>
    </div>
  )
}

function FileUploadCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList) => {
    if (files.length === 0) return
    const file = files[0]
    // For now, signal that user wants to upload — actual upload handled by parent
    onRespond(`Uploading ${file.name}`, { [checkpoint.id]: 'file_upload', fileName: file.name })
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      className={cn(
        'border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer',
        dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      onClick={() => {
        if (disabled) return
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.pdf,.png,.jpg,.jpeg'
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files
          if (files) handleFiles(files)
        }
        input.click()
      }}
    >
      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
      <p className="text-sm text-gray-600">Drop your syllabus here or click to upload</p>
      <p className="text-xs text-gray-400 mt-1">PDF or images accepted</p>
    </div>
  )
}

function DatePickerCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  const [dates, setDates] = useState<Array<{ label: string; date: string }>>([
    { label: '', date: '' },
  ])

  const addDate = () => setDates(prev => [...prev, { label: '', date: '' }])

  const updateDate = (idx: number, field: 'label' | 'date', value: string) => {
    setDates(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  const handleSubmit = () => {
    const valid = dates.filter(d => d.label && d.date)
    if (valid.length === 0) return
    const displayText = valid.map(d => `${d.label}: ${d.date}`).join(', ')
    onRespond(displayText, { examDates: valid })
  }

  return (
    <div className="space-y-3">
      {dates.map((d, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={d.label}
            onChange={e => updateDate(i, 'label', e.target.value)}
            placeholder="Exam name (e.g., Midterm)"
            disabled={disabled}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="relative">
            <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={d.date}
              onChange={e => updateDate(i, 'date', e.target.value)}
              disabled={disabled}
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          onClick={addDate}
          disabled={disabled}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          + Add another date
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onRespond('No exams coming up', { examDates: [] })}
          disabled={disabled}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={disabled || !dates.some(d => d.label && d.date)}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function SliderCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  const min = checkpoint.min ?? 1
  const max = checkpoint.max ?? 7
  const step = checkpoint.step ?? 1
  const [value, setValue] = useState(checkpoint.defaultValue as number ?? Math.round((min + max) / 2))

  return (
    <div className="space-y-3">
      {checkpoint.prompt && (
        <p className="text-sm font-medium text-gray-700">{checkpoint.prompt}</p>
      )}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 w-8">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 accent-primary-600"
        />
        <span className="text-sm text-gray-500 w-8">{max}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-primary-700">{value} days</span>
        <button
          onClick={() => onRespond(String(value), { [checkpoint.id]: value })}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function ConfirmCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onRespond("Looks good, let's go!", { [checkpoint.id]: true })}
        disabled={disabled}
        className="px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        Looks good!
      </button>
      <button
        onClick={() => onRespond('Let me adjust something', { [checkpoint.id]: false })}
        disabled={disabled}
        className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        Let me adjust
      </button>
    </div>
  )
}

function StructurePreviewCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  const structure = checkpoint.structure as CollectedData['structure']

  if (!structure) return null

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 max-h-64 overflow-y-auto">
        <p className="text-sm font-semibold text-gray-900 mb-2">{structure.name ?? 'Course Structure'}</p>
        {(structure.subjects ?? []).map((subj, sIdx) => (
          <div key={sIdx} className="mb-2">
            <p className="text-sm font-medium text-gray-700">{subj.name}</p>
            {(subj.topics ?? []).map((topic, tIdx) => (
              <div key={tIdx} className="ml-4">
                <p className="text-xs text-gray-600">• {topic.name}</p>
                {(topic.chapters ?? []).map((ch, cIdx) => (
                  <p key={cIdx} className="text-xs text-gray-400 ml-4">– {ch.name}</p>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onRespond("Looks good!", { [checkpoint.id]: true, structure })}
          disabled={disabled}
          className="px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          Looks good!
        </button>
        <button
          onClick={() => onRespond("I'd like to adjust the structure", { [checkpoint.id]: false })}
          disabled={disabled}
          className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Adjust
        </button>
      </div>
    </div>
  )
}

function ExamFormatPreviewCheckpoint({ checkpoint, onRespond, disabled }: CheckpointRendererProps) {
  const format = checkpoint.examFormat as CollectedData['inferredExamFormat']

  if (!format) return null

  const totalQuestions = (format.sections ?? []).reduce((s, sec) => s + sec.num_questions, 0)

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 max-h-64 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">{format.name}</p>
          <div className="flex gap-3 text-xs text-gray-500">
            {format.total_marks && <span>{format.total_marks} marks</span>}
            {format.time_minutes && <span>{format.time_minutes} min</span>}
          </div>
        </div>
        {format.description && (
          <p className="text-xs text-gray-500 mb-2">{format.description}</p>
        )}
        <div className="space-y-1.5">
          {(format.sections ?? []).map((sec, i) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm text-gray-700">{sec.name}</p>
                <p className="text-xs text-gray-400">
                  {sec.question_type.replace(/_/g, ' ')}
                  {sec.num_options ? ` · ${sec.num_options} options` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">{sec.num_questions}Q</p>
                {sec.marks_per_question && (
                  <p className="text-xs text-gray-400">{sec.marks_per_question}m each</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
          Total: {totalQuestions} questions
          {format.total_marks ? ` · ${format.total_marks} marks` : ''}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onRespond("Looks good!", { [checkpoint.id]: true, inferredExamFormat: format })}
          disabled={disabled}
          className="px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          Looks good!
        </button>
        <button
          onClick={() => onRespond("I'd like to adjust the format", { [checkpoint.id]: false })}
          disabled={disabled}
          className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Adjust
        </button>
        <button
          onClick={() => onRespond("Skip exam format for now", { [checkpoint.id]: 'skip' })}
          disabled={disabled}
          className="text-sm text-gray-400 hover:text-gray-600 px-2"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
