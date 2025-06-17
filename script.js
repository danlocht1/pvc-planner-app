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

// Shape dropdown (updated from radio buttons)
const shapeSelect = document.getElementById('shapeSelect');

// Advanced Options DOM elements
const insertLengthInput = document.getElementById('insertLength');
const drillOffsetInput = document.getElementById('drillOffset');
const straightLineStartOffsetInput = document.getElementById('straightLineStartOffset');
const maxHolesPerSectionInput = document.getElementById('maxHolesPerSection');

// Pricing DOM elements
const basePriceInput = document.getElementById('basePrice');
const bulkPriceInput = document.getElementById('bulkPrice');
const bulkThresholdInput = document.getElementById('bulkThreshold');
const couplingCostInput = document.getElementById('couplingCost');
const elbowCostInput = document.getElementById('elbowCost');
const salesTaxRateInput = document.getElementById('salesTaxRate');

// New Export/Reset Buttons
const saveReportBtn = document.getElementById('saveReportBtn');
const exportLabelsBtn = document.getElementById('exportLabelsBtn');
const exportVisualBtn = document.getElementById('exportVisualBtn');
const resetBtn = document.getElementById('resetBtn');

// Hidden elements for height input in straight line mode (now correctly selected by ID)
const heightInputGroup = document.getElementById('heightInputGroup'); 
const heightLabel = document.querySelector('label[for="height"]');
const heightNote = heightInput.nextElementSibling;


// --- Constants / Default Values ---
const DEFAULT_PIPE_LENGTH = 120.0; // inches (10 feet)
const DEFAULT_SPACING = 2.0;
const DEFAULT_INSERT_LENGTH = 1.5;
const DEFAULT_DRILL_OFFSET = 0.25;
const DEFAULT_STRAIGHT_LINE_START_OFFSET = 0.5;
const MAX_HOLES_PER_SECTION = 50; // Max 50 holes per section due to visual/labeling constraints

const DEFAULT_BASE_PRICE = 4.38;
const DEFAULT_BULK_PRICE = 3.50;
const DEFAULT_BULK_THRESHOLD = 8;
const DEFAULT_COUPLING_COST = 0.78;
const DEFAULT_ELBOW_COST = 0.58;
const DEFAULT_SALES_TAX_RATE = 6.5; // Input as percentage (e.g., 6.5 for 6.5%)


// --- Global Data for Export (to capture labels, etc.) ---
let allLabelsData = [];


// --- Utility Functions ---

function parseFeetInches(s) {
    try {
        if (!s) return null;
        s = s.trim().replace(/"/g, '');
        const parts = s.split("'");

        let feet = 0;
        let inches = 0.0;

        if (parts.length === 2) {
            if (parts[0]) {
                feet = parseInt(parts[0]);
            }
            if (parts[1]) {
                inches = parseFloat(parts[1]);
            }
        } else if (parts.length === 1) {
            inches = parseFloat(parts[0]);
        } else {
            return null;
        }

        if (isNaN(feet) || isNaN(inches)) {
            return null;
        }

        return feet * 12 + inches;
    } catch (e) {
        console.error(`Error parsing feet/inches: ${e}`);
        return null;
    }
}

// Function to reset all input fields to their default values
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
    shapeSelect.value = "straight"; // Reset shape to straight line

    updateHeightInputState(); // Adjust height input visibility
    performCalculation(); // Re-calculate with reset values
}


