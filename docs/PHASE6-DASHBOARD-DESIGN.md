# PHASE 6: DASHBOARD UI/UX DESIGN
## Mock-ups and Component Specifications

---

## 1. MAIN DASHBOARD LAYOUT

```
┌────────────────────────────────────────────────────────────────────┐
│  🏠 Microgrid City System                   👤 User   🔔 🎨 ⚙️    │
├────────────────────────────────────────────────────────────────────┤
│ 📊 Dashboard  📈 Analytics  💰 Billing  ⚡ Operations  📋 Reports │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Dashboard: Executive Overview          [🔄 Refresh] [⚙️ Customize]│
│                                                                    │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────┐ │
│  │ Total Revenue       │ │ Total Consumption   │ │ Active Users │ │
│  │ ₹24,56,800          │ │ 45,230 kWh          │ │ 1,234        │ │
│  │ ↑ 12% vs last month │ │ ↓ 5% vs last month  │ │ ↑ 3% today   │ │
│  └─────────────────────┘ └─────────────────────┘ └──────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  Revenue Trend (Last 12 Months)  │ │  Top Consuming Zones     │ │
│  │                                  │ │                          │ │
│  │  ₹3M    ╱╲                       │ │  Zone-A: 15,234 kWh █   │ │
│  │  ₹2M  ╱  ╲  ╱╲                  │ │  Zone-B: 12,456 kWh ███ │ │
│  │  ₹1M ╱    ╲╱  ╲                 │ │  Zone-C:  8,945 kWh ██  │ │
│  │      J F M A M J J A S O N D    │ │  Zone-D:  5,123 kWh █   │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  System Health                   │ │  Quick Actions           │ │
│  │  ✅ API: 99.8%                   │ │  [Generate Report]       │ │
│  │  ✅ Database: 99.9%              │ │  [Export Data]           │ │
│  │  ✅ Cache: 95.2%                 │ │  [Schedule Maintenance]  │ │
│  │  ⚠️  Storage: 75%                │ │  [View Alerts]           │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. OPERATIONS DASHBOARD

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚡ Operations Dashboard                                    [⚙️ Edit]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Microgrid Status Overview                                         │
│                                                                    │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────┐ │
│  │ Total Capacity      │ │ Current Load        │ │ Battery Level│ │
│  │ 500 MW              │ │ 245 MW (49%)        │ │ 78%          │ │
│  │ 🟢 Optimal          │ │ 🟢 Normal           │ │ 🟡 Good      │ │
│  └─────────────────────┘ └─────────────────────┘ └──────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Real-time Energy Flow                                       │ │
│  │                                                              │ │
│  │  Solar ☀️ 120MW ──┐                                          │ │
│  │  Wind  🌀 80MW  ──┤─→ Distribution ──→ [Load Balancer]      │ │
│  │  Grid  ⚡ 45MW  ──┘                    └─→ Zone-A           │ │
│  │  Battery 🔋 50MW    Available                └─→ Zone-B     │ │
│  │                                             └─→ Zone-C     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  Microgrid Status                │ │  Active Alerts           │ │
│  │                                  │ │                          │ │
│  │  🟢 MG-001: Online       98.5%   │ │  🔴 High voltage         │ │
│  │  🟢 MG-002: Online       99.2%   │ │  🟡 Battery low (15%)    │ │
│  │  🟡 MG-003: Degraded     87.3%   │ │  🟡 Maintenance due      │ │
│  │  🔴 MG-004: Offline      0%      │ │                          │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Hourly Load Profile (24h)                                  │ │
│  │  300MW ┌─┐                                                  │ │
│  │  250MW │ │         ┌───┐                                    │ │
│  │  200MW │ │  ┌─┐    │   │    ┌─┐                            │ │
│  │  150MW │ │  │ │    │   │    │ │    ┌─────┐                │ │
│  │  100MW │ │  │ │    │   │    │ │    │     │                │ │
│  │   50MW │ │  │ │    │   │    │ │    │     │   ┌─┐          │ │
│  │        └─┴──┴─┴────┴───┴────┴─┴────┴─────┴───┴─┴─────      │ │
│  │        0  4  8  12 16 20 24                                │ │
│  │        (Time in hours)                                     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. BILLING & ANALYTICS DASHBOARD

```
┌────────────────────────────────────────────────────────────────────┐
│  💰 Billing & Analytics                              [Date Range ▼]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────┐ │
│  │ Total Billed        │ │ Total Collected     │ │ Pending      │ │
│  │ ₹2,45,680           │ │ ₹2,10,500           │ │ ₹35,180      │ │
│  │ +245 customers      │ │ 85.7% collection   │ │ -3.2%        │ │
│  └─────────────────────┘ └─────────────────────┘ └──────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  Monthly Revenue Trend           │ │  Collection Rate by Zone │ │
│  │                                  │ │                          │ │
│  │  ₹3.5M                           │ │  Zone-A: 92% ████████▒  │ │
│  │  ₹3.0M  ╱╲          ╱──╲         │ │  Zone-B: 88% ████████░  │ │
│  │  ₹2.5M ╱  ╲        ╱    ╲       │ │  Zone-C: 95% ████████▒  │ │
│  │  ₹2.0M    ╲      ╱       ╲     │ │  Zone-D: 75% ███████░░  │ │
│  │         J F M A M J J A S O N D  │ │                          │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  Payment Methods Distribution    │ │  Delinquency Tracking    │ │
│  │                                  │ │                          │ │
│  │  Online Transfer: 45% ●●●●●      │ │  < 30 days:  8 cust      │ │
│  │  Cheque/DD:      30% ●●●         │ │  30-60 days: 5 cust      │ │
│  │  Cash/Manual:    20% ●●          │ │  > 60 days:  2 cust      │ │
│  │  Credit Card:     5% ●           │ │  Amount:    ₹5,430       │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Top 10 Customers by Consumption                            │ │
│  ├─────┬──────────────────┬───────────┬──────────┬────────────┤ │
│  │ Rank│ Customer Name    │ Consump.  │ Bill Amt │ Paid       │ │
│  ├─────┼──────────────────┼───────────┼──────────┼────────────┤ │
│  │  1  │ ABC Corporation  │ 5,432 kWh │ ₹42,560  │ ✅ On time │ │
│  │  2  │ XYZ Industries   │ 4,523 kWh │ ₹35,430  │ ⚠️ Pending │ │
│  │  3  │ Tech Startup     │ 3,245 kWh │ ₹25,890  │ ✅ On time │ │
│  │  ... │ ...              │ ...       │ ...      │ ...        │ │
│  │  10 │ Service Center   │ 1,234 kWh │ ₹9,870   │ ✅ On time │ │
│  └─────┴──────────────────┴───────────┴──────────┴────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. CUSTOMER ANALYTICS DASHBOARD

