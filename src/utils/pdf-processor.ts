import { PDFDocument, rgb } from 'pdf-lib';
import { Question } from '@/types/question-paper';

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

  static extractQuestions(text: string): Question[] {
    const questions: Question[] = [];
    
    console.log('Starting WORKING question extraction...');
    console.log('Input text length:', text.length);
    
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
        
        console.log(`Raw match: Q${qInfo.number}${subPart} - "${questionText}" - ${marks} marks`);
        
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
          
          questions.push({
            id: `q${qInfo.number}${subPart}`,
            text: cleanedText,
            marks,
            position: {
              x: 0,
              y: 0,
              width: 0,
              height: 0
            },
            alternatives: []
          });
          
          console.log(`  -> ✓ ACCEPTED: Q${qInfo.number}${subPart} - ${cleanedText.substring(0, 60)}... (${marks} marks)`);
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
    selectedQuestions: { [questionId: string]: string }
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
      
      // For now, we'll create a simple text replacement
      // In a production app, you'd need more sophisticated PDF manipulation
      
      const firstPage = pages[0];
      const { height } = firstPage.getSize();
      
      // Add modified questions as text overlay
      let yPosition = height - 100;
      
      Object.entries(selectedQuestions).forEach(([questionId, questionText]) => {
        firstPage.drawText(`${questionId}: ${questionText}`, {
          x: 50,
          y: yPosition,
          size: 12,
          color: rgb(0, 0, 0),
        });
        yPosition -= 50;
      });

      return await pdfDoc.save();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error creating modified PDF:', errorMessage);
      throw new Error('Failed to create modified PDF');
    }
  }
}