// Core logic for splitting a side into sections based on pipe length and hole spacing
function splitSideIntoSections(totalLength, spacing, isRectangleCornerSide = false,
                                 pipeLengthConstraint = DEFAULT_PIPE_LENGTH,
                                 insertLength = DEFAULT_INSERT_LENGTH,
                                 drillOffset = DEFAULT_DRILL_OFFSET,
                                 straightLineStartOffset = DEFAULT_STRAIGHT_LINE_START_OFFSET,
                                 deductCornerHoleForRectangle = false) {
    const sections = [];
    let remaining = totalLength;

    // Define overheads
    // For rectangles, segmentStartOverhead and segmentEndOverhead are based on drillOffset + insertLength
    // For straight lines, startOffset is different (straightLineStartOffset)
    const segmentStartOverhead = isRectangleCornerSide ? (drillOffset + insertLength) : straightLineStartOffset;
    const segmentEndOverhead = drillOffset + insertLength; // End always includes drillOffset + insertLength for connector

    const totalSegmentOverhead = segmentStartOverhead + segmentEndOverhead;

    // Determine the absolute maximum number of holes that can physically fit into one 'pipeLengthConstraint' pipe
    const maxUsableSpanPerPipe = Math.max(0, pipeLengthConstraint - totalSegmentOverhead);
    const maxHolesPossiblePerPipe = 1 + Math.floor(maxUsableSpanPerPipe / spacing);

    let firstSegmentEffectiveHoles, subsequentSegmentEffectiveHoles;

    // Determine effective holes for first segment (corner handling) and subsequent segments
    if (isRectangleCornerSide) {
        if (deductCornerHoleForRectangle) {
            // For rectangle corners, if holes are included on corners, the corner hole is conceptually shared.
            // So, for calculations specific to *this* side's holes, one less hole is drilled on the first segment.
            firstSegmentEffectiveHoles = Math.min(MAX_HOLES_PER_SECTION - 1, maxHolesPossiblePerPipe);
        } else {
            // If corner holes are NOT included, the first segment gets full number of holes
            firstSegmentEffectiveHoles = Math.min(MAX_HOLES_PER_SECTION, maxHolesPossiblePerPipe);
        }
        subsequentSegmentEffectiveHoles = Math.min(MAX_HOLES_PER_SECTION, maxHolesPossiblePerPipe);
    } else { // Straight Line or non-corner side of other shapes
        firstSegmentEffectiveHoles = Math.min(MAX_HOLES_PER_SECTION, maxHolesPossiblePerPipe);
        subsequentSegmentEffectiveHoles = Math.min(MAX_HOLES_PER_SECTION, maxHolesPossiblePerPipe);
    }

    // Calculate section length for a "full" subsequent segment
    const subsequentSegmentUsableSpan = (subsequentSegmentEffectiveHoles - 1) * spacing;
    const subsequentSegmentLenCalc = subsequentSegmentUsableSpan + totalSegmentOverhead;
    const subsequentSegmentLen = Math.min(subsequentSegmentLenCalc, pipeLengthConstraint);

    // Calculate length for the first segment (which acts as a 'corner' or initial segment)
    const firstSegmentUsableSpan = (firstSegmentEffectiveHoles - 1) * spacing;
    const firstSegmentLenCalc = firstSegmentUsableSpan + totalSegmentOverhead;
    const firstSegmentLen = Math.min(firstSegmentLenCalc, pipeLengthConstraint);
    
    if (totalLength <= 0) {
        return sections;
    }

    // Handle the first segment (corner or initial straight piece)
    if (totalLength <= firstSegmentLen) {
        // If the total length is less than or equal to what fits in a single 'first' segment
        const usableForHolesInLastSegment = Math.max(0, totalLength - totalSegmentOverhead);
        let holes = 1 + Math.floor(usableForHolesInLastSegment / spacing);
        
        // Ensure holes don't exceed max allowed and are at least 0
        holes = Math.min(holes, firstSegmentEffectiveHoles);
        holes = Math.max(0, holes);

        if (holes > 0) {
            const drilled = (holes - 1) * spacing;
            let sectionLenActual = drilled + totalSegmentOverhead;
            sectionLenActual = Math.min(sectionLenActual, totalLength); // Do not exceed totalLength
            sectionLenActual = Math.min(sectionLenActual, pipeLengthConstraint); // Do not exceed pipe constraint
            if (sectionLenActual > 0) {
                sections.push({ sectionLength: sectionLenActual, numberOfHoles: holes, isCornerSection: isRectangleCornerSide });
            }
        }
        remaining = 0; // All length consumed
    } else {
        sections.push({ sectionLength: firstSegmentLen, numberOfHoles: firstSegmentEffectiveHoles, isCornerSection: isRectangleCornerSide });
        remaining -= firstSegmentLen;
    }

    // Add subsequent full sections
    while (remaining >= subsequentSegmentLen && subsequentSegmentLen > 0) {
        sections.push({ sectionLength: subsequentSegmentLen, numberOfHoles: subsequentSegmentEffectiveHoles, isCornerSection: false });
        remaining -= subsequentSegmentLen;
    }

    // Add the last, partial section if any remaining length
    if (remaining > 0.001) { // Use a small epsilon for floating point comparison
        const usableForHolesInLastSegment = Math.max(0, remaining - totalSegmentOverhead);
        let holes = 1 + Math.floor(usableForHolesInLastSegment / spacing);
        
        // Ensure holes don't exceed max allowed for subsequent segments and are at least 0
        holes = Math.min(holes, subsequentSegmentEffectiveHoles);
        holes = Math.max(0, holes);

        if (holes > 0) {
            const drilled = (holes - 1) * spacing;
            let sectionLen = drilled + totalSegmentOverhead;
            sectionLen = Math.min(sectionLen, remaining); // Do not exceed remaining length
            sectionLen = Math.min(sectionLen, pipeLengthConstraint); // Do not exceed pipe constraint
            if (sectionLen > 0) {
                sections.push({ sectionLength: sectionLen, numberOfHoles: holes, isCornerSection: false });
            }
        }
    }

    return sections;
}


