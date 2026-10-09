-- Construção / Tarefa 3: exemplos fictícios para homologação da Home e coleção.
-- NÃO é migration. NÃO é seed automático. NÃO executar em produção.
-- Executar exclusivamente no projeto kernpudxhwkpoadahgqj, após conferir o marcador
-- privado de homologação em configuracoes. Reaplicação não repõe estoque nem sobrescreve cadastros.
begin;
do $seed$
declare
  dados jsonb := $dados${
  "categorias": [
    {
      "id": "0a000000-0000-4000-8000-010000000001",
      "nome": "Vestidos",
      "slug": "vestidos",
      "ordem": 0
    },
    {
      "id": "0a000000-0000-4000-8000-010000000002",
      "nome": "Blusas",
      "slug": "blusas",
      "ordem": 1
    },
    {
      "id": "0a000000-0000-4000-8000-010000000003",
      "nome": "Conjuntos",
      "slug": "conjuntos",
      "ordem": 2
    },
    {
      "id": "0a000000-0000-4000-8000-010000000004",
      "nome": "Calças e saias",
      "slug": "calcas-e-saias",
      "ordem": 3
    },
    {
      "id": "0a000000-0000-4000-8000-010000000005",
      "nome": "Kimonos",
      "slug": "kimonos",
      "ordem": 4
    }
  ],
  "produtos": [
    {
      "id": "0a000000-0000-4000-8000-030000000001",
      "codigo": "HOM-RM01",
      "nome": "Vestido Aurora",
      "slug": "hom-vestido-aurora",
      "categoria_id": "0a000000-0000-4000-8000-010000000001",
      "preco": 189.9,
      "preco_promocional": null,
      "selo": "aprovado_rose",
      "estoques": [
        3,
        4,
        1,
        5,
        2,
        0
      ]
    },
    {
      "id": "0a000000-0000-4000-8000-030000000002",
      "codigo": "HOM-RM02",
      "nome": "Blusa Lis",
      "slug": "hom-blusa-lis",
      "categoria_id": "0a000000-0000-4000-8000-010000000002",
      "preco": 89.9,
      "preco_promocional": null,
      "selo": null,
      "estoques": [
        5,
        6,
        4,
        4,
        3,
        2
      ]
    },
    {
      "id": "0a000000-0000-4000-8000-030000000003",
      "codigo": "HOM-RM03",
      "nome": "Conjunto Serena",
      "slug": "hom-conjunto-serena",
      "categoria_id": "0a000000-0000-4000-8000-010000000003",
      "preco": 229.9,
      "preco_promocional": 199.9,
      "selo": "novidade",
      "estoques": [
        2,
        2,
        3,
        2,
        1,
        1
      ]
    },
    {
      "id": "0a000000-0000-4000-8000-030000000004",
      "codigo": "HOM-RM04",
      "nome": "Calça Pantalona Alba",
      "slug": "hom-calca-pantalona-alba",
      "categoria_id": "0a000000-0000-4000-8000-010000000004",
      "preco": 129.9,
      "preco_promocional": null,
      "selo": null,
      "estoques": [
        4,
        5,
        5,
        3,
        2,
        2
      ]
    },
    {
      "id": "0a000000-0000-4000-8000-030000000005",
      "codigo": "HOM-RM05",
      "nome": "Vestido Jasmim Longo",
      "slug": "hom-vestido-jasmim-longo",
      "categoria_id": "0a000000-0000-4000-8000-010000000001",
      "preco": 239.9,
      "preco_promocional": null,
      "selo": null,
      "estoques": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "id": "0a000000-0000-4000-8000-030000000006",
      "codigo": "HOM-RM06",
      "nome": "Kimono Flora",
      "slug": "hom-kimono-flora",
      "categoria_id": "0a000000-0000-4000-8000-010000000005",
      "preco": 119.9,
      "preco_promocional": null,
      "selo": "novidade",
      "estoques": [
        3,
        3,
        3,
        3,
        2,
        2
      ]
    },
    {
      "id": "0a000000-0000-4000-8000-030000000007",
      "codigo": "HOM-RM07",
      "nome": "Blusa Camélia",
      "slug": "hom-blusa-camelia",
      "categoria_id": "0a000000-0000-4000-8000-010000000002",
      "preco": 79.9,
      "preco_promocional": null,
      "selo": "ultimas_pecas",
      "estoques": [
        0,
        1,
        0,
        1,
        0,
        0
      ]
    },
    {
      "id": "0a000000-0000-4000-8000-030000000008",
      "codigo": "HOM-RM08",
      "nome": "Vestido Íris Envelope",
      "slug": "hom-vestido-iris-envelope",
      "categoria_id": "0a000000-0000-4000-8000-010000000001",
      "preco": 199.9,
      "preco_promocional": null,
      "selo": "aprovado_rose",
      "estoques": [
        2,
        3,
        2,
        2,
        1,
        1
      ]
    }
  ]
}$dados$::jsonb;
  item jsonb;
  produto jsonb;
  variacao uuid;
  tam text;
  indice integer;
  quantidade integer;
  inserida uuid;
  colecao uuid := '0a000000-0000-4000-8000-020000000001';
begin
  if not exists(select 1 from public.configuracoes where chave='ambiente_homologacao'
    and valor->>'project_ref'='kernpudxhwkpoadahgqj' and valor->>'uso'='homologacao') then
    raise exception 'Seed recusado: marcador exclusivo de homologação ausente.';
  end if;
  for item in select value from jsonb_array_elements(dados->'categorias') loop
    insert into public.categorias(id,nome,slug,ordem)
      values((item->>'id')::uuid,item->>'nome',item->>'slug',(item->>'ordem')::integer)
      on conflict(id) do nothing;
  end loop;
  insert into public.colecoes(id,nome,slug,atual)
    values(colecao,'Coleção de lançamento · demonstração','hom-lancamento',true)
    on conflict(id) do nothing;
  for produto in select value from jsonb_array_elements(dados->'produtos') loop
    insert into public.produtos(id,codigo,nome,slug,descricao,categoria_id,colecao_id,preco,preco_promocional,selo)
      values((produto->>'id')::uuid,produto->>'codigo',produto->>'nome',produto->>'slug',
        'Peça fictícia, criada exclusivamente para testar o catálogo de homologação. Não está à venda.',
        (produto->>'categoria_id')::uuid,colecao,(produto->>'preco')::numeric,
        (produto->>'preco_promocional')::numeric,produto->>'selo')
      on conflict(id) do nothing;
    indice := 0;
    foreach tam in array array['44','46','48','50','52','54'] loop
      variacao := md5((produto->>'id')||':'||tam||':DEMO')::uuid;
      inserida := null;
      insert into public.variacoes(id,produto_id,sku,tamanho,cor)
        values(variacao,(produto->>'id')::uuid,(produto->>'codigo')||'-DEMO-'||tam,tam,'Demonstrativa')
        on conflict(id) do nothing returning id into inserida;
      quantidade := (produto->'estoques'->>indice)::integer;
      if inserida is not null and quantidade > 0 then
        perform public.ajustar_estoque(inserida,quantidade,'Inventário fictício de homologação — Tarefa 3');
      end if;
      indice := indice + 1;
    end loop;
  end loop;
end;
$seed$;
commit;
