// ==========================================
// 0. FIREBASE & PWA INITIALIZATION
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Registered.', reg))
            .catch(err => console.error('SW Registration Failed:', err));
    });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Expose modal handler to global scope for inline HTML triggers
window.openProgramDetails = openProgramDetails;

// ==========================================
// 1. GLOBAL STATE & DATA STRUCTURES
// ==========================================
let questionBank = null;
let studentsDB = null;
let collegesDB = null;
let programsDB = null;

let studentAnswers = {
    phaseA: {}, 
    phaseB: {}, 
    phaseC: {}  
};

let currentPage = 1;
const totalPages = 13; 
const questionsPerPage = 5;

// ==========================================
// 2. CLOUD PERSISTENCE (AUTO-SAVE)
// ==========================================
function saveProgress() {
    const fullID = document.getElementById('input-id-year').value + "-" + document.getElementById('input-id-num').value;
    if (!fullID || fullID.length !== 8) return;

    const progressData = {
        answers: studentAnswers,
        page: currentPage,
        lastUpdated: serverTimestamp()
    };

    setDoc(doc(db, "progress", fullID), progressData).catch(err => console.error("Auto-save failed:", err));
}

async function clearProgress() {
    const fullID = document.getElementById('input-id-year').value + "-" + document.getElementById('input-id-num').value;
    try {
        await deleteDoc(doc(db, "progress", fullID));
    } catch (error) {
        console.error("Error clearing progress:", error);
    }
}

// ==========================================
// 3. DOM INITIALIZATION
// ==========================================
const inputYear = document.getElementById('input-id-year');
const inputNum = document.getElementById('input-id-num');
const inputStrand = document.getElementById('input-strand');
const inputFname = document.getElementById('input-fname');
const inputLname = document.getElementById('input-lname');
const btnStart = document.getElementById('btn-start-assessment');

const sectionSetup = document.getElementById('section-setup');
const sectionAssessment = document.getElementById('section-assessment');

const questionsContainer = document.getElementById('questions-container');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const questionCounter = document.getElementById('question-counter');
const testProgress = document.getElementById('test-progress');
const currentPhaseLabel = document.getElementById('current-phase-label');

// ==========================================
// 4. DATA FETCHING & PARSING
// ==========================================
async function loadDatabases() {
    try {
        const [questionsRes, studentsRes, collegesRes, programsRes] = await Promise.all([
            fetch('./data/questions.json'),
            fetch('./data/students.json'),
            fetch('./data/colleges.json'),
            fetch('./data/programs.json')
        ]);
        
        questionBank = await questionsRes.json();
        studentsDB = await studentsRes.json();
        collegesDB = await collegesRes.json();
        programsDB = await programsRes.json();
        
        console.log("Local databases initialized.");
        populateLocationDropdown();
    } catch (error) {
        console.error("Database load error:", error);
        alert("System Error: Could not load data. Ensure you are running a local server environment.");
    }
}
loadDatabases(); 

function populateLocationDropdown() {
    const locationSelect = document.getElementById('input-location');
    if (!locationSelect) return;

    const uniqueLocations = new Set();
    for (const collegeId in collegesDB) {
        const college = collegesDB[collegeId];
        if (college && college.location) {
            uniqueLocations.add(college.location);
        }
    }

    const sortedLocations = Array.from(uniqueLocations).sort();
    locationSelect.innerHTML = '<option value="Any">Any Location</option>';

    sortedLocations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = loc;
        locationSelect.appendChild(option);
    });
}

// ==========================================
// 5. SETUP SCREEN (FORM VALIDATION)
// ==========================================
inputYear.addEventListener('input', function() {
    if (this.value.length === 2) inputNum.focus();
    checkStudentId();
});

inputNum.addEventListener('input', checkStudentId);