// --- Main Calculation Function ---
function performCalculation() {
    try {
        const selectedShape = shapeSelect.value;
        console.log("--- Starting Calculation ---");
        console.log("Shape selected:", selectedShape);
        console.log("Width input value (raw):", widthInput.value);
        console.log("Height input value (raw):", heightInput.value);

        const spacing = parseFloat(spacingInput.value);
        const pipeLength = parseFloat(pipeLengthInput.value);
        const includeCornerHoles = includeCornerHolesCheckbox.checked;

        const insertLengthVal = parseFloat(insertLengthInput.value);
        const drillOffsetVal = parseFloat(drillOffsetInput.value);
        const straightLineStartOffsetVal = parseFloat(straightLineStartOffsetInput.value);
        const maxHolesPerSectionVal = parseInt(maxHolesPerSectionInput.value); // Currently unused in calculation directly as MAX_HOLES_PER_SECTION is constant, but captured for completeness

        const basePriceVal = parseFloat(basePriceInput.value);
        const bulkPriceVal = parseFloat(bulkPriceInput.value);
        const bulkThresholdVal = parseFloat(bulkThresholdInput.value);
        const couplingCostVal = parseFloat(couplingCostInput.value);
        const elbowCostVal = parseFloat(elbowCostInput.value);
        const salesTaxRateVal = parseFloat(salesTaxRateInput.value) / 100.0;

        if (spacing <= 0) {
            resultsOutput.value = "Error: Hole Spacing must be a positive number.";
            return;
        }
        if (pipeLength <= 0) {
            resultsOutput.value = "Error: Pipe Length must be a positive number.";
            return;
        }

        let totalHoles = 0;
        let totalLengthUsed = 0;
        let pvcCount = 0;
        let elbowCount = 0;
        let couplingCount = 0;
        let widthSections = [];
        let heightSections = [];
        let sections = []; // Declare sections here for broader scope

        allLabelsData = []; // Reset labels data for export

        if (selectedShape === "rectangle") {
            const width = parseFeetInches(widthInput.value);
            const height = parseFeetInches(heightInput.value);

            console.log("Parsed width (inches):", width);
            console.log("Parsed height (inches):", height);

            if (width === null || height === null) {
                resultsOutput.value = "Error: Invalid dimensions. Use format like 12' 3\" or 32' 6\".";
                console.error("Invalid dimensions detected.");
                return;
            }

            widthSections = splitSideIntoSections(width, spacing, true,
                                                    pipeLength, insertLengthVal,
                                                    drillOffsetVal, straightLineStartOffsetVal,
                                                    includeCornerHoles);
            heightSections = splitSideIntoSections(height, spacing, true,
                                                     pipeLength, insertLengthVal,
                                                     drillOffsetVal, straightLineStartOffsetVal,
                                                     includeCornerHoles);
            
            console.log("Width sections after split:", widthSections);
            console.log("Height sections after split:", heightSections);

            // Generate labels for width sides (Top and Bottom)
            widthSections.forEach((section, index) => {
                allLabelsData.push({ side: 'Top', section: index + 1, length: section.sectionLength, holes: section.numberOfHoles, isCorner: section.isCornerSection });
            });
            widthSections.forEach((section, index) => {
                allLabelsData.push({ side: 'Bottom', section: index + 1, length: section.sectionLength, holes: section.numberOfHoles, isCorner: section.isCornerSection });
            });

            // Generate labels for height sides (Left and Right)
            heightSections.forEach((section, index) => {
                allLabelsData.push({ side: 'Left', section: index + 1, length: section.sectionLength, holes: section.numberOfHoles, isCorner: section.isCornerSection });
            });
            heightSections.forEach((section, index) => {
                allLabelsData.push({ side: 'Right', section: index + 1, length: section.sectionLength, holes: section.numberOfHoles, isCorner: section.isCornerSection });
            });

            totalHoles = (
                widthSections.reduce((sum, s) => sum + s.numberOfHoles, 0) * 2 +
                heightSections.reduce((sum, s) => sum + s.numberOfHoles, 0) * 2
            );
            const allSectionsCalc = [...widthSections, ...widthSections, ...heightSections, ...heightSections];
            totalLengthUsed = allSectionsCalc.reduce((sum, s) => sum + s.sectionLength, 0);
            pvcCount = Math.ceil(totalLengthUsed / pipeLength);
            elbowCount = 4; // Always 4 elbows for a rectangle
            couplingCount = Math.max(0, allSectionsCalc.length - 4); // Total sections - 4 corners (covered by elbows)
            
        } else if (selectedShape === "straight") {
            const totalLength = parseFeetInches(widthInput.value);
            console.log("Parsed straight line total length (inches):", totalLength);

            if (totalLength === null) {
                resultsOutput.value = "Error: Invalid length. Use format like 10', 5\", or 3' 6\".";
                console.error("Invalid straight line length detected.");
                return;
            }

            sections = splitSideIntoSections(totalLength, spacing, false, // Assign to the already declared 'sections'
                                                     pipeLength, insertLengthVal,
                                                     drillOffsetVal, straightLineStartOffsetVal,
                                                     includeCornerHoles);
            
            console.log("Straight Line sections after split:", sections);

            // Generate labels for straight line
            sections.forEach((section, index) => {
                allLabelsData.push({ side: 'Straight', section: index + 1, length: section.sectionLength, holes: section.numberOfHoles, isCorner: false });
            });

            totalHoles = sections.reduce((sum, s) => sum + s.numberOfHoles, 0);
            totalLengthUsed = sections.reduce((sum, s) => sum + s.sectionLength, 0);
            pvcCount = Math.ceil(totalLengthUsed / pipeLength);
            elbowCount = 0; // No elbows for a straight line
            couplingCount = Math.max(0, sections.length - 1); // N sections need N-1 couplings
        }

        // --- Generate Report ---
        let report = `--- PVC Project Report (${selectedShape.charAt(0).toUpperCase() + selectedShape.slice(1)}) ---\n\n`;

        report += `--- Input Details ---\n`;
        report += `  Shape Selected: ${selectedShape === 'rectangle' ? 'rectangle' : 'straight line'}\n`;
        report += `  Width Input: ${widthInput.value}\n`;
        if (selectedShape === 'rectangle') {
            report += `  Height Input: ${heightInput.value}\n`;
        }
        report += `  Hole Spacing: ${spacing.toFixed(1)}"\n`;
        report += `  Standard Pipe Section Length: ${pipeLength.toFixed(1)}"\n`;
        report += `  Include Corner Holes: ${includeCornerHoles ? 'Yes' : 'No'}\n`;
        report += `  Insert Length: ${insertLengthVal.toFixed(2)}"\n`;
        report += `  Drill Offset: ${drillOffsetVal.toFixed(2)}"\n`;
        if (selectedShape === 'straight') {
            report += `  Straight Line Start Offset: ${straightLineStartOffsetVal.toFixed(2)}"\n`;
        }
        report += `  Sales Tax Rate: ${salesTaxRateVal * 100.0}% (entered as ${salesTaxRateInput.value}%)\n\n`;

        report += `--- PVC Section Breakdown (Cut List) ---\n`;
        if (selectedShape === 'rectangle') {
            if (widthSections.length > 0) {
                report += `  Top/Bottom Sides (Width ${widthInput.value}):\n`;
                widthSections.forEach((section, index) => {
                    report += `    Section ${index + 1}: ${section.sectionLength.toFixed(2)}" with ${section.numberOfHoles} holes\n`;
                });
            } else {
                report += `  Top/Bottom Sides (Width ${widthInput.value}): No sections calculated.\n`;
            }

            if (heightSections.length > 0) {
                report += `  Left/Right Sides (Height ${heightInput.value}):\n`;
                heightSections.forEach((section, index) => {
                    report += `    Section ${index + 1}: ${section.sectionLength.toFixed(2)}" with ${section.numberOfHoles} holes\n`;
                });
            } else {
                report += `  Left/Right Sides (Height ${heightInput.value}): No sections calculated.\n`;
            }
        } else { // Straight Line
            if (sections.length > 0) { // Now 'sections' is in scope
                report += `  Total Length ${widthInput.value}:\n`;
                sections.forEach((section, index) => {
                    report += `    Section ${index + 1}: ${section.sectionLength.toFixed(2)}" with ${section.numberOfHoles} holes\n`;
                });
            } else {
                report += `  Total Length ${widthInput.value}: No sections calculated.\n`;
            }
        }
        report += `\n`;


        report += `--- Project Summary ---\n`;
        report += `  Total PVC Pipe Length Used: ${totalLengthUsed.toFixed(2)}"\n`;
        report += `  Total PVC Pipes Required (rounded up): ${pvcCount}\n`;
        report += `  Total Holes to Drill: ${totalHoles}\n`;
        report += `  Total Elbows Needed: ${elbowCount}\n`;
        report += `  Total Couplings Needed: ${couplingCount}\n\n`;

        report += `--- Cost Analysis ---\n`;
        report += `  Base Price per PVC Pipe: $${basePriceVal.toFixed(2)}\n`;
        report += `  Bulk Price per PVC Pipe (for ${bulkThresholdVal}+ pipes): $${bulkPriceVal.toFixed(2)}\n`;
        report += `  Cost per Coupling: $${couplingCostVal.toFixed(2)}\n`;
        report += `  Cost per Elbow: $${elbowCostVal.toFixed(2)}\n\n`;

        let totalPipesCost;
        if (pvcCount >= bulkThresholdVal) {
            totalPipesCost = pvcCount * bulkPriceVal;
        } else {
            totalPipesCost = pvcCount * basePriceVal;
        }
        const totalCouplingsCost = couplingCount * couplingCostVal;
        const totalElbowsCost = elbowCount * elbowCostVal;

        const subtotal = totalPipesCost + totalCouplingsCost + totalElbowsCost;
        const salesTaxAmount = subtotal * salesTaxRateVal;
        const totalProjectCost = subtotal + salesTaxAmount;

        report += `  Subtotal (before tax): $${subtotal.toFixed(2)}\n`;
        report += `  Sales Tax Amount: $${salesTaxAmount.toFixed(2)}\n`;
        report += `  Total Project Cost (with tax): $${totalProjectCost.toFixed(2)}\n`;

        resultsOutput.value = report;
        
        // Redraw canvas with new dimensions
        // Pass 'sections' for straight line as well
        drawPvcVisual(selectedShape, width, height, widthSections, heightSections, spacing, sections); 

    } catch (error) {
        resultsOutput.value = `An error occurred: ${error.message}`;
        console.error("Calculation error:", error);
    }
}


