# Autenticação por senha — construção, sem congelamento

Solicitação de Yasmin em 08/10/2026. Baseline V2 preservada no domínio alterado.
Não é aprovação final da Fase 0 nem release de produção.

## Ambientes identificados antes de produção

| Ambiente | Supabase | Vercel | Situação verificada |
| --- | --- | --- | --- |
| Homologação | ROSE MODAS — HOMOLOGAÇÃO, `kernpudxhwkpoadahgqj` | `rosemodas-homologacao` | Conectado; migrations aplicadas |
| Produção | Ref e nome ainda não identificados | `rosemodas` | Sem variáveis Supabase e sem produção ativa no projeto Vercel consultado |

Um projeto Supabase Rose foi confirmado. O inventário do plugin não cobre todas
as organizações; não permite afirmar que outro projeto inexiste. Não há evidência
de que os ambientes compartilhem banco. Nenhuma alteração de produção foi feita.

Se for confirmado banco compartilhado, não reaplicar estas migrations: verificar
o histórico e cadastrar os dois domínios em Auth. Dados de homologação também
estarão na produção. Recomenda-se identificar um projeto separado de produção
antes do lançamento, sem copiar usuários, compras ou catálogo fictícios. O build
atual recusa usar a ref conhecida de homologação como produção; um compartilhamento
deliberado exigirá ajustar essa proteção depois da confirmação da Yasmin.

## Migrations únicas

1. `20261008002321_auth_email_senha_perfis.sql`: perfis automáticos de cliente,
   preservação da admin existente, papel controlado pelo banco, autorização por
   sessão com senha, substituição da autorização anterior por OTP.
2. `20261008002336_area_cliente_consulta_pedidos.sql`: consulta protegida de clientes,
   endereços, pedidos, itens, endereço do pedido, envios e eventos. Estrutura da V2;
   sem checkout, cobranças, carrinho, integrações ou criação de pedidos pelo front.

Os timestamps coincidem com o histórico hospedado. Não criar cópias por ambiente.
Em projeto separado, aplicar a sequência versionada uma vez após validar homologação.
Não houve alteração de senha nem exclusão de usuários ou de catálogo existente.

## Configuração Auth hospedada: depende do painel

O plugin disponível aplica SQL e migrations, mas não altera configuração GoTrue.
Não existe sessão autenticada de dashboard disponível nesta execução. Os passos
abaixo são pendentes, não devem ser interpretados como alterações já realizadas.

No projeto **kernpudxhwkpoadahgqj**:

1. **Authentication → Sign In / Providers → Email**: Email ON; permitir cadastro;
   **Confirm email OFF → Save**. O endpoint público confirmou que a confirmação
   continua ligada. A aplicação bloqueia `signUp` enquanto estiver ligada, para
   não disparar e-mail. Login por senha não depende dessa confirmação para a conta
   administrativa já confirmada.
2. Na configuração de segurança de senha do provedor Email, ajustar o mínimo para
   **8 caracteres**. O formulário já exige 8; a restrição hospedada também deve
   ser ajustada. Não habilitar SMTP externo, SMS ou Google nesta entrega.
3. **Authentication → Rate Limits**: conferir o limite do endpoint de tokens
   (`/auth/v1/token`, que atende login por senha). O padrão documentado é
   **150 requisições por 5 minutos, burst 30**. Preservar esses valores se forem os
   atuais; evitar limite inferior a 10 para o teste consecutivo. Não alterar
   limites de e-mail para contornar o problema, pois o novo login não envia e-mail.
4. **Authentication → URL Configuration**:
   - Site URL: `https://homolog.rosemenezesmodas.com.br/`.
   - Redirect URLs: `https://homolog.rosemenezesmodas.com.br/**` e
     `https://rosemodas-painel-homologacao.vercel.app/**`.
   - Save. Login com senha não usa redirect de e-mail; a lista fica preparada para
     provedores futuros, sem implementá-los agora.

No projeto de produção: primeiro obter **ref e nome**, verificar o histórico de
migrations e as variáveis do deploy. Se for outro projeto, repetir os passos
Auth acima, com Site URL e Redirect URLs do domínio real de produção
`https://rosemenezesmodas.com.br/`, e apenas seus aliases efetivamente usados.
Se compartilhar banco, usar uma única configuração Auth e incluir os dois
ambientes na allowlist, avisando sobre o compartilhamento de dados.

