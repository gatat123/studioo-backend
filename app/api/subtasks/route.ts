import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'

export async function GET(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let userId: string
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
      userId = decoded.userId
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 사용자가 참여하고 있는 모든 WorkTask를 먼저 찾기
    const userWorkTasks = await prisma.workTask.findMany({
      where: {
        OR: [
          { createdById: userId },
          { participants: { some: { userId: userId } } }
        ]
      },
      select: { id: true }
    })

    const workTaskIds = userWorkTasks.map(wt => wt.id)

    // 해당 WorkTask들의 모든 SubTask 조회
    const subTasks = await prisma.subTask.findMany({
      where: {
        workTaskId: { in: workTaskIds }
      },
      include: {
        createdBy: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        assignee: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                profileImageUrl: true
              }
            }
          }
        },
        comments: {
          where: {
            isDeleted: false  // 삭제되지 않은 댓글만 조회
          },
          include: {
            user: {
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
        },
        workTask: {
          select: {
            id: true,
            title: true,
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    nickname: true,
                    profileImageUrl: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // 마지막 수정일 계산을 위한 데이터 처리
    const subTasksWithLastModified = subTasks.map(subTask => {
      // 마지막 수정일 후보들
      const dates: Date[] = [
        new Date(subTask.updatedAt), // SubTask 자체의 수정일
        new Date(subTask.createdAt)  // SubTask 생성일
      ]

      // 댓글의 최신 날짜 추가
      if (subTask.comments && subTask.comments.length > 0) {
        const latestCommentDate = subTask.comments.reduce((latest, comment) => {
          const commentDate = new Date(comment.updatedAt)
          return commentDate > latest ? commentDate : latest
        }, new Date(subTask.comments[0].createdAt))
        dates.push(latestCommentDate)
      }

      // 가장 최근 날짜 선택
      const lastModifiedAt = dates.reduce((latest, current) => {
        return current > latest ? current : latest
      })

      return {
        ...subTask,
        lastModifiedAt: lastModifiedAt.toISOString(),
        // 경과 시간 계산을 위한 추가 필드
        timeSinceLastModified: Math.floor((Date.now() - lastModifiedAt.getTime()) / 1000) // 초 단위
      }
    })

    return NextResponse.json({
      success: true,
      data: subTasksWithLastModified
    })

  } catch (error) {
    console.error('[SubTasks API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}