```
┌────────────────────────────────────────────────────────────────────┐
│  👥 Customer Analytics                         [Customer Segment ▼]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────┐ │
│  │ Total Customers     │ │ New This Month      │ │ Churn Rate   │ │
│  │ 5,432               │ │ 145                 │ │ 0.8%         │ │
│  │ ↑ 8% YoY            │ │ ↑ 12% vs previous   │ │ ↓ 0.3%       │ │
│  └─────────────────────┘ └─────────────────────┘ └──────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  Customer Growth (12 Months)     │ │  Satisfaction Score      │ │
│  │                                  │ │                          │ │
│  │  5,500 ╱                         │ │  4.5 ★★★★☆              │ │
│  │  5,000╱                          │ │                          │ │
│  │  4,500                           │ │  Categories:             │ │
│  │        J F M A M J J A S O N D    │ │  Service:  4.6 ★★★★☆    │ │
│  │                                  │ │  Pricing:  4.2 ★★★★☆    │ │
│  │                                  │ │  Support:  4.3 ★★★★☆    │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  Usage Segmentation              │ │  Churn Risk Analysis     │ │
│  │                                  │ │                          │ │
│  │  Heavy Users:   1,200 (22%)      │ │  🟢 Low Risk:     4,800  │ │
│  │  ●●●●●●●●●●●●●●●●●●●●            │ │  🟡 Medium Risk:    500  │ │
│  │  Medium Users:  2,800 (52%)      │ │  🔴 High Risk:       32  │ │
│  │  ●●●●●●●●●●●●●●●●●●●●●●●●●●     │ │  🔴 Very High:      100  │ │
│  │  Light Users:   1,432 (26%)      │ │                          │ │
│  │  ●●●●●●●●●●●●●●                  │ │  [Intervention] [Retain] │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Predicted Churners (Next 30 Days)                          │ │
│  ├─────┬──────────────────┬────────────┬──────────┬──────────┤ │
│  │Rank │ Customer Name    │ Risk Score │ Last Bill│ Action   │ │
│  ├─────┼──────────────────┼────────────┼──────────┼──────────┤ │
│  │  1  │ John Contractor  │    92%     │ 45 days  │ [Retain] │ │
│  │  2  │ Building Maint.  │    87%     │ 38 days  │ [Retain] │ │
│  │  3  │ Small Shop       │    81%     │ 30 days  │ [Retain] │ │
│  └─────┴──────────────────┴────────────┴──────────┴──────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. PREDICTIONS & INSIGHTS DASHBOARD

```
┌────────────────────────────────────────────────────────────────────┐
│  🔮 Predictions & Insights                                  [Refresh]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  Next 30-Day Consumption Forecast│ │  AI-Generated Insights   │ │
│  │                                  │ │                          │ │
│  │  50K kWh ╱╲╱╲                    │ │  💡 Peak usage shifted   │ │
│  │  40K    ╱  ╲                     │ │     earlier by 2 hours   │ │
│  │  30K   ╱    ╲╱╲                  │ │     due to recent heat.  │ │
│  │  20K                             │ │                          │ │
│  │  10K_________________________     │ │  💡 Billing efficiency   │ │
│  │       Day 1  5  10  15  20  25-30 │ │     improved by 8% this  │ │
│  │  Confidence: 94%                 │ │     month vs. previous.  │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐ │
│  │  Anomaly Detection (Last 7 Days) │ │  Recommendations         │ │
│  │                                  │ │                          │ │
│  │  📈 Zone-B spike detected        │ │  ✓ Upgrade Zone-C       │ │
│  │     May 27, 3:45 AM              │ │    capacity (87% usage)  │ │
│  │     Likely cause: Equipment      │ │                          │ │
│  │     maintenance                  │ │  ✓ Increase battery      │ │
│  │                                  │ │    charging target       │ │
│  │  📊 Payment default pattern      │ │                          │ │
│  │     15 customers overdue         │ │  ✓ Launch retention      │ │
│  │     May 28                       │ │    campaign (100 at-risk) │ │
│  │                                  │ │                          │ │
│  └──────────────────────────────────┘ └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Model Accuracy Metrics                                     │ │
│  ├────────────────────────┬───────────┬─────────────────────────┤ │
│  │ Model                  │ Accuracy  │ Last Trained            │ │
│  ├────────────────────────┼───────────┼─────────────────────────┤ │
│  │ Consumption Forecast   │ 94.2% ✅  │ Today 02:00 AM          │ │
│  │ Billing Prediction     │ 98.7% ✅  │ Today 01:30 AM          │ │
│  │ Churn Prediction       │ 87.3% ✅  │ Yesterday 03:00 AM      │ │
│  │ Anomaly Detection      │ 91.5% ✅  │ Real-time (continuous)  │ │
│  └────────────────────────┴───────────┴─────────────────────────┘ │
│                                                                    │
│  Next model training: Today 02:00 AM                              │ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. CUSTOM REPORT BUILDER

