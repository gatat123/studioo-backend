'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, User, ChevronDown, LogOut, Settings, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
  userName?: string;
  userEmail?: string;
  notificationCount?: number;
}

const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  userName = 'Guest User',
  userEmail = 'guest@example.com',
  notificationCount = 0,
}) => {
  const pathname = usePathname();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const navLinks = [
    { href: '/studio', label: 'Studio' },
    { href: '/studio/projects', label: 'Projects' },
    { href: '/studio/recent', label: 'Recent' },
  ];

  const handleSignOut = () => {
    // TODO: Implement sign out logic
    console.log('Sign out');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Logo */}
        <Link href="/studio" className="flex items-center space-x-2 mr-6">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="hidden font-semibold sm:inline-block">
            Studio
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-6 flex-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-black',
                pathname === link.href
                  ? 'text-black'
                  : 'text-gray-500'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Section */}
        <div className="flex items-center space-x-4 ml-auto">
          {/* Notifications */}
          <DropdownMenu open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    variant="destructive"
                  >
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Badge>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="py-2 px-3 text-sm text-gray-500">
                No new notifications
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <UserCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">{userName}</p>
                </div>
                <ChevronDown className="h-4 w-4 hidden md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-gray-500">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
