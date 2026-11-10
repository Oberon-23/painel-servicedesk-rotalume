import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import { ENTRADAS, ERP, fSeg, hhmm, INICIO, FIM, JORNADA, META_ABANDONO, META_NS, NOMES, resumoDia, sugerirEscala } from '../aovivo';
import { fP, nf, statusOf } from '../kit/formato';
import { Card, Legenda, Pill } from '../kit/ui';
import { eixoX, eixoY, grade, Grafico, margem, tt, useCores } from '../kit/graficos';

const HORAS = [7, 8, 9, 10];
const ticksHora = Array.from({ length: (FIM - INICIO) / 60 + 1 }, (_, i) => INICIO + i * 60);
const REAL = resumoDia(ENTRADAS);

function Variacao({ antes, depois, sobeBom, pp = true }: { antes: number; depois: number; sobeBom: boolean; pp?: boolean }) {
  const d = depois - antes;
  if (Math.abs(d) < 0.0005) return <span className="fraco">igual à escala real</span>;
  const bom = d > 0 === sobeBom;
  return <span className={`var ${bom ? 'bom' : 'ruim'}`}>{d > 0 ? '+' : '−'}{pp ? `${nf(1).format(Math.abs(d) * 100)} p.p.` : fSeg(Math.abs(d))} vs. escala real</span>;
}

