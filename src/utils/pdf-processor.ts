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
    
    // Set end positions for each Q section
    for (let i = 0; i < qNumbers.length - 1; i++) {
      qNumbers[i].endPos = qNumbers[i + 1].startPos;
    }
    
    console.log(`Found ${qNumbers.length} Q sections:`, qNumbers.map(q => `Q${q.number}`));
    
    // Now find sub-questions within each Q section
    const subQuestionPattern = /([a-c])\s+(.*?)(?=\s+(\d+))/gi;
    
    qNumbers.forEach(qInfo => {
      const qSection = text.substring(qInfo.startPos, qInfo.endPos);
      console.log(`\nProcessing Q${qInfo.number} section (${qSection.length} chars)...`);
      
      subQuestionPattern.lastIndex = 0; // Reset regex
      let match;
      
      while ((match = subQuestionPattern.exec(qSection)) !== null) {
        const subPart = match[1].toLowerCase();
        const questionText = match[2]?.trim();
        const marks = parseInt(match[3]) || 8;
        
        console.log(`Raw match: Q${qInfo.number}${subPart} - "${questionText?.substring(0, 50)}..." - ${marks} marks`);
        console.log(`  Match details: subPart="${subPart}", questionText length=${questionText?.length}`);
        
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
        if (questionText && questionText.length > 20 && questionText.length < 500) {
          // Clean up the question text - handle multiline content better
          const cleanedText = questionText
            .replace(/\s+/g, ' ')
            .replace(/^\s*[a-cA-C]\s+/, '') // Remove leading sub-part letter if duplicated
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .trim();
          
          // Skip if the text is too short or contains mostly non-alphabetic characters
          if (cleanedText.length < 15 || !/[a-zA-Z]/.test(cleanedText)) {
            console.log(`  -> Skipped: Text too short or non-alphabetic`);
            continue;
          }
          
          // Skip if it looks like a table header or formatting
          if (/^\d+$/.test(cleanedText) || /^[a-cA-C]$/.test(cleanedText)) {
            console.log(`  -> Skipped: Looks like formatting`);
            continue;
          }
          
          // Find position information if textItems are provided
          let position = { x: 0, y: 0, width: 0, height: 0, pageNum: 0 };
          if (textItems) {
            // Better position detection strategy
            let foundItem = null;
            
            // Strategy 1: Look for the sub-question part in a table cell context
            const subPartInCell = textItems.find(item => 
              item.str.trim() === subPart && // Exact match for sub-part
              item.x > 500 && item.x < 650 // Likely in the question column based on the table structure
            );
            
            if (subPartInCell) {
              foundItem = subPartInCell;
              console.log(`  -> Found sub-part "${subPart}" at x=${foundItem.x}, y=${foundItem.y}`);
            } else {
              // Strategy 2: Look for the first significant words of the question text
              const significantWords = cleanedText
                .replace(/^(explain|describe|define|write|discuss|analyze)/i, '') // Remove common starting words
                .split(' ')
                .filter(word => word.length > 3) // Only significant words
                .slice(0, 2) // First 2 significant words
                .join(' ')
                .toLowerCase();
              
              if (significantWords.length > 5) {
                foundItem = textItems.find(item => 
                  item.str.toLowerCase().includes(significantWords) && 
                  item.str.length > 10 &&
                  item.x > 630 // In the question text area
                );
                console.log(`  -> Looking for significant words: "${significantWords}"`);
              }
            }
            
            // Strategy 3: Pattern-based search for VTU format
            if (!foundItem) {
              const questionStartPattern = new RegExp(`${subPart}\\s+${cleanedText.substring(0, 15)}`, 'i');
              foundItem = textItems.find(item => questionStartPattern.test(item.str));
            }
            
            if (foundItem) {
              // Find the entire question area by looking for related text items
              const questionItems = textItems.filter(item => 
                Math.abs(item.y - foundItem!.y) < 30 && // Same line or nearby
                item.x >= foundItem!.x - 20 && // Same horizontal area
                item.pageNum === foundItem!.pageNum
              );
              
              const minX = Math.min(...questionItems.map(item => item.x));
              const maxX = Math.max(...questionItems.map(item => item.x + (item.width || 0)));
              const minY = Math.min(...questionItems.map(item => item.y));
              const maxY = Math.max(...questionItems.map(item => item.y + (item.height || 0)));
              
              position = {
                x: minX,
                y: minY,
                width: Math.max(maxX - minX, 400), // Ensure minimum width
                height: Math.max(maxY - minY, 80), // Ensure minimum height
                pageNum: foundItem.pageNum
              };
              console.log(`  -> Found position for Q${qInfo.number}${subPart}: x=${position.x}, y=${position.y}, page=${position.pageNum}`);
            } else {
              console.log(`  -> No position found for Q${qInfo.number}${subPart}`);
            }
          }

          const questionId = `q${qInfo.number}${subPart}`;
          questions.push({
            id: questionId,
            text: cleanedText,
            marks,
            position,
            alternatives: []
          });
          
          console.log(`  -> ✓ ACCEPTED: ${questionId} - ${cleanedText.substring(0, 60)}... (${marks} marks)`);
        } else {
          console.log(`  -> Skipped: Invalid length (${questionText?.length || 0})`);
        }
      }
    });

    console.log(`Two-step extraction complete. Found ${questions.length} questions total.`);
    return questions;
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