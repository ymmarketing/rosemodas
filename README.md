# Rose Modas

**Construção — Tarefa 3 da Fase 0: Home e coleção, aguardando homologação da Yasmin.**

Referência técnica: Arquitetura V2. Referência visual: `prototipo/index.html`.
O `index.html` da raiz continua sendo o kit de marca; a aplicação fica em `apps/vitrine`.
Esta entrega implementa a Home e a coleção sobre o catálogo público da Fase 0.
A Tarefa 1 foi validada tecnicamente; a Fase 0 continua sem homologação final.

## Desenvolvimento

Node 24 e `npm ci`. `npm run dev` inicia a Home e a coleção em localhost:5173.
`npm run build:homologation` verifica TypeScript e gera `dist/vitrine`.

Copie `.env.development.example` para `.env.development` e preencha somente a chave
pública local. A configuração hospedada usa `.env.homologation.example`, preenchido
localmente em `.env.homologation` (ignorado pelo Git). Não há promoção automática
para produção nesta entrega.

## Homologação hospedada — Tarefa 2

Ambiente dedicado configurado e verificado em 06/10/2026:

- Organização Supabase: **Rose Modas — Homologação**, plano **Free**.
- Projeto Supabase: **ROSE MODAS — HOMOLOGAÇÃO**, referência `kernpudxhwkpoadahgqj`,
  região São Paulo (`sa-east-1`), PostgreSQL 17.11.
- Projeto Vercel: `rosemodas-homologacao`, conectado a `ymmarketing/rosemodas`.
- Branch: `feat/fase-0-fundacao`; somente Preview, sem merge na `main`.
- URL da branch: https://rosemodas-homologacao-git-feat-fas-4df791-ym-marketing-negocios.vercel.app/
  O Preview mantém a proteção de acesso da Vercel. O subdomínio
  `homolog.rosemenezes.com.br` não foi configurado nesta tarefa.

