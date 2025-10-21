import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { versionService } from './services/versionService';
import { errorLogger } from './services/errorLogger';
import { sessionCleanupService } from './services/sessionCleanupService';

// Register service worker with iOS-optimized handling
registerSW({
  onNeedRefresh() {
    console.log('🔄 Nouvelle version détectée - Mise à jour iOS optimisée...');
    
    // ✅ Délai pour iOS Safari
    setTimeout(() => {
      // Nettoyer le cache avant le reload sur iOS
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            Promise.all(cacheNames.map(name => caches.delete(name)))
              .then(() => location.reload())
              .catch(() => location.reload());
          });
        } else {
          location.reload();
        }
      } else {
        location.reload();
      }
    }, 1000);
  },
  onOfflineReady() {
    console.log('✅ L\'application est prête pour une utilisation hors ligne');
    
    // ✅ Notification spécifique iOS
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      console.log('🍎 Mode hors ligne iOS activé');
    }
  },
  onRegistered(registration) {
    console.log('🚀 Service Worker enregistré');
    
    // ✅ Vérification moins fréquente sur iOS pour économiser la batterie
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const checkInterval = isIOS ? 60000 : 30000; // 60s pour iOS, 30s pour les autres
    
    const updateTimer = setInterval(() => {
      // ✅ Vérifier si on est toujours en ligne avant de check
      if (navigator.onLine) {
        registration?.update().catch(error => {
          console.warn('⚠️ Erreur vérification mise à jour:', error);
        });
      }
    }, checkInterval);

    // ✅ Nettoyer le timer si la page se ferme
    window.addEventListener('beforeunload', () => {
      clearInterval(updateTimer);
    });
  },
  onRegisterError(error) {
    console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
    
    // ✅ Fallback pour iOS si le SW échoue
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      console.log('🍎 Fallback iOS - Application sans Service Worker');
      // L'app peut continuer à fonctionner sans SW sur iOS
    }
  },
});

// Prevent transitions on page load
document.body.classList.add('preload');

// Démarrer le service de vérification de version
versionService.startAutoCheck();

// 🆕 DÉMARRER LA SURVEILLANCE DES ROUTES OBSOLÈTES (24h+)
sessionCleanupService.startObsoleteRouteMonitoring();

// Log des stats de version au démarrage
const stats = versionService.getUpdateStats();
console.log('📱 Application PWA démarrée:', {
  version: stats.currentVersion,
  derniereVerification: stats.lastCheck,
  verificationAutomatique: stats.autoCheckActive,
  nettoyageRoutesObsoletes: 'activé'
});

// 🆕 ÉCOUTEURS GLOBAUX D'ERREURS POUR SUPABASE LOGGING
window.addEventListener('error', (event) => {
  console.error('🚨 [Global] Erreur JavaScript non capturée:', event.error);
  errorLogger.logJavaScriptError(
    event.error || new Error(event.message), 
    'GlobalErrorHandler',
    'Erreur JavaScript non capturée'
  );
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 [Global] Promise rejetée non gérée:', event.reason);
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  errorLogger.logJavaScriptError(
    error,
    'GlobalPromiseHandler',
    'Promise rejetée non gérée'
  );
});

// 🆕 Import des utilitaires de configuration en développement
if (process.env.NODE_ENV === 'development') {
  import('./utils/supabaseConfigChecker');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Remove preload class after DOM is ready
setTimeout(() => {
  document.body.classList.remove('preload');
}, 100);
