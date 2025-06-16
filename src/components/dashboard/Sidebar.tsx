'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  HomeIcon,
  UsersIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CogIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  userRole: string
}

export default function Sidebar({ sidebarOpen, setSidebarOpen, userRole }: SidebarProps) {
  const pathname = usePathname()

  // Navegação baseada no role do usuário
  const getNavigation = () => {
    const baseNavigation = [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    ]

    if (userRole === 'clinic_admin' || userRole === 'clinic_viewer') {
      return [
        ...baseNavigation,
        { name: 'Leads', href: '/dashboard/leads', icon: UsersIcon },
        { name: 'Consultores', href: '/dashboard/consultants', icon: UserGroupIcon },
        { name: 'Gerentes', href: '/dashboard/managers', icon: BuildingOfficeIcon },
        { name: 'Comissões', href: '/dashboard/commissions', icon: CurrencyDollarIcon },
        { name: 'Relatórios', href: '/dashboard/reports', icon: ChartBarIcon },
        ...(userRole === 'clinic_admin' ? [
          { name: 'Configurações', href: '/dashboard/settings', icon: CogIcon },
        ] : []),
      ]
    }

    if (userRole === 'manager') {
      return [
        ...baseNavigation,
        { name: 'Meus Leads', href: '/dashboard/leads', icon: UsersIcon },
        { name: 'Minha Equipe', href: '/dashboard/team', icon: UserGroupIcon },
        { name: 'Minhas Comissões', href: '/dashboard/commissions', icon: CurrencyDollarIcon },
        { name: 'Relatórios', href: '/dashboard/reports', icon: ChartBarIcon },
      ]
    }

    if (userRole === 'consultant') {
      return [
        ...baseNavigation,
        { name: 'Novo Lead', href: '/dashboard/leads/new', icon: PlusIcon },
        { name: 'Meus Leads', href: '/dashboard/leads', icon: UsersIcon },
        { name: 'Minhas Comissões', href: '/dashboard/commissions', icon: CurrencyDollarIcon },
      ]
    }

    return baseNavigation
  }

  const navigation = getNavigation()

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-16 flex-shrink-0 px-4 bg-white border-b border-secondary-200">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="w-6 h-5">
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0.5 h-0.5 bg-primary-600 rounded-full"></div>
              <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-2 h-1.5 border border-primary-600 border-b-0 rounded-t-full"></div>
              <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-3.5 h-2.5 border border-primary-600 border-b-0 rounded-t-full"></div>
              <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-5 h-3.5 border border-primary-600 border-b-0 rounded-t-full"></div>
            </div>
          </div>
          <span className="text-xl font-bold text-secondary-900">indicme</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 bg-white overflow-y-auto">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'sidebar-item',
                  isActive && 'active'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Info */}
      <div className="flex-shrink-0 border-t border-secondary-200 p-4 bg-secondary-50">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {userRole === 'clinic_admin' ? 'CA' : 
                 userRole === 'clinic_viewer' ? 'CV' :
                 userRole === 'manager' ? 'M' : 'C'}
              </span>
            </div>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-900 truncate">
              {userRole === 'clinic_admin' ? 'Admin da Clínica' :
               userRole === 'clinic_viewer' ? 'Visualizador' :
               userRole === 'manager' ? 'Gerente' : 'Consultor'}
            </p>
            <p className="text-xs text-secondary-500 truncate">
              {userRole === 'clinic_admin' ? 'Acesso total' :
               userRole === 'clinic_viewer' ? 'Somente leitura' :
               userRole === 'manager' ? 'Gerencia equipe' : 'Faz indicações'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 md:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-secondary-600 bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 flex z-40">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute top-0 right-0 -mr-12 pt-2">
                    <button
                      type="button"
                      className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Fechar sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent />
              </Dialog.Panel>
            </Transition.Child>
            <div className="flex-shrink-0 w-14">{/* Force sidebar to shrink to fit close icon */}</div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 border-r border-secondary-200 bg-white">
          <SidebarContent />
        </div>
      </div>
    </>
  )
}