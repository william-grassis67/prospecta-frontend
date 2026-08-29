# Leadly — Frontend

Frontend da Leadly, uma plataforma de prospecção B2B desenvolvida para ajudar empresas e profissionais de vendas a encontrar, organizar e analisar potenciais clientes.

A aplicação permite pesquisar empresas por segmento e localização, visualizar informações de contato, analisar resultados em um mapa e gerenciar leads através de um dashboard.

## Sobre o projeto

A Leadly tem como objetivo simplificar o processo de prospecção comercial, centralizando a busca e organização de potenciais clientes em uma única plataforma.

O usuário pode realizar pesquisas utilizando informações como:

* Tipo de negócio
* País
* Estado ou região
* Cidade ou localização

Os resultados podem ser filtrados de acordo com a disponibilidade de informações de contato.

## Funcionalidades

### Busca de Leads

Pesquisa de empresas utilizando segmento e localização.

### Filtros

Possibilidade de filtrar empresas de acordo com os dados disponíveis:

* Telefone
* E-mail
* Website
* Telefone e e-mail
* Telefone e website
* Qualquer forma de contato

### Visualização no Mapa

Os resultados podem ser visualizados geograficamente utilizando Leaflet, facilitando a identificação da localização das empresas encontradas.

### Dashboard

O dashboard apresenta informações relacionadas à prospecção, incluindo:

* Total de leads
* Novos leads
* Leads convertidos
* Taxa de conversão
* Atividades recentes
* Leads recentes
* Indicadores de desempenho

### Detalhes do Lead

A aplicação permite visualizar informações detalhadas das empresas encontradas e adicionar leads à lista de contatos.

### Autenticação

O frontend possui interfaces para:

* Login
* Cadastro
* Recuperação de senha
* Gerenciamento da sessão do usuário

A comunicação com o backend é realizada através de uma API REST.

## Tecnologias

* HTML5
* CSS3
* JavaScript
* Leaflet
* Vercel

## Estrutura do Projeto

```text
prospecta-frontend/
│
├── assets/
│   └── recursos visuais
│
├── css/
│   └── estilos da aplicação
│
├── js/
│   ├── api.js
│   ├── cadastro.js
│   ├── config.js
│   ├── dashboard.js
│   ├── leads.js
│   ├── login.js
│   ├── storage.js
│   └── ui-helpers.js
│
├── cadastro.html
├── dashboard.html
├── forgotpassword.html
├── index.html
└── README.md
```

## Organização do JavaScript

### api.js

Responsável pela comunicação entre o frontend e o backend através de requisições HTTP.

### config.js

Centraliza configurações utilizadas pela aplicação, incluindo a configuração da API.

### login.js

Responsável pelo processo de autenticação dos usuários.

### cadastro.js

Gerencia o cadastro de novos usuários.

### dashboard.js

Controla as informações e funcionalidades apresentadas no dashboard.

### leads.js

Responsável pela busca, filtragem, exibição e interação com os leads.

### storage.js

Gerencia informações armazenadas localmente no navegador.

### ui-helpers.js

Contém funções auxiliares relacionadas à interface da aplicação.

## Executando Localmente

Clone o repositório:

```bash
git clone <repository-url>
```

Entre na pasta:

```bash
cd prospecta-frontend
```

Como o projeto utiliza HTML, CSS e JavaScript, pode ser executado utilizando um servidor local.

Por exemplo:

```bash
python -m http.server 5500
```

Depois, abra:

```text
http://localhost:5500
```

Também é possível utilizar ferramentas como Live Server para executar o projeto durante o desenvolvimento.

## Integração com Backend

O frontend foi desenvolvido para consumir uma API REST responsável pelas funcionalidades de backend.

A arquitetura segue, de forma geral:

```text
Frontend
   |
   v
API REST
   |
   v
Backend
   |
   v
Banco de Dados
```

A configuração da API pode ser encontrada em:

```text
js/config.js
```

## Deploy

O frontend está preparado para deploy utilizando Vercel.

## Roadmap

* [ ] Sistema completo de contatos
* [ ] Planos e assinaturas
* [ ] Integração com sistema de pagamentos
* [ ] Busca avançada de empresas
* [ ] Varredura ampliada de dados na internet
* [ ] Histórico de pesquisas
* [ ] Exportação de leads
* [ ] Métricas reais no dashboard
* [ ] Sistema de limites por plano
* [ ] Melhorias na qualificação automática de leads

## Objetivo

A Leadly busca reduzir o trabalho manual envolvido na prospecção comercial.

O fluxo principal da plataforma é:

```text
Pesquisar
   ↓
Encontrar
   ↓
Filtrar
   ↓
Analisar
   ↓
Prospectar
```

## Autor

William Roque

## Licença

Este projeto é proprietário e faz parte do desenvolvimento da plataforma Leadly.

Todos os direitos reservados.
