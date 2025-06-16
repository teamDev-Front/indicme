'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  CheckCircleIcon,
  PencilIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import Link from 'next/link'

interface UserStats {
  totalLeads: number
  convertedLeads: number
  totalCommissions: number
  paidCommissions: number
  conversionRate: number
  consultantsCount: number // Para gerentes
  accountAge: number // dias desde criação
}

interface PasswordChangeForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export default function ProfilePage() {
  const { profile, user, updateProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [userStats, setUserStats] = useState<UserStats>({
    totalLeads: 0,
    convertedLeads: 0,
    totalCommissions: 0,
    paidCommissions: 0,
    conversionRate: 0,
    consultantsCount: 0,
    accountAge: 0
  })
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
  })
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [changingPassword, setChangingPassword] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      setEditForm({
        full_name: profile.full_name,
        phone: profile.phone || '',
      })
      fetchUserStats()
    }
    setLoading(false)
  }, [profile])

  const fetchUserStats = async () => {
    if (!profile) return

    try {
      let totalLeads = 0
      let convertedLeads = 0
      let consultantsCount = 0

      if (profile.role === 'consultant') {
        // Buscar leads do consultor
        const { data: leadsData } = await supabase
          .from('leads')
          .select('status')
          .eq('indicated_by', profile.id)

        totalLeads = leadsData?.length || 0
        convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
      } else if (profile.role === 'manager') {
        // Buscar leads do gerente + da equipe
        const { data: hierarchyData } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)

        consultantsCount = hierarchyData?.length || 0

        const consultantIds = hierarchyData?.map(h => h.consultant_id) || []
        consultantIds.push(profile.id) // Incluir leads próprios

        const { data: leadsData } = await supabase
          .from('leads')
          .select('status')
          .in('indicated_by', consultantIds)

        totalLeads = leadsData?.length || 0
        convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
      }

      // Buscar comissões
      const { data: commissionsData } = await supabase
        .from('commissions')
        .select('amount, status')
        .eq('user_id', profile.id)

      const totalCommissions = commissionsData?.reduce((sum, c) => sum + c.amount, 0) || 0
      const paidCommissions = commissionsData?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      // Calcular idade da conta
      const accountAge = Math.floor(
        (new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      setUserStats({
        totalLeads,
        convertedLeads,
        totalCommissions,
        paidCommissions,
        conversionRate,
        consultantsCount,
        accountAge
      })
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true)
      
      await updateProfile({
        full_name: editForm.full_name,
        phone: editForm.phone || null,
      })

      setIsEditing(false)
      toast.success('Perfil atualizado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error)
      toast.error('Erro ao atualizar perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres')
      return
    }

    try {
      setChangingPassword(true)

      // Atualizar senha diretamente (já estamos autenticados)
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) throw error

      toast.success('Senha alterada com sucesso!')
      setIsPasswordModalOpen(false)
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error)
      toast.error('Erro ao alterar senha')
    } finally {
      setChangingPassword(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'clinic_admin': return 'Administrador da Clínica'
      case 'clinic_viewer': return 'Visualizador da Clínica'
      case 'manager': return 'Gerente'
      case 'consultant': return 'Consultor'
      default: return 'Usuário'
    }
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'clinic_admin': return 'Acesso total ao sistema, pode gerenciar usuários e configurações'
      case 'clinic_viewer': return 'Pode visualizar dados mas não editar'
      case 'manager': return 'Gerencia equipe de consultores e acompanha performance'
      case 'consultant': return 'Faz indicações e acompanha seus leads'
      default: return 'Usuário do sistema'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'clinic_admin': return 'danger'
      case 'clinic_viewer': return 'warning'
      case 'manager': return 'primary'
      case 'consultant': return 'success'
      default: return 'secondary'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'inactive': return 'danger'
      case 'pending': return 'warning'
      default: return 'secondary'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo'
      case 'inactive': return 'Inativo'
      case 'pending': return 'Pendente'
      default: return status
    }
  }

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  if (!profile || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-warning-400 mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">Erro ao Carregar Perfil</h3>
          <p className="text-secondary-500">Não foi possível carregar as informações do usuário.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Meu Perfil</h1>
          <p className="text-secondary-600">
            Gerencie suas informações pessoais e preferências
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="card-header flex justify-between items-center">
              <h3 className="text-lg font-medium text-secondary-900">Informações Pessoais</h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-ghost btn-sm"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Editar
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditForm({
                        full_name: profile.full_name,
                        phone: profile.phone || '',
                      })
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="btn btn-primary btn-sm"
                  >
                    {saving ? (
                      <>
                        <div className="loading-spinner w-3 h-3 mr-2"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        Salvar
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            <div className="card-body space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-secondary-900">{profile.full_name}</h4>
                  <p className="text-secondary-500">{profile.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`badge badge-${getRoleColor(profile.role)}`}>
                      {getRoleDisplayName(profile.role)}
                    </span>
                    <span className={`badge badge-${getStatusColor(profile.status)}`}>
                      {getStatusText(profile.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Nome Completo
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="input"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  ) : (
                    <div className="flex items-center p-3 bg-secondary-50 rounded-lg">
                      <UserCircleIcon className="h-5 w-5 text-secondary-400 mr-3" />
                      <span className="text-secondary-900">{profile.full_name}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Email
                  </label>
                  <div className="flex items-center p-3 bg-secondary-50 rounded-lg">
                    <EnvelopeIcon className="h-5 w-5 text-secondary-400 mr-3" />
                    <span className="text-secondary-900">{profile.email}</span>
                    <span className="ml-auto text-xs text-secondary-500">Não editável</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Telefone
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      className="input"
                      value={editForm.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  ) : (
                    <div className="flex items-center p-3 bg-secondary-50 rounded-lg">
                      <PhoneIcon className="h-5 w-5 text-secondary-400 mr-3" />
                      <span className="text-secondary-900">
                        {profile.phone || 'Não informado'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Membro desde
                  </label>
                  <div className="flex items-center p-3 bg-secondary-50 rounded-lg">
                    <CalendarIcon className="h-5 w-5 text-secondary-400 mr-3" />
                    <span className="text-secondary-900">
                      {new Date(profile.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Role Description */}
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="flex items-start">
                  <ShieldCheckIcon className="h-5 w-5 text-primary-500 mr-3 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-medium text-primary-900 mb-1">
                      Seu Nível de Acesso
                    </h5>
                    <p className="text-sm text-primary-700">
                      {getRoleDescription(profile.role)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Security Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card mt-6"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Segurança</h3>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                <div className="flex items-center">
                  <KeyIcon className="h-5 w-5 text-secondary-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-secondary-900">Senha</p>
                    <p className="text-xs text-secondary-500">
                      Última alteração: {new Date(profile.updated_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="btn btn-secondary btn-sm"
                >
                  Alterar Senha
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-success-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-success-500 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-secondary-900">Conta Verificada</p>
                    <p className="text-xs text-secondary-500">
                      Sua conta foi verificada e está ativa
                    </p>
                  </div>
                </div>
                <span className="badge badge-success">Verificado</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          {/* Performance Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Sua Performance</h3>
            </div>
            <div className="card-body space-y-4">
              <div className="text-center p-4 bg-primary-50 rounded-lg">
                <div className="text-2xl font-bold text-primary-600 mb-1">
                  {userStats.totalLeads}
                </div>
                <div className="text-sm text-primary-700">Leads Criados</div>
              </div>

              <div className="text-center p-4 bg-success-50 rounded-lg">
                <div className="text-2xl font-bold text-success-600 mb-1">
                  {userStats.convertedLeads}
                </div>
                <div className="text-sm text-success-700">Leads Convertidos</div>
              </div>

              <div className="text-center p-4 bg-warning-50 rounded-lg">
                <div className="text-2xl font-bold text-warning-600 mb-1">
                  {userStats.conversionRate.toFixed(1)}%
                </div>
                <div className="text-sm text-warning-700">Taxa de Conversão</div>
              </div>

              {profile.role === 'manager' && (
                <div className="text-center p-4 bg-secondary-50 rounded-lg">
                  <div className="text-2xl font-bold text-secondary-600 mb-1">
                    {userStats.consultantsCount}
                  </div>
                  <div className="text-sm text-secondary-700">Consultores na Equipe</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Earnings Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Ganhos</h3>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CurrencyDollarIcon className="h-5 w-5 text-success-500 mr-2" />
                  <span className="text-sm text-secondary-700">Comissões Pagas</span>
                </div>
                <span className="font-medium text-success-600">
                  R$ {userStats.paidCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ClockIcon className="h-5 w-5 text-warning-500 mr-2" />
                  <span className="text-sm text-secondary-700">Total Gerado</span>
                </div>
                <span className="font-medium text-secondary-900">
                  R$ {userStats.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-3 border-t border-secondary-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary-500">Dias no sistema</span>
                  <span className="text-sm font-medium text-secondary-900">
                    {userStats.accountAge} dias
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Ações Rápidas</h3>
            </div>
            <div className="card-body space-y-3">
              {(profile.role === 'consultant' || profile.role === 'manager') && (
                <Link href="/dashboard/leads/new" className="btn btn-primary w-full justify-start">
                  <UsersIcon className="h-4 w-4 mr-2" />
                  Novo Lead
                </Link>
              )}
              
              <Link href="/dashboard/reports" className="btn btn-secondary w-full justify-start">
                <ChartBarIcon className="h-4 w-4 mr-2" />
                Ver Relatórios
              </Link>
              
              <Link href="/dashboard/commissions" className="btn btn-secondary w-full justify-start">
                <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                Minhas Comissões
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Transition appear show={isPasswordModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsPasswordModalOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900 mb-4">
                    Alterar Senha
                  </Dialog.Title>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Senha Atual
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          className="input pr-10"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                          placeholder="Digite sua senha atual"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => togglePasswordVisibility('current')}
                        >
                          {showPasswords.current ? (
                            <EyeSlashIcon className="h-4 w-4 text-secondary-400" />
                          ) : (
                            <EyeIcon className="h-4 w-4 text-secondary-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Nova Senha
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          className="input pr-10"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Mínimo 6 caracteres"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => togglePasswordVisibility('new')}
                        >
                          {showPasswords.new ? (
                            <EyeSlashIcon className="h-4 w-4 text-secondary-400" />
                          ) : (
                            <EyeIcon className="h-4 w-4 text-secondary-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Confirmar Nova Senha
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          className="input pr-10"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Digite a nova senha novamente"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => togglePasswordVisibility('confirm')}
                        >
                          {showPasswords.confirm ? (
                            <EyeSlashIcon className="h-4 w-4 text-secondary-400" />
                          ) : (
                            <EyeIcon className="h-4 w-4 text-secondary-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setIsPasswordModalOpen(false)
                        setPasswordForm({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        })
                        setShowPasswords({
                          current: false,
                          new: false,
                          confirm: false
                        })
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleChangePassword}
                      disabled={
                        changingPassword || 
                        !passwordForm.currentPassword || 
                        !passwordForm.newPassword || 
                        !passwordForm.confirmPassword
                      }
                    >
                      {changingPassword ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          Alterando...
                        </>
                      ) : (
                        <>
                          <KeyIcon className="h-4 w-4 mr-2" />
                          Alterar Senha
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
    </div>
  )
}