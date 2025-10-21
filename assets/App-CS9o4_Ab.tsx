import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ui/theme-provider';
import { useAuthStore } from './store/auth-store';

// Hooks de synchronisation
import { useAppSync } from './hooks';

// Pages principales
import { LoginPage } from './pages/auth/login-page';
import { DriverDashboard, RoutePage, SummaryPage } from './pages/driver';
import { DebugPage } from './pages/debug/debug-page';
import { DriverLayout } from './components/layout/driver-layout';

// Error Boundary pour capturer les erreurs
import { ErrorBoundary } from './components/error/ErrorBoundary';
import { IOSErrorHandler } from './components/error/IOSErrorHandler';

// CSS
import './index.css';

// 🆕 IMPORTS POUR LA MODALE GLOBALE LATE STOP
import React, { useState } from 'react';
import { useOptimizedRealtime } from './hooks/useOptimizedRealtime';
import { RouteModification } from './hooks';
import { LateStopNotificationModal } from './components/ui/LateStopNotificationModal';
import { SplashAnimation } from './components/ui/SplashAnimation';
import { performanceMonitor } from './services/performanceMonitor';

// Composant pour la logique globale late stops
const GlobalLateStopHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showLateStopModal, setShowLateStopModal] = useState(false);
  const [currentLateStopModification, setCurrentLateStopModification] = useState<RouteModification | null>(null);

  // Hook pour détecter les modifications en temps réel (GLOBAL)
  const handleRouteModification = (modification: RouteModification) => {
    console.log('🚨 [GLOBAL] Modification détectée en temps réel:', {
      type: modification.type,
      details: modification.details,
      clientName: modification.clientName,
      timestamp: modification.timestamp,
      shipment: modification.shipment,
      stop: modification.stop
    });
    
    // Traitement spécifique selon le type de modification
    if (modification.type === 'late_stop_added') {
      console.log('🚨 [GLOBAL] Affichage de la modale late stop');
      setCurrentLateStopModification(modification);
      setShowLateStopModal(true);
    } else if (modification.type === 'new_shipment') {
      console.log('📦 [GLOBAL] Nouveau colis détecté:', {
        shipmentId: modification.shipment?.id,
        clientName: modification.clientName,
        shipmentType: modification.shipment?.shipment_type
      });
    } else if (modification.type === 'shipment_updated') {
      console.log('📦 [GLOBAL] Colis mis à jour:', {
        shipmentId: modification.shipment?.id,
        clientName: modification.clientName
      });
    }
  };

  // Fonction pour fermer la modale
  const handleCloseLateStopModal = () => {
    setShowLateStopModal(false);
    setCurrentLateStopModification(null);
  };

  // Hook de détection des modifications temps réel OPTIMISÉ
  useOptimizedRealtime({
    onRouteModification: handleRouteModification,
    enabled: true
  });

  return (
    <>
      {children}
      
      {/* 🆕 MODALE LATE STOP GLOBALE */}
      <LateStopNotificationModal
        isOpen={showLateStopModal}
        onClose={handleCloseLateStopModal}
        modification={currentLateStopModification}
      />
    </>
  );
};

// Composant principal de l'app avec synchronisation
function App() {
  // État d'authentification
  const { user, isLoading } = useAuthStore();
  
  // Vérifier si l'animation a déjà été vue aujourd'hui
  const [showSplash, setShowSplash] = useState(() => {
    const today = new Date().toDateString();
    const lastSplashDate = localStorage.getItem('lastSplashDate');
    // Toujours montrer en développement ou si pas vue aujourd'hui
    return process.env.NODE_ENV === 'development' || lastSplashDate !== today;
  });
  
  // Initialiser le monitoring des performances
  React.useEffect(() => {
    if (user) {
      performanceMonitor.start();
      console.log('📊 Monitoring des performances démarré');
    }
    
    return () => {
      performanceMonitor.stop();
    };
  }, [user]);
  
  // Hooks de synchronisation - actifs seulement si utilisateur connecté
  useAppSync();

  // Animation d'intro seulement si l'utilisateur est connecté
  console.log('🎬 Animation check:', { user: !!user, showSplash, isLoading });
  
  if (user && showSplash) {
    console.log('🚀 Affichage de l\'animation splash');
    return <SplashAnimation onComplete={() => {
      console.log('✅ Animation terminée');
      setShowSplash(false);
      // Sauvegarder la date pour ne pas re-montrer aujourd'hui
      const today = new Date().toDateString();
      localStorage.setItem('lastSplashDate', today);
    }} />;
  }

  // Écran de chargement
  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
        </div>
    );
  }

  return (
    <IOSErrorHandler>
      <ErrorBoundary>
        <Router>
          <Routes>
          {/* Routes d'authentification */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" replace /> : (
            <ErrorBoundary>
              <LoginPage />
            </ErrorBoundary>
          )} 
        />
        
        {/* Page de debug (développement uniquement) */}
        {process.env.NODE_ENV === 'development' && (
          <Route 
            path="/debug" 
            element={
              user ? (
                <ErrorBoundary>
                  <ThemeProvider>
                    <GlobalLateStopHandler>
                      <DebugPage />
                    </GlobalLateStopHandler>
                  </ThemeProvider>
                </ErrorBoundary>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        )}
        
        {/* Routes principales avec layout driver */}
        <Route 
          path="/*" 
          element={
            user ? (
              <ErrorBoundary>
                <ThemeProvider>
                  <GlobalLateStopHandler>
                    <DriverLayout />
                  </GlobalLateStopHandler>
                </ThemeProvider>
              </ErrorBoundary>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        >
          {/* Routes enfants du driver layout */}
          <Route index element={<DriverDashboard />} />
          <Route path="driver" element={<Navigate to="/" replace />} />
          <Route path="driver/route" element={<RoutePage />} />
          <Route path="driver/resume" element={<SummaryPage />} />
        </Route>
        </Routes>
        </Router>
      </ErrorBoundary>
    </IOSErrorHandler>
  );
}

export default App;