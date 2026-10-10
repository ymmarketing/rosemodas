# Cotação informativa — Melhor Envio

Implementação na branch `feat/fase-0-fundacao`. A publicação do frontend em produção depende da aprovação da Yasmin após o teste de homologação. A produção permanece em `bf69e8d` enquanto esse teste ocorre.

## Secret

Supabase → projeto `kernpudxhwkpoadahgqj` → Edge Functions → Secrets → Add new secret:

- Name: `MELHOR_ENVIO_TOKEN`.
- Value: token pessoal com apenas `shipping-calculate`.
- Save. Não colar token no chat, repositório, variável VITE ou painel da loja.

URL direta: https://supabase.com/dashboard/project/kernpudxhwkpoadahgqj/functions/secrets

`MELHOR_ENVIO_API_URL` é opcional e fica no mesmo local. Padrão: `https://melhorenvio.com.br/api/v2`. Aceita apenas HTTPS nos domínios de produção/sandbox do Melhor Envio, sem redirecionar a credencial. Não há OAuth, refresh automático, pedido, carrinho, compra ou geração de etiqueta nesta etapa.

## Dados e painel

Origem em `configuracoes.frete_cep_origem`: `30640140`. Postagem em `frete_dias_postagem`: 1 dia útil. Padrão geral em `frete_padrao_sem_categoria`. Categoria usa `categorias.embalagem_padrao`, já existente; só campos vazios são completados na migration. Nenhum estoque, preço, foto ou status de peça é alterado.

| Categoria | Peso | Comprimento × largura × altura |
|---|---|---|
| Vestidos | 500 g | 30 × 25 × 5 cm |
| Conjuntos | 700 g | 30 × 25 × 7 cm |
| Macacões | 700 g | 30 × 25 × 7 cm |
| Blusas | 250 g | 25 × 20 × 4 cm |
| Sem categoria / geral | 500 g | 30 × 25 × 5 cm |

Painel → Configurações de frete: editar origem, postagem e embalagens; salvar; selecionar uma peça publicada e CEP para Testar cotação. O teste usa valores salvos. A data de vencimento vem apenas do `exp` informado no próprio token, decodificado no servidor; não é inventada quando ausente. O status é exclusivo da admin por senha, com papéis verificados em `profiles` e `usuarios_internos`.

## Função e cliente

`cotar-frete` valida chave pública do projeto e, para diagnóstico/status administrativos, JWT e autorização do banco. `verify_jwt=false` permite a vitrine sem login; não concede acesso às RPCs internas. Recebe exclusivamente `cep`, `codigo`, `variacao` (UUID ou null). Busca preço atual (promocional, quando houver), embalagem e origem no banco. Cada campo próprio prevalece sobre o padrão da categoria e o padrão geral. A variação, se informada, precisa pertencer à peça e estar ativa; estoque zero é permitido. Rascunhos, arquivadas e peças de teste não são cotadas.

POST `/api/v2/me/shipment/calculate`, `services: "1,2"`, peso convertido para kg, medidas em cm, seguro igual ao preço atual, quantidade 1. Header `User-Agent: Rose Modas (y.menezessilva@gmail.com)`. Somente Correios PAC/SEDEX válidos, ordenados por preço. Usa `custom_price` e limite superior do prazo customizado quando retornados pela API; acrescenta os dias úteis de postagem do banco.

Cache privado persistente por CEP + peça durante 1 hora. A chave também inclui preço, embalagem, origem, postagem, base e impressão criptográfica do token, evitando reutilizar dados antigos após mudanças. Limite privado persistente de 20 requisições por IP em janela móvel de 60 segundos, inclusive consultas em cache. IP não é armazenado em texto. Registros são reutilizados por UPDATE; DELETE/TRUNCATE bloqueados.

O frontend mantém apenas o último CEP no aparelho. Alterar CEP/variação invalida a cotação e seleção; resposta antiga de requisição concorrente é descartada. Frete é opcional: só a escolha válida e ainda vigente é acrescentada ao WhatsApp de compra/encomenda. Em caso de erro, compra e consulta pelo WhatsApp seguem ativas. Nenhum log de token/cabeçalho/CEP/resposta bruta é emitido.

## Validação

`npm run test:frete`: respostas simuladas de sucesso, CEP inválido, API fora do ar, timeout, token ausente/inválido/expirado, sem resultados; autenticação/CORS, lista, embalagem, seguro, cache; tela real renderizada, CEP persistido, escolha, invalidação e WhatsApp de compra/encomenda.

`tests/database/frete.sql`: autorização admin versus cliente/anon, RPC servidor restrita a service_role, embalagem própria e fallback, peça esgotada aceita, teste oculto, cache expirado e 21ª requisição bloqueada. Execução somente em PGlite/Supabase local do CI, nunca como testes de escrita no banco hospedado.

Typecheck, build e varredura dos arquivos públicos verificam credenciais privadas, JWT service_role, escopo shipping-calculate e ausência de chamada direta ao Melhor Envio no navegador. A captura de rede em homologação complementa essa verificação. Testes reais previstos: BH 30140-071, São Paulo 01310-100 e Manaus 69005-010 com cada categoria, 375 px e desktop. Valores e prints serão entregues no relatório de homologação.
