import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout/Layout';
import ConnectionsPage from './pages/ConnectionsPage';
import TablesPage from './pages/TablesPage';
import ConfigurationPage from './pages/ConfigurationPage';
import MigrationPage from './pages/MigrationPage';

const AppContent: React.FC = () => {
  const { state } = useAppContext();
  
  const renderCurrentPage = () => {
    switch (state.currentStep) {
      case 'connections':
        return <ConnectionsPage />;
      case 'tables':
        return <TablesPage />;
      case 'configuration':
        return <ConfigurationPage />;
      case 'migration':
        return <MigrationPage />;
      default:
        return <ConnectionsPage />;
    }
  };
  
  return (
    <Layout>
      {renderCurrentPage()}
    </Layout>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;