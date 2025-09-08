import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/middleware/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: { sceneId: string } }
) {
  try {
    // Authenticate user
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sceneId } = params;
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const type = formData.get('type') as 'lineart' | 'art';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!type || !['lineart', 'art'].includes(type)) {
      return NextResponse.json({ error: 'Invalid image type' }, { status: 400 });
    }

    // Verify scene exists and user has access
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        project: {
          include: {
            participants: true
          }
        }
      }
    });

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    // Check if user is a participant
    const isParticipant = scene.project.participants.some(
      p => p.userId === authResult.user.userId
    );

    if (!isParticipant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Process file upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `${randomUUID()}.${fileExtension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images', sceneId);
    
    // Create directory if it doesn't exist
    await mkdir(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Save to database
    const image = await prisma.image.create({
      data: {
        sceneId,
        type,
        fileUrl: `/uploads/images/${sceneId}/${fileName}`,
        fileSize: file.size,
        format: fileExtension,
        isCurrent: true,
        uploadedBy: authResult.user.userId,
        metadata: {
          originalName: file.name,
          mimeType: file.type
        }
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            nickname: true
          }
        }
      }
    });

    // Set other images of the same type as not current
    await prisma.image.updateMany({
      where: {
        sceneId,
        type,
        id: { not: image.id }
      },
      data: {
        isCurrent: false
      }
    });

    return NextResponse.json(image);
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sceneId: string } }
) {
  try {
    const { sceneId } = params;

    // Get all images for the scene
    const images = await prisma.image.findMany({
      where: { sceneId },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            nickname: true
          }
        }
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    return NextResponse.json(images);
  } catch (error) {
    console.error('Get images error:', error);
    return NextResponse.json(
      { error: 'Failed to get images' },
      { status: 500 }
    );
  }
}