function checkStudentId() {
    if (!studentsDB) return; 

    if (inputYear.value.length === 2 && inputNum.value.length === 5) {
        let fullID = inputYear.value + "-" + inputNum.value;
        
        if (studentsDB[fullID]) {
            inputStrand.value = studentsDB[fullID].strand;
            inputFname.value = studentsDB[fullID].first_name;
            inputLname.value = studentsDB[fullID].last_name;
            
            inputStrand.classList.add('is-valid');
            inputStrand.classList.remove('is-invalid');
            inputFname.classList.add('is-valid');
            inputLname.classList.add('is-valid');
        } else {
            inputStrand.value = "Student Not Found";
            inputFname.value = "";
            inputLname.value = "";
            
            inputStrand.classList.add('is-invalid');
            inputStrand.classList.remove('is-valid');
            inputFname.classList.remove('is-valid');
            inputLname.classList.remove('is-valid');
        }
    } else {
        inputStrand.value = "";
        inputFname.value = "";
        inputLname.value = "";
        
        inputStrand.placeholder = "Auto-filled from ID...";
        inputFname.placeholder = "Auto-filled...";
        inputLname.placeholder = "Auto-filled...";
        
        inputStrand.classList.remove('is-valid', 'is-invalid');
        inputFname.classList.remove('is-valid', 'is-invalid');
        inputLname.classList.remove('is-valid', 'is-invalid');
    }
}

// ==========================================
// 6. DYNAMIC UI RENDERING ENGINE
// ==========================================
const phaseInstructions = {
    A: {
        title: "Phase A: Interest Assessment",
        text: "This part is based on the <b>Holland Code (RIASEC)</b> model. Rate the following activities based on how much you would <b>enjoy</b> doing them, regardless of your current skill level."
    },
    B: {
        title: "Phase B: Foundational Competency",
        text: "Great job! Now, we will assess your <b>Basic Skills</b>. Rate your current level of proficiency in general academic and professional tasks."
    },
    C: {
        title: "Phase C: Specialized Competency",
        text: "Final Step! We are now looking at <b>Cross-Functional Skills</b>. These are specific technical abilities that align with professional degree programs."
    }
};

let showingInstructions = false;

function renderPage(page) {
    const qContainer = document.getElementById('questions-container');
    const iContainer = document.getElementById('instructions-container');
    const fContainer = document.getElementById('finish-container');
    const navGroup = document.querySelector('.d-flex.justify-content-between.mt-4');

    // Reset UI state
    qContainer.innerHTML = ''; 
    qContainer.classList.add('d-none');
    iContainer.classList.add('d-none');
    fContainer.classList.add('d-none');
    navGroup.classList.remove('d-none');
    btnNext.classList.remove('d-none');

    // Display instructional modals before starting new phases
    if (!showingInstructions) {
        if (page === 1 || page === 7 || page === 9) {
            showPhaseInstructions(page);
            return;
        }
    }
    
    showingInstructions = false; 
    qContainer.classList.remove('d-none');
    
    let currentPhaseData, phaseKey, scaleOptions;
    let localPage = page;

    if (page <= 6) {
        currentPhaseLabel.innerText = "Phase A: Motivation";
        currentPhaseData = questionBank.phaseA_interests;
        phaseKey = 'phaseA';
        scaleOptions = ["Strongly Dislike", "Dislike", "Neutral", "Like", "Strongly Like"];
    } else if (page <= 8) {
        currentPhaseLabel.innerText = "Phase B: Foundational Competency";
        currentPhaseData = questionBank.phaseB_basic_skills;
        phaseKey = 'phaseB';
        localPage = page - 6;
        scaleOptions = ["Very Weak", "Weak", "Average", "Strong", "Exceptional"];
    } else {
        currentPhaseLabel.innerText = "Phase C: Specialized Competency";
        currentPhaseData = questionBank.phaseC_cross_skills;
        phaseKey = 'phaseC';
        localPage = page - 8;
        scaleOptions = ["Beginner", "Novice", "Intermediate", "Advanced", "Expert"];
    }

    let startIndex = (localPage - 1) * questionsPerPage;
    let endIndex = startIndex + questionsPerPage;
    let questionsToShow = currentPhaseData.slice(startIndex, endIndex);

    questionsToShow.forEach((q, index) => {
        let globalQuestionNumber = ((page - 1) * questionsPerPage) + (index + 1);

        let bubblesHTML = '';
        [1, 2, 3, 4, 5].forEach((val, i) => {
            let isSelected = studentAnswers[phaseKey][q.id] === val ? "active" : "";
            let hintText = scaleOptions[i]; 
            
            bubblesHTML += `<div class="bubble ${isSelected}" data-phase="${phaseKey}" data-qid="${q.id}" data-val="${val}" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="${hintText}"></div>`;
        });

        qContainer.innerHTML += `
            <div class="mb-5 question-block">
                <h5 class="mb-4 text-start fw-bold" style="color: #2b3a4a;">${globalQuestionNumber}. ${q.text}</h5>
                <div class="bubble-container">
                    <div class="bubble-group">
                        ${bubblesHTML}
                    </div>
                </div>
            </div>
        `;
    });

    // Initialize Bootstrap Tooltips for the newly generated bubbles
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    // Update Navigation Progress
    questionCounter.innerText = `Page ${page} of ${totalPages}`;
    testProgress.style.width = `${(page / totalPages) * 100}%`;
    btnPrev.disabled = (page === 1);

    // Completion State Handling
    if (page === totalPages) {
        btnNext.innerText = "Finish Assessment";
        btnNext.classList.replace('btn-primary', 'btn-success');
    } else {
        btnNext.innerText = "Next Page";
        btnNext.classList.replace('btn-success', 'btn-primary');
    }
}

