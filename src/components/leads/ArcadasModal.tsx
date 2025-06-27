// src/components/leads/ArcadasModal.tsx
'use client'

import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface ArcadasModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (arcadas: number) => void
  leadName: string
}

export default function ArcadasModal({ isOpen, onClose, onConfirm, leadName }: ArcadasModalProps) {
  const [selectedArcadas, setSelectedArcadas] = useState<number>(1)

  const handleConfirm = () => {
    onConfirm(selectedArcadas)
    onClose()
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-secondary-900 flex items-center justify-between"
                >
                  <span>Confirmar Conversão</span>
                  <button
                    onClick={onClose}
                    className="text-secondary-400 hover:text-secondary-500"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-secondary-600 mb-6">
                    O paciente <span className="font-semibold">{leadName}</span> realizou o tratamento em:
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedArcadas(1)}
                      className={clsx(
                        'relative p-6 rounded-lg border-2 transition-all',
                        selectedArcadas === 1
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-secondary-200 hover:border-secondary-300'
                      )}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className="relative">
                          <svg viewBox="0 0 100 50" className="w-20 h-10">
                            {/* Arcada superior */}
                            <path
                              d="M 10 25 Q 50 10 90 25"
                              fill="none"
                              stroke={selectedArcadas === 1 ? '#8B5CF6' : '#E5E7EB'}
                              strokeWidth="3"
                            />
                            {/* Dentes superiores */}
                            {[20, 30, 40, 50, 60, 70, 80].map((x, i) => (
                              <rect
                                key={i}
                                x={x - 3}
                                y="20"
                                width="6"
                                height="10"
                                fill={selectedArcadas === 1 ? '#8B5CF6' : '#E5E7EB'}
                                rx="2"
                              />
                            ))}
                          </svg>
                        </div>
                        <span className={clsx(
                          'text-sm font-medium',
                          selectedArcadas === 1 ? 'text-primary-700' : 'text-secondary-700'
                        )}>
                          Uma Arcada
                        </span>
                        <span className="text-xs text-secondary-500">
                          Superior OU Inferior
                        </span>
                      </div>
                      {selectedArcadas === 1 && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setSelectedArcadas(2)}
                      className={clsx(
                        'relative p-6 rounded-lg border-2 transition-all',
                        selectedArcadas === 2
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-secondary-200 hover:border-secondary-300'
                      )}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className="relative">
                          <svg viewBox="0 0 100 50" className="w-20 h-10">
                            {/* Arcada superior */}
                            <path
                              d="M 10 15 Q 50 5 90 15"
                              fill="none"
                              stroke={selectedArcadas === 2 ? '#8B5CF6' : '#E5E7EB'}
                              strokeWidth="3"
                            />
                            {/* Dentes superiores */}
                            {[20, 30, 40, 50, 60, 70, 80].map((x, i) => (
                              <rect
                                key={`top-${i}`}
                                x={x - 3}
                                y="10"
                                width="6"
                                height="10"
                                fill={selectedArcadas === 2 ? '#8B5CF6' : '#E5E7EB'}
                                rx="2"
                              />
                            ))}
                            {/* Arcada inferior */}
                            <path
                              d="M 10 35 Q 50 45 90 35"
                              fill="none"
                              stroke={selectedArcadas === 2 ? '#8B5CF6' : '#E5E7EB'}
                              strokeWidth="3"
                            />
                            {/* Dentes inferiores */}
                            {[20, 30, 40, 50, 60, 70, 80].map((x, i) => (
                              <rect
                                key={`bottom-${i}`}
                                x={x - 3}
                                y="30"
                                width="6"
                                height="10"
                                fill={selectedArcadas === 2 ? '#8B5CF6' : '#E5E7EB'}
                                rx="2"
                              />
                            ))}
                          </svg>
                        </div>
                        <span className={clsx(
                          'text-sm font-medium',
                          selectedArcadas === 2 ? 'text-primary-700' : 'text-secondary-700'
                        )}>
                          Duas Arcadas
                        </span>
                        <span className="text-xs text-secondary-500">
                          Superior E Inferior
                        </span>
                      </div>
                      {selectedArcadas === 2 && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  </div>

                  <div className="mt-6 bg-primary-50 rounded-lg p-4">
                    <p className="text-sm text-primary-700">
                      <span className="font-semibold">Valor base:</span> R$ 750,00 por arcada
                    </p>
                    <p className="text-lg font-bold text-primary-800 mt-1">
                      Total: R$ {(selectedArcadas * 750).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="flex-1 btn-secondary"
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="flex-1 btn-primary"
                    onClick={handleConfirm}
                  >
                    Confirmar Conversão
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