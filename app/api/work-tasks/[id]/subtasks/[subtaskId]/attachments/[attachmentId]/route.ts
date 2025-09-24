import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/utils/jwt'
import { prisma } from '@/lib/prisma/db'
import { readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// GET: 파일 다운로드
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string; attachmentId: string }> }
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

    const { id: workTaskId, subtaskId, attachmentId } = await params

    // 첨부파일 정보 조회
    const attachment = await prisma.subTaskAttachment.findFirst({
      where: {
        id: attachmentId,
        subTaskId: subtaskId
      },
      include: {
        subTask: {
          include: {
            workTask: {
              include: {
                participants: true,
                createdBy: true
              }
            }
          }
        }
      }
    })

    if (!attachment) {
      return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 체크
    const workTask = attachment.subTask.workTask
    const isParticipant = workTask.participants.some(p => p.userId === payload.userId)
    const isCreator = workTask.createdById === payload.userId
    const isAssignee = attachment.subTask.assigneeId === payload.userId

    if (!isParticipant && !isCreator && !isAssignee) {
      return NextResponse.json({ error: '파일 다운로드 권한이 없습니다.' }, { status: 403 })
    }

    // 파일 경로 생성
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'work-tasks',
      workTaskId,
      'subtasks',
      subtaskId,
      attachment.fileName
    )

    // 파일 존재 확인
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: '파일이 존재하지 않습니다.' }, { status: 404 })
    }

    // 파일 읽기
    const fileBuffer = await readFile(filePath)

    // 파일 응답
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
        'Content-Length': attachment.fileSize.toString()
      }
    })
  } catch (error) {
    console.error('Error downloading file:', error)
    return NextResponse.json(
      { error: '파일 다운로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 파일 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string; attachmentId: string }> }
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

    const { id: workTaskId, subtaskId, attachmentId } = await params

    // 첨부파일 정보 조회
    const attachment = await prisma.subTaskAttachment.findFirst({
      where: {
        id: attachmentId,
        subTaskId: subtaskId
      },
      include: {
        subTask: {
          include: {
            workTask: {
              include: {
                participants: true,
                createdBy: true
              }
            }
          }
        }
      }
    })

    if (!attachment) {
      return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 체크 (업로드한 본인, 작업 생성자, 또는 관리자만 삭제 가능)
    const workTask = attachment.subTask.workTask
    const isUploader = attachment.uploadedById === payload.userId
    const isCreator = workTask.createdById === payload.userId

    if (!isUploader && !isCreator) {
      return NextResponse.json({ error: '파일 삭제 권한이 없습니다.' }, { status: 403 })
    }

    // 파일 경로 생성
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'work-tasks',
      workTaskId,
      'subtasks',
      subtaskId,
      attachment.fileName
    )

    // 파일 시스템에서 파일 삭제
    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    // 데이터베이스에서 첨부파일 정보 삭제
    await prisma.subTaskAttachment.delete({
      where: {
        id: attachmentId
      }
    })

    return NextResponse.json({ message: '파일이 삭제되었습니다.' })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json(
      { error: '파일 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}