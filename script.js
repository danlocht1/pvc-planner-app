// --- DOM Elements ---
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const spacingInput = document.getElementById('spacing');
const pipeLengthInput = document.getElementById('pipeLength');
const includeCornerHolesCheckbox = document.getElementById('includeCornerHoles');
const calculateBtn = document.getElementById('calculateBtn');
const resultsOutput = document.getElementById('resultsOutput');
const pvcCanvas = document.getElementById('pvcCanvas');
const pvcCtx = pvcCanvas.getContext('2d');
const shapeSelect = document.getElementById('shapeSelect');
const insertLengthInput = document.getElementById('insertLength');
const visibleOffsetInput = document.getElementById('visibleOffset');
const actualDrillOffsetInput = document.getElementById('actualDrillOffset');
const straightLineStartOffsetInput = document.getElementById('straightLineStartOffset');
const maxHolesPerSectionInput = document.getElementById('maxHolesPerSection');
const basePriceInput = document.getElementById('basePrice');
const bulkPriceInput = document.getElementById('bulkPrice');
const bulkThresholdInput = document.getElementById('bulkThreshold');
const couplingCostInput = document.getElementById('couplingCost');
const elbowCostInput = document.getElementById('elbowCost');
const salesTaxRateInput = document.getElementById('salesTaxRate');
const saveReportBtn = document.getElementById('saveReportBtn');
const exportLabelsBtn = document.getElementById('exportLabelsBtn');
const exportVisualBtn = document.getElementById('exportVisualBtn');
const resetBtn = document.getElementById('resetBtn');
const heightInputGroup = document.getElementById('heightInputGroup');
const themeToggle = document.getElementById('themeToggle');
const wiringStartPoint = document.getElementById('wiringStartPoint');


// --- Constants / Default Values ---
const DEFAULT_PIPE_LENGTH = 120.0;
const DEFAULT_SPACING = 2.0;
const DEFAULT_INSERT_LENGTH = 1.5;
const DEFAULT_VISIBLE_OFFSET = 0.25;
const DEFAULT_STRAIGHT_LINE_START_OFFSET = 0.5;
const MAX_HOLES_PER_SECTION = 50;
const DEFAULT_BASE_PRICE = 4.38;
const DEFAULT_BULK_PRICE = 3.50;
const DEFAULT_BULK_THRESHOLD = 8;
const DEFAULT_COUPLING_COST = 0.78;
const DEFAULT_ELBOW_COST = 0.58;
const DEFAULT_SALES_TAX_RATE = 6.5;

// --- Global Data for Export ---
let allLabelsData = [];
let plainTextReport = '';


// --- Theme Switcher Logic ---
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeToggle.checked = theme === 'dark';
    performCalculation();
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// --- Collapsible Sections Logic ---
function setupCollapsibles() {
    const toggles = document.querySelectorAll('.collapsible-toggle');
    toggles.forEach(toggle => {
        if (toggle.dataset.listenerAttached) return;

        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            const icon = toggle.querySelector('.toggle-icon');
            const content = toggle.nextElementSibling;

            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                if (icon) icon.textContent = '+';
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                if (icon) icon.textContent = '–';
            }
        });
        toggle.dataset.listenerAttached = 'true';
    });
}

// --- Initial Setup on Load ---
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    setupCollapsibles();
    updateHeightInputState();
    updateActualDrillOffset();
    performCalculation();
});

