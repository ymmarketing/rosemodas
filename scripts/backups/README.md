# Backup em construção — Fase 0

Preparação autorizada em 07/10/2026. Não é homologação final nem congelamento.

1. Executar `exportar-catalogo.sql` pelo conector Supabase no projeto de homologação `kernpudxhwkpoadahgqj`.
2. Salvar o objeto `snapshot` retornado como JSON em diretório privado fora do repositório e de `dist/`.
3. Executar `python3 scripts/backups/empacotar.py --snapshot /caminho/banco.json --destino /caminho/Rose_Modas_Backup_DATA --project-ref kernpudxhwkpoadahgqj`.
4. Salvar o ZIP verificado em armazenamento privado persistente. Nunca publicar banco/backup no GitHub, bucket público, front ou logs.

O pacote inclui as nove tabelas da Fase 0, autorização da equipe, histórico/SQL das migrations,
inventário do bucket e os arquivos das fotos. Os hashes SHA-256 e o CRC do ZIP são conferidos.
Contas de Auth aparecem apenas como referências de ID/e-mail/telefone; senhas, sessões,
tokens, chaves de API, SMTP e secrets da infraestrutura não integram este export.
Recuperação de Auth/configurações da infraestrutura é assistida e separada; este pacote
não substitui um backup nativo completo da plataforma. A restauração não é automática.

A rotina diária usa uma automação autorizada, sem workflow de cron na `main` nem acesso
a produção. O empacotador recusa projeto divergente, caminhos de mídia inválidos e tabelas
novas ainda não contempladas. Um erro deve impedir a confirmação de sucesso do backup.

Produção: plano Free escolhido pela Yasmin. A rotina de produção será vinculada ao projeto
exclusivo quando ele existir e seu destino for confirmado. Não trocar automaticamente
o projeto de homologação por outro projeto da conta, nem criar/contratar infraestrutura.
