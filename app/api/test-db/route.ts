import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      return NextResponse.json({ 
        error: 'Auth error', 
        details: authError.message 
      }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ 
        error: 'No user found' 
      }, { status: 401 })
    }

    // Test documents table
    const { data: documents, error: dbError } = await supabase
      .from('documents')
      .select('count')
      .limit(1)

    if (dbError) {
      return NextResponse.json({ 
        error: 'Database error', 
        details: dbError.message,
        code: dbError.code
      }, { status: 500 })
    }

    // Test storage bucket
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets()
    
    const documentsBucket = buckets?.find(bucket => bucket.name === 'documents')
    
    if (storageError) {
      return NextResponse.json({ 
        error: 'Storage error', 
        details: storageError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      documentsTable: 'exists',
      documentsCount: documents?.length || 0,
      storageBuckets: buckets?.map(b => b.name) || [],
      documentsBucket: documentsBucket ? 'exists' : 'missing'
    })

  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json({ 
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
