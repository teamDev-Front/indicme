// src/components/establishments/EstablishmentAutocomplete.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { BuildingOfficeIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Combobox } from '@headlessui/react'
import clsx from 'clsx'

interface EstablishmentAutocompleteProps {
    value: string
    onChange: (value: string) => void
    onCreateNew?: (name: string) => void
    placeholder?: string
    disabled?: boolean
}

interface EstablishmentOption {
    code: string
    name: string
    description?: string
}

export default function EstablishmentAutocomplete({
    value,
    onChange,
    onCreateNew,
    placeholder = "Digite para buscar ou criar novo...",
    disabled = false
}: EstablishmentAutocompleteProps) {
    const [query, setQuery] = useState('')
    const [establishments, setEstablishments] = useState<EstablishmentOption[]>([])
    const [loading, setLoading] = useState(false)
    const [showCreateOption, setShowCreateOption] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        fetchEstablishments()
    }, [])

    useEffect(() => {
        // Mostrar opção de criar novo se query não vazia e não encontrou match exato
        const exactMatch = establishments.find(
            est => est.name.toLowerCase() === query.toLowerCase()
        )
        setShowCreateOption(query.length > 2 && !exactMatch && onCreateNew !== undefined)
    }, [query, establishments, onCreateNew])

    const fetchEstablishments = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('establishment_codes')
                .select('code, name, description')
                .eq('is_active', true)
                .order('name')

            if (error) throw error
            setEstablishments(data || [])
        } catch (error) {
            console.error('Erro ao buscar estabelecimentos:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredEstablishments = query === ''
        ? establishments
        : establishments.filter((establishment) => {
            return establishment.name.toLowerCase().includes(query.toLowerCase()) ||
                establishment.code.toLowerCase().includes(query.toLowerCase())
        })

    const selectedEstablishment = establishments.find(est => est.name === value)

    const handleCreateNew = async () => {
        if (onCreateNew && query) {
            try {
                // Gerar código único de 6 caracteres
                const baseCode = query.toUpperCase()
                    .replace(/[^A-Z0-9]/g, '') // Remove caracteres especiais
                    .substring(0, 3) // Pega só 3 caracteres

                const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase() // 3 caracteres aleatórios
                const code = baseCode + randomSuffix

                const { error } = await supabase
                    .from('establishment_codes')
                    .insert({
                        code,
                        name: query,
                        is_active: true
                    })

                if (error) throw error

                // Chamar callback para atualizar o formulário pai
                onCreateNew(query)
                setQuery('')

                // Recarregar a lista de estabelecimentos
                fetchEstablishments()

            } catch (error) {
                console.error('Erro ao criar estabelecimento:', error)
                // Toast será exibido pelo componente pai
            }
        }
    }

    return (
        <Combobox value={value} onChange={onChange} disabled={disabled}>
            <div className="relative">
                <Combobox.Input
                    className="input pr-10"
                    placeholder={placeholder}
                    displayValue={(establishment: string) => establishment}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <BuildingOfficeIcon className="h-5 w-5 text-secondary-400" />
                </Combobox.Button>

                <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {loading && (
                        <div className="relative cursor-default select-none py-2 px-4 text-secondary-700">
                            Carregando...
                        </div>
                    )}

                    {!loading && filteredEstablishments.length === 0 && query !== '' && !showCreateOption && (
                        <div className="relative cursor-default select-none py-2 px-4 text-secondary-700">
                            Nenhum estabelecimento encontrado.
                        </div>
                    )}

                    {filteredEstablishments.map((establishment) => (
                        <Combobox.Option
                            key={establishment.code}
                            value={establishment.name}
                            className={({ active }) =>
                                clsx(
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-primary-600 text-white' : 'text-secondary-900'
                                )
                            }
                        >
                            {({ selected, active }) => (
                                <>
                                    <div className="flex items-center">
                                        <BuildingOfficeIcon
                                            className={clsx('h-5 w-5 mr-3', active ? 'text-white' : 'text-secondary-400')}
                                        />
                                        <div>
                                            <span className={clsx('block truncate', selected && 'font-medium')}>
                                                {establishment.name}
                                            </span>
                                            <span className={clsx('block text-xs', active ? 'text-primary-200' : 'text-secondary-500')}>
                                                {establishment.code} {establishment.description && `• ${establishment.description}`}
                                            </span>
                                        </div>
                                    </div>
                                    {selected && (
                                        <span
                                            className={clsx(
                                                'absolute inset-y-0 left-0 flex items-center pl-3',
                                                active ? 'text-white' : 'text-primary-600'
                                            )}
                                        >
                                            <BuildingOfficeIcon className="h-5 w-5" />
                                        </span>
                                    )}
                                </>
                            )}
                        </Combobox.Option>
                    ))}

                    {showCreateOption && (
                        <Combobox.Option
                            value={query}
                            onClick={handleCreateNew}
                            className={({ active }) =>
                                clsx(
                                    'relative cursor-pointer select-none py-2 pl-10 pr-4 border-t border-secondary-200',
                                    active ? 'bg-success-600 text-white' : 'text-success-600'
                                )
                            }
                        >
                            {({ active }) => (
                                <div className="flex items-center">
                                    <PlusIcon className={clsx('h-5 w-5 mr-3', active ? 'text-white' : 'text-success-600')} />
                                    <div>
                                        <span className="block truncate font-medium">
                                            Criar novo estabelecimento
                                        </span>
                                        <span className={clsx('block text-xs', active ? 'text-success-200' : 'text-success-500')}>
                                            &quot;{query}&quot;
                                        </span>
                                    </div>
                                </div>
                            )}
                        </Combobox.Option>
                    )}
                </Combobox.Options>
            </div>
        </Combobox>
    )
}