// --- Visual Representation (Canvas Drawing) ---
// Added 'straightLineSections' as a parameter to drawPvcVisual
function drawPvcVisual(shape, width, height, widthSections, heightSections, spacing, straightLineSections = []) {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawing

    // The temporary red rectangle test has been removed from here.

    if (shape === 'straight') {
        // For straight line, 'width' in this context is the total length
        if (width <= 0) return;
        const scale = canvas.width / (width + 20); // Add some padding
        drawStraightLine(width * scale, spacing, straightLineSections, scale); // Use straightLineSections
    } else if (shape === 'rectangle') {
        if (width <= 0 || height <= 0) return;

        // Determine a scaling factor to fit the rectangle within the canvas
        const padding = 20;
        const maxWidth = canvas.width - padding * 2;
        const maxHeight = canvas.height - padding * 2;
        const scale = Math.min(maxWidth / width, maxHeight / height);

        // Calculate scaled dimensions
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        // Center the rectangle on the canvas
        const startX = (canvas.width - scaledWidth) / 2;
        const startY = (canvas.height - scaledHeight) / 2;

        drawRectangle(startX, startY, scaledWidth, scaledHeight, widthSections, heightSections, spacing, scale);
    }
}

function drawStraightLine(scaledLength, spacing, sections, scale) {
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = 10; // Increased line width for visibility
    const startX = 10;
    const y = canvas.height / 2; // Centered vertically

    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + scaledLength, y);
    ctx.stroke(); // Draw the main line

    ctx.fillStyle = 'black';
    const holeRadius = 5; // Increased hole radius for visibility

    if (!sections || !Array.isArray(sections)) {
        console.warn("drawStraightLine: sections is not a valid array.", sections);
        return; 
    }

    let currentDrawingX = startX;
    sections.forEach(section => {
        const sectionStartOffset = (section.isCornerSection ? (DEFAULT_DRILL_OFFSET + DEFAULT_INSERT_LENGTH) : DEFAULT_STRAIGHT_LINE_START_OFFSET) * scale;
        
        let holeX = currentDrawingX + sectionStartOffset;
        for (let i = 0; i < section.numberOfHoles; i++) {
            ctx.beginPath();
            ctx.arc(holeX, y, holeRadius, 0, Math.PI * 2);
            ctx.fill(); // Draw the hole
            holeX += spacing * scale;
        }
        currentDrawingX += section.sectionLength * scale;
    });
}


