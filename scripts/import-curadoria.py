"""Operação de homologação: enviar somente os arquivos do lote autorizado.

Credenciais ficam em arquivo privado fora do Git. Não imprime chaves nem tokens.
"""
import argparse, json, pathlib, urllib.request, urllib.error, concurrent.futures, hashlib

parser = argparse.ArgumentParser()
parser.add_argument('--credenciais',required=True)
parser.add_argument('--fotos',required=True)
parser.add_argument('--verificar-acesso',action='store_true')
parser.add_argument('--convidar',action='store_true')
args = parser.parse_args()
cred = json.loads(pathlib.Path(args.credenciais).read_text())
url = 'https://kernpudxhwkpoadahgqj.supabase.co/functions/v1/importar-fotos-curadoria'
headers = {'Authorization':'Bearer '+cred['api_key'],'apikey':cred['api_key'],'x-import-token':cred['import_token']}

def enviar(data,extra):
    request=urllib.request.Request(url,data=data,method='POST',headers={**headers,**extra})
    try:
        with urllib.request.urlopen(request,timeout=45) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        try:body=json.loads(error.read());message=body.get('error') or body.get('message') or 'Erro HTTP'
        except (ValueError,UnicodeError):message='Erro HTTP'
        raise RuntimeError(f'{error.code}: {message}') from None

if args.verificar_acesso or args.convidar:
    print(json.dumps(enviar(b'',{'x-setup-access':'convidar' if args.convidar else 'verificar','Content-Type':'application/json'})))
else:
    manifest=json.loads(pathlib.Path('supabase/importacoes/curadoria-20261007.json').read_text())
    assets=[m for p in manifest['produtos'] for m in p['midias']]
    def upload(asset):
        raw=(pathlib.Path(args.fotos)/(asset['id']+'.webp')).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=asset['sha256']:raise RuntimeError('Arquivo local diferente do lote autorizado')
        result=enviar(raw,{'Content-Type':'image/webp','x-file-id':asset['drive_id']})
        if not result.get('ok'):raise RuntimeError('Envio não confirmado')
        return asset['arquivo_nome_original']
    erros=[];concluidas=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures={pool.submit(upload,m):m for m in assets}
        for future in concurrent.futures.as_completed(futures):
            try:future.result();concluidas+=1
            except Exception as error:erros.append({'arquivo':futures[future]['arquivo_nome_original'],'erro':str(error)})
            if (concluidas+len(erros))%12==0:print(f'Arquivos confirmados: {concluidas}/{len(assets)}',flush=True)
    print(json.dumps({'confirmadas':concluidas,'total':len(assets),'erros':erros},ensure_ascii=False))
    if erros:raise SystemExit(1)