Na Tarefa 2, a tela técnica validou a consulta pública (`produtos.id`). A Tarefa 3
substitui essa tela pela Home e coleção. Configure, somente em
Preview na Vercel, `VITE_APP_ENV=homologation`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_REF`. A referência deve
corresponder ao projeto exclusivo de homologação. Use chave publishable, nunca uma
credencial de servidor. O build recusa produção, chaves privadas, variáveis públicas
não previstas e preview sem configuração completa. As quatro variáveis estão
configuradas como encrypted, apenas em Preview e nesta branch. O bundle recebe
somente essas quatro variáveis da aplicação; metadados automáticos `VITE_VERCEL_*`
são excluídos da validação da aplicação e da exposição ao navegador.

A migration `20261001171459_fase_0_catalogo.sql` foi aplicada sem alteração de
conteúdo ao projeto vazio. O histórico hospedado preserva a versão
`20261001171459` e o nome `fase_0_catalogo`; a versão inicialmente atribuída pelo
MCP foi ajustada nesse único registro para corresponder ao arquivo aprovado.

Verificações no ambiente hospedado:

- Nove tabelas da Fase 0, todas com RLS, 43 índices, constraints válidas,
  funções, triggers habilitadas e view `v_estoque_disponivel`.
- Suíte SQL aprovada de 12 grupos executada no projeto de homologação, com dados
  fictícios isolados em transação e descartados por rollback. SKU, constraints,
  estoque, append-only, FKs, grants, RLS e Storage passaram.
- Onze verificações HTTP com chave pública: leitura do catálogo e da view,
  bloqueio de custos/autoria/ledger/auditoria e escrita pública, leitura do bucket,
  bloqueio de upload público, Auth disponível e acesso administrativo bloqueado.
- Browser smoke real: a aplicação hospedada exibiu **Conexão de leitura ao catálogo
  confirmada**, com `data-conexao=conectado`; nenhum erro da aplicação foi encontrado.
- Bundle hospedado inspecionado: projeto de homologação correto, chave publishable
  pública, ausência de chaves privadas/service role e de referências dos projetos
  de produção existentes.
- CI passou com sete testes de ambiente, typecheck/build, inspeção do bundle e
  reaplicação da migration em duas bases limpas nos runners PGlite e Supabase local.

O bucket `produtos-publico` existe e permite somente leitura ao público; continua
vazio. Não foi realizado teste de download de uma foto, pois nenhuma mídia foi
inserida nessa etapa. Na entrega da Tarefa 2, o projeto permaneceu sem produtos,
usuários Auth ou arquivos persistentes de teste. Não foram copiadas informações reais nem conectadas
integrações financeiras.

O advisor de segurança não identificou warning/error. Os avisos informativos de
RLS sem policy em `audit_log` e `movimentos_estoque` correspondem ao bloqueio público
intencional dessas tabelas; não se deve conceder leitura ao navegador para removê-los.

O primeiro deploy por API foi inferido pela Vercel como produção e foi recusado
pela trava do build, sem publicação. O Preview seguinte revelou metadados
`VITE_VERCEL_*` não previstos; a configuração foi corrigida e recebeu teste de
regressão. O commit acionou o deploy automático GitHub → Vercel em Preview,
que terminou READY. Não houve deploy de produção aprovado nem alteração em bancos
de produção; não existem variáveis da Rose no ambiente Production da Vercel.

`npm run test:environment` valida as travas de configuração. Os runners de banco
continuam aceitando somente bases locais; a execução SQL hospedada desta entrega
foi direcionada explicitamente ao projeto exclusivo de homologação.

## Home e coleção — Tarefa 3, em construção

A organização, cores, fontes, logo, hero, categorias, barra de filtros e cards
seguem `prototipo/index.html`. Nenhuma migration nova foi necessária.

- Leitura pública de categorias, coleções, produtos/mídias, configurações e view de
  disponibilidade, com colunas explícitas e paginação da API.
- Coleção atual como padrão; seleção de coleção, categoria, tamanho com saldo,
  ordenação por novidade/preço efetivo e somente disponíveis.
- Disponibilidade por tamanho soma todas as cores. Promoção de valor zero usa zero.
- Filtros na URL, recarregamento e histórico do navegador; limpar filtros restaura
  a coleção atual. O link do rodapé permite consultar todas as coleções.
- Estados de carregamento, indisponibilidade com nova tentativa, catálogo vazio,
  combinação sem resultado e ausência/falha de foto.
- Layout em quatro, três ou duas colunas, menu móvel, navegação por teclado,
  labels acessíveis e movimento reduzido.
- Sem promessas comerciais não configuradas: frete, parcelamento, agenda de live
  e prazo de troca do protótipo não são tratados como regras aprovadas de venda.

`supabase/seeds/homologacao-catalogo.sql` contém apenas oito modelos fictícios
(`HOM-RM01` a `HOM-RM08`), cinco categorias, uma coleção demonstrativa e 48
variações. Foi aplicado exclusivamente em `kernpudxhwkpoadahgqj`. Exige marcador
privado `ambiente_homologacao` em configurações; não é migration nem seed automático.
A reaplicação preservou 100 unidades fictícias, 37 movimentos e 137 registros de
auditoria, sem duplicar ajustes. Os saldos foram criados por `ajustar_estoque`.
O marcador não é visível ao navegador. Não há usuários Auth ou dados de clientes.

As imagens das peças demonstrativas são ilustrações do protótipo, identificadas
na tela; não são fotografias reais nem evidência de estoque da Rose. Para produtos
com mídia cadastrada, a vitrine resolve a foto principal no bucket público; sem
foto, exibe o estado correspondente. O bucket continua vazio nesta entrega.

`npm run test:catalogo` cobre coleção, combinação de filtros, estoque entre cores,
preço promocional, filtros na URL, seleção de foto principal e catálogo vazio.
Os sete testes de catálogo e sete de ambiente passaram localmente, assim como
build, inspeção de credenciais e os dois bancos limpos. CI e smoke no Preview
fazem parte da entrega; a aprovação de UX e operação continua com a Yasmin.

O escopo termina na Home e listagem da coleção. Página do produto e WhatsApp
ficam para a próxima tarefa autorizada. Não há carrinho, checkout, cadastro,
favoritos, avise-me ou módulos internos nesta aplicação.

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
