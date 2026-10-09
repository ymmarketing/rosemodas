-- Ajustes da homologação inicial: catálogo demonstrativo fiel ao mockup.
-- Somente projeto kernpudxhwkpoadahgqj; nunca produção. Reaplicação não duplica estoque.
begin;
do $seed$
declare
 itens jsonb := $dados$[{"id":"0a000000-0000-4000-8000-030000000001","nome":"Vestido Aurora","cat":"Vestidos","forma":"vestido","preco":189.9,"selo":"Aprovado pela Rose","cores":[{"n":"Rosê","hex":"#D9A3A9"},{"n":"Preto","hex":"#3A3133"}],"est":{"44":3,"46":4,"48":1,"50":5,"52":2,"54":0},"desc":"Vestido midi em viscose com elastano, decote V suave e faixa para amarrar. Não marca, não esquenta e cai solto na medida certa.","veste":"48","novo":false,"codigo":"HOM-RM01","categoria_id":"0a000000-0000-4000-8000-010000000001"},{"id":"0a000000-0000-4000-8000-030000000002","nome":"Blusa Lis","cat":"Blusas","forma":"blusa","preco":89.9,"selo":"","cores":[{"n":"Off-white","hex":"#EFE6DA"},{"n":"Azul serenity","hex":"#9DB2CF"}],"est":{"44":5,"46":6,"48":4,"50":4,"52":3,"54":2},"desc":"Blusa de crepe com mangas amplas e caimento fluido.","veste":"50","codigo":"HOM-RM02","categoria_id":"0a000000-0000-4000-8000-010000000002"},{"id":"0a000000-0000-4000-8000-030000000003","nome":"Conjunto Serena","cat":"Conjuntos","forma":"conjunto","preco":229.9,"promo":199.9,"selo":"Novidade","cores":[{"n":"Nude","hex":"#D8BBA3"}],"est":{"44":2,"46":2,"48":3,"50":2,"52":1,"54":1},"desc":"Blusa e calça pantalona em linho misto, cintura com elástico.","veste":"48","codigo":"HOM-RM03","categoria_id":"0a000000-0000-4000-8000-010000000003"},{"id":"0a000000-0000-4000-8000-030000000004","nome":"Calça Pantalona Alba","cat":"Calças e saias","forma":"calca","preco":129.9,"selo":"","cores":[{"n":"Caramelo","hex":"#B88A64"},{"n":"Preto","hex":"#3A3133"}],"est":{"44":4,"46":5,"48":5,"50":3,"52":2,"54":2},"desc":"Pantalona de alfaiataria leve com cós alto e elástico nas costas.","veste":"48","codigo":"HOM-RM04","categoria_id":"0a000000-0000-4000-8000-010000000004"},{"id":"0a000000-0000-4000-8000-030000000005","nome":"Vestido Jasmim Longo","cat":"Vestidos","forma":"longo","preco":239.9,"selo":"","cores":[{"n":"Verde sálvia","hex":"#A7B59C"}],"est":{"44":0,"46":0,"48":0,"50":0,"52":0,"54":0},"desc":"Vestido longo com estampa delicada e alças reguláveis.","veste":"50","codigo":"HOM-RM05","categoria_id":"0a000000-0000-4000-8000-010000000001"},{"id":"0a000000-0000-4000-8000-030000000006","nome":"Kimono Flora","cat":"Kimonos","forma":"kimono","preco":119.9,"selo":"Novidade","cores":[{"n":"Floral rosê","hex":"#E3B3B7"}],"est":{"44":3,"46":3,"48":3,"50":3,"52":2,"54":2},"desc":"Kimono leve para usar sobre blusas e vestidos.","veste":"48","codigo":"HOM-RM06","categoria_id":"0a000000-0000-4000-8000-010000000005"},{"id":"0a000000-0000-4000-8000-030000000007","nome":"Blusa Camélia","cat":"Blusas","forma":"blusa","preco":79.9,"selo":"Últimas peças","cores":[{"n":"Vinho","hex":"#9C4A5C"}],"est":{"44":0,"46":1,"48":0,"50":1,"52":0,"54":0},"desc":"Blusa de malha canelada com gola canoa.","veste":"48","codigo":"HOM-RM07","categoria_id":"0a000000-0000-4000-8000-010000000002"},{"id":"0a000000-0000-4000-8000-030000000008","nome":"Vestido Íris Envelope","cat":"Vestidos","forma":"vestido","preco":199.9,"selo":"Aprovado pela Rose","cores":[{"n":"Azul marinho","hex":"#3F4C6B"},{"n":"Rosê","hex":"#D9A3A9"}],"est":{"44":2,"46":3,"48":2,"50":2,"52":1,"54":1},"desc":"Modelagem envelope que valoriza a cintura sem apertar.","veste":"48","codigo":"HOM-RM08","categoria_id":"0a000000-0000-4000-8000-010000000001"},{"id":"0a000000-0000-4000-8000-030000000009","nome":"Saia Midi Luna","cat":"Calças e saias","forma":"saia","preco":109.9,"selo":"","cores":[{"n":"Champagne","hex":"#D8C3A5"}],"est":{"44":2,"46":2,"48":2,"50":3,"52":2,"54":1},"desc":"Saia midi plissada com cós elástico.","veste":"50","codigo":"HOM-RM09","categoria_id":"0a000000-0000-4000-8000-010000000004"},{"id":"0a000000-0000-4000-8000-030000000010","nome":"Conjunto Bruma","cat":"Conjuntos","forma":"conjunto","preco":249.9,"selo":"","cores":[{"n":"Cinza névoa","hex":"#B9B4B1"}],"est":{"44":1,"46":2,"48":2,"50":2,"52":1,"54":0},"desc":"Conjunto de tricô fino, blusa e calça reta.","veste":"48","codigo":"HOM-RM10","categoria_id":"0a000000-0000-4000-8000-010000000003"},{"id":"0a000000-0000-4000-8000-030000000011","nome":"Blusa Orquídea","cat":"Blusas","forma":"blusa","preco":94.9,"selo":"","cores":[{"n":"Lilás","hex":"#C3AFCF"}],"est":{"44":3,"46":3,"48":2,"50":2,"52":2,"54":1},"desc":"Blusa de viscose estampada com amarração frontal.","veste":"48","codigo":"HOM-RM11","categoria_id":"0a000000-0000-4000-8000-010000000002"},{"id":"0a000000-0000-4000-8000-030000000012","nome":"Vestido Magnólia","cat":"Vestidos","forma":"longo","preco":219.9,"selo":"","cores":[{"n":"Off-white","hex":"#EFE6DA"}],"est":{"44":0,"46":0,"48":0,"50":0,"52":0,"54":0},"desc":"Vestido longo de linho com botões frontais.","veste":"50","codigo":"HOM-RM12","categoria_id":"0a000000-0000-4000-8000-010000000001"}]$dados$::jsonb;
 p jsonb; c jsonb; tam text; m text; produto_uuid uuid; variacao_id uuid; antiga_id uuid;
 indice integer; cor_indice integer; saldo integer; nova uuid;
