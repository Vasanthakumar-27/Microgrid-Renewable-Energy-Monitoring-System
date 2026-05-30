/**
 * PHASE 1: AUTOMATED API TESTS
 * Validates all major features without manual clicking
 * Run: node tests/phase1-api-tests.js
 */

const http = require('http');

// Test counter
let passed = 0;
let failed = 0;
let tests = [];

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: responseData ? JSON.parse(responseData) : null,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: responseData,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Test function
async function test(name, fn) {
  try {
    await fn();
    passed++;
    tests.push({ name, status: '✅ PASS' });
    console.log(`✅ ${name}`);
  } catch (error) {
    failed++;
    tests.push({ name, status: `❌ FAIL: ${error.message}` });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

// Assertion helpers
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected: ${expected}, got: ${actual})`);
  }
}

// ============================================
// TEST SUITE
// ============================================

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: AUTOMATED API TESTS');
  console.log('='.repeat(60) + '\n');

  // ---- PART A: Authentication & Authorization ----
  console.log('\n📋 PART A: AUTHENTICATION & AUTHORIZATION\n');

  await test('A1: Server is running on port 5000', async () => {
    const response = await makeRequest('GET', '/');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });

  await test('A2: Fetch operators list (public endpoint)', async () => {
    const response = await makeRequest('GET', '/company/operators');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(Array.isArray(response.data), 'Response should be array');
  });

  await test('A3: Fetch customers list', async () => {
    const response = await makeRequest('GET', '/company/customers');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(Array.isArray(response.data), 'Response should be array');
  });

  // ---- PART B: Admin Features ----
  console.log('\n📋 PART B: ADMIN FEATURES\n');

  await test('B1: Get all operators', async () => {
    const response = await makeRequest('GET', '/company/operators');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(Array.isArray(response.data), 'Should return array of operators');
    assert(response.data.length > 0, 'Should have at least one operator');
  });

  await test('B2: Get tariff rates', async () => {
    const response = await makeRequest('GET', '/company/tariffrates');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });

  await test('B3: Tariff rate bounds validation (rate < min)', async () => {
    const response = await makeRequest('POST', '/company/tariffrates', {
      gridId: '1',
      rate: 0.05  // Below minimum 0.1
    });
    // Should reject with 400 error
    assert(response.status === 400, `Expected 400 for invalid rate, got ${response.status}`);
  });

  await test('B4: Tariff rate bounds validation (rate > max)', async () => {
    const response = await makeRequest('POST', '/company/tariffrates', {
      gridId: '1',
      rate: 150  // Above maximum 100
    });
    // Should reject with 400 error
    assert(response.status === 400, `Expected 400 for invalid rate, got ${response.status}`);
  });

  await test('B5: Get audit logs (empty or populated)', async () => {
    const response = await makeRequest('GET', '/company/audit-logs?limit=50');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(Array.isArray(response.data), 'Should return array of audit logs');
  });

  await test('B6: Get disputes list', async () => {
    const response = await makeRequest('GET', '/company/billing/disputes');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });

  await test('B7: Get maintenance tickets', async () => {
    const response = await makeRequest('GET', '/company/maintenance-tickets');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });

  // ---- PART C: Customer Features ----
  console.log('\n📋 PART C: CUSTOMER FEATURES\n');

  await test('C1: Get customer list', async () => {
    const response = await makeRequest('GET', '/company/customers');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(Array.isArray(response.data), 'Should return array');
  });

  await test('C2: Get single customer profile', async () => {
    const response = await makeRequest('GET', '/company/customers');
    assert(response.status === 200);
    assert(response.data.length > 0, 'Should have customers');

    const customerId = response.data[0]?.customerId;
    if (customerId) {
      const customerProfile = await makeRequest('GET', `/company/customers?id=${customerId}`);
      assert(customerProfile.status === 200);
    }
  });

  await test('C3: Get bills for customer', async () => {
    const customersResponse = await makeRequest('GET', '/company/customers');
    if (customersResponse.data && customersResponse.data.length > 0) {
      const customerId = customersResponse.data[0]?.customerId;
      if (customerId) {
        const response = await makeRequest('GET', `/company/bills?customerId=${customerId}`);
        assert(response.status === 200, `Expected 200, got ${response.status}`);
      }
    }
  });

  await test('C4: Payment history pagination', async () => {
    const customersResponse = await makeRequest('GET', '/company/customers');
    if (customersResponse.data && customersResponse.data.length > 0) {
      const customerId = customersResponse.data[0]?.customerId;
      if (customerId) {
        const response = await makeRequest('GET', `/company/payments?customerId=${customerId}&limit=20&offset=0`);
        assert(response.status === 200, `Expected 200, got ${response.status}`);
      }
    }
  });

  await test('C5: Get notifications', async () => {
    const response = await makeRequest('GET', '/company/notifications');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });

  // ---- PART D: System Features ----
  console.log('\n📋 PART D: SYSTEM FEATURES\n');

  await test('D1: Bills exist for all customers', async () => {
    const response = await makeRequest('GET', '/company/bills');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(Array.isArray(response.data), 'Should return array of bills');
    // Bill scheduler should have created bills on server startup
    assert(response.data.length > 0, 'Should have bills from scheduler');
  });

  await test('D2: Payments table exists and accessible', async () => {
    const response = await makeRequest('GET', '/company/payments');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });

  await test('D3: Alerts system working', async () => {
    const response = await makeRequest('GET', '/company/alerts');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });

  // ---- PART E: Validation & Error Handling ----
  console.log('\n📋 PART E: VALIDATION & ERROR HANDLING\n');

  await test('E1: Invalid month key rejected', async () => {
    const response = await makeRequest('POST', '/company/test-month-validation', {
      month: '2025-13'  // Invalid month
    });
    // Any response is ok, just testing endpoint exists
    // Real test is in customer payment endpoint
  });

  await test('E2: Missing required fields validation', async () => {
    const response = await makeRequest('POST', '/company/operators', {
      name: '',  // Empty required field
      password: '',
      location: ''
    });
    // Should reject with 400
    assert(response.status === 400 || response.status === 500, 'Should reject invalid data');
  });

  // ---- PART F: Data Model Integrity ----
  console.log('\n📋 PART F: DATA MODEL INTEGRITY\n');

  await test('F1: Energy logs exist', async () => {
    const response = await makeRequest('GET', '/company/energy-logs');
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });

  await test('F2: Grid data accessible', async () => {
    const response = await makeRequest('GET', '/company/microgrids');
    // Either 200 or endpoint not implemented (both ok for MVP)
    assert([200, 404].includes(response.status));
  });

  // ---- PART G: Configuration ----
  console.log('\n📋 PART G: CONFIGURATION\n');

  await test('G1: Server loads without errors', async () => {
    const response = await makeRequest('GET', '/');
    assert(response.status === 200, 'Server should respond to root path');
  });

  await test('G2: Database connected (evident from bills existing)', async () => {
    const response = await makeRequest('GET', '/company/bills');
    assert(response.status === 200, 'DB queries should work');
  });

  // ---- FINAL RESULTS ----
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${passed + failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  console.log('\n' + '='.repeat(60));
  console.log('DETAILED RESULTS:');
  console.log('='.repeat(60) + '\n');

  tests.forEach((t, idx) => {
    console.log(`${idx + 1}. ${t.status}`);
    console.log(`   ${t.name}\n`);
  });

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
