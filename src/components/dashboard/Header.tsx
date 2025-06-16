'use client'

import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Bars3Icon, BellIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

interface User {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: 'clinic_admin' | 'clinic_viewer' | 'manager' | 'consultant'
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
}

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
  user: User
}

export default function Header({ setSidebarOpen, user }: HeaderProps) {
  const { signOut } = useAuth()
  const router = useRouter()

  const userNavigation = [
    { name: 'Seu Perfil', href: '/dashboard/profile' },
    { name: 'Configurações', href: '/dashboard/settings', requireAdmin: true },
    { name: 'Sair', action: signOut },
  ]

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'clinic_admin':
        return 'Administrador da Clínica'
      case 'clinic_viewer':
        return 'Visualizador da Clínica'
      case 'manager':
        return 'Gerente'
      case 'consultant':
        return 'Consultor'
      default:
        return 'Usuário'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'clinic_admin':
        return 'bg-danger-100 text-danger-800'
      case 'clinic_viewer':
        return 'bg-warning-100 text-warning-800'
      case 'manager':
        return 'bg-primary-100 text-primary-800'
      case 'consultant':
        return 'bg-success-100 text-success-800'
      default:
        return 'bg-secondary-100 text-secondary-800'
    }
  }

  const handleNavigation = (item: any) => {
    if (item.action) {
      item.action()
    } else if (item.href) {
      router.push(item.href)
    }
  }

  const shouldShowItem = (item: any) => {
    if (item.requireAdmin) {
      return user.role === 'clinic_admin'
    }
    return true
  }

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-secondary-200">
      {/* Mobile menu button */}
      <button
        type="button"
        className="px-4 border-r border-secondary-200 text-secondary-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Abrir sidebar</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Content */}
      <div className="flex-1 px-4 flex justify-between items-center">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-secondary-900">
            Dashboard
          </h1>
          <span className={clsx('badge', getRoleColor(user.role))}>
            {getRoleDisplayName(user.role)}
          </span>
        </div>

        {/* Right side */}
        <div className="ml-4 flex items-center md:ml-6 space-x-4">
          {/* Notifications */}
          <button
            type="button"
            className="p-1 rounded-full text-secondary-400 hover:text-secondary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 relative"
          >
            <span className="sr-only">Ver notificações</span>
            <BellIcon className="h-6 w-6" aria-hidden="true" />
            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-danger-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">3</span>
            </span>
          </button>

          {/* Profile dropdown */}
          <Menu as="div" className="ml-3 relative">
            <div>
              <Menu.Button className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 lg:p-2 lg:rounded-md lg:hover:bg-secondary-50">
                <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center lg:mr-3">
                  <span className="text-sm font-medium text-white">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-secondary-900">{user.full_name}</p>
                  <p className="text-xs text-secondary-500">{user.email}</p>
                </div>
                <ChevronDownIcon className="hidden lg:block ml-2 h-4 w-4 text-secondary-400" />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                {/* Mobile user info */}
                <div className="px-4 py-2 border-b border-secondary-200 lg:hidden">
                  <p className="text-sm font-medium text-secondary-900">{user.full_name}</p>
                  <p className="text-xs text-secondary-500">{user.email}</p>
                  <div className="mt-1">
                    <span className={clsx('badge text-xs', getRoleColor(user.role))}>
                      {getRoleDisplayName(user.role)}
                    </span>
                  </div>
                </div>
                
                {userNavigation.filter(shouldShowItem).map((item) => (
                  <Menu.Item key={item.name}>
                    {({ active }) => (
                      <button
                        onClick={() => handleNavigation(item)}
                        className={clsx(
                          active ? 'bg-secondary-100' : '',
                          'block px-4 py-2 text-sm text-secondary-700 w-full text-left hover:bg-secondary-50 transition-colors'
                        )}
                      >
                        {item.name}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  )
}