// Test component for Zustand stores
'use client';

import { useAuth } from '@/hooks/useStores';
import { useProjects } from '@/hooks/useStores';
import { useUIPreferences, useNotification } from '@/hooks/useStores';
import { useState } from 'react';

export default function StoreTestComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { projects, createProject } = useProjects();
  const { theme, setTheme } = useUIPreferences();
  const notification = useNotification();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    await login({ email, password });
    notification.success('Login successful!', `Welcome back!`);
  };

  const handleCreateProject = async () => {
    await createProject({
      name: `Test Project ${Date.now()}`,
      description: 'Created from test component',
      tag: 'illustration',
    });
    notification.info('Project created!');
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    notification.success('Theme changed', `Theme set to ${newTheme}`);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Zustand Store Test</h1>
      
      {/* Auth Test */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">Authentication Store</h2>
        
        {!isAuthenticated ? (
          <div className="space-y-2">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-3 py-2 border rounded"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-3 py-2 border rounded ml-2"
            />
            <button
              onClick={handleLogin}
              className="ml-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Login
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p>Logged in as: <strong>{user?.username}</strong></p>
            <p>Email: {user?.email}</p>
            <p>Studio: {user?.studio?.name}</p>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Project Store Test */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">Project Store</h2>
        <p>Total projects: {projects.length}</p>
        <button
          onClick={handleCreateProject}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Create Test Project
        </button>
        
        {projects.length > 0 && (
          <div className="mt-3 space-y-1">
            <h3 className="font-medium">Projects:</h3>
            {projects.map((project) => (
              <div key={project.id} className="pl-4 text-sm">
                • {project.name} ({project.status})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UI Store Test */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">UI Store</h2>
        <p>Current theme: <strong>{theme}</strong></p>
        <div className="space-x-2">
          <button
            onClick={() => handleThemeChange('light')}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Light
          </button>
          <button
            onClick={() => handleThemeChange('dark')}
            className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            Dark
          </button>
          <button
            onClick={() => handleThemeChange('system')}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            System
          </button>
        </div>
      </div>

      {/* Notification Test */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">Notifications</h2>
        <div className="space-x-2">
          <button
            onClick={() => notification.success('Success!', 'This is a success message')}
            className="px-3 py-1 bg-green-500 text-white rounded"
          >
            Success
          </button>
          <button
            onClick={() => notification.error('Error!', 'This is an error message')}
            className="px-3 py-1 bg-red-500 text-white rounded"
          >
            Error
          </button>
          <button
            onClick={() => notification.warning('Warning!', 'This is a warning')}
            className="px-3 py-1 bg-yellow-500 text-white rounded"
          >
            Warning
          </button>
          <button
            onClick={() => notification.info('Info', 'This is an info message')}
            className="px-3 py-1 bg-blue-500 text-white rounded"
          >
            Info
          </button>
        </div>
      </div>
    </div>
  );
}
