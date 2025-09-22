import { prisma } from "@/lib/prisma";
import { NotificationService } from "./notification";

export interface CreateImageHistoryData {
  imageId: string;
  action: string; // 'uploaded', 'updated', 'deleted'
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
          userId: data.userId,
          action: data.action,
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
      // ImageHistory에 sceneId가 없으므로, Image를 통해 sceneId로 필터링
      const historyEntries = await prisma.imageHistory.findMany({
        where: {
          image: {
            sceneId: sceneId,
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
              originalName: true,
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
   * 새 이미지 버전 생성 (기존 이미지 교체) - 단순화된 버전
   */
  static async createNewImageVersion(
    imageId: string,
    newVersionData: {
      filename?: string;
      fileSize?: number;
      width?: number;
      height?: number;
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

        if (!existingImage || !existingImage.scene) {
          throw new Error("Image not found or scene not found");
        }

        // 이전 버전을 히스토리에 기록
        await tx.imageHistory.create({
          data: {
            imageId: existingImage.id,
            userId: existingImage.uploaderId, // 원래 업로더 기록
            action: 'updated',
          },
        });

        // 새 버전으로 이미지 업데이트
        const updatedImage = await tx.image.update({
          where: { id: imageId },
          data: {
            filename: newVersionData.filename || existingImage.filename,
            fileSize: newVersionData.fileSize || existingImage.fileSize,
            width: newVersionData.width || existingImage.width,
            height: newVersionData.height || existingImage.height,
            uploaderId: userId, // 새 업로더
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
            userId: userId,
            action: 'uploaded',
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: existingImage.scene.projectId,
            userId,
            action: "replace_image",
            details: `씬 ${existingImage.scene.sceneNumber}의 이미지를 교체했습니다.`,
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
              filename: newVersionData.filename,
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

        if (!currentImage.scene) {
          throw new Error("Image scene not found");
        }

        const historyCount = await tx.imageHistory.count({
          where: { imageId },
        });

        await tx.imageHistory.create({
          data: {
            imageId: currentImage.id,
            userId: currentImage.uploaderId,
            action: 'backup_before_restore',
          },
        });

        // 이미지를 선택된 버전으로 복원
        const restoredImage = await tx.image.update({
          where: { id: imageId },
          data: {
            // ImageHistory에 실제 이미지 데이터가 없으므로 복원 기능을 단순화
            // 실제로는 파일시스템에서 복원해야 하지만 여기서는 메타데이터만 업데이트
            uploaderId: userId,
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
            userId: userId,
            action: 'restored',
          },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId: currentImage.scene.projectId,
            userId,
            action: "restore_image",
            details: `씬 ${currentImage.scene.sceneNumber}의 이미지를 이전 버전으로 복원했습니다.`,
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
          createdAt: new Date(),
          action: "current",
          user: currentImage.uploader,
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
        await tx.imageHistory.create({
          data: {
            imageId,
            userId: userId,
            action: 'deleted',
          },
        });

        // 이미지 기록만 남기고 실제로는 삭제하지 않음 (소프트 삭제)
        const deletedImage = await tx.image.findUnique({
          where: { id: imageId },
        });

        // 협업 로그 기록
        if (image.scene) {
          await tx.collaborationLog.create({
            data: {
              projectId: image.scene.projectId,
              userId,
              action: "delete_image",
              details: `씬 ${image.scene.sceneNumber}의 이미지를 삭제했습니다.`,
            },
          });
        }

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
        await tx.imageHistory.create({
          data: {
            imageId,
            userId: userId,
            action: 'restored',
          },
        });

        // 이미지 복원 기록 (실제로는 변경사항 없음)
        const restoredImage = await tx.image.findUnique({
          where: { id: imageId },
        });

        // 협업 로그 기록
        if (image.scene) {
          await tx.collaborationLog.create({
            data: {
              projectId: image.scene.projectId,
              userId,
              action: "restore_image",
              details: `씬 ${image.scene.sceneNumber}의 삭제된 이미지를 복원했습니다.`,
            },
          });
        }

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

      return {
        totalVersions: historyCount,
        historyEntries: historyCount,
      };
    } catch (error) {
      console.error("Failed to get image statistics:", error);
      throw error;
    }
  }
}

export default ImageHistoryService;