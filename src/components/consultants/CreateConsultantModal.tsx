// src/components/consultants/CreateConsultantModal.tsx
'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { 
  XMarkIcon, 
  UserPlusIcon,
  BuildingOfficeIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

interface EstablishmentCode {
  code: string
  name: string
  description?: string
}

interface CreateConsultantModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateConsultantModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: CreateConsultantModalProps) {
  const { profile } = useAuth()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    establishment_codes: [] as string[]  // Array de códigos
  })
  const [availableCodes, setAvailableCodes] = useState<EstablishmentCode[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchAvailableCodes()
    }
  }, [isOpen])

  const fetchAvailableCodes = async () => {
    try {
      // Buscar códigos disponíveis para o gerente usar
      const { data: codes, error } = await supabase
        .from('establishment_codes')
        .select('code, name, description')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setAvailableCodes(codes || [])
    } catch (error) {
      console.error('Erro ao buscar códigos:', error)
    }
  }

  const handleCodeToggle = (code: string) => {
    setSelectedCodes(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  const handleCreateConsultant = async () => {
    if (selectedCodes.length === 0) {
      toast.error('Selecione pelo menos um estabelecimento')
      return
    }

    try {
      setSubmitting(true)

      // 1. Criar usuário no auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name }
        }
      })

      if (signUpError) throw signUpError

      if (!signUpData.user) {
        throw new Error('Usuário não foi criado corretamente')
      }

      const newUserId = signUpData.user.id
      
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 2. Criar perfil
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: newUserId,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: 'consultant',
          status: 'active',
        })

      if (profileError) throw profileError

      // 3. Buscar clínica
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) throw new Error('Clínica não encontrada')

      // 4. Associar à clínica
      await supabase
        .from('user_clinics')
        .upsert({
          user_id: newUserId,
          clinic_id: userClinic.clinic_id,
        })

      // 5. Criar hierarquia (indicador sob este gerente)
      await supabase
        .from('hierarchies')
        .upsert({
          manager_id: profile?.id,
          consultant_id: newUserId,
          clinic_id: userClinic.clinic_id,
        })

      // 6. NOVO: Vincular aos estabelecimentos selecionados
      const establishmentInserts = selectedCodes.map(code => ({
        user_id: newUserId,
        establishment_code: code,
        status: 'active',
        added_by: profile?.id  // Quem adicionou (o gerente)
      }))

      const { error: establishmentError } = await supabase
        .from('user_establishments')
        .insert(establishmentInserts)

      if (establishmentError) {
        console.warn('Erro ao vincular estabelecimentos:', establishmentError)
      }

      toast.success(`Indicador criado e vinculado a ${selectedCodes.length} estabelecimento(s)!`)
      
      // Resetar form
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        establishment_codes: []
      })
      setSelectedCodes([])
      
      onClose()
      onSuccess()
    } catch (error: any) {
      console.error('Erro ao criar indicador:', error)
      toast.error(error.message || 'Erro ao criar indicador')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900 mb-4">
                  Cadastrar Novo Indicador
                </Dialog.Title>

                <div className="space-y-6">
                  {/* Dados Pessoais */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-secondary-900">Dados Pessoais</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Nome completo do indicador"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          className="input"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="email@exemplo.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Telefone
                        </label>
                        <input
                          type="tel"
                          className="input"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Senha Temporária
                      </label>
                      <input
                        type="password"
                        className="input"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  </div>

                  {/* Estabelecimentos */}
                  <div>
                    <h4 className="text-sm font-medium text-secondary-900 mb-2">
                      Estabelecimentos onde irá trabalhar
                    </h4>
                    <p className="text-xs text-secondary-500 mb-4">
                      Selecione um ou mais estabelecimentos para este indicador
                    </p>

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableCodes.map((establishment) => (
                        <label
                          key={establishment.code}
                          className="flex items-center p-3 border border-secondary-200 rounded-lg hover:bg-secondary-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCodes.includes(establishment.code)}
                            onChange={() => handleCodeToggle(establishment.code)}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <BuildingOfficeIcon className="h-4 w-4 text-primary-500" />
                              <span className="text-sm font-medium text-secondary-900">
                                {establishment.name}
                              </span>
                              <code className="px-1 py-0.5 bg-secondary-100 rounded text-xs">
                                {establishment.code}
                              </code>
                            </div>
                            {establishment.description && (
                              <p className="text-xs text-secondary-500 mt-1 ml-6">
                                {establishment.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>

                    {selectedCodes.length > 0 && (
                      <div className="mt-3 p-3 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-700">
                          <strong>{selectedCodes.length}</strong> estabelecimento(s) selecionado(s)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex">
                      <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Como Funciona</h4>
                        <ul className="text-sm text-blue-700 mt-1 space-y-1">
                          <li>• O indicador será vinculado aos estabelecimentos selecionados</li>
                          <li>• Ele poderá criar indicações para qualquer um deles</li>
                          <li>• Posteriormente, ele pode adicionar outros estabelecimentos</li>
                          <li>• Receberá email com login e senha temporária</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreateConsultant}
                    disabled={
                      submitting || 
                      !formData.full_name || 
                      !formData.email || 
                      !formData.password || 
                      selectedCodes.length === 0
                    }
                  >
                    {submitting ? (
                      <>
                        <div className="loading-spinner w-4 h-4 mr-2"></div>
                        Criando...
                      </>
                    ) : (
                      <>
                        <UserPlusIcon className="h-4 w-4 mr-2" />
                        Criar Indicador
                      </>
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}