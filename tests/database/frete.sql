begin;
create function pg_temp.assert_frete(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL frete: %',msg;end if;end$$;
insert into auth.users(id,email) values('17000000-0000-4000-8000-000000000001','frete-admin@example.test'),('17000000-0000-4000-8000-000000000002','frete-cliente@example.test');
insert into public.usuarios_internos(user_id,nome,email,papel) values('17000000-0000-4000-8000-000000000001','Admin Frete CI','frete-admin@example.test','admin');
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000001","amr":[{"method":"password"}]}',true);
set local role authenticated;
select public.configurar_frete('salvar','{"cep_origem":"30640140","dias_postagem":1,"sem_categoria":{"peso_g":500,"comprimento_cm":30,"largura_cm":25,"altura_cm":5},"categorias":[]}');
do $$begin
 perform pg_temp.assert_frete(public.configurar_frete('ler')->>'cep_origem'='30640140','origem editável');
 perform pg_temp.assert_frete((public.configurar_frete('ler')->>'valor_adicional')::numeric=0,'adicional inicial zero');
 perform public.configurar_frete('salvar','{"cep_origem":"30640140","dias_postagem":1,"valor_adicional":3.50,"sem_categoria":{"peso_g":500,"comprimento_cm":30,"largura_cm":25,"altura_cm":5},"categorias":[]}');
 perform pg_temp.assert_frete((public.configurar_frete('ler')->>'valor_adicional')::numeric=3.5,'admin salva adicional em reais');
 begin perform public.configurar_frete('salvar','{"cep_origem":"30640140","dias_postagem":1,"valor_adicional":-1,"sem_categoria":{"peso_g":500,"comprimento_cm":30,"largura_cm":25,"altura_cm":5},"categorias":[]}');raise exception 'Aceitou adicional negativo';exception when invalid_parameter_value then null;end;
 begin perform public.configurar_frete('salvar','{"cep_origem":"30640140","dias_postagem":1,"valor_adicional":1.001,"sem_categoria":{"peso_g":500,"comprimento_cm":30,"largura_cm":25,"altura_cm":5},"categorias":[]}');raise exception 'Aceitou fracao de centavo';exception when invalid_parameter_value then null;end;
 perform public.configurar_frete('salvar','{"cep_origem":"30640140","dias_postagem":1,"sem_categoria":{"peso_g":500,"comprimento_cm":30,"largura_cm":25,"altura_cm":5},"categorias":[]}');
 perform pg_temp.assert_frete((public.configurar_frete('ler')->>'valor_adicional')::numeric=3.5,'cliente antigo preserva adicional');
 perform public.configurar_frete('salvar','{"cep_origem":"30640140","dias_postagem":1,"valor_adicional":0,"sem_categoria":{"peso_g":500,"comprimento_cm":30,"largura_cm":25,"altura_cm":5},"categorias":[]}');

 begin perform public.configurar_frete('salvar','{"cep_origem":"123","dias_postagem":1}');raise exception 'Aceitou configuração inválida';exception when invalid_parameter_value then null;end;
 begin perform public.frete_servidor('limite',repeat('a',64));raise exception 'Cliente entrou na RPC servidor';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","amr":[{"method":"password"}],"user_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$begin begin perform public.configurar_frete('ler');raise exception 'Cliente alterou frete';exception when insufficient_privilege then null;end;end$$;
reset role;
set local role anon;
do $$begin
 begin perform public.frete_servidor('limite',repeat('a',64));raise exception 'Anon entrou na RPC servidor';exception when insufficient_privilege then null;end;
 perform pg_temp.assert_frete((select count(*)=0 from public.configuracoes where chave='frete_cep_origem'),'configuração interna não exposta');
end$$;
reset role;
do $$begin raise notice 'PASS: frete 1 admin por banco, validação e RPC privada ao servidor';end$$;
insert into public.produtos(id,codigo,nome,slug,preco,ativo,status_catalogo,peso_g) values('47000000-0000-4000-8000-000000000001','RM-FRETE-CI','Peça CI','peca-frete-ci',199.9,true,'publicado',750);
insert into public.variacoes(id,produto_id,sku,tamanho,cor) values('57000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','FRETE-CI','','');
insert into public.midias(produto_id,tipo,caminho_storage,alt_texto,principal) values('47000000-0000-4000-8000-000000000001','foto','frete-ci.webp','Foto CI',true);
set local role service_role;
do $$declare p jsonb;begin
 p:=public.frete_servidor('dados','RM-FRETE-CI','{"variacao":"57000000-0000-4000-8000-000000000001"}');
 perform pg_temp.assert_frete((p->>'valor_adicional')::numeric=0,'adicional de banco disponibilizado ao servidor');
 perform pg_temp.assert_frete((p->>'peso_g')::numeric=750 and (p->>'altura_cm')::numeric=5 and (p->>'preco')::numeric=199.9,'override, padrão e preço de banco em esgotada');
 perform pg_temp.assert_frete(public.frete_servidor('dados','RM-FRETE-CI','{"variacao":"57000000-0000-4000-8000-000000000099"}') is null,'variação de outra peça rejeitada');
end$$;
reset role;
update public.produtos set dado_teste=true where codigo='RM-FRETE-CI';
set local role service_role;
do $$begin perform pg_temp.assert_frete(public.frete_servidor('dados','RM-FRETE-CI') is null,'dado teste não é cotado');end$$;
reset role;
do $$begin raise notice 'PASS: frete 2 preço e embalagem de banco, esgotada aceita, teste oculto';end$$;
set local role service_role;
do $$declare i int;begin
 for i in 1..20 loop perform pg_temp.assert_frete((public.frete_servidor('limite',repeat('a',64))->>'permitido')::boolean,'requisição dentro de 20');end loop;
 perform pg_temp.assert_frete(not(public.frete_servidor('limite',repeat('a',64))->>'permitido')::boolean,'21a bloqueada');
 perform public.frete_servidor('cache_gravar',repeat('b',64),'{"ok":true,"opcoes":[]}');
 perform pg_temp.assert_frete(public.frete_servidor('cache_ler',repeat('b',64))->>'ok'='true','cache persistente');
end$$;
reset role;
update private.frete_limites set instantes=array[clock_timestamp()-interval '61 seconds'] where chave=repeat('a',64);
update private.frete_cache set expira_em=clock_timestamp()-interval '1 second' where chave=repeat('b',64);
set local role service_role;
do $$begin
 perform pg_temp.assert_frete((public.frete_servidor('limite',repeat('a',64))->>'permitido')::boolean,'janela deslizante renova');
 perform pg_temp.assert_frete(public.frete_servidor('cache_ler',repeat('b',64)) is null,'cache expirado não utilizado');
end$$;
reset role;
do $$begin raise notice 'PASS: frete 3 vinte por minuto em janela deslizante e cache por uma hora';end$$;
rollback;
