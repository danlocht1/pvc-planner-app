// --- DOM Elements ---
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const spacingInput = document.getElementById('spacing');
const pipeLengthInput = document.getElementById('pipeLength');
const includeCornerHolesCheckbox = document.getElementById('includeCornerHoles');
const calculateBtn = document.getElementById('calculateBtn');
const resultsOutput = document.getElementById('resultsOutput');
const canvas = document.getElementById('pvcCanvas');
const ctx = canvas.getContext('2d');
const shapeSelect = document.getElementById('shapeSelect');
const insertLengthInput = document.getElementById('insertLength');
const drillOffsetInput = document.getElementById('drillOffset');
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
const holeSizeInput = document.getElementById('holeSize');
const wiringOptionsGroup = document.getElementById('wiringOptionsGroup');
const wiringStartPointInput = document.getElementById('wiringStartPoint');
const wiringDirectionGroup = document.getElementById('wiringDirectionGroup');
const wiringDirectionInput = document.getElementById('wiringDirection');
const showWiringCheckbox = document.getElementById('showWiring');


// --- Constants / Default Values ---
const DEFAULT_PIPE_LENGTH = 120.0;
const DEFAULT_SPACING = 2.0;
const DEFAULT_INSERT_LENGTH = 1.5;
const DEFAULT_DRILL_OFFSET = 0.25;
const DEFAULT_STRAIGHT_LINE_START_OFFSET = 0.5;
const MAX_HOLES_PER_SECTION = 50;
const DEFAULT_BASE_PRICE = 4.38;
const DEFAULT_BULK_PRICE = 3.50;
const DEFAULT_BULK_THRESHOLD = 8;
const DEFAULT_COUPLING_COST = 0.78;
const DEFAULT_ELBOW_COST = 0.58;
const DEFAULT_SALES_TAX_RATE = 6.5;
const DEFAULT_HOLE_SIZE = '1/2"';

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


// Apply saved theme and setup UI on load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    setupCollapsibles();
    updateHeightInputState();
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
    heightInput.value = "";
    spacingInput.value = DEFAULT_SPACING;
    pipeLengthInput.value = DEFAULT_PIPE_LENGTH;
    includeCornerHolesCheckbox.checked = true;
    insertLengthInput.value = DEFAULT_INSERT_LENGTH;
    drillOffsetInput.value = DEFAULT_DRILL_OFFSET;
    straightLineStartOffsetInput.value = DEFAULT_STRAIGHT_LINE_START_OFFSET;
    maxHolesPerSectionInput.value = MAX_HOLES_PER_SECTION;
    basePriceInput.value = DEFAULT_BASE_PRICE;
    bulkPriceInput.value = DEFAULT_BULK_PRICE;
    bulkThresholdInput.value = DEFAULT_BULK_THRESHOLD;
    couplingCostInput.value = DEFAULT_COUPLING_COST;
    elbowCostInput.value = DEFAULT_ELBOW_COST;
    salesTaxRateInput.value = DEFAULT_SALES_TAX_RATE;
    shapeSelect.value = "straight";
    holeSizeInput.value = DEFAULT_HOLE_SIZE;
    wiringDirectionInput.value = 'clockwise';
    showWiringCheckbox.checked = true;
    updateHeightInputState(); // This will set wiringStartPoint and recalculate
}


