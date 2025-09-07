import { prisma } from "@/lib/prisma";
import { ImageType, ImageStatus } from "@prisma/client";
import { uploadService } from "./upload";
import { NotificationService } from "./notification";

export interface CreateImageHistoryData {
  imageId: string;
  action: "upload" | "replace" | "restore" | "delete";
  description: string;
  userId: string;
  metadata?: Record<string, any>;
}

export interface ImageVersionData {
  filename: string;
  fileUrl: string;
  fileSize: number;
  format: string;
  width: number;
  height: number;
  uploadedBy: string;
  description?: string;
  metadata?: Record<string, any>;
}

export class ImageHistoryService {
  /**
   * 이미지 히스토리 기록 생성
   */
  static async createHistoryEntry(data: CreateImageHistoryData) {
    try {
      const historyEntry = await prisma.imageHistory.create({
        data: {
          imageId: data.imageId,
          action: data.action,
          description: data.description,
          userId: data.userId,
          metadata: data.metadata,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
          image: {
            select: {
              id: true,
              filename: true,
              sceneId: true,
              projectId: true,
            },
          },
        },
      });

      return historyEntry;
    } catch (error) {
      console.error("Failed to create image history entry:", error);
      throw error;
    }
  }

  /**
   * 이미지 히스토리 조회
   */
  static async getImageHistory(imageId: string, limit: number = 50) {
    try {
      const historyEntries = await prisma.imageHistory.findMany({
        where: {
          imageId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      return historyEntries;
    } catch (error) {
      console.error("Failed to get image history:", error);
      throw error;
    }
  }

  /**
   * 씬의 모든 이미지 히스토리 조회
   */
  static async getSceneImageHistory(sceneId: string, limit: number = 100) {
    try {
      const historyEntries = await prisma.imageHistory.findMany({
        where: {
          image: {
            sceneId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
          image: {
            select: {
              id: true,
              filename: true,
              type: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      return historyEntries;
    } catch (error) {
      console.error("Failed to get scene image history:", error);
      throw error;
    }
  }

  /**
   * 새 이미지 버전 생성 (기존 이미지 교체)
   */
  static async createNewImageVersion(
    imageId: string,
    newVersionData: ImageVersionData,
    userId: string
  ) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 기존 이미지 정보 조회
        const existingImage = await tx.image.findUnique({
          where: { id: imageId },
          include: {
            scene: {
              select: {
                id: true,
                sceneNumber: true,
                projectId: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!existingImage) {
          throw new Error("Image not found");
        }

        // 기존 이미지를 히스토리로 백업
        await tx.imageVersion.create({
          data: {
            imageId: existingImage.id,
            filename: existingImage.filename,
            fileUrl: existingImage.fileUrl,
            fileSize: existingImage.fileSize,
            format: existingImage.format,
            width: existingImage.width,
            height: existingImage.height,
            uploadedBy: existingImage.uploadedBy,
            version: existingImage.version,
            isBackup: true,
            createdAt: existingImage.uploadedAt,
          },
        });

        // 새 버전으로 이미지 업데이트
        const updatedImage = await tx.image.update({
          where: { id: imageId },
          data: {
            filename: newVersionData.filename,
            fileUrl: newVersionData.fileUrl,
            fileSize: newVersionData.fileSize,
            format: newVersionData.format,
            width: newVersionData.width,
            height: newVersionData.height,
            uploadedBy: newVersionData.uploadedBy,
            uploadedAt: new Date(),
            version: { increment: 1 },
            status: "active",
          },
          include: {
            uploader: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
          },
        });

        // 새 버전 히스토리 기록
        await tx.imageVersion.create({
          data: {
            imageId: updatedImage.id,
            filename: newVersionData.filename,
            fileUrl: newVersionData.fileUrl,
            fileSize: newVersionData.fileSize,
            format: newVersionData.format,
            width: newVersionData.width,
            height: newVersionData.height,
            uploadedBy: newVersionData.uploadedBy,
            version: updatedImage.version,
            isBackup: false,
            description: newVersionData.description,
            metadata: newVersionData.metadata,
          },
        });

        // 이미지 히스토리 기록
        await this.createHistoryEntry({
          imageId,
          action: "replace",
          description: `이미지를 새 버전으로 교체했습니다. (v${updatedImage.version})`,
          userId,
          metadata: {
            previousVersion: updatedImage.version - 1,
            newVersion: updatedImage.version,
            filename: newVersionData.filename,
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: existingImage.projectId,
            userId,
            actionType: "replace_image",
            targetType: "image",
            targetId: imageId,
            sceneId: existingImage.sceneId,
            description: `씬 ${existingImage.scene.sceneNumber}의 이미지를 교체했습니다.`,
            metadata: {
              filename: newVersionData.filename,
              version: updatedImage.version,
              sceneNumber: existingImage.scene.sceneNumber,
            },
          },
        });

        return updatedImage;
      });

      // 프로젝트 참여자들에게 알림 전송
      if (result.scene && result.project) {
        await NotificationService.notifyProjectParticipants(
          result.projectId,
          "image_updated",
          "이미지 업데이트",
          `${result.project.name} - 씬 ${result.scene.sceneNumber}의 이미지가 새 버전으로 교체되었습니다.`,
          userId,
          {
            imageId,
            filename: newVersionData.filename,
            version: result.version,
          }
        );
      }

      return result;
    } catch (error) {
      console.error("Failed to create new image version:", error);
      throw error;
    }
  }

  /**
   * 이미지 버전 복원
   */
  static async restoreImageVersion(imageId: string, versionId: string, userId: string) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 복원할 버전 조회
        const versionToRestore = await tx.imageVersion.findUnique({
          where: { id: versionId },
          include: {
            image: {
              include: {
                scene: {
                  select: {
                    id: true,
                    sceneNumber: true,
                    projectId: true,
                  },
                },
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        if (!versionToRestore || versionToRestore.imageId !== imageId) {
          throw new Error("Version not found or does not belong to this image");
        }

        // 현재 이미지 정보를 히스토리로 백업
        const currentImage = versionToRestore.image;
        await tx.imageVersion.create({
          data: {
            imageId: currentImage.id,
            filename: currentImage.filename,
            fileUrl: currentImage.fileUrl,
            fileSize: currentImage.fileSize,
            format: currentImage.format,
            width: currentImage.width,
            height: currentImage.height,
            uploadedBy: currentImage.uploadedBy,
            version: currentImage.version,
            isBackup: true,
            createdAt: currentImage.uploadedAt,
          },
        });

        // 이미지를 선택된 버전으로 복원
        const restoredImage = await tx.image.update({
          where: { id: imageId },
          data: {
            filename: versionToRestore.filename,
            fileUrl: versionToRestore.fileUrl,
            fileSize: versionToRestore.fileSize,
            format: versionToRestore.format,
            width: versionToRestore.width,
            height: versionToRestore.height,
            uploadedBy: userId, // 복원한 사용자로 설정
            uploadedAt: new Date(),
            version: { increment: 1 },
            status: "active",
          },
          include: {
            uploader: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
          },
        });

        // 복원 히스토리 기록
        await this.createHistoryEntry({
          imageId,
          action: "restore",
          description: `버전 ${versionToRestore.version}로 복원했습니다.`,
          userId,
          metadata: {
            restoredFromVersion: versionToRestore.version,
            newVersion: restoredImage.version,
            originalUploader: versionToRestore.uploadedBy,
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: currentImage.projectId,
            userId,
            actionType: "restore_image",
            targetType: "image",
            targetId: imageId,
            sceneId: currentImage.sceneId,
            description: `씬 ${currentImage.scene.sceneNumber}의 이미지를 이전 버전으로 복원했습니다.`,
            metadata: {
              restoredFromVersion: versionToRestore.version,
              newVersion: restoredImage.version,
              sceneNumber: currentImage.scene.sceneNumber,
            },
          },
        });

        return restoredImage;
      });

      return result;
    } catch (error) {
      console.error("Failed to restore image version:", error);
      throw error;
    }
  }

  /**
   * 이미지의 모든 버전 조회
   */
  static async getImageVersions(imageId: string) {
    try {
      const versions = await prisma.imageVersion.findMany({
        where: {
          imageId,
        },
        include: {
          uploader: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: {
          version: "desc",
        },
      });

      // 현재 활성 버전도 포함
      const currentImage = await prisma.image.findUnique({
        where: { id: imageId },
        include: {
          uploader: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
      });

      if (currentImage) {
        const currentVersion = {
          id: `current-${currentImage.id}`,
          imageId: currentImage.id,
          filename: currentImage.filename,
          fileUrl: currentImage.fileUrl,
          fileSize: currentImage.fileSize,
          format: currentImage.format,
          width: currentImage.width,
          height: currentImage.height,
          uploadedBy: currentImage.uploadedBy,
          version: currentImage.version,
          isBackup: false,
          isCurrent: true,
          description: null,
          metadata: null,
          createdAt: currentImage.uploadedAt,
          uploader: currentImage.uploader,
        };

        return [currentVersion, ...versions];
      }

      return versions;
    } catch (error) {
      console.error("Failed to get image versions:", error);
      throw error;
    }
  }

  /**
   * 이미지 삭제 (소프트 삭제)
   */
  static async softDeleteImage(imageId: string, userId: string) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 이미지 상태를 삭제됨으로 변경
        const deletedImage = await tx.image.update({
          where: { id: imageId },
          data: {
            status: "deleted",
            deletedAt: new Date(),
            deletedBy: userId,
          },
          include: {
            scene: {
              select: {
                id: true,
                sceneNumber: true,
                projectId: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // 삭제 히스토리 기록
        await this.createHistoryEntry({
          imageId,
          action: "delete",
          description: "이미지가 삭제되었습니다.",
          userId,
          metadata: {
            filename: deletedImage.filename,
            deletedAt: new Date(),
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: deletedImage.projectId,
            userId,
            actionType: "delete_image",
            targetType: "image",
            targetId: imageId,
            sceneId: deletedImage.sceneId,
            description: `씬 ${deletedImage.scene.sceneNumber}의 이미지를 삭제했습니다.`,
            metadata: {
              filename: deletedImage.filename,
              sceneNumber: deletedImage.scene.sceneNumber,
            },
          },
        });

        return deletedImage;
      });

      return result;
    } catch (error) {
      console.error("Failed to soft delete image:", error);
      throw error;
    }
  }

  /**
   * 삭제된 이미지 복원
   */
  static async restoreDeletedImage(imageId: string, userId: string) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 이미지 상태를 활성으로 복원
        const restoredImage = await tx.image.update({
          where: { id: imageId },
          data: {
            status: "active",
            deletedAt: null,
            deletedBy: null,
          },
          include: {
            scene: {
              select: {
                id: true,
                sceneNumber: true,
                projectId: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // 복원 히스토리 기록
        await this.createHistoryEntry({
          imageId,
          action: "restore",
          description: "삭제된 이미지가 복원되었습니다.",
          userId,
          metadata: {
            filename: restoredImage.filename,
            restoredAt: new Date(),
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: restoredImage.projectId,
            userId,
            actionType: "restore_image",
            targetType: "image",
            targetId: imageId,
            sceneId: restoredImage.sceneId,
            description: `씬 ${restoredImage.scene.sceneNumber}의 삭제된 이미지를 복원했습니다.`,
            metadata: {
              filename: restoredImage.filename,
              sceneNumber: restoredImage.scene.sceneNumber,
            },
          },
        });

        return restoredImage;
      });

      return result;
    } catch (error) {
      console.error("Failed to restore deleted image:", error);
      throw error;
    }
  }

  /**
   * 이미지 통계 조회
   */
  static async getImageStatistics(imageId: string) {
    try {
      const stats = await prisma.imageVersion.aggregate({
        where: { imageId },
        _count: {
          id: true,
        },
        _max: {
          version: true,
        },
      });

      const historyCount = await prisma.imageHistory.count({
        where: { imageId },
      });

      return {
        totalVersions: stats._count.id,
        latestVersion: stats._max.version || 1,
        historyEntries: historyCount,
      };
    } catch (error) {
      console.error("Failed to get image statistics:", error);
      throw error;
    }
  }
}

export default ImageHistoryService;