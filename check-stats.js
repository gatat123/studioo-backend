const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStats() {
  try {
    const [
      totalUsers,
      activeUsers,
      totalProjects,
      totalScenes,
      totalComments,
      totalWorkTasks,
      totalSubTasks
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.project.count(),
      prisma.scene.count(),
      prisma.comment.count(),
      prisma.workTask.count(),
      prisma.subTask.count()
    ]);

    console.log('Database Statistics:');
    console.log('==================');
    console.log('Total Users:', totalUsers);
    console.log('Active Users (30 days):', activeUsers);
    console.log('Total Projects:', totalProjects);
    console.log('Total Scenes:', totalScenes);
    console.log('Total Comments:', totalComments);
    console.log('Total Work Tasks:', totalWorkTasks);
    console.log('Total Sub Tasks:', totalSubTasks);

    // Work Task 상태별 통계
    const workTasksByStatus = await prisma.workTask.groupBy({
      by: ['status'],
      _count: true
    });

    console.log('\nWork Tasks by Status:');
    workTasksByStatus.forEach(item => {
      console.log(`  ${item.status}: ${item._count}`);
    });

    // SubTask 상태별 통계
    const subTasksByStatus = await prisma.subTask.groupBy({
      by: ['status'],
      _count: true
    });

    console.log('\nSub Tasks by Status:');
    subTasksByStatus.forEach(item => {
      console.log(`  ${item.status}: ${item._count}`);
    });

    // 최근 활동 사용자
    const recentUsers = await prisma.user.findMany({
      where: {
        lastLoginAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        username: true,
        lastLoginAt: true
      },
      orderBy: {
        lastLoginAt: 'desc'
      },
      take: 5
    });

    console.log('\nRecent Active Users (7 days):');
    recentUsers.forEach(user => {
      console.log(`  ${user.username}: ${user.lastLoginAt}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStats();