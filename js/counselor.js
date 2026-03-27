// ==========================================
// 1. FIREBASE INITIALIZATION & CONFIGURATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCI1ea8SQAZwg2BqRsjajRvlw7ggCbBDqQ",
    authDomain: "college-program-recommendation.firebaseapp.com",
    projectId: "college-program-recommendation",
    storageBucket: "college-program-recommendation.firebasestorage.app",
    messagingSenderId: "1005097749888",
    appId: "1:1005097749888:web:5843b838bffd33544ac565"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// 2. GLOBAL STATE & INSTANCES
// ==========================================
let allStudentResults = []; 
let chartProgramsInstance = null;
let chartRiasecInstance = null;

// Prototype Configuration: Client-side RBAC parameters
const PASS_TIER_1 = "ADMIN-2026";
const PASS_TIER_2 = "GUIDANCE-PII";

// ==========================================
// 3. ROLE-BASED ACCESS CONTROL (RBAC)
// ==========================================

// Tier 1: Executive Analytics Access
document.getElementById('btn-login-tier1').addEventListener('click', () => {
    const input = document.getElementById('input-tier1-pass').value;
    if (input === PASS_TIER_1) {
        document.getElementById('security-overlay').classList.add('d-none');
        document.getElementById('main-content').classList.remove('d-none');
        fetchLiveResults(); 
    } else {
        alert("Authentication Failed: Invalid Executive Passcode");
    }
});

// Tier 2: PII Roster Access
document.getElementById('btn-login-tier2').addEventListener('click', () => {
    const input = document.getElementById('input-tier2-pass').value;
    if (input === PASS_TIER_2) {
        document.getElementById('view-analytics').classList.add('d-none');
        document.getElementById('view-roster').classList.remove('d-none');
    } else {
        alert("Authentication Failed: Invalid Counselor PIN");
    }
});

// Navigation: Re-lock Tier 2 upon exit
document.getElementById('btn-back-analytics').addEventListener('click', () => {
    document.getElementById('view-roster').classList.add('d-none');
    document.getElementById('view-analytics').classList.remove('d-none');
    document.getElementById('input-tier2-pass').value = ''; 
});

// ==========================================
// 4. REAL-TIME DATA SYNCHRONIZATION
// ==========================================
function fetchLiveResults() {
    const resultsRef = collection(db, "results");
    
    // Establish active listener for real-time Firestore updates
    onSnapshot(resultsRef, (snapshot) => {
        allStudentResults = [];
        snapshot.forEach((doc) => {
            allStudentResults.push({ id: doc.id, ...doc.data() });
        });
        
        updateAnalytics();
        renderTable(allStudentResults);
    }, (error) => {
        console.error("Database Connection Error:", error);
        alert("System Warning: Unable to establish database connection.");
    });
}

// ==========================================
// 5. BATCH ANALYTICS & VISUALIZATION (TIER 1)
// ==========================================
function updateAnalytics() {
    document.getElementById('stat-total-students').innerText = allStudentResults.length;

    if (allStudentResults.length === 0) return;

    let programCounts = {};
    
    // Pre-initialize RIASEC dictionary to ensure consistent chart rendering
    let riasecCounts = {
        "Realistic": 0,
        "Investigative": 0,
        "Artistic": 0,
        "Social": 0,
        "Enterprising": 0,
        "Conventional": 0
    };

    allStudentResults.forEach(student => {
        let topProg = student.topMatches[0]?.programName || "Unknown";
        programCounts[topProg] = (programCounts[topProg] || 0) + 1;

        if (student.topRIASEC && student.topRIASEC.length > 0) {
            student.topRIASEC.forEach(trait => {
                riasecCounts[trait] = (riasecCounts[trait] || 0) + 1;
            });
        }
    });

    let mostPopularProgram = Object.keys(programCounts).reduce((a, b) => programCounts[a] > programCounts[b] ? a : b);
    document.getElementById('stat-top-program').innerText = mostPopularProgram;

    let mostPopularRiasec = Object.keys(riasecCounts).reduce((a, b) => riasecCounts[a] > riasecCounts[b] ? a : b);
    document.getElementById('stat-top-riasec').innerText = mostPopularRiasec;

    drawCharts(programCounts, riasecCounts);
}

