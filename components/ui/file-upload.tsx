'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  acceptedFileTypes?: string[]
  maxFiles?: number
  maxSize?: number // in bytes
  className?: string
  isUploading?: boolean
}

export function FileUpload({
  onFilesSelected,
  acceptedFileTypes = ['.pdf', '.doc', '.docx', '.txt'],
  maxFiles = 1, // Changed from 5 to 1
  maxSize = 10 * 1024 * 1024, // 10MB
  className,
  isUploading = false
}: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('FileUpload onDrop called with files:', acceptedFiles.length, acceptedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })))
    setUploadedFiles(prev => [...prev, ...acceptedFiles])
    onFilesSelected(acceptedFiles)
  }, [onFilesSelected])

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxFiles,
    maxSize,
    multiple: true,
    onDropRejected: (rejectedFiles) => {
      console.log('Files rejected:', rejectedFiles)
    }
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive && !isDragReject && 'border-blue-500 bg-blue-50',
          isDragReject && 'border-red-500 bg-red-50',
          !isDragActive && 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium">
            {isDragReject ? 'File type not supported' : 'Drop files here...'}
          </p>
        ) : (
          <div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              Upload your documents
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Drag and drop files here, or click to select files
            </p>
            <p className="text-xs text-gray-400">
              Supported formats: {acceptedFileTypes.join(', ')} (Max {formatFileSize(maxSize)})
            </p>
          </div>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Selected Files ({uploadedFiles.length})
          </h3>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <File className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                {!isUploading && (
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

