document.addEventListener('DOMContentLoaded', () => {
    // --- Data Storage (In-memory for now, will be replaced by backend) ---
    let properties = JSON.parse(localStorage.getItem('properties')) || [];
    let tenants = JSON.parse(localStorage.getItem('tenants')) || [];
    let units = JSON.parse(localStorage.getItem('units')) || [];
    let payments = JSON.parse(localStorage.getItem('payments')) || [];
    let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    let waterBills = JSON.parse(localStorage.getItem('waterBills')) || [];

    // Helper function to save data to localStorage
    function saveData() {
        localStorage.setItem('properties', JSON.stringify(properties));
        localStorage.setItem('tenants', JSON.stringify(tenants));
        localStorage.setItem('units', JSON.stringify(units));
        localStorage.setItem('payments', JSON.stringify(payments));
        localStorage.setItem('expenses', JSON.stringify(expenses));
        localStorage.setItem('waterBills', JSON.stringify(waterBills));
    }

    // --- Sidebar Toggle for Responsiveness ---
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.sidebar');

    if (hamburgerMenu && sidebar) {
        hamburgerMenu.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        // Optional: Close sidebar when a menu item is clicked on mobile
        sidebar.querySelectorAll('a').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) { // Only close on smaller screens
                    sidebar.classList.remove('active');
                }
            });
        });
    }


    // --- Dashboard Overview Functions ---
    function updateDashboardSummary() {
        const totalProperties = properties.length;
        const occupiedUnits = units.filter(unit => unit.status === 'occupied').length;
        const vacantUnits = units.filter(unit => unit.status === 'vacant').length;
        const totalUnits = units.length;
        const occupancyPercentage = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : 0;

        document.getElementById('totalProperties').textContent = totalProperties;
        document.getElementById('occupancyPercentage').textContent = `${occupancyPercentage}%`;
        document.getElementById('vacantUnits').textContent = vacantUnits;
        document.getElementById('occupiedUnits').textContent = occupiedUnits;

        document.getElementById('summaryVacant').textContent = vacantUnits;
        document.getElementById('summaryOccupied').textContent = occupiedUnits;
        document.getElementById('summaryTotalUnits').textContent = totalUnits;
        document.getElementById('summaryOccupancyPercentage').textContent = `${occupancyPercentage}%`;
    }

    function updateFinancialOverview() {
        // Calculate accrued amount from expected payments (rent + water bills)
        let totalAccrued = 0;
        tenants.forEach(tenant => {
            const unit = units.find(u => u.id === tenant.unitId);
            if (unit) {
                totalAccrued += parseFloat(unit.monthlyRent || 0); // Add monthly rent
            }
            // Add any outstanding water bills for the tenant
            const tenantWaterBills = waterBills.filter(bill => bill.tenantId === tenant.id && !bill.isPaid);
            tenantWaterBills.forEach(bill => {
                totalAccrued += parseFloat(bill.amount || 0);
            });
        });

        // Calculate actual collected amount
        let totalCollected = payments.reduce((sum, payment) => sum + parseFloat(payment.amountPaid || 0), 0);
        let totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

        // For simplicity, Property Balance can be (Collected - Expenses)
        let propertyBalance = totalCollected - totalExpenses;
        let walletBalance = propertyBalance; // Can be more complex with bank accounts

        document.getElementById('propertyBalance').textContent = `Ksh ${propertyBalance.toLocaleString()}`;
        document.getElementById('accruedAmount').textContent = `Ksh ${totalAccrued.toLocaleString()}`;
        document.getElementById('walletBalance').textContent = `Ksh ${walletBalance.toLocaleString()}`;

        document.getElementById('billedAmount').textContent = `Ksh ${totalAccrued.toLocaleString()}`; // Assuming billed is accrued
        document.getElementById('collectedAmount').textContent = `Ksh ${totalCollected.toLocaleString()}`;
        const collectionPercentage = totalAccrued > 0 ? ((totalCollected / totalAccrued) * 100).toFixed(1) : 0;
        document.getElementById('collectionPercentage').textContent = `${collectionPercentage}%`;
    }

    function renderPropertyBalances() {
        const propertyBalancesDiv = document.getElementById('propertyBalances');
        propertyBalancesDiv.innerHTML = '';
        properties.forEach(property => {
            const propertyUnits = units.filter(unit => unit.propertyId === property.id);
            let totalBilled = 0;
            let totalCollected = 0;

            propertyUnits.forEach(unit => {
                totalBilled += parseFloat(unit.monthlyRent || 0);
                const unitPayments = payments.filter(p => p.unitId === unit.id && p.status === 'paid');
                totalCollected += unitPayments.reduce((sum, p) => sum + parseFloat(p.amountPaid || 0), 0);
            });

            const balance = totalBilled - totalCollected;

            const div = document.createElement('div');
            div.classList.add('property-balance-item');
            div.innerHTML = `
                <span>${property.name}</span>
                <span>Ksh ${balance.toLocaleString()}</span>
            `;
            propertyBalancesDiv.appendChild(div);
        });
    }

    function renderOutstandingBalances() {
        const outstandingBalancesDiv = document.getElementById('outstandingBalances');
        outstandingBalancesDiv.innerHTML = '';

        // Identify tenants with outstanding rent or water bills
        const outstandingTenants = tenants.filter(tenant => {
            const unit = units.find(u => u.id === tenant.unitId);
            if (!unit) return false;

            // Check for overdue rent
            const lastPaymentDate = payments.findLast(p => p.tenantId === tenant.id && p.type === 'rent')?.date || null;
            const today = new Date();
            let isRentOverdue = false;
            let monthsOverdue = 0;

            if (!lastPaymentDate) {
                // If no payment ever, assume overdue since tenant's move-in date
                const tenantStartDate = new Date(tenant.moveInDate || today);
                monthsOverdue = (today.getFullYear() - tenantStartDate.getFullYear()) * 12;
                monthsOverdue -= tenantStartDate.getMonth();
                monthsOverdue += today.getMonth();
                monthsOverdue = Math.max(0, monthsOverdue);
                isRentOverdue = monthsOverdue > 0;
            } else {
                const lastPaymentMonth = new Date(lastPaymentDate).getMonth();
                const lastPaymentYear = new Date(lastPaymentDate).getFullYear();
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();

                monthsOverdue = (currentYear - lastPaymentYear) * 12 + (currentMonth - lastPaymentMonth);

                // If payment was for current month and before due date (e.g., paid on 5th for a 1st-of-month due)
                // This logic can be tricky and might need refinement based on exact payment terms
                // For simplicity, if monthsOverdue is 0, it means payment was made in the current month
                // If monthsOverdue is 1 and it's past the typical due date (e.g., 5th of month), then it's overdue
                if (monthsOverdue > 0) { // If past payment month
                    isRentOverdue = true;
                } else if (monthsOverdue === 0 && today.getDate() > 5) { // Assuming rent due by 5th, adjust as needed
                    isRentOverdue = true;
                }
            }


            // Check for unpaid water bills
            const hasUnpaidWaterBills = waterBills.some(bill => bill.tenantId === tenant.id && !bill.isPaid);

            return isRentOverdue || hasUnpaidWaterBills;
        });

        if (outstandingTenants.length === 0) {
            outstandingBalancesDiv.innerHTML = '<p>No outstanding balances.</p>';
            return;
        }

        outstandingTenants.forEach(tenant => {
            const unit = units.find(u => u.id === tenant.unitId);
            let totalOutstanding = 0;

            // Calculate outstanding rent
            if (unit) {
                const lastPaymentDate = payments.findLast(p => p.tenantId === tenant.id && p.type === 'rent')?.date || null;
                const today = new Date();
                let monthsOverdue = 0;

                if (!lastPaymentDate) {
                    const tenantStartDate = new Date(tenant.moveInDate || today);
                    monthsOverdue = (today.getFullYear() - tenantStartDate.getFullYear()) * 12 + (today.getMonth() - tenantStartDate.getMonth());
                    monthsOverdue = Math.max(0, monthsOverdue); // Ensure non-negative
                } else {
                    const lastPaymentMonth = new Date(lastPaymentDate).getMonth();
                    const lastPaymentYear = new Date(lastPaymentDate).getFullYear();
                    const currentMonth = today.getMonth();
                    const currentYear = today.getFullYear();
                    monthsOverdue = (currentYear - lastPaymentYear) * 12 + (currentMonth - lastPaymentMonth);
                    // If payment for current month was made, don't count it as overdue.
                    // This logic assumes rent is due for the current month. If due in advance, logic changes.
                    if (monthsOverdue === 0) { // Paid this month for this month
                        monthsOverdue = 0;
                    } else if (monthsOverdue > 0) {
                        // If current date is past typical due date and payment wasn't for current month, it's overdue
                        if (new Date(lastPaymentDate).getDate() < today.getDate() && monthsOverdue === 1) { // Example: Paid on 3rd June for June, now it's 20th June. This implies current month is paid.
                             // if current month is paid, this should be 0.
                        } else {
                             monthsOverdue = Math.max(0, monthsOverdue);
                        }
                    }
                }
                totalOutstanding += (parseFloat(unit.monthlyRent || 0) * monthsOverdue);
            }

            // Calculate outstanding water bills
            const unpaidWater = waterBills.filter(bill => bill.tenantId === tenant.id && !bill.isPaid);
            unpaidWater.forEach(bill => {
                totalOutstanding += parseFloat(bill.amount || 0);
            });

            if (totalOutstanding > 0) {
                const div = document.createElement('div');
                div.classList.add('outstanding-balance-item');
                div.innerHTML = `
                    <span>${tenant.name} (${unit ? unit.number : 'N/A'})</span>
                    <span>Ksh ${totalOutstanding.toLocaleString()}</span>
                    <button class="update-payment-btn" data-tenant-id="${tenant.id}">Update Payment</button>
                `;
                outstandingBalancesDiv.appendChild(div);
            }
        });

        // Add event listeners to "Update Payment" buttons
        document.querySelectorAll('.update-payment-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const tenantId = event.target.dataset.tenantId;
                // Redirect to payments page or open a modal for payment update
                window.location.href = `payments.html?tenantId=${tenantId}`;
            });
        });
    }


    function updateUtilitiesSummary() {
        let waterTotal = 0;
        let waterPaid = 0;

        waterBills.forEach(bill => {
            waterTotal += parseFloat(bill.amount || 0);
            if (bill.isPaid) {
                waterPaid += parseFloat(bill.amount || 0);
            }
        });

        const waterBalance = waterTotal - waterPaid;
        const waterPercentage = waterTotal > 0 ? ((waterPaid / waterTotal) * 100).toFixed(1) : 0;

        document.getElementById('waterTotal').textContent = waterTotal.toLocaleString();
        document.getElementById('waterPaid').textContent = waterPaid.toLocaleString();
        document.getElementById('waterBalance').textContent = waterBalance.toLocaleString();
        document.getElementById('waterPercentage').textContent = `${waterPercentage}%`;
    }

    // --- Chart.js for Monthly Revenue Collections ---
    let revenueChart;
    function renderRevenueChart() {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        const monthlyRevenue = {}; // { 'YYYY-MM': amount }

        payments.forEach(payment => {
            const date = new Date(payment.date);
            const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            monthlyRevenue[yearMonth] = (monthlyRevenue[yearMonth] || 0) + parseFloat(payment.amountPaid || 0);
        });

        // Get the last 6 months for the chart
        const labels = [];
        const data = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
            const yearMonth = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            data.push(monthlyRevenue[yearMonth] || 0);
        }

        if (revenueChart) {
            revenueChart.destroy(); // Destroy previous chart instance
        }

        revenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: data,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount (Ksh)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    }
                }
            }
        });
    }

    // --- Page Initialization ---
    function initializeDashboard() {
        updateDashboardSummary();
        updateFinancialOverview();
        renderPropertyBalances();
        renderOutstandingBalances();
        updateUtilitiesSummary();
        renderRevenueChart();
    }

    // --- Dummy Data (for testing without backend) ---
    function generateDummyData() {
        if (properties.length === 0) {
            properties = [
                { id: 'prop1', name: 'Greenwood Apartments', type: 'Apartment', location: 'Nairobi', ownerMobile: '254712345678', description: 'Modern apartments' },
                { id: 'prop2', name: 'Riverside Villas', type: 'Villa', location: 'Mombasa', ownerMobile: '254723456789', description: 'Spacious villas' }
            ];
            units = [
                { id: 'unit1', propertyId: 'prop1', number: 'A-101', type: '1 Bedroom', classification: 'Furnished', floor: 'Ground', monthlyRent: 15000, status: 'occupied' },
                { id: 'unit2', propertyId: 'prop1', number: 'A-102', type: '2 Bedroom', classification: 'Unfurnished', floor: '1st', monthlyRent: 25000, status: 'occupied' },
                { id: 'unit3', propertyId: 'prop1', number: 'A-103', type: '1 Bedroom', classification: 'Unfurnished', floor: 'Ground', monthlyRent: 14000, status: 'vacant' },
                { id: 'unit4', propertyId: 'prop2', number: 'V-01', type: '3 Bedroom', classification: 'Furnished', floor: 'Ground', monthlyRent: 45000, status: 'occupied' }
            ];
            tenants = [
                { id: 'tenant1', unitId: 'unit1', name: 'John Doe', phone: '254701000111', email: 'john.doe@example.com', moveInDate: '2024-01-15', nextOfKin: 'Jane Doe', nextOfKinPhone: '254701000112' },
                { id: 'tenant2', unitId: 'unit2', name: 'Jane Smith', phone: '254702000222', email: 'jane.smith@example.com', moveInDate: '2024-03-01', nextOfKin: 'Peter Smith', nextOfKinPhone: '254702000223' },
                { id: 'tenant3', unitId: 'unit4', name: 'David Lee', phone: '254703000333', email: 'david.lee@example.com', moveInDate: '2023-11-20', nextOfKin: 'Sarah Lee', nextOfKinPhone: '254703000334' }
            ];
            payments = [
                { id: 'pay1', tenantId: 'tenant1', unitId: 'unit1', amountPaid: 15000, date: '2025-06-05', type: 'rent', status: 'paid' },
                { id: 'pay2', tenantId: 'tenant2', unitId: 'unit2', amountPaid: 25000, date: '2025-06-10', type: 'rent', status: 'paid' },
                { id: 'pay3', tenantId: 'tenant3', unitId: 'unit4', amountPaid: 45000, date: '2025-06-01', type: 'rent', status: 'paid' },
                { id: 'pay4', tenantId: 'tenant1', unitId: 'unit1', amountPaid: 15000, date: '2025-05-05', type: 'rent', status: 'paid' },
                { id: 'pay5', tenantId: 'tenant2', unitId: 'unit2', amountPaid: 25000, date: '2025-05-10', type: 'rent', status: 'paid' },
                { id: 'pay6', tenantId: 'tenant3', unitId: 'unit4', amountPaid: 45000, date: '2025-05-01', type: 'rent', status: 'paid' },
                { id: 'pay7', tenantId: 'tenant1', unitId: 'unit1', amountPaid: 15000, date: '2025-04-05', type: 'rent', status: 'paid' },
                { id: 'pay8', tenantId: 'tenant2', unitId: 'unit2', amountPaid: 25000, date: '2025-04-10', type: 'rent', status: 'paid' },
                { id: 'pay9', tenantId: 'tenant3', unitId: 'unit4', amountPaid: 45000, date: '2025-04-01', type: 'rent', status: 'paid' },
                { id: 'pay10', tenantId: 'tenant1', unitId: 'unit1', amountPaid: 500, date: '2025-06-20', type: 'water', status: 'paid' }
            ];
            expenses = [
                { id: 'exp1', type: 'Maintenance', amount: 2000, date: '2025-06-15', description: 'Plumbing repair' },
                { id: 'exp2', type: 'Cleaning', amount: 1000, date: '2025-06-18', description: 'Common area cleaning' }
            ];
            waterBills = [
                { id: 'wb1', tenantId: 'tenant1', unitId: 'unit1', month: 'June 2025', amount: 500, isPaid: true, dateBilled: '2025-06-01' },
                { id: 'wb2', tenantId: 'tenant2', unitId: 'unit2', month: 'June 2025', amount: 750, isPaid: false, dateBilled: '2025-06-01' },
                { id: 'wb3', tenantId: 'tenant3', unitId: 'unit4', month: 'June 2025', amount: 600, isPaid: false, dateBilled: '2025-06-01' },
                { id: 'wb4', tenantId: 'tenant1', unitId: 'unit1', month: 'July 2025', amount: 550, isPaid: false, dateBilled: '2025-07-01' } // Future bill
            ];
            saveData();
        }
    }

    generateDummyData(); // Call this to populate initial data if none exists
    initializeDashboard(); // Load dashboard on page load

});