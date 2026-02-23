import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app title', () => {
  render(<App />);
  const titleElement = screen.getByText(/AI 工作流编辑器/i);
  expect(titleElement).toBeInTheDocument();
});