```
┌────────────────────────────────────────────────────────────────────┐
│  📋 Report Builder                              [← Back] [Preview] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Report Configuration                                              │
│                                                                    │
│  Report Name: [Monthly Revenue Analysis            ]              │
│  Report Type: [Custom ▼]                                          │
│                                                                    │
│  ┌─ SELECT METRICS ────────────────────────────────────────────┐ │
│  │ ☑ Total Revenue          ☑ Customer Count                   │ │
│  │ ☑ Total Consumption      ☑ Payment Rate                     │ │
│  │ ☑ Avg Bill Amount        ☑ Churn Rate                       │ │
│  │ ☑ Collection Rate        ☑ Satisfaction Score               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─ FILTERS ───────────────────────────────────────────────────┐ │
│  │ Date Range: [May 1, 2026] to [May 30, 2026]                │ │
│  │ Zones: [All ▼]                                              │ │
│  │ Customer Type: [All ▼]                                      │ │
│  │ Min Consumption: [0 kWh] Max: [∞ kWh]                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─ FORMATTING ────────────────────────────────────────────────┐ │
│  │ Group By: [Zone ▼]                                          │ │
│  │ Sort By: [Total Revenue ▼] [Descending ▼]                  │ │
│  │ Include Charts: ☑  Include Summary: ☑                       │ │
│  │ Include Raw Data: ☑  Page Orientation: [Portrait ▼]        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─ SCHEDULE & DELIVERY ───────────────────────────────────────┐ │
│  │ Schedule: [Once ▼]     Run at: [02:00 AM ▼]               │ │
│  │ Recipients: [admin@mg.com; ops@mg.com]                     │ │
│  │ Format: ☑ PDF  ☑ Excel  ☑ Email  ☑ Dashboard              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│                              [Cancel] [Save as Template] [Generate]│
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 7. WIDGET CUSTOMIZATION

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚙️  Dashboard Customization                                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─ AVAILABLE WIDGETS ─────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  📊 METRICS WIDGETS                                         │ │
│  │  [Total Revenue] [Consumption] [Customers] [Collection]   │ │
│  │  [Churn Rate] [Satisfaction] [System Health] [Alerts]     │ │
│  │                                                             │ │
│  │  📈 CHART WIDGETS                                           │ │
│  │  [Line Chart] [Bar Chart] [Pie Chart] [Gauge] [Map]       │ │
│  │                                                             │ │
│  │  📋 DATA WIDGETS                                            │ │
│  │  [Data Table] [Top Customers] [Recent Activity] [Alerts]  │ │
│  │                                                             │ │
│  │  🔮 PREDICTION WIDGETS                                      │ │
│  │  [Forecast] [Anomalies] [Recommendations] [Insights]      │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Drag widgets to customize layout:                                │
│                                                                    │
│  [Total Revenue] [Consumption] [Customers]                        │
│  [Revenue Trend]              [Collection Rate]                   │
│  [Forecast]     [Anomalies]   [Top Zones]                         │
│                                                                    │
│  [Reset to Default] [Save Layout] [Load Template ▼]              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. COLOR SCHEME & DESIGN SYSTEM

### Color Palette
```
Primary Blue:    #0066CC
Secondary Green: #00AA44
Warning Yellow:  #FFAA00
Error Red:       #CC0000
Neutral Gray:    #CCCCCC
Text Dark:       #333333
Text Light:      #FFFFFF
Background:      #F5F5F5
```

### Typography
```
Headings:  Roboto Bold, 24px / 18px / 14px
Body:      Inter Regular, 14px
Numbers:   Roboto Mono, 12px
Labels:    Inter Medium, 11px
```

### Responsive Breakpoints
```
Desktop:     > 1200px
Tablet:      768px - 1200px
Mobile:      < 768px
```

---

## 9. INTERACTIVE ELEMENTS

### Tooltips
```
Hover shows: Value | Change % | Last updated
Example: ₹24.5M | +12% | Updated 2 min ago
```

### Drill-down Capability
```
Click metric → View trend → View detailed breakdown → Export data
```

### Real-time Updates
```
Badge shows: "Updating..." → "Updated at 12:34 PM"
Data refreshes every 5-10 seconds
```

---

## 10. ACCESSIBILITY FEATURES

- ✅ WCAG 2.1 Level AA compliance
- ✅ Keyboard navigation support
- ✅ Screen reader compatibility
- ✅ High contrast mode
- ✅ Responsive text sizing
- ✅ Color-blind friendly palettes

---

**Design Version**: 1.0  
**Last Updated**: May 30, 2026  
**Status**: Ready for Development  
**Next Step**: Frontend framework selection and prototyping