// --- Utility Functions ---
function parseFeetInches(s) {
    try {
        if (!s) return null;
        s = s.trim().replace(/"/g, '');
        const parts = s.split("'");
        let feet = 0;
        let inches = 0.0;
        if (parts.length === 2) {
            if (parts[0]) feet = parseInt(parts[0]);
            if (parts[1]) inches = parseFloat(parts[1]);
        } else if (parts.length === 1) {
            inches = parseFloat(parts[0]);
        } else {
            return null;
        }
        if (isNaN(feet) || isNaN(inches)) return null;
        return feet * 12 + inches;
    } catch (e) {
        console.error(`Error parsing feet/inches: ${e}`);
        return null;
    }
}

function resetAllInputs() {
    widthInput.value = "30'";
    heightInput.value = "10'";
    spacingInput.value = DEFAULT_SPACING;
    pipeLengthInput.value = DEFAULT_PIPE_LENGTH;
    includeCornerHolesCheckbox.checked = true;
    insertLengthInput.value = DEFAULT_INSERT_LENGTH;
    visibleOffsetInput.value = DEFAULT_VISIBLE_OFFSET;
    straightLineStartOffsetInput.value = DEFAULT_STRAIGHT_LINE_START_OFFSET;
    maxHolesPerSectionInput.value = MAX_HOLES_PER_SECTION;
    basePriceInput.value = DEFAULT_BASE_PRICE;
    bulkPriceInput.value = DEFAULT_BULK_PRICE;
    bulkThresholdInput.value = DEFAULT_BULK_THRESHOLD;
    couplingCostInput.value = DEFAULT_COUPLING_COST;
    elbowCostInput.value = DEFAULT_ELBOW_COST;
    salesTaxRateInput.value = DEFAULT_SALES_TAX_RATE;
    shapeSelect.value = "rectangle";
    updateHeightInputState();
    updateActualDrillOffset();
    performCalculation();
}

function updateActualDrillOffset() {
    const insertLength = parseFloat(insertLengthInput.value) || 0;
    const visibleOffset = parseFloat(visibleOffsetInput.value) || 0;
    const actualOffset = insertLength + visibleOffset;
    actualDrillOffsetInput.value = actualOffset.toFixed(2);
    performCalculation();
}

function updateWiringOptions() {
    const selectedShape = shapeSelect.value;
    wiringStartPoint.innerHTML = ''; // Clear existing options

    let options = [];
    if (selectedShape === 'rectangle') {
        options = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"];
    } else {
        options = ["Start", "End"];
    }

    options.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.toLowerCase().replace('-', '');
        optionEl.textContent = opt;
        wiringStartPoint.appendChild(optionEl);
    });
}


// --- Core Calculation Logic ---
function splitSideIntoSections(
    totalLength,
    spacing,
    isRectangleSide = false,
    pipeLengthConstraint = DEFAULT_PIPE_LENGTH,
    drillOffset = 0.5,
    maxHolesPerString = MAX_HOLES_PER_SECTION,
    includeCornerHole = false
) {
    if (totalLength <= 0) return [];

    const finalSections = [];
    const totalHolesForSide = Math.floor(totalLength / spacing) + 1;

    const logicalStrings = [];
    let holesRemaining = totalHolesForSide;

    while (holesRemaining > 0) {
        const holesForThisString = Math.min(holesRemaining, maxHolesPerString);
        logicalStrings.push({ numberOfHoles: holesForThisString });
        holesRemaining -= holesForThisString;
    }

    logicalStrings.forEach((string, index) => {
        let holesForLengthCalc = string.numberOfHoles;
        let isCornerPiece = false;

        if (isRectangleSide && includeCornerHole && index === 0) {
            isCornerPiece = true;
            holesForLengthCalc = Math.max(1, string.numberOfHoles - 1);
        }

        if (holesForLengthCalc <= 0 && string.numberOfHoles > 0) {
            holesForLengthCalc = 1;
        }

        let requiredLength = (holesForLengthCalc - 1) * spacing + (2 * drillOffset);
        if (string.numberOfHoles === 1) {
            requiredLength = 2 * drillOffset;
        }

        let lengthRemainingForString = requiredLength;
        let isFirstCut = true;
        while (lengthRemainingForString > 0.001) {
            const cutLength = Math.min(lengthRemainingForString, pipeLengthConstraint);
            finalSections.push({
                sectionLength: cutLength,
                numberOfHoles: isFirstCut ? string.numberOfHoles : 0,
                isCornerSection: isFirstCut && isCornerPiece
            });
            isFirstCut = false;
            lengthRemainingForString -= cutLength;
        }
    });

    return finalSections;
}


