import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// GET: 첨부파일 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
    }

    const { id: workTaskId, subtaskId } = params

    // 세부작업 존재 확인 및 권한 체크
    const subtask = await prisma.subTask.findFirst({
      where: {
        id: subtaskId,
        workTaskId: workTaskId
      },
      include: {
        workTask: {
          include: {
            participants: true,
            createdBy: true
          }
        }
      }
    })

    if (!subtask) {
      return NextResponse.json({ error: '세부작업을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 체크
    const isParticipant = subtask.workTask.participants.some(p => p.userId === payload.sub)
    const isCreator = subtask.workTask.createdById === payload.sub
    const isAssignee = subtask.assigneeId === payload.sub

    if (!isParticipant && !isCreator && !isAssignee) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    // 첨부파일 목록 조회
    const attachments = await prisma.subTaskAttachment.findMany({
      where: {
        subTaskId: subtaskId
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(attachments)
  } catch (error) {
    console.error('Error fetching subtask attachments:', error)
    return NextResponse.json(
      { error: '첨부파일 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 파일 업로드
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
    }

    const { id: workTaskId, subtaskId } = params

    // 세부작업 존재 확인 및 권한 체크
    const subtask = await prisma.subTask.findFirst({
      where: {
        id: subtaskId,
        workTaskId: workTaskId
      },
      include: {
        workTask: {
          include: {
            participants: true,
            createdBy: true
          }
        }
      }
    })

    if (!subtask) {
      return NextResponse.json({ error: '세부작업을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 체크 (참여자, 생성자, 담당자만 업로드 가능)
    const isParticipant = subtask.workTask.participants.some(p => p.userId === payload.sub)
    const isCreator = subtask.workTask.createdById === payload.sub
    const isAssignee = subtask.assigneeId === payload.sub

    if (!isParticipant && !isCreator && !isAssignee) {
      return NextResponse.json({ error: '파일 업로드 권한이 없습니다.' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '파일이 선택되지 않았습니다.' }, { status: 400 })
    }

    // 파일 크기 제한 (10MB)
    const maxFileSize = 10 * 1024 * 1024
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
    }

    // 허용된 파일 타입 체크
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '지원되지 않는 파일 형식입니다.' }, { status: 400 })
    }

    // 파일명 생성 (UUID + 확장자)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExtension}`

    // 업로드 디렉토리 생성
    const uploadDir = path.join(process.cwd(), 'uploads', 'work-tasks', workTaskId, 'subtasks', subtaskId)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 파일 저장
    const filePath = path.join(uploadDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 데이터베이스에 첨부파일 정보 저장
    const attachment = await prisma.subTaskAttachment.create({
      data: {
        subTaskId: subtaskId,
        fileName: fileName,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileUrl: `/uploads/work-tasks/${workTaskId}/subtasks/${subtaskId}/${fileName}`,
        uploadedById: payload.sub
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      }
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: '파일 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}