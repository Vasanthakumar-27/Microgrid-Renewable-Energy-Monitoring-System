# PHASE 1: TESTING & VALIDATION CHECKLIST

**Date Started**: May 19, 2026
**Tester**: Automated + Manual
**Target Completion**: May 22-23, 2026

---

## **PART A: AUTHENTICATION & AUTHORIZATION (6 tests)**

### Test A1: Admin Login
- **Steps**: Navigate to `http://localhost:5000` → Select "Admin" → Enter `company`/`company123` → Click Login
- **Expected**: Dashboard loads with operator list, tariff rates, disputes, maintenance, audit logs sections
- **Verify**: URL changes to `#/admin`, page displays admin-specific content
- **Status**: ⬜

### Test A2: Operator Login
- **Steps**: Login as `operator`/`operator123`
- **Expected**: Dashboard shows customer list, disputes, maintenance, grid info
- **Verify**: URL shows `#/operator`, operator-specific sections visible
- **Status**: ⬜

### Test A3: Customer Login
- **Steps**: Login as `customer`/`customer123`
- **Expected**: Dashboard shows billing info, energy consumption chart, payment history, notifications, profile
- **Verify**: URL shows `#/customer`, customer-specific sections visible
- **Status**: ⬜

### Test A4: Invalid Credentials
- **Steps**: Enter wrong password or username
- **Expected**: Error message appears, page stays on login
- **Verify**: Does NOT redirect to dashboard
- **Status**: ⬜

### Test A5: Session Expiry
- **Steps**: Login → Wait 30+ minutes (if configured) OR manually expire token
- **Expected**: Next action redirects to login page
- **Verify**: User cannot access protected routes
- **Status**: ⬜

### Test A6: Authorization Check - Role Isolation
- **Steps**: Login as Customer → Manually navigate to `#/admin` (via browser console)
- **Expected**: Page shows error or redirects to customer dashboard
- **Verify**: Customer cannot see admin data
- **Status**: ⬜

---

## **PART B: ADMIN ROLE FEATURES (8 tests)**

### Test B1: Operator Filter Badge
- **Steps**: Admin dashboard → Click operator filter dropdown → Select "operator" → Apply
- **Expected**: Badge appears showing "Viewing operator's data" with "Clear filter" button
- **Verify**: Only selected operator's data shown in all views; analytics charts updated
- **Status**: ⬜

### Test B2: Analytics No Crash on Filter
- **Steps**: Admin dashboard → Scroll to analytics → Apply operator filter
- **Expected**: Charts load without error (confirms async/await fix)
- **Verify**: Console shows no errors, charts display filtered data
- **Status**: ⬜

### Test B3: Operator Create/Update
- **Steps**: Click "Add Operator" → Fill name, password, grid count, location → Save
- **Expected**: Operator added to list; can edit later by clicking operator row → Modal opens
- **Verify**: New operator appears in customer's operator dropdown; password hashed in DB
- **Status**: ⬜

### Test B4: Operator Edit Modal (Not Prompt)
- **Steps**: Click on operator name in admin list
- **Expected**: Modal form opens with fields pre-filled (name, password, grid count, location)
- **Verify**: No `prompt()` dialog appears; modal has Cancel/Save buttons; can edit fields
- **Status**: ⬜

### Test B5: Tariff Rate Bounds Validation
- **Steps**: Click "Manage Tariffs" → Try to enter rate = 0.05 INR/kWh (below min 0.1)
- **Expected**: Error: "Tariff rate must be between 0.1 and 100 INR/kWh"
- **Verify**: Cannot save invalid rate; try rate = 150 (above max 100) → Same error
- **Status**: ⬜

### Test B6: Bill Dispute Resolution
- **Steps**: Go to Disputes section → View customer disputes → Click "Approve" on one
- **Expected**: Dispute status changes to "APPROVED", resolution note field appears in log
- **Verify**: Audit log shows admin action; customer can see resolved dispute status
- **Status**: ⬜

### Test B7: Maintenance Ticket Resolution
- **Steps**: Go to Maintenance section → View tickets → Click "Mark Resolved" on one
- **Expected**: Status changes to "COMPLETED", cost is recorded, completion timestamp added
- **Verify**: Ticket no longer appears in "Open" list; appears in "Completed" history
- **Status**: ⬜