function performCalculation() {
    try {
        updateWiringOptions(); // Fix for broken wiring options
        const selectedShape = shapeSelect.value;
        const spacing = parseFloat(spacingInput.value) || DEFAULT_SPACING;
        const pipeLength = parseFloat(pipeLengthInput.value) || DEFAULT_PIPE_LENGTH;
        const includeCornerHoles = includeCornerHolesCheckbox.checked;
        const maxHolesVal = parseInt(maxHolesPerSectionInput.value) || MAX_HOLES_PER_SECTION;

        const drillOffsetVal = parseFloat(actualDrillOffsetInput.value);
        const straightLineStartOffsetVal = parseFloat(straightLineStartOffsetInput.value);

        const basePriceVal = parseFloat(basePriceInput.value);
        const bulkPriceVal = parseFloat(bulkPriceInput.value);
        const bulkThresholdVal = parseFloat(bulkThresholdInput.value);
        const couplingCostVal = parseFloat(couplingCostInput.value);
        const elbowCostVal = parseFloat(elbowCostInput.value);
        const salesTaxRateVal = (parseFloat(salesTaxRateInput.value) || 0) / 100.0;

        if (spacing <= 0 || pipeLength <= 0) {
            resultsOutput.innerHTML = `<p>Error: Spacing and Pipe Length must be positive numbers.</p>`;
            return;
        }

        let totalHoles = 0,
            totalLengthUsed = 0,
            pvcCount = 0,
            elbowCount = 0,
            couplingCount = 0;
        let widthSections = [],
            heightSections = [],
            sections = [];
        allLabelsData = [];

        if (selectedShape === "rectangle") {
            const width = parseFeetInches(widthInput.value);
            const height = parseFeetInches(heightInput.value);
            if (width === null || height === null || width <= 0 || height <= 0) {
                resultsOutput.innerHTML = `<p>Enter valid dimensions for the rectangle.</p>`;
                drawPvcVisual(0, 0, [], []);
                return;
            }
            widthSections = splitSideIntoSections(width, spacing, true, pipeLength, drillOffsetVal, maxHolesVal, includeCornerHoles);
            heightSections = splitSideIntoSections(height, spacing, true, pipeLength, drillOffsetVal, maxHolesVal, includeCornerHoles);

            const allSectionsCalc = [...widthSections, ...widthSections, ...heightSections, ...heightSections];
            totalHoles = (Math.floor(width / spacing) + 1) * 2 + (Math.floor(height / spacing) + 1) * 2;
            if (includeCornerHoles) {
                totalHoles -= 4;
            }

            totalLengthUsed = allSectionsCalc.reduce((sum, s) => sum + s.sectionLength, 0);
            pvcCount = Math.ceil(totalLengthUsed / pipeLength);
            elbowCount = 4;
            couplingCount = Math.max(0, allSectionsCalc.length - 4);
            drawPvcVisual(width, height, widthSections, heightSections);

        } else {
            const totalLength = parseFeetInches(widthInput.value);
            if (totalLength === null || totalLength <= 0) {
                resultsOutput.innerHTML = `<p>Enter a valid length.</p>`;
                drawPvcVisual(0, 0, [], []);
                return;
            }
            sections = splitSideIntoSections(totalLength, spacing, false, pipeLength, straightLineStartOffsetVal, maxHolesVal, false);
            totalHoles = sections.reduce((sum, s) => sum + s.numberOfHoles, 0);
            totalLengthUsed = sections.reduce((sum, s) => sum + s.sectionLength, 0);
            pvcCount = Math.ceil(totalLengthUsed / pipeLength);
            elbowCount = 0;
            couplingCount = Math.max(0, sections.length - 1);
            drawPvcVisual(totalLength, 0, sections);
        }

        let htmlReport = '';
        plainTextReport = '--- PVC Project Report ---\n\n';

        htmlReport += `<div class="report-section"><h3>Summary</h3><table>`;
        htmlReport += `<tr><td>Total PVC Pipes:</td><td>${pvcCount}</td></tr>`;
        htmlReport += `<tr><td>Total PVC Length:</td><td>${totalLengthUsed.toFixed(2)}"</td></tr>`;
        htmlReport += `<tr><td>Total Holes:</td><td>${totalHoles}</td></tr>`;
        htmlReport += `<tr><td>Elbows:</td><td>${elbowCount}</td></tr>`;
        htmlReport += `<tr><td>Couplings:</td><td>${couplingCount}</td></tr>`;
        htmlReport += `</table></div>`;
        plainTextReport += `--- SUMMARY ---\n  Total PVC Pipes: ${pvcCount}\n  Total PVC Length: ${totalLengthUsed.toFixed(2)}"\n  Total Holes: ${totalHoles}\n  Elbows: ${elbowCount}, Couplings: ${couplingCount}\n\n`;

        const totalPipesCost = pvcCount >= bulkThresholdVal ? pvcCount * bulkPriceVal : pvcCount * basePriceVal;
        const totalCouplingsCost = couplingCount * couplingCostVal;
        const totalElbowsCost = elbowCount * elbowCostVal;
        const subtotal = totalPipesCost + totalCouplingsCost + totalElbowsCost;
        const salesTaxAmount = subtotal * salesTaxRateVal;
        const totalProjectCost = subtotal + salesTaxAmount;
        htmlReport += `<div class="report-section">`;
        htmlReport += `<div class="collapsible-toggle"><h3>Cost Breakdown</h3><span class="toggle-icon">+</span></div>`;
        htmlReport += `<div class="collapsible-content"><table>`;
        htmlReport += `<tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>`;
        if (pvcCount > 0) htmlReport += `<tr><td>PVC Pipes</td><td>${pvcCount}</td><td>$${(totalPipesCost/pvcCount).toFixed(2)}</td><td>$${totalPipesCost.toFixed(2)}</td></tr>`;
        if (couplingCount > 0) htmlReport += `<tr><td>Couplings</td><td>${couplingCount}</td><td>$${couplingCostVal.toFixed(2)}</td><td>$${totalCouplingsCost.toFixed(2)}</td></tr>`;
        if (elbowCount > 0) htmlReport += `<tr><td>Elbows</td><td>${elbowCount}</td><td>$${elbowCostVal.toFixed(2)}</td><td>$${totalElbowsCost.toFixed(2)}</td></tr>`;
        htmlReport += `<tr class="total-row"><td>Subtotal</td><td colspan="2"></td><td>$${subtotal.toFixed(2)}</td></tr>`;
        htmlReport += `<tr><td>Sales Tax</td><td colspan="2"></td><td>$${salesTaxAmount.toFixed(2)}</td></tr>`;
        htmlReport += `<tr class="total-row"><td>TOTAL COST</td><td colspan="2"></td><td>$${totalProjectCost.toFixed(2)}</td></tr>`;
        htmlReport += `</table></div></div>`;
        plainTextReport += `--- COST ---\n  Subtotal: $${subtotal.toFixed(2)}\n  Sales Tax: $${salesTaxAmount.toFixed(2)}\n  TOTAL COST: $${totalProjectCost.toFixed(2)}\n\n`;

        htmlReport += `<div class="report-section">`;
        htmlReport += `<div class="collapsible-toggle"><h3>Cut List</h3><span class="toggle-icon">+</span></div>`;
        htmlReport += `<div class="collapsible-content">`;
        plainTextReport += `--- CUT LIST ---\n`;
        if (selectedShape === 'rectangle') {
            htmlReport += `<table><tr><th>Side</th><th>Section</th><th>Length</th><th>Holes</th><th>Notes</th></tr>`;
            plainTextReport += `  Top/Bottom Sides (${widthInput.value}):\n`;
            widthSections.forEach((s, i) => {
                htmlReport += `<tr><td>Top/Bottom</td><td>${i + 1}</td><td>${s.sectionLength.toFixed(2)}"</td><td>${s.numberOfHoles}</td><td>${s.isCornerSection ? 'Corner Piece' : ''}</td></tr>`;
                plainTextReport += `    - Section ${i + 1}: ${s.sectionLength.toFixed(2)}" L, ${s.numberOfHoles} holes ${s.isCornerSection ? '(Corner)' : ''}\n`;
            });
            plainTextReport += `  Left/Right Sides (${heightInput.value}):\n`;
            heightSections.forEach((s, i) => {
                htmlReport += `<tr><td>Left/Right</td><td>${i + 1}</td><td>${s.sectionLength.toFixed(2)}"</td><td>${s.numberOfHoles}</td><td>${s.isCornerSection ? 'Corner Piece' : ''}</td></tr>`;
                plainTextReport += `    - Section ${i + 1}: ${s.sectionLength.toFixed(2)}" L, ${s.numberOfHoles} holes ${s.isCornerSection ? '(Corner)' : ''}\n`;
            });
            htmlReport += `</table>`;
        } else {
            htmlReport += `<table><tr><th>Section</th><th>Length</th><th>Holes</th></tr>`;
            plainTextReport += `  Straight Line (${widthInput.value}):\n`;
            sections.forEach((s, i) => {
                htmlReport += `<tr><td>${i + 1}</td><td>${s.sectionLength.toFixed(2)}"</td><td>${s.numberOfHoles}</td></tr>`;
                plainTextReport += `    - Section ${i + 1}: ${s.sectionLength.toFixed(2)}" L, ${s.numberOfHoles} holes\n`;
            });
            htmlReport += `</table>`;
        }
        htmlReport += `</div></div>`;

        resultsOutput.innerHTML = htmlReport;
        setupCollapsibles();

    } catch (error) {
        resultsOutput.innerHTML = `<p>An error occurred: ${error.message}</p>`;
        console.error("Calculation error:", error);
    }
}

