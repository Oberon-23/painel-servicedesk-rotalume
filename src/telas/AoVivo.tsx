import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock, Pause, Play, Radio } from 'lucide-react';
import {
  acumulado, CANAIS_AO_VIVO, DIA_TXT, EQUIPE, ERP, FIM, foto, FOTOS, fSeg, hhmm, INICIO, INTERVALOS, META_ABANDONO, META_ESPERA, META_NS, porId, UNIDADES,
  type CanalAV, type FotoAnalista,
} from '../aovivo';
import { fN, fP, nf, statusOf, type Status } from '../kit/formato';
import { Card, Kpis, Legenda, Manchete, Pill, Segmentado, type Achado } from '../kit/ui';
import SimuladorEscala from './SimuladorEscala';
import { eixoX, eixoY, grade, Grafico, margem, tt, useCores } from '../kit/graficos';

const MARCOS: [number, string][] = [[9 * 60 + 30, 'Pico da manhã'], [11 * 60 + 33, 'Instabilidade no ERP'], [12 * 60 + 40, 'Almoço'], [15 * 60 + 50, 'Fim de tarde']];
const ESTADO_TXT: Record<string, string> = { off: 'Fora do turno', livre: 'Disponível', atend: 'Em atendimento' };
const ticksHora = Array.from({ length: (FIM - INICIO) / 60 + 1 }, (_, i) => INICIO + i * 60);

function estadoDe(a: FotoAnalista, m: number) {
  const min = (m * 60 - a.desde) / 60;
  if (a.estado === 'pausa') {
    const passou = a.prevista != null && min > a.prevista + 1;
    return { txt: a.pausa!, status: (passou ? 'bad' : a.pausa === 'Treinamento' ? 'neutral' : 'warn') as Status, min, passou };
  }
  return { txt: ESTADO_TXT[a.estado], status: (a.estado === 'livre' ? 'ok' : a.estado === 'atend' ? 'info' : 'neutral') as Status | 'info', min, passou: false };
}

