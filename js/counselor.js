// ==========================================
// 1. FIREBASE INITIALIZATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let filteredStudentResults = [];
let chartProgramsInstance = null;
let chartRiasecInstance = null;
let xaiRadarInstance = null;
let previousStudentCount = 0;
let programsDB = null;

async function loadDatabases() {
    try {
        const res = await fetch('./data/programs.json');
        programsDB = await res.json();
    } catch (error) {
        console.error("System Error: Could not load programs.json", error);
    }
}
loadDatabases();

const PASS_TIER_1 = "ADMIN-2026";
const PASS_TIER_2 = "GUIDANCE-PII";

// ==========================================
// 3. SECURE ROLE-BASED ACCESS CONTROL
// ==========================================
document.getElementById('btn-login-tier1').addEventListener('click', () => {
    const input = document.getElementById('input-tier1-pass').value;
    if (input === PASS_TIER_1) {
        document.getElementById('security-overlay').classList.add('d-none');
        document.getElementById('main-content').classList.remove('d-none');
        fetchLiveResults();
    } else alert("Invalid Executive Passcode");
});

document.getElementById('btn-login-tier2').addEventListener('click', () => {
    const input = document.getElementById('input-tier2-pass').value;
    if (input === PASS_TIER_2) {
        document.getElementById('view-analytics').classList.add('d-none');
        document.getElementById('view-roster').classList.remove('d-none');
    } else alert("Invalid Counselor PIN");
});

// "Lock the Door" Secure Exit Logic
document.getElementById('btn-back-analytics').addEventListener('click', () => {
    // Hide data immediately
    document.getElementById('view-roster').classList.add('d-none');
    document.getElementById('view-analytics').classList.remove('d-none');
    
    // Clear sensitive inputs
    document.getElementById('input-tier2-pass').value = '';
    document.getElementById('search-student').value = '';
    
    // Reset filters
    document.getElementById('filter-strand').value = 'All';
    applyFilters();
});

// ==========================================
// 4. REAL-TIME SYNCHRONIZATION & TOASTS
// ==========================================
function fetchLiveResults() {
    const resultsRef = collection(db, "results");

    onSnapshot(resultsRef, (snapshot) => {
        allStudentResults = [];
        snapshot.forEach(doc => {
            allStudentResults.push({ id: doc.id, ...doc.data() });
        });

        // Trigger Live Toast if a NEW student finished the test
        if (previousStudentCount > 0 && allStudentResults.length > previousStudentCount) {
            showLiveToast();
        }
        previousStudentCount = allStudentResults.length;

        filteredStudentResults = [...allStudentResults];
        updateAnalytics();
        renderTable(filteredStudentResults);
    }, (error) => {
        console.error(error);
        alert("Database connection error");
    });
}