// --- REDESIGNED VISUAL REPRESENTATION ---
function drawPvcVisual(width, height, sections1, sections2) {
    const ctx = pvcCtx;
    const canvas = pvcCanvas;
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Style Definitions ---
    const pipeColorLight = isDarkMode ? '#bbdefb' : '#f5f5f5';
    const pipeColorDark = isDarkMode ? '#64b5f6' : '#e0e0e0';
    const fittingColorLight = isDarkMode ? '#9e9e9e' : '#e0e0e0';
    const fittingColorDark = isDarkMode ? '#616161' : '#bdbdbd';
    const elbowColorLight = isDarkMode ? '#f48fb1' : '#ffcdd2';
    const elbowColorDark = isDarkMode ? '#f06292' : '#e57373';
    const textColor = isDarkMode ? '#eeeeee' : '#212121';
    const shadowColor = isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)';
    const pipeWidth = 14;
    const fittingWidth = pipeWidth * 1.5;
    const lineHeight = 14;

    ctx.font = `bold 12px ${getComputedStyle(document.body).fontFamily}`;
    ctx.lineCap = 'round';
    const shape = shapeSelect.value;
    
    const createGradient = (x1, y1, x2, y2, color1, color2) => {
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };

    const drawPipe = (x1, y1, x2, y2) => {
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = pipeWidth + 2;
        ctx.beginPath();
        ctx.moveTo(x1 + 2, y1 + 2);
        ctx.lineTo(x2 + 2, y2 + 2);
        ctx.stroke();

        ctx.lineWidth = pipeWidth;
        if(Math.abs(y2-y1) > Math.abs(x2-x1)){ // Vertical
             ctx.strokeStyle = createGradient(x1 - pipeWidth, 0, x1 + pipeWidth, 0, pipeColorLight, pipeColorDark);
        } else { // Horizontal
             ctx.strokeStyle = createGradient(0, y1 - pipeWidth, 0, y1 + pipeWidth, pipeColorLight, pipeColorDark);
        }
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if(Math.abs(y2-y1) > Math.abs(x2-x1)){
             ctx.moveTo(x1 - pipeWidth/4, y1);
             ctx.lineTo(x2 - pipeWidth/4, y2);
        } else {
            ctx.moveTo(x1, y1 - pipeWidth/4);
            ctx.lineTo(x2, y2 - pipeWidth/4);
        }
        ctx.stroke();
    };

    const drawFitting = (x, y, type = 'coupling') => {
        const light = type === 'elbow' ? elbowColorLight : fittingColorLight;
        const dark = type === 'elbow' ? elbowColorDark : fittingColorDark;

        const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, fittingWidth);
        grad.addColorStop(0, light);
        grad.addColorStop(1, dark);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(x, y, fittingWidth / 2, 0, 2 * Math.PI);
        ctx.fill();
    };

    if (shape === 'rectangle' && width > 0 && height > 0) {
        const widthSections = sections1;
        const heightSections = sections2;
        const padding = { top: 60, right: 110, bottom: 60, left: 110 };
        const availableWidth = canvas.width - padding.left - padding.right;
        const availableHeight = canvas.height - padding.top - padding.bottom;
        const scale = Math.min(availableWidth / width, availableHeight / height);
        const sWidth = width * scale;
        const sHeight = height * scale;
        const startX = padding.left + (availableWidth - sWidth) / 2;
        const startY = padding.top + (availableHeight - sHeight) / 2;
        
        const drawSide = (sections, startPoint, isHorizontal, reverse = false) => {
            let currentOffset = 0;

            sections.forEach((section, index) => {
                const scaledLen = section.sectionLength * scale;
                
                let p1, p2;
                if (isHorizontal) {
                    const x1 = reverse ? startPoint.x - currentOffset : startPoint.x + currentOffset;
                    const x2 = reverse ? x1 - scaledLen : x1 + scaledLen;
                    p1 = { x: x1, y: startPoint.y };
                    p2 = { x: x2, y: startPoint.y };
                } else { // Vertical
                    const y1 = reverse ? startPoint.y - currentOffset : startPoint.y + currentOffset;
                    const y2 = reverse ? y1 - scaledLen : y1 + scaledLen;
                    p1 = { x: startPoint.x, y: y1 };
                    p2 = { x: startPoint.x, y: y2 };
                }
                
                drawPipe(p1.x, p1.y, p2.x, p2.y);

                if (index < sections.length - 1) {
                    drawFitting(p2.x, p2.y, 'coupling');
                }
                
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                
                if (isHorizontal) {
                    ctx.textBaseline = startPoint.y > canvas.height / 2 ? 'top' : 'bottom';
                    const yOffset = ctx.textBaseline === 'top' ? pipeWidth + 8 : -pipeWidth - 8;
                    ctx.fillText(`${section.sectionLength.toFixed(2)}"`, midX, startPoint.y + yOffset);
                    ctx.fillText(`${section.numberOfHoles}H`, midX, startPoint.y + yOffset + (ctx.textBaseline === 'top' ? lineHeight : -lineHeight));
                } else {
                    ctx.textAlign = startPoint.x > canvas.width / 2 ? 'left' : 'right';
                    const xOffset = ctx.textAlign === 'left' ? pipeWidth + 8 : -pipeWidth - 8;
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${section.sectionLength.toFixed(2)}"`, startPoint.x + xOffset, midY);
                    ctx.fillText(`${section.numberOfHoles}H`, startPoint.x + xOffset, midY + lineHeight);
                }
                currentOffset += scaledLen;
            });
        };
        
        drawSide(widthSections, { x: startX, y: startY }, true, false); // Top (L-R)
        drawSide(heightSections, { x: startX + sWidth, y: startY }, false, false); // Right (T-B)
        drawSide(widthSections, { x: startX + sWidth, y: startY + sHeight }, true, true); // Bottom (R-L)
        drawSide(heightSections, { x: startX, y: startY + sHeight }, false, true); // Left (B-T)

        drawFitting(startX, startY, 'elbow');
        drawFitting(startX + sWidth, startY, 'elbow');
        drawFitting(startX, startY + sHeight, 'elbow');
        drawFitting(startX + sWidth, startY + sHeight, 'elbow');

    } else if (shape === 'straight' || shape === 'arch') {
         const sections = sections1;
         if (!sections || sections.length === 0) return;
         const totalLength = sections.reduce((sum, s) => sum + s.sectionLength, 0);
         const padding = 60;
         const y = canvas.height / 2;

         if(shape === 'arch') {
            const radius = totalLength / Math.PI;
            const archScale = (canvas.width - padding * 2) / (radius * 2);
            const archCenterX = canvas.width / 2;
            const archCenterY = canvas.height - padding + radius * archScale;
            let currentAngle = Math.PI;

             sections.forEach((section, index) => {
                 const angleLength = (section.sectionLength / totalLength) * Math.PI;
                 const startAngle = currentAngle;
                 const endAngle = currentAngle + angleLength;
                
                ctx.strokeStyle = shadowColor;
                ctx.lineWidth = pipeWidth + 2;
                ctx.beginPath();
                ctx.arc(archCenterX + 2, archCenterY + 2, radius * archScale, startAngle, endAngle);
                ctx.stroke();

                 ctx.strokeStyle = pipeColorDark;
                 ctx.lineWidth = pipeWidth;
                 ctx.beginPath();
                 ctx.arc(archCenterX, archCenterY, radius * archScale, startAngle, endAngle);
                 ctx.stroke();

                 if (index < sections.length - 1) {
                    const couplingX = archCenterX + Math.cos(endAngle) * radius * archScale;
                    const couplingY = archCenterY + Math.sin(endAngle) * radius * archScale;
                    drawFitting(couplingX, couplingY, 'coupling');
                 }
                 
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                const midAngle = startAngle + angleLength / 2;
                const labelRadius = (radius * archScale) + pipeWidth + 15;
                const labelX = archCenterX + Math.cos(midAngle) * labelRadius;
                const labelY = archCenterY + Math.sin(midAngle) * labelRadius;
                ctx.save();
                ctx.translate(labelX, labelY);
                ctx.rotate(midAngle + Math.PI/2);
                ctx.fillText(`${section.sectionLength.toFixed(2)}"`, 0, 0);
                ctx.fillText(`${section.numberOfHoles}H`, 0, lineHeight);
                ctx.restore();

                 currentAngle = endAngle;
             });

         } else { // Straight line
            const scale = (canvas.width - padding * 2) / totalLength;
            let currentX = padding;
            sections.forEach((section, index) => {
                const scaledLen = section.sectionLength * scale;
                drawPipe(currentX, y, currentX + scaledLen, y);
                if (index < sections.length - 1) {
                    drawFitting(currentX + scaledLen, y, 'coupling');
                }

                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${section.sectionLength.toFixed(2)}"`, currentX + scaledLen / 2, y - pipeWidth - 8);
                ctx.fillText(`${section.numberOfHoles}H`, currentX + scaledLen / 2, y - pipeWidth - 8 - lineHeight);
                currentX += scaledLen;
            });
         }
    }
}