## Administradoras

Não há cadastro no painel. Criar a usuária em **Authentication → Users → Add user**,
informar e-mail e senha fora do código e marcar **Auto Confirm User**. Copiar seu
UUID. Em **Table Editor → usuarios_internos**, adicionar a linha com `user_id`,
`nome`, `email` normalizado, `papel = admin`, `ativo = true`. O trigger sincroniza
`profiles.role = admin`; o cadastro comum recebe sempre `cliente`, mesmo se enviar
`user_metadata.role = admin`. A admin existente foi preservada.

Recuperação da equipe é administrada pela proprietária no Supabase; a aplicação
não dispara reset de senha por e-mail. Cliente recebe link do WhatsApp comercial
`5531975417483`. Nunca colocar senha ou service_role em fontes, Vercel VITE ou logs.

## Autorização e dados

- `profiles` é legível apenas pela própria conta; não aceita alteração pelo front.
- RLS consulta o papel ativo no banco, sem confiar em metadados editáveis.
- Admin exige autenticação real por senha no JWT; links antigos não liberam o painel.
- Cliente somente consulta seus pedidos, itens, endereços, envios e eventos, pelo
  vínculo `auth.uid()`. Não pode criar/alterar pedido, proprietário ou status.
- Custos, observações internas e valores pagos de logística não são concedidos ao
  navegador. Público anônimo não acessa os dados da área da cliente.
- Sem confirmação de e-mail, cadastro novo não recebe compras antigas por igualdade
  de e-mail. O vínculo é por UUID; Google poderá usar o mesmo vínculo no futuro.
- Eventos de envio e histórico de auditoria bloqueiam mutações proibidas.

## Aplicação e variáveis

Painel: `/painel` ou host do painel de homologação. Cliente: `/#/cliente` ou
`/cliente`. Formulários com senha mínima, mostrar/ocultar, erro no topo e estado de
envio. Sessões da equipe e da cliente usam chaves distintas. Nenhum fluxo atual
chama OTP, magic link, SMS ou recuperação por e-mail. O arquivo histórico de acesso
sem senha foi removido da aplicação; migrations antigas permanecem versionadas.

