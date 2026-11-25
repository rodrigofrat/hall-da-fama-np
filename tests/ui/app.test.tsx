import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { DemoData } from '../../src/data/demo';

// Injeta a fonte de demonstração (não depende de variáveis de ambiente)
vi.mock('../../src/app/auth', () => ({
  useAuth: () => ({ mode: 'demo', data: (globalThis as any).__data, signOut: vi.fn(), email: null }),
  loadDemo: () => import('../../src/data/demo'),
}));

import { DataProvider } from '../../src/app/data';
import { CouponsPage } from '../../src/pages/Coupons';
import { GiftsPage } from '../../src/pages/Gifts';
import { PipPage } from '../../src/pages/Pip';
import { HomePage } from '../../src/pages/Home';

function renderAs(id: string, path: string, el: React.ReactNode) {
  (globalThis as any).__data = new DemoData(id);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DataProvider><Routes><Route path="*" element={el} /></Routes></DataProvider>
    </MemoryRouter>,
  );
}

describe('telas (dados fictícios)', () => {
  it('início: saldo parcial, posição com empate e sorteio sem dia', async () => {
    renderAs('demo_0001', '/', <HomePage />);
    expect(await screen.findByText('Seus cupons')).toBeInTheDocument();
    expect(await screen.findByText('4º (empate)')).toBeInTheDocument();
    expect(await screen.findByText('Próximo sorteio previsto para janeiro de 2027 · dia a confirmar')).toBeInTheDocument();
    expect(screen.getByText(/Último mês fechado/)).toBeInTheDocument();
    expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument();
  });

  it('ranking: busca com @ e maiúsculas, linha própria destacada', async () => {
    renderAs('demo_0001', '/cupons/ranking', <CouponsPage tab="ranking" />);
    const list = await screen.findByRole('list', { name: 'Classificação' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    await userEvent.type(screen.getByLabelText('Buscar por @'), '@NINA');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('@nina.demo')).toBeInTheDocument();
  });

  it('comparação: faltam X para igualar e Y para ultrapassar', async () => {
    renderAs('demo_0001', '/cupons/comparar?com=nina.demo', <CouponsPage tab="comparar" />);
    await waitFor(() => expect(document.body).toHaveTextContent('Faltam 1 cupom para igualar e 2 cupons para ultrapassar'));
  });

  it('PIP: metas exibidas, sem progresso nem diamantes individuais', async () => {
    renderAs('demo_0008', '/conta/pip', <PipPage />);
    expect(await screen.findByText('Em recuperação')).toBeInTheDocument();
    expect(screen.getByText('500.000')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('presentes: recebido (data real) e previsão nunca trocados', async () => {
    renderAs('demo_0009', '/conta/presentes', <GiftsPage />);
    expect((await screen.findAllByText('Recebido em 10 de abril de 2026')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Previsão: 10 de abril/)).not.toBeInTheDocument();
    expect(screen.getByText('Previsão: 20 de janeiro de 2027')).toBeInTheDocument();
  });

  it('presentes: boas-vindas pendente mostra "Ainda sem entrega registrada"', async () => {
    renderAs('demo_0007', '/conta/presentes', <GiftsPage />);
    expect((await screen.findAllByText('Ainda sem entrega registrada.')).length).toBeGreaterThan(0);
  });
});