// --- Export Functions ---
function saveReportSummary() {
    if (!plainTextReport) {
        alert("No report to save!");
        return;
    }
    const blob = new Blob([plainTextReport], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'PVC_Project_Report.txt';
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportLabels() {
    alert("Export Labels functionality not yet fully implemented.");
}

function exportVisualCanvas() {
    const a = document.createElement('a');
    a.href = pvcCanvas.toDataURL('image/png');
    a.download = 'PVC_Project_Visual.png';
    a.click();
}

// --- Event Listeners ---
calculateBtn.addEventListener('click', performCalculation);
shapeSelect.addEventListener('change', updateHeightInputState);
saveReportBtn.addEventListener('click', saveReportSummary);
exportLabelsBtn.addEventListener('click', exportLabels);
exportVisualBtn.addEventListener('click', exportVisualCanvas);
resetBtn.addEventListener('click', resetAllInputs);
themeToggle.addEventListener('change', toggleTheme);

[
    widthInput, heightInput, spacingInput, pipeLengthInput, includeCornerHolesCheckbox,
    insertLengthInput, visibleOffsetInput, straightLineStartOffsetInput, maxHolesPerSectionInput,
    basePriceInput, bulkPriceInput, bulkThresholdInput, couplingCostInput, elbowCostInput, salesTaxRateInput
].forEach(input => {
    input.addEventListener('input', () => {
        if (input.id === 'insertLength' || input.id === 'visibleOffset') {
            updateActualDrillOffset();
        } else {
            performCalculation();
        }
    });
});

function updateHeightInputState() {
    const isRectangle = shapeSelect.value === 'rectangle';
    heightInputGroup.setAttribute('data-visible', isRectangle);
    if (!isRectangle) {
        heightInput.value = '';
    }
    performCalculation();
}
