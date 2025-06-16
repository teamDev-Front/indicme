import { createBrowserClient } from "@supabase/ssr";

console.log('🚀 CLIENT.TS CARREGADO!')

export const createClient = () => {
  console.log('🔧 FUNÇÃO createClient CHAMADA!')
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  console.log('🔧 Creating Supabase client with:', {
    url,
    key: key?.substring(0, 20) + '...',
    hasUrl: !!url,
    hasKey: !!key
  })
  
  if (!url || !key) {
    console.error('❌ Missing Supabase credentials!')
    throw new Error('Missing Supabase credentials')
  }
  
  const client = createBrowserClient(url, key)
  console.log('✅ Supabase client created successfully')
  
  return client
}