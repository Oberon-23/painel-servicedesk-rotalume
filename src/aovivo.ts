/* Operação ao vivo: simulação minuto a minuto de um dia útil da central (telefone e chat) do N1. */
import { CATS } from './dados';
import { rng } from './kit/rng';

const R = rng(30102026);
const { r: rnd, n: randn, pickW, poisson } = R;

export const INICIO = 7 * 60, FIM = 19 * 60;            // minutos do dia
export const DIA_TXT = 'sexta-feira, 30/10/2026, último dia útil da base';
export const CANAIS_AO_VIVO = ['Telefone', 'Chat'] as const;
export type CanalAV = (typeof CANAIS_AO_VIVO)[number];
export const META_ESPERA: Record<CanalAV, number> = { Telefone: 60, Chat: 120 };   // segundos
export const META_NS = 0.8, META_ABANDONO = 0.05;
export const UNIDADES = ['Sede (Rio)', 'Fábrica Campos', 'CD Campinas', 'CD Recife', 'Escritório SP'];
const UNI_W = [0.3, 0.25, 0.18, 0.12, 0.15];
export const ERP = { de: 11 * 60 + 15, ate: 11 * 60 + 45 };   // instabilidade do ERP

export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
export const fSeg = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`);

/* ---------- contatos do dia ---------- */
export type Contato = {
  id: number; canal: CanalAV; chegada: number; unidade: number; assunto: string; aht: number; paciencia: number;
  atendido?: number; fim?: number; abandono?: number; analista?: number;
};
const PESO_HORA = [0, 0, 0, 0, 0, 0, 0, 0.45, 1.5, 2.0, 1.7, 1.3, 0.75, 1.15, 1.45, 1.3, 1.0, 0.65, 0.3, 0];
const TOTAL = { Telefone: 185, Chat: 115 };
const somaPeso = PESO_HORA.reduce((a, b) => a + b, 0);

export const CONTATOS: Contato[] = [];
for (let m = INICIO; m < FIM; m++) {
  const w = PESO_HORA[Math.floor(m / 60)] / 60 / somaPeso;
  const noErp = m >= ERP.de && m < ERP.ate;
  for (const canal of CANAIS_AO_VIVO) {
    const lam = TOTAL[canal] * w * (noErp ? (canal === 'Telefone' ? 4.2 : 2.2) : 1);
    const n = poisson(lam);
    for (let k = 0; k < n; k++) {
      const erpCaso = noErp && rnd() < 0.7;
      const unidade = erpCaso ? pickW([0.1, 0.4, 0.3, 0.2, 0]) : pickW(UNI_W);
      const assunto = erpCaso ? 'Sistemas Corporativos' : CATS[pickW(CATS.map((c) => c[1]))][0];
      const base = canal === 'Telefone' ? 6.5 : 8.5;
      CONTATOS.push({
        id: 0, canal, chegada: m * 60 + Math.floor(rnd() * 60), unidade, assunto,
        aht: Math.max(60, base * 60 * Math.exp(randn() * 0.45) * (erpCaso ? 0.7 : 1)),
        paciencia: (canal === 'Telefone' ? 7 : 14) * 60 * -Math.log(1 - rnd() * 0.999),
      });
    }
  }
}
CONTATOS.sort((a, b) => a.chegada - b.chegada).forEach((c, i) => (c.id = i + 1));

/* ---------- escala do N1 ---------- */
export type TipoPausa = 'Pausa curta' | 'Almoço' | 'Treinamento' | 'Pausa pessoal';
type Pausa = { tipo: TipoPausa; prevista: number; dur: number; real: number };   // prevista: minuto; dur: previsto (min); real: duração real (min)
export type Analista = { id: number; nome: string; entrada: number; saida: number; pausas: Pausa[] };
export const NOMES = ['Ana Ribeiro', 'Bruno Lima', 'Carla Mendes', 'Diego Souza', 'Elisa Prado', 'Fábio Costa', 'Gabriela Nunes', 'Hugo Martins'];
export const ENTRADAS = [7, 7, 8, 8, 8, 9, 10, 10];                 // escala real do dia (hora de entrada)
export const JORNADA = 9 * 60;                                       // 8 h de trabalho + 1 h de almoço
const EXTRAS = NOMES.map(() => [0, 0, 0].map(() => Math.round(rnd() * 4)));   // minutos a mais em cada pausa, sorteados uma vez

/** Monta a escala de um analista a partir da hora de entrada (pausas acompanham o turno, o treinamento é fixo às 14h). */
export function montarEquipe(entradas: number[]): Analista[] {
  return entradas.map((h, id) => {
    const nome = NOMES[id] ?? `Reforço ${id - NOMES.length + 1}`;
    const e = h * 60, x = EXTRAS[id] ?? [2, 2, 2];
    const pausas: Pausa[] = [
      { tipo: 'Pausa curta', prevista: e + 120 + (id % 2) * 15, dur: 10, real: 10 + x[0] },
      { tipo: 'Almoço', prevista: e + 240 + (id % 2) * 30, dur: 60, real: 60 + x[1] + (id === 5 ? 17 : 0) },
      { tipo: 'Pausa curta', prevista: e + 390 + (id % 2) * 15, dur: 10, real: 10 + x[2] + (id === 3 ? 9 : 0) },
    ];
    if (id === 6) pausas.push({ tipo: 'Treinamento', prevista: 14 * 60, dur: 60, real: 60 });
    if (id === 2) pausas.push({ tipo: 'Pausa pessoal', prevista: 15 * 60 + 40, dur: 5, real: 7 });
    pausas.sort((a, b) => a.prevista - b.prevista);
    return { id, nome, entrada: e, saida: e + JORNADA, pausas };
  });
}
export const EQUIPE = montarEquipe(ENTRADAS);

/* ---------- simulação (passo de 10 s, foto a cada minuto) ---------- */
export type Estado = 'off' | 'livre' | 'atend' | 'pausa';
export type FotoAnalista = { estado: Estado; desde: number; contato?: number; pausa?: TipoPausa; prevista?: number };
export type Foto = { m: number; analistas: FotoAnalista[]; fila: number[] };
/** Regra da fila: telefone primeiro, mas um chat que já espera 3 minutos passa na frente. */
export const TETO_CHAT = 180;
export type Desfecho = { atendido?: number; fim?: number; abandono?: number; analista?: number };
export type Simulacao = { equipe: Analista[]; desfechos: Desfecho[]; fotos: Foto[] };

export function simular(entradas: number[], comFotos = true): Simulacao {
  const equipe = montarEquipe(entradas);
  const desf: Desfecho[] = CONTATOS.map(() => ({}));
  type Vivo = { estado: Estado; desde: number; contato?: number; ate?: number; pausa?: Pausa; idx: number };
  const vivos: Vivo[] = equipe.map(() => ({ estado: 'off', desde: INICIO * 60, idx: 0 }));
  const fila: Contato[] = [], fotos: Foto[] = [];
  let prox = 0;
  for (let t = INICIO * 60; t <= FIM * 60; t += 10) {
    while (prox < CONTATOS.length && CONTATOS[prox].chegada <= t) fila.push(CONTATOS[prox++]);
    for (let i = fila.length - 1; i >= 0; i--) if (fila[i].chegada + fila[i].paciencia <= t) { desf[fila[i].id - 1].abandono = fila[i].chegada + fila[i].paciencia; fila.splice(i, 1); }
    equipe.forEach((a, i) => {
      const v = vivos[i], min = t / 60;
      if (v.estado === 'atend' && v.ate! <= t) { v.estado = 'livre'; v.desde = v.ate!; v.contato = undefined; }
      if (v.estado === 'pausa' && v.ate! <= t) { v.estado = 'livre'; v.desde = v.ate!; v.pausa = undefined; }
      if (v.estado === 'off' && min >= a.entrada && min < a.saida) { v.estado = 'livre'; v.desde = a.entrada * 60; }
      if (v.estado === 'livre') {
        const p = a.pausas[v.idx];
        if (p && min >= p.prevista) { v.estado = 'pausa'; v.desde = t; v.pausa = p; v.ate = t + p.real * 60; v.idx++; }
        else if (min >= a.saida) { v.estado = 'off'; v.desde = t; }
      }
    });
    const livres = vivos.map((v, i) => ({ v, i })).filter((x) => x.v.estado === 'livre').sort((x, y) => x.v.desde - y.v.desde);
    for (const { v, i } of livres) {
      if (!fila.length) break;
      const chatVelho = fila.findIndex((c) => c.canal === 'Chat' && t - c.chegada >= TETO_CHAT);
      const tel = fila.findIndex((c) => c.canal === 'Telefone');
      const k = chatVelho >= 0 ? chatVelho : tel >= 0 ? tel : 0;
      const c = fila.splice(k, 1)[0], d = desf[c.id - 1];
      d.atendido = t; d.fim = t + c.aht; d.analista = i;
      v.estado = 'atend'; v.desde = t; v.contato = c.id; v.ate = d.fim;
    }
    if (comFotos && t % 60 === 0) {
      fotos.push({
        m: t / 60,
        analistas: vivos.map((v) => ({ estado: v.estado, desde: v.desde, contato: v.contato, pausa: v.pausa?.tipo, prevista: v.pausa?.dur })),
        fila: fila.map((c) => c.id),
      });
    }
  }
  return { equipe, desfechos: desf, fotos };
}

/* ---------- o dia real ---------- */
const REAL = simular(ENTRADAS);
REAL.desfechos.forEach((d, i) => Object.assign(CONTATOS[i], d));
export const FOTOS = REAL.fotos;
export const porId = (id: number) => CONTATOS[id - 1];
export const foto = (m: number) => FOTOS[Math.max(0, Math.min(FOTOS.length - 1, Math.round(m) - INICIO))];

/* ---------- indicadores acumulados até um minuto ---------- */
export function acumulado(m: number, canal?: CanalAV, desf?: Desfecho[]) {
  const t = m * 60;
  const cs = CONTATOS.filter((c) => c.chegada <= t && (!canal || c.canal === canal)).map((c) => ({ c, d: desf ? desf[c.id - 1] : c }));
  const atend = cs.filter((x) => x.d.atendido != null && x.d.atendido <= t);
  const aband = cs.filter((x) => x.d.abandono != null && x.d.abandono <= t);
  const resolvidos = atend.length + aband.length;
  const noPrazo = atend.filter((x) => x.d.atendido! - x.c.chegada <= META_ESPERA[x.c.canal]).length;
  const finalizados = atend.filter((x) => x.d.fim! <= t);
  return {
    recebidos: cs.length, atendidos: atend.length, abandonados: aband.length,
    ns: resolvidos ? noPrazo / resolvidos : NaN,
    abandono: resolvidos ? aband.length / resolvidos : NaN,
    tme: atend.length ? atend.reduce((s, x) => s + (x.d.atendido! - x.c.chegada), 0) / atend.length : NaN,
    tma: finalizados.length ? finalizados.reduce((s, x) => s + x.c.aht, 0) / finalizados.length : NaN,
  };
}

/* ---------- dimensionamento por meia hora (Erlang C) ---------- */
export function erlangC(n: number, a: number) {
  if (n <= a) return 1;
  let soma = 0, termo = 1;
  for (let k = 0; k < n; k++) { if (k > 0) termo *= a / k; soma += termo; }
  const top = termo * (a / n) * (n / (n - a));
  return top / (soma + top);
}
export function necessarios(chamadas: number, aht: number, alvo = 60, meta = META_NS) {
  if (chamadas <= 0) return 0;
  const a = (chamadas * aht) / 1800;
  for (let n = Math.max(1, Math.ceil(a)); n < 60; n++) {
    const ns = 1 - erlangC(n, a) * Math.exp(-(n - a) * (alvo / aht));
    if (ns >= meta) return n;
  }
  return 60;
}
/* ---------- por meia hora: chegadas, nível de serviço e escala ---------- */
export function intervalos(sim: Simulacao) {
  return Array.from({ length: (FIM - INICIO) / 30 }, (_, i) => {
    const de = INICIO + i * 30, ate = de + 30;
    const cs = CONTATOS.filter((c) => c.chegada >= de * 60 && c.chegada < ate * 60);
    const ds = cs.map((c) => sim.desfechos[c.id - 1]);
    const aht = cs.length ? cs.reduce((s, c) => s + c.aht, 0) / cs.length : 420;
    const resolvidos = ds.filter((d) => d.atendido != null || d.abandono != null).length;
    const noPrazo = cs.filter((c, k) => ds[k].atendido != null && ds[k].atendido! - c.chegada <= META_ESPERA[c.canal]).length;
    const meio = de + 15;
    const escalados = sim.equipe.filter((a) => meio >= a.entrada && meio < a.saida && !a.pausas.some((p) => (p.tipo === 'Almoço' || p.tipo === 'Treinamento') && meio >= p.prevista && meio < p.prevista + p.dur)).length;
    return {
      de, rotulo: hhmm(de), Telefone: cs.filter((c) => c.canal === 'Telefone').length, Chat: cs.filter((c) => c.canal === 'Chat').length,
      necessarios: necessarios(cs.length, aht), escalados,
      ns: resolvidos ? noPrazo / resolvidos : NaN,
      abandono: resolvidos ? ds.filter((d) => d.abandono != null).length / resolvidos : NaN,
    };
  });
}
export const INTERVALOS = intervalos(REAL);

/* ---------- "e se": resultado do dia para uma escala qualquer ---------- */
export function resumoDia(entradas: number[]) {
  const sim = simular(entradas, false);
  const a = acumulado(FIM, undefined, sim.desfechos);
  const iv = intervalos(sim);
  // nível de serviço sem os contatos que chegaram durante a instabilidade do ERP (e nos 15 min seguintes)
  const fora = CONTATOS.filter((c) => c.chegada < ERP.de * 60 || c.chegada >= (ERP.ate + 15) * 60);
  const fd = fora.map((c) => sim.desfechos[c.id - 1]);
  const res = fd.filter((d) => d.atendido != null || d.abandono != null).length;
  const nsSemErp = res ? fora.filter((c, k) => fd[k].atendido != null && fd[k].atendido! - c.chegada <= META_ESPERA[c.canal]).length / res : NaN;
  return { sim, ...a, nsSemErp, intervalos: iv, faltas: iv.filter((x) => x.necessarios - x.escalados >= 2).length };
}
/** Procura, analista por analista, a hora de entrada (7h a 10h) que mais melhora o nível de serviço do dia, sem mudar o tamanho da equipe. */
export function sugerirEscala(base = ENTRADAS) {
  const nota = (e: number[]) => { const r = resumoDia(e); return r.ns - r.abandono; };
  let melhor = [...base], valor = nota(melhor);
  for (let volta = 0; volta < 2; volta++) {
    let mudou = false;
    for (let i = 0; i < melhor.length; i++) {
      for (const h of [7, 8, 9, 10]) {
        if (h === melhor[i]) continue;
        const teste = [...melhor]; teste[i] = h;
        if (!teste.some((x) => x <= 7) || !teste.some((x) => x >= 10)) continue;   // a central abre às 7h e fecha às 19h
        const v = nota(teste);
        if (v > valor + 1e-9) { melhor = teste; valor = v; mudou = true; }
      }
    }
    if (!mudou) break;
  }
  return melhor;
}
