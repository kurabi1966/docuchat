import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received')
    
    // Get the authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('User authenticated:', user.id)

    // Get the JWT token for n8n authentication
    const { data: { session } } = await supabase.auth.getSession()
    const jwtToken = session?.access_token

    if (!jwtToken) {
      console.error('No JWT token found')
      return NextResponse.json(
        { error: 'No valid session token' },
        { status: 401 }
      )
    }

    // Parse the form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    console.log('Files received:', files.length, files.map(f => ({ name: f.name, size: f.size, type: f.type })))

    if (!files || files.length === 0) {
      console.error('No files provided')
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Validate file types and sizes
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt']
    const maxSize = 10 * 1024 * 1024 // 10MB

    for (const file of files) {
      // Handle filename encoding
      const fileName = file.name
      const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase()
      console.log('Validating file:', fileName, 'Extension:', fileExtension, 'Size:', file.size)
      
      // Check for problematic characters
      if (/[^\x00-\x7F]/.test(fileName)) {
        console.log('File contains non-ASCII characters:', fileName)
      }
      
      if (!allowedTypes.includes(fileExtension)) {
        console.error('File type not supported:', fileExtension)
        return NextResponse.json(
          { error: `File type ${fileExtension} is not supported` },
          { status: 400 }
        )
      }

      if (file.size > maxSize) {
        console.error('File too large:', file.name, file.size)
        return NextResponse.json(
          { error: `File ${file.name} is too large. Maximum size is 10MB` },
          { status: 400 }
        )
      }
    }

    console.log('File validation passed')

    // Store files in Supabase Storage
    const uploadedFiles = []
    
    for (const file of files) {
      // Encode the filename to handle Arabic and special characters
      const encodedFileName = encodeURIComponent(file.name)
      // Alternative: use base64 encoding if URL encoding doesn't work
      const base64FileName = Buffer.from(file.name, 'utf8').toString('base64')
      const fileName = `${user.id}/${Date.now()}-${base64FileName}`
      console.log('Attempting to upload file:', fileName)
      console.log('Original filename:', file.name)
      console.log('Encoded filename:', encodedFileName)
      console.log('Base64 filename:', base64FileName)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        console.error('Upload error details:', {
          message: uploadError.message
        })
        return NextResponse.json(
          { 
            error: 'Failed to upload file to storage',
            details: uploadError.message
          },
          { status: 500 }
        )
      }
      
      console.log('File uploaded successfully:', fileName)

      // Get the private URL (requires authentication)
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      uploadedFiles.push({
        name: file.name, // Store original filename for display
        size: file.size,
        type: file.type,
        url: publicUrl,
        path: fileName, // Store encoded path for storage reference
        originalName: file.name, // Keep original name for reference
        // Add private download URL for n8n
        privateUrl: `https://ruccimzjddbyeqhitqxa.supabase.co/storage/v1/object/sign/documents/${fileName}`
      })
    }

    // Store document metadata in database first
    const documentsToInsert = uploadedFiles.map(file => ({
      user_id: user.id,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url,
      path: file.path,
      status: 'processing', // Will be updated by n8n workflow
      created_at: new Date().toISOString()
    }))

    console.log('Attempting to insert documents into database:', documentsToInsert.length)
    
    const { data: dbData, error: dbError } = await supabase
      .from('documents')
      .insert(documentsToInsert)
      .select('id') // Return the inserted document IDs

    if (dbError) {
      console.error('Database error:', dbError)
      console.error('Database error details:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details
      })
      return NextResponse.json(
        { 
          error: 'Failed to save document metadata',
          details: dbError.message
        },
        { status: 500 }
      )
    }
    
    console.log('Documents inserted successfully:', dbData?.length || 0)
    
    // Map uploaded files to their database IDs
    const filesWithIds = uploadedFiles.map((file, index) => ({
      ...file,
      documentId: dbData?.[index]?.id
    }))

    // Trigger n8n workflow for each file
    const n8nPromises = filesWithIds.map(async (file) => {
      // Get the file content from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(file.path)

      if (downloadError) {
        console.error('Failed to download file for n8n:', downloadError)
        throw new Error(`Failed to download file for n8n: ${downloadError.message}`)
      }

      // Create form data with file and metadata
      const formData = new FormData()
      
      // Add the file as binary data
      const fileBlob = new Blob([fileData!], { type: file.type })
      formData.append('file', fileBlob, file.name)
      
      // Add metadata as form fields
      formData.append('userId', user.id)
      formData.append('userEmail', user.email || '')
      formData.append('fileName', file.name)
      formData.append('fileSize', file.size.toString())
      formData.append('fileType', file.type)
      formData.append('filePath', file.path)
      formData.append('originalFileName', file.name)
      formData.append('documentId', file.documentId!) // Add document ID
      formData.append('uploadedAt', new Date().toISOString())

      const response = await fetch('https://auto.zidny.net/webhook/docuchat/document/new', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
          // Don't set Content-Type - let the browser set it with boundary
        },
        body: formData
      })

      if (!response.ok) {
        console.error('n8n workflow error:', response.statusText)
        throw new Error(`Failed to trigger n8n workflow for ${file.name}`)
      }

      return response.json()
    })

    // Wait for all n8n workflows to be triggered
    const n8nResults = await Promise.allSettled(n8nPromises)

    // Check if any workflows failed
    const failedWorkflows = n8nResults.filter(result => result.status === 'rejected')
    if (failedWorkflows.length > 0) {
      console.error('Some n8n workflows failed:', failedWorkflows)
      console.log('Continuing with upload despite n8n failures...')
      // Continue anyway, as files are uploaded successfully
    } else {
      console.log('All n8n workflows triggered successfully')
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${uploadedFiles.length} document(s)`,
      files: uploadedFiles,
      n8nTriggered: n8nResults.length
    })

  } catch (error) {
    console.error('Upload error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

