import { Upload } from 'lucide-react'
import { useState } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { ErroPermissao, ErroRegra, ErroValidacao } from '@/lib/dados/repositorio'
import { TAMANHO_MAXIMO_ARQUIVO } from '@/lib/dados/regrasModulos'
import type { Registro } from '@/lib/dados/tipos'
import { hojeIso } from '@/lib/diasUteis'
import { enviarDocumento, enviarNovaVersao, type MetadadosDocumento } from '@/lib/documentos/servicoDocumentos'

interface Props {
  aberto: boolean
  aoFechar: () => void
  aoEnviar: () => Promise<void>
  processoId: string
  tipos: Registro[]
  /** Etapas do fluxo para vincular (código + nome). */
  etapas?: { codigo: string; nome: string }[]
  alunos?: { id: string; nome: string }[]
  /** Vínculos fixos (ex.: instrumento_id quando enviado da tela do contrato). */
  vinculos?: Partial<MetadadosDocumento>
  inicial?: { tipo_documento_id?: string; etapa_codigo?: string }
  /** Quando informado, envia nova versão deste documento. */
  novaVersaoDe?: Registro
}

const ACEITOS = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp'

export function UploadDocumento({ aberto, aoFechar, aoEnviar, processoId, tipos, etapas = [], alunos = [], vinculos = {}, inicial = {}, novaVersaoDe }: Props) {
  const usuario = useUsuario()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [tipo, setTipo] = useState(inicial.tipo_documento_id ?? '')
  const [etapa, setEtapa] = useState(inicial.etapa_codigo ?? '')
  const [aluno, setAluno] = useState('')
  const [sei, setSei] = useState('')
  const [data, setData] = useState(hojeIso())
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setErro(null)
    if (!arquivo) return setErro('Escolha o arquivo.')
    if (!novaVersaoDe && !tipo) return setErro('Escolha o tipo de documento.')
    if (novaVersaoDe && !obs.trim()) return setErro('Informe o motivo da nova versão.')
    setEnviando(true)
    try {
      if (novaVersaoDe) await enviarNovaVersao(usuario, novaVersaoDe.id, arquivo, obs)
      else
        await enviarDocumento(
          usuario,
          { processo_id: processoId, tipo_documento_id: tipo, numero_sei: sei || null, data_documento: data, observacao: obs || null, etapa_codigo: etapa || null, aluno_id: aluno || null, ...vinculos },
          arquivo,
        )
      await aoEnviar()
      aoFechar()
    } catch (e) {
      if (e instanceof ErroRegra || e instanceof ErroPermissao) setErro(e.message)
      else if (e instanceof ErroValidacao) setErro(Object.values(e.erros).join(' '))
      else throw e
    } finally {
      setEnviando(false)
    }
  }

  const rotulo = 'mb-1 block text-sm font-medium text-slate-700'
  return (
    <Modal titulo={novaVersaoDe ? 'Enviar nova versão' : 'Enviar documento'} aberto={aberto} aoFechar={aoFechar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={rotulo} htmlFor="arquivo">
            Arquivo (PDF ou imagem, até {TAMANHO_MAXIMO_ARQUIVO / 1048576} MB) <span className="text-red-600">*</span>
          </label>
          <input id="arquivo" type="file" accept={ACEITOS} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="campo" />
          {arquivo && <p className="mt-1 text-xs text-slate-500">{(arquivo.size / 1048576).toFixed(2)} MB · {arquivo.type || 'tipo desconhecido'}</p>}
        </div>
        {!novaVersaoDe && (
          <>
            <div className="sm:col-span-2">
              <label className={rotulo} htmlFor="tipo">Tipo de documento <span className="text-red-600">*</span></label>
              <select id="tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Selecione…</option>
                {tipos.filter((t) => t.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map((t) => (
                  <option key={t.id} value={t.id}>{String(t.nome)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={rotulo} htmlFor="sei">Nº SEI do documento</label>
              <input id="sei" className="campo" value={sei} onChange={(e) => setSei(e.target.value)} />
            </div>
            <div>
              <label className={rotulo} htmlFor="data">Data do documento <span className="text-red-600">*</span></label>
              <input id="data" type="date" className="campo" value={data} max={hojeIso()} onChange={(e) => setData(e.target.value)} />
            </div>
            {etapas.length > 0 && (
              <div>
                <label className={rotulo} htmlFor="etapa">Etapa</label>
                <select id="etapa" className="campo" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                  <option value="">—</option>
                  {etapas.map((e) => <option key={e.codigo} value={e.codigo}>{e.codigo} – {e.nome}</option>)}
                </select>
              </div>
            )}
            {alunos.length > 0 && (
              <div>
                <label className={rotulo} htmlFor="aluno">Aluno</label>
                <select id="aluno" className="campo" value={aluno} onChange={(e) => setAluno(e.target.value)}>
                  <option value="">—</option>
                  {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
            )}
          </>
        )}
        <div className="sm:col-span-2">
          <label className={rotulo} htmlFor="obs">{novaVersaoDe ? 'Motivo da nova versão *' : 'Observação'}</label>
          <textarea id="obs" rows={2} className="campo" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
      </div>
      {erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao onClick={enviar} disabled={enviando}>
          <Upload size={16} /> {enviando ? 'Enviando…' : 'Enviar'}
        </Botao>
      </div>
    </Modal>
  )
}
