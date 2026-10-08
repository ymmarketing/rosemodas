"""Empacota um export autorizado e todos os arquivos do bucket, sem credenciais."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import urllib.parse
import urllib.request
import zipfile

TABELAS = {'categorias', 'colecoes', 'produtos', 'variacoes', 'medidas_tamanho',
           'midias', 'movimentos_estoque', 'configuracoes', 'audit_log', 'usuarios_internos', 'profiles', 'clientes', 'enderecos', 'pedidos',
           'itens_pedido', 'enderecos_pedido', 'envios', 'eventos_envio'}

def validar_snapshot(dados, project_ref):
    if not re.fullmatch(r'[a-z0-9]{20}', project_ref):
        raise ValueError('Referência de projeto inválida.')
    if dados.get('formato') != 'rose-catalogo-v2' or set(dados.get('tabelas', {})) != TABELAS:
        raise ValueError('Export fora da configuração da Fase 0.')
    if set(dados.get('tabelas_publicas', [])) != TABELAS:
        raise ValueError('Há tabelas novas: atualizar o export antes de considerá-lo completo.')
    ambiente = dados.get('ambiente') or {}
    if ambiente.get('uso') != 'producao' or ambiente.get('project_ref') != project_ref:
        raise ValueError('O export não pertence ao projeto único de produção aprovado.')
    if dados.get('storage', {}).get('bucket', {}).get('id') != 'produtos-publico':
        raise ValueError('Bucket diferente do autorizado.')
    nomes = [o['name'] for o in dados['storage']['objetos']]
    for nome in nomes:
        partes = PurePosixPath(nome).parts
        if not partes or nome.startswith('/') or '\\' in nome or any(p in ('..', '.') for p in nome.split('/')):
            raise ValueError('Caminho de mídia inválido.')
    if len(nomes) != len(set(nomes)):
        raise ValueError('Inventário de mídia duplicado.')
    if not dados.get('schema_migrations'):
        raise ValueError('Histórico de migrations ausente.')

def baixar(objeto, destino, origem):
    nome = objeto['name']
    url = origem + '/storage/v1/object/public/produtos-publico/' + urllib.parse.quote(nome, safe='/')
    with urllib.request.urlopen(url, timeout=45) as resposta:
        if not resposta.geturl().startswith(origem + '/'):
            raise ValueError('A mídia redirecionou para outra origem.')
        conteudo = resposta.read()
    if not conteudo or (objeto.get('size') is not None and len(conteudo) != int(objeto['size'])):
        raise ValueError('Arquivo vazio ou incompleto: ' + nome)
    caminho = destino / 'fotos' / nome
    caminho.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    caminho.write_bytes(conteudo)
    caminho.chmod(0o600)
    return {'caminho': 'fotos/' + nome, 'bytes': len(conteudo), 'sha256': hashlib.sha256(conteudo).hexdigest()}

def empacotar(arquivo, destino, project_ref):
    dados = json.loads(arquivo.read_text())
    validar_snapshot(dados, project_ref)
    destino.mkdir(parents=True, exist_ok=False, mode=0o700)
    banco = destino / 'banco.json'
    banco.write_text(json.dumps(dados, ensure_ascii=False, indent=2))
    banco.chmod(0o600)
    schema = destino / 'schema'
    schema.mkdir(mode=0o700)
    for m in dados['schema_migrations']:
        if not re.fullmatch(r'\d{14}', m['version']) or not re.fullmatch(r'[a-z0-9_]+', m['name']):
            raise ValueError('Identificação de migration inválida.')
        sql = schema / (m['version'] + '_' + m['name'] + '.sql')
        sql.write_text('\n'.join(m['statements']))
        sql.chmod(0o600)
    origem = 'https://' + project_ref + '.supabase.co'
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futuros = [pool.submit(baixar, o, destino, origem) for o in dados['storage']['objetos']]
        arquivos = sorted((f.result() for f in futuros), key=lambda x: x['caminho'])
    for caminho in [banco, *sorted(schema.glob('*.sql'))]:
        conteudo = caminho.read_bytes()
        arquivos.append({'caminho': caminho.relative_to(destino).as_posix(), 'bytes': len(conteudo), 'sha256': hashlib.sha256(conteudo).hexdigest()})
    manifesto = {'formato': dados['formato'], 'ambiente': 'producao', 'project_ref': project_ref,
                 'exportado_em': dados['exportado_em'], 'tabelas': {k: len(v) for k, v in dados['tabelas'].items()},
                 'migrations': len(dados['schema_migrations']), 'fotos': len(dados['storage']['objetos']), 'arquivos': arquivos,
                 'privado': {k: len(v) for k, v in dados.get('privado', {}).items()},
                 'limites': 'Export lógico da aplicação. Credenciais/sessões de Auth e secrets da infraestrutura não são copiados. Referências de contas são incluídas para recuperação assistida.'}
    (destino / 'manifesto.json').write_text(json.dumps(manifesto, ensure_ascii=False, indent=2))
    zip_path = destino.with_suffix('.zip')
    with zipfile.ZipFile(zip_path, 'x', compression=zipfile.ZIP_DEFLATED) as z:
        for caminho in sorted(destino.rglob('*')):
            if caminho.is_file(): z.write(caminho, caminho.relative_to(destino))
    zip_path.chmod(0o600)
    with zipfile.ZipFile(zip_path) as z:
        if z.testzip() is not None: raise ValueError('Falha de integridade no ZIP.')
        for a in arquivos:
            if hashlib.sha256(z.read(a['caminho'])).hexdigest() != a['sha256']:
                raise ValueError('Falha de integridade: ' + a['caminho'])
    print(json.dumps({'arquivo': str(zip_path), 'fotos': manifesto['fotos'], 'tabelas': manifesto['tabelas'],
                      'migrations': manifesto['migrations'], 'bytes': zip_path.stat().st_size, 'integridade': 'ok'}))
    return zip_path

if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('--snapshot', required=True, type=Path)
    parser.add_argument('--destino', required=True, type=Path)
    parser.add_argument('--project-ref', required=True)
    args = parser.parse_args()
    empacotar(args.snapshot, args.destino, args.project_ref)
