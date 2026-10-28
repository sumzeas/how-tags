// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignUpForm } from './SignUpForm';
import { checkCredentials } from './actions';

// Stand-ins for the Server Actions, so no server code loads.
vi.mock('./actions', () => ({
  checkCredentials: vi.fn(async () => ({})),
  createAccount: vi.fn(async () => ({})),
}));

const PASSWORD = 'correct horse battery';

function renderForm() {
  render(<SignUpForm passwordMin={12} passwordMax={128} />);
  return {
    email: screen.getByLabelText('Email'),
    password: screen.getByLabelText('Password'),
    confirm: screen.getByLabelText('Confirm password'),
    show: screen.getByLabelText('Show password'),
  };
}

async function fillIn(confirmValue: string) {
  const user = userEvent.setup();
  const fields = renderForm();
  await user.type(fields.email, 'sam@example.com');
  await user.type(fields.password, PASSWORD);
  await user.type(fields.confirm, confirmValue);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  return fields;
}

describe('SignUpForm Component', () => {
  beforeEach(() => {
    vi.mocked(checkCredentials).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('stops when the passwords do not match, without asking the server', async () => {
    await fillIn('something else entirely');
    expect(await screen.findByRole('alert')).toHaveTextContent("Passwords don't match.");
    expect(checkCredentials).not.toHaveBeenCalled();
  });

  it('never sends the confirm value to the server', async () => {
    await fillIn(PASSWORD);
    expect(checkCredentials).toHaveBeenCalledTimes(1);
    const formData = vi.mocked(checkCredentials).mock.calls[0][0];
    expect([...formData.keys()]).toEqual(['email', 'password']);
  });

  it('moves to the username step when the passwords match', async () => {
    await fillIn(PASSWORD);
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByText('This name will be seen by others.')).toBeInTheDocument();
  });

  it('reveals and hides both password boxes', async () => {
    const user = userEvent.setup();
    const { password, confirm, show } = renderForm();
    expect(password).toHaveAttribute('type', 'password');
    expect(confirm).toHaveAttribute('type', 'password');

    await user.click(show);
    expect(password).toHaveAttribute('type', 'text');
    expect(confirm).toHaveAttribute('type', 'text');

    await user.click(show);
    expect(password).toHaveAttribute('type', 'password');
    expect(confirm).toHaveAttribute('type', 'password');
  });
});
