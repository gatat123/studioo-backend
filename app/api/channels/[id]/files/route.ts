import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// POST: Upload file to channel
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check channel membership
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.id,
          userId: currentUser.id
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caption = formData.get('caption') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Generate unique filename
    const fileExt = path.extname(file.name);
    const fileId = crypto.randomUUID();
    const fileName = `${fileId}${fileExt}`;

    // Create upload directory if not exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'channels', params.id);
    await mkdir(uploadDir, { recursive: true });

    // Save file to disk
    const filePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save file record to database
    const fileRecord = await prisma.channelFile.create({
      data: {
        channelId: params.id,
        uploaderId: currentUser.id,
        fileName: file.name,
        fileUrl: `/uploads/channels/${params.id}/${fileName}`,
        fileSize: file.size,
        mimeType: file.type,
        metadata: caption ? { caption } : {}
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileSize: true,
        mimeType: true,
        metadata: true,
        createdAt: true
      }
    });

    // Create a message for this file upload
    const message = await prisma.channelMessage.create({
      data: {
        channelId: params.id,
        senderId: currentUser.id,
        content: caption || file.name,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        metadata: { fileId: fileRecord.id }
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      }
    });

    // Associate file with message
    await prisma.channelFile.update({
      where: { id: fileRecord.id },
      data: { messageId: message.id }
    });

    // Get the complete message with file
    const completeMessage = await prisma.channelMessage.findUnique({
      where: { id: message.id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            metadata: true,
            createdAt: true
          }
        }
      }
    });

    // Emit socket event for real-time update
    const io = (global as any).io;
    if (io) {
      io.to(`channel:${params.id}`).emit('new_channel_message', {
        message: completeMessage,
        timestamp: new Date()
      });
    }

    return NextResponse.json({
      file: fileRecord,
      message: completeMessage
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// GET: Get files in channel
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check channel membership
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.id,
          userId: currentUser.id
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 });
    }

    // Get files
    const files = await prisma.channelFile.findMany({
      where: {
        channelId: params.id
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        message: {
          select: {
            id: true,
            content: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}