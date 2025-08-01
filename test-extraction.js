// Quick test script to debug question extraction
const sampleText = `
BETCK105C/205C
Visvesvaraya Technological University, Belagavi.
Model Question Paper-I with effect from 2022-23(CBCS Scheme)
QNo. Module– 1 Marks
Q1
a Describe the Sputtering technique for the preparation of nanomaterials. Mention itsadvantages and drawbacks. 8
b Write a note on a) surface to volume ratio b) precipitation for the synthesis of nanomaterials. 8
c Define the terms i) Nanomaterials ii) Quantum confinement 4
OR
Q2
a Explain how optical, electrical and catalytical properties vary from bulk to nanomaterials. 8
b Explain the steps involved in synthesis of silica nanoparticles by taking sol gel method. 8
c Explain the electronconfinement in OD, 1D, 2D, 3D systems with examples. 4
Module– 2
Q3
a Explain the basic principle, working and instrumentation of scanning electron microscope with diagram. 8
`;

console.log('Testing updated VTU pattern with header filtering...');

// Header patterns to exclude
const headerPatterns = [
  /visvesvaraya technological university/i,
  /model question paper/i,
  /semester.*degree examination/i,
  /time:\s*\d+\s*hours/i,
  /max\.marks:\s*\d+/i,
  /note:\s*answer any/i,
  /module[–\-]\s*\d+/i,
  /qno\./i,
  /marks/i,
  /betck\d+/i,
  /^or$/i,
  /usn:/i,
  /introduction to/i
];

// Adapted Python-style pattern for VTU format where Q number can be on separate line
// Original Python: r'Q(\d+)\s+([a-c])\s+(.*?)(?=\s+\d+\s+(?:[a-c]|Q\d+|OR|Module|$))'
// Modified for VTU: Q1\n a text... or Q1 a text...
const vtuPattern = /Q(\d+)(?:\s*\n\s*|\s+)([a-c])\s+(.*?)(?=\s+\d+\s+(?:[a-c]|Q\d+|OR|Module|$))/gi;

let match;
let questionId = 1;

while ((match = vtuPattern.exec(sampleText)) !== null) {
  const questionNumber = parseInt(match[1]);
  const subPart = match[2].toLowerCase();
  const questionText = match[3]?.trim();
  
  // Extract the marks from the lookahead - we need to find the number that follows
  const afterMatch = sampleText.substring(match.index + match[0].length);
  const marksMatch = afterMatch.match(/^\s+(\d+)/);
  const marks = marksMatch ? parseInt(marksMatch[1]) : 8;
  
  console.log(`Raw match: Q${questionNumber}${subPart} - "${questionText}" - ${marks} marks`);
  
  // Skip if marks are too high (likely headers) or too low
  if (marks > 10 || marks < 2) {
    console.log(`  -> Skipped: Invalid marks (${marks})`);
    continue;
  }
  
  // Skip header-like content
  const isHeader = headerPatterns.some(pattern => pattern.test(questionText));
  if (isHeader) {
    console.log(`  -> Skipped: Header detected`);
    continue;
  }
  
  // Only process if it looks like a valid question
  if (questionText && questionText.length > 20 && questionText.length < 300) {
    // Clean up the question text
    const cleanedText = questionText
      .replace(/\s+/g, ' ')
      .replace(/^\s*[a-c]\s+/, '') // Remove leading sub-part letter if duplicated
      .trim();
    
    // Skip if the text is too short or contains mostly non-alphabetic characters
    if (cleanedText.length < 15 || !/[a-zA-Z]/.test(cleanedText)) {
      console.log(`  -> Skipped: Text too short or non-alphabetic`);
      continue;
    }
    
    // Skip if it looks like a table header or formatting
    if (/^\d+$/.test(cleanedText) || /^[a-c]$/.test(cleanedText)) {
      console.log(`  -> Skipped: Looks like formatting`);
      continue;
    }
    
    console.log(`  -> ✓ ACCEPTED: Q${questionNumber}${subPart} - ${cleanedText.substring(0, 60)}... (${marks} marks)`);
    questionId++;
  } else {
    console.log(`  -> Skipped: Invalid length (${questionText?.length || 0})`);
  }
}