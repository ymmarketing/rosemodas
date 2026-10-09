# Pedido consolidado — 09/10/2026

Este registro substitui o escopo de lançamento anterior. Corte: 09/10 às 18h Brasília (21h UTC). Lançamento: 10/10. Supabase único `kernpudxhwkpoadahgqj`. Merge main e produção dependem de aprovação expressa. Carga oficial somente mediante “suba o estoque oficial de lançamento”.

## Comportamento implementado

- Lançamento sem links de cadastro/área da cliente, mesmo antes do corte; configuração `cadastro_cliente_liberado=false`. Não alterar Confirm email nem fazer smoke de contas agora.
- Publicação com nome, preço positivo e ao menos uma foto. Rascunho aceita campos incompletos, inclusive promoção antes do preço normal; valores inválidos e promoção maior/igual ao preço normal continuam rejeitados. Categoria, cor, tamanho e embalagem opcionais. Uma variação padrão com estoque 1 é criada se não houver variação ativa; salvar de novo não repõe unidade vendida.
- Painel: Nova peça abre editor direto, código automático editável; publicar salva alterações antes de publicar; mensagens junto dos campos; barra fina no celular; aviso de saída na página; reaproveitar código no editor; fotos/capa/ordem; estoque zero e arquivamento lógico de peça e filhos.
- Preço decimal com vírgula; categorias livres criadas pelo painel; embalagem própria opcional e padrão editável da categoria. `embalagemEfetiva` escolhe cada valor próprio, depois o padrão, depois vazio. Não há cotação de frete ativa.
- Planilha Google oficial mantém as 12 colunas; código identifica a peça. Em publicar=sim, nome/preço/foto obrigatórios; demais campos opcionais, estoque vazio=1. Linhas não publicadas ignoradas; código repetido agrupa variações; combinação repetida e divergência de dados comuns são erro. Incremental/idempotente, validação integral antes de gravação, transação auditada, backup privado/reversão, preservação de peças reais ausentes e atualização por mesmo código.
- Única variação disponível vem selecionada. Linhas cor/tamanho vazias e medidas ausentes ficam ocultas; compra direta pelo WhatsApp 5531975417483. Instagram aprovado no botão Live e no rodapé; navegação institucional corrigida.
- Corte atinge somente testes; criação/edição/publicação/estoque/carga real continuam permitidos depois dele. Sem oficial, “Coleção chegando em breve”; atualização automática por leitura periódica/foco.

## Varredura de textos — 2.7

Removidos da aplicação publicada: frete grátis R$299; PAC R$22,90/SEDEX R$38,40 simulados; Pix/cartão 3x/boleto; CNPJ 00.000.000/0001-00; primeira troca facilitada; demais políticas de exemplo (30 dias, prazos/reembolso e condições ainda não aprovadas); avaliações 4,9/12 e clientes fictícias Márcia/Sônia; altura/numeração e relato fictício da modelo; sacola/checkout/próxima fase; favoritos de demonstração pré-preenchidos; fotos/miniaturas/vídeo inexistentes; página pública do protótipo de referência. Mantidos texto P ao Plus Size, live quinta 20h, contato WhatsApp e Instagram aprovado. Dados do catálogo marcados [TESTE] continuam autorizados somente até o corte, com arquivamento agendado e RLS. Descrição, medidas e modelo veste só aparecem quando cadastrados; podem ser renovados pela admin. Protótipo no repo é referência histórica e não é emitido pelo build.

Trocas mostra somente arrependimento em até 7 dias após recebimento em compras fora do estabelecimento, com orientação/botão WhatsApp. CNPJ só aparece quando configurado com 14 dígitos e diferente do valor zero; campo real continua vazio.

## Banco e backup

Migration `20261009144106_cadastro_simples_lancamento.sql` aplicada ao projeto único após 47 grupos SQL aprovados em duas bases locais. Backup lógico privado `Rose_Modas_Backup_Pre_Cadastro_Simples_20261009.json`, 2.188.834 bytes, salvo antes da migration fora do repo público. Arquivado rascunho RM-1171941657B5: auditado um create às 10h29 Brasília, sem fotos/variações/edições; arquivamento condicionado a continuar vazio, às 11h41 Brasília. Ledger/auditoria preservados.