export default function SimuladorEscala() {
  const cor = useCores();
  const [ent, setEnt] = useState<number[]>(ENTRADAS);
  const [procurando, setProcurando] = useState(false);
  const r = useMemo(() => resumoDia(ent), [ent]);
  const mudou = ent.length !== ENTRADAS.length || ent.some((h, i) => h !== ENTRADAS[i]);
  const reforcos = ent.length - NOMES.length;

  const serie = r.intervalos.map((x, i) => ({
    mid: x.de + 15, rotulo: x.rotulo, de: x.de,
    'Escala real': Number.isFinite(REAL.intervalos[i].ns) ? +(REAL.intervalos[i].ns * 100).toFixed(0) : null,
    'Escala testada': Number.isFinite(x.ns) ? +(x.ns * 100).toFixed(0) : null,
  }));

  const sugerir = () => {
    setProcurando(true);
    setTimeout(() => { setEnt(sugerirEscala(ent)); setProcurando(false); }, 30);
  };

  const conclusao = !mudou
    ? <>Esta é a escala real do dia. Fora da instabilidade do ERP, ela atende <b>{fP(REAL.nsSemErp, 0)}</b> no prazo, abaixo da meta de 80%. Mude a entrada de alguém ou peça uma sugestão.</>
    : <>Com essa escala, o nível de serviço fora do incidente vai de {fP(REAL.nsSemErp, 0)} para <b>{fP(r.nsSemErp, 0)}</b>{r.nsSemErp >= META_NS ? ', acima da meta' : ', ainda abaixo da meta'}{reforcos > 0 ? `, com ${reforcos} ${reforcos === 1 ? 'pessoa a mais' : 'pessoas a mais'}` : ', sem contratar ninguém'}. O dia inteiro, contando o ERP, fica em {fP(r.ns, 0)}: o incidente é um problema de gestão de incidentes, não de escala.</>;

  return (
    <Card titulo="E se a escala fosse diferente?" sub="Mude a hora de entrada dos analistas (turno de 8 h + 1 h de almoço) ou adicione um reforço. O dia é simulado de novo com as mesmas ligações e chats." className="simulador">
      <div className="sim-grade">
        <div>
          <div className="sim-acoes">
            <button type="button" className="btn prim" onClick={sugerir} disabled={procurando}><Sparkles size={15} aria-hidden /> {procurando ? 'Procurando…' : 'Sugerir melhor escala'}</button>
            <button type="button" className="btn" onClick={() => setEnt([...ent, 8])} disabled={reforcos >= 3}><Plus size={15} aria-hidden /> Reforço</button>
            <button type="button" className="btn" onClick={() => setEnt(ENTRADAS)} disabled={!mudou}><RotateCcw size={15} aria-hidden /> Escala real</button>
          </div>
          <ul className="escala">
            {ent.map((h, i) => (
              <li key={i} className={i < ENTRADAS.length && h !== ENTRADAS[i] ? 'mudou' : i >= ENTRADAS.length ? 'novo' : ''}>
                <span className="nome">{NOMES[i] ?? `Reforço ${i - NOMES.length + 1}`}</span>
                <select value={h} aria-label={`Entrada de ${NOMES[i] ?? 'reforço'}`} onChange={(e) => setEnt(ent.map((x, k) => (k === i ? +e.target.value : x)))}>
                  {HORAS.map((x) => <option key={x} value={x}>{hhmm(x * 60)}</option>)}
                </select>
                <span className="fraco">até {hhmm(h * 60 + JORNADA)}</span>
                {i >= NOMES.length
                  ? <button type="button" className="icone" aria-label="Remover reforço" onClick={() => setEnt(ent.filter((_, k) => k !== i))}><X size={14} /></button>
                  : i < ENTRADAS.length && h !== ENTRADAS[i] ? <span className="era">era {hhmm(ENTRADAS[i] * 60)}</span> : <span />}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="sim-res">
            <div><span>Nível de serviço fora do ERP</span><b>{fP(r.nsSemErp, 1)}</b><Pill status={statusOf(r.nsSemErp, META_NS, true, 0.06)}>meta 80%</Pill><Variacao antes={REAL.nsSemErp} depois={r.nsSemErp} sobeBom /></div>
            <div><span>Nível de serviço do dia</span><b>{fP(r.ns, 1)}</b><Pill status={statusOf(r.ns, META_NS, true, 0.06)}>meta 80%</Pill><Variacao antes={REAL.ns} depois={r.ns} sobeBom /></div>
            <div><span>Abandono do dia</span><b>{fP(r.abandono, 1)}</b><Pill status={statusOf(r.abandono, META_ABANDONO, false, 0.4)}>meta 5%</Pill><Variacao antes={REAL.abandono} depois={r.abandono} sobeBom={false} /></div>
            <div><span>Espera média</span><b>{fSeg(r.tme)}</b><span /><Variacao antes={REAL.tme} depois={r.tme} sobeBom={false} pp={false} /></div>
          </div>
          <p className="sim-conclusao">{conclusao}</p>
          <Legenda itens={[{ label: 'Escala real', cor: cor['ink-2'], tipo: 'linha' }, { label: 'Escala testada', cor: cor.accent, tipo: 'linha' }, { label: 'Meta 80%', tipo: 'tracejado' }]} />
          <Grafico rotulo="Nível de serviço por meia hora: escala real e testada" altura={220}>
            <LineChart data={serie} margin={margem}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="mid" type="number" domain={[INICIO, FIM]} ticks={ticksHora} tickFormatter={(v) => `${Math.floor(v / 60)}h`} {...eixoX} />
              <YAxis {...eixoY} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`} />
              <ReferenceArea x1={ERP.de} x2={ERP.ate} fill={cor.bad} fillOpacity={0.08} />
              <ReferenceLine y={80} stroke={cor['ink-2']} strokeDasharray="5 4" />
              <Tooltip content={tt((v) => `${v}%`, { titulo: (_l, p) => `${p.rotulo}–${hhmm(Number(p.de) + 30)}` })} />
              <Line dataKey="Escala real" stroke={cor['ink-2']} strokeWidth={1.6} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="Escala testada" stroke={cor.accent} strokeWidth={2.6} dot={{ r: 2.5, fill: cor.accent }} isAnimationActive={false} connectNulls />
            </LineChart>
          </Grafico>
        </div>
      </div>
    </Card>
  );
}
