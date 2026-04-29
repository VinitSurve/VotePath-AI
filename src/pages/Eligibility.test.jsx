import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Eligibility from './Eligibility';
import { BrowserRouter } from 'react-router-dom';

const renderWithRouter = (ui, { route = '/' } = {}) => {
  window.history.pushState({}, 'Test page', route);
  return render(ui, { wrapper: BrowserRouter });
};

describe('Eligibility Checker', () => {
  it('renders correctly', () => {
    renderWithRouter(<Eligibility />);
    expect(screen.getByText('Am I Eligible?')).toBeInTheDocument();
  });

  it('shows error when age is invalid', () => {
    renderWithRouter(<Eligibility />);
    const submitButton = screen.getByText('Check Eligibility');
    fireEvent.click(submitButton);
    expect(screen.getByText('Please enter a valid age.')).toBeInTheDocument();
  });

  it('shows eligible for age >= 18 and citizen', () => {
    renderWithRouter(<Eligibility />);
    
    // Enter age
    const ageInput = screen.getByLabelText(/What is your age?/i);
    fireEvent.change(ageInput, { target: { value: '20' } });
    
    // Select Citizen
    const yesButton = screen.getByText('Yes');
    fireEvent.click(yesButton);
    
    // Submit
    const submitButton = screen.getByText('Check Eligibility');
    fireEvent.click(submitButton);
    
    expect(screen.getByText(/You are Eligible to Vote!/i)).toBeInTheDocument();
  });
});