Advisor: sem aviso novo de estrutura/RLS. Avisos existentes sobre RPCs security definer autenticadas têm checagem interna de admin por senha e testes de isolamento. Proteção de senhas vazadas continua nas configurações Auth da proprietária; não foi alterada.

## Smoke e CI

Smoke real autorizado: apenas SMOKE-01, criada pelo painel, publicação temporária antes do corte e arquivamento de peça/variações/mídias ao final. Nenhuma conta ou pedido de cliente. Evidências serão registradas após execução no navegador real, em viewport de iframe 375×812 e desktop. Página `validacao-mobile.html` existe apenas no build de homologação e oferece a moldura de validação responsiva; não é emitida em produção.

CI de escrita roda somente Supabase local; novos testes de publicação mínima/estoque/arquivamento, navegação institucional, fluxo de saída/publicação e planilha mínima após corte. Relatório de execução hospedada deve confirmar commit/CI/deploy e prints, sem substituir testes pendentes por previsão.

## Pós-lançamento — não implementar agora

Área da cliente/cadastro com smoke próprio após Confirm email OFF e conferência `mailer_autoconfirm=true` (contas cliente-a/b autorizadas); registro de pedidos pelo painel; baixa integrada ao pedido; senha temporária da cliente; integração Melhor Envio por Edge Function/secret somente servidor, PAC/SEDEX por CEP e embalagem; política final de trocas; CNPJ real.

## Aprovação da produção

PR #1 fica preparado com CI verde. Depois da aprovação expressa: confirmar SHA aprovado e quatro variáveis públicas do projeto Vercel rosemodas, merge PR em main, aguardar Production Ready correspondente ao merge, conferir domínio principal/www e ausência de Deployment Protection no domínio oficial; smoke de vitrine/WhatsApp/Instagram/institucionais/painel/console em 375px e desktop, relatório com prints. Nada disso é executado antes da aprovação.

## Execução verificada — 09/10, 11h55 Brasília

Commit de implementação `7ff0e73dc165e51a340ed4e8206a5514af938ae7`; preview `dpl_G2tctC1zWaB7FFi1kzPiYfpdoEpK` Ready e domínio homolog atribuído a ele. CI push `37947283283` e PR `37947288031` verdes: 7 ambiente, 40 catálogo/editor/auth/navegação, 20 carga, 47 grupos PGlite nas duas bases, 27 grupos Supabase nos dois resets, 6 Auth API e 9 carga API/Storage/reversão. A carga mínima sem categoria/cor/tamanho/estoque passou depois do corte simulado, mantendo estoque 1 e preço 189,90. Nenhuma carga oficial real foi executada.

Smoke hospedado **PARCIAL, ainda obrigatório**: login admin confirmado, painel atualizado em iframe real de 375×812, Nova peça abriu editor diretamente com código automático editável, sem formulário intermediário. Antes de preencher dados ou enviar fotos, a captura retornou bloqueio nativo de observação após entrega segura de credenciais. Recuperação indicada pelo próprio navegador e reinicialização permitida não resolveram. Não foram enviados arquivos, nem publicada peça; não há prints desta execução. Não tratar testes CI como substituto do smoke solicitado. O rascunho vazio gerado foi marcado teste e arquivado às 11h54 Brasília, com salvaguardas de continuar vazio e sem publicação. Vitrine segue com 17 peças teste, 0 oficiais, RM-C011 em rascunho e 0 rascunhos ativos oriundos da tentativa.

Itens que continuam exigindo navegador: barra móvel visual, navegação institucional em mobile/desktop, fluxo inteiro SMOKE-01 (2 fotos, capa, preço com vírgula, variação automática, publicar/WhatsApp, estoque 0/1, despublicar/arquivar), vitrine e console, prints. Sem homologação destes itens, manter aprovação de produção pendente.

Produção conferida por API: quatro variáveis públicas Production corretas para kernpudxhwkpoadahgqj e `VITE_APP_ENV=production`; proteção Vercel Authentication somente Preview; domínio principal verificado, www redireciona 308; DNS A 216.198.79.1 sem conflito/misconfigured=false. Não foi feito merge nem deploy de produção.
