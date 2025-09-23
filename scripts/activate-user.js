// 사용자 활성화만 하는 스크립트 (비밀번호 변경 없음)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function activateUser(username) {
  try {
    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (user) {
      console.log('사용자 정보:');
      console.log('- Username:', user.username);
      console.log('- Email:', user.email);
      console.log('- isActive:', user.isActive);
      console.log('- isAdmin:', user.isAdmin);

      // isActive가 false면 true로만 업데이트 (비밀번호는 건드리지 않음)
      if (!user.isActive) {
        console.log('\n⚠️ 사용자가 비활성화되어 있습니다. 활성화 중...');
        await prisma.user.update({
          where: { username },
          data: { isActive: true }
        });
        console.log('✅ 사용자 활성화 완료');
      } else {
        console.log('✅ 사용자가 이미 활성화되어 있습니다.');
      }
    } else {
      console.log(`❌ ${username} 사용자를 찾을 수 없습니다.`);
    }

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 명령줄 인자에서 username 받기
const username = process.argv[2];
if (!username) {
  console.log('사용법: node activate-user.js <username>');
  console.log('예시: node activate-user.js test2');
  process.exit(1);
}

activateUser(username);