Somente quatro variáveis públicas: `VITE_APP_ENV`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_REF`. Preview de homologação
preserva as variáveis existentes; produção tem exemplo separado, sem valores.
O build verifica ambiente e correspondência URL/ref e recusa credenciais privadas.

## Testes e limites da evidência

- 31 testes de catálogo/editor/fluxo de autenticação: aprovados, incluindo formulário
  real em React/jsdom, cliente bloqueada no painel, promoção e publicação anteriores.
- 7 testes de configuração de ambiente: aprovados.
- 25 grupos SQL em cada um de dois bancos PGlite limpos: aprovados, schemas iguais.
- 5 grupos SQL de autorização/isolamento/constraints passaram no Supabase hospedado,
  dentro de BEGIN/ROLLBACK. Nenhuma conta, pedido ou produto fictício ficou gravado.
- Build e scanner de credenciais: aprovados; não há service_role/chave privada.
- Login administrativo real por e-mail/senha no painel hospedado: aprovado. Catálogo
  com 30 peças carregou e a consulta de pedidos abriu sem erro (banco sem pedidos).
- Teste direto detectou 404 em `/cliente`; rewrites específicos de `/cliente` e
  `/painel` foram adicionados à Vercel. `/cliente`, `/painel`, `/cliente/pedidos` e
  `/painel/pecas` retornaram HTTP 200 no domínio hospedado após a correção. A
  tela de cliente e a recuperação pelo WhatsApp também foram verificadas no browser.
- CI inclui Auth real em Supabase local: cadastro imediato, A/B, admin e 10 logins
  consecutivos. Resultado aprovado no commit `8ed2bd52051d6655d054feeaf71c6922a8cff70f`,
  workflow `37708439498`. Inclui duas aplicações limpas de Postgres/Supabase local,
  comparação de schemas e advisor de segurança. Deploy Preview
  `dpl_4DuYV9opnSTHJKL5acSvbHJWgfCQ` READY; sem promoção para produção.
- SQL com JWT de teste valida RLS, mas não prova envio SMTP nem limites do serviço
  hospedado. Cadastro e logins reais hospedados dependem da configuração do painel
  e de uma conta com senha disponível para teste seguro. Não declarar esses critérios
  concluídos sem executar o fluxo real.
- Produção permanece pendente de identificação e validação; não há evidência de
  homologação final, release, merge em main ou congelamento.

## Arquivos da entrega

Front: `auth/acesso.ts`, `auth/FormularioSenha.tsx`, `auth/acesso.css`,
`cliente/AreaCliente.tsx`, `cliente/Pedidos.tsx`, `cliente/pedidos.ts`,
`cliente/cliente.css`, `painel/Acesso.tsx`, `painel/Painel.tsx`,
`painel/catalogoInterno.ts`, `Loja.tsx`, `main.tsx`, `ambiente.ts`.
Removido: `painel/acessoSemSenha.ts`.

Infra/testes: as duas migrations acima, `supabase/config.toml`, `vite.config.ts`,
`vercel.json`, `.env.production.example`, `.github/workflows/fase-0.yml`,
`package.json`, `scripts/test-database.mjs`, `scripts/test-auth-api.mjs`,
`tests/auth-harness.tsx`, `tests/auth.test.mjs`, `tests/database/acesso-senha.sql`,
`tests/database/platform-fixture.sql`, `tests/curadoria.test.mjs`,
`tests/environment.test.mjs`, `tests/vitrine.test.mjs`, `README.md` e este registro.

Referências de configuração: documentação oficial de
[senhas](https://supabase.com/docs/guides/auth/passwords) e
[rate limits](https://supabase.com/docs/guides/auth/rate-limits).


## Resultado individual dos critérios de aceite

| # | Critério | Evidência executada | Pendência hospedada / produção |
| --- | --- | --- | --- |
| 1 | Admin por senha, sem e-mail no login | Login real no painel de homologação e Auth API local aprovados; aplicação chama somente signInWithPassword | Produção sem projeto identificado; caixa de e-mail não foi acessada |
| 2 | Cliente se cadastra e entra imediatamente | Auth API real local aprovado, Confirm email OFF em config local | Homologação mantém Confirm email ON; signUp fica bloqueado para não disparar e-mail; produção pendente |
| 3 | Cliente não abre painel admin por URL direta | Componente React real testado com cliente; RLS e RPC negam cliente no Supabase hospedado; Auth API real local nega RPC admin | Sessão de cliente real no browser hospedado depende do cadastro/configuração Auth |
| 4 | Cliente A não vê pedidos B | Teste SQL hospedado com rollback e API Auth/PostgREST real local com duas contas aprovados | Não foram criadas contas de cliente permanentes no hospedado |
| 5 | Admin vê todos pedidos | SQL hospedado e API local com os dois pedidos aprovados; tela hospedada sem erro | Banco hospedado sem pedidos reais cadastrados |
| 6 | Dez logins consecutivos sem bloqueio | Auth API real local, dez signInWithPassword, aprovado | Valores efetivos de Rate Limits hospedados não estão disponíveis no plugin |
| 7 | Nenhum fluxo chama OTP/magic link/SMS | Scanner do código atual e testes de formulário + rotas Auth real aprovados | Produção não publicada ainda |

O último GET do endpoint público de configurações, após o deploy, confirmou:
Email habilitado, cadastro permitido e **Confirm email ainda ligado**. Senhas,
tokens e service_role não foram lidos nem armazenados nos relatórios.

## Commits de implementação (mesma branch, sem merge em main)

- `ef4aa64221103c00d51f5914301a0c72a9f9cc58`: autenticação, perfis, consulta protegida e testes.
- `2c554ff5b4d3fc1cac26bc7bdc2ac542082ae945`: corrigiu arquivo incompleto identificado no envio ao GitHub; blob conferido contra o arquivo local antes do novo deploy.
- `5d4453671a5fbf74c2b3494116b3bd597842e0ac`: corrigiu SKU fictício do teste de Auth real; constraint original do banco preservada.
- `8ed2bd52051d6655d054feeaf71c6922a8cff70f`: rotas diretas de painel/cliente, verificadas por HTTP e browser.

Essas correções foram feitas durante a construção e os testes desta entrega,
antes de devolvê-la para homologação. Nenhuma migration adicional foi necessária.
