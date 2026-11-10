import { describe, expect, test } from 'vitest';
import { CONTATOS, EQUIPE, erlangC, FOTOS, FIM, INICIO, necessarios } from './aovivo';

describe('Erlang C', () => {
  test('valor de referência: 2 erlangs com 3 atendentes', () => {
    expect(erlangC(3, 2)).toBeCloseTo(4 / 9, 4);
  });
  test('mais volume nunca pede menos analistas', () => {
    let antes = 0;
    for (let n = 0; n <= 60; n += 5) { const k = necessarios(n, 420); expect(k).toBeGreaterThanOrEqual(antes); antes = k; }
  });
});

describe('simulação do dia', () => {
  test('uma foto por minuto, das 7h às 19h', () => {
    expect(FOTOS.length).toBe(FIM - INICIO + 1);
  });
  test('todo contato é atendido ou abandona, nunca os dois', () => {
    for (const c of CONTATOS) {
      expect(c.atendido != null && c.abandono != null).toBe(false);
      expect(c.atendido != null || c.abandono != null).toBe(true);
      if (c.atendido != null) expect(c.atendido).toBeGreaterThanOrEqual(c.chegada);
    }
  });
  test('nenhum analista atende dois contatos ao mesmo tempo', () => {
    EQUIPE.forEach((_, i) => {
      const meus = CONTATOS.filter((c) => c.analista === i).sort((a, b) => a.atendido! - b.atendido!);
      for (let k = 1; k < meus.length; k++) expect(meus[k].atendido!).toBeGreaterThanOrEqual(meus[k - 1].fim!);
    });
  });
  test('ninguém atende fora do próprio turno', () => {
    for (const c of CONTATOS.filter((x) => x.analista != null)) {
      const a = EQUIPE[c.analista!];
      expect(c.atendido! / 60).toBeGreaterThanOrEqual(a.entrada);
      expect(c.atendido! / 60).toBeLessThan(a.saida);
    }
  });
});

describe('simulador de escala', () => {
  test('a sugestão mantém o tamanho da equipe e não piora o dia', async () => {
    const { ENTRADAS, resumoDia, sugerirEscala } = await import('./aovivo');
    const s = sugerirEscala();
    expect(s).toHaveLength(ENTRADAS.length);
    const a = resumoDia(ENTRADAS), b = resumoDia(s);
    expect(b.ns - b.abandono).toBeGreaterThanOrEqual(a.ns - a.abandono);
  });
  test('a escala real reproduz o dia mostrado na tela', async () => {
    const { ENTRADAS, resumoDia, acumulado, FIM } = await import('./aovivo');
    expect(resumoDia(ENTRADAS).ns).toBeCloseTo(acumulado(FIM).ns, 10);
  });
});
