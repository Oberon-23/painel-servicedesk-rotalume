import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { Search } from 'lucide-react';
import { useFiltro } from '../App';
import { allSel, byMonth, CATS, filt, kpi, META, THEME_RULES } from '../dados';
import { fDT, fN, fP, fPP, nf, statusOf } from '../kit/formato';
import { MONTHS, periodLabel, prevRange } from '../kit/meses';
import { Card, Delta, Kpis, Legenda, Manchete, Pill, Segmentado } from '../kit/ui';
import { eixoX, eixoY, faixasForaDoPeriodo, grade, Grafico, margem, tt, useCores } from '../kit/graficos';

type Nota = 'all' | 'neg' | 'mid' | 'pos';

export default function Satisfacao() {
  const f = useFiltro();
  const cor = useCores();
  const [nota, setNota] = useState<Nota>('all');
  const [busca, setBusca] = useState('');
  const { from, to } = f.periodo;
  const rows = filt(f), k = kpi(rows);
  const pr = prevRange(f.periodo);
  const b = pr ? kpi(filt(f, { from: pr[0], to: pr[1] })) : null;
  const mAll = byMonth(allSel(f));
  const cats = CATS.map((c) => ({ c: c[0], v: kpi(rows.filter((t) => t.cat === c[0])).csat })).filter((x) => Number.isFinite(x.v)).sort((a, z) => a.v - z.v);
  const st = statusOf(k.csat, META.csat, true, 0.03);

  const serie = MONTHS.map((mm, i) => ({ mes: mm.label, i, CSAT: Number.isFinite(mAll[i].csat) ? +mAll[i].csat.toFixed(2) : null }));
  const cs = cats.map((x) => ({ assunto: x.c, csat: +x.v.toFixed(2) }));

  const comRows = rows.filter((t) => t.comment);
  const temas = THEME_RULES.map(([nome, re, acao]) => {
    const pos = /elogiad/.test(nome);
    const hit = comRows.filter((t) => (pos ? t.csat! >= 4 : t.csat! <= 3) && re.test(t.comment!));
    return { nome, qtd: hit.length, pos, exemplo: hit.length ? hit[hit.length - 1].comment! : '', acao };
  }).filter((x) => x.qtd).sort((a, z) => z.qtd - a.qtd).slice(0, 6);

  let lista = comRows;
  if (nota === 'neg') lista = lista.filter((t) => t.csat! <= 2); else if (nota === 'mid') lista = lista.filter((t) => t.csat === 3); else if (nota === 'pos') lista = lista.filter((t) => t.csat! >= 4);
  const q = busca.trim().toLowerCase();
  if (q) lista = lista.filter((t) => `${t.comment} ${t.cat} ${t.sub}`.toLowerCase().includes(q));
  lista = [...lista].sort((a, z) => z.open - a.open);

  if (!rows.length) return <Manchete status="ok" titulo="Nenhum chamado neste recorte." texto="Escolha outro período, equipe ou tipo." />;

  return (
    <>
      <Manchete
        status={st}
        titulo={`A nota média de satisfação foi ${fN(k.csat, 2)} de 5 ${periodLabel(f.periodo)}, com ${fP(k.satisf, 0)} de usuários satisfeitos.`}
        texto={cats.length > 1 ? <>Quem tem problema com <b>{cats[0].c}</b> é o menos satisfeito ({fN(cats[0].v, 2)}). Os motivos das notas baixas aparecem nos temas abaixo.</> : undefined}
      />

      <Kpis itens={[
        { label: 'Nota média (CSAT)', tip: 'Média das notas de 1 a 5 da pesquisa pós-atendimento.', value: fN(k.csat, 2), unit: ' de 5', target: 'Meta ≥ 4,3', status: st, delta: <Delta atual={k.csat} anterior={b?.csat} sobeBom fmt={(x) => nf(2).format(x)} />, spark: mAll.map((x) => x.csat) },
        { label: 'Satisfeitos', tip: 'Respostas com nota 4 ou 5.', value: fN(k.satisf * 100, 1), unit: '%', target: 'notas 4 e 5', delta: <Delta atual={k.satisf} anterior={b?.satisf} sobeBom fmt={(x) => fPP(x)} />, spark: mAll.map((x) => x.satisf) },
        { label: 'Insatisfeitos', tip: 'Respostas com nota 1 ou 2.', value: fN(k.insat * 100, 1), unit: '%', target: 'notas 1 e 2', delta: <Delta atual={k.insat} anterior={b?.insat} sobeBom={false} fmt={(x) => fPP(x)} />, spark: mAll.map((x) => x.insat) },
        { label: 'Respostas', tip: 'Pesquisas respondidas e o percentual sobre os chamados resolvidos.', value: fN(k.respostas), target: `${fP(k.respostas / Math.max(1, k.resolvidos), 0)} dos resolvidos` },
      ]} />

      <div className="grade g2">
        <Card titulo="Como a satisfação evoluiu?" sub="Nota média por mês. A queda de março coincide com a migração de e-mail.">
          <Legenda itens={[{ label: 'Nota média', cor: cor.accent, tipo: 'linha' }, { label: 'Meta 4,3', tipo: 'tracejado' }]} />
          <Grafico rotulo="Nota média de satisfação por mês" altura={260}>
            <AreaChart data={serie} margin={margem}>
              <CartesianGrid {...grade} />
              {faixasForaDoPeriodo(from, to)}
              <XAxis dataKey="mes" {...eixoX} />
              <YAxis {...eixoY} domain={[3.6, 4.8]} ticks={[3.6, 3.8, 4, 4.2, 4.4, 4.6, 4.8]} tickFormatter={(v) => nf(1).format(v)} />
              <ReferenceLine y={4.3} stroke={cor['ink-2']} strokeDasharray="5 4" />
              <Tooltip content={tt((v) => `${nf(2).format(v)} de 5`)} />
              <Area dataKey="CSAT" name="Nota média" stroke={cor.accent} strokeWidth={2.6} fill={cor.accent} fillOpacity={0.12} dot={{ r: 3.5, fill: cor.accent }} isAnimationActive={false} />
            </AreaChart>
          </Grafico>
        </Card>
        <Card titulo="Satisfação por assunto" sub="Em vermelho, os assuntos abaixo da meta de 4,3.">
          <Grafico semDados={!cs.length} vazio="Poucas respostas de pesquisa neste recorte." rotulo="Nota média por assunto" altura={Math.max(260, cs.length * 32 + 30)}>
            <BarChart data={cs} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" domain={[3, 5]} ticks={[3, 3.5, 4, 4.5, 5]} tickFormatter={(v) => nf(1).format(v)} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="assunto" {...eixoY} width={176} interval={0} />
              <ReferenceLine x={4.3} stroke={cor['ink-2']} strokeDasharray="5 4" label={{ value: 'Meta', position: 'top' }} />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v) => `${nf(2).format(v)} de 5`)} />
              <Bar dataKey="csat" name="Nota média" radius={[0, 5, 5, 0]} maxBarSize={22} isAnimationActive={false}>
                {cs.map((x) => <Cell key={x.assunto} fill={x.csat < META.csat ? cor.bad : cor.accent} />)}
              </Bar>
            </BarChart>
          </Grafico>
        </Card>
      </div>

      <Card titulo="O que os usuários estão dizendo" sub="Comentários da pesquisa agrupados em temas por palavras-chave. Críticas vêm das notas 1 a 3; elogios, das notas 4 e 5.">
        <div className="temas">
          {temas.length ? temas.map((t) => (
            <div key={t.nome} className={`tema-c ${t.pos ? 'pos' : 'neg'}`}>
              <h4><span>{t.nome}</span><Pill status={t.pos ? 'ok' : 'bad'}>{fN(t.qtd)}</Pill></h4>
              {t.exemplo ? <q>{t.exemplo}</q> : null}
              <p><b>Ação sugerida:</b> {t.acao}</p>
            </div>
          )) : <p className="fraco">Poucos comentários neste recorte.</p>}
        </div>
      </Card>

      <Card titulo="Comentários" sub={`${fN(lista.length)} comentários${lista.length > 60 ? ', mostrando os 60 mais recentes' : ''}.`}
        acoes={<Segmentado<Nota> rotulo="Filtrar por nota" valor={nota} onChange={setNota} opcoes={[['all', 'Todos'], ['neg', 'Notas 1–2'], ['mid', 'Nota 3'], ['pos', 'Notas 4–5']]} />}>
        <label className="busca">
          <Search size={16} aria-hidden />
          <input type="search" placeholder="Buscar nos comentários, assuntos e subcategorias" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar nos comentários" />
        </label>
        <div className="comentarios">
          {lista.slice(0, 60).map((t) => (
            <div key={t.id} className="cmt">
              <div className="meta">
                <Pill status={t.csat! <= 2 ? 'bad' : t.csat === 3 ? 'warn' : 'ok'}><span aria-label={`Nota ${t.csat} de 5`}>{'★'.repeat(t.csat!)}{'☆'.repeat(5 - t.csat!)}</span></Pill>
                <span>{fDT(t.open)}</span><span>{t.cat} · {t.sub}</span>
              </div>
              <p>{t.comment}</p>
            </div>
          ))}
          {!lista.length ? <p className="fraco">Nenhum comentário com esses filtros.</p> : null}
        </div>
      </Card>
    </>
  );
}
