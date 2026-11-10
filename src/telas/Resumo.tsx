import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { useFiltro } from '../App';
import { allSel, byMonth, CANAIS, CATS, curOpen, filt, kpi, META, T } from '../dados';
import { fH, fN, fP, fPP, nf, statusOf } from '../kit/formato';
import { MONTHS, periodLabel, prevRange } from '../kit/meses';
import { Card, Delta, Kpis, Legenda, Manchete, type Achado } from '../kit/ui';
import { eixoX, eixoY, faixasForaDoPeriodo, grade, Grafico, margem, opMes, passos, tt, useCores } from '../kit/graficos';

export default function Resumo() {
  const f = useFiltro();
  const cor = useCores();
  const { from, to } = f.periodo;
  const rows = filt(f), k = kpi(rows);
  const pr = prevRange(f.periodo);
  const b = pr ? kpi(filt(f, { from: pr[0], to: pr[1] })) : null;
  const all = allSel(f), mAll = byMonth(all), open = curOpen(f), late = open.filter((t) => t.cons > 1);
  const cats = CATS.map((c) => ({ c: c[0], k: kpi(rows.filter((t) => t.cat === c[0])) })).filter((x) => x.k.resolvidos >= 30).sort((x, y) => x.k.slaRes - y.k.slaRes);
  const st = statusOf(k.slaRes, META.sla, true, 0.05);

  const serie = MONTHS.map((mm, i) => ({
    mes: mm.label, i,
    'Resolução no prazo': +(mAll[i].slaRes * 100).toFixed(1), 'Resposta no prazo': +(mAll[i].slaResp * 100).toFixed(1),
    Incidentes: all.filter((t) => t.m === i && t.tipo === 'Incidente').length, Requisições: all.filter((t) => t.m === i && t.tipo === 'Requisição').length,
    ...Object.fromEntries(CANAIS.map((c) => { const r = all.filter((t) => t.m === i); return [c, r.length ? +(100 * r.filter((t) => t.canal === c).length / r.length).toFixed(1) : null]; })),
  }));
  const ys = serie.flatMap((s) => [s['Resolução no prazo'], s['Resposta no prazo']]).filter(Number.isFinite);
  const yMin = Math.floor(Math.min(...ys) / 5) * 5;

  const achados: Achado[] = [];
  if (cats.length) achados.push({ s: cats[0].k.slaRes < 0.75 ? 'bad' : 'warn', titulo: <><b>{cats[0].c}</b> tem o pior prazo: {fP(cats[0].k.slaRes)} resolvidos no prazo.</>, texto: `Mediana de ${fH(cats[0].k.mttr)} para resolver.` });
  const worstM = mAll.map((x, i) => ({ x, i })).filter((o) => o.i >= from && o.i <= to && Number.isFinite(o.x.csat)).sort((a, z) => a.x.csat - z.x.csat)[0];
  if (worstM) achados.push({ s: worstM.x.csat < META.csat - 0.2 ? 'bad' : 'warn', titulo: <>A satisfação mais baixa foi em <b>{MONTHS[worstM.i].long}</b>: {fN(worstM.x.csat, 2)}.</>, texto: worstM.i === 4 ? 'Coincide com a migração de e-mail.' : undefined });
  const pre = T.filter((t) => t.m >= 3 && t.m <= 6), pos = T.filter((t) => t.m >= 7 && t.m <= 10);
  if (f.group === 'all' || f.group === '0') achados.push({ s: 'ok', titulo: <>O portal passou de {fP(pre.filter((t) => t.canal === 'Portal').length / pre.length, 0)} para <b>{fP(pos.filter((t) => t.canal === 'Portal').length / pos.length, 0)}</b> dos chamados.</>, texto: `Os chamados de senha caíram ${fP(1 - pos.filter((t) => t.ci === 0).length / pre.filter((t) => t.ci === 0).length, 0)} depois do lançamento, em junho.` });

  if (!rows.length) return <Manchete status="ok" titulo="Nenhum chamado neste recorte." texto="Escolha outro período, equipe ou tipo." />;

  return (
    <>
      <Manchete
        status={st}
        titulo={`${fP(k.slaRes)} dos chamados foram resolvidos no prazo ${periodLabel(f.periodo)}${st === 'ok' ? ', dentro da meta de 90%.' : ', abaixo da meta de 90%.'}`}
        texto={cats.length > 1 ? <>O maior problema está em <b>{cats[0].c}</b>, com {fP(cats[0].k.slaRes)} no prazo. Foram {fN(k.n)} chamados e a satisfação média ficou em {fN(k.csat, 2)} de 5.</> : `Foram ${fN(k.n)} chamados.`}
        achados={achados}
      />

      <Kpis itens={[
        { label: 'Resolvidos no prazo', tip: 'SLA de resolução: chamados resolvidos dentro do prazo da prioridade (P1 4 h, P2 8 h, P3 24 h, P4 72 h).', value: fN(k.slaRes * 100, 1), unit: '%', target: 'Meta ≥ 90%', status: st, delta: <Delta atual={k.slaRes} anterior={b?.slaRes} sobeBom fmt={(x) => fPP(x)} />, spark: mAll.map((x) => x.slaRes) },
        { label: 'Tempo para resolver', tip: 'Mediana do tempo entre a abertura e a solução. Metade dos chamados foi resolvida em menos tempo que isso.', value: fH(k.mttr), target: 'mediana', delta: <Delta atual={k.mttr} anterior={b?.mttr} sobeBom={false} fmt={fH} />, spark: mAll.map((x) => x.mttr) },
        { label: 'Satisfação (CSAT)', tip: 'Nota média da pesquisa enviada após o atendimento, de 1 a 5.', value: fN(k.csat, 2), unit: ' de 5', target: 'Meta ≥ 4,3', status: statusOf(k.csat, META.csat, true, 0.03), delta: <Delta atual={k.csat} anterior={b?.csat} sobeBom fmt={(x) => nf(2).format(x)} />, spark: mAll.map((x) => x.csat) },
        { label: 'Vencidos na fila', tip: 'Chamados abertos agora que já passaram do prazo de resolução.', value: fN(late.length), target: `de ${fN(open.length)} abertos agora`, status: late.length === 0 ? 'ok' : late.length > 10 ? 'bad' : 'warn' },
      ]} />

      <Card titulo="Os chamados são atendidos e resolvidos no prazo?" sub="Resposta: o primeiro contato da equipe. Resolução: o problema resolvido. Os dois têm prazo por prioridade.">
        <Legenda itens={[{ label: 'Resolução no prazo', cor: cor.accent, tipo: 'linha' }, { label: 'Resposta no prazo', cor: cor.c2, tipo: 'linha' }, { label: 'Meta 90%', tipo: 'tracejado' }]} />
        <Grafico rotulo="Resolução e resposta no prazo por mês" altura={290}>
          <LineChart data={serie} margin={margem}>
            <CartesianGrid {...grade} />
            {faixasForaDoPeriodo(from, to)}
            <XAxis dataKey="mes" {...eixoX} />
            <YAxis {...eixoY} domain={[yMin, 100]} ticks={passos(yMin, 100, 5)} tickFormatter={(v) => `${v}%`} />
            <ReferenceLine y={90} stroke={cor['ink-2']} strokeDasharray="5 4" />
            <Tooltip content={tt((v) => `${nf(1).format(v)}%`)} />
            <Line dataKey="Resolução no prazo" stroke={cor.accent} strokeWidth={3} dot={{ r: 4, fill: cor.accent }} isAnimationActive={false} />
            <Line dataKey="Resposta no prazo" stroke={cor.c2} strokeWidth={1.8} dot={{ r: 2.5, fill: cor.c2 }} isAnimationActive={false} />
          </LineChart>
        </Grafico>
      </Card>

      <div className="grade g2">
        <Card titulo="Quantos chamados chegam por mês?" sub="Incidente: algo parou de funcionar. Requisição: um pedido, como acesso ou instalação.">
          <Legenda itens={[{ label: 'Incidentes', cor: cor['seq-6'] }, { label: 'Requisições', cor: cor['seq-3'] }]} />
          <Grafico rotulo="Chamados por mês e tipo" altura={260}>
            <BarChart data={serie} margin={margem}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="mes" {...eixoX} />
              <YAxis {...eixoY} tickFormatter={(v) => fN(v)} />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v) => fN(v), { rodape: (it) => `Total: ${fN(it.reduce((s, i) => s + Number(i.value), 0))}` })} />
              {(['Incidentes', 'Requisições'] as const).map((d, j) => (
                <Bar key={d} dataKey={d} stackId="t" fill={j ? cor['seq-3'] : cor['seq-6']} maxBarSize={34} radius={j ? [5, 5, 0, 0] : 0} isAnimationActive={false}>
                  {serie.map((s) => <Cell key={s.mes} fillOpacity={opMes(s.i, from, to)} />)}
                </Bar>
              ))}
            </BarChart>
          </Grafico>
        </Card>
        <Card titulo="Por onde os usuários pedem ajuda?" sub="Participação de cada canal no mês. O portal de autoatendimento foi lançado em junho.">
          <Legenda itens={CANAIS.map((c, j) => ({ label: c, cor: cor.serie[j], tipo: 'linha' as const }))} />
          <Grafico rotulo="Participação dos canais por mês" altura={260}>
            <LineChart data={serie} margin={margem}>
              <CartesianGrid {...grade} />
              {faixasForaDoPeriodo(from, to)}
              <XAxis dataKey="mes" {...eixoX} />
              <YAxis {...eixoY} domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
              <ReferenceLine x={MONTHS[7].label} stroke={cor.c1} strokeDasharray="2 3" label={{ value: 'Portal', position: 'insideTopRight', fill: cor.c1 }} />
              <Tooltip content={tt((v) => `${nf(1).format(v)}%`)} />
              {CANAIS.map((c, j) => <Line key={c} dataKey={c} stroke={cor.serie[j]} strokeWidth={c === 'Portal' ? 3 : 1.6} dot={{ r: c === 'Portal' ? 3.5 : 1.5, fill: cor.serie[j] }} isAnimationActive={false} />)}
            </LineChart>
          </Grafico>
        </Card>
      </div>
    </>
  );
}