function showLiveToast() {
    // Create a dynamic bootstrap toast to avoid HTML clutter
    const toastHTML = `
        <div class="toast align-items-center text-white bg-success border-0 show" role="alert" style="position: fixed; bottom: 20px; right: 20px; z-index: 1055;">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-bell-fill me-2"></i> New assessment submitted! Dashboard updated.
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', toastHTML);
    setTimeout(() => {
        const toastEl = document.querySelector('.toast');
        if (toastEl) toastEl.remove();
    }, 4000);
}

// ==========================================
// 5. BATCH ANALYTICS & VISUALIZATION
// ==========================================
function updateAnalytics() {
    const totalStudents = allStudentResults.length;
    document.getElementById('stat-total-students').innerText = totalStudents;

    // --- CLEAN EMPTY STATE LOGIC ---
    if (totalStudents === 0) {
        document.getElementById('stat-top-program').innerText = "Awaiting Data";
        document.getElementById('stat-top-riasec').innerText = "Awaiting Data";
        
        const deepDiveTbody = document.getElementById('deep-dive-tbody');
        if (deepDiveTbody) {
            deepDiveTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4"><i class="bi bi-hourglass-split me-2"></i>Waiting for first assessment...</td></tr>`;
        }
        
        if (chartProgramsInstance) chartProgramsInstance.destroy();
        if (chartRiasecInstance) chartRiasecInstance.destroy();
        return; 
    }

    // --- MATH & TALLY LOGIC ---
    let programCounts = {};
    let primaryRiasecCounts = { Realistic: 0, Investigative: 0, Artistic: 0, Social: 0, Enterprising: 0, Conventional: 0 };
    let allRiasecCounts = { Realistic: 0, Investigative: 0, Artistic: 0, Social: 0, Enterprising: 0, Conventional: 0 };

    allStudentResults.forEach(student => {
        const topProg = student.topMatches?.[0]?.programName || "Unknown";
        programCounts[topProg] = (programCounts[topProg] || 0) + 1;

        if (student.topRIASEC && student.topRIASEC.length > 0) {
            const primaryTrait = student.topRIASEC[0];
            primaryRiasecCounts[primaryTrait] = (primaryRiasecCounts[primaryTrait] || 0) + 1;
            
            student.topRIASEC.forEach(trait => {
                allRiasecCounts[trait] = (allRiasecCounts[trait] || 0) + 1;
            });
        }
    });

    const mostPopularProgram = Object.keys(programCounts).reduce((a, b) => programCounts[a] > programCounts[b] ? a : b);
    const mostPopularRiasec = Object.keys(primaryRiasecCounts).reduce((a, b) => primaryRiasecCounts[a] > primaryRiasecCounts[b] ? a : b);

    document.getElementById('stat-top-program').innerText = mostPopularProgram;
    document.getElementById('stat-top-riasec').innerText = mostPopularRiasec;

    const sortedPrograms = Object.entries(programCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const top10 = Object.fromEntries(sortedPrograms);

    drawCharts(top10, allRiasecCounts);
    renderDeepDiveTable(programCounts, totalStudents);
}

