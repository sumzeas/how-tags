// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HomeContent } from './HomeContent';

describe('HomeContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('explains what HowTags is for', () => {
    render(<HomeContent />);
    expect(screen.getByRole('heading', { name: 'What is HowTags?' })).toBeInTheDocument();
    expect(screen.getByText(/wiki of tutorials and how-tos/)).toBeInTheDocument();
  });

  it('explains how to contribute, with a link to sign up', () => {
    render(<HomeContent />);
    expect(screen.getByRole('heading', { name: 'How to contribute' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/sign-up');
  });

  it('links to search', () => {
    render(<HomeContent />);
    expect(screen.getByRole('link', { name: 'Start searching' })).toHaveAttribute('href', '/search');
  });
});
