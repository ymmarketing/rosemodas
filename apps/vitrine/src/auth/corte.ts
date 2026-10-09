export const corteLancamento=Date.parse('2026-10-09T21:00:00Z');
// Cadastro é liberado somente por aprovação explícita, inclusive antes do corte.
export function cadastroLiberadoNoPrazo(liberado:unknown,_agora=Date.now()){return liberado===true;}
