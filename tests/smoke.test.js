const { spawn } = require('child_process');
const assert = require('assert');
const path = require('path');

// 启动测试端口
const TEST_PORT = 3005;
const env = { ...process.env, PORT: TEST_PORT, JWT_SECRET: 'smoke_test_secret' };

console.log('正在启动测试服务器...');
const serverProcess = spawn('node', ['server.js'], { 
  cwd: path.join(__dirname, '..'),
  env 
});

let serverOutput = '';
serverProcess.stdout.on('data', (data) => {
  serverOutput += data.toString();
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server Error Output:', data.toString());
});

// 等待服务器启动并运行测试
setTimeout(async () => {
  console.log('测试服务器已启动。开始进行 API 冒烟测试...');
  
  try {
    const baseUrl = `http://localhost:${TEST_PORT}`;

    // 测试1: 获取政策列表
    console.log('[测试1] 获取政策列表: GET /api/policies');
    const policiesRes = await fetch(`${baseUrl}/api/policies`);
    assert.strictEqual(policiesRes.status, 200, 'Policies API status should be 200');
    const policiesData = await policiesRes.json();
    assert.strictEqual(policiesData.success, true, 'Policies API should return success');
    assert.ok(Array.isArray(policiesData.policies), 'Policies should be an array');
    console.log(` -> 成功获取到 ${policiesData.total} 条政策。`);

    // 测试2: 注册新用户
    console.log('[测试2] 注册新用户: POST /api/auth/register');
    const testUserPhone = '135' + Math.floor(10000000 + Math.random() * 90000000).toString();
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '测试用户',
        phone: testUserPhone,
        password: 'testPassword123',
        role: 'citizen'
      })
    });
    assert.strictEqual(registerRes.status, 201, 'Register API status should be 201');
    const registerData = await registerRes.json();
    assert.strictEqual(registerData.success, true, 'Register should succeed');
    assert.ok(registerData.token, 'Register response should contain JWT token');
    console.log(' -> 用户注册成功，Token 已生成。');

    // 测试3: 登录已注册的用户
    console.log('[测试3] 用户登录: POST /api/auth/login');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testUserPhone,
        password: 'testPassword123',
        role: 'citizen'
      })
    });
    assert.strictEqual(loginRes.status, 200, 'Login API status should be 200');
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true, 'Login should succeed');
    assert.ok(loginData.token, 'Login response should contain token');
    const userToken = loginData.token;
    console.log(' -> 用户登录成功。');

    // 测试4: 获取个人档案 (Auth)
    console.log('[测试4] 获取当前用户信息: GET /api/auth/me');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert.strictEqual(meRes.status, 200, 'Me API status should be 200');
    const meData = await meRes.json();
    assert.strictEqual(meData.success, true);
    assert.strictEqual(meData.user.phone, testUserPhone, 'Me API should return correct user profile');
    console.log(' -> 获取当前登录用户成功，身份校对一致。');

    // 测试5: 获取数据看板统计
    console.log('[测试5] 看板数据统计: GET /api/dashboard/stats');
    const statsRes = await fetch(`${baseUrl}/api/dashboard/stats`);
    assert.strictEqual(statsRes.status, 200);
    const statsData = await statsRes.json();
    assert.strictEqual(statsData.success, true);
    assert.ok(statsData.stats.totalItems, 'Stats should contain totalItems');
    console.log(' -> 板数据读取成功。');

    console.log('\n======================================');
    console.log(' 所有 API 冒烟测试成功通过！[PASSED] ');
    console.log('======================================');
    cleanup(0);

  } catch (err) {
    console.error('\n======================================');
    console.error(' 测试失败！[FAILED] ');
    console.error(err);
    console.error('======================================');
    cleanup(1);
  }
}, 2000);

function cleanup(exitCode) {
  console.log('正在关闭测试服务器...');
  serverProcess.kill();
  process.exit(exitCode);
}