// --- Core Calculation Logic ---
function splitSideIntoSections(totalLength, spacing, isRectangleCornerSide = false,
                                 pipeLengthConstraint = DEFAULT_PIPE_LENGTH,
                                 insertLength = DEFAULT_INSERT_LENGTH,
                                 drillOffset = DEFAULT_DRILL_OFFSET,
                                 straightLineStartOffset = DEFAULT_STRAIGHT_LINE_START_OFFSET,
                                 deductCornerHoleForRectangle = false) {
    const sections = [];
    let remaining = totalLength;
    const segmentStartOverhead = isRectangleCornerSide ? (drillOffset + insertLength) : straightLineStartOffset;
    const segmentEndOverhead = drillOffset + insertLength;
    const totalSegmentOverhead = segmentStartOverhead + segmentEndOverhead;
    const maxUsableSpanPerPipe = Math.max(0, pipeLengthConstraint - totalSegmentOverhead);
    const maxHolesPossiblePerPipe = 1 + Math.floor(maxUsableSpanPerPipe / spacing);
    let firstSegmentEffectiveHoles, subsequentSegmentEffectiveHoles;

    if (isRectangleCornerSide) {
        firstSegmentEffectiveHoles = deductCornerHoleForRectangle
            ? Math.min(MAX_HOLES_PER_SECTION - 1, maxHolesPossiblePerPipe)
            : Math.min(MAX_HOLES_PER_SECTION, maxHolesPossiblePerPipe);
        subsequentSegmentEffectiveHoles = Math.min(MAX_HOLES_PER_SECTION, maxHolesPossiblePerPipe);
    } else {
        firstSegmentEffectiveHoles = subsequentSegmentEffectiveHoles = Math.min(MAX_HOLES_PER_SECTION, maxHolesPossiblePerPipe);
    }

    const subsequentSegmentUsableSpan = (subsequentSegmentEffectiveHoles - 1) * spacing;
    const subsequentSegmentLenCalc = subsequentSegmentUsableSpan + totalSegmentOverhead;
    const subsequentSegmentLen = Math.min(subsequentSegmentLenCalc, pipeLengthConstraint);
    const firstSegmentUsableSpan = (firstSegmentEffectiveHoles - 1) * spacing;
    const firstSegmentLenCalc = firstSegmentUsableSpan + totalSegmentOverhead;
    const firstSegmentLen = Math.min(firstSegmentLenCalc, pipeLengthConstraint);
    
    if (totalLength <= 0) return sections;

    if (totalLength <= firstSegmentLen) {
        const usableForHolesInLastSegment = Math.max(0, totalLength - totalSegmentOverhead);
        let holes = 1 + Math.floor(usableForHolesInLastSegment / spacing);
        holes = Math.max(0, Math.min(holes, firstSegmentEffectiveHoles));
        if (holes > 0) {
            let sectionLenActual = Math.min(totalLength, pipeLengthConstraint, (holes - 1) * spacing + totalSegmentOverhead);
            if (sectionLenActual > 0) sections.push({ sectionLength: sectionLenActual, numberOfHoles: holes, isCornerSection: isRectangleCornerSide });
        }
        remaining = 0;
    } else {
        sections.push({ sectionLength: firstSegmentLen, numberOfHoles: firstSegmentEffectiveHoles, isCornerSection: isRectangleCornerSide });
        remaining -= firstSegmentLen;
    }

    while (remaining >= subsequentSegmentLen && subsequentSegmentLen > 0) {
        sections.push({ sectionLength: subsequentSegmentLen, numberOfHoles: subsequentSegmentEffectiveHoles, isCornerSection: false });
        remaining -= subsequentSegmentLen;
    }

    if (remaining > 0.001) {
        const usableForHolesInLastSegment = Math.max(0, remaining - totalSegmentOverhead);
        let holes = 1 + Math.floor(usableForHolesInLastSegment / spacing);
        holes = Math.max(0, Math.min(holes, subsequentSegmentEffectiveHoles));
        if (holes > 0) {
            let sectionLen = Math.min(remaining, pipeLengthConstraint, (holes - 1) * spacing + totalSegmentOverhead);
            if (sectionLen > 0) sections.push({ sectionLength: sectionLen, numberOfHoles: holes, isCornerSection: false });
        }
    }

    return sections;
}

