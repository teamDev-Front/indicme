# IndicMe - Sistema de Indicações

Um sistema moderno e escalável para gestão de indicações e comissões, desenvolvido com Next.js 14.2.4 e Supabase.

## 🚀 Características

- **Sistema Hierárquico Completo**: Clínica > Gerentes > Consultores
- **Gestão de Leads**: Cadastro, acompanhamento e conversão
- **Comissões Automáticas**: Cálculo e pagamento de comissões
- **Interface Moderna**: Design responsivo com Tailwind CSS
- **Autenticação Segura**: Sistema de auth com Supabase
- **Tempo Real**: Atualizações em tempo real
- **Relatórios Avançados**: Analytics e métricas detalhadas

## 🛠 Tecnologias

- **Frontend**: Next.js 14.2.4, React 18, TypeScript
- **Styling**: Tailwind CSS, Headless UI, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Forms**: React Hook Form com Zod validation
- **Charts**: Recharts
- **Icons**: Heroicons, Lucide React

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase

## 🔧 Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd indicme
```

2. **Instale as dependências**
```bash
npm install
# ou
yarn install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env.local
```

Edite o arquivo `.env.local` com suas credenciais do Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. **Execute o script SQL no Supabase**
- Acesse o painel do Supabase
- Vá para SQL Editor
- Execute o conteúdo do arquivo de schema fornecido

5. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
# ou
yarn dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 📊 Estrutura do Banco de Dados

### Hierarquia de Usuários
- **Clinic Admin**: Acesso total ao sistema
- **Clinic Viewer**: Visualização e alteração de status
- **Manager**: Gerencia equipe de consultores
- **Consultant**: Faz indicações e cadastra leads

### Tabelas Principais
- `users`: Usuários do sistema
- `clinics`: Clínicas cadastradas
- `leads`: Leads indicados
- `commissions`: Comissões geradas
- `hierarchies`: Relação manager-consultant

## 🔐 Segurança

- Row Level Security (RLS) habilitado
- Políticas de acesso baseadas em roles
- Validação de dados com Zod
- Prevenção de leads duplicados
- Middleware de autenticação

## 📱 Funcionalidades por Role

### Clinic Admin
- ✅ Visualizar todos os dados
- ✅ Gerenciar usuários
- ✅ Configurar comissões
- ✅ Pagar comissões
- ✅ Relatórios completos

### Clinic Viewer
- ✅ Visualizar dados
- ✅ Alterar status de leads
- ❌ Não pode deletar ou criar

### Manager
- ✅ Ver leads de sua equipe
- ✅ Gerenciar consultores
- ✅ Receber comissões
- ✅ Relatórios da equipe

### Consultant
- ✅ Cadastrar leads
- ✅ Ver próprios leads
- ✅ Receber comissões
- ❌ Não vê dados de outros

## 🎨 Design System

O projeto utiliza um design system personalizado baseado em:

- **Cores**: Paleta moderna com primary, secondary, success, warning, danger
- **Componentes**: Buttons, Cards, Badges, Forms padronizados
- **Animações**: Micro-interações com Framer Motion
- **Responsividade**: Mobile-first design

## 📈 Próximas Funcionalidades

- [ ] Sistema de notificações
- [ ] Integração com WhatsApp
- [ ] Relatórios PDF
- [ ] Dashboard analytics avançado
- [ ] API para integrações
- [ ] App mobile

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

Para suporte e dúvidas:
- 📧 Email: suporte@indicme.com.br
- 💬 WhatsApp: (11) 99999-9999
- 📖 Documentação: [docs.indicme.com.br](https://docs.indicme.com.br)

---

**IndicMe** - Confiança que conecta. 🚀