function drawCharts(programData, riasecData) {
    if (chartProgramsInstance) chartProgramsInstance.destroy();
    if (chartRiasecInstance) chartRiasecInstance.destroy();

    const ctxProg = document.getElementById('chart-programs').getContext('2d');
    chartProgramsInstance = new Chart(ctxProg, {
        type: 'bar',
        data: {
            labels: Object.keys(programData),
            datasets: [
                { type: 'line', data: Object.values(programData), backgroundColor: '#0d6efd', borderColor: '#0d6efd', pointRadius: 6, showLine: false },
                { type: 'bar', data: Object.values(programData), backgroundColor: '#0d6efd', barThickness: 3 }
            ]
        },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const ctxRiasec = document.getElementById('chart-riasec').getContext('2d');
    chartRiasecInstance = new Chart(ctxRiasec, {
        type: 'polarArea',
        data: {
            labels: Object.keys(riasecData),
            datasets: [{
                data: Object.values(riasecData),
                backgroundColor: ['#ff6384cc', '#36a2ebcc', '#cc65fecc', '#ffce56cc', '#4bc0c0cc', '#9966ffcc']
            }]
        },
        options: { maintainAspectRatio: false }
    });
}

// ==========================================
// 6. DEEP DIVE TABLE
// ==========================================
function renderDeepDiveTable(programCounts, totalStudents) {
    const tbody = document.getElementById('deep-dive-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const sorted = Object.entries(programCounts).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([prog, count], index) => {
        const percent = ((count / totalStudents) * 100).toFixed(1);
        tbody.innerHTML += `
        <tr>
            <td class="ps-4 text-muted">#${index + 1}</td>
            <td class="fw-bold">${prog}</td>
            <td class="text-center"><span class="badge bg-secondary">${count}</span></td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress flex-grow-1 me-2" style="height: 6px;">
                        <div class="progress-bar bg-info" style="width: ${percent}%"></div>
                    </div>
                    <small>${percent}%</small>
                </div>
            </td>
        </tr>`;
    });
}

// ==========================================
// 7. DETAILED ROSTER & FILTERING
// ==========================================
document.getElementById('search-student').addEventListener('input', applyFilters);
document.getElementById('filter-strand').addEventListener('change', applyFilters);

function applyFilters() {
    const searchTerm = document.getElementById('search-student').value.toLowerCase();
    const strandFilter = document.getElementById('filter-strand').value;

    filteredStudentResults = allStudentResults.filter(student => {
        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
        const matchesSearch = fullName.includes(searchTerm) || student.id.includes(searchTerm);
        const matchesStrand = strandFilter === "All" || student.strand === strandFilter;
        return matchesSearch && matchesStrand;
    });

    renderTable(filteredStudentResults);
}

function renderTable(data) {
    const tbody = document.getElementById('roster-tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No students found matching your criteria.</td></tr>';
        return;
    }

    data.forEach(student => {
        const dateObj = student.timestamp ? student.timestamp.toDate() : new Date();
        const topProgram = student.topMatches?.[0]?.programName || "N/A";
        const topScore = student.topMatches?.[0]?.matchScore || 0;

        let scoreClass = "bg-success";
        if (topScore < 85) scoreClass = "bg-warning text-dark";
        if (topScore < 70) scoreClass = "bg-danger";

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-muted small">${dateObj.toLocaleDateString()}</td>
            <td class="fw-bold text-primary">${student.id}</td>
            <td class="fw-bold">${student.lastName}, ${student.firstName}</td>
            <td><span class="badge bg-light text-dark border">${student.strand}</span></td>
            <td>${student.gwa}</td>
            <td class="small">${topProgram}</td>
            <td>
                <div class="d-flex align-items-center" style="min-width: 120px;">
                    <div class="progress flex-grow-1 me-2" style="height: 15px; border-radius: 10px;">
                        <div class="progress-bar ${scoreClass}" style="width: ${topScore}%"></div>
                    </div>
                    <span class="fw-bold">${topScore}%</span>
                </div>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary" onclick="viewStudentProfile('${student.id}')">
                    <i class="bi bi-eye-fill me-1"></i>View
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ==========================================
// 8. ADVANCED XAI MODAL (Radar, Notes & Full Logic)
// ==========================================
window.viewStudentProfile = function(studentId) {
    const student = allStudentResults.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('xai-student-name').innerText = `${student.lastName}, ${student.firstName}`;
    document.getElementById('xai-student-strand').innerText = student.strand;
    document.getElementById('xai-student-gwa').innerText = student.gwa;
    
    document.getElementById('xai-student-date').innerText = student.timestamp ? student.timestamp.toDate().toLocaleDateString() : "Recent";
    const budgetText = student.budget === Infinity || student.budget >= 999999 ? "No Limit" : `₱${student.budget.toLocaleString()}`;
    document.getElementById('xai-student-budget').innerText = budgetText;
    document.getElementById('xai-student-location').innerText = student.location || "Any";
    document.getElementById('xai-student-type').innerText = student.type || "Any";

    // --- Dynamic Injection for Radar Chart & Attributes ---
    const topContainer = document.getElementById('xai-riasec-container');
    topContainer.innerHTML = `
        <div class="row">
            <div class="col-md-6 text-center">
                <h6 class="fw-bold text-muted mb-2">RIASEC Footprint</h6>
                <div style="height: 220px; position: relative; margin: auto;">
                    <canvas id="xai-radar-chart"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <h6 class="fw-bold text-muted mb-2">Top Attributes</h6>
                <div id="xai-skills-list" class="d-flex flex-wrap gap-1"></div>
            </div>
        </div>
    `;

    // Render Badges
    const skillsList = document.getElementById('xai-skills-list');
    if (student.topRIASEC) {
        student.topRIASEC.forEach((trait, i) => {
            const colors = ['bg-primary', 'bg-info text-dark', 'bg-secondary'];
            skillsList.innerHTML += `<span class="badge ${colors[i] || 'bg-dark'} p-2 w-100 text-start mb-1">${i+1}. ${trait}</span>`;
        });
    }

    // Render Radar Chart from phaseA data
    if (xaiRadarInstance) xaiRadarInstance.destroy();
    const ctxRadar = document.getElementById('xai-radar-chart').getContext('2d');
    const pScores = student.phaseScores?.phaseA || { "Realistic": 0, "Investigative": 0, "Artistic": 0, "Social": 0, "Enterprising": 0, "Conventional": 0 };
    
    xaiRadarInstance = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional'],
            datasets: [{
                label: 'Student Profile',
                data: [pScores.Realistic||0, pScores.Investigative||0, pScores.Artistic||0, pScores.Social||0, pScores.Enterprising||0, pScores.Conventional||0],
                backgroundColor: 'rgba(13, 110, 253, 0.2)',
                borderColor: 'rgba(13, 110, 253, 1)',
                pointBackgroundColor: 'rgba(13, 110, 253, 1)',
                borderWidth: 2
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: { r: { beginAtZero: true, suggestedMax: 25, ticks: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });

    // --- Deep XAI Logic transplanted from app.js ---
    const programsContainer = document.getElementById('xai-programs-container');
    programsContainer.innerHTML = '<h6 class="fw-bold text-muted mt-4 mb-3">SAW ALGORITHM BREAKDOWN:</h6>';

    if (student.topMatches && programsDB) {
        student.topMatches.forEach((match, index) => {
            const score = match.matchScore;
            
            // 1. LOOKUP: Find the matching program in your JSON database by its name
            const programDetails = Object.values(programsDB).find(p => p.program_name === match.programName);
            
            // 2. EXTRACT: Pull the specific requirements, or use fallbacks if something breaks
            let psychTraits = programDetails ? `${programDetails.riasec_primary}, ${programDetails.riasec_secondary}, ${programDetails.riasec_tertiary}` : student.topRIASEC.join(', ');
            let skillList = programDetails ? programDetails.core_skills.join(', ') : "targeted technical skills";

            let reasonHTML = '';
            
            reasonHTML += `<div class="mb-2" style="font-size: 0.85rem;">
                              <i class="bi bi-person-check text-primary me-1"></i> 
                              <strong>Psychometrics:</strong> This program correlates with <span class="text-primary fw-bold">${psychTraits}</span>. Profile indicates strong intersection.
                           </div>`;
                           
            reasonHTML += `<div style="font-size: 0.85rem;">
                              <i class="bi bi-tools text-success me-1"></i> 
                              <strong>Competency:</strong> Foundational and specialized evaluation denotes systemic readiness for the targeted competencies: <strong>${skillList}</strong>.
                           </div>`;

            programsContainer.innerHTML += `
                <div class="card border-0 bg-light shadow-sm mb-3 p-3">
                    <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                        <strong class="text-dark fs-6">${index + 1}. ${match.programName}</strong>
                        <span class="badge rounded-pill bg-white text-primary border border-primary fs-6">${score}% Confidence</span>
                    </div>
                    ${reasonHTML}
                </div>`;
        });
    }

    // Counselor Notes Injection
    const notesValue = student.counselorNotes || "";
    programsContainer.innerHTML += `
        <hr>
        <h6 class="fw-bold text-dark mt-3"><i class="bi bi-journal-text me-2"></i>Counselor's Clinical Notes</h6>
        <textarea id="input-counselor-notes" class="form-control mb-2" rows="3" placeholder="Add observations or recommendations for 1-on-1 counseling here...">${notesValue}</textarea>
        <div class="d-flex justify-content-between">
            <button class="btn btn-sm btn-success" onclick="saveCounselorNotes('${student.id}')"><i class="bi bi-save me-1"></i>Save Notes</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="generateStudentPDF()"><i class="bi bi-printer me-1"></i>Print PDF Report</button>
        </div>
    `;

    new bootstrap.Modal(document.getElementById('xaiModal')).show();
};

// ==========================================
// 9. PDF GENERATOR (Print to PDF)
// ==========================================
window.generateStudentPDF = function() {
    // We add a temporary CSS rule that hides the dashboard background and print only the modal content
    const printStyle = document.createElement('style');
    printStyle.innerHTML = `
        @media print {
            body * { visibility: hidden; }
            .modal-content, .modal-content * { visibility: visible; }
            .modal-content { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
            .btn, button, .btn-close { display: none !important; }
            textarea { border: none; resize: none; background: transparent; }
        }
    `;
    document.head.appendChild(printStyle);
    window.print();
    // Cleanup after print dialog closes
    setTimeout(() => { document.head.removeChild(printStyle); }, 1000);
};

// ==========================================
// 10. DATA EXPORT (Batch CSV)
// ==========================================
function safeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
}

function downloadCSV(filename, rows) {
    const csvContent = rows.map(row => row.map(safeCSV).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

document.getElementById('btn-export-summary')?.addEventListener('click', () => {
    const rows = [
        ["Metric", "Value"],
        ["Total Assessed", allStudentResults.length],
        ["Top Recommended Program", document.getElementById('stat-top-program').innerText],
        ["Dominant RIASEC Trait", document.getElementById('stat-top-riasec').innerText],
        ["", ""],
        ["Program Name", "Student Count"]
    ];

    const counts = {};
    allStudentResults.forEach(s => {
        const p = s.topMatches?.[0]?.programName || "Unknown";
        counts[p] = (counts[p] || 0) + 1;
    });
    
    Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(entry => rows.push(entry));
    downloadCSV('GAMS_Executive_Summary.csv', rows);
});

document.getElementById('btn-export-roster')?.addEventListener('click', () => {
    const rows = [[
        "Date", "Student ID", "Last Name", "First Name", "Strand", "GWA", 
        "Budget Limit", "Location Pref", "Inst. Type Pref", 
        "RIASEC #1", "RIASEC #2", "RIASEC #3", 
        "Top Match", "Confidence Score %",
        "2nd Match", "2nd Score %",
        "3rd Match", "3rd Score %"
    ]];

    const source = filteredStudentResults.length > 0 ? filteredStudentResults : allStudentResults;

    source.forEach(s => {
        rows.push([
            s.timestamp ? s.timestamp.toDate().toLocaleDateString() : '',
            s.id, s.lastName, s.firstName, s.strand, s.gwa,
            s.budget === Infinity ? "No Limit" : s.budget,
            s.location || "Any", s.type || "Any",
            s.topRIASEC?.[0] || '', s.topRIASEC?.[1] || '', s.topRIASEC?.[2] || '',
            s.topMatches?.[0]?.programName || "N/A", (s.topMatches?.[0]?.matchScore || 0),
            s.topMatches?.[1]?.programName || "N/A", (s.topMatches?.[1]?.matchScore || 0),
            s.topMatches?.[2]?.programName || "N/A", (s.topMatches?.[2]?.matchScore || 0)
        ]);
    });

    downloadCSV('GAMS_Detailed_Roster.csv', rows);
});

// ==========================================
// 11. STRAND DISTRIBUTION ANALYTICS (Card 1)
// ==========================================
let strandChartInstance = null;

window.showStrandDistribution = function() {
    // 1. Pre-populate the baseline strands so the chart ALWAYS has structure
    const strandCounts = {
        "STEM": 0,
        "ABM": 0,
        "HUMSS": 0,
        "ICT": 0,
        "GAS": 0,
        "TVL": 0
    };

    // 2. Tally the actual students (if any exist)
    allStudentResults.forEach(student => {
        const s = student.strand || "Unknown";
        strandCounts[s] = (strandCounts[s] || 0) + 1; // Adds to existing, or creates "Unknown" if needed
    });

    // 3. Sort from highest to lowest (ties are sorted alphabetically)
    const sortedStrands = Object.entries(strandCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const labels = sortedStrands.map(item => item[0]);
    const data = sortedStrands.map(item => item[1]);

    // 4. Inject the Modal HTML dynamically
    const existingModal = document.getElementById('strandModal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div class="modal fade" id="strandModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header bg-primary text-white border-0">
                        <h5 class="modal-title fw-bold"><i class="bi bi-bar-chart-steps me-2"></i>Strand Distribution</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4 text-center">
                        <p class="text-muted small mb-4">Total breakdown of assessed students by Senior High School strand.</p>
                        <div style="height: 300px; width: 100%;">
                            <canvas id="strand-bar-chart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 5. Show the Modal
    const modalInstance = new bootstrap.Modal(document.getElementById('strandModal'));
    modalInstance.show();

    // 6. Render the Chart
    const ctx = document.getElementById('strand-bar-chart').getContext('2d');
    strandChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Students',
                data: data,
                backgroundColor: 'rgba(13, 110, 253, 0.8)',
                borderRadius: 4,
                barPercentage: 0.6 // Makes the bars slightly slimmer and more professional
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bars
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    beginAtZero: true, 
                    suggestedMax: 5, // Forces the grid to show at least 0-5, even if data is all zeroes
                    ticks: { stepSize: 1 } 
                },
                y: { 
                    grid: { display: false }, 
                    ticks: { font: { weight: 'bold' } } 
                }
            }
        }
    });
};

// ==========================================
// 12. STRAND-RIASEC HEATMAP (Card 3)
// ==========================================
window.showRiasecHeatmap = function() {
    if (allStudentResults.length === 0) {
        alert("No assessment data available yet.");
        return;
    }

    // 1. Define the baseline grid to ensure all rows/columns exist
    const strands = ["STEM", "ABM", "HUMSS", "ICT", "GAS", "TVL"];
    const traits = ["Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"];
    
    let matrix = {};
    strands.forEach(s => {
        matrix[s] = { "Realistic": 0, "Investigative": 0, "Artistic": 0, "Social": 0, "Enterprising": 0, "Conventional": 0 };
    });

    // 2. Populate the matrix and find the maximum value for color scaling
    let maxCount = 0;
    allStudentResults.forEach(student => {
        const s = student.strand || "Unknown";
        const dominantTrait = student.topRIASEC?.[0];
        
        if (matrix[s] !== undefined && dominantTrait) {
            matrix[s][dominantTrait]++;
            if (matrix[s][dominantTrait] > maxCount) {
                maxCount = matrix[s][dominantTrait];
            }
        }
    });

    // Prevent division by zero if all values are 0
    if (maxCount === 0) maxCount = 1;

    // 3. Generate the Heatmap Table HTML
    let tableHTML = `
        <table class="table table-bordered align-middle text-center mb-0" style="table-layout: fixed;">
            <thead class="bg-light text-muted small">
                <tr>
                    <th style="width: 16%;">Strand</th>
                    <th title="Realistic">R</th>
                    <th title="Investigative">I</th>
                    <th title="Artistic">A</th>
                    <th title="Social">S</th>
                    <th title="Enterprising">E</th>
                    <th title="Conventional">C</th>
                </tr>
            </thead>
            <tbody>
    `;

    strands.forEach(strand => {
        tableHTML += `<tr><td class="fw-bold bg-light text-secondary">${strand}</td>`;
        traits.forEach(trait => {
            const count = matrix[strand][trait];
            // Calculate opacity based on the highest number in the grid (min 0.05 so 0s are almost white)
            const opacity = count === 0 ? 0.02 : Math.max(0.15, (count / maxCount));
            // Highlight the cell if it's the absolute highest
            const textColor = opacity > 0.5 ? 'text-white' : 'text-dark';
            const fw = count > 0 ? 'fw-bold' : '';

            tableHTML += `<td class="${textColor} ${fw}" style="background-color: rgba(13, 110, 253, ${opacity}); transition: 0.3s;">${count}</td>`;
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table>`;

    // 4. Inject the Modal
    const existingModal = document.getElementById('heatmapModal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div class="modal fade" id="heatmapModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header bg-info text-white border-0">
                        <h5 class="modal-title fw-bold"><i class="bi bi-grid-3x3-gap-fill me-2"></i>Institutional Alignment Heatmap</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <p class="text-muted small mb-4 text-center">This matrix tracks the dominant personality trait (RIASEC) of students across their enrolled Senior High School strands.</p>
                        <div class="table-responsive rounded shadow-sm border">
                            ${tableHTML}
                        </div>
                        <div class="mt-3 text-end small text-muted">
                            <span class="badge bg-light text-dark border me-1">Light = Low Concentration</span>
                            <span class="badge bg-primary text-white">Dark = High Concentration</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 5. Show the Modal
    const modalInstance = new bootstrap.Modal(document.getElementById('heatmapModal'));
    modalInstance.show();
};