function performCalculation() {
    try {
        const selectedShape = shapeSelect.value;
        const spacing = parseFloat(spacingInput.value) || DEFAULT_SPACING;
        const pipeLength = parseFloat(pipeLengthInput.value) || DEFAULT_PIPE_LENGTH;
        const includeCornerHoles = includeCornerHolesCheckbox.checked;
        const insertLengthVal = parseFloat(insertLengthInput.value);
        const drillOffsetVal = parseFloat(drillOffsetInput.value);
        const straightLineStartOffsetVal = parseFloat(straightLineStartOffsetInput.value);
        const basePriceVal = parseFloat(basePriceInput.value);
        const bulkPriceVal = parseFloat(bulkPriceInput.value);
        const bulkThresholdVal = parseFloat(bulkThresholdInput.value);
        const couplingCostVal = parseFloat(couplingCostInput.value);
        const elbowCostVal = parseFloat(elbowCostInput.value);
        const salesTaxRateVal = (parseFloat(salesTaxRateInput.value) || 0) / 100.0;
        const holeSize = holeSizeInput.value || DEFAULT_HOLE_SIZE;
        const startPoint = wiringStartPointInput.value;
        const wiringDirection = wiringDirectionInput.value;
        const showWiring = showWiringCheckbox.checked;

        if (spacing <= 0 || pipeLength <= 0) {
            resultsOutput.innerHTML = `<p>Error: Spacing and Pipe Length must be positive numbers.</p>`;
            return;
        }

        let totalHoles = 0, totalLengthUsed = 0, pvcCount = 0, elbowCount = 0, couplingCount = 0;
        let widthSections = [], heightSections = [], sections = [];
        allLabelsData = [];

        if (selectedShape === "rectangle") {
            const width = parseFeetInches(widthInput.value);
            const height = parseFeetInches(heightInput.value);
            if (width === null || height === null || width <= 0 || height <= 0) {
                resultsOutput.innerHTML = `<p>Enter valid dimensions for the rectangle.</p>`;
                drawPvcVisual(selectedShape, 0, 0, [], [], spacing, [], '', '', false);
                return;
            }
            widthSections = splitSideIntoSections(width, spacing, true, pipeLength, insertLengthVal, drillOffsetVal, straightLineStartOffsetVal, includeCornerHoles);
            heightSections = splitSideIntoSections(height, spacing, true, pipeLength, insertLengthVal, drillOffsetVal, straightLineStartOffsetVal, includeCornerHoles);
            
            const allSectionsCalc = [...widthSections, ...widthSections, ...heightSections, ...heightSections];
            totalHoles = allSectionsCalc.reduce((sum, s) => sum + s.numberOfHoles, 0);
            totalLengthUsed = allSectionsCalc.reduce((sum, s) => sum + s.sectionLength, 0);
            pvcCount = Math.ceil(totalLengthUsed / pipeLength);
            elbowCount = 4;
            couplingCount = Math.max(0, allSectionsCalc.length - 4);
            drawPvcVisual(selectedShape, width, height, widthSections, heightSections, spacing, [], startPoint, wiringDirection, showWiring);

        } else if (selectedShape === "arch") {
            const diameter = parseFeetInches(widthInput.value);
            if (diameter === null || diameter <= 0) {
                resultsOutput.innerHTML = `<p>Enter a valid diameter for the arch.</p>`;
                drawPvcVisual(selectedShape, 0, 0, [], [], spacing, [], '', '', false);
                return;
            }
            const radius = diameter / 2.0;
            const totalLength = Math.PI * radius;

            sections = splitSideIntoSections(totalLength, spacing, false, pipeLength, insertLengthVal, drillOffsetVal, straightLineStartOffsetVal, false);
            
            totalHoles = sections.reduce((sum, s) => sum + s.numberOfHoles, 0);
            totalLengthUsed = sections.reduce((sum, s) => sum + s.sectionLength, 0);
            pvcCount = Math.ceil(totalLengthUsed / pipeLength);
            elbowCount = 0;
            couplingCount = Math.max(0, sections.length - 1);
            drawPvcVisual(selectedShape, diameter, 0, [], [], spacing, sections, startPoint, '', showWiring);
        
        } else { // straight
            const totalLength = parseFeetInches(widthInput.value);
            if (totalLength === null || totalLength <= 0) {
                resultsOutput.innerHTML = `<p>Enter a valid length for the straight line.</p>`;
                drawPvcVisual(selectedShape, 0, 0, [], [], spacing, [], '', '', false);
                return;
            }
            sections = splitSideIntoSections(totalLength, spacing, false, pipeLength, insertLengthVal, drillOffsetVal, straightLineStartOffsetVal, false);

            totalHoles = sections.reduce((sum, s) => sum + s.numberOfHoles, 0);
            totalLengthUsed = sections.reduce((sum, s) => sum + s.sectionLength, 0);
            pvcCount = Math.ceil(totalLengthUsed / pipeLength);
            elbowCount = 0;
            couplingCount = Math.max(0, sections.length - 1);
            drawPvcVisual(selectedShape, totalLength, 0, [], [], spacing, sections, startPoint, '', showWiring);
        }

        // --- Generate HTML Report ---
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
        htmlReport += `<p class="note">To be drilled with ${holeSize} holes.</p>`;
        plainTextReport += `--- CUT LIST (using ${holeSize} holes) ---\n`;
        if (selectedShape === 'rectangle') {
            htmlReport += `<table><tr><th>Side</th><th>Section</th><th>Length</th><th>Holes</th><th>Notes</th></tr>`;
            plainTextReport += `  Top/Bottom Sides (${widthInput.value}):\n`;
            widthSections.forEach((s, i) => {
                htmlReport += `<tr><td>Top/Bottom</td><td>${i + 1}</td><td>${s.sectionLength.toFixed(2)}"</td><td>${s.numberOfHoles}</td><td>${s.isCornerSection ? 'Corner Piece' : ''}</td></tr>`;
            });
            plainTextReport += `  Left/Right Sides (${heightInput.value}):\n`;
            heightSections.forEach((s, i) => {
                htmlReport += `<tr><td>Left/Right</td><td>${i + 1}</td><td>${s.sectionLength.toFixed(2)}"</td><td>${s.numberOfHoles}</td><td>${s.isCornerSection ? 'Corner Piece' : ''}</td></tr>`;
            });
            htmlReport += `</table>`;
        } else {
            const title = selectedShape === 'arch' ? `Arch (${widthInput.value} diameter)` : `Straight Line (${widthInput.value})`;
            htmlReport += `<table><tr><th>Section</th><th>Length</th><th>Holes</th></tr>`;
             plainTextReport += `  ${title}:\n`;
            sections.forEach((s, i) => {
                htmlReport += `<tr><td>${i + 1}</td><td>${s.sectionLength.toFixed(2)}"</td><td>${s.numberOfHoles}</td></tr>`;
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


// --- Visual Representation (Canvas Drawing) ---
function drawPvcVisual(shape, width, height, widthSections, heightSections, spacing, straightLineSections, startPoint, wiringDirection, showWiring) {
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pipeColor = isDarkMode ? '#b0b0b0' : '#6c757d';
    const textColor = isDarkMode ? '#e1e1e1' : '#343a40';
    const dimColor = isDarkMode ? '#888' : '#888';
    const accentColor = isDarkMode ? '#0095ff' : '#007bff';
    const pipeWidth = 12;
    const lineHeight = 14;
    const arrowSize = 8;

    ctx.font = '12px sans-serif';
    
    // Helper to draw arrows
    const drawArrow = (x1, y1, x2, y2) => {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.save();
        ctx.strokeStyle = accentColor;
        ctx.fillStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    };
    
    if (shape === 'straight' && width > 0) {
        const padding = 40;
        const scale = (canvas.width - padding * 2) / width;
        const y = canvas.height / 2;
        let currentX = padding;
        
        ctx.lineWidth = pipeWidth;
        ctx.strokeStyle = pipeColor;
        ctx.fillStyle = textColor;

        straightLineSections.forEach((section, index) => {
            const sectionLengthScaled = section.sectionLength * scale;
            ctx.beginPath();
            ctx.moveTo(currentX, y);
            ctx.lineTo(currentX + sectionLengthScaled, y);
            ctx.stroke();

            if(index < straightLineSections.length - 1){
                 ctx.fillStyle = pipeColor;
                 ctx.fillRect(currentX + sectionLengthScaled - pipeWidth/2, y - pipeWidth, pipeWidth, pipeWidth * 2);
            }

            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            const label1 = `${section.sectionLength.toFixed(2)}"`;
            const label2 = `(${section.numberOfHoles} holes)`;
            ctx.fillText(label1, currentX + sectionLengthScaled / 2, y - 30);
            ctx.fillText(label2, currentX + sectionLengthScaled / 2, y - 30 + lineHeight);
            currentX += sectionLengthScaled;
        });

        if(showWiring){
            const flowY = y + pipeWidth + 15;
            if(startPoint === 'left'){
                drawArrow(padding, flowY, canvas.width - padding, flowY);
            } else { // right
                drawArrow(canvas.width - padding, flowY, padding, flowY);
            }
        }

    } else if (shape === 'arch' && width > 0) {
        const diameter = width;
        const padding = 40;
        const totalLength = straightLineSections.reduce((sum, s) => sum + s.sectionLength, 0);
        const scale = (canvas.width - padding * 2) / diameter;
        const radius = (diameter / 2) * scale;
        const centerX = canvas.width / 2;
        const centerY = canvas.height - padding;

        ctx.lineWidth = pipeWidth;
        ctx.strokeStyle = pipeColor;
        
        let currentAngle = Math.PI;

        straightLineSections.forEach((section, index) => {
            const angleOfSection = (section.sectionLength / totalLength) * Math.PI;
            const endAngle = currentAngle + angleOfSection;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, endAngle);
            ctx.stroke();

            if (index < straightLineSections.length - 1) {
                const coupletX = centerX + radius * Math.cos(endAngle);
                const coupletY = centerY + radius * Math.sin(endAngle);
                ctx.fillStyle = pipeColor;
                ctx.save();
                ctx.translate(coupletX, coupletY);
                ctx.rotate(endAngle + Math.PI / 2);
                ctx.fillRect(-pipeWidth/2, -pipeWidth, pipeWidth, pipeWidth * 2);
                ctx.restore();
            }

            const midAngle = currentAngle + angleOfSection / 2;
            const textRadius = radius + 30;
            const textX = centerX + textRadius * Math.cos(midAngle);
            const textY = centerY + textRadius * Math.sin(midAngle);
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${section.sectionLength.toFixed(2)}"`, textX, textY - lineHeight / 2);
            ctx.fillText(`(${section.numberOfHoles} holes)`, textX, textY + lineHeight / 2);
            currentAngle = endAngle;
        });

        if(showWiring){
            const flowRadius = radius + pipeWidth + 10;
            const startAngle = (startPoint === 'left') ? Math.PI : 0;
            const endAngle = (startPoint === 'left') ? 0 : Math.PI;

            ctx.save();
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, flowRadius, startAngle, endAngle, (startPoint === 'right'));
            ctx.stroke();
            
            const arrowAngle = endAngle;
            const headX = centerX + flowRadius * Math.cos(arrowAngle);
            const headY = centerY + flowRadius * Math.sin(arrowAngle);
            const tangent = arrowAngle + Math.PI / 2 * ((startPoint === 'left') ? 1 : -1);
            
            ctx.beginPath();
            ctx.moveTo(headX, headY);
            ctx.lineTo(headX - arrowSize * Math.cos(tangent - Math.PI / 6), headY - arrowSize * Math.sin(tangent - Math.PI / 6));
            ctx.lineTo(headX - arrowSize * Math.cos(tangent + Math.PI / 6), headY - arrowSize * Math.sin(tangent + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = accentColor;
            ctx.fill();
            ctx.restore();
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = dimColor;
        ctx.fillStyle = dimColor;
        ctx.textAlign = 'center';
        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY + 20);
        ctx.lineTo(centerX + radius, centerY + 20);
        ctx.stroke();
        ctx.fillText(`Diameter: ${diameter.toFixed(2)}"`, centerX, centerY + 35);


    } else if (shape === 'rectangle' && width > 0 && height > 0) {
        const padding = 100;
        const scale = Math.min((canvas.width - padding * 2) / width, (canvas.height - padding * 2) / height);
        const sWidth = width * scale;
        const sHeight = height * scale;
        const startX = (canvas.width - sWidth) / 2;
        const startY = (canvas.height - sHeight) / 2;
        const endX = startX + sWidth;
        const endY = startY + sHeight;
        const elbowRadius = pipeWidth;

        const drawElbow = (cx, cy, startAngle, endAngle) => {
            ctx.strokeStyle = pipeColor;
            ctx.lineWidth = pipeWidth;
            ctx.beginPath();
            ctx.arc(cx, cy, elbowRadius, startAngle, endAngle);
            ctx.stroke();
        };

        // Draw Elbows first
        drawElbow(startX, startY, Math.PI, 1.5 * Math.PI);
        drawElbow(endX, startY, 1.5 * Math.PI, 2 * Math.PI);
        drawElbow(endX, endY, 0, 0.5 * Math.PI);
        drawElbow(startX, endY, 0.5 * Math.PI, Math.PI);
        
        ctx.fillStyle = textColor;
        
        // --- Top Side (L-to-R) ---
        let currentX_T = startX;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        widthSections.forEach(section => {
            const scaledLen = section.sectionLength * scale;
            const holeText = section.isCornerSection ? `(${section.numberOfHoles}h, 1 corner)` : `(${section.numberOfHoles} holes)`;
            ctx.beginPath();
            ctx.moveTo(currentX_T + elbowRadius, startY);
            ctx.lineTo(currentX_T + scaledLen - elbowRadius, startY);
            ctx.strokeStyle = pipeColor;
            ctx.lineWidth = pipeWidth;
            ctx.stroke();
            ctx.fillText(`${section.sectionLength.toFixed(2)}"`, currentX_T + scaledLen/2, startY - 20 - lineHeight);
            ctx.fillText(holeText, currentX_T + scaledLen/2, startY - 20);
            currentX_T += scaledLen;
        });

        // --- Right Side (Top-to-Bottom) ---
        let currentY_R = startY;
        heightSections.forEach(section => {
            const scaledLen = section.sectionLength * scale;
            const holeText = section.isCornerSection ? `(${section.numberOfHoles}h, 1 corner)` : `(${section.numberOfHoles} holes)`;
            const midPointY = currentY_R + scaledLen / 2;
            ctx.beginPath();
            ctx.moveTo(endX, currentY_R + elbowRadius);
            ctx.lineTo(endX, currentY_R + scaledLen - elbowRadius);
            ctx.strokeStyle = pipeColor;
            ctx.lineWidth = pipeWidth;
            ctx.stroke();
            ctx.textAlign = 'left';
            const textX_right = endX + 35;
            ctx.fillText(`${section.sectionLength.toFixed(2)}"`, textX_right, midPointY - (lineHeight/2));
            ctx.fillText(holeText, textX_right, midPointY + (lineHeight/2));
            ctx.beginPath();
            ctx.moveTo(textX_right - 5, midPointY);
            ctx.lineTo(endX + 5, midPointY);
            ctx.strokeStyle = dimColor;
            ctx.lineWidth = 1;
            ctx.stroke();
            currentY_R += scaledLen;
        });

        // --- Bottom Side (R-to-L) ---
        let currentX_B = endX;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        [...widthSections].reverse().forEach(section => {
            const scaledLen = section.sectionLength * scale;
            const holeText = section.isCornerSection ? `(${section.numberOfHoles}h, 1 corner)` : `(${section.numberOfHoles} holes)`;
            ctx.beginPath();
            ctx.moveTo(currentX_B - elbowRadius, endY);
            ctx.lineTo(currentX_B - scaledLen + elbowRadius, endY);
            ctx.strokeStyle = pipeColor;
            ctx.lineWidth = pipeWidth;
            ctx.stroke();
            ctx.fillText(`${section.sectionLength.toFixed(2)}"`, currentX_B - scaledLen/2, endY + 20);
            ctx.fillText(holeText, currentX_B - scaledLen/2, endY + 20 + lineHeight);
            currentX_B -= scaledLen;
        });

        // --- Left Side (Bottom-to-Top) ---
        let currentY_L = endY;
        [...heightSections].reverse().forEach(section => {
            const scaledLen = section.sectionLength * scale;
            const holeText = section.isCornerSection ? `(${section.numberOfHoles}h, 1 corner)` : `(${section.numberOfHoles} holes)`;
            const midPointY = currentY_L - scaledLen / 2;
            ctx.beginPath();
            ctx.moveTo(startX, currentY_L - elbowRadius);
            ctx.lineTo(startX, currentY_L - scaledLen + elbowRadius);
            ctx.strokeStyle = pipeColor;
            ctx.lineWidth = pipeWidth;
            ctx.stroke();
            ctx.textAlign = 'right';
            const textX_left = startX - 35;
            ctx.fillText(`${section.sectionLength.toFixed(2)}"`, textX_left, midPointY - (lineHeight/2));
            ctx.fillText(holeText, textX_left, midPointY + (lineHeight/2));
            ctx.beginPath();
            ctx.moveTo(textX_left + 5, midPointY);
            ctx.lineTo(startX - 5, midPointY);
            ctx.strokeStyle = dimColor;
            ctx.lineWidth = 1;
            ctx.stroke();
            currentY_L -= scaledLen;
        });


        if (showWiring) {
            const flowOffset = pipeWidth + 15;
            const flowCorners = {
                'top-left':     { x: startX + flowOffset, y: startY + flowOffset },
                'top-right':    { x: endX - flowOffset,   y: startY + flowOffset },
                'bottom-left':  { x: startX + flowOffset, y: endY - flowOffset },
                'bottom-right': { x: endX - flowOffset,   y: endY - flowOffset }
            };
            const startPos = flowCorners[startPoint];
            
            ctx.save();
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(startPos.x, startPos.y, 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText("S", startPos.x, startPos.y);
            ctx.restore();

            const cornerSequence = ['bottom-left', 'bottom-right', 'top-right', 'top-left'];
            let currentIndex = cornerSequence.indexOf(startPoint);

            for (let i = 0; i < 4; i++) {
                let fromCornerName = cornerSequence[currentIndex];
                let toCornerName;
                if (wiringDirection === 'clockwise') {
                    toCornerName = cornerSequence[(currentIndex + 1) % 4];
                } else { // counter-clockwise
                    toCornerName = cornerSequence[(currentIndex - 1 + 4) % 4];
                }
                drawArrow(flowCorners[fromCornerName].x, flowCorners[fromCornerName].y, flowCorners[toCornerName].x, flowCorners[toCornerName].y);
                currentIndex = cornerSequence.indexOf(toCornerName);
            }
        }
    }
}


// --- Export Functions ---
function saveReportSummary() {
    if (!plainTextReport) { alert("No report to save!"); return; }
    const blob = new Blob([plainTextReport], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'PVC_Project_Report.txt';
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportLabels() {
    if (allLabelsData.length === 0) { alert("No labels to export!"); return; }
    let csvContent = "Side,Section,Length (in),Holes,Is Corner\n";
    allLabelsData.forEach(l => {
        csvContent += `${l.side},${l.section},${l.length.toFixed(2)},${l.holes},${l.isCorner ? 'Yes' : 'No'}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
a.download = 'PVC_Pipe_Labels.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportVisualCanvas() {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
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
    insertLengthInput, drillOffsetInput, straightLineStartOffsetInput,
    basePriceInput, bulkPriceInput, bulkThresholdInput, couplingCostInput, elbowCostInput, salesTaxRateInput,
    holeSizeInput, wiringStartPointInput, wiringDirectionInput, showWiringCheckbox
].forEach(input => {
    input.addEventListener('input', performCalculation);
});

function updateWiringOptions(shape) {
    wiringStartPointInput.innerHTML = ''; // Clear existing options
    let options = {};

    if (shape === 'rectangle') {
        options = {
            'bottom-left': 'Bottom-Left', 'bottom-right': 'Bottom-Right',
            'top-left': 'Top-Left', 'top-right': 'Top-Right'
        };
        wiringDirectionGroup.style.display = 'block';
    } else { // For straight and arch
        options = { 'left': 'Left', 'right': 'Right' };
        wiringDirectionGroup.style.display = 'none';
    }

    for (const [value, text] of Object.entries(options)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        wiringStartPointInput.appendChild(option);
    }
}


function updateHeightInputState() {
    const selectedShape = shapeSelect.value;
    const isRectangle = selectedShape === 'rectangle';
    const widthLabel = document.querySelector('label[for="width"]');

    heightInputGroup.style.display = isRectangle ? 'block' : 'none';
    const cornerHolesLabel = document.querySelector('label[for="includeCornerHoles"]');
    if (cornerHolesLabel) {
        cornerHolesLabel.style.display = isRectangle ? 'block' : 'none';
    }
    includeCornerHolesCheckbox.style.display = isRectangle ? 'block' : 'none';
    
    if (selectedShape === 'arch') {
        widthLabel.textContent = 'Diameter (e.g., 10\', 5" or 6\' 2")';
    } else {
        widthLabel.textContent = 'Width (e.g., 30\', 5" or 3\' 6")';
    }
    
    updateWiringOptions(selectedShape);

    if (!isRectangle) {
        heightInput.value = '';
    }
    
    performCalculation();
}