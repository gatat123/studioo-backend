import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(
  request: NextRequest,
  { params }: { params: { sceneId: string } }
) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify JWT token
    const token = authHeader.substring(7);
    let userId: string;
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      userId = decoded.userId;
    } catch (error) {
      console.error('JWT verification error:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
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
      p => p.userId === userId
    );

    if (!isParticipant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Process file upload - Convert to base64 for Railway compatibility
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    // Get file extension
    const fileExtension = file.name.split('.').pop();

    // Save to database with base64 data
    const image = await prisma.image.create({
      data: {
        sceneId,
        type,
        fileUrl: dataUri, // Store as data URI for Railway
        fileSize: file.size,
        format: fileExtension,
        isCurrent: true,
        uploadedBy: userId,
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
    
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      error: 'Failed to upload image',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    };
    
    return NextResponse.json(errorDetails, { status: 500 });
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