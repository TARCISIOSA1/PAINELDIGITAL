export function checarPermissao(permissoesUsuario, tela, acao) {
  if (!permissoesUsuario || !permissoesUsuario[tela]) return false;
  return !!permissoesUsuario[tela][acao];
}