begin
 if not exists(select 1 from public.configuracoes where chave='ambiente_homologacao'
  and valor->>'project_ref'='kernpudxhwkpoadahgqj' and valor->>'uso'='homologacao') then
  raise exception 'Recusado: projeto não é a homologação autorizada.';
 end if;
 for p in select value from jsonb_array_elements(itens) loop
  produto_uuid := (p->>'id')::uuid;
  if exists(select 1 from public.produtos where id=produto_uuid and codigo<>p->>'codigo') then
   raise exception 'Identificador ocupado por produto que não é o exemplo autorizado.';
  end if;
  insert into public.produtos(id,codigo,nome,slug,descricao,categoria_id,colecao_id,preco,preco_promocional,selo,modelo_veste)
  values(produto_uuid,p->>'codigo',p->>'codigo',lower(p->>'codigo'),p->>'desc',(p->>'categoria_id')::uuid,
   '0a000000-0000-4000-8000-020000000001',(p->>'preco')::numeric,(p->>'promo')::numeric,
   case p->>'selo' when 'Novidade' then 'novidade' when 'Aprovado pela Rose' then 'aprovado_rose' when 'Últimas peças' then 'ultimas_pecas' else null end,p->>'veste')
  on conflict(id) do nothing;
  update public.produtos set nome=p->>'nome',descricao=p->>'desc',modelo_veste=p->>'veste'
   where id=produto_uuid and codigo=p->>'codigo' and (nome,descricao,modelo_veste) is distinct from (p->>'nome',p->>'desc',p->>'veste');
  cor_indice:=0;
  for c in select value from jsonb_array_elements(p->'cores') loop
   foreach tam in array array['44','46','48','50','52','54'] loop
    antiga_id:=md5(produto_uuid::text||':'||tam||':DEMO')::uuid;
    variacao_id:=case when cor_indice=0 then antiga_id else md5(produto_uuid::text||':'||tam||':'||(c->>'n'))::uuid end;
    update public.variacoes set cor=c->>'n',sku=(p->>'codigo')||'-C'||cor_indice||'-'||tam
     where id=variacao_id and public.variacoes.produto_id=produto_uuid and cor='Demonstrativa';
    nova:=null;
    insert into public.variacoes(id,produto_id,sku,tamanho,cor)
     values(variacao_id,produto_uuid,(p->>'codigo')||'-C'||cor_indice||'-'||tam,tam,c->>'n')
     on conflict(id) do nothing returning id into nova;
    saldo:=greatest(0,(p->'est'->>tam)::integer-cor_indice);
    if nova is not null and saldo>0 then
     perform public.ajustar_estoque(nova,saldo,'Catálogo fictício fiel ao mockup — ajuste de homologação');
    end if;
   end loop;
   cor_indice:=cor_indice+1;
  end loop;
  indice:=0;
  foreach tam in array array['44','46','48','50','52','54'] loop
   for m in select unnest(array['busto','quadril','comprimento']) loop
    insert into public.medidas_tamanho(id,produto_id,tamanho,medida,rotulo,valor_cm,ordem)
     values(md5(produto_uuid::text||':'||tam||':'||m)::uuid,produto_uuid,tam,m,
      case m when 'busto' then 'Busto' when 'quadril' then 'Quadril' else 'Comprimento' end,
      case m when 'busto' then 104+indice*6 when 'quadril' then 112+indice*6 else 108+indice end,
      case m when 'busto' then 0 when 'quadril' then 1 else 2 end)
     on conflict(id) do nothing;
   end loop;
   indice:=indice+1;
  end loop;
 end loop;
end;
$seed$;
commit;
