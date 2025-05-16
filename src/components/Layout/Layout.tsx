import React from 'react';
import Header from './Header';
import StepIndicator from './StepIndicator';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <StepIndicator />
      <main className="flex-grow">
        {children}
      </main>
    </div>
  );
};

export default Layout;