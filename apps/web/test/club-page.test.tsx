import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClubNotFound from '@/app/club/[tag]/not-found';
import { InvalidTag } from '@/components/player/InvalidTag';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe('página de club', () => {
  it('InvalidTag de club ofrece buscar un club', () => {
    render(<InvalidTag target="club" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tag inválido' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tag del club')).toBeInTheDocument();
  });

  it('el 404 del club explica y ofrece buscar otro club', () => {
    render(<ClubNotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos ese club' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tag del club')).toBeInTheDocument();
  });
});