function drawRectangle(startX, startY, scaledWidth, scaledHeight, widthSections, heightSections, spacing, scale) {
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = 10; // Increased line width for visibility

    // Draw the rectangle outline
    ctx.strokeRect(startX, startY, scaledWidth, scaledHeight);

    ctx.fillStyle = 'black';
    const holeRadius = 5; // Increased hole radius for visibility
    const drillOffsetScaled = (DEFAULT_DRILL_OFFSET + DEFAULT_INSERT_LENGTH) * scale; // Combined offset for drilling

    // Draw holes on Top and Bottom sides (width sections)
    let currentDrawingX_width = startX;
    widthSections.forEach((section, secIndex) => {
        const yPosTop = startY;
        const yPosBottom = startY + scaledHeight;

        let holeX_top = currentDrawingX_width + drillOffsetScaled;
        let holeX_bottom = currentDrawingX_width + drillOffsetScaled;

        for (let i = 0; i < section.numberOfHoles; i++) {
            ctx.beginPath();
            ctx.arc(holeX_top, yPosTop, holeRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(holeX_bottom, yPosBottom, holeRadius, 0, Math.PI * 2);
            ctx.fill();

            holeX_top += spacing * scale;
            holeX_bottom += spacing * scale;
        }
        currentDrawingX_width += section.sectionLength * scale;
    });

    // Draw holes on Left and Right sides (height sections)
    let currentDrawingY_height = startY;
    heightSections.forEach((section, secIndex) => {
        const xPosLeft = startX;
        const xPosRight = startX + scaledWidth;

        let holeY_left = currentDrawingY_height + drillOffsetScaled;
        let holeY_right = currentDrawingY_height + drillOffsetScaled;
        
        for (let i = 0; i < section.numberOfHoles; i++) {
            ctx.beginPath();
            ctx.arc(xPosLeft, holeY_left, holeRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(xPosRight, holeY_right, holeRadius, 0, Math.PI * 2);
            ctx.fill();

            holeY_left += spacing * scale;
            holeY_right += spacing * scale;
        }
        currentDrawingY_height += section.sectionLength * scale;
    });


    // Draw "corner holes" more explicitly if enabled, to represent the shared nature
    if (includeCornerHolesCheckbox.checked) {
        ctx.fillStyle = 'blue'; // Use a different color for corner holes for clarity
        const corners = [
            { x: startX, y: startY }, // Top-Left
            { x: startX + scaledWidth, y: startY }, // Top-Right
            { x: startX, y: startY + scaledHeight }, // Bottom-Left
            { x: startX + scaledWidth, y: startY + scaledHeight } // Bottom-Right
        ];
        corners.forEach(corner => {
            ctx.beginPath();
            ctx.arc(corner.x, corner.y, holeRadius + 1, 0, Math.PI * 2); // Slightly larger
            ctx.fill();
        });
    }
}


// --- Export Functions ---
function saveReportSummary() {
    const reportContent = resultsOutput.value;
    if (!reportContent) {
        alert("No report to save!");
        return;
    }
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'PVC_Project_Report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

function exportLabels() {
    if (allLabelsData.length === 0) {
        alert("No labels to export! Perform a calculation first.");
        return;
    }

    let csvContent = "Side,Section,Length (in),Holes,Is Corner Section\n";
    allLabelsData.forEach(label => {
        csvContent += `${label.side},${label.section},${label.length.toFixed(2)},${label.holes},${label.isCorner ? 'Yes' : 'No'}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'PVC_Pipe_Labels.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

function exportVisualCanvas() {
    if (canvas.width === 0 || canvas.height === 0 || ctx.getImageData(0, 0, canvas.width, canvas.height).data.every(v => v === 0)) {
        alert("No visual to export! Perform a calculation first.");
        return;
    }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'PVC_Project_Visual.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


// --- Event Listeners and Initial Setup ---
calculateBtn.addEventListener('click', performCalculation);
shapeSelect.addEventListener('change', updateHeightInputState); // Listen to 'change' event on select

// Add listeners for new export and reset buttons
saveReportBtn.addEventListener('click', saveReportSummary);
exportLabelsBtn.addEventListener('click', exportLabels);
exportVisualBtn.addEventListener('click', exportVisualCanvas);
resetBtn.addEventListener('click', resetAllInputs); // New reset button listener

// Add event listeners for all input fields to trigger calculation on change
[
    widthInput, heightInput, spacingInput, pipeLengthInput, includeCornerHolesCheckbox,
    insertLengthInput, drillOffsetInput, straightLineStartOffsetInput, maxHolesPerSectionInput,
    basePriceInput, bulkPriceInput, bulkThresholdInput, couplingCostInput, elbowCostInput, salesTaxRateInput
].forEach(input => {
    input.addEventListener('input', performCalculation); // 'input' for text, 'change' for checkbox/radio
});

// Helper to update height input visibility based on shape selection
function updateHeightInputState() {
    const isRectangle = shapeSelect.value === 'rectangle';
    // Ensure elements exist before trying to access their style property
    if (heightInputGroup) {
        if (isRectangle) {
            heightInputGroup.style.display = 'block';
            if (heightLabel) heightLabel.style.display = 'block';
            if (heightNote) heightNote.style.display = 'block';
        } else {
            heightInputGroup.style.display = 'none';
            if (heightLabel) heightLabel.style.display = 'none';
            if (heightNote) heightNote.style.display = 'none';
            heightInput.value = ''; // Clear height when switching to straight line
        }
    }
    performCalculation(); // Re-calculate when shape changes
}

// Ensure initial state and calculation on page load
document.addEventListener('DOMContentLoaded', () => {
    updateHeightInputState(); // Set initial height input visibility
    performCalculation();     // Run initial calculation
});