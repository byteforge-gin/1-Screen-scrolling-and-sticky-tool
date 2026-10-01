import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders application title', () => {
    render(<App />);
    expect(screen.getByText('屏幕字幕与便签工具')).toBeInTheDocument();
  });
});
