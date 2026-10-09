export const corteLancamento=Date.parse('2026-10-09T21:00:00Z');
// Antes do corte a homologação pode testar o cadastro. Depois, somente o fluxo aprovado.
export function cadastroLiberadoNoPrazo(liberado:unknown,agora=Date.now()){
 return agora<corteLancamento||liberado===true;
}
