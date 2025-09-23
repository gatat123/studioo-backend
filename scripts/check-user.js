// 사용자 확인 스크립트
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    // test2 사용자 확인
    const user = await prisma.user.findUnique({
      where: { username: 'test2' }
    });

    if (user) {
      console.log('사용자 정보:');
      console.log('- Username:', user.username);
      console.log('- Email:', user.email);
      console.log('- isActive:', user.isActive);
      console.log('- isAdmin:', user.isAdmin);
      console.log('- Password Hash 존재:', !!user.passwordHash);

      // isActive가 false면 true로 업데이트
      if (!user.isActive) {
        console.log('\n⚠️ 사용자가 비활성화되어 있습니다. 활성화 중...');
        await prisma.user.update({
          where: { username: 'test2' },
          data: { isActive: true }
        });
        console.log('✅ 사용자 활성화 완료');
      }
    } else {
      console.log('❌ test2 사용자를 찾을 수 없습니다.');
    }

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();