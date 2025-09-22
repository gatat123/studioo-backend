import { prisma } from "@/lib/prisma";
import { NotificationService } from "./notification";

export interface CreateImageHistoryData {
  imageId: string;
  sceneId: string;
  versionNumber: number;
  fileUrl: string;
  changeDescription?: string;
  userId: string;
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
          sceneId: data.sceneId,
          versionNumber: data.versionNumber,
          fileUrl: data.fileUrl,
          uploadedBy: data.userId,
          changeDescription: data.changeDescription,
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
          image: {
            select: {
              id: true,
              fileUrl: true,
              sceneId: true,
            },
          },
          scene: {
            select: {
              id: true,
              sceneNumber: true,
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
          uploadedAt: "desc",
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
          sceneId,
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
          image: {
            select: {
              id: true,
              fileUrl: true,
              type: true,
            },
          },
        },
        orderBy: {
          uploadedAt: "desc",
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
    newVersionData: {
      fileUrl: string;
      fileSize?: bigint;
      width?: number;
      height?: number;
      format?: string;
    },
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
          },
        });

        if (!existingImage) {
          throw new Error("Image not found");
        }

        // 이전 버전을 히스토리에 기록
        const historyCount = await tx.imageHistory.count({
          where: { imageId },
        });

        await tx.imageHistory.create({
          data: {
            imageId: existingImage.id,
            sceneId: existingImage.sceneId,
            versionNumber: historyCount + 1,
            fileUrl: existingImage.fileUrl,
            uploadedBy: existingImage.uploadedBy,
            changeDescription: `Version ${historyCount + 1} - Previous version backup`,
          },
        });

        // 새 버전으로 이미지 업데이트
        const updatedImage = await tx.image.update({
          where: { id: imageId },
          data: {
            fileUrl: newVersionData.fileUrl,
            fileSize: newVersionData.fileSize,
            width: newVersionData.width,
            height: newVersionData.height,
            format: newVersionData.format,
            uploadedBy: userId,
            uploadedAt: new Date(),
          },
          include: {
            uploader: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
            scene: {
              select: {
                id: true,
                sceneNumber: true,
                projectId: true,
              },
            },
          },
        });

        // 새 버전 히스토리 기록
        await tx.imageHistory.create({
          data: {
            imageId: updatedImage.id,
            sceneId: updatedImage.sceneId,
            versionNumber: historyCount + 2,
            fileUrl: newVersionData.fileUrl,
            uploadedBy: userId,
            changeDescription: `Version ${historyCount + 2} - New version uploaded`,
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: existingImage.scene.projectId,
            userId,
            actionType: "replace_image",
            targetType: "image",
            targetId: imageId,
            description: `씬 ${existingImage.scene.sceneNumber}의 이미지를 교체했습니다.`,
            metadata: {
              fileUrl: newVersionData.fileUrl,
              sceneNumber: existingImage.scene.sceneNumber,
            },
          },
        });

        return updatedImage;
      });

      // 프로젝트 참여자들에게 알림 전송
      if (result.scene) {
        const project = await prisma.project.findUnique({
          where: { id: result.scene.projectId },
          select: { id: true, name: true },
        });

        if (project) {
          await NotificationService.notifyProjectParticipants(
            result.scene.projectId,
            "image_updated",
            "이미지 업데이트",
            `${project.name} - 씬 ${result.scene.sceneNumber}의 이미지가 새 버전으로 교체되었습니다.`,
            userId,
            {
              imageId,
              fileUrl: newVersionData.fileUrl,
            }
          );
        }
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
  static async restoreImageVersion(imageId: string, historyId: string, userId: string) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 복원할 히스토리 조회
        const historyToRestore = await tx.imageHistory.findUnique({
          where: { id: historyId },
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
              },
            },
          },
        });

        if (!historyToRestore || historyToRestore.imageId !== imageId) {
          throw new Error("History not found or does not belong to this image");
        }

        // 현재 이미지 정보를 히스토리로 백업
        const currentImage = historyToRestore.image;
        const historyCount = await tx.imageHistory.count({
          where: { imageId },
        });

        await tx.imageHistory.create({
          data: {
            imageId: currentImage.id,
            sceneId: currentImage.sceneId,
            versionNumber: historyCount + 1,
            fileUrl: currentImage.fileUrl,
            uploadedBy: currentImage.uploadedBy,
            changeDescription: `Version ${historyCount + 1} - Backup before restoration`,
          },
        });

        // 이미지를 선택된 버전으로 복원
        const restoredImage = await tx.image.update({
          where: { id: imageId },
          data: {
            fileUrl: historyToRestore.fileUrl,
            uploadedBy: userId,
            uploadedAt: new Date(),
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
        await tx.imageHistory.create({
          data: {
            imageId,
            sceneId: currentImage.sceneId,
            versionNumber: historyCount + 2,
            fileUrl: historyToRestore.fileUrl,
            uploadedBy: userId,
            changeDescription: `Version ${historyCount + 2} - Restored from version ${historyToRestore.versionNumber}`,
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: currentImage.scene.projectId,
            userId,
            actionType: "restore_image",
            targetType: "image",
            targetId: imageId,
            description: `씬 ${currentImage.scene.sceneNumber}의 이미지를 이전 버전으로 복원했습니다.`,
            metadata: {
              restoredFromVersion: historyToRestore.versionNumber,
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
      const versions = await prisma.imageHistory.findMany({
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
          versionNumber: "desc",
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
        const maxVersion = versions[0]?.versionNumber || 0;
        const currentVersion = {
          id: `current-${currentImage.id}`,
          imageId: currentImage.id,
          sceneId: currentImage.sceneId,
          versionNumber: maxVersion + 1,
          fileUrl: currentImage.fileUrl,
          uploadedBy: currentImage.uploadedBy,
          uploadedAt: currentImage.uploadedAt,
          changeDescription: "Current version",
          isCurrent: true,
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
        // 이미지 조회
        const image = await tx.image.findUnique({
          where: { id: imageId },
          include: {
            scene: {
              select: {
                id: true,
                sceneNumber: true,
                projectId: true,
              },
            },
          },
        });

        if (!image) {
          throw new Error("Image not found");
        }

        // 삭제 히스토리 기록
        const historyCount = await tx.imageHistory.count({
          where: { imageId },
        });

        await tx.imageHistory.create({
          data: {
            imageId,
            sceneId: image.sceneId,
            versionNumber: historyCount + 1,
            fileUrl: image.fileUrl,
            uploadedBy: userId,
            changeDescription: `Version ${historyCount + 1} - Image deleted`,
          },
        });

        // 이미지를 isCurrent = false로 업데이트 (소프트 삭제)
        const deletedImage = await tx.image.update({
          where: { id: imageId },
          data: {
            isCurrent: false,
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: image.scene.projectId,
            userId,
            actionType: "delete_image",
            targetType: "image",
            targetId: imageId,
            description: `씬 ${image.scene.sceneNumber}의 이미지를 삭제했습니다.`,
            metadata: {
              fileUrl: image.fileUrl,
              sceneNumber: image.scene.sceneNumber,
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
        // 이미지 조회
        const image = await tx.image.findUnique({
          where: { id: imageId },
          include: {
            scene: {
              select: {
                id: true,
                sceneNumber: true,
                projectId: true,
              },
            },
          },
        });

        if (!image) {
          throw new Error("Image not found");
        }

        // 복원 히스토리 기록
        const historyCount = await tx.imageHistory.count({
          where: { imageId },
        });

        await tx.imageHistory.create({
          data: {
            imageId,
            sceneId: image.sceneId,
            versionNumber: historyCount + 1,
            fileUrl: image.fileUrl,
            uploadedBy: userId,
            changeDescription: `Version ${historyCount + 1} - Image restored`,
          },
        });

        // 이미지를 isCurrent = true로 업데이트 (복원)
        const restoredImage = await tx.image.update({
          where: { id: imageId },
          data: {
            isCurrent: true,
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: image.scene.projectId,
            userId,
            actionType: "restore_image",
            targetType: "image",
            targetId: imageId,
            description: `씬 ${image.scene.sceneNumber}의 삭제된 이미지를 복원했습니다.`,
            metadata: {
              fileUrl: image.fileUrl,
              sceneNumber: image.scene.sceneNumber,
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
      const historyCount = await prisma.imageHistory.count({
        where: { imageId },
      });

      const maxVersion = await prisma.imageHistory.aggregate({
        where: { imageId },
        _max: {
          versionNumber: true,
        },
      });

      return {
        totalVersions: historyCount,
        latestVersion: maxVersion._max.versionNumber || 1,
        historyEntries: historyCount,
      };
    } catch (error) {
      console.error("Failed to get image statistics:", error);
      throw error;
    }
  }
}

export default ImageHistoryService;