function drawCharts(programData, riasecData) {
    // Clear existing chart instances to prevent canvas artifacting
    if (chartProgramsInstance) chartProgramsInstance.destroy();
    if (chartRiasecInstance) chartRiasecInstance.destroy();

    const ctxProg = document.getElementById('chart-programs').getContext('2d');
    chartProgramsInstance = new Chart(ctxProg, {
        type: 'bar',
        data: {
            labels: Object.keys(programData),
            datasets: [{
                label: 'Number of Students',
                data: Object.values(programData),
                backgroundColor: '#0d6efd',
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxRiasec = document.getElementById('chart-riasec').getContext('2d');
    chartRiasecInstance = new Chart(ctxRiasec, {
        type: 'doughnut',
        data: {
            labels: Object.keys(riasecData),
            datasets: [{
                data: Object.values(riasecData),
                backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ==========================================
// 6. DETAILED ROSTER & FILTERING (TIER 2)
// ==========================================
function renderTable(data) {
    const tbody = document.getElementById('roster-tbody');
    tbody.innerHTML = '';

    data.forEach(student => {
        // Parse Firestore timestamp objects
        const dateObj = student.timestamp ? student.timestamp.toDate() : new Date();
        const dateString = dateObj.toLocaleDateString();

        const topProgram = student.topMatches[0]?.programName || "N/A";
        const topScore = student.topMatches[0]?.matchScore || 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-muted small">${dateString}</td>
            <td class="fw-bold">${student.lastName}, ${student.firstName}</td>
            <td><span class="badge bg-secondary">${student.strand}</span></td>
            <td>${student.gwa}</td>
            <td>${topProgram}</td>
            <td>
                <div class="progress" style="height: 20px;">
                    <div class="progress-bar ${topScore > 80 ? 'bg-success' : 'bg-warning text-dark'}" 
                         style="width: ${topScore}%">${topScore}%</div>
                </div>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary" onclick="viewStudentProfile('${student.id}')">
                    View XAI Profile
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Expose modal handler to global scope for HTML inline event execution
window.viewStudentProfile = function(studentId) {
    const student = allStudentResults.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('xai-student-name').innerText = `${student.lastName}, ${student.firstName}`;
    document.getElementById('xai-student-date').innerText = student.timestamp ? student.timestamp.toDate().toLocaleDateString() : "Recent";
    document.getElementById('xai-student-strand').innerText = student.strand;
    document.getElementById('xai-student-gwa').innerText = student.gwa;
    
    // Format financial constraints for display
    const budgetText = student.budget === Infinity || student.budget >= 999999 ? "No Limit" : `₱${student.budget.toLocaleString()}`;
    document.getElementById('xai-student-budget').innerText = budgetText;
    document.getElementById('xai-student-location').innerText = student.location || "Any";
    document.getElementById('xai-student-type').innerText = student.type || "Any";

    const riasecContainer = document.getElementById('xai-riasec-container');
    riasecContainer.innerHTML = ''; 
    const colors = ['bg-primary', 'bg-info text-dark', 'bg-secondary']; 
    
    if (student.topRIASEC && student.topRIASEC.length > 0) {
        student.topRIASEC.forEach((trait, index) => {
            riasecContainer.innerHTML += `<span class="badge ${colors[index] || 'bg-dark'} fs-6 py-2 px-3">${index + 1}. ${trait}</span>`;
        });
    } else {
        riasecContainer.innerHTML = '<span class="text-muted">No psychometric data recorded.</span>';
    }

    const programsContainer = document.getElementById('xai-programs-container');
    programsContainer.innerHTML = ''; 

    if (student.topMatches && student.topMatches.length > 0) {
        student.topMatches.forEach((match, index) => {
            const score = match.matchScore || 0;
            let barColor = 'bg-success';
            if (score < 80) barColor = 'bg-warning text-dark';
            if (score < 60) barColor = 'bg-danger';

            programsContainer.innerHTML += `
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="fw-bold text-dark"><i class="bi bi-award-fill text-warning me-1"></i> ${match.programName}</span>
                        <span class="fw-bold ${score >= 80 ? 'text-success' : 'text-dark'}">${score}% Match</span>
                    </div>
                    <div class="progress" style="height: 25px; border-radius: 8px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated ${barColor}" 
                             role="progressbar" 
                             style="width: ${score}%;" 
                             aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100">
                             ${score}% Algorithm Confidence
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        programsContainer.innerHTML = '<div class="alert alert-warning">No programs satisfied the designated constraint parameters.</div>';
    }

    const xaiModal = new bootstrap.Modal(document.getElementById('xaiModal'));
    xaiModal.show();
};

// Client-Side Data Filtering
document.getElementById('search-student').addEventListener('input', applyFilters);
document.getElementById('filter-strand').addEventListener('change', applyFilters);

function applyFilters() {
    const searchTerm = document.getElementById('search-student').value.toLowerCase();
    const strandFilter = document.getElementById('filter-strand').value;

    const filteredData = allStudentResults.filter(student => {
        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
        const matchesSearch = fullName.includes(searchTerm);
        const matchesStrand = strandFilter === "All" || student.strand === strandFilter;
        return matchesSearch && matchesStrand;
    });

    renderTable(filteredData);
}

// ==========================================
// 7. DATA EXPORT PROCEDURES
// ==========================================
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Data Export: Executive Summary (PII Omitted)
document.getElementById('btn-export-summary').addEventListener('click', () => {
    let csv = "Total Assessed,Top Recommended Program,Dominant RIASEC\n";
    csv += `${allStudentResults.length},${document.getElementById('stat-top-program').innerText},${document.getElementById('stat-top-riasec').innerText}\n\n`;
    
    csv += "--- AGGREGATE CHART DATA ---\n";
    csv += "Data anonymized per privacy compliance protocols.\n";
    
    downloadCSV(csv, "GAMS_Batch_Summary.csv");
});

// Data Export: Guidance Roster (PII Included)
document.getElementById('btn-export-roster').addEventListener('click', () => {
    let csv = "Date,Last Name,First Name,Strand,GWA,Budget,Location Pref,School Type Pref,Top RIASEC 1,Top RIASEC 2,Top RIASEC 3,Recommended Program 1,Match Score 1,Recommended Program 2,Match Score 2,Recommended Program 3,Match Score 3\n";
    
    allStudentResults.forEach(s => {
        const dateStr = s.timestamp ? s.timestamp.toDate().toLocaleDateString() : "N/A";
        const row = [
            dateStr, 
            s.lastName, 
            s.firstName, 
            s.strand, 
            s.gwa, 
            s.budget, 
            s.location || "Any", 
            s.type || "Any",
            s.topRIASEC[0], s.topRIASEC[1], s.topRIASEC[2],
            s.topMatches[0]?.programName, s.topMatches[0]?.matchScore,
            s.topMatches[1]?.programName, s.topMatches[1]?.matchScore,
            s.topMatches[2]?.programName, s.topMatches[2]?.matchScore
        ];
        csv += row.join(",") + "\n";
    });

    downloadCSV(csv, "GAMS_Full_Counselor_Roster.csv");
});