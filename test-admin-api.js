// 로컬에서 admin stats API 테스트
const fetch = require('node-fetch');

async function testAdminStats() {
  try {
    // Railway 프로덕션 서버 URL
    const BASE_URL = 'https://studioo-backend-production.up.railway.app';

    // 먼저 로그인
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'gatat123',
        password: 'wjdtnwls1' // 실제 비밀번호로 변경 필요
      })
    });

    const loginData = await loginResponse.json();

    if (!loginData.accessToken) {
      console.error('Login failed:', loginData);
      return;
    }

    console.log('Login successful, token received');
    console.log('User info:', {
      username: loginData.user.username,
      isAdmin: loginData.user.isAdmin
    });

    // Admin stats API 호출
    const statsResponse = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: {
        'Authorization': `Bearer ${loginData.accessToken}`
      }
    });

    if (!statsResponse.ok) {
      console.error('Stats API failed:', statsResponse.status, statsResponse.statusText);
      const errorText = await statsResponse.text();
      console.error('Error response:', errorText);
      return;
    }

    const statsData = await statsResponse.json();

    console.log('\n=== Admin Dashboard Stats from API ===');
    console.log(JSON.stringify(statsData, null, 2));

    // 실제 데이터베이스 값과 비교
    console.log('\n=== Comparison with Database ===');
    console.log('Database Total Users: 16, API returned:', statsData.users?.total);
    console.log('Database Active Users: 15, API returned:', statsData.users?.active);
    console.log('Database Total Projects: 28, API returned:', statsData.projects?.total);
    console.log('Database Total Scenes: 18, API returned:', statsData.scenes?.total);
    console.log('Database Total Comments: 35, API returned:', statsData.comments?.total);
    console.log('Database Work Tasks: 1, API returned:', statsData.workTasks?.total);
    console.log('Database Sub Tasks: 4, API returned:', statsData.subTasks?.total);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Railway 프로덕션 서버 테스트 실행
console.log('Testing Railway production server admin API...');
testAdminStats();