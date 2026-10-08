# Backup em construção — lançamento

Decisão da Yasmin em 08/10/2026: `kernpudxhwkpoadahgqj` é o único banco de produção. Não criar outro projeto, alterar plano ou presumir homologação final. Previews usam o mesmo banco; testes automatizados usam apenas Supabase local no CI.

1. Executar `exportar-catalogo.sql` como consulta pelo conector Supabase no projeto indicado. A versão atual requer as migrations de carga oficial e conciliação aplicadas.
2. Salvar o objeto `snapshot` em diretório privado fora do repositório e de `dist/`.
3. Executar `python3 scripts/backups/empacotar.py --snapshot /caminho/banco.json --destino /caminho/Rose_Modas_Backup_DATA --project-ref kernpudxhwkpoadahgqj`.
4. Salvar o ZIP verificado em armazenamento privado persistente. Nunca publicar banco ou backup no GitHub, bucket público, front ou logs.

O pacote inclui as 18 tabelas da aplicação, filas privadas de conciliação e lotes, histórico/SQL das migrations, inventário do bucket público e todos os arquivos nele existentes. Hashes SHA-256 e CRC do ZIP são conferidos. O inventário de tabelas públicas deve coincidir com o export; divergência exige atualizar a rotina antes de afirmar sucesso.

Auth aparece apenas como referências de ID/e-mail/telefone. Senhas, sessões, tokens e secrets não integram este export. Auth, configurações de infraestrutura e o bucket privado não são copiados por este empacotador. As fotos retiradas do público após a carga oficial ficam no backup privado específico daquela carga; preservar ambos os pacotes. Recuperação é assistida, testada primeiro no local/CI; o export não substitui backup nativo completo.

A rotina diária autorizada deve usar esta versão da branch de trabalho, o projeto único aprovado e destino privado persistente. Não aplicar migrations, modificar dados, fazer deploy ou contratar serviços durante o backup. Interromper em qualquer falha de integridade.

Antes da limpeza e do lançamento, gerar uma nova cópia. Backup pré-limpeza de 08/10: 18 tabelas, 7 migrations e 66 fotos, ZIP verificado, guardado fora do repositório. O arquivo anterior à aplicação das novas migrations não contém filas privadas que ainda não existiam.

Backup nativo: conferir plano e retenção efetivamente ativos em Supabase → Database → Backups, sem upgrade automático. Para voltar o front usar Vercel → Deployments → versão aprovada → Instant Rollback; para interromper a carga usar o comando de despublicação do lote no registro de lançamento.
