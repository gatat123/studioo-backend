'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Globe,
  Bell,
  Shield,
  Mail,
  Save,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  Zap,
  Upload,
  Download
} from 'lucide-react';

interface SystemSettings {
  general: {
    siteName: string;
    siteDescription: string;
    siteUrl: string;
    contactEmail: string;
    timezone: string;
    language: string;
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  security: {
    requireEmailVerification: boolean;
    allowRegistration: boolean;
    passwordMinLength: number;
    requireStrongPassword: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
    enableTwoFactor: boolean;
    allowedDomains: string[];
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpSecure: boolean;
    fromEmail: string;
    fromName: string;
  };
  storage: {
    provider: 'local' | 's3' | 'cloudinary';
    maxFileSize: number;
    allowedFileTypes: string[];
    storageLimit: number;
    currentUsage: number;
  };
  performance: {
    enableCache: boolean;
    cacheExpiry: number;
    enableCDN: boolean;
    cdnUrl: string;
    enableCompression: boolean;
    enableMinification: boolean;
    rateLimitPerMinute: number;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    newUserNotification: boolean;
    errorNotification: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SystemSettings>({
    general: {
      siteName: 'Studio Platform',
      siteDescription: '실시간 협업 스튜디오 플랫폼',
      siteUrl: 'https://studio.example.com',
      contactEmail: 'admin@studio.com',
      timezone: 'Asia/Seoul',
      language: 'ko',
      maintenanceMode: false,
      maintenanceMessage: '시스템 점검 중입니다. 잠시 후 다시 시도해주세요.'
    },
    security: {
      requireEmailVerification: true,
      allowRegistration: true,
      passwordMinLength: 8,
      requireStrongPassword: true,
      sessionTimeout: 1440,
      maxLoginAttempts: 5,
      enableTwoFactor: false,
      allowedDomains: []
    },
    email: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: true,
      fromEmail: 'noreply@studio.com',
      fromName: 'Studio Platform'
    },
    storage: {
      provider: 'local',
      maxFileSize: 10485760, // 10MB
      allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'],
      storageLimit: 10737418240, // 10GB
      currentUsage: 2147483648 // 2GB
    },
    performance: {
      enableCache: true,
      cacheExpiry: 3600,
      enableCDN: false,
      cdnUrl: '',
      enableCompression: true,
      enableMinification: true,
      rateLimitPerMinute: 60
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      newUserNotification: true,
      errorNotification: true,
      weeklyReport: false,
      monthlyReport: true
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const checkAuth = () => {
    // Set temporary token for gatat123 if not exists
    if (!localStorage.getItem('token')) {
      localStorage.setItem('token', 'gatat123-temp-token');
      localStorage.setItem('username', 'gatat123');
      localStorage.setItem('userId', 'gatat123-temp-id');
    }
  };

  const fetchSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch('/api/admin/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
      } else if (response.status === 401 || response.status === 403) {
        router.push('/login');
      }
    } catch {
      // Error handled - fetch settings failed
    } finally {
      setIsLoading(false);
    }
  }, [router, settings]);

  useEffect(() => {
    checkAuth();
    fetchSettings().catch(() => {
      // Error handling is already done in fetchSettings
    });
  }, [fetchSettings]);

  const handleSaveSettings = async (section: keyof SystemSettings) => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          section,
          settings: settings[section]
        }),
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch {
      // Save settings failed - error handled
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `settings_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string);
        setSettings(importedSettings);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch {
        // Import settings failed - error handled
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">시스템 설정</h1>
          <p className="text-gray-600 dark:text-gray-600 mt-2">
            플랫폼 전반의 설정을 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportSettings} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            설정 내보내기
          </Button>
          <Label htmlFor="import-settings" className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                설정 가져오기
              </span>
            </Button>
            <Input
              id="import-settings"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportSettings}
            />
          </Label>
        </div>
      </div>

      {/* Save Status */}
      {saveStatus !== 'idle' && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          saveStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {saveStatus === 'success' ? (
            <>
              <CheckCircle className="w-5 h-5" />
              설정이 성공적으로 저장되었습니다.
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5" />
              설정 저장에 실패했습니다.
            </>
          )}
        </div>
      )}

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="general">일반</TabsTrigger>
          <TabsTrigger value="security">보안</TabsTrigger>
          <TabsTrigger value="email">이메일</TabsTrigger>
          <TabsTrigger value="storage">저장소</TabsTrigger>
          <TabsTrigger value="performance">성능</TabsTrigger>
          <TabsTrigger value="notifications">알림</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                일반 설정
              </CardTitle>
              <CardDescription>
                사이트의 기본 정보와 설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">사이트 이름</Label>
                  <Input
                    id="siteName"
                    value={settings.general.siteName}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, siteName: e.target.value }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteUrl">사이트 URL</Label>
                  <Input
                    id="siteUrl"
                    value={settings.general.siteUrl}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, siteUrl: e.target.value }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">연락처 이메일</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={settings.general.contactEmail}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, contactEmail: e.target.value }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">시간대</Label>
                  <Select
                    value={settings.general.timezone}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      general: { ...settings.general, timezone: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Seoul">Asia/Seoul</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="siteDescription">사이트 설명</Label>
                  <Textarea
                    id="siteDescription"
                    value={settings.general.siteDescription}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, siteDescription: e.target.value }
                    })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">기본 언어</Label>
                  <Select
                    value={settings.general.language}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      general: { ...settings.general, language: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ko">한국어</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="maintenanceMode">유지보수 모드</Label>
                    <p className="text-sm text-gray-700">사이트를 일시적으로 차단합니다</p>
                  </div>
                  <Switch
                    id="maintenanceMode"
                    checked={settings.general.maintenanceMode}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      general: { ...settings.general, maintenanceMode: checked }
                    })}
                  />
                </div>

                {settings.general.maintenanceMode && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="maintenanceMessage">유지보수 메시지</Label>
                    <Textarea
                      id="maintenanceMessage"
                      value={settings.general.maintenanceMessage}
                      onChange={(e) => setSettings({
                        ...settings,
                        general: { ...settings.general, maintenanceMessage: e.target.value }
                      })}
                      rows={2}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSaveSettings('general')} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                보안 설정
              </CardTitle>
              <CardDescription>
                계정 보안과 인증 관련 설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>이메일 인증 필수</Label>
                    <p className="text-sm text-gray-700">신규 가입 시 이메일 인증을 요구합니다</p>
                  </div>
                  <Switch
                    checked={settings.security.requireEmailVerification}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      security: { ...settings.security, requireEmailVerification: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>회원가입 허용</Label>
                    <p className="text-sm text-gray-700">새로운 사용자의 가입을 허용합니다</p>
                  </div>
                  <Switch
                    checked={settings.security.allowRegistration}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      security: { ...settings.security, allowRegistration: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>강력한 비밀번호 요구</Label>
                    <p className="text-sm text-gray-700">대소문자, 숫자, 특수문자 포함</p>
                  </div>
                  <Switch
                    checked={settings.security.requireStrongPassword}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      security: { ...settings.security, requireStrongPassword: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>2단계 인증</Label>
                    <p className="text-sm text-gray-700">추가 보안을 위한 2FA 활성화</p>
                  </div>
                  <Switch
                    checked={settings.security.enableTwoFactor}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      security: { ...settings.security, enableTwoFactor: checked }
                    })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="passwordMinLength">최소 비밀번호 길이</Label>
                    <Input
                      id="passwordMinLength"
                      type="number"
                      value={settings.security.passwordMinLength}
                      onChange={(e) => setSettings({
                        ...settings,
                        security: { ...settings.security, passwordMinLength: parseInt(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">세션 타임아웃 (분)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => setSettings({
                        ...settings,
                        security: { ...settings.security, sessionTimeout: parseInt(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxLoginAttempts">최대 로그인 시도</Label>
                    <Input
                      id="maxLoginAttempts"
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) => setSettings({
                        ...settings,
                        security: { ...settings.security, maxLoginAttempts: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSaveSettings('security')} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                이메일 설정
              </CardTitle>
              <CardDescription>
                이메일 전송을 위한 SMTP 설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP 호스트</Label>
                  <Input
                    id="smtpHost"
                    value={settings.email.smtpHost}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpHost: e.target.value }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP 포트</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={settings.email.smtpPort}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpPort: parseInt(e.target.value) }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP 사용자명</Label>
                  <Input
                    id="smtpUser"
                    value={settings.email.smtpUser}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpUser: e.target.value }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP 비밀번호</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={settings.email.smtpPassword}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpPassword: e.target.value }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromEmail">발신자 이메일</Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    value={settings.email.fromEmail}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, fromEmail: e.target.value }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromName">발신자 이름</Label>
                  <Input
                    id="fromName"
                    value={settings.email.fromName}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, fromName: e.target.value }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between md:col-span-2">
                  <div className="space-y-0.5">
                    <Label>보안 연결 (TLS/SSL)</Label>
                    <p className="text-sm text-gray-700">암호화된 연결 사용</p>
                  </div>
                  <Switch
                    checked={settings.email.smtpSecure}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpSecure: checked }
                    })}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline">
                  테스트 이메일 발송
                </Button>
                <Button onClick={() => handleSaveSettings('email')} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Settings */}
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                저장소 설정
              </CardTitle>
              <CardDescription>
                파일 업로드와 저장소 관련 설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>저장소 사용량</Label>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>사용 중: {formatBytes(settings.storage.currentUsage)}</span>
                      <span>전체: {formatBytes(settings.storage.storageLimit)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(settings.storage.currentUsage / settings.storage.storageLimit) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="storageProvider">저장소 제공자</Label>
                    <Select
                      value={settings.storage.provider}
                      onValueChange={(value: 'local' | 's3' | 'cloudinary') => setSettings({
                        ...settings,
                        storage: { ...settings.storage, provider: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">로컬 저장소</SelectItem>
                        <SelectItem value="s3">Amazon S3</SelectItem>
                        <SelectItem value="cloudinary">Cloudinary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize">최대 파일 크기</Label>
                    <div className="flex gap-2">
                      <Input
                        id="maxFileSize"
                        type="number"
                        value={settings.storage.maxFileSize / 1048576} // Convert to MB
                        onChange={(e) => setSettings({
                          ...settings,
                          storage: { ...settings.storage, maxFileSize: parseInt(e.target.value) * 1048576 }
                        })}
                      />
                      <span className="flex items-center px-3 text-sm text-gray-700">MB</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storageLimit">저장소 한도</Label>
                    <div className="flex gap-2">
                      <Input
                        id="storageLimit"
                        type="number"
                        value={settings.storage.storageLimit / 1073741824} // Convert to GB
                        onChange={(e) => setSettings({
                          ...settings,
                          storage: { ...settings.storage, storageLimit: parseInt(e.target.value) * 1073741824 }
                        })}
                      />
                      <span className="flex items-center px-3 text-sm text-gray-700">GB</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowedFileTypes">허용 파일 확장자</Label>
                    <Input
                      id="allowedFileTypes"
                      value={settings.storage.allowedFileTypes.join(', ')}
                      onChange={(e) => setSettings({
                        ...settings,
                        storage: { ...settings.storage, allowedFileTypes: e.target.value.split(',').map(s => s.trim()) }
                      })}
                      placeholder="jpg, png, pdf..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSaveSettings('storage')} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Settings */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                성능 설정
              </CardTitle>
              <CardDescription>
                캐싱과 최적화 관련 설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>캐시 활성화</Label>
                    <p className="text-sm text-gray-700">페이지와 API 응답 캐싱</p>
                  </div>
                  <Switch
                    checked={settings.performance.enableCache}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      performance: { ...settings.performance, enableCache: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>CDN 사용</Label>
                    <p className="text-sm text-gray-700">정적 자원 CDN 배포</p>
                  </div>
                  <Switch
                    checked={settings.performance.enableCDN}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      performance: { ...settings.performance, enableCDN: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>압축 활성화</Label>
                    <p className="text-sm text-gray-700">Gzip 압축 사용</p>
                  </div>
                  <Switch
                    checked={settings.performance.enableCompression}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      performance: { ...settings.performance, enableCompression: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>코드 최소화</Label>
                    <p className="text-sm text-gray-700">JS/CSS 최소화</p>
                  </div>
                  <Switch
                    checked={settings.performance.enableMinification}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      performance: { ...settings.performance, enableMinification: checked }
                    })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cacheExpiry">캐시 만료 시간 (초)</Label>
                    <Input
                      id="cacheExpiry"
                      type="number"
                      value={settings.performance.cacheExpiry}
                      onChange={(e) => setSettings({
                        ...settings,
                        performance: { ...settings.performance, cacheExpiry: parseInt(e.target.value) }
                      })}
                      disabled={!settings.performance.enableCache}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rateLimitPerMinute">분당 요청 제한</Label>
                    <Input
                      id="rateLimitPerMinute"
                      type="number"
                      value={settings.performance.rateLimitPerMinute}
                      onChange={(e) => setSettings({
                        ...settings,
                        performance: { ...settings.performance, rateLimitPerMinute: parseInt(e.target.value) }
                      })}
                    />
                  </div>

                  {settings.performance.enableCDN && (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="cdnUrl">CDN URL</Label>
                      <Input
                        id="cdnUrl"
                        value={settings.performance.cdnUrl}
                        onChange={(e) => setSettings({
                          ...settings,
                          performance: { ...settings.performance, cdnUrl: e.target.value }
                        })}
                        placeholder="https://cdn.example.com"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline">
                  캐시 비우기
                </Button>
                <Button onClick={() => handleSaveSettings('performance')} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                알림 설정
              </CardTitle>
              <CardDescription>
                시스템 알림과 보고서 설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>이메일 알림</Label>
                    <p className="text-sm text-gray-700">중요 이벤트 이메일 알림</p>
                  </div>
                  <Switch
                    checked={settings.notifications.emailNotifications}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailNotifications: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>푸시 알림</Label>
                    <p className="text-sm text-gray-700">브라우저 푸시 알림</p>
                  </div>
                  <Switch
                    checked={settings.notifications.pushNotifications}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, pushNotifications: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>신규 사용자 알림</Label>
                    <p className="text-sm text-gray-700">새로운 사용자 가입 시 알림</p>
                  </div>
                  <Switch
                    checked={settings.notifications.newUserNotification}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, newUserNotification: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>오류 알림</Label>
                    <p className="text-sm text-gray-700">시스템 오류 발생 시 알림</p>
                  </div>
                  <Switch
                    checked={settings.notifications.errorNotification}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, errorNotification: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>주간 보고서</Label>
                    <p className="text-sm text-gray-700">매주 월요일 통계 보고서</p>
                  </div>
                  <Switch
                    checked={settings.notifications.weeklyReport}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, weeklyReport: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>월간 보고서</Label>
                    <p className="text-sm text-gray-700">매월 1일 종합 보고서</p>
                  </div>
                  <Switch
                    checked={settings.notifications.monthlyReport}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, monthlyReport: checked }
                    })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSaveSettings('notifications')} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}