function showPhaseInstructions(page) {
    const iContainer = document.getElementById('instructions-container');
    const navGroup = document.querySelector('.d-flex.justify-content-between.mt-4');

    navGroup.classList.add('d-none');
    iContainer.classList.remove('d-none');

    let phase = page === 1 ? 'A' : (page === 7 ? 'B' : 'C');
    document.getElementById('instr-title').innerText = phaseInstructions[phase].title;
    document.getElementById('instr-text').innerHTML = phaseInstructions[phase].text;

    document.getElementById('btn-proceed').onclick = () => {
        showingInstructions = true;
        renderPage(page);
    };
}

// ==========================================
// 7. EVENT LISTENERS (Inputs & Sync)
// ==========================================
questionsContainer.addEventListener('click', function(e) {
    if (e.target.classList.contains('bubble')) {
        let bubble = e.target;
        let phase = bubble.getAttribute('data-phase');
        let qid = bubble.getAttribute('data-qid');
        let val = parseInt(bubble.getAttribute('data-val'));

        let siblings = bubble.parentElement.querySelectorAll('.bubble');
        siblings.forEach(b => b.classList.remove('active'));
        
        bubble.classList.add('active');
        studentAnswers[phase][qid] = val;
        
        saveProgress();
    }
});

btnNext.addEventListener('click', () => {
    const answeredQuestions = document.querySelectorAll('.bubble.active').length;
    
    if (answeredQuestions < 5) {
        alert("System Warning: Please answer all 5 questions before proceeding.");
        return;
    }

    updateTrackerUI(); 

    if (currentPage < totalPages) {
        currentPage++;
        saveProgress();
        renderPage(currentPage);
        window.scrollTo(0, 0); 
    } else if (currentPage === totalPages) {
        saveProgress();
        document.getElementById('questions-container').classList.add('d-none');
        document.getElementById('nav-group').classList.add('d-none');
        document.getElementById('finish-container').classList.remove('d-none');
        document.getElementById('instructions-container').classList.add('d-none'); 
        window.scrollTo(0, 0);
    }
});

btnPrev.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        saveProgress();
        renderPage(currentPage);
        window.scrollTo(0, 0);
    }
});

