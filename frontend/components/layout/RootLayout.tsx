'use client';

import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useStores';

interface RootLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
  showSidebar?: boolean;
  containerClassName?: string;
}

const RootLayout: React.FC<RootLayoutProps> = ({
  children,
  showFooter = true,
  showSidebar = true,
  containerClassName,
}) => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMenuClick = () => {
    if (isMobile) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Calculate main content margin based on sidebar state
  const getMainMargin = () => {
    if (!showSidebar) return '';
    if (isMobile) return '';
    return isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <Header
        onMenuClick={handleMenuClick}
        userName={user?.nickname || user?.username || 'Guest'}
        userEmail={user?.email || ''}
        notificationCount={0}
      />

      {/* Main Layout */}
      <div className="flex flex-1 relative">
        {/* Sidebar */}
        {showSidebar && (
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={isMobile ? () => setIsSidebarOpen(false) : handleSidebarToggle}
            isMobile={isMobile}
          />
        )}

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 transition-all duration-300',
            getMainMargin(),
            'mt-0' // Header is sticky, so no additional top margin needed
          )}
        >
          <div className={cn('min-h-[calc(100vh-4rem)]', containerClassName)}>
            {children}
          </div>
          
          {/* Footer */}
          {showFooter && <Footer />}
        </main>
      </div>
    </div>
  );
};

export default RootLayout;
