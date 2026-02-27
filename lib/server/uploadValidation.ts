type UploadValidationOptions = {
  maxFiles: number
  maxFileSizeBytes: number
  allowedTypes?: string[]
}

function typeAllowed(fileType: string, allowedTypes: string[]): boolean {
  return allowedTypes.some((allowed) => {
    if (allowed.endsWith('/*')) return fileType.startsWith(allowed.slice(0, -1))
    return fileType === allowed
  })
}

export function validateUploadedFiles(files: File[], options: UploadValidationOptions): string | null {
  if (files.length > options.maxFiles) {
    return `Too many files. Maximum ${options.maxFiles} allowed.`
  }

  for (const file of files) {
    if (file.size > options.maxFileSizeBytes) {
      const maxMb = Math.floor(options.maxFileSizeBytes / (1024 * 1024))
      return `File "${file.name}" exceeds ${maxMb}MB limit.`
    }

    if (options.allowedTypes && options.allowedTypes.length > 0 && !typeAllowed(file.type, options.allowedTypes)) {
      return `File "${file.name}" has unsupported type "${file.type}".`
    }
  }

  return null
}