export default function AoVivo() {
  const cor = useCores();
  const [m, setM] = useState(11 * 60 + 33);
  const [rodando, setRodando] = useState(false);
  const [vel, setVel] = useState<'1' | '5'>('1');

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => setM((x) => { if (x >= FIM) { setRodando(false); return FIM; } return Math.min(FIM, x + +vel); }), 700);
    return () => clearInterval(id);
  }, [rodando, vel]);

  const f = foto(m);
  const fila = f.fila.map(porId);
  const esperaDe = (c: { chegada: number }) => m * 60 - c.chegada;
  const porCanal = Object.fromEntries(CANAIS_AO_VIVO.map((c) => {
    const q = fila.filter((x) => x.canal === c);
    return [c, { n: q.length, maior: q.length ? Math.max(...q.map(esperaDe)) : 0 }];
  })) as Record<CanalAV, { n: number; maior: number }>;
  const maior = Math.max(0, ...fila.map(esperaDe));
  const cont = { livre: 0, atend: 0, pausa: 0, off: 0 };
  f.analistas.forEach((a) => cont[a.estado]++);
  const logados = 8 - cont.off;
  const acc = acumulado(m), tel = acumulado(m, 'Telefone'), chat = acumulado(m, 'Chat');
  const atrasadas = f.analistas.map((a, i) => ({ i, e: estadoDe(a, m) })).filter((x) => x.e.passou);

  const porUnidade = UNIDADES.map((u, i) => {
    const q = fila.filter((c) => c.unidade === i);
    return { u, tel: q.filter((c) => c.canal === 'Telefone').length, chat: q.filter((c) => c.canal === 'Chat').length, maior: q.length ? Math.max(...q.map(esperaDe)) : 0 };
  }).sort((a, b) => b.tel + b.chat - (a.tel + a.chat) || b.maior - a.maior);
  const topUni = porUnidade[0];

  const stFila: Status = fila.length === 0 ? 'ok' : maior > META_ESPERA.Telefone * 3 || fila.length >= 8 ? 'bad' : 'warn';
  const noErp = m >= ERP.de && m <= ERP.ate + 15;

  /* Fila: maior valor a cada 5 min. Equipe: média a cada 10 min. Assim o gráfico fica legível sem esconder os picos. */
  const serie = useMemo(() => {
    const porMin = FOTOS.map((x) => {
      const q = x.fila.map(porId);
      const c = { livre: 0, atend: 0, pausa: 0 };
      x.analistas.forEach((a) => { if (a.estado !== 'off') c[a.estado]++; });
      return { m: x.m, tel: q.filter((k) => k.canal === 'Telefone').length, chat: q.filter((k) => k.canal === 'Chat').length, ...c };
    });
    const bloco = (n: number) => Array.from({ length: Math.ceil(porMin.length / n) }, (_, i) => porMin.slice(i * n, i * n + n));
    const fila = bloco(5).map((b) => ({ m: b[0].m, Telefone: Math.max(...b.map((x) => x.tel)), Chat: Math.max(...b.map((x) => x.chat)) }));
    const media = (b: typeof porMin, k: 'livre' | 'atend' | 'pausa') => +(b.reduce((s, x) => s + x[k], 0) / b.length).toFixed(1);
    const equipe = bloco(10).map((b) => ({ m: b[0].m, 'Em atendimento': media(b, 'atend'), Disponíveis: media(b, 'livre'), 'Em pausa': media(b, 'pausa') }));
    return { fila, equipe };
  }, []);
  const intervalos = INTERVALOS.map((x) => ({ ...x, mid: x.de + 15, nsPct: Number.isFinite(x.ns) ? +(x.ns * 100).toFixed(0) : null, Chegadas: x.Telefone + x.Chat, Necessários: x.necessarios, Escalados: x.escalados }));
  const faltas = intervalos.filter((x) => x.Necessários - x.Escalados >= 2);
  const pior = [...faltas].sort((a, b) => b.Necessários - b.Escalados - (a.Necessários - a.Escalados))[0];

  const alertas: Achado[] = [];
  if (noErp) alertas.push({ s: 'bad', titulo: <>Instabilidade no ERP desde <b>{hhmm(ERP.de)}</b>.</>, texto: 'Chamados de Sistemas Corporativos disparam, sobretudo da Fábrica e dos CDs. Vale publicar um aviso no portal e na URA.' });
  if (porCanal.Telefone.n >= 5) alertas.push({ s: 'bad', titulo: <><b>{porCanal.Telefone.n}</b> pessoas esperando no telefone.</>, texto: `A mais antiga espera há ${fSeg(porCanal.Telefone.maior)}. Meta: atender em até 60 s.` });
  else if (porCanal.Telefone.maior > META_ESPERA.Telefone) alertas.push({ s: 'warn', titulo: <>Ligação esperando há <b>{fSeg(porCanal.Telefone.maior)}</b>.</>, texto: 'Acima da meta de 60 s.' });
  if (porCanal.Chat.maior > META_ESPERA.Chat) alertas.push({ s: 'warn', titulo: <>Chat esperando há <b>{fSeg(porCanal.Chat.maior)}</b>.</>, texto: 'Acima da meta de 2 min.' });
  atrasadas.forEach(({ i, e }) => alertas.push({ s: 'warn', titulo: <><b>{EQUIPE[i].nome}</b> está em {e.txt.toLowerCase()} há {nf(0).format(e.min)} min.</>, texto: `O previsto era ${f.analistas[i].prevista} min.` }));
  if (fila.length && cont.livre === 0 && cont.pausa >= 2) alertas.push({ s: 'warn', titulo: <>Fila com <b>{cont.pausa}</b> analistas em pausa ao mesmo tempo.</>, texto: 'Avaliar adiar a próxima pausa até a fila baixar.' });

  const titulo = fila.length === 0
    ? `Fila zerada às ${hhmm(m)}: ${cont.livre} ${cont.livre === 1 ? 'analista disponível' : 'analistas disponíveis'} de ${logados} no turno.`
    : `${fila.length} ${fila.length === 1 ? 'pessoa esperando' : 'pessoas esperando'} às ${hhmm(m)}, a mais antiga há ${fSeg(maior)}.`;

  return (
    <>
      <Card className="relogio">
        <div className="relogio-topo">
          <div className="relogio-hora">
            <span className="ao-vivo"><Radio size={14} aria-hidden /> Simulação de um dia útil</span>
            <strong>{hhmm(m)}</strong>
            <span className="fraco">{DIA_TXT}</span>
          </div>
          <div className="relogio-acoes">
            <button type="button" className="btn prim" onClick={() => { if (m >= FIM) setM(INICIO); setRodando((r) => !r); }}>
              {rodando ? <><Pause size={15} aria-hidden /> Pausar</> : <><Play size={15} aria-hidden /> Reproduzir o dia</>}
            </button>
            <Segmentado<'1' | '5'> rotulo="Velocidade" valor={vel} onChange={setVel} opcoes={[['1', '1 min por passo'], ['5', '5 min por passo']]} />
          </div>
        </div>
        <input type="range" className="linha-tempo" min={INICIO} max={FIM} step={1} value={m} onChange={(e) => { setRodando(false); setM(+e.target.value); }} aria-label="Horário do dia" />
        <div className="marcos">
          <Clock size={14} aria-hidden /> Ir para:
          {MARCOS.map(([v, l]) => <button key={v} type="button" className="sug" onClick={() => { setRodando(false); setM(v); }}>{hhmm(v)} · {l}</button>)}
          <a className="sug destaque" href="#simulador" onClick={(e) => { e.preventDefault(); document.getElementById('simulador')?.scrollIntoView({ behavior: 'smooth' }); }}>Testar outra escala ↓</a>
        </div>
      </Card>

      <Manchete
        status={stFila}
        titulo={titulo}
        texto={fila.length
          ? <>{porCanal.Telefone.n} no telefone e {porCanal.Chat.n} no chat. A maior fila vem de <b>{topUni.u}</b>. Agora há {cont.livre} disponíveis, {cont.atend} em atendimento e {cont.pausa} em pausa.</>
          : <>No dia até agora: {fN(acc.recebidos)} contatos, {fP(acc.ns, 0)} atendidos no prazo e {fP(acc.abandono, 1)} de abandono.</>}
        achados={alertas.length ? alertas : undefined}
      />

      <Kpis itens={[
        { label: 'Na fila agora', tip: 'Pessoas esperando atendimento neste minuto, no telefone e no chat.', value: fN(fila.length), target: `${porCanal.Telefone.n} telefone · ${porCanal.Chat.n} chat`, status: stFila },
        { label: 'Maior espera', tip: 'Há quanto tempo a pessoa mais antiga da fila está esperando agora. Meta: 60 s no telefone e 2 min no chat. TME: espera média dos atendidos no dia.', value: fila.length ? fSeg(maior) : '—', target: `TME hoje ${Number.isFinite(acc.tme) ? fSeg(acc.tme) : '—'}`, status: fila.length === 0 ? 'ok' : maior > META_ESPERA.Telefone ? 'bad' : 'ok' },
        { label: 'Analistas disponíveis', tip: 'Logados e livres para atender agora.', value: `${cont.livre} de ${logados}`, target: `${cont.atend} em atendimento · ${cont.pausa} em pausa`, status: cont.livre > 0 ? 'ok' : fila.length ? 'bad' : 'warn' },
        { label: 'Nível de serviço hoje', tip: 'Contatos atendidos dentro da meta de espera, sobre atendidos e abandonados, do início do dia até agora.', value: fN(acc.ns * 100, 0), unit: '%', target: 'Meta ≥ 80%', status: statusOf(acc.ns, META_NS, true, 0.06) },
        { label: 'Abandono hoje', tip: 'Pessoas que desistiram antes de serem atendidas.', value: fN(acc.abandono * 100, 1), unit: '%', target: `${fN(acc.abandonados)} de ${fN(acc.recebidos)} · meta ≤ 5%`, status: statusOf(acc.abandono, META_ABANDONO, false, 0.4) },
      ]} />

      <div className="grade g-7-5">
        <Card titulo="Analistas agora" sub="Estado de cada pessoa do N1 neste minuto e há quanto tempo está nele. Em vermelho, pausas acima do previsto.">
          <div className="analistas">
            {f.analistas.map((a, i) => {
              const e = estadoDe(a, m), c = a.contato ? porId(a.contato) : null;
              return (
                <div key={i} className={`agente ${a.estado}${e.passou ? ' passou' : ''}`}>
                  <div className="ag-topo"><b>{EQUIPE[i].nome}</b><Pill status={e.status}>{e.txt}</Pill></div>
                  <div className="ag-det">
                    {a.estado === 'off'
                      ? <>Turno {hhmm(EQUIPE[i].entrada)}–{hhmm(EQUIPE[i].saida)}</>
                      : <>há {nf(0).format(e.min)} min{a.estado === 'pausa' ? ` · previsto ${a.prevista} min` : ''}{c ? ` · ${c.canal} · ${UNIDADES[c.unidade]}` : ''}</>}
                  </div>
                  {c ? <div className="ag-assunto">{c.assunto}</div> : null}
                </div>
              );
            })}
          </div>
        </Card>
        <Card titulo="Onde está a fila" sub="Pessoas esperando agora por unidade de origem e canal.">
          {fila.length ? (
            <>
              <div className="tabela-wrap">
                <table>
                  <thead><tr><th>Unidade</th><th className="n">Telefone</th><th className="n">Chat</th><th className="n">Maior espera</th></tr></thead>
                  <tbody>
                    {porUnidade.filter((x) => x.tel + x.chat > 0).map((x) => (
                      <tr key={x.u}><td><b>{x.u}</b></td><td className="n">{x.tel || '—'}</td><td className="n">{x.chat || '—'}</td>
                        <td className="n"><Pill status={x.maior > 180 ? 'bad' : x.maior > 60 ? 'warn' : 'ok'}>{fSeg(x.maior)}</Pill></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 className="sub-h">Próximos a serem atendidos</h4>
              <ol className="proximos">
                {[...fila].sort((a, b) => (a.canal === b.canal ? a.chegada - b.chegada : a.canal === 'Telefone' ? -1 : 1)).slice(0, 6).map((c) => (
                  <li key={c.id}><span className="mono">{c.canal === 'Telefone' ? 'TEL' : 'CHAT'}</span><span>{UNIDADES[c.unidade]} · {c.assunto}</span><b>{fSeg(esperaDe(c))}</b></li>
                ))}
              </ol>
            </>
          ) : <p className="vazio">Ninguém esperando neste minuto. Use a linha do tempo ou vá para <b>11:33</b> para ver a fila da instabilidade no ERP.</p>}
        </Card>
      </div>

      <div className="grade g2">
        <Card titulo="Fila ao longo do dia" sub="Maior fila a cada 5 minutos. A faixa marca a instabilidade no ERP; a linha tracejada, o horário escolhido.">
          <Legenda itens={[{ label: 'Telefone', cor: cor.c1 }, { label: 'Chat', cor: cor.c2 }, { label: 'Agora', tipo: 'tracejado' }]} />
          <Grafico rotulo="Fila por minuto" altura={250}>
            <AreaChart data={serie.fila} margin={margem}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="m" type="number" domain={[INICIO, FIM]} ticks={ticksHora} tickFormatter={(v) => `${Math.floor(v / 60)}h`} {...eixoX} />
              <YAxis {...eixoY} allowDecimals={false} />
              <ReferenceArea x1={ERP.de} x2={ERP.ate} fill={cor.bad} fillOpacity={0.08} />
              <Tooltip content={tt((v) => fN(v), { titulo: (l) => `${hhmm(Number(l))}–${hhmm(Number(l) + 5)}` })} />
              <Area dataKey="Telefone" stackId="f" stroke={cor.c1} fill={cor.c1} fillOpacity={0.35} isAnimationActive={false} type="monotone" />
              <Area dataKey="Chat" stackId="f" stroke={cor.c2} fill={cor.c2} fillOpacity={0.35} isAnimationActive={false} type="monotone" />
              <ReferenceLine x={m} stroke={cor.ink} strokeDasharray="4 3" />
            </AreaChart>
          </Grafico>
        </Card>
        <Card titulo="Como a equipe usou o tempo" sub="Média de analistas em cada estado a cada 10 minutos, entre os que estão no turno.">
          <Legenda itens={[{ label: 'Em atendimento', cor: cor.c1 }, { label: 'Disponíveis', cor: cor.good }, { label: 'Em pausa', cor: cor.warn }]} />
          <Grafico rotulo="Analistas por estado ao longo do dia" altura={250}>
            <AreaChart data={serie.equipe} margin={margem}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="m" type="number" domain={[INICIO, FIM]} ticks={ticksHora} tickFormatter={(v) => `${Math.floor(v / 60)}h`} {...eixoX} />
              <YAxis {...eixoY} allowDecimals={false} domain={[0, 8]} />
              <Tooltip content={tt((v) => nf(1).format(v), { titulo: (l) => `${hhmm(Number(l))}–${hhmm(Number(l) + 10)}` })} />
              <Area dataKey="Em atendimento" stackId="e" stroke={cor.c1} fill={cor.c1} fillOpacity={0.5} isAnimationActive={false} type="monotone" />
              <Area dataKey="Disponíveis" stackId="e" stroke={cor.good} fill={cor.good} fillOpacity={0.4} isAnimationActive={false} type="monotone" />
              <Area dataKey="Em pausa" stackId="e" stroke={cor.warn} fill={cor.warn} fillOpacity={0.45} isAnimationActive={false} type="monotone" />
              <ReferenceLine x={m} stroke={cor.ink} strokeDasharray="4 3" />
            </AreaChart>
          </Grafico>
        </Card>
      </div>

      <div className="grade g2">
        <Card titulo="A escala acompanha a demanda?" sub="Por meia hora: analistas necessários para atender 80% em até 60 s (Erlang C), comparados aos escalados (sem contar o almoço).">
          <Legenda itens={[{ label: 'Chegadas', cor: cor['seq-3'] }, { label: 'Necessários', cor: cor.bad, tipo: 'linha' }, { label: 'Escalados', cor: cor.c1, tipo: 'linha' }]} />
          <Grafico rotulo="Chegadas, analistas necessários e escalados por meia hora" altura={260}>
            <ComposedChart data={intervalos} margin={{ ...margem, right: 4 }}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="mid" type="number" domain={[INICIO, FIM]} ticks={ticksHora} tickFormatter={(v) => `${Math.floor(v / 60)}h`} {...eixoX} />
              <YAxis yAxisId="c" {...eixoY} allowDecimals={false} />
              <YAxis yAxisId="a" orientation="right" {...eixoY} width={30} allowDecimals={false} />
              <Tooltip content={tt((v, n) => (n === 'Chegadas' ? `${fN(v)} contatos` : `${fN(v)} analistas`), { titulo: (_l, p) => `${p.rotulo}–${hhmm(Number(p.de) + 30)}` })} />
              <Bar yAxisId="c" dataKey="Chegadas" fill={cor['seq-3']} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              <Line yAxisId="a" dataKey="Necessários" stroke={cor.bad} strokeWidth={2.4} dot={{ r: 2.5, fill: cor.bad }} type="stepAfter" isAnimationActive={false} />
              <Line yAxisId="a" dataKey="Escalados" stroke={cor.c1} strokeWidth={2.4} dot={{ r: 2.5, fill: cor.c1 }} type="stepAfter" isAnimationActive={false} />
              <ReferenceLine yAxisId="c" x={m} stroke={cor.ink} strokeDasharray="4 3" />
            </ComposedChart>
          </Grafico>
          {pior ? <p className="nota-grafico">Maior falta às <b>{pior.rotulo}</b>: {pior.Necessários} analistas necessários e {pior.Escalados} escalados. Teste outra distribuição no simulador no fim da página.</p> : null}
        </Card>
        <Card titulo="Nível de serviço por meia hora" sub="Contatos atendidos dentro da meta de espera. Abaixo de 80%, a barra fica vermelha.">
          <Legenda itens={[{ label: 'Na meta', cor: cor.good }, { label: 'Abaixo da meta', cor: cor.bad }, { label: 'Meta 80%', tipo: 'tracejado' }]} />
          <Grafico rotulo="Nível de serviço por meia hora" altura={260}>
            <ComposedChart data={intervalos} margin={margem}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="mid" type="number" domain={[INICIO, FIM]} ticks={ticksHora} tickFormatter={(v) => `${Math.floor(v / 60)}h`} {...eixoX} />
              <YAxis {...eixoY} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`} />
              <ReferenceLine y={80} stroke={cor['ink-2']} strokeDasharray="5 4" />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v, _n, p) => `${fN(v)}% · abandono ${fP(Number(p.abandono), 0)}`, { titulo: (_l, p) => `${p.rotulo}–${hhmm(Number(p.de) + 30)}` })} />
              <Bar dataKey="nsPct" name="Nível de serviço" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                {intervalos.map((x) => <Cell key={x.de} fill={(x.nsPct ?? 100) < 80 ? cor.bad : cor.good} fillOpacity={x.de <= m ? 1 : 0.3} />)}
              </Bar>
              <ReferenceLine x={m} stroke={cor.ink} strokeDasharray="4 3" />
            </ComposedChart>
          </Grafico>
        </Card>
      </div>

      <div id="simulador"><SimuladorEscala /></div>

      <Card titulo="Telefone e chat no dia até agora" sub={`Do início do turno até ${hhmm(m)}.`}>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Canal</th><th className="n">Recebidos</th><th className="n">Atendidos</th><th className="n">Abandonados</th><th className="n">Nível de serviço</th><th className="n">Espera média</th><th className="n">Atendimento médio</th></tr></thead>
            <tbody>
              {([['Telefone', tel, 'meta 60 s'], ['Chat', chat, 'meta 2 min']] as const).map(([c, k, meta]) => (
                <tr key={c}>
                  <td><b>{c}</b><br /><span className="fraco">{meta}</span></td>
                  <td className="n">{fN(k.recebidos)}</td><td className="n">{fN(k.atendidos)}</td>
                  <td className="n"><Pill status={statusOf(k.abandono, META_ABANDONO, false, 0.4)}>{fN(k.abandonados)} · {fP(k.abandono, 0)}</Pill></td>
                  <td className="n"><Pill status={statusOf(k.ns, META_NS, true, 0.06)}>{fP(k.ns, 0)}</Pill></td>
                  <td className="n">{Number.isFinite(k.tme) ? fSeg(k.tme) : '—'}</td><td className="n">{Number.isFinite(k.tma) ? fSeg(k.tma) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
