'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/dashboard')
      }
    }

    checkUser()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Chat with your documents
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Upload your documents and start having intelligent conversations with them. 
              Our AI-powered chat interface helps you extract insights and answers from your files.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/signup">
                <Button variant="default" size="lg" className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-600">
                  Get started
                </Button>
              </Link>
              <Link href="/signin">
                <Button variant="outline" size="lg" className="!bg-white !border-gray-300 !text-gray-900 hover:!bg-gray-50 font-medium">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
