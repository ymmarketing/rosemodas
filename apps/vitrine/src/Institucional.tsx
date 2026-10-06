import { Marca, Icone } from './Visual';
import type { Catalogo } from './catalogo';
export const perguntasTroca = [
 ['Posso desistir da compra?','Sim. Compras online podem ser devolvidas em até 7 dias depois do recebimento, com reembolso integral, inclusive do frete.'],
 ['Como troco por outro tamanho?','Peça a troca na Área da cliente em até 30 dias do recebimento. Escolha o tamanho novo; ele fica reservado para você enquanto a peça volta.'],
 ['Quem paga o frete da troca?','Na primeira troca, a loja paga. Nas demais, o frete de retorno é por conta da cliente.'],
 ['Em que condição a peça deve voltar?','Sem uso, com etiqueta e na embalagem original. A peça é conferida quando chega.'],
 ['Como funciona o cancelamento?','Antes do pagamento, o pedido cancela sozinho quando o Pix ou boleto vence. Depois do pagamento e antes da postagem, fale com a gente e o reembolso é integral. Depois de postado, vira devolução.'],
 ['Em quanto tempo recebo o reembolso?','Pix: até 2 dias úteis após a peça chegar. Cartão: o estorno aparece em 1 ou 2 faturas, conforme o banco.'],
];
export function QuemSomos({catalogo,whatsapp}:{catalogo:Catalogo|null;whatsapp:()=>void}) {
 return <div className="prose"><span className="eyebrow">Quem somos</span><div className="qs-hero"><div className="s-logo"><Marca catalogo={catalogo} /></div><div><h1>Aos 66, a Rose abriu a loja que sempre procurou</h1><p className="script" style={{fontSize:32,marginTop:6}}>Elegância que abraça</p></div></div>
 <p>Eu sou a Rose, tenho 66 anos e passei a vida procurando roupa bonita que coubesse em mim de verdade. Ou era confortável e sem graça, ou era bonita e apertava.</p>
 <p>Um dia pensei: se eu sinto isso, quantas mulheres sentem também? Foi assim que nasceu a Rose Menezes. Aqui cada peça passa primeiro pelo meu corpo. Se eu não me sinto linda e confortável, ela não entra na loja.</p>
 <div className="quote">“Para a mulher que já sabe quem é. Que não quer esconder o corpo, quer vesti-lo bem.”</div><h2>O que você encontra aqui</h2>
 <ul><li>Peças do 44 ao 54, com medidas reais em todas as páginas.</li><li>Provador ao vivo: toda quinta, 20h, a Rose veste as peças no Instagram.</li><li>Atendimento de amiga pelo WhatsApp para montar o look.</li><li>Troca facilitada na primeira compra.</li></ul>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}><a className="btn btn-p" href="#/loja">Ver coleção</a><a className="btn btn-g" href="#whatsapp" onClick={e=>{e.preventDefault();whatsapp();}}><Icone nome="wa" /> Falar com a Rose</a></div></div>;
}
export function Trocas({aviso}:{aviso:()=>void}) {return <div className="prose"><span className="eyebrow">Política de trocas e cancelamento</span><h1>Trocar é simples por aqui</h1><p className="muted" style={{margin:'10px 0 20px'}}>Texto de exemplo para validar o formato. A versão final é aprovada pela Rose.</p>
 {perguntasTroca.map(([q,a],i) => <details className="acc" key={q} open={i===0?true:undefined}><summary>{q}</summary><div>{a}</div></details>)}
 <div className="box" style={{marginTop:18,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><b>Quer trocar uma peça?</b><div className="small muted">Abra a solicitação na sua área, em poucos cliques.</div></div><a className="btn btn-p" href="#solicitar-troca" onClick={e=>{e.preventDefault();aviso();}}>Solicitar troca</a></div></div>;}
