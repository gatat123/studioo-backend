'use client'

import React, { useState } from 'react'
import VersionHistory from '@/components/editor/VersionHistory'
import { generateMockVersions } from '@/lib/mock/versionHistory'
import { toast } from 'sonner'
import type { Version } from '@/components/editor/VersionHistory'

export default function VersionHistoryTestPage() {
  const [versions] = useState<Version[]>(generateMockVersions(15))
  const [currentVersionId, setCurrentVersionId] = useState<string>(versions[0]?.id || '')
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [compareVersions, setCompareVersions] = useState<[Version, Version] | null>(null)

  const handleVersionSelect = (version: Version) => {
    setSelectedVersion(version)
    toast.success(`버전 ${version.versionNumber} 선택됨`)
  }

  const handleVersionCompare = (version1: Version, version2: Version) => {
    setCompareVersions([version1, version2])
    toast.info(`버전 ${version1.versionNumber}과 ${version2.versionNumber} 비교 중`)
  }

  const handleVersionRestore = (version: Version) => {
    setCurrentVersionId(version.id)
    toast.success(`버전 ${version.versionNumber}로 복원되었습니다`)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content Area */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Version History 테스트 페이지</h1>
          
          {/* Current Version Display */}
          <div className="bg-card rounded-lg p-6 mb-6 border">
            <h2 className="text-lg font-semibold mb-4">현재 버전 정보</h2>
            {selectedVersion ? (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">버전:</span> v{selectedVersion.versionNumber}
                  {selectedVersion.name && ` - ${selectedVersion.name}`}
                </p>
                <p className="text-sm">
                  <span className="font-medium">작성자:</span> {selectedVersion.author.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">타입:</span> {selectedVersion.type === 'lineart' ? '선화' : '채색'}
                </p>
                <p className="text-sm">
                  <span className="font-medium">변경사항:</span> {selectedVersion.changes || '없음'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">버전을 선택해주세요</p>
            )}
          </div>

          {/* Compare Mode Display */}
          {compareVersions && (
            <div className="bg-card rounded-lg p-6 mb-6 border">
              <h2 className="text-lg font-semibold mb-4">버전 비교</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium">버전 {compareVersions[0].versionNumber}</h3>
                  <p className="text-sm text-muted-foreground">
                    {compareVersions[0].author.name} • {compareVersions[0].type}
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">버전 {compareVersions[1].versionNumber}</h3>
                  <p className="text-sm text-muted-foreground">
                    {compareVersions[1].author.name} • {compareVersions[1].type}
                  </p>
                </div>
              </div>
              <button
                className="mt-4 text-sm text-primary hover:underline"
                onClick={() => setCompareVersions(null)}
              >
                비교 종료
              </button>
            </div>
          )}

          {/* Test Instructions */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">테스트 가이드</h2>
            <ul className="space-y-2 text-sm">
              <li>• 버전을 클릭하여 선택할 수 있습니다</li>
              <li>• "비교" 버튼을 클릭하여 버전 비교 모드를 활성화할 수 있습니다</li>
              <li>• 비교 모드에서 2개의 버전을 선택하면 비교가 시작됩니다</li>
              <li>• 복원 버튼(↺)을 클릭하여 해당 버전으로 복원할 수 있습니다</li>
              <li>• 필터와 정렬 옵션을 사용하여 버전 목록을 관리할 수 있습니다</li>
              <li>• 하단 타임라인에서 버전 분포를 시각적으로 확인할 수 있습니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Version History Sidebar */}
      <div className="w-96 border-l">
        <VersionHistory
          versions={versions}
          currentVersionId={currentVersionId}
          isLoading={false}
          onVersionSelect={handleVersionSelect}
          onVersionCompare={handleVersionCompare}
          onVersionRestore={handleVersionRestore}
        />
      </div>
    </div>
  )
}
