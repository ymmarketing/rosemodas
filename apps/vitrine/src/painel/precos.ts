export function validarPrecos(preco: string, promocional: string) {
  const ler = (texto: string, nome: string) => {
    if (!texto.trim()) return null;
    const valor = Number(texto);
    if (!Number.isFinite(valor) || valor < 0) throw new Error(`${nome} deve ser um valor válido em reais.`);
    if (Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001) {
      throw new Error(`${nome} deve ter no máximo duas casas decimais.`);
    }
    return valor;
  };
  const venda = ler(preco, 'O preço de venda'), oferta = ler(promocional, 'O preço promocional');
  if (venda !== null && venda <= 0) throw new Error('O preço de venda deve ser maior que zero.');
  if (oferta !== null && venda === null) throw new Error('Informe o preço de venda antes de definir uma promoção.');
  if (oferta !== null && venda !== null && oferta >= venda) {
    throw new Error('O preço promocional deve ser menor que o preço de venda. Para vender pelo mesmo valor, deixe a promoção vazia.');
  }
  return { preco: venda, preco_promocional: oferta };
}
