// 테스트 사용자 생성 스크립트
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash('1004mobiL', 10);

    // test2 사용자 생성 또는 업데이트
    const user = await prisma.user.upsert({
      where: { username: 'test2' },
      update: {
        password: hashedPassword,
        nickname: 'Test User 2',
      },
      create: {
        username: 'test2',
        password: hashedPassword,
        email: 'test2@example.com',
        nickname: 'Test User 2',
        isActive: true,
        isAdmin: false,
      },
    });

    console.log('✅ 테스트 사용자 생성 완료:', user.username);

    // gatat123 관리자 계정도 생성
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { username: 'gatat123' },
      update: {
        password: adminPassword,
        isAdmin: true,
      },
      create: {
        username: 'gatat123',
        password: adminPassword,
        email: 'admin@example.com',
        nickname: 'Admin',
        isActive: true,
        isAdmin: true,
      },
    });

    console.log('✅ 관리자 계정 생성 완료:', admin.username);

  } catch (error) {
    console.error('❌ 사용자 생성 실패:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();