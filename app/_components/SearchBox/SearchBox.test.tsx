// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from './SearchBox';

describe('SearchBox Component', () => {
  const mockTagList = ['react', 'nextjs', 'typescript'];

  // Clean up the DOM after each test so components don't accumulate
  afterEach(() => {
    cleanup();
  });

  it('renders the search box with placeholder', () => {
    render(<SearchBox tagList={mockTagList} />);
    const input = screen.getByPlaceholderText('Input a tag...');
    expect(input).toBeInTheDocument();
  });

  it('adds a valid tag when space is pressed and clears the input', async () => {
    const user = userEvent.setup();
    render(<SearchBox tagList={mockTagList} />);

    const input = screen.getByPlaceholderText('Input a tag...');

    // Type a valid tag and hit space
    await user.type(input, 'react ');

    // Check that the tag pill appears and input is cleared
    const tagPill = screen.getByText('react');
    expect(tagPill).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('does not add a tag if it is not in the allowed tagList', async () => {
    const user = userEvent.setup();
    render(<SearchBox tagList={mockTagList} />);

    const input = screen.getByPlaceholderText('Input a tag...');

    // Type an invalid tag and hit space
    await user.type(input, 'python ');

    // Ensure it was not added as a pill
    const tagPill = screen.queryByText('python');
    expect(tagPill).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('removes a tag when the remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchBox tagList={mockTagList} />);

    const input = screen.getByPlaceholderText('Input a tag...');

    // Add a tag
    await user.type(input, 'typescript ');
    expect(screen.getByText('typescript')).toBeInTheDocument();

    // Click the remove button ('×')
    const removeBtn = screen.getByRole('button', { name: /remove typescript tag/i });
    await user.click(removeBtn);

    // Verify tag is removed
    expect(screen.queryByText('typescript')).not.toBeInTheDocument();
  });

  it('removes the last tag when Backspace is pressed on an empty input', async () => {
    const user = userEvent.setup();
    render(<SearchBox tagList={mockTagList} />);

    const input = screen.getByPlaceholderText('Input a tag...');

    // Add two tags
    await user.type(input, 'react ');
    await user.type(input, 'nextjs ');
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('nextjs')).toBeInTheDocument();

    // Press Backspace once when input is empty
    await user.keyboard('{Backspace}');

    // The last tag ('nextjs') should be removed, but 'react' should remain
    expect(screen.queryByText('nextjs')).not.toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
  });
});
