import React from 'react';
import { render, screen } from '@testing-library/react';
import HOSStatusCard from '../HOSStatusCard';

describe('HOSStatusCard', () => {
  it('displays title and value correctly', () => {
    render(<HOSStatusCard title="Available Hours" value={45.5} />);
    
    expect(screen.getByText('Available Hours')).toBeInTheDocument();
    expect(screen.getByText('45.5')).toBeInTheDocument();
  });

  it('displays subtitle when provided', () => {
    render(
      <HOSStatusCard 
        title="Available Hours" 
        value={45.5} 
        subtitle="70 hour cycle" 
      />
    );
    
    expect(screen.getByText('70 hour cycle')).toBeInTheDocument();
  });

  it('applies correct status styling', () => {
    const { rerender } = render(
      <HOSStatusCard 
        title="Available Hours" 
        value={45.5} 
        status="good" 
      />
    );
    
    let card = screen.getByText('Available Hours').closest('div');
    expect(card).toHaveClass('bg-green-50');
    
    rerender(
      <HOSStatusCard 
        title="Available Hours" 
        value={45.5} 
        status="warning" 
      />
    );
    
    card = screen.getByText('Available Hours').closest('div');
    expect(card).toHaveClass('bg-yellow-50');
  });

  it('displays correct icon based on icon prop', () => {
    render(
      <HOSStatusCard 
        title="Available Hours" 
        value={45.5} 
        icon="alert" 
      />
    );
    
    // Check that the icon is rendered (AlertCircle icon)
    const card = screen.getByText('Available Hours').closest('div');
    const icon = card?.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});
