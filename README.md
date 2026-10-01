# Rose Modas

**Construção — Tarefa 1 da Fase 0. Aguardando validação da Yasmin.**

Referência técnica: Arquitetura V2. Referência visual: `prototipo/index.html`.
O `index.html` da raiz continua sendo o kit de marca; a aplicação fica em `apps/vitrine`.
Esta entrega prepara a aplicação e o catálogo no banco. Não contém telas da loja.

## Desenvolvimento

Node 24 e `npm ci`. `npm run dev` inicia somente a tela de preparação em localhost:5173.
`npm run build:homologation` verifica TypeScript e gera `dist/vitrine`.

Copie `.env.development.example` para `.env.development` e preencha somente a chave
pública local. A configuração hospedada usa `.env.homologation.example`; URL/chave
do projeto dedicado e vínculo Vercel ainda precisam ser configurados. Não há projeto
Rose conectado nem promoção automática para produção nesta entrega.

## Banco e testes

Com Docker/Podman: `npm run db:start` e `npm run db:reset:dev` aplicam a migration
no Supabase local (PostgreSQL 17). O reset é somente local e descarta seus dados.

`npm run test:db` cria duas bases PGlite independentes (PostgreSQL 18.3), aplica a mesma migration e
confere os mesmos testes e a igualdade dos schemas. A fixture Auth/Storage usada
nesse runner fica em `tests/database/platform-fixture.sql`, fora das migrations.

O workflow `fase-0.yml` repete a validação no Supabase completo: dois resets locais,
suíte SQL em cada reset e comparação dos resultados. Os testes não aceitam bancos
remotos e todos os dados de teste são descartados por rollback.

## Decisões de implementação desta tarefa, ainda em validação

- Somente as nove tabelas da Fase 0; FK de autoria usa `auth.users`.
- `usuarios_internos` e autorização da equipe entram na Fase 1. Agora, escritas
  são restritas ao servidor; nenhum usuário autenticado ganha acesso interno.
- Saldo é alterado por `ajustar_estoque`, com ledger, projeção e auditoria na mesma
  transação. Não há reserva na Fase 0; `estoque_reservado` é zero nesta fase.
- A view `v_estoque_disponivel` usa `security_invoker`. Um helper privado retorna
  apenas saldo publicável, preservando o bloqueio de custo e saldos internos.
- Configurações públicas: apenas `nome_loja`, `descricao_loja` e `logo_caminho`.
- Bucket `produtos-publico` criado pela migration. Fotos nesse bucket são públicas;
  visitantes têm somente leitura. Não foram criados buckets de fases futuras.

Este registro é operacional e de construção. Não constitui homologação,
documentação final, release ou congelamento da baseline.
