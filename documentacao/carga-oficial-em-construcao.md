# Preparação do lançamento — em construção

Decisão da Yasmin: um único Supabase, `kernpudxhwkpoadahgqj`, passa a ser produção. Não criar outro projeto nem contratar serviços. O código de produção sai da `main` somente após aprovação final. Este registro não representa homologação, release ou congelamento.

## Entrada oficial

Pasta: https://drive.google.com/drive/folders/1c1UiT3CSyZ_S20c2BJ-5Icn3CTnUGUbR

Fonte única: [estoque-oficial (preencher aqui)](https://docs.google.com/spreadsheets/d/1a1dVvVNQvQNHQ_lOh0XyZZfmvvfipa_ZzHsFm2JohGg/edit), aba `Untitled`, 12 colunas. O arquivo `estoque-oficial.csv` (id `19Ed_opkTf7j48NAVmhArMaCHsHdTqFJC`) é só referência e nunca é lido pela CLI de aplicação.

Uma linha por variação. Repita o código e os dados da peça em cada linha; cor, tamanho e estoque podem mudar. A primeira linha do código define nome, categoria, descrição, preço, promoção, publicar e ordem; divergência é erro identificado por linha/campo. A combinação código + cor + tamanho não pode se repetir.

Linhas com `publicar=não` ou vazio são ignoradas inteiramente, sem exigir preenchimento nem fotos e sem modificar o cadastro existente. Não criam nem despublicam rascunhos. Somente `sim` exige código, nome, categoria ativa, preço, cor, tamanho, estoque e foto `01` como capa. Descrição e promoção são opcionais. A carga é incremental: atualiza por código/combinação, preserva peças e variações reais ausentes. Mesmo conteúdo e mesmas fotos não recompõem estoque já baixado manualmente. Para atualizar deliberadamente a quantidade, altere o estoque na planilha ou use o painel.

Subpastas `RM-C001` até `RM-C018` já criadas. Novos códigos recebem sua própria subpasta. Fotos `01.jpg`, `02.jpg` etc.; `01` é a capa. JPG, PNG e WebP aceitos. A carga usa WebP, que a vitrine já suporta. Limite de entrada: 50 MB e 30 milhões de pixels por imagem. Saída até 1600 × 1600, mantendo a proporção e sem ampliação, qualidade 82, sem dados EXIF.


## Comando da Yasmin

Somente executar a carga oficial quando a Yasmin disser **“suba o estoque oficial de lançamento”**. Ler novamente Drive e planilha nesse momento. Nenhum dado oficial será inventado.

1. Ler novamente **a planilha Google oficial pelo conector/API** e baixar as fotos das subpastas do Drive para diretório privado local, preservando o original. Ignorar o CSV antigo. Conferir paginação/listagem completa. A CLI aceita leitura direta da API Sheets com token OAuth privado (`--google-credenciais`) ou exportação fresca do conector (`--planilha-google`), com `spreadsheet_id`, `obtido_em` UTC e `values` das 12 colunas. A exportação tem validade operacional de 30 minutos; não publicar a planilha para conseguir acesso.
   Exemplo do arquivo privado do conector: `{"spreadsheet_id":"1a1dVvVNQvQNHQ_lOh0XyZZfmvvfipa_ZzHsFm2JohGg","obtido_em":"DATA-HORA-UTC-DA-LEITURA","values":[["codigo","nome","categoria","descricao_curta","preco","preco_promocional","cor","tamanho","estoque","publicar","ordem_vitrine","observacoes"],...]}`. O arquivo de OAuth contém somente `accessToken` com leitura de Sheets autorizada. Sessões/chaves nunca entram no repo.
2. Validar toda a entrada. Qualquer erro retorna lista por linha/arquivo em português e impede gravações em banco e Storage.
3. Gerar export lógico e salvar bytes das fotos anteriores **somente das peças efetivamente carregadas** fora do repositório, com hashes SHA-256.
4. Preparar fotos novas em bucket privado e copiar para caminhos novos públicos. Conferir hashes. Esses arquivos ainda não estão vinculados ao catálogo.
5. A RPC `aplicar_carga_oficial` valida novamente e executa uma única transação: produtos, variações, estoque pelo ledger, mídias, arquivamento e auditoria. Mudança concorrente no catálogo invalida a assinatura e interrompe a operação. O mesmo lote e novas execuções com conteúdo idêntico são idempotentes. Não arquivar peças reais ausentes. Ao publicar estoque oficial, arquivar os fictícios; não retirar arquivos antigos de peças que não foram carregadas.
6. Somente após commit confirmado, copiar fotos antigas para `catalogo-privado/backup/<lote>/...`, verificar bytes e remover os objetos antigos do bucket público pela API de Storage. Não remover arquivos por SQL. Se essa etapa falhar, registrar pendências e não declarar a carga concluída. Concluir a retirada antes de anunciar a entrega oficial; URLs antigas também precisam ser verificadas após a invalidação de cache.
7. Smoke: número de publicadas igual a `publicar=sim`, rascunhos excluídos da vitrine, capas carregando, preços e WhatsApp corretos, nenhum dado fictício visível, 375 px e desktop, console sem erros. Entregar relatório e prints.

Banco e Storage são serviços distintos: a atomicidade é garantida para a transação do banco. Uploads novos têm compensação se a transação falhar; retirada de fotos antigas ocorre depois do commit e tem verificação separada. Uma resposta de rede ambígua é conferida por repetição idempotente. Nunca remover fotos antigas para “desfazer” um erro anterior ao commit.

## Script versionado

```bash
node scripts/lancamento/carga-oficial.mjs validar \
  --pasta /diretorio/Estoque-oficial \
  --planilha-google /diretorio-privado/planilha-lida-agora.json \
  --categorias /diretorio/categorias-ativas.json

node scripts/lancamento/carga-oficial.mjs aplicar \
  --pasta /diretorio/Estoque-oficial \
  --planilha-google /diretorio-privado/planilha-lida-agora.json \
  --credenciais /diretorio-privado/admin.json \
  --backup-dir /diretorio-privado/backups \
  --lote UUID-DO-LOTE

node scripts/lancamento/carga-oficial.mjs despublicar \
  --credenciais /diretorio-privado/admin.json \
  --lote UUID-DO-LOTE
```

`admin.json`: URL do projeto aprovado, chave publishable e sessão de admin autenticada por senha (`accessToken`). Arquivo privado fora do repo; não colocar em Vercel/VITE, GitHub ou relatório. Não inclui senha nem exige `service_role`. A sessão precisa estar válida na execução. Reversão despublica toda a carga sem apagar fotos, registros, ledger ou auditoria; não republica o lote automaticamente.

Se a retirada de fotos falhar após commit, retomar sem reaplicar estoque:

```bash
node scripts/lancamento/carga-oficial.mjs finalizar \
  --credenciais /diretorio-privado/admin.json \
  --backup-dir /diretorio-privado/backups \
  --lote UUID-DO-LOTE
```

O script verifica o lote já aplicado, o manifesto e hashes do backup. Não inicia outra carga nem rebaixa estoque na recuperação.

## Dados fictícios autorizados

Migration `20261008030827`: preparo condicionado à existência dos 18 códigos originais com suas capas. Banco limpo não recebe as fotos reais. Todos os produtos preparados recebem `dado_teste=true`, nome `[TESTE] <nome sugerido>`, descrição explícita de teste, preço de R$ 101 a R$ 118 na ordem RM-C001..018, promoção vazia, cor `Demonstração`, tamanho `48`, estoque de 1 unidade, ordem de vitrine 1..18. Categoria também é de demonstração. Variações anteriores ficam arquivadas e seus saldos são ajustados pelo ledger. Fotos atuais são preservadas.

Limpeza confirmada: os 12 HOM-RM são arquivados, com variações e medidas; a coleção compartilhada é preservada e renomeada `Coleção de lançamento`; RM-C011 foi despublicada em 09/10, preservando variações e suas cinco fotos. A coleção agora tem slug `lancamento`; a URL com filtro `hom-lancamento` é normalizada pelo front. SMOKE-01 é arquivada se existir. Nenhuma conta ou pedido de teste hospedado será criado enquanto `mailer_autoconfirm=false`.

Auditoria antes/depois mantém os campos exatos alterados; correlação do preparo `20261008-0000-4000-8000-000000000018`. Export pré-limpeza preserva o estado anterior e os 66 arquivos de mídia. Não confundir essa descrição do que a migration faz com confirmação de que já foi aplicada: registrar o resultado hospedado após CI.

Corte **09/10/2026 18h BRT = 21h UTC**: RLS bloqueia dados fictícios mesmo se o job falhar. Listas padrão do painel e consultas públicas também respeitam o prazo. Front aberto antes do corte atualiza sua lista ao atingir o horário. Migration incremental agenda `pg_cron` para arquivar somente os registros marcados teste no corte, com autoencerramento do job. A RLS garante o corte mesmo se o agendamento falhar. Arquivamento lógico também pode usar `private.arquivar_dados_teste()` no conector administrativo, ou `encerrar_testes_lancamento` na sessão da admin. Fotos antigas permanecem até carga oficial. O horário não bloqueia criação, edição, publicação ou carga de dados reais; isso é testado em banco local. Rascunhos de códigos arquivados podem ser preparados pelo painel, + Nova peça → código → confirmar preparação real, com o mesmo UUID e histórico. A vitrine renova a leitura a cada 30 segundos e quando volta ao foco, sem exigir deploy. Vitrine sem catálogo exibe `Coleção chegando em breve` e WhatsApp 5531975417483.

## Autenticação e cliente

Nova migration `20261008025609` preserva o índice de e-mail canônico. Cadastro com e-mail já existente cria cliente novo por UUID, com e-mail pendente para conciliação privada. Nunca vincula compras automaticamente pelo e-mail. Painel `Vínculos de clientes`: confirmação de titularidade pelo WhatsApp obrigatória; mescla e vínculo auditados numa transação. Conta admin habilitada na equipe tem qualquer cliente associado arquivado.

Cadastro da cliente coleta nome, WhatsApp +55 e aceite de privacidade; trigger salva data/hora e versão `2026-10-08`. Papel não vem de `user_metadata`. A política simples precisa de revisão da Yasmin antes do lançamento. Recuperação permanece no WhatsApp; P1.2 ainda não implementado. P1.3 concede acesso de servidor sem DELETE; eventos de envio continuam append-only.

Última conferência hospedada: `/auth/v1/settings` retorna `mailer_autoconfirm=false`. Cadastro hospedado está bloqueado deliberadamente até Yasmin desligar Confirm email em Authentication → Sign In / Providers → Email. Não usar SMTP, OTP, SMS, Resend ou contornar essa configuração. Entradas da área da cliente ficam ocultas na vitrine enquanto a configuração pública não permitir cadastro imediato.

## Ambiente e publicação

Vercel `rosemodas`: quatro variáveis públicas configuradas para produção e preview; preview identificado como homologation. Ambos apontam exclusivamente para o Supabase único de produção. Vercel Authentication ativada para preview nos dois projetos. Nenhuma publicação de produção ou merge autorizado ainda.

Consulta aos vínculos confirmou: `rosemenezesmodas.com.br` e `www.rosemenezesmodas.com.br` já estão no projeto `rosemodas`, verificados; www redireciona com 308 para o principal. Nenhuma mudança de DNS ou remoção de domínio foi necessária. Não publicar antes da aprovação.

Redirecionamentos dos hosts antigos: manter preparação sem ativação; ativar somente por comando da Yasmin. Painel final: https://rosemenezesmodas.com.br/painel.

## Pontos restantes do lançamento

P0.5: o banco atual impõe `estoque_reservado=0` e não possui `reservas_estoque`. A V2 prevê reserva em pedido aberto e baixa ao confirmar pagamento. Não inventar venda/baixa na abertura do pedido. Registrar essa lacuna antes de afirmar que o fluxo de pedido WhatsApp está concluído. Tela atual de pedidos é consulta, não cadastro operacional.

P0.7: domínio de produção precisa de deploy final aprovado; não afirmar que foi testado antes de estar publicado. Smoke de cadastro hospedado depende de Confirm email desligado. e-mails já autorizados: `y.menezessilva+cliente-a@gmail.com` e `y.menezessilva+cliente-b@gmail.com`. Falta a confirmação de Confirm email OFF e conferência pública de `mailer_autoconfirm=true`. No CI usar `example.test`, nunca dados de clientes reais.

Regra de corte de P1: se cadastro completo não estiver aprovado/testado até o corte, ocultar cadastro e entradas da área da cliente. Para depois do lançamento, conforme decisão de 09/10: cadastro de pedidos no painel, baixa integrada a pedido e senha temporária pelo painel. Para o lançamento: reduzir/zerar Quantidade da variação, informar motivo e salvar; produto zerado permanece Esgotado após os disponíveis. Redefinição de senha por WhatsApp continua assistida pela Yasmin no Supabase até P1.2 estar pronta.

## Volta e backup

Front: Vercel → projeto → Deployments → última versão aprovada → menu de ações → Instant Rollback. Na primeira publicação ainda não há uma versão de produção anterior validada; nesse caso despublicar o catálogo/lote e mostrar o estado de coleção em preparação. Não promover um preview sem aprovação.

No caminho incremental, `despublicar` afeta somente peças cujo lote mais recente ainda é aquele, preservando atualizações posteriores. Para restaurar valores e saldo, usar backup e novo lote de correção após validação local; não apagar históricos.

Banco: export JSON + SQL das migrations + fotos com hashes, fora do repo público. A carga também guarda `banco.json`, `manifesto.json`, `integridade.json` e `resultado.json` em diretório privado. Isso não contém hashes de senha nem configurações completas de Auth e não substitui backup nativo da plataforma. Restauração de dados deve ocorrer primeiro no local/CI, preservar Auth UUIDs, desabilitar apenas os gatilhos necessários sob operação administrativa e restaurar tabelas em ordem de FK. Restaurar fotos pela API; nunca truncar produção como reversão rápida.

Backup nativo diário: conferir no Supabase → Database → Backups o plano e a retenção efetivamente ativos. Não presumir Pro só pelo histórico da conversa nem contratar upgrade. Antes do lançamento repetir export lógico + cópia dos arquivos, registrar caminho privado e integridade.

## Evidências

- `npm run test:carga`: 20 casos de fonte Google/CSV de teste/imagens e ausência de escrita em entrada inválida.
- `npm run test:db`: duas bases PGlite limpas; transação/rollback, isolamento, conciliação, corte e demo.
- CI aprovado: [run 37721888071](https://github.com/ymmarketing/rosemodas/actions/runs/37721888071), SHA `df6320f99527f5841f0daeedcaee72030f07f4bf`: dois resets Supabase reais com schema idêntico `8a8bcb25fc06`, Auth real (6 grupos), 10 logins, cadastro duplicado e carga/Storage/reversão (3 grupos). Nova execução também cobre retomada após falha na retirada das fotos.
- Registrar SHA, CI e deploy após execução, sem chamar a fase de homologada.

## Correções e verificação de 09/10

Commit funcional `0ac7e1f`: CI push [37871187962](https://github.com/ymmarketing/rosemodas/actions/runs/37871187962) e PR [37871190690](https://github.com/ymmarketing/rosemodas/actions/runs/37871190690) verdes. PGlite 43 grupos em cada base; Supabase 23 grupos em cada reset, hashes idênticos; Auth local 6 grupos e carga/Storage local 8 grupos. Migration hospedada registrada pelo conector como `20261009014745_lancamento_incremental_painel`; arquivo alinhado a essa versão, sem alterar o histórico do banco. Cron ativo com scheduler confirmado; arquiva apenas testes após 21h UTC e encerra o job. RM-C011: rascunho, duas variações e cinco fotos preservadas. Coleção: `lancamento`. Zero oficiais publicadas; 17 testes ainda visíveis antes do prazo.

Banners comerciais de demonstração, CNPJ fictício e sacola também ficam ocultos após o corte, inclusive no preview. A configuração pública `cadastro_cliente_liberado=false` mantém cadastro/entradas da cliente ocultos depois do prazo mesmo que Confirm email seja desligado tardiamente. Migration de corte aplicada e registrada como `20261009112622_corte_cadastro_homologacao`; valor hospedado conferido como booleano false. Após smoke aprovado, liberar essa chave no banco; não modifica o Auth. Dados reais do catálogo continuam independentes dessa chave.

Evidência visual desktop obtida no domínio de homologação com bypass. O navegador desta sessão não oferece ajuste de viewport para 375 px; teste real móvel e fluxo completo de escrita com SMOKE-01 continuam pendentes, sem afirmar homologação completa. Cadastro hospedado não foi testado nem contas criadas: `mailer_autoconfirm=false`. Nenhum e-mail enviado. Produção: quatro variáveis públicas verificadas, domínio e www verificados (308), proteção somente preview; nenhum merge/deploy de produção.
