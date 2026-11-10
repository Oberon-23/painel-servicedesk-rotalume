import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { useFiltro } from '../App';
import { ANALYSTS, CATS, curOpen, DAY, filt, GROUPS, GSHORT, PRI, type Chamado } from '../dados';
import { fDT, fH, fN, fP, nf } from '../kit/formato';
import { Card, Kpis, Legenda, Manchete, MapaCalor, Pill, TabelaOrdenavel } from '../kit/ui';
import { eixoX, eixoY, grade, Grafico, margem, tt, useCores } from '../kit/graficos';

const FAIXAS: [string, number, number][] = [['< 1 dia', 0, 24], ['1–3 dias', 24, 72], ['3–7 dias', 72, 168], ['7–15 dias', 168, 360], ['+15 dias', 360, 1e9]];
const HORAS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], DIAS = [1, 2, 3, 4, 5], DN = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

type Linha = { id: string; open: number; p: number; assunto: string; sub: string; resp: string; ageH: number; cons: number };

export default function Fila() {
  const f = useFiltro();
  const cor = useCores();
  const open = curOpen(f), late = open.filter((t) => t.cons > 1), risk = open.filter((t) => t.cons > 0.75 && t.cons <= 1), old = open.filter((t) => t.ageH! > 360);
  const g: Record<number, number> = {}; late.forEach((t) => (g[t.g] = (g[t.g] || 0) + 1));
  const gw = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
  const stLate = late.length === 0 ? 'ok' : late.length > 10 ? 'bad' : 'warn';

  const gs = GROUPS.map((_, j) => j).filter((j) => open.some((t) => t.g === j));
  const idade = FAIXAS.map(([l, a, b]) => ({ faixa: l, ...Object.fromEntries(gs.map((j) => [GSHORT[j], open.filter((t) => t.g === j && t.ageH! >= a && t.ageH! < b).length])) }));

  const rows = filt(f);
  const nd: Record<number, number> = {};
  DIAS.forEach((d) => (nd[d] = new Set(rows.filter((t) => t.dow === d).map((t) => Math.floor(t.open / DAY))).size || 1));
  const calor = DIAS.map((d) => HORAS.map((h) => rows.filter((t) => t.dow === d && t.hour === h).length / nd[d]));

  const top: Linha[] = [...open].sort((a, b) => b.cons - a.cons).slice(0, 50).map((t) => ({ id: t.id, open: t.open, p: t.p, assunto: t.cat, sub: t.sub, resp: ANALYSTS[t.an].nome, ageH: t.ageH!, cons: t.cons }));
  const res = rows.filter((t) => !t.isOpen);
  const celula = (r: Chamado[]) => {
    if (r.length < 5) return <span className="fraco">—</span>;
    const x = r.filter((t) => !t.slaRes).length / r.length;
    return <span title={`${fN(r.length)} resolvidos`}><Pill status={x > 0.25 ? 'bad' : x > 0.1 ? 'warn' : 'ok'}>{nf(0).format(x * 100)}%</Pill></span>;
  };

  return (
    <>
      <Manchete
        status={stLate}
        titulo={`Há ${fN(open.length)} chamados abertos agora, e ${fN(late.length)} já passaram do prazo.`}
        texto={gw ? <>A maior parte dos vencidos está com <b>{GROUPS[+gw[0]]}</b> ({gw[1]}).{old.length ? ` ${fN(old.length)} estão parados há mais de 15 dias e merecem uma revisão com o grupo.` : ''}</> : undefined}
      />

      <Kpis itens={[
        { label: 'Abertos agora', tip: 'Chamados ainda sem solução em 31/10/2026, às 17h.', value: fN(open.length), target: `${fN(open.filter((t) => t.p <= 1).length)} de prioridade alta` },
        { label: 'Vencidos', tip: 'Abertos há mais tempo que o prazo de resolução da prioridade.', value: fN(late.length), target: open.length ? `${fP(late.length / open.length, 0)} da fila` : '', status: stLate },
        { label: 'Vencem em breve', tip: 'Já consumiram entre 75% e 100% do prazo. Agir hoje evita que vençam.', value: fN(risk.length), target: '75% a 100% do prazo', status: risk.length ? 'warn' : 'ok' },
        { label: 'Parados há +15 dias', tip: 'Chamados envelhecidos, em geral aguardando peça, fornecedor ou outra equipe.', value: fN(old.length), target: 'revisar com o grupo', status: old.length ? 'bad' : 'ok' },
      ]} />

      <div className="grade g-5-7">
        <Card titulo="Há quanto tempo estão abertos?" sub="Chamados abertos agora por idade e equipe responsável.">
          <Legenda itens={gs.map((j) => ({ label: GSHORT[j], cor: cor.serie[j] }))} />
          <Grafico semDados={!gs.length} vazio="Nenhum chamado aberto agora para este filtro." rotulo="Chamados abertos por idade e equipe" altura={270}>
            <BarChart data={idade} margin={margem}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="faixa" {...eixoX} interval={0} />
              <YAxis {...eixoY} allowDecimals={false} />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v) => fN(v), { filtrar: (i) => Number(i.value) > 0 })} />
              {gs.map((j, n) => <Bar key={j} dataKey={GSHORT[j]} stackId="g" fill={cor.serie[j]} stroke={cor.surface} strokeWidth={1} maxBarSize={56} radius={n === gs.length - 1 ? [5, 5, 0, 0] : 0} isAnimationActive={false} />)}
            </BarChart>
          </Grafico>
        </Card>
        <Card titulo="Quando os chamados chegam?" sub="Média de chamados abertos por hora, em dias úteis. Ajuda a montar a escala da equipe.">
          <MapaCalor titulo="Chamados por dia da semana e hora" linhas={DIAS.map((d) => DN[d])} colunas={HORAS.map((h) => `${h}h`)} valores={calor} fmt={(v) => nf(1).format(v)} />
        </Card>
      </div>

      <Card titulo="Chamados mais perto de estourar o prazo" sub="Os abertos que mais consumiram do prazo de resolução. 3× significa aberto há três vezes o prazo. Clique no cabeçalho para ordenar.">
        <TabelaOrdenavel<Linha>
          linhas={top} chave={(r) => r.id} ordemInicial={{ k: 'cons', d: -1 }} porPagina={10}
          colunas={[
            { k: 'id', label: 'Chamado', render: (r) => <span className="mono">{r.id}</span> },
            { k: 'open', label: 'Aberto em', render: (r) => fDT(r.open) },
            { k: 'p', label: 'Prioridade', render: (r) => <Pill status={r.p <= 1 ? 'bad' : 'neutral'}>{PRI[r.p]}</Pill> },
            { k: 'assunto', label: 'Assunto', render: (r) => <>{r.assunto}<br /><span className="fraco">{r.sub}</span></> },
            { k: 'resp', label: 'Responsável' },
            { k: 'ageH', label: 'Aberto há', num: true, render: (r) => fH(r.ageH) },
            { k: 'cons', label: 'Prazo consumido', num: true, render: (r) => <Pill status={r.cons > 1 ? 'bad' : r.cons > 0.75 ? 'warn' : 'ok'}>{r.cons >= 2 ? `${nf(1).format(r.cons)}× o prazo` : `${nf(0).format(r.cons * 100)}%`}</Pill> },
          ]}
        />
      </Card>

      <Card titulo="Onde o prazo mais estoura?" sub="Parte dos chamados resolvidos fora do prazo, por assunto e prioridade. Traço quando há menos de 5 chamados.">
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Assunto</th>{PRI.map((p) => <th key={p} className="n">{p}</th>)}<th className="n">Total</th></tr></thead>
            <tbody>
              {CATS.map((c) => {
                const r = res.filter((t) => t.cat === c[0]);
                return <tr key={c[0]}><td><b>{c[0]}</b></td>{PRI.map((_, p) => <td key={p} className="n">{celula(r.filter((t) => t.p === p))}</td>)}<td className="n">{celula(r)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
