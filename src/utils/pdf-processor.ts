import { PDFDocument, rgb } from 'pdf-lib';
import { Question } from '@/types/question-paper';
import { HTMLPdfGenerator, VTUQuestionPaper } from './html-pdf-generator';

export class PdfProcessor {
  static async extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
    try {
      // Dynamically import PDF.js only on client side
      if (typeof window === 'undefined') {
        throw new Error('PDF processing is only available on the client side');
      }

      const pdfjsLib = await import('pdfjs-dist');
      
      // Configure PDF.js worker to match the installed version (3.11.174)
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

      const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
      let fullText = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => {
            if ('str' in item && typeof item.str === 'string') {
              return item.str;
            }
            return '';
          })
          .join(' ');
        fullText += pageText + '\n';
      }

      console.log('Extracted PDF text length:', fullText.length);
      console.log('First 500 characters of extracted text:', fullText.substring(0, 500));
      return fullText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error extracting text from PDF:', errorMessage);
      throw new Error('Failed to extract text from PDF');
    }
  }

  static async extractTextWithPositions(pdfBuffer: ArrayBuffer): Promise<{
    text: string;
    textItems: Array<{
      str: string;
      x: number;
      y: number;
      width: number;
      height: number;
      pageNum: number;
    }>;
  }> {
    try {
      if (typeof window === 'undefined') {
        throw new Error('PDF processing is only available on the client side');
      }

      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

      const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
      let fullText = '';
      const textItems: Array<{
        str: string;
        x: number;
        y: number;
        width: number;
        height: number;
        pageNum: number;
      }> = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageHeight = page.getViewport({ scale: 1 }).height;
        
        textContent.items.forEach((item) => {
          if ('str' in item && typeof item.str === 'string' && 'transform' in item) {
            const transform = item.transform as number[];
            textItems.push({
              str: item.str,
              x: transform[4],
              y: pageHeight - transform[5], // Convert to top-origin coordinates
              width: item.width || 0,
              height: item.height || 0,
              pageNum: pageNum - 1, // 0-indexed for pdf-lib
            });
          }
        });

        const pageText = textContent.items
          .map((item) => {
            if ('str' in item && typeof item.str === 'string') {
              return item.str;
            }
            return '';
          })
          .join(' ');
        fullText += pageText + '\n';
      }

      return { text: fullText, textItems };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error extracting text with positions:', errorMessage);
      throw new Error('Failed to extract text with positions');
    }
  }

  static extractQuestions(text: string, textItems?: Array<{
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
    pageNum: number;
  }>): Question[] {
    const questions: Question[] = [];
    
    console.log('Starting WORKING question extraction...');
    console.log('Input text length:', text.length);
    
    // Debug: Log some sample text items to understand the structure
    if (textItems && textItems.length > 0) {
      console.log('Sample text items (first 20):');
      textItems.slice(0, 20).forEach((item, index) => {
        console.log(`  ${index}: "${item.str}" at (${Math.round(item.x)}, ${Math.round(item.y)})`);
      });
      
      // Look for table structure indicators
      const tableItems = textItems.filter(item => 
        item.str.match(/^[abc]$/) || 
        item.str.includes('Q1') || 
        item.str.includes('Q2') || 
        item.str.includes('Q3')
      );
      console.log('Table structure items:', tableItems.map(item => `"${item.str}" at (${Math.round(item.x)}, ${Math.round(item.y)})`));
    }
    
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

    // Two-step approach: Find Q numbers, then find sub-questions within each Q section
    console.log('Using two-step VTU pattern approach...');
    
    // First find all Q numbers and their positions
    const qNumberPattern = /Q(\d+)/g;
    const qNumbers = [];
    let qMatch;
    
    while ((qMatch = qNumberPattern.exec(text)) !== null) {
      qNumbers.push({
        number: parseInt(qMatch[1]),
        startPos: qMatch.index,
        endPos: text.length // Will update this
      });
    }
    
    // Set end positions for each Q section with better boundary detection
    for (let i = 0; i < qNumbers.length - 1; i++) {
      // Find the actual end of this Q section by looking for content that belongs to the next Q
      const nextQStart = qNumbers[i + 1].startPos;
      const currentQEnd = this.findQSectionEnd(text, qNumbers[i].startPos, nextQStart, qNumbers[i].number);
      qNumbers[i].endPos = Math.min(currentQEnd, nextQStart);
    }
    
    console.log(`Found ${qNumbers.length} Q sections:`, qNumbers.map(q => `Q${q.number}`));
    
    // Multi-pass extraction for better accuracy
    console.log('\n=== STARTING MULTI-PASS EXTRACTION ===');
    
    qNumbers.forEach(qInfo => {
      const qSection = text.substring(qInfo.startPos, qInfo.endPos);
      console.log(`\nProcessing Q${qInfo.number} section (${qSection.length} chars)...`);
      console.log(`Raw section text: "${qSection.substring(0, 200)}..."`);
      
      // Count expected sub-questions by looking for a, b, c patterns
      const expectedCount = this.countExpectedSubQuestions(qSection);
      console.log(`Expected ${expectedCount} sub-questions for Q${qInfo.number}`);
      
      // PASS 1: Try to find clear, well-separated sub-questions
      const pass1Questions = this.extractWithStrictPattern(qSection, qInfo.number);
      console.log(`Pass 1 found ${pass1Questions.length} questions for Q${qInfo.number} (expected ${expectedCount})`);
      
      // PASS 2: If Pass 1 didn't find expected number of questions, try alternative patterns
      let finalQuestions = pass1Questions;
      if (pass1Questions.length < expectedCount) {
        console.log(`Pass 1 insufficient (${pass1Questions.length}/${expectedCount}), trying Pass 2 for Q${qInfo.number}...`);
        const pass2Questions = this.extractWithFlexiblePattern(qSection, qInfo.number);
        console.log(`Pass 2 found ${pass2Questions.length} questions for Q${qInfo.number}`);
        
        if (pass2Questions.length > pass1Questions.length) {
          finalQuestions = pass2Questions;
        }
      }
      
      // PASS 3: Ensure proper sequential sub-parts (a, b, c)
      const sequentialQuestions = this.ensureSequentialSubParts(finalQuestions, qInfo.number, expectedCount);
      console.log(`Pass 3 sequential correction: ${sequentialQuestions.length} questions for Q${qInfo.number}`);
      
      // Add position information and push to main questions array
      sequentialQuestions.forEach(q => {
        // Find position information if textItems are provided
        let position = { x: 0, y: 0, width: 0, height: 0, pageNum: 0 };
        if (textItems) {
          const foundItem = textItems.find(item => 
            item.str.toLowerCase().includes(q.text.substring(0, 20).toLowerCase()) ||
            (item.str.trim() === q.subPart && item.x > 500 && item.x < 650)
          );
          if (foundItem) {
            position = {
              x: foundItem.x,
              y: foundItem.y,
              width: 400,
              height: 80,
              pageNum: foundItem.pageNum
            };
          }
        }
        
        questions.push({
          id: q.id,
          text: q.text,
          marks: q.marks,
          position,
          alternatives: []
        });
        
        console.log(`  -> ✓ FINAL: ${q.id} - ${q.text.substring(0, 60)}... (${q.marks} marks)`);
      });
    });

    console.log(`Multi-pass extraction complete. Found ${questions.length} questions total.`);
    return questions;
  }

  private static extractWithStrictPattern(qSection: string, qNumber: number): Array<{
    id: string;
    text: string;
    marks: number;
    subPart: string;
  }> {
    const questions: Array<{ id: string; text: string; marks: number; subPart: string }> = [];
    
    // Try multiple regex patterns to catch different formats
    const patterns = [
      // Pattern 1: Standard format with clear boundaries
      /\b([a-c])\s+(.*?)(?=\s+(\d+)\s*(?:\n|$|marks?|\b[a-c]\s+|\d+\s*(?:\n|$)))/gi,
      
      // Pattern 2: With parentheses or dots
      /\b([a-c])[\.\)\s]\s*(.*?)(?=\s+(\d+)\s*(?:\n|$|marks?|\b[a-c][\.\)\s]))/gi,
      
      // Pattern 3: More flexible ending
      /\b([a-c])\s+(.*?)(\d+)(?=\s*(?:\n|$|\b[a-c]\s+))/gi
    ];
    
    patterns.forEach((pattern, patternIndex) => {
      let match;
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(qSection)) !== null) {
        const subPart = match[1].toLowerCase();
        const questionText = match[2]?.trim();
        const marks = parseInt(match[3]) || 8;
        
        // Check if we already have this sub-part (avoid duplicates)
        const existingQuestion = questions.find(q => q.subPart === subPart);
        if (existingQuestion) {
          continue;
        }
        
        if (this.isValidQuestion(questionText, marks)) {
          const cleanedText = this.cleanQuestionText(questionText);
          questions.push({
            id: `q${qNumber}${subPart}`,
            text: cleanedText,
            marks,
            subPart
          });
          console.log(`  Pass 1 (pattern ${patternIndex + 1}): Found Q${qNumber}${subPart} - "${cleanedText.substring(0, 40)}..."`);
        }
      }
    });
    
    return questions;
  }

  private static extractWithFlexiblePattern(qSection: string, qNumber: number): Array<{
    id: string;
    text: string;
    marks: number;
    subPart: string;
  }> {
    const questions: Array<{ id: string; text: string; marks: number; subPart: string }> = [];
    
    // Try different line splitting approaches
    const lineSeparators = [/\n+/, /\s{3,}/, /\d+\s+[a-c]/gi];
    
    for (const separator of lineSeparators) {
      const lines = qSection.split(separator).map(line => line.trim()).filter(line => line.length > 0);
      
      let currentSubPart = '';
      let currentText = '';
      let currentMarks = 8;
      let foundQuestions = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // More flexible sub-question marker patterns
        const subPartMatches = [
          line.match(/^([a-c])\s*[\.\)\s]\s*(.+)/i),
          line.match(/\b([a-c])\s+(.+?)(?=\d+)/i),
          line.match(/([a-c])\s*:\s*(.+)/i)
        ];
        
        const subPartMatch = subPartMatches.find(match => match !== null);
        
        if (subPartMatch) {
          // Save previous question if exists
          if (currentText && currentSubPart) {
            // Check if this sub-part is already captured
            const existingQuestion = questions.find(q => q.subPart === currentSubPart);
            if (!existingQuestion && this.isValidQuestion(currentText, currentMarks)) {
              const cleanedText = this.cleanQuestionText(currentText);
              questions.push({
                id: `q${qNumber}${currentSubPart}`,
                text: cleanedText,
                marks: currentMarks,
                subPart: currentSubPart
              });
              console.log(`  Pass 2: Found Q${qNumber}${currentSubPart} - "${cleanedText.substring(0, 40)}..."`);
              foundQuestions++;
            }
          }
          
          // Start new question
          currentSubPart = subPartMatch[1].toLowerCase();
          currentText = subPartMatch[2];
          
          // Look for marks in this line or next few lines
          const marksMatch = currentText.match(/(\d+)\s*(?:marks?)?$/i);
          if (marksMatch) {
            currentMarks = parseInt(marksMatch[1]);
            currentText = currentText.replace(/\s*\d+\s*(?:marks?)?$/i, '').trim();
          }
          
        } else if (currentText && !line.match(/^\d+$/) && !line.match(/^Q\d+/) && !line.match(/^[a-c]\s/)) {
          // Continue current question - be more selective about what to include
          const marksMatch = line.match(/(\d+)\s*(?:marks?)?$/i);
          if (marksMatch) {
            currentMarks = parseInt(marksMatch[1]);
            const textPart = line.replace(/\s*\d+\s*(?:marks?)?$/i, '').trim();
            if (textPart && textPart.length > 5) {
              currentText += ' ' + textPart;
            }
          } else if (line.length > 5 && /[a-zA-Z]/.test(line)) {
            currentText += ' ' + line;
          }
        }
      }
      
      // Don't forget the last question
      if (currentText && currentSubPart) {
        const existingQuestion = questions.find(q => q.subPart === currentSubPart);
        if (!existingQuestion && this.isValidQuestion(currentText, currentMarks)) {
          const cleanedText = this.cleanQuestionText(currentText);
          questions.push({
            id: `q${qNumber}${currentSubPart}`,
            text: cleanedText,
            marks: currentMarks,
            subPart: currentSubPart
          });
          console.log(`  Pass 2: Found Q${qNumber}${currentSubPart} - "${cleanedText.substring(0, 40)}..."`);
          foundQuestions++;
        }
      }
      
      // If this separator approach found questions, use it
      if (foundQuestions > 0) {
        console.log(`  Pass 2: Using separator approach that found ${foundQuestions} questions`);
        break;
      }
    }
    
    return questions;
  }

  private static countExpectedSubQuestions(qSection: string): number {
    // Count occurrences of a, b, c as sub-question markers
    const aCount = (qSection.match(/\b[a\.][\s\)]/gi) || []).length;
    const bCount = (qSection.match(/\b[b\.][\s\)]/gi) || []).length;
    const cCount = (qSection.match(/\b[c\.][\s\)]/gi) || []).length;
    
    console.log(`  Raw counts: a=${aCount}, b=${bCount}, c=${cCount}`);
    
    // Return the maximum reasonable count (usually 3 for VTU questions)
    const maxCount = Math.max(aCount, bCount, cCount);
    return Math.min(maxCount, 3); // Cap at 3 sub-questions
  }

  private static ensureSequentialSubParts(questions: Array<{
    id: string;
    text: string;
    marks: number;
    subPart: string;
  }>, qNumber: number, expectedCount: number): Array<{
    id: string;
    text: string;
    marks: number;
    subPart: string;
  }> {
    if (questions.length === 0) return questions;
    
    // Sort by sub-part to ensure proper order
    questions.sort((a, b) => a.subPart.localeCompare(b.subPart));
    
    // Fix sequential sub-parts based on expected count
    const expectedSubParts = ['a', 'b', 'c'].slice(0, expectedCount);
    const correctedQuestions: Array<{ id: string; text: string; marks: number; subPart: string }> = [];
    
    questions.forEach((question, index) => {
      if (index < expectedSubParts.length) {
        const correctSubPart = expectedSubParts[index];
        const correctedQuestion = {
          ...question,
          subPart: correctSubPart,
          id: `q${qNumber}${correctSubPart}`
        };
        correctedQuestions.push(correctedQuestion);
        
        if (question.subPart !== correctSubPart) {
          console.log(`  Pass 3: Corrected Q${qNumber}${question.subPart} → Q${qNumber}${correctSubPart}`);
        }
      }
    });
    
    // If we still don't have enough questions, log a warning
    if (correctedQuestions.length < expectedCount) {
      console.warn(`  ⚠️  Q${qNumber}: Only found ${correctedQuestions.length} questions, expected ${expectedCount}`);
    }
    
    return correctedQuestions;
  }

  private static isValidQuestion(questionText: string | undefined, marks: number): boolean {
    if (!questionText) return false;
    
    // Check marks range
    if (marks > 10 || marks < 2) return false;
    
    // Check text length
    if (questionText.length < 20 || questionText.length > 500) return false;
    
    // Check for alphabetic content
    if (!/[a-zA-Z]/.test(questionText)) return false;
    
    // Skip formatting-only text
    if (/^\d+$/.test(questionText.trim()) || /^[a-cA-C]$/.test(questionText.trim())) return false;
    
    return true;
  }

  private static cleanQuestionText(questionText: string): string {
    return questionText
      .replace(/\s+/g, ' ')
      .replace(/^\s*[a-cA-C][\.\)\s]\s*/, '') // Remove leading sub-part markers
      .replace(/\n+/g, ' ')
      .trim();
  }

  private static findQSectionEnd(text: string, currentQStart: number, nextQStart: number, currentQNumber: number): number {
    // Look for the last complete sub-question (c) in this Q section
    const qSection = text.substring(currentQStart, nextQStart);
    
    // Find all occurrences of sub-question parts in this section
    const subPartMatches = [];
    const patterns = [
      /\bc\s+.*?(\d+)(?:\s|$)/gi,  // c followed by text and marks
      /\bc\s+.*?$/gmi,             // c followed by text to end of line
      /\bc[\.\)\s]/gi              // just the c marker
    ];
    
    patterns.forEach(pattern => {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(qSection)) !== null) {
        subPartMatches.push({
          type: 'c',
          start: currentQStart + match.index,
          end: currentQStart + match.index + match[0].length,
          text: match[0]
        });
      }
    });
    
    if (subPartMatches.length > 0) {
      // Find the last 'c' sub-question and extend the boundary to include it
      const lastCMatch = subPartMatches[subPartMatches.length - 1];
      
      // Look for marks or content after this 'c' that belongs to this Q
      const afterCText = text.substring(lastCMatch.end, nextQStart);
      const marksMatch = afterCText.match(/.*?(\d+)(?:\s|$)/);
      
      if (marksMatch) {
        const endPos = lastCMatch.end + marksMatch.index + marksMatch[0].length;
        console.log(`  Extended Q${currentQNumber} boundary to include 'c' sub-question (pos ${endPos})`);
        return endPos;
      } else {
        // Extend by a reasonable amount to capture the full 'c' question
        const endPos = Math.min(lastCMatch.end + 100, nextQStart - 10);
        console.log(`  Extended Q${currentQNumber} boundary by default amount (pos ${endPos})`);
        return endPos;
      }
    }
    
    // If no 'c' found, use the original boundary
    return nextQStart;
  }

  static generateSimilarQuestions(originalQuestion: string): string[] {
    const alternatives: string[] = [];
    
    // Simple variations for demonstration
    // In a real implementation, you'd use AI/ML for better question generation
    const questionTypes = [
      'Explain in detail',
      'Describe with examples',
      'Analyze and discuss',
      'Compare and contrast',
      'Evaluate the significance of'
    ];

    const baseContent = originalQuestion.replace(/^(Explain|Describe|Analyze|Compare|Evaluate|Write|Discuss).*?(?=\s)/i, '').trim();
    
    questionTypes.forEach((type, index) => {
      if (index < 5) {
        alternatives.push(`${type} ${baseContent}`);
      }
    });

    return alternatives;
  }

  static async createModifiedPdf(
    originalPdfBuffer: ArrayBuffer | Uint8Array,
    selectedQuestions: { [questionId: string]: string },
    originalQuestions: Question[]
  ): Promise<Uint8Array> {
    try {
      // Handle both ArrayBuffer and Uint8Array
      let pdfData: Uint8Array;
      if (originalPdfBuffer instanceof ArrayBuffer) {
        pdfData = new Uint8Array(originalPdfBuffer);
      } else {
        pdfData = originalPdfBuffer;
      }
      
      const pdfDoc = await PDFDocument.load(pdfData);
      const pages = pdfDoc.getPages();
      
      console.log('Starting PDF modification with position-based replacement...');
      
      Object.entries(selectedQuestions).forEach(([questionId, newQuestionText]) => {
        // Find the original question to get its position
        const originalQuestion = originalQuestions.find(q => q.id === questionId);
        
        if (originalQuestion && originalQuestion.position.x > 0 && originalQuestion.position.y > 0) {
          console.log(`Replacing question ${questionId} at position (${originalQuestion.position.x}, ${originalQuestion.position.y}), page ${originalQuestion.position.pageNum || 0}`);
          
          // Use the correct page
          const pageIndex = originalQuestion.position.pageNum || 0;
          const page = pages[pageIndex];
          if (!page) {
            console.error(`Page ${pageIndex} not found, using page 0`);
            return;
          }
          
          const { height, width } = page.getSize();
          
          // Convert coordinates - PDF.js uses top-origin (0,0 at top-left)
          // pdf-lib uses bottom-origin (0,0 at bottom-left)
          const x = originalQuestion.position.x;
          const y = height - originalQuestion.position.y; // Convert from top-origin to bottom-origin
          
          // Make the overlay area larger to ensure coverage
          const overlayWidth = Math.min(originalQuestion.position.width + 50, width - x);
          const overlayHeight = Math.max(originalQuestion.position.height + 20, 80);
          
          // Draw white rectangle to cover original text
          page.drawRectangle({
            x: Math.max(0, x - 10),
            y: Math.max(0, y - overlayHeight + 10),
            width: overlayWidth,
            height: overlayHeight,
            color: rgb(1, 1, 1), // White background
          });
          
          // Split text into lines that fit within the available width
          const maxCharsPerLine = Math.floor(overlayWidth / 6); // Approximate chars per line
          const words = newQuestionText.split(' ');
          const lines: string[] = [];
          let currentLine = '';
          
          words.forEach(word => {
            if ((currentLine + word).length > maxCharsPerLine && currentLine.length > 0) {
              lines.push(currentLine.trim());
              currentLine = word + ' ';
            } else {
              currentLine += word + ' ';
            }
          });
          if (currentLine.trim()) lines.push(currentLine.trim());
          
          // Draw new question text
          const fontSize = 10;
          const lineHeight = 14;
          lines.forEach((line, index) => {
            const textY = y - (index * lineHeight) - 15;
            if (textY > 0) { // Only draw if within page bounds
              page.drawText(line, {
                x: Math.max(5, x),
                y: textY,
                size: fontSize,
                color: rgb(0, 0, 0),
              });
            }
          });
          
        } else {
          console.warn(`No valid position found for question ${questionId}, using fallback position`);
          
          // Fallback: Add at the bottom of the first page
          const firstPage = pages[0];
          const { height } = firstPage.getSize();
          const fallbackIndex = Object.keys(selectedQuestions).indexOf(questionId);
          
          firstPage.drawText(`${questionId}: ${newQuestionText}`, {
            x: 50,
            y: Math.max(50, height - 700 - (fallbackIndex * 30)),
            size: 10,
            color: rgb(0, 0, 1), // Blue to distinguish fallback text
          });
        }
      });

      console.log('PDF modification complete');
      return await pdfDoc.save();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error creating modified PDF:', errorMessage);
      throw new Error('Failed to create modified PDF');
    }
  }

  static async createVTUQuestionPaper(
    originalText: string,
    questions: Question[],
    selectedQuestions: { [questionId: string]: string }
  ): Promise<{ html: string; vtuStructure: VTUQuestionPaper }> {
    try {
      console.log('Creating VTU question paper structure...');
      
      // Parse the VTU structure from the original text
      const vtuStructure = HTMLPdfGenerator.parseVTUStructure(originalText, questions);
      console.log('VTU structure parsed:', vtuStructure);
      
      // Generate HTML with the selected questions
      const html = HTMLPdfGenerator.generateHTMLTemplate(vtuStructure, selectedQuestions);
      console.log('HTML template generated');
      
      return { html, vtuStructure };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error creating VTU question paper:', errorMessage);
      throw new Error('Failed to create VTU question paper');
    }
  }

  static downloadVTUQuestionPaper(html: string, filename: string = 'vtu-question-paper.html') {
    // Simply download HTML file that can be printed to PDF using Cmd+P
    HTMLPdfGenerator.downloadPrintReadyHTML(html, filename);
  }
}