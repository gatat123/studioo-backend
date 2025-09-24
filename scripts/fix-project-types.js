/**
 * 데이터베이스의 projectType 값을 정리하는 스크립트
 * 기존 프로젝트들의 projectType이 null이거나 잘못된 값인 경우 'studio'로 설정
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixProjectTypes() {
  try {
    console.log('프로젝트 타입 수정 스크립트를 시작합니다...');

    // 1. 현재 데이터베이스의 프로젝트 타입 현황 확인
    const allProjects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        projectType: true,
        createdAt: true
      }
    });

    console.log('\n=== 현재 데이터베이스 상황 ===');
    console.log(`총 프로젝트 수: ${allProjects.length}`);

    const typeStats = {};
    allProjects.forEach(project => {
      const type = project.projectType || 'null/undefined';
      typeStats[type] = (typeStats[type] || 0) + 1;
    });

    console.log('프로젝트 타입별 분포:');
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}개`);
    });

    // 2. projectType이 null이거나 빈 문자열인 프로젝트들을 'studio'로 설정
    const projectsToFix = await prisma.project.findMany({
      where: {
        OR: [
          { projectType: null },
          { projectType: '' },
          {
            AND: [
              { projectType: { not: 'studio' } },
              { projectType: { not: 'work' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        projectType: true
      }
    });

    console.log(`\n수정이 필요한 프로젝트: ${projectsToFix.length}개`);

    if (projectsToFix.length > 0) {
      console.log('수정할 프로젝트 목록:');
      projectsToFix.forEach(project => {
        console.log(`  - ID: ${project.id}, 이름: "${project.name}", 현재 타입: "${project.projectType || 'null'}"`);
      });

      // 사용자 확인 (실제 운영환경에서는 주의깊게 실행)
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('\n이 프로젝트들을 모두 "studio" 타입으로 변경하시겠습니까? (y/N): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        // 3. 프로젝트 타입 업데이트
        const updateResult = await prisma.project.updateMany({
          where: {
            OR: [
              { projectType: null },
              { projectType: '' },
              {
                AND: [
                  { projectType: { not: 'studio' } },
                  { projectType: { not: 'work' } }
                ]
              }
            ]
          },
          data: {
            projectType: 'studio'
          }
        });

        console.log(`\n✅ ${updateResult.count}개 프로젝트의 타입을 'studio'로 업데이트했습니다.`);

        // 4. 업데이트 후 결과 확인
        const updatedProjects = await prisma.project.findMany({
          select: {
            id: true,
            name: true,
            projectType: true
          }
        });

        const updatedTypeStats = {};
        updatedProjects.forEach(project => {
          const type = project.projectType || 'null/undefined';
          updatedTypeStats[type] = (updatedTypeStats[type] || 0) + 1;
        });

        console.log('\n=== 업데이트 후 상황 ===');
        console.log('프로젝트 타입별 분포:');
        Object.entries(updatedTypeStats).forEach(([type, count]) => {
          console.log(`  - ${type}: ${count}개`);
        });
      } else {
        console.log('작업을 취소했습니다.');
      }
    } else {
      console.log('✅ 수정이 필요한 프로젝트가 없습니다.');
    }

  } catch (error) {
    console.error('❌ 오류가 발생했습니다:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  fixProjectTypes();
}

module.exports = { fixProjectTypes };