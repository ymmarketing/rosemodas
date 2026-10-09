import { Marca, Icone } from './Visual';
import type { Catalogo } from './catalogo';
export const perguntasTroca = [['Posso desistir da compra?','Nas compras fora do estabelecimento, você pode exercer o direito de arrependimento em até 7 dias após receber a peça, conforme o Código de Defesa do Consumidor.']];
export function QuemSomos({catalogo,whatsapp}:{catalogo:Catalogo|null;whatsapp:()=>void;homologacao?:boolean}) {
 return <div className="prose"><span className="eyebrow">Quem somos</span><div className="qs-hero"><div className="s-logo"><Marca catalogo={catalogo}/></div><div><h1>Rose Menezes Moda Feminina</h1><p className="script" style={{fontSize:32,marginTop:6}}>Elegância que abraça</p></div></div>
 <p>Peças do P ao Plus Size que vestem bem o corpo de verdade.</p><h2>Conheça a coleção</h2><ul><li>Confira os detalhes de cada peça na vitrine.</li><li>Provador ao vivo: toda quinta, 20h, no Instagram.</li><li>Atendimento pelo WhatsApp para escolher sua peça.</li></ul>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}><a className="btn btn-p" href="#/loja">Ver coleção</a><button className="btn btn-g" onClick={whatsapp}><Icone nome="wa"/> Falar com a Rose</button></div></div>;
}
export function Trocas({aviso}:{aviso:()=>void;homologacao?:boolean}) {
 return <div className="prose"><span className="eyebrow">Trocas e cancelamentos</span><h1>Trocas e devoluções</h1><h2>Direito de arrependimento</h2><p>{perguntasTroca[0][1]}</p><p>Para solicitar troca ou devolução, fale com a Rose pelo WhatsApp e informe a peça e os dados da compra.</p><button className="btn btn-p" onClick={aviso}>Solicitar pelo WhatsApp</button></div>;
}
