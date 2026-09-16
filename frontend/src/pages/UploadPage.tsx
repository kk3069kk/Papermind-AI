import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { papersApi } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface UploadItem {
  file: File
  status: FileStatus
  error?: string
}

export function UploadPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [items, setItems] = useState<UploadItem[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    rejected.forEach((r) => {
      const msg = r.errors[0]?.message || 'Invalid file'
      toast.error(`${r.file.name}: ${msg}`)
    })
    const newItems = accepted.map((f): UploadItem => ({ file: f, status: 'pending' }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 50 * 1024 * 1024,
  })

  const remove = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const setStatus = (idx: number, status: FileStatus, error?: string) =>
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, status, error } : item))

  const handleUpload = async () => {
    const pending = items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.status === 'pending')
    if (!pending.length) return
    setUploading(true)

    for (const { item, idx } of pending) {
      setStatus(idx, 'uploading')
      try {
        await papersApi.upload(item.file)
        setStatus(idx, 'done')
      } catch (err: any) {
        const msg = err.response?.data?.detail || 'Upload failed'
        setStatus(idx, 'error', msg)
        toast.error(`${item.file.name}: ${msg}`)
      }
    }

    qc.invalidateQueries({ queryKey: ['papers'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    setUploading(false)
    toast.success('Upload complete')
  }

  const pendingCount = items.filter((i) => i.status === 'pending').length

  return (
    <div className="p-8 max-w-2xl w-full">
      <div className="mb-7">
        <h1 className="text-xl font-semibold tracking-tight">Upload Papers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Add PDF research papers to your library</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors select-none',
          isDragActive
            ? 'border-foreground/40 bg-accent/50'
            : 'border-border hover:border-foreground/20 hover:bg-accent/20'
        )}
      >
        <input {...getInputProps()} />
        <div className="w-10 h-10 rounded-lg border border-border flex items-center justify-center mx-auto mb-4">
          <Upload size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          {isDragActive ? 'Drop your PDFs here' : 'Drag & drop PDFs, or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">PDF only · Max 50 MB per file · Stored on Cloudinary</p>
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((item, idx) => (
            <div key={item.file.name + idx} className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-card">
              <FileText size={15} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
              </div>
              {item.status === 'uploading' && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              {item.status === 'done' && <CheckCircle2 size={14} className="text-emerald-500" />}
              {item.status === 'error' && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-destructive" />
                  <span className="text-xs text-destructive">{item.error}</span>
                </div>
              )}
              {item.status === 'pending' && (
                <button onClick={() => remove(idx)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {items.length > 0 && (
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={handleUpload} disabled={!pendingCount || uploading} className="gap-2">
            {uploading && <Loader2 size={14} className="animate-spin" />}
            Upload {pendingCount > 0 ? `${pendingCount} file${pendingCount !== 1 ? 's' : ''}` : ''}
          </Button>
          <Button variant="outline" onClick={() => navigate('/papers')}>
            View library
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground ml-auto"
            onClick={() => setItems([])}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
