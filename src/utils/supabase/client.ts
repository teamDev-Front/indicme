import { createBrowserClient } from "@supabase/ssr";


export const createClient = () => {
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  console.log('🔧 Creating Supabase client with:', {
    url,
    key: key?.substring(0, 20) + '...',
    hasUrl: !!url,
    hasKey: !!key
  })
  
  if (!url || !key) {
    throw new Error('Missing Supabase credentials')
  }
  
  const client = createBrowserClient(url, key)
  
  return client
}