btnStart.addEventListener('click', async function() {
    if (!questionBank || !studentsDB) {
        alert("System initialization incomplete. Please wait.");
        return;
    }

    const yearVal = document.getElementById('input-id-year').value;
    const numVal = document.getElementById('input-id-num').value;
    const gwaVal = parseFloat(document.getElementById('input-gwa').value);
    const strandVal = document.getElementById('input-strand').value;

    if (!yearVal || !numVal || yearVal.length !== 2 || numVal.length !== 5) {
        alert("Validation Error: Please enter a complete Student ID (XX-XXXXX).");
        document.getElementById('input-id-year').focus();
        return; 
    }

    if (!strandVal || strandVal === "Student Not Found") {
        alert("Validation Error: Student ID not recognized in the institutional database.");
        return;
    }

    if (isNaN(gwaVal) || gwaVal < 70 || gwaVal > 100) {
        alert("Validation Error: Please enter a valid General Weighted Average (70.00 - 100.00).");
        document.getElementById('input-gwa').focus();
        return;
    }

    const fullID = yearVal + "-" + numVal;
    
    const originalText = btnStart.innerText;
    btnStart.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Syncing Profile...`;
    btnStart.disabled = true;

    try {
        const docSnap = await getDoc(doc(db, "progress", fullID));

        if (docSnap.exists()) {
            const savedData = docSnap.data();
            studentAnswers = savedData.answers;
            currentPage = savedData.page;
            console.log("Restored cloud session for UID:", fullID);
        } else {
            studentAnswers = { phaseA: {}, phaseB: {}, phaseC: {} };
            currentPage = 1;
        }
    } catch (error) {
        console.error("Cloud sync failed. Initializing local session:", error);
        studentAnswers = { phaseA: {}, phaseB: {}, phaseC: {} };
        currentPage = 1;
    }

    btnStart.innerHTML = originalText;
    btnStart.disabled = false;

    sectionSetup.classList.add('d-none');        
    sectionAssessment.classList.remove('d-none'); 
    
    renderPage(currentPage);
    if (currentPage >= 6) updateTrackerUI();
});

// ==========================================
// 8. DATA VISUALIZATION LOGIC
// ==========================================
function calculatePhaseScores(phaseData, answersObj, keyName) {
    let scores = {};
    
    phaseData.forEach(q => {
        if (!scores[q[keyName]]) scores[q[keyName]] = 0;
    });

    phaseData.forEach(q => {
        if (answersObj[q.id]) {
            scores[q[keyName]] += answersObj[q.id];
        }
    });
    
    return scores;
}

function renderRIASECLineChart(canvasId, scores) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    const sortedKeys = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    const top3 = sortedKeys.slice(0, 3);
    
    const badgeContainer = document.getElementById('top-interests-container');
    const colors = {
        "Realistic": "#a3cfbb",
        "Investigative": "#c2a2d6",
        "Artistic": "#fff3cd",
        "Social": "#d1d9ff",
        "Enterprising": "#f8d7da",
        "Conventional": "#cfe2ff"
    };

    badgeContainer.innerHTML = '<small class="text-muted d-block mb-1">Top Interests:</small>';
    top3.forEach(trait => {
        badgeContainer.innerHTML += `
            <div class="interest-badge" style="background-color: ${colors[trait] || '#e9ecef'}">
                ${trait}
            </div>`;
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['R', 'I', 'A', 'S', 'E', 'C'],
            datasets: [{
                data: [
                    scores['Realistic'] || 0,
                    scores['Investigative'] || 0,
                    scores['Artistic'] || 0,
                    scores['Social'] || 0,
                    scores['Enterprising'] || 0,
                    scores['Conventional'] || 0
                ],
                borderColor: '#435ebe',
                backgroundColor: 'rgba(67, 94, 190, 0.1)',
                borderWidth: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#435ebe',
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false, beginAtZero: true, max: 25 },
                x: {
                    grid: { display: false },
                    ticks: { font: { weight: 'bold' } }
                }
            }
        }
    });
}

// ==========================================
// 9. PROGRESS TRACKER UPDATES
// ==========================================
function updateTrackerUI() {
    if (currentPage >= 6) {
        let scores = calculatePhaseScores(questionBank.phaseA_interests, studentAnswers.phaseA, 'trait');
        const cardA = document.getElementById('card-riasec');
        cardA.classList.add('unlocked');
        
        const body = cardA.querySelector('.tracker-body');
        body.innerHTML = `
            <div class="chart-wrapper">
                <canvas id="riasecLineChart"></canvas>
            </div>
            <div id="top-interests-container" class="mt-2"></div>
        `;
        renderRIASECLineChart('riasecLineChart', scores);
        setActiveTracker('riasec'); 
    }
    
    if (currentPage >= 8) {
        let scores = calculatePhaseScores(questionBank.phaseB_basic_skills, studentAnswers.phaseB, 'skill_id');
        const cardB = document.getElementById('card-basic');
        cardB.classList.add('unlocked');
        
        const body = cardB.querySelector('.tracker-body');
        body.innerHTML = ''; 
        
        Object.keys(scores).forEach(skill => {
            const questionCount = questionBank.phaseB_basic_skills.filter(q => q.skill_id === skill).length;
            const maxPossible = questionCount * 5;
            let percentage = (scores[skill] / maxPossible) * 100;
    
            body.innerHTML += `
                <div class="skill-item">
                    <span class="skill-name">${skill}</span>
                    <div class="progress-container">
                        <div class="progress-fill bg-phase-b" style="width: ${percentage}%"></div>
                    </div>
                </div>`;
        });
        setActiveTracker('basic'); 
    }
    
    if (currentPage === 13) {
        let scores = calculatePhaseScores(questionBank.phaseC_cross_skills, studentAnswers.phaseC, 'skill_id');
        const cardC = document.getElementById('card-cross');
        cardC.classList.add('unlocked');
        
        const body = cardC.querySelector('.tracker-body');
        body.innerHTML = ''; 

        const sortedSkills = Object.keys(scores).sort((a,b) => scores[b] - scores[a]);
        sortedSkills.forEach(skill => {
            const questionCount = questionBank.phaseC_cross_skills.filter(q => q.skill_id === skill).length;
            const maxPossible = questionCount * 5;
            let percentage = (scores[skill] / maxPossible) * 100;
            
            body.innerHTML += `
                <div class="skill-item">
                    <span class="skill-name">${skill}</span>
                    <div class="progress-container">
                        <div class="progress-fill bg-phase-c" style="width: ${percentage}%"></div>
                    </div>
                </div>`;
        });
        setActiveTracker('cross'); 
        document.getElementById('btn-calculate').classList.remove('d-none');
    }
}

function setActiveTracker(phaseId) {
    document.querySelectorAll('.tracker-card').forEach(card => {
        card.classList.remove('active');
    });

    const target = document.getElementById(`card-${phaseId}`);
    if (target) {
        target.classList.add('active');
    }
}

document.querySelectorAll('.tracker-header').forEach(header => {
    header.addEventListener('click', () => {
        const parent = header.parentElement;
        if (parent.classList.contains('unlocked')) {
            setActiveTracker(parent.id.replace('card-', ''));
        }
    });
});

// ==========================================
// 10. ALGORITHM: SIMPLE ADDITIVE WEIGHTING (SAW)
// ==========================================
let currentGlobalResults = [];
let currentGlobalRIASEC = [];

document.getElementById('btn-calculate').addEventListener('click', () => {
    const rawGWA = document.getElementById('input-gwa').value;
    const studentGWA = parseFloat(rawGWA);
    
    if (!rawGWA || isNaN(studentGWA) || studentGWA > 100 || studentGWA < 60) {
        alert("System Constraint: Invalid GWA parameter. Input must reside between 60.00 and 100.00.");
        document.getElementById('input-gwa').focus();
        return;
    }

    const studentBudget = parseFloat(document.getElementById('input-budget').value) || Infinity;
    const studentStrand = document.getElementById('input-strand').value;
    const studentLocation = document.getElementById('input-location').value;
    const studentType = document.getElementById('input-type').value;

    const riasecScores = calculatePhaseScores(questionBank.phaseA_interests, studentAnswers.phaseA, 'trait');
    const basicScores = calculatePhaseScores(questionBank.phaseB_basic_skills, studentAnswers.phaseB, 'skill_id');
    const crossScores = calculatePhaseScores(questionBank.phaseC_cross_skills, studentAnswers.phaseC, 'skill_id');
    const allStudentSkills = { ...basicScores, ...crossScores };
    const studentTopRIASEC = Object.keys(riasecScores).sort((a,b) => riasecScores[b] - riasecScores[a]).slice(0, 3);

    // Pre-calculate max possible scores for all skills to prevent heavy nested looping
    const maxSkillScores = {};
    [...questionBank.phaseB_basic_skills, ...questionBank.phaseC_cross_skills].forEach(q => {
        if (!maxSkillScores[q.skill_id]) maxSkillScores[q.skill_id] = 0;
        maxSkillScores[q.skill_id] += 5; // 5 is the max value per question
    });

    let evaluatedPrograms = {}; 

    for (const collegeId in collegesDB) {
        const college = collegesDB[collegeId];
        
        college.offerings.forEach(offering => {
            if (offering.estimated_tuition <= studentBudget && 
                offering.minimum_gwa <= studentGWA && 
                offering.accepted_strands.includes(studentStrand)) {
                
                const progId = offering.program_id;
                
                if (!evaluatedPrograms[progId]) {
                    const programData = programsDB[progId];
                    let riasecMatchScore = 0;
                    
                    // Check Program's Primary Trait against student's rank
                    let primaryIndex = studentTopRIASEC.indexOf(programData.riasec_primary);
                    if (primaryIndex === 0) riasecMatchScore += 15;      
                    else if (primaryIndex === 1) riasecMatchScore += 12; 
                    else if (primaryIndex === 2) riasecMatchScore += 8;  

                    // Check Program's Secondary Trait against student's rank
                    let secondaryIndex = studentTopRIASEC.indexOf(programData.riasec_secondary);
                    if (secondaryIndex === 0) riasecMatchScore += 10;
                    else if (secondaryIndex === 1) riasecMatchScore += 8;
                    else if (secondaryIndex === 2) riasecMatchScore += 5;

                    // Check Program's Tertiary Trait against student's rank
                    let tertiaryIndex = studentTopRIASEC.indexOf(programData.riasec_tertiary);
                    if (tertiaryIndex === 0) riasecMatchScore += 5;
                    else if (tertiaryIndex === 1) riasecMatchScore += 4;
                    else if (tertiaryIndex === 2) riasecMatchScore += 3;
                    
                    let totalSkillPercentage = 0;
                    programData.core_skills.forEach(requiredSkill => {
                        let studentScore = allStudentSkills[requiredSkill] || 0;
                        let maxPossible = maxSkillScores[requiredSkill] || 0; 
                        
                        totalSkillPercentage += Math.min(maxPossible > 0 ? (studentScore / maxPossible) * 100 : 0, 100);
                    });
                    
                    let averageSkillMatch = programData.core_skills.length > 0 ? (totalSkillPercentage / programData.core_skills.length) : 0;
                    let finalRiasecWeight = (riasecMatchScore / 30) * 100;
                    
                    let totalMatch = (finalRiasecWeight * 0.5) + (averageSkillMatch * 0.5);

                    evaluatedPrograms[progId] = {
                        id: progId,
                        programName: programData.program_name,
                        matchScore: parseFloat(totalMatch.toFixed(1)),
                        colleges: [],
                        reqSkills: programData.core_skills,
                        reqRiasec: [programData.riasec_primary, programData.riasec_secondary, programData.riasec_tertiary]
                    };
                }

                evaluatedPrograms[progId].colleges.push({
                    name: college.institution_name,
                    tuition: offering.estimated_tuition,
                    type: college.institution_type,
                    location: college.location
                });
            }
        });
    }

    let eligiblePrograms = Object.values(evaluatedPrograms).sort((a, b) => b.matchScore - a.matchScore);
    
    eligiblePrograms.forEach(prog => {
        prog.colleges.sort((a, b) => {
            let aPrefScore = 0; let bPrefScore = 0;
            if (studentLocation !== "Any" && a.location === studentLocation) aPrefScore += 2;
            if (studentLocation !== "Any" && b.location === studentLocation) bPrefScore += 2;
            if (studentType !== "Any" && a.type === studentType) aPrefScore += 1;
            if (studentType !== "Any" && b.type === studentType) bPrefScore += 1;
            if (aPrefScore !== bPrefScore) return bPrefScore - aPrefScore; 
            return a.tuition - b.tuition;
        });
    });

    currentGlobalResults = eligiblePrograms;
    currentGlobalRIASEC = studentTopRIASEC;

    renderDashboard(eligiblePrograms);

    const fullID = document.getElementById('input-id-year').value + "-" + document.getElementById('input-id-num').value;
    const studentFName = document.getElementById('input-fname').value;
    const studentLName = document.getElementById('input-lname').value;
    const rawPhaseScores = {
        phaseA: riasecScores,
        phaseB: basicScores,
        phaseC: crossScores
    }

    const assessmentResult = {
        firstName: studentFName,
        lastName: studentLName,
        strand: studentStrand,
        gwa: studentGWA,
        budget: studentBudget,
        location: studentLocation,
        type: studentType,
        topRIASEC: studentTopRIASEC,
        phaseScores: rawPhaseScores,
        timestamp: serverTimestamp(),
        topMatches: eligiblePrograms.slice(0, 3).map(p => ({
            programName: p.programName,
            matchScore: p.matchScore
        }))
    };

    setDoc(doc(db, "results", fullID), assessmentResult)
        .then(() => {
            console.log(`Cloud sync successful for ID: ${fullID}`);
            clearProgress();
        })
        .catch((error) => {
            console.error("Firestore persistence warning:", error);
            if (!navigator.onLine) {
                console.warn("Offline state detected. Data stored locally via Service Worker indexing.");
            }
        });
});

// ==========================================
// 11. GWA INPUT ENFORCEMENT 
// ==========================================
const gwaInput = document.getElementById('input-gwa');

gwaInput.addEventListener('input', function() {
    let val = parseFloat(this.value);
    
    if (val > 100) {
        this.value = 100;
    }
    
    if (val < 0) {
        this.value = 0;
    }
});

gwaInput.addEventListener('blur', function() {
    let val = parseFloat(this.value);
    if (val > 0 && val < 70) {
        alert("Note: GWA parameters must fulfill the minimum institutional requirement (70.00).");
        this.value = ""; 
    }
});

// ==========================================
// 12. EXPLAINABLE AI (XAI) UI PROJECTION
// ==========================================
function renderDashboard(allPrograms) {
    document.getElementById('section-assessment').classList.add('d-none');
    document.getElementById('section-dashboard').classList.remove('d-none');

    const resultsContainer = document.getElementById('dashboard-results');
    const modalList = document.getElementById('all-programs-list');
    
    if (allPrograms.length === 0) {
        resultsContainer.innerHTML = `
            <div class="alert alert-warning text-center">
                <h5><i class="bi bi-exclamation-triangle"></i> No Constraint Matches Found</h5>
                <p>The specified parameters (GWA, Budget, Strand) returned null intersection with the database.</p>
            </div>`;
        modalList.innerHTML = `<p class="text-center text-muted">No data available.</p>`;
        return;
    }

    const top3 = allPrograms.slice(0, 3);
    let cardsHTML = `<div class="row mt-4 justify-content-center">`;
    
    top3.forEach((prog, index) => {
        let badgeColor = index === 0 ? 'bg-warning text-dark' : 'bg-secondary';
        let rankText = index === 0 ? 'Top Match' : `Rank ${index + 1}`;
        
        cardsHTML += `
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow-sm border-${index === 0 ? 'warning' : 'light'} clickable-card" onclick="openProgramDetails('${prog.id}')">
                    <div class="card-body text-center d-flex flex-column">
                        <div>
                            <span class="badge ${badgeColor} mb-3 py-2 px-3">${rankText}</span>
                            <h5 class="card-title fw-bold text-primary mb-3">${prog.programName}</h5>
                        </div>
                        
                        <div class="my-auto py-4">
                            <div class="display-4 fw-bold text-success mb-1">${prog.matchScore}%</div>
                            <small class="text-uppercase fw-bold text-muted">Algorithm Confidence</small>
                        </div>
                        
                        <div class="mt-auto pt-3 border-top text-muted" style="font-size: 0.85rem;">
                            <i class="bi bi-hand-index-thumb me-1"></i> View Explainable Logic (XAI)
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    cardsHTML += `</div>`;
    resultsContainer.innerHTML = cardsHTML;

    let tableHTML = `
        <table class="table table-hover align-middle">
            <thead class="table-light">
                <tr>
                    <th>Rank</th>
                    <th>Program</th>
                    <th>Confidence Score</th>
                    <th>Applicable Institutions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    allPrograms.forEach((prog, index) => {
        tableHTML += `
            <tr class="clickable-row" onclick="openProgramDetails('${prog.id}')">
                <td class="fw-bold text-muted">#${index + 1}</td>
                <td class="fw-bold text-primary">${prog.programName}</td>
                <td><span class="badge bg-success fs-6">${prog.matchScore}%</span></td>
                <td style="font-size: 0.85rem;"><i class="bi bi-building"></i> ${prog.colleges.length} Locations</td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody></table>`;
    modalList.innerHTML = tableHTML;
}

function openProgramDetails(progId) {
    const prog = currentGlobalResults.find(p => p.id === progId);
    if (!prog) return;

    document.getElementById('detail-program-name').innerText = prog.programName;
    document.getElementById('detail-match-score').innerText = `${prog.matchScore}% Composite Match`;

    let matchedTraits = currentGlobalRIASEC.filter(trait => prog.reqRiasec.includes(trait));
    let psychText = matchedTraits.length > 0 
        ? `This program correlates with <strong>${prog.reqRiasec.join(', ')}</strong> psychometrics. Profile indicates strong intersection with: <span class="text-primary fw-bold">${matchedTraits.join(', ')}</span>.` 
        : `This program correlates with <strong>${prog.reqRiasec.join(', ')}</strong> psychometrics. Profile indicates secondary parameter alignment.`;
    document.getElementById('detail-xai-psych').innerHTML = psychText;

    document.getElementById('detail-xai-skills').innerHTML = `Foundational and specialized evaluation denotes systemic readiness for the targeted competencies: <strong>${prog.reqSkills.join(', ')}</strong>.`;

    let collegeListHTML = '';
    prog.colleges.forEach((c, index) => {
        let isTop = index === 0 ? 'border-primary border-2 bg-white' : 'bg-light';
        let badge = index === 0 ? `<span class="badge bg-primary float-end">Optimal Context</span>` : '';
        
        collegeListHTML += `
            <div class="list-group-item ${isTop} py-3">
                ${badge}
                <h6 class="mb-1 fw-bold text-dark">${c.name}</h6>
                <div class="d-flex text-muted" style="font-size: 0.85rem;">
                    <span class="me-3"><i class="bi bi-geo-alt me-1"></i>${c.location}</span>
                    <span class="me-3"><i class="bi bi-bank me-1"></i>${c.type}</span>
                    <span class="text-success fw-bold"><i class="bi bi-cash me-1"></i>₱${c.tuition.toLocaleString()}</span>
                </div>
            </div>
        `;
    });
    document.getElementById('detail-college-list').innerHTML = collegeListHTML;

    const modalElement = document.getElementById('programDetailsModal');
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();
}

// ==========================================
// 13. DEVELOPMENT UTILITY: FAST FORWARD
// ==========================================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        if (!questionBank) return console.warn("Databases pending load.");
        
        ['phaseA', 'phaseB', 'phaseC'].forEach((phase, idx) => {
            let bank = [questionBank.phaseA_interests, questionBank.phaseB_basic_skills, questionBank.phaseC_cross_skills][idx];
            bank.forEach(q => studentAnswers[phase][q.id] = Math.floor(Math.random() * 5) + 1);
        });
        
        currentPage = 13;
        renderPage(13);
        updateTrackerUI();
        
        console.log("Dev execution: Assessment populated via simulated input.");
        window.scrollTo(0, document.body.scrollHeight);
    }
});

// ==========================================
// 14. ADMINISTRATIVE PORTAL ROUTING
// ==========================================
const secretLogo = document.getElementById('secret-admin-logo');

if (secretLogo) {
    secretLogo.addEventListener('click', function(event) {
        if (event.detail === 3) {
            this.style.transform = "scale(0)";
            setTimeout(() => {
                window.location.href = 'counselor.html';
            }, 300); 
        }
    });
}