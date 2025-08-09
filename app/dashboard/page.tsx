'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/ui/file-upload'
import { File, Upload, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface Document {
  id: string
  name: string
  size: number
  type: string
  status: string
  vectorized: boolean
  created_at: string
  path: string // add path so we can send it to n8n on delete
}

interface Profile {
  id: string
  name: string
  email: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [showUpload, setShowUpload] = useState(false)
  const [processingDocument, setProcessingDocument] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/signin')
        return
      }

      setUser(user)

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)

      // Fetch user's documents
      const { data: documentsData } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setDocuments(documentsData || [])
      setIsLoading(false)
    }

    getUser()
  }, [router, supabase])

  // Poll for document status updates when processing
  useEffect(() => {
    if (!processingDocument) return

    const pollInterval = setInterval(async () => {
      const { data: documentsData } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      setDocuments(documentsData || [])

      // Check if processing is complete
      const processingDoc = documentsData?.find(doc => doc.name === processingDocument)
      if (processingDoc && processingDoc.status !== 'processing') {
        setProcessingDocument(null)
        clearInterval(pollInterval)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [processingDocument, user?.id, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/signin')
  }

  const handleDeleteDocument = async (documentId: string, fileName: string, filePath?: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return
    }

    try {
      // Get the JWT token
      const { data: { session } } = await supabase.auth.getSession()
      const jwtToken = session?.access_token

      if (!jwtToken) {
        alert('Authentication error. Please try again.')
        return
      }

      const response = await fetch('https://auto.zidny.net/webhook/docuchat/document', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          documentId,
          filePath // include the storage path for downstream delete
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete document')
      }

      // Refresh documents list
      const { data: documentsData } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      setDocuments(documentsData || [])
      alert('Document deleted successfully')

    } catch (error: any) {
      console.error('Delete error:', error)
      alert(`Error deleting document: ${error.message}`)
    }
  }

  const handleFileUpload = async (files: File[]) => {
    console.log('handleFileUpload called with files:', files.length, files.map(f => ({ name: f.name, size: f.size, type: f.type })))
    setIsUploading(true)
    setUploadProgress('Uploading files...')

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })
      
      console.log('FormData created with files:', formData.getAll('files').length)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()
      setUploadProgress(`Successfully uploaded ${result.files.length} document(s)`)      
      // Set processing state for the uploaded file
      if (result.files && result.files.length > 0) {
        setProcessingDocument(result.files[0].name)
      }
      
      // Refresh documents list
      const { data: documentsData } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      setDocuments(documentsData || [])
      setShowUpload(false)

      // Clear progress after 3 seconds
      setTimeout(() => setUploadProgress(''), 3000)

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setUploadProgress(`Error: ${errorMessage}`)
      setTimeout(() => setUploadProgress(''), 5000)
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusIcon = (status: string, vectorized: boolean) => {
    if (vectorized) return <CheckCircle className="h-5 w-5 text-green-500" />
    if (status === 'processing') return <Clock className="h-5 w-5 text-yellow-500" />
    return <AlertCircle className="h-5 w-5 text-red-500" />
  }

  const getStatusText = (status: string, vectorized: boolean) => {
    if (vectorized) return 'Ready for chat'
    if (status === 'processing') return 'Processing...'
    return 'Error'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">DocuChat</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {profile?.name || user?.email}
              </span>
              <Button 
                variant="outline" 
                onClick={handleSignOut}
                className="!bg-white !border-gray-300 !text-gray-900 font-medium cursor-pointer hover:!bg-gray-50"
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Upload Progress */}
          {uploadProgress && (
            <div className={`mb-6 p-4 rounded-lg ${
              uploadProgress.includes('Error') 
                ? 'bg-red-50 border border-red-200 text-red-600' 
                : 'bg-green-50 border border-green-200 text-green-600'
            }`}>
              {uploadProgress}
            </div>
          )}

          {/* Upload Section */}
          {showUpload ? (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Upload Documents</h2>
                <Button
                  variant="outline"
                  onClick={() => setShowUpload(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </Button>
              </div>
              <FileUpload
                onFilesSelected={handleFileUpload}
                acceptedFileTypes={['.pdf', '.doc', '.docx', '.txt']}
                maxFiles={1}
                maxSize={10 * 1024 * 1024} // 10MB
                isUploading={isUploading}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Welcome to DocuChat!
                </h2>
                <p className="text-gray-600 mb-6">
                  Upload your documents and start chatting with them.
                </p>
                <Button 
                  onClick={() => setShowUpload(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3"
                  disabled={isUploading}
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Documents
                </Button>
              </div>
            </div>
          )}

          {/* Documents List */}
          {documents.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Your Documents</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <div key={doc.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <File className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(doc.size)} • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {processingDocument === doc.name ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-600">Vectorizing...</span>
                        </>
                      ) : (
                        <>
                          {getStatusIcon(doc.status, doc.vectorized)}
                          <span className="text-sm text-gray-600">
                            {getStatusText(doc.status, doc.vectorized)}
                          </span>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.name, doc.path)}
                        className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
