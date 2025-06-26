'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  BuildingOfficeIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface UserEstablishment {
  id: string
  establishment_code: string
  establishment_name: string
  joined_at: string
  leads_count: number
  arcadas_vendidas: number
  added_by: string // Quem adicionou (gerente ou próprio indicador)
}

export default function ConsultantEstablishmentsPage() {
  const { profile } = useAuth()
  const [establishments, setEstablishments] = useState<UserEstablishment[]>([])
  const [loading, setLoading] = useState(true)
  const [newCode, setNewCode] = useState('')
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (profile?.role === 'consultant') {
      fetchEstablishments()
    }
  }, [profile])

  const fetchEstablishments = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('user_establishments')
        .select(`
          *,
          establishment_codes (name),
          added_by_user:added_by (full_name)
        `)
        .eq('user_id', profile?.id)
        .order('joined_at', { ascending: false })

      if (error) throw error

      // Buscar estatísticas
      const establishmentsWithStats = await Promise.all(
        (data || []).map(async (est) => {
          const [leadsResult, arcadasResult] = await Promise.all([
            supabase
              .from('leads')
              .select('id', { count: 'exact' })
              .eq('indicated_by', profile?.id)
              .eq('establishment_code', est.establishment_code),
            supabase
              .from('leads')
              .select('arcadas_vendidas')
              .eq('indicated_by', profile?.id)
              .eq('establishment_code', est.establishment_code)
              .eq('status', 'converted')
          ])

          const arcadas = arcadasResult.data?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0

          return {
            ...est,
            establishment_name: est.establishment_codes?.name || 'Estabelecimento',
            leads_count: leadsResult.count || 0,
            arcadas_vendidas: arcadas
          }
        })
      )

      setEstablishments(establishmentsWithStats)
    } catch (error) {
      console.error('Erro ao buscar estabelecimentos:', error)
      toast.error('Erro ao carregar estabelecimentos')
    } finally {
      setLoading(false)
    }
  }

  const handleAddEstablishment = async () => {
    if (!newCode.trim()) return

    try {
      setAdding(true)

      // Verificar se código existe
      const { data: codeData, error: codeError } = await supabase
        .from('establishment_codes')
        .select('*')
        .eq('code', newCode.trim().toUpperCase())
        .eq('is_active', true)
        .single()

      if (codeError || !codeData) {
        toast.error('Código inválido')
        return
      }

      // Verificar se já está vinculado
      const { data: existing } = await supabase
        .from('user_establishments')
        .select('id')
        .eq('user_id', profile?.id)
        .eq('establishment_code', newCode.trim().toUpperCase())
        .single()

      if (existing) {
        toast.error('Você já trabalha neste estabelecimento')
        return
      }

      // Adicionar estabelecimento
      const { error } = await supabase
        .from('user_establishments')
        .insert({
          user_id: profile?.id,
          establishment_code: newCode.trim().toUpperCase(),
          status: 'active',
          added_by: profile?.id // Auto-adicionado
        })

      if (error) throw error

      toast.success(`Estabelecimento "${codeData.name}" adicionado!`)
      setNewCode('')
      fetchEstablishments()
    } catch (error) {
      console.error('Erro ao adicionar:', error)
      toast.error('Erro ao adicionar estabelecimento')
    } finally {
      setAdding(false)
    }
  }

  if (profile?.role !== 'consultant') {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-warning-400 mb-4" />
        <h3 className="text-lg font-medium text-secondary-900">Acesso Restrito</h3>
        <p className="text-secondary-500">Esta página é apenas para indicadores.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Meus Estabelecimentos</h1>
        <p className="text-secondary-600">
          Estabelecimentos onde você trabalha como indicador
        </p>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              Como Funciona
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Seu gerente te cadastrou em estabelecimentos iniciais</li>
              <li>• Você pode adicionar outros estabelecimentos onde também trabalha</li>
              <li>• Use o código fornecido pelo estabelecimento</li>
              <li>• Suas indicações ficam vinculadas ao estabelecimento selecionado</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add New */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">Adicionar Estabelecimento</h3>
        </div>
        <div className="card-body">
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                className="input uppercase"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="Digite o código do estabelecimento"
                maxLength={6}
              />
            </div>
            <button
              onClick={handleAddEstablishment}
              disabled={adding || newCode.length !== 6}
              className="btn btn-primary"
            >
              {adding ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                  Verificando...
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Adicionar
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Establishments List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">Estabelecimentos Vinculados</h3>
        </div>
        <div className="card-body">
          {establishments.length > 0 ? (
            <div className="space-y-4">
              {establishments.map((est) => (
                <div key={est.id} className="flex items-center justify-between p-4 border border-secondary-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                      <BuildingOfficeIcon className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-secondary-900">{est.establishment_name}</h4>
                      <p className="text-sm text-secondary-500">
                        Código: {est.establishment_code} • 
                        Desde {new Date(est.joined_at).toLocaleDateString('pt-BR')}
                      </p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-secondary-600">
                          {est.leads_count} indicações
                        </span>
                        <span className="text-xs text-success-600">
                          {est.arcadas_vendidas} arcadas vendidas
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {est.added_by === profile?.id ? (
                      <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded">
                        Auto-adicionado
                      </span>
                    ) : (
                      <span className="text-xs text-success-600 bg-success-50 px-2 py-1 rounded">
                        Adicionado pelo gerente
                      </span>
                    )}
                    
                    {est.added_by === profile?.id && (
                      <button className="btn btn-ghost btn-sm text-danger-600">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BuildingOfficeIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
              <h3 className="text-sm font-medium text-secondary-900 mb-1">
                Nenhum estabelecimento encontrado
              </h3>
              <p className="text-sm text-secondary-500">
                Seu gerente ainda não te cadastrou em nenhum estabelecimento.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}