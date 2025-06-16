'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function DebugPage() {
  const [envVars, setEnvVars] = useState<any>({})
  const [connectionTest, setConnectionTest] = useState<string>('Testando...')
  
  useEffect(() => {
    // Testar variáveis de ambiente
    const vars = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 30) + '...',
      nodeEnv: process.env.NODE_ENV,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL
    }
    setEnvVars(vars)
    
    // Testar conexão
    testConnection()
  }, [])
  
  const testConnection = async () => {
    try {
      const supabase = createClient()
      
      // Teste simples - buscar a versão do PostgreSQL
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      if (error) {
        setConnectionTest(`❌ ERRO: ${error.message}`)
      } else {
        setConnectionTest('✅ Conexão funcionando!')
      }
    } catch (err: any) {
      setConnectionTest(`❌ ERRO CATCH: ${err.message}`)
    }
  }

  // Adicione esta função na sua página debug:
const testDirectAPI = async () => {
  try {
    const response = await fetch('https://kfixmvubsvgadvcmxvfc.supabase.co/rest/v1/users', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaXhtdnVic3ZnYWR2Y218dmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjU2NTksImV4cCI6MjA2NTYwMTY1OX0.f_8_4dePAAMephceXllddt8XGlQCLqXP8Fe4C2qFih0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaXhtdnVic3ZnYWR2Y214dmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjU2NTksImV4cCI6MjA2NTYwMTY1OX0.f_8_4dePAAMephceXllddt8XGlQCLqXP8Fe4C2qFih0',
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.text()
    console.log('Response status:', response.status)
    console.log('Response data:', data)
    setConnectionTest(`Status: ${response.status} - ${data}`)
  } catch (error: any) {
    console.error('Fetch error:', error)
    setConnectionTest(`Fetch Error: ${error.message}`)
  }
}


  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Debug Supabase</h1>
      // E adicione este botão no JSX:
<button 
  onClick={testDirectAPI}
  className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
>
  Testar API Direta
</button>
  
      {/* Variáveis de Ambiente */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">🔧 Variáveis de Ambiente</h2>
        <div className="space-y-2">
          <p><strong>URL:</strong> <span className="text-blue-600">{envVars.url || '❌ UNDEFINED'}</span></p>
          <p><strong>KEY:</strong> <span className="text-blue-600">{envVars.key || '❌ UNDEFINED'}</span></p>
          <p><strong>NODE_ENV:</strong> <span className="text-blue-600">{envVars.nodeEnv || '❌ UNDEFINED'}</span></p>
          <p><strong>SITE_URL:</strong> <span className="text-blue-600">{envVars.siteUrl || '❌ UNDEFINED'}</span></p>
        </div>
      </div>
      
      {/* Teste de Conexão */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">🔌 Teste de Conexão</h2>
        <p className="text-lg">{connectionTest}</p>
        <button 
          onClick={testConnection}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Testar Novamente
        </button>
      </div>
      
      {/* Comandos para Console */}
      <div className="bg-gray-100 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">💻 Comandos para Console do Navegador</h2>
        <div className="space-y-4 text-sm font-mono">
          <div>
            <p className="font-semibold">Verificar variáveis:</p>
            <code className="block bg-gray-800 text-green-400 p-2 rounded">
              console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
            </code>
          </div>
          
          <div>
            <p className="font-semibold">Teste de conexão manual:</p>
            <code className="block bg-gray-800 text-green-400 p-2 rounded whitespace-pre-wrap">
{`// Cole no console:
import('@/utils/supabase/client').then(({ createClient }) => {
  const supabase = createClient()
  return supabase.from('users').select('count').limit(1)
}).then(result => console.log('Resultado:', result))`}
            </code>
          </div>
        </div>
      </div>
    </div>

    
  )
}