### Test B8: Audit Log Search & Pagination
- **Steps**: Go to Audit Logs section → Scroll through logs → See entries for operator create, customer create, payment, etc.
- **Expected**: Each action logged with timestamp, actor role, entity, changes
- **Verify**: Pagination works (e.g., shows 50 logs per page); can sort by date
- **Status**: ⬜

---

## **PART C: OPERATOR ROLE FEATURES (6 tests)**

### Test C1: Customer Create with Grid Validation
- **Steps**: Operator dashboard → Click "Add Customer" → Try to add without grid assigned to operator
- **Expected**: Error: "Operator has no assigned grids. Cannot create customer."
- **Verify**: Cannot proceed; assign grids to operator (admin role) → Then customer creation works
- **Status**: ⬜

### Test C2: Customer Contact Validation
- **Steps**: Operator creates customer → Try to save with empty phone or location
- **Expected**: Error appears inline: "Phone is required" / "Location is required"
- **Verify**: Cannot save customer with missing contact info
- **Status**: ⬜

### Test C3: Customer Edit Modal (Not Prompt)
- **Steps**: Operator dashboard → Click on customer name
- **Expected**: Modal form opens with current name, phone, location pre-filled
- **Verify**: No `prompt()` dialog; modal has proper Cancel/Save buttons
- **Status**: ⬜

### Test C4: View Customer Disputes
- **Steps**: Operator dashboard → Go to Disputes section
- **Expected**: List shows all customer disputes for operator's customers
- **Verify**: Can click dispute to see details (reason, evidence, status); only operator's customers shown
- **Status**: ⬜

### Test C5: Create Maintenance Ticket
- **Steps**: Operator dashboard → Maintenance section → "Create Ticket"
- **Expected**: Form opens with fields: Grid, Issue, Priority (LOW/MEDIUM/HIGH)
- **Verify**: Ticket created; appears in operator's maintenance list; assigned to operator's grid
- **Status**: ⬜

### Test C6: Resolved Alerts History Scoping
- **Steps**: Operator dashboard → View resolved alerts history
- **Expected**: Only alerts from operator's assigned grids shown
- **Verify**: If operator has grids [1,2], only alerts from grids 1-2 appear; no grid 3,4,5 data
- **Status**: ⬜

---

## **PART D: CUSTOMER ROLE FEATURES (9 tests)**

### Test D1: Profile Self-Edit
- **Steps**: Customer dashboard → Click "Edit Profile" button
- **Expected**: Modal form opens with fields: Name, Phone, Location, Email (pre-filled with current values)
- **Verify**: Can update any field → Click Save → Changes reflected in dashboard; audit log records change
- **Status**: ⬜

### Test D2: Bill Month Selector
- **Steps**: Customer dashboard → Billing section → See dropdown "Select Month: June 2024 ▼"
- **Expected**: Can select any previous month (e.g., "May 2024")
- **Verify**: Bill details update instantly for selected month without page refresh
- **Status**: ⬜

### Test D3: Payment Method Selection
- **Steps**: Customer billing section → Payment form → Dropdown shows: ONLINE, OFFLINE_CASH, CHEQUE, BANK_TRANSFER, E_WALLET
- **Expected**: Can select any payment method; form accepts selection
- **Verify**: Selected method is submitted with payment; recorded in Payment model
- **Status**: ⬜

### Test D4: Payment Amount Capping
- **Steps**: Current bill is INR 1000 → Try to pay INR 1500
- **Expected**: Payment capped; message shows "Applied INR 1000 (capped from INR 1500)"
- **Verify**: Only INR 1000 applied; remaining balance shows INR 0
- **Status**: ⬜

### Test D5: Payment Month Validation
- **Steps**: Directly call API: `POST /customer/:id/payment` with month = "2025-13" or "2024-00"
- **Expected**: Error: "Invalid month key"
- **Verify**: Cannot create bill for invalid month; rejects nonsensical data
- **Status**: ⬜

### Test D6: Bill History Pagination
- **Steps**: Customer dashboard → Click "Bill History" tab
- **Expected**: Shows 12 bills per page with "Next" button visible if more bills exist
- **Verify**: Click "Next" → Shows next 12 bills; "Prev" button appears; pagination works both directions
- **Status**: ⬜

### Test D7: Create Bill Dispute
- **Steps**: Customer dashboard → Disputes section → Click "Create Dispute"
- **Expected**: Form opens with fields: Month, Reason, Evidence (text area)
- **Verify**: Can submit dispute; dispute appears in customer's disputes list with status "OPEN"
- **Status**: ⬜

