import { CartesianGrid, Cell, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { useFiltro } from '../App';
import { filt, GROUPS, GSHORT, kpi, META, teamRows } from '../dados';
import { fH, fN, fP, nf, pl, statusOf } from '../kit/formato';
import { periodLabel } from '../kit/meses';
import { Card, Kpis, Legenda, Manchete, Pill, TabelaOrdenavel } from '../kit/ui';
import { CaixaTt, eixoX, eixoY, Grafico, passos, useCores } from '../kit/graficos';

type Linha = ReturnType<typeof teamRows>[number];
const faixa = (v: number, bom: number, ruim: number, sobe: boolean) => (!Number.isFinite(v) ? 'neutral' : (sobe ? v >= bom : v <= bom) ? 'ok' : (sobe ? v < ruim : v > ruim) ? 'bad' : 'warn');

export default function Equipe() {
  const f = useFiltro();
  const cor = useCores();
  const tr = teamRows(f), rows = filt(f), k = kpi(rows);
  const re = tr.filter((x) => x.resp >= 15).sort((a, b) => b.reab - a.reab)[0];
  const fcrOk = f.group === 'all' || f.group === '0';
  const gs = [...new Set(tr.map((x) => x.g))];
  const mxn = Math.max(...tr.map((x) => x.n), 1);
  const pts = tr.filter((x) => Number.isFinite(x.csat)).map((x) => ({ ...x, mttr: +x.mttr.toFixed(2), csat: +x.csat.toFixed(2) }));
  const ys = pts.map((x) => x.csat);
  const yLo = Math.min(3.6, Math.floor(Math.min(...ys) * 5) / 5), yHi = Math.max(4.8, Math.ceil(Math.max(...ys) * 5) / 5);

  if (!rows.length) return <Manchete status="ok" titulo="Nenhum chamado neste recorte." texto="Escolha outro período, equipe ou tipo." />;

  return (
    <>
      <Manchete
        status={statusOf(k.reab, META.reab, false, 0.15)}
        titulo={fcrOk && f.group === 'all'
          ? `${fP(k.fcr)} dos chamados foram resolvidos pelo N1 no primeiro contato ${periodLabel(f.periodo)}.`
          : `A equipe ${GROUPS[+f.group]} atendeu ${pl(k.n, 'chamado', 'chamados')} ${periodLabel(f.periodo)}, com ${fP(k.reab)} de reabertura.`}
        texto={<>{f.group === 'all' ? `A reabertura média é de ${fP(k.reab)}. ` : ''}{re && re.reab > k.reab * 1.3
          ? <><b>{re.nome}</b> tem a maior taxa ({fP(re.reab)}), um sinal para acompanhar alguns atendimentos e reforçar a confirmação com o usuário antes de encerrar.</>
          : 'Nenhum analista se destaca negativamente em reabertura.'}</>}
      />

      <Kpis itens={[
        { label: 'Resolvidos no 1º contato', tip: 'FCR: chamados resolvidos pelo N1 sem precisar escalar para outra equipe. Só se aplica ao N1.', value: fcrOk ? fN(k.fcr * 100, 1) : '—', unit: fcrOk ? '%' : '', target: fcrOk ? (f.group === '0' ? 'dos chamados do N1' : 'do total de chamados') : 'só se aplica ao N1' },
        { label: 'Reabertos', tip: 'Chamados que o usuário reabriu porque o problema não foi resolvido de fato.', value: fN(k.reab * 100, 1), unit: '%', target: 'Meta ≤ 6%', status: statusOf(k.reab, META.reab, false, 0.15) },
        { label: 'Transferências por chamado', tip: 'Média de vezes que um chamado mudou de equipe ou de analista. Muitas transferências indicam triagem difícil.', value: fN(k.reatrib, 2), target: 'média' },
        { label: 'Chamados por analista', tip: 'Volume médio por pessoa no período.', value: fN(k.n / Math.max(1, tr.length)), target: `${tr.length} analistas` },
      ]} />

      <>
        <Card titulo="Rapidez × satisfação" sub="Cada bolha é um analista. Mais à esquerda, resolve mais rápido; mais acima, usuários mais satisfeitos. O tamanho é o volume.">
          <Legenda itens={[...gs.map((j) => ({ label: GSHORT[j], cor: cor.serie[j] })), { label: 'Meta CSAT 4,3', tipo: 'tracejado' as const }]} />
          <Grafico rotulo="Tempo para resolver e satisfação por analista" altura={340}>
            <ScatterChart margin={{ top: 12, right: 18, bottom: 22, left: 0 }}>
              <CartesianGrid strokeDasharray="0" />
              <XAxis type="number" dataKey="mttr" scale="log" domain={[0.5, 'auto']} ticks={[0.5, 1, 2, 5, 10, 20, 50].filter((t) => t <= Math.max(...pts.map((x) => x.mttr)) * 1.6)} tickFormatter={(v) => `${v} h`} {...eixoX}
                label={{ value: 'Tempo para resolver (mediana, escala log)', position: 'insideBottom', offset: -14 }} />
              <YAxis type="number" dataKey="csat" domain={[yLo, yHi]} ticks={passos(yLo, yHi, 0.2)} tickFormatter={(v) => nf(1).format(v)} {...eixoY} />
              <ZAxis type="number" dataKey="n" range={[70, 700]} domain={[0, mxn]} />
              <ReferenceLine y={4.3} stroke={cor['ink-2']} strokeDasharray="5 4" />
              <Tooltip cursor={false} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const x = payload[0].payload as Linha;
                return <CaixaTt titulo={x.nome} linhas={[{ nome: 'Equipe', valor: GSHORT[x.g] }, { nome: 'Mediana', valor: fH(x.mttr) }, { nome: 'CSAT', valor: nf(2).format(x.csat) }, { nome: 'Chamados', valor: fN(x.n) }]} />;
              }} />
              <Scatter data={pts} isAnimationActive={false}>
                {pts.map((x) => <Cell key={x.id} fill={cor.serie[x.g]} fillOpacity={0.82} stroke={cor.surface} strokeWidth={1.5} />)}
              </Scatter>
            </ScatterChart>
          </Grafico>
        </Card>
        <Card titulo="Analistas" sub="Clique no cabeçalho para ordenar. Cores: verde na meta, amarelo perto, vermelho longe.">
          <TabelaOrdenavel<Linha>
            linhas={tr} chave={(r) => r.id} ordemInicial={{ k: 'n', d: -1 }}
            colunas={[
              { k: 'nome', label: 'Analista', render: (r) => <b>{r.nome}</b> },
              { k: 'gs', label: 'Equipe' },
              { k: 'n', label: 'Chamados', num: true, render: (r) => <span className="barra-in"><i style={{ width: `${Math.round((36 * r.n) / mxn)}px` }} />{fN(r.n)}</span> },
              { k: 'mttr', label: 'Mediana', num: true, render: (r) => fH(r.mttr) },
              { k: 'slaRes', label: 'No prazo', num: true, render: (r) => <Pill status={faixa(r.slaRes, 0.9, 0.8, true)}>{fP(r.slaRes, 0)}</Pill> },
              { k: 'reab', label: 'Reabertos', num: true, render: (r) => <Pill status={faixa(r.reab, 0.06, 0.1, false)}>{fP(r.reab, 1)}</Pill> },
              { k: 'csat', label: 'CSAT', num: true, render: (r) => <Pill status={faixa(r.csat, 4.3, 3.9, true)}>{fN(r.csat, 2)}</Pill> },
            ]}
          />
        </Card>
      </>
    </>
  );
}
