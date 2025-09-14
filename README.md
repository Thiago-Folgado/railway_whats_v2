# WhatsApp Bot para N8N

Bot WhatsApp integrado com N8N para automação de mensagens e gestão de grupos.

## Funcionalidades

- ✅ Envio automático de mensagens de onboarding
- ✅ Gestão de grupos WhatsApp
- ✅ Integração com N8N via API
- ✅ Processamento de pagamentos aprovados/recusados
- ✅ Logs detalhados

## Endpoints Disponíveis

- `GET /` - Status geral
- `GET /status` - Status do WhatsApp
- `GET /test` - Teste básico
- `GET /grupos` - Listar grupos
- `POST /send` - Enviar mensagens

## Deploy no Railway

Este projeto está configurado para deploy automático no Railway usando Docker.

## Variáveis de Ambiente

- `PORT` - Porta da aplicação (padrão: 3000)
- `NODE_ENV` - Ambiente (production/development)
- `PUPPETEER_EXECUTABLE_PATH` - Caminho do Chrome

## Produtos Suportados

- Protocolo Desinflama
- Protocolo O Fim do Lipedema