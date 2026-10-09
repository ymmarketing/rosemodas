# Publicação autorizada em 09/10/2026

Yasmin autorizou expressamente a carga oficial e a publicação em produção no domínio rosemenezesmodas.com.br. Compra pelo WhatsApp 5531975417483; cadastro_cliente_liberado=false e nenhuma entrada para área da cliente no lançamento.

## Evidência 7.1/7.2 de homologação

Segundo confirmação explícita da Yasmin nesta sessão, Claude executou e concluiu o smoke do commit 93573ee e ela aprovou: painel em 375 px, cadastro com fotos e publicação sem categoria/cor/tamanho, preço com vírgula, variação automática, baixa de estoque e Esgotado, retirada/arquivamento, vitrine sem promessas, WhatsApp, Instagram, páginas institucionais, ausência de rolagem lateral e console sem erros. Esta é evidência fornecida pela Yasmin; não são prints produzidos nesta execução.

## Fonte oficial vigente

Somente a planilha Google `15NtSTLEJGdYdzdXYnfvrfFQ-GNnY0TSdjF8fpq39IEI`, FINAL, tab Untitled, A:N. A:L contém dados; M é referência ignorada na importação; N identifica a subpasta exata na pasta ESTOQUE `1Fxlt2oziI9NtXgR8Nygti-C89mJpiDAQ`. Não ler CONFERIDO, XLSX ou o CSV antigo.

Validação prévia: 55 linhas, 52 peças agrupadas por código, 51 publicadas e RM-0019 em rascunho. Os códigos RM-0014, RM-0048 e RM-0052 têm duas variações cada. 185 fotos JPG/JPEG aceitas, até 50 MB; ordem pelo nome do arquivo, primeira como capa; conversão WebP mantendo proporção, sem rejeição por resolução. Seis imagens abaixo de 800 px no menor lado constam no relatório privado da execução. Nomes e preços preservados; Macacões criada na mesma transação do catálogo, se ausente.

A carga marca todos os itens como oficiais (dado_teste=false), preserva IDs por código e variações reais ausentes, valida todas as peças antes dos updates e arquiva imediatamente todos os testes. O corte de 09/10 21h UTC só afeta dado_teste=true e não bloqueia estoque oficial ou manutenção pelo painel.

Backup lógico completo das tabelas públicas, lotes/conciliações privadas e referências UUID/e-mail de Auth, sem hashes de senha ou sessões, guardado fora do repositório público. A operação por conector SQL usa a conexão administrativa proprietária; não fabrica claims de admin ou sessão por senha. Mantém correlação UUID do lote e auditoria de banco.

## Hero e primeiro acesso

Hero oficial: Drive `1ti-iAQnS9_uIpvkQ6b_FuFNhw_g5t_MJ`. WebP desktop 1600 px e celular 800 px, sem recorte; object-fit contain e proporção preservada, inclusive em 375 px. Configuração pública hero_lancamento contém somente caminhos e texto alternativo.

Yasmin mantém a senha atual. Rose entra pelo painel → Primeiro acesso, e-mail, código privado de seis dígitos e senha própria de 8–128 caracteres. Código válido sete dias ou até o uso, apenas para admin ativa marcada precisa_definir_senha, hash salgado no banco privado, dez tentativas por hora, reserva para impedir uso concorrente e invalidação após sucesso. Em seguida, somente signInWithPassword. Não há envio de e-mail, SMS, MFA ou troca periódica. Esta autorização específica de código inicial de admin não libera OTP de login ou cadastro de cliente.

A Edge Function não exige JWT de entrada porque possui autenticação própria; as RPCs que verificam código/ticket só podem ser chamadas por service_role. Código, senha e ticket nunca são registrados em logs/repositório ou relatórios persistentes. O operador temporário para provisionamento e fotos tem ticket aleatório de 256 bits, escopo de lote e expiração de uma hora; é desativado depois da carga. Não altera senha da Yasmin.

## Correções e verificações

Confirmação de Arquivar peça na própria página com Arquivar/Cancelar; breadcrumb omite categoria ausente sem separadores duplicados. Primeiro acesso coberto no handler e CI com Auth/Supabase local: provisionamento confirmado sem e-mail, permissão admin, ausência de cliente ativo, senha própria, código errado/curto/expirado/reutilizado e limite de tentativas. A carga real local cobre FINAL, categoria criada, pasta_fotos, rascunho e repetição idempotente, além dos testes incrementais anteriores.

## Reversão

Vercel → projeto rosemodas → Deployments → produção anterior aprovada → menu de ações → Instant Rollback. Verificar domínio e catálogo depois. Não usar rosemodas-homologacao como produção. Na primeira produção ainda não há versão anterior aprovada: despublicar o lote se for necessário ocultar o estoque e manter o estado Coleção chegando em breve.

Rollback da Vercel reverte código/alias, não banco nem arquivos. Para despublicar somente o lote atual, usar despublicar_carga_oficial autenticada como admin por senha; os IDs e históricos são preservados. Restaurar conteúdo e estoque por carga corretiva validada usando backup; não DELETE/TRUNCATE. Não repor unidade vendida por repetição de carga sem alteração. Fazer restauração em Supabase local/CI antes de qualquer operação real.

Registro de pedidos, baixa integrada ao pedido e redefinição de senha temporária ficam para depois do lançamento; baixa manual no painel é o fluxo vigente.