### Test D8: View Notifications
- **Steps**: Customer dashboard → Notifications section
- **Expected**: Shows unread notification count; lists notifications (bill generated, payment receipt, payment reminder)
- **Verify**: Can click notification to read it; notification count updates after marking read
- **Status**: ⬜

### Test D9: Energy Consumption Chart Auto-Refresh
- **Steps**: Customer dashboard → Energy Consumption chart → Change selector from "Day" to "Month" to "Year"
- **Expected**: Chart updates immediately on each selection (no "Load" button needed)
- **Verify**: Data refreshes without manual action; smooth UX
- **Status**: ⬜

---

## **PART E: SYSTEM-WIDE FEATURES (8 tests)**

### Test E1: Monthly Bill Scheduler
- **Steps**: Restart server: `npm start` → Wait 5 seconds → Check MongoDB for bills collection
- **Expected**: Bills exist for all customers for current month (2026-05)
- **Verify**: `db.bills.find({ month: "2026-05" })` returns documents; all customers have entry
- **Status**: ⬜

### Test E2: Bill Generation Notification
- **Steps**: Check MongoDB: `db.notifications.find({ type: "BILL_GENERATED" })`
- **Expected**: Notification created for each customer after bill generation
- **Verify**: Message contains "Bill generated for May 2026"
- **Status**: ⬜

### Test E3: Payment Reminder Scheduler
- **Steps**: Server running → Wait for daily reminder sweep (or manually trigger)
- **Expected**: Notifications created for customers with pending bills
- **Verify**: `db.notifications.find({ type: "PAYMENT_REMINDER" })` has entries; one per overdue customer per day (not spammed)
- **Status**: ⬜

### Test E4: Audit Log Completeness
- **Steps**: Perform actions: Admin creates operator → Operator creates customer → Customer pays bill
- **Expected**: Each action logged in `db.auditlogs`
- **Verify**: Entries include: role, action, entityType, entityId, timestamp, changes object
- **Status**: ⬜

### Test E5: Payment Receipt Notification
- **Steps**: Customer makes payment → Check MongoDB
- **Expected**: Notification created with type "PAYMENT_RECEIPT"
- **Verify**: Message shows amount paid, date, method; customer sees in notifications panel
- **Status**: ⬜

### Test E6: Operator Password Hashing
- **Steps**: Admin creates operator with password "Test123!" → Check MongoDB
- **Expected**: Password NOT stored as plaintext; stored as hashed value
- **Verify**: `db.operators.findOne({ name: "operator" })` → password field is hash (not readable text)
- **Status**: ⬜

### Test E7: Tariff Rate Auditing
- **Steps**: Admin updates tariff rate → Check audit log
- **Expected**: Audit entry shows old value and new value in "changes" field
- **Verify**: Admin can see full history of tariff changes
- **Status**: ⬜

### Test E8: .env Configuration
- **Steps**: Check `server.js` console output on startup
- **Expected**: Port, MongoDB URI, scheduler intervals all read from .env or use defaults
- **Verify**: Can change .env values and see them reflected (without code changes)
- **Status**: ⬜

---

## **PART F: SECURITY & DATA SCOPING (7 tests)**

### Test F1: Customer Cannot See Other Customers' Bills
- **Steps**: Login as customer1 (cust-1) → Try to access `/customer/cust-2/bills` via API
- **Expected**: 403 Forbidden or 401 Unauthorized
- **Verify**: Cannot retrieve other customer's data
- **Status**: ⬜

### Test F2: Operator Cannot See Other Operator's Grids
- **Steps**: Operator1 assigned grids [1,2] → Try to access grid 3 data via API
- **Expected**: API returns only grids [1,2]; grid 3 filtered out
- **Verify**: No data leak of other operator's customers
- **Status**: ⬜

### Test F3: Customer Cannot Edit Other Customer's Profile
- **Steps**: Login as customer1 → Try `PUT /customer/cust-2` with data
- **Expected**: 403 Forbidden
- **Verify**: Cannot modify other customer's profile
- **Status**: ⬜

