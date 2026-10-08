# Rose Modas

**Construção — vitrine e curadoria do catálogo, aguardando validação da Yasmin.**

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
  `homolog.rosemenezesmodas.com.br` foi configurado posteriormente, com DNS válido.

Na Tarefa 2, a tela técnica validou a consulta pública (`produtos.id`). A Tarefa 3
substitui essa tela pela Home e coleção. Configure, somente em
Preview na Vercel, `VITE_APP_ENV=homologation`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_REF`. A referência deve
corresponder ao projeto exclusivo de homologação. Use chave publishable, nunca uma
credencial de servidor. Na Tarefa 2 o build recusava produção; o ajuste de
autenticação de 08/10 permite produção com configuração própria verificada.
O build continua recusando chaves privadas, variáveis públicas
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

## Primeira entrega da Home e coleção — substituída pela correção abaixo

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

## Correção da homologação inicial — fidelidade ao mockup

Solicitação da Yasmin em 06/10/2026: entregar a vitrine conforme o mockup,
completando as pendências da Fase 0. São ajustes da primeira homologação, não melhoria.

- Home e coleção restauradas: mesmos textos, cores, fontes, logo, ilustrações,
  espaçamentos, header, categorias, cards, esgotados e rodapé da referência.
- Cards abrem página do produto: galeria, cores, saldo por tamanho, medidas,
  descrição e peças relacionadas. Busca por nome/código, favoritos neste navegador,
  guia de medidas, Quem somos e Trocas implementados.
- Banner fixo identifica dados fictícios e ausência de vendas. Textos de condições,
  CNPJ de exemplo, avaliações e cotação de frete permanecem demonstrativos.
  Não há integração de pagamento, frete, criação de cliente, pedido ou reserva.
- Área da cliente, sacola/checkout e painel operacional mantêm seus pontos de
  navegação visuais e informam a fase prevista; não simulam operações concluídas.
- Avise-me abre solicitação por WhatsApp com consentimento, sem criar cadastro.
  O envio final é feito pelo usuário no aplicativo. O número comercial ainda não
  foi informado. Botões não inventam um destinatário nem confirmam envio inexistente.
- Migration adicional `20261006170640_fase_0_contatos_publicos.sql`: amplia somente
  a lista explícita de configurações públicas com `whatsapp_numero` e `instagram_url`.
  Não altera a migration original, tabelas, FKs, estoque ou permissões internas.
  Histórico remoto usa a mesma versão do arquivo (normalizado após a versão MCP).
- Seed `homologacao-mockup.sql`: somente `kernpudxhwkpoadahgqj`, marcador privado
  obrigatório. Completa 12 modelos, 96 variações e 216 medidas fictícias; renomeia
  cores das variações de exemplo existentes, preservando os respectivos saldos.
  Total: 181 unidades fictícias, 74 movimentos e 539 registros de auditoria.
  Reaplicação hospedada preservou todas essas contagens.
- O build de homologação disponibiliza `/referencia/index.html`, cópia exata e
  separada de `prototipo/index.html`, para comparação visual. Essa referência não
  executa consultas nem alimenta a vitrine; não é implementação de fases futuras.
- Testes: sete de catálogo, três da vitrine (incluindo seed e RLS), sete de ambiente,
  build/inspeção de secrets e duas bases limpas com as migrations sequenciais.

Permanece em CONSTRUÇÃO. Não representa aprovação, release ou congelamento.

## Banco e testes

Com Docker/Podman: `npm run db:start` e `npm run db:reset:dev` aplicam a migration
no Supabase local (PostgreSQL 17). O reset é somente local e descarta seus dados.

`npm run test:db` cria duas bases PGlite independentes (PostgreSQL 18.3), aplica as migrations da Fase 0 e
confere os mesmos testes e a igualdade dos schemas. A fixture Auth/Storage usada
nesse runner fica em `tests/database/platform-fixture.sql`, fora das migrations.

O workflow `fase-0.yml` repete a validação no Supabase completo: dois resets locais,
suíte SQL em cada reset e comparação dos resultados. Os testes não aceitam bancos
remotos e todos os dados de teste são descartados por rollback.

## Decisões de implementação desta tarefa, ainda em validação

- Somente as nove tabelas da Fase 0; FK de autoria usa `auth.users`.
- Na Tarefa 1, `usuarios_internos` e autorização da equipe ficaram para a Fase 1.
  A solicitação operacional de 07/10 introduz somente essa tabela da V2, com uso
  real no cadastro do catálogo. Contas autenticadas sem equipe ativa e MFA continuam bloqueadas.
- Saldo é alterado por `ajustar_estoque`, com ledger, projeção e auditoria na mesma
  transação. Não há reserva na Fase 0; `estoque_reservado` é zero nesta fase.
- A view `v_estoque_disponivel` usa `security_invoker`. Um helper privado retorna
  apenas saldo publicável, preservando o bloqueio de custo e saldos internos.
- Configurações públicas: `nome_loja`, `descricao_loja`, `logo_caminho` e, nesta correção, `whatsapp_numero` e `instagram_url`.
- Bucket `produtos-publico` criado pela migration. Fotos nesse bucket são públicas;
  visitantes têm somente leitura. Não foram criados buckets de fases futuras.

Este registro é operacional e de construção. Não constitui homologação,
documentação final, release ou congelamento da baseline.

## Curadoria e cadastro interno — entrega em construção de 07/10/2026

Yasmin solicitou iniciar o cadastro pelas fotos e completar nome, preço, tamanhos,
medidas e descrição pelo painel. A entrega usa a tela Nova peça do protótipo e a
autorização prevista na V2: `usuarios_internos`, papéis admin/estoque, sessão e host
separados, MFA obrigatório. Não cria clientes, pedidos, reservas ou pagamentos.

- Migration adicional `20261007144351_catalogo_curadoria_acesso_interno.sql`.
  Preserva a fundação original; inclui rascunhos ocultos e informações de curadoria.
  Preço, nome e categoria podem ficar pendentes no rascunho. Publicação exige nome,
  preço válido, categoria ativa, foto de capa enviada e variação com quantidade.
- Painel: `https://rosemodas-painel-homologacao.vercel.app/`. Em DEV, `/painel`.
  Permite criar peça, enviar fotos/vídeo, escolher capa, editar dados/variações/SKU,
  registrar quantidade pelo ledger, cadastrar medidas, publicar e retirar da vitrine.
  Paginação em 48 registros; busca e filtro por situação. Alterações concorrentes
  impedem sobrescrever uma revisão anterior. Arquivos não são sobrescritos/apagados.
