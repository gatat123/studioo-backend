import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/admin/work - Get all work tasks and subtasks (Admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'work-tasks', 'sub-tasks', or 'all'
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let workTasks = [];
    let subTasks = [];
    let totalWorkTasks = 0;
    let totalSubTasks = 0;

    // Build where conditions
    const workTaskWhere: any = {};
    const subTaskWhere: any = {};

    if (status) {
      workTaskWhere.status = status;
      subTaskWhere.status = status;
    }

    if (priority) {
      workTaskWhere.priority = priority;
      subTaskWhere.priority = priority;
    }

    if (type === 'all' || type === 'work-tasks') {
      [workTasks, totalWorkTasks] = await Promise.all([
        prisma.workTask.findMany({
          where: workTaskWhere,
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    nickname: true,
                    profileImageUrl: true
                  }
                }
              }
            },
            _count: {
              select: {
                subTasks: true,
                comments: true
              }
            }
          },
          orderBy: {
            updatedAt: 'desc'
          },
          skip: type === 'work-tasks' ? offset : 0,
          take: type === 'work-tasks' ? limit : undefined
        }),
        prisma.workTask.count({ where: workTaskWhere })
      ]);
    }

    if (type === 'all' || type === 'sub-tasks') {
      [subTasks, totalSubTasks] = await Promise.all([
        prisma.subTask.findMany({
          where: subTaskWhere,
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
            workTask: {
              select: {
                id: true,
                title: true
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
                isDeleted: false
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
            _count: {
              select: {
                comments: true,
                attachments: true
              }
            }
          },
          orderBy: {
            updatedAt: 'desc'
          },
          skip: type === 'sub-tasks' ? offset : 0,
          take: type === 'sub-tasks' ? limit : undefined
        }),
        prisma.subTask.count({ where: subTaskWhere })
      ]);
    }

    // Calculate last modified date for sub tasks
    const subTasksWithLastModified = subTasks.map(subTask => {
      const dates: Date[] = [
        new Date(subTask.updatedAt),
        new Date(subTask.createdAt)
      ];

      // Add latest comment date if exists
      if (subTask.comments && subTask.comments.length > 0) {
        const latestCommentDate = subTask.comments.reduce((latest, comment) => {
          const commentDate = new Date(comment.updatedAt);
          return commentDate > latest ? commentDate : latest;
        }, new Date(subTask.comments[0].createdAt));
        dates.push(latestCommentDate);
      }

      const lastModifiedAt = dates.reduce((latest, current) => {
        return current > latest ? current : latest;
      });

      return {
        ...subTask,
        lastModifiedAt: lastModifiedAt.toISOString(),
        timeSinceLastModified: Math.floor((Date.now() - lastModifiedAt.getTime()) / 1000)
      };
    });

    const response = {
      workTasks,
      subTasks: subTasksWithLastModified,
      pagination: {
        page,
        limit,
        totalWorkTasks,
        totalSubTasks,
        totalWorkTaskPages: Math.ceil(totalWorkTasks / limit),
        totalSubTaskPages: Math.ceil(totalSubTasks / limit)
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching work data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch work data' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/work - Delete work task or subtask (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'work-task' or 'sub-task'
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type and ID are required' },
        { status: 400 }
      );
    }

    if (type === 'work-task') {
      await prisma.workTask.delete({
        where: { id }
      });
    } else if (type === 'sub-task') {
      await prisma.subTask.delete({
        where: { id }
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be work-task or sub-task' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${type === 'work-task' ? 'Work task' : 'Sub task'} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting work item:', error);
    return NextResponse.json(
      { error: 'Failed to delete work item' },
      { status: 500 }
    );
  }
}