### Test F4: Operator Cannot Create Customer for Another Operator's Grid
- **Steps**: Operator1 assigned to grid 1 → Try to create customer on grid 2 (another operator's grid)
- **Expected**: API validates grid ownership; rejects if not operator's grid
- **Verify**: Cannot create customer on unassigned grid
- **Status**: ⬜

### Test F5: Admin Can See All Data (No Scoping)
- **Steps**: Admin dashboard → Operator filter is OPTIONAL (can view all or filter)
- **Expected**: Without filter, admin sees all operators, customers, grids
- **Verify**: Admin has unrestricted access; filter is convenience feature, not restriction
- **Status**: ⬜

### Test F6: No SQL Injection via Payment Month
- **Steps**: Try to pay with month = `"2026-05' OR '1'='1"` (SQL injection attempt)
- **Expected**: Month validation fails; error: "Invalid month key"
- **Verify**: Cannot inject SQL through month field
- **Status**: ⬜

### Test F7: Audit Log Immutability
- **Steps**: Admin tries to delete or modify audit log entry directly
- **Expected**: Cannot modify/delete; audit logs are append-only
- **Verify**: Audit log serves compliance purpose; cannot be tampered with
- **Status**: ⬜

---

## **PART G: EDGE CASES & ERROR HANDLING (8 tests)**

### Test G1: Create Operator Without Name
- **Steps**: Admin form → Leave name empty → Try to save
- **Expected**: Error: "Name is required"
- **Verify**: Form validation prevents empty submission
- **Status**: ⬜

### Test G2: Create Payment with Negative Amount
- **Steps**: Customer payment form → Enter amount = -500
- **Expected**: Error: "Amount must be positive"
- **Verify**: Cannot submit negative payment
- **Status**: ⬜

### Test G3: Create Customer for Non-Existent Operator
- **Steps**: Operator deletes themselves (if allowed) → API call creates customer for deleted operator
- **Expected**: Error: "Operator not found"
- **Verify**: Referential integrity maintained
- **Status**: ⬜

### Test G4: Dispute with Invalid Month
- **Steps**: Customer tries to create dispute for month = "2026-13"
- **Expected**: Error: "Invalid month"
- **Verify**: Cannot dispute non-existent bills
- **Status**: ⬜

### Test G5: Maintenance Ticket Priority Validation
- **Steps**: Try to create maintenance ticket with priority = "CRITICAL" (invalid value)
- **Expected**: Error: "Priority must be LOW, MEDIUM, or HIGH"
- **Verify**: Enum validation enforced
- **Status**: ⬜

### Test G6: Dispute Status Transitions
- **Steps**: Create dispute (status = "OPEN") → Try to change directly to "COMPLETED" (skipping "UNDER_REVIEW")
- **Expected**: Allow or block based on workflow rules
- **Verify**: Consistent state machine; no invalid transitions
- **Status**: ⬜

### Test G7: Duplicate Payment Same Month
- **Steps**: Customer pays INR 500 for May 2026 → Pay another INR 500 for same month
- **Expected**: Both payments accepted; combined total = INR 1000
- **Verify**: Can make multiple payments per month; amounts accumulate
- **Status**: ⬜

### Test G8: Missing Required .env Variables
- **Steps**: Delete `MONGO_URI` from .env → Restart server
- **Expected**: Server uses default value from appConfig (should work or log warning)
- **Verify**: Graceful fallback; application doesn't crash
- **Status**: ⬜

---

## **PART H: PERFORMANCE BASELINE (5 tests)**

### Test H1: Bill API Response Time
- **Steps**: Load 10,000 customer bills in MongoDB → API call: `GET /customer/:id/bills?limit=100`
- **Expected**: Response time < 500ms
- **Measure**: Use browser DevTools Network tab
- **Status**: ⬜

### Test H2: Customer Dashboard Load Time
- **Steps**: Login as customer → Dashboard fully loads (all charts, tables, sections)
- **Expected**: Page fully interactive < 2 seconds
- **Measure**: DevTools Performance tab; LCP (Largest Contentful Paint) metric
- **Status**: ⬜

### Test H3: Audit Log Query (10k entries)
- **Steps**: API call: `GET /company/audit-logs?limit=50`
- **Expected**: Response time < 1 second
- **Measure**: DevTools Network tab
- **Status**: ⬜

### Test H4: Pagination with Large Result Set
- **Steps**: Query bills with limit=1000 on 50k records
- **Expected**: Database doesn't retrieve all records; pagination limits results
- **Measure**: Check MongoDB query execution plan (`.explain()`)
- **Status**: ⬜

### Test H5: Concurrent Logins (5 users)
- **Steps**: Open 5 browser windows; login with different users simultaneously
- **Expected**: All login successfully within 2 seconds each; no race conditions
- **Measure**: Note login completion times
- **Status**: ⬜

---

## **PART I: BROWSER COMPATIBILITY (3 tests)**

### Test I1: Chrome
- **Steps**: Run full test suite on Chrome latest
- **Expected**: All features work; no console errors
- **Status**: ⬜

### Test I2: Firefox
- **Steps**: Run full test suite on Firefox latest
- **Expected**: All features work; no console errors
- **Status**: ⬜

### Test I3: Edge
- **Steps**: Run full test suite on Edge latest
- **Expected**: All features work; no console errors
- **Status**: ⬜

---

## **PART J: DATABASE INTEGRITY (4 tests)**

### Test J1: No Orphaned Records
- **Steps**: Customer deleted → Check for payments/disputes still referencing deleted customer
- **Expected**: Option 1: Cascade delete (payments/disputes also deleted) OR Option 2: Soft delete (records kept but marked inactive)
- **Verify**: Decide on approach; implement consistently
- **Status**: ⬜

### Test J2: Index Performance
- **Steps**: Query: `db.bills.find({ customerId: "cust-1", month: "2026-05" })`
- **Expected**: Uses index (see EXPLAIN output); scan rate low
- **Verify**: Indexes created for common queries
- **Status**: ⬜

### Test J3: Transaction Consistency
- **Steps**: Customer makes payment while bill is being generated → Both succeed without conflict
- **Expected**: Payment applied correctly to bill; no race condition
- **Verify**: MongoDB transactions work if needed (multi-document)
- **Status**: ⬜

### Test J4: Backup & Recovery
- **Steps**: Create backup of MongoDB → Insert test data → Restore backup → Verify test data gone
- **Expected**: Restore successful; old data restored, new test data removed
- **Verify**: Backup/restore process works
- **Status**: ⬜

---

## **SUMMARY METRICS**

| Category | Total Tests | Status |
|----------|------------|--------|
| A. Auth & Authorization | 6 | ⬜⬜⬜⬜⬜⬜ |
| B. Admin Features | 8 | ⬜⬜⬜⬜⬜⬜⬜⬜ |
| C. Operator Features | 6 | ⬜⬜⬜⬜⬜⬜ |
| D. Customer Features | 9 | ⬜⬜⬜⬜⬜⬜⬜⬜⬜ |
| E. System-Wide | 8 | ⬜⬜⬜⬜⬜⬜⬜⬜ |
| F. Security & Scoping | 7 | ⬜⬜⬜⬜⬜⬜⬜ |
| G. Edge Cases | 8 | ⬜⬜⬜⬜⬜⬜⬜⬜ |
| H. Performance | 5 | ⬜⬜⬜⬜⬜ |
| I. Browser Compat | 3 | ⬜⬜⬜ |
| J. DB Integrity | 4 | ⬜⬜⬜⬜ |
| **TOTAL** | **64 TESTS** | |

---

## **TESTING PROCEDURE**

1. **Manual Testing** (First pass - identify critical issues)
   - Open browser to `http://localhost:5000`
   - Follow each test case step-by-step
   - Mark ✅ (pass) or ❌ (fail) with notes

2. **Bug Logging** (If failures found)
   - Document: Test name, steps, expected vs actual, severity (Critical/High/Medium/Low)
   - Create GitHub issue or local bug report

3. **Fix & Retest** (For each bug)
   - Implement fix
   - Rerun affected tests
   - Verify no regression in other tests

4. **Performance Measurement**
   - Use DevTools, load testing tools
   - Document baseline numbers
   - Compare against target thresholds

5. **Sign-Off**
   - All 64 tests pass ✅
   - No critical bugs remaining
   - Performance baseline documented
   - Security checks passed
   - **Phase 1 Complete → Move to Phase 2**

---

## **TEST EXECUTION LOG**

**Date**: _________
**Tester**: _________
**Browser**: _________
**Server**: _________

| Test ID | Result | Notes | Time |
|---------|--------|-------|------|
| A1 | ⬜ | | |
| A2 | ⬜ | | |
| ... | ... | ... | ... |

---

## **KNOWN ISSUES (Pre-Testing)**

None expected - all 50+ patches applied cleanly, npm dependencies installed, no syntax errors.

---

## **NEXT ACTIONS**

- [ ] Print/save this checklist
- [ ] Start testing in browser (Part A first)
- [ ] Log results as you go
- [ ] Fix any bugs found
- [ ] Document performance baselines
- [ ] Final sign-off when all tests pass
- [ ] Proceed to Phase 2 (Integrations)

---

**END OF PHASE 1 TEST CHECKLIST**
