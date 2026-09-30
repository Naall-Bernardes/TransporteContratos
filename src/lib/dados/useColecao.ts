import { useCallback, useEffect, useState } from 'react'
import { useUsuario } from '@/features/auth/Sessao'
import { listar } from './repositorio'
import { COLECOES, type Colecao, type Registro } from './tipos'

/** Carrega as coleções pedidas (já filtradas pela permissão do usuário logado). */
export function useColecoes(colecoes: Colecao[]) {
  const usuario = useUsuario()
  const chave = colecoes.join(',')
  const [dados, setDados] = useState<Partial<Record<Colecao, Registro[]>>>({})
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    const lista = chave.split(',').filter(Boolean) as Colecao[]
    const resultados = await Promise.all(lista.map((c) => listar(c, usuario)))
    setDados(Object.fromEntries(lista.map((c, i) => [c, resultados[i]])))
    setCarregando(false)
  }, [chave, usuario])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { dados, carregando, recarregar }
}

/** Carrega todas as tabelas (usado nas telas dos módulos, que cruzam muitas tabelas). */
export const useTodos = () => useColecoes(COLECOES)