- A RPC pública é invoker; a implementação privilegiada fica em `private` e
  verifica equipe ativa, papel e AAL2 em toda operação. Metadados editáveis não
  concedem autorização. Acesso direto de visitantes a custos, auditoria e estoque
  interno continua bloqueado. Nenhuma chave de servidor está no navegador.
- Curadoria do Drive: 168 fotos analisadas, 18 peças/modelos sugeridos, 66 fotos
  selecionadas. Manifesto e DML idempotente em `supabase/importacoes/`. Os nomes
  sugeridos são internos e precisam de revisão. Preço, quantidade, variações e
  medidas não foram inferidos. Os rascunhos não entram na loja automaticamente.
- As fotos selecionadas são WebP com até 1600 px, sem corte, preservando proporção.
  Os originais permanecem no Drive. O upload operacional confere SHA-256 e só
  aceita arquivos de um lote com autorização privada temporária; esta é desativada
  após a importação. A credencial temporária fica fora do Git e do front-end.
- WhatsApp comercial configurado conforme o número informado pela Yasmin.
  Não cria pedido, reserva ou cobrança. O envio da mensagem é feito pela cliente.
- Validação: 21 testes de aplicação/ambiente, 17 grupos SQL em duas bases limpas,
  typecheck/build e inspeção de credenciais. Os testes específicos do cadastro
  também são executados no hospedado com dados isolados por rollback.

Primeiro acesso da equipe depende do convite Auth e da URL de retorno configurada
no Supabase. A habilitação da conta não representa homologação da experiência de
login ou do cadastro pela Yasmin. Produção e main permanecem sem alteração.

## Histórico: acesso sem senha — substituído por e-mail e senha em 08/10/2026

Yasmin pediu retirar senha e configuração de autenticador, escolhendo e-mail OU
SMS. Este pedido substitui a exigência de TOTP para seu acesso; é construção,
sem aprovação final ou congelamento. Migration: `20261007175733_catalogo_acesso_email_sms.sql`.

- E-mail: link de acesso de uso único, como no protótipo. Também aceita código
  quando o template do Supabase incluir `{{ .Token }}`. Convites existentes podem
  abrir o catálogo sem criar senha. Link expirado permite solicitar novo acesso.
- SMS: caminho de código implementado, exibido conforme os canais habilitados
  no Auth. No hospedado está desativado: exige configurar um provedor de envio e
  verificar o telefone da mesma conta. O WhatsApp comercial não foi usado como
  telefone de autenticação da Yasmin. Nenhum provedor ou plano foi contratado.
- Cadastro automático desativado nas duas chamadas `signInWithOtp`. E-mail/SMS
  não concedem papel: a conta precisa estar ativa em `usuarios_internos` e ser
  admin/estoque. A escolha do método fica na tabela interna, sem autoalteração.
- Para a conta autorizada a entrar sem TOTP, o banco exige método real `otp`,
  `magiclink` ou `invite`, emitido pelo Auth. Sessão só por senha, anônima, método
  ausente ou metadados fabricados não habilitam o catálogo. Outras contas mantêm
  o padrão de MFA até configuração administrativa explícita.
- Reenvio espera 60 segundos e apresenta limites do provedor sem prometer envio.
  A sessão interna continua separada da vitrine. Nenhuma credencial é exibida.

Validação do ajuste: 23 testes de aplicação/ambiente, 19 grupos SQL em duas bases
limpas e testes de autorização executados também no hospedado com rollback.
A conta administrativa da Yasmin foi habilitada para o método sem TOTP.
Entrega para nova validação de acesso; não altera catálogo nem produção.


## Autenticação por e-mail e senha — em construção

O acesso atual substitui o fluxo histórico por link mágico/SMS. Painel em
`/painel` e área da cliente em `/#/cliente`, com sessões separadas. Admin não
possui cadastro público; cliente se cadastra somente quando o projeto Auth está
configurado para liberar a sessão sem confirmação de e-mail. Não há recuperação
por e-mail: cliente recebe o contato do WhatsApp e equipe procura a administradora.

Migrations únicas: `20261008002321_auth_email_senha_perfis.sql` e
`20261008002336_area_cliente_consulta_pedidos.sql`. Configuração hospedada,
permissões, testes e pendências estão em
[Autenticação — em construção](documentacao/autenticacao-senha-em-construcao.md).
Esta entrega não constitui homologação final, release nem congelamento.
