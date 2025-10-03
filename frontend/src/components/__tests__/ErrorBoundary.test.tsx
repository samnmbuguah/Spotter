import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  // Mock console.error to avoid error logs in test output
  const originalError = console.error;
  
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child Component</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Child Component')).toBeInTheDocument();
  });

  it('renders error UI when there is an error', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Error details')).toBeInTheDocument();
  });

  it('shows error details when clicked', () => {
    const testError = new Error('Test error');
    const ErrorComponent = () => {
      throw testError;
    };

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    const detailsButton = screen.getByText('Error details');
    detailsButton.click();
    
    expect(screen.getByText(testError.toString())).toBeInTheDocument();
  });
});
