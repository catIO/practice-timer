import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextWithLinks } from './TextWithLinks';

describe('TextWithLinks', () => {
  it('renders markdown links properly', () => {
    render(<TextWithLinks text="Check out [Arpeggio Patterns](https://example.com)" />);
    const link = screen.getByRole('link', { name: 'Arpeggio Patterns' });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('https://example.com');
  });

  it('renders shortcode pills such as [NEW] and [!]', () => {
    const { container } = render(<TextWithLinks text="[NEW] [!] Practice item" />);
    expect(container.textContent).toContain('NEW');
    expect(container.textContent).toContain('!');
    expect(container.textContent).toContain('Practice item');
  });

  it('renders [NEW] touching a markdown link [NEW][Link](url) with separation', () => {
    const { container } = render(
      <TextWithLinks text="[NEW][Arpeggio Patterns Level 3](https://example.com)" />
    );
    const pill = screen.getByText('NEW');
    expect(pill).toBeInTheDocument();
    expect(pill.className).toContain('bg-amber-500');
    expect(pill.className).toContain('mr-1.5');

    const link = screen.getByRole('link', { name: 'Arpeggio Patterns Level 3' });
    expect(link).toBeInTheDocument();
  });

  it('renders red style for [!] shortcode', () => {
    render(<TextWithLinks text="[!] Urgent item" />);
    const pill = screen.getByText('!');
    expect(pill.className).toContain('bg-red-500');
    expect(pill.className).toContain('mr-1.5');
  });
});
