import { Question } from '@/types/question-paper';

export interface VTUQuestionPaper {
  header: {
    university: string;
    course: string;
    semester: string;
    examType: string;
    subject: string;
    time: string;
    maxMarks: string;
    courseCode: string;
  };
  instructions: string;
  modules: Array<{
    name: string;
    questions: Question[];
  }>;
}

export class HTMLPdfGenerator {
  
  static parseVTUStructure(text: string, questions: Question[]): VTUQuestionPaper {
    console.log('Parsing VTU structure from text...');
    console.log('Input questions:', questions.map(q => ({ id: q.id, text: q.text.substring(0, 50) + '...' })));
    
    // Extract header information
    const header = {
      university: this.extractPattern(text, /visvesvaraya technological university/i) || 'Visvesvaraya Technological University',
      course: this.extractPattern(text, /(first|second|third|fourth|fifth|sixth|seventh|eighth).*semester.*degree/i) || 'Semester Degree Examination',
      semester: this.extractPattern(text, /(first|second|third|fourth|fifth|sixth|seventh|eighth)/i) || 'First/Second',
      examType: 'B.E. Degree Examination',
      subject: this.extractPattern(text, /introduction to \w+/i) || 'Subject',
      time: this.extractPattern(text, /time:\s*\d+\s*hours?/i) || 'TIME: 03 Hours',
      maxMarks: this.extractPattern(text, /max\.?\s*marks?\s*:\s*\d+/i) || 'Max.Marks: 100',
      courseCode: this.extractPattern(text, /[A-Z]{2,}[CK]\d+[A-Z]*/i) || 'BETCK105C'
    };

    // Group questions by modules based on standard VTU format
    // VTU format: Q1,Q2 = Module-1, Q3,Q4 = Module-2, Q5,Q6 = Module-3, etc.
    const modules: Array<{ name: string; questions: Question[] }> = [];
    
    // Create a proper mapping of Q numbers to modules
    const questionsByQNumber = new Map<number, Question[]>();
    questions.forEach(q => {
      const qNum = parseInt(q.id.match(/q(\d+)/)?.[1] || '0');
      if (!questionsByQNumber.has(qNum)) {
        questionsByQNumber.set(qNum, []);
      }
      questionsByQNumber.get(qNum)!.push(q);
    });
    
    // Sort Q numbers and group them by modules
    const sortedQNumbers = Array.from(questionsByQNumber.keys()).sort((a, b) => a - b);
    
    // Standard VTU module assignment: Q1,Q2=Module-1, Q3,Q4=Module-2, etc.
    for (let i = 0; i < sortedQNumbers.length; i += 2) {
      const moduleNum = Math.floor(i / 2) + 1;
      const moduleName = `Module - ${moduleNum}`;
      const moduleQuestions: Question[] = [];
      
      // Add questions for this module (2 Q numbers per module)
      for (let j = i; j < Math.min(i + 2, sortedQNumbers.length); j++) {
        const qNum = sortedQNumbers[j];
        const qQuestions = questionsByQNumber.get(qNum) || [];
        moduleQuestions.push(...qQuestions);
      }
      
      if (moduleQuestions.length > 0) {
        console.log(`${moduleName}: Q${sortedQNumbers.slice(i, Math.min(i + 2, sortedQNumbers.length)).join(', Q')} (${moduleQuestions.length} questions)`);
        modules.push({
          name: moduleName,
          questions: moduleQuestions
        });
      }
    }

    console.log('Final modules structure:', modules.map(m => ({ name: m.name, questionCount: m.questions.length })));

    return {
      header,
      instructions: 'Answer any FIVE full questions, choosing at least ONE question from each Module.',
      modules
    };
  }

  private static extractPattern(text: string, pattern: RegExp): string | null {
    const match = text.match(pattern);
    return match ? match[0] : null;
  }

  static generateHTMLTemplate(
    vtuPaper: VTUQuestionPaper,
    selectedQuestions: { [questionId: string]: string } = {}
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VTU Question Paper</title>
    <style>
        @page {
            size: A4;
            margin: 1in;
        }
        
        body {
            font-family: 'Times New Roman', serif;
            margin: 0;
            padding: 15px;
            font-size: 11px;
            line-height: 1.3;
            color: black;
            background: white;
        }
        
        .course-code {
            position: absolute;
            top: 15px;
            right: 20px;
            font-weight: bold;
            font-size: 12px;
            border: 1px solid black;
            padding: 3px 8px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
        }
        
        .university {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 3px;
            text-transform: uppercase;
        }
        
        .course-info {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 15px;
        }
        
        .usn-section {
            margin: 15px 0;
            text-align: left;
            font-weight: bold;
        }
        
        .usn-label {
            display: inline-block;
            margin-right: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .usn-boxes {
            display: inline-block;
            margin-left: 10px;
        }
        
        .usn-box {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 1px solid black;
            margin: 0 1px;
            vertical-align: middle;
            background: white;
        }
        
        .subject-section {
            text-align: center;
            margin: 20px 0;
            padding: 10px 0;
        }
        
        .subject-name {
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 10px;
        }
        
        .exam-details {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
            font-weight: bold;
            font-size: 11px;
        }
        
        .instructions {
            margin: 15px 0;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
        }
        
        .questions-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 11px;
        }
        
        .questions-table th,
        .questions-table td {
            border: 1px solid black;
            padding: 6px 8px;
            vertical-align: top;
            text-align: left;
        }
        
        .questions-table th {
            background-color: white;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
            padding: 8px;
        }
        
        .qno-col {
            width: 50px;
            text-align: center;
            font-weight: bold;
            vertical-align: middle;
            font-size: 11px;
        }
        
        .subq-col {
            width: 30px;
            text-align: center;
            font-weight: bold;
            vertical-align: middle;
            font-size: 11px;
            padding: 6px 4px;
        }
        
        .question-col {
            width: auto;
            padding: 6px 12px;
        }
        
        .marks-col {
            width: 50px;
            text-align: center;
            font-weight: bold;
            vertical-align: middle;
            font-size: 11px;
        }
        
        .module-header {
            background-color: white;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
            padding: 6px;
        }
        
        .sub-question {
            font-weight: bold;
            display: inline-block;
            width: 15px;
            margin-right: 8px;
            font-size: 11px;
        }
        
        .question-text {
            display: inline;
            font-size: 11px;
            line-height: 1.4;
        }
        
        .or-row {
            text-align: center;
            font-weight: bold;
            background-color: white;
            font-size: 11px;
            padding: 4px;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .question-row {
            min-height: 35px;
        }
        
        .question-content {
            padding: 2px 0;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="course-code">${vtuPaper.header.courseCode}</div>
    
    <div class="header">
        <div class="university">${vtuPaper.header.university}</div>
        <div class="course-info">${vtuPaper.header.course}</div>
    </div>
    
    <div class="usn-section">
        <span class="usn-label">USN:</span>
        <div class="usn-boxes">
            ${Array(10).fill(0).map(() => '<div class="usn-box"></div>').join('')}
        </div>
    </div>
    
    <div class="subject-section">
        <div class="subject-name">${vtuPaper.header.subject}</div>
    </div>
    
    <div class="exam-details">
        <span>${vtuPaper.header.time}</span>
        <span>${vtuPaper.header.maxMarks}</span>
    </div>
    
    <div class="instructions">
        <strong>Note:</strong> ${vtuPaper.instructions}
    </div>
    
    <table class="questions-table">
        <thead>
            <tr>
                <th class="qno-col">Q.No.</th>
                <th class="subq-col"></th>
                <th class="question-col">Questions</th>
                <th class="marks-col">Marks</th>
            </tr>
        </thead>
        <tbody>
            ${this.generateTableRows(vtuPaper.modules, selectedQuestions)}
        </tbody>
    </table>
</body>
</html>`;
  }

  private static generateTableRows(
    modules: Array<{ name: string; questions: Question[] }>,
    selectedQuestions: { [questionId: string]: string }
  ): string {
    let rows = '';
    
    modules.forEach((module, moduleIndex) => {
      // Module header
      rows += `
        <tr class="module-header">
            <td colspan="4">${module.name}</td>
        </tr>
      `;
      
      // Group questions by Q number
      const questionGroups = new Map<number, Question[]>();
      module.questions.forEach(q => {
        const qNum = parseInt(q.id.match(/q(\d+)/)?.[1] || '0');
        const subPart = q.id.match(/q\d+([abc])/)?.[1] || 'unknown';
        console.log(`Grouping question ${q.id}: Q${qNum}, subPart=${subPart}`);
        
        if (!questionGroups.has(qNum)) {
          questionGroups.set(qNum, []);
        }
        questionGroups.get(qNum)!.push(q);
      });
      
      console.log(`${module.name} question groups:`, Array.from(questionGroups.entries()).map(([qNum, questions]) => ({
        qNum,
        questions: questions.map(q => ({ id: q.id, subPart: q.id.match(/q\d+([abc])/)?.[1] }))
      })));
      
      // Sort question groups by Q number
      const sortedQGroups = Array.from(questionGroups.entries()).sort(([a], [b]) => a - b);
      
      // Generate rows for each question group
      sortedQGroups.forEach(([qNum, questions], groupIndex) => {
        // Sort questions within the group by sub-part (a, b, c)
        const sortedQuestions = questions.sort((a, b) => {
          const subA = a.id.match(/q\d+([abc])/)?.[1] || 'a';
          const subB = b.id.match(/q\d+([abc])/)?.[1] || 'a';
          return subA.localeCompare(subB);
        });
        
        sortedQuestions.forEach((question, subIndex) => {
          const questionText = selectedQuestions[question.id] || question.text;
          const subPart = question.id.match(/q\d+([abc])/)?.[1] || 'a';
          
          console.log(`Generating row for ${question.id}: subPart="${subPart}", text="${questionText.substring(0, 30)}..."`);
          
          rows += `
            <tr class="question-row">
                ${subIndex === 0 ? `<td class="qno-col" rowspan="${sortedQuestions.length}">Q${qNum}</td>` : ''}
                <td class="subq-col">${subPart}</td>
                <td class="question-col">
                    <div class="question-content">
                        <span class="question-text">${questionText}</span>
                    </div>
                </td>
                <td class="marks-col">${question.marks}</td>
            </tr>
          `;
        });
        
        // Add OR row after each question group (except the last in module)
        if (groupIndex < sortedQGroups.length - 1) {
          rows += `
            <tr class="or-row">
                <td colspan="4"><strong>OR</strong></td>
            </tr>
          `;
        }
      });
    });
    
    return rows;
  }

  static async convertHTMLToPDF(html: string): Promise<Uint8Array> {
    // Method 1: Try html2pdf.js
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '8.5in'; // A4 width
      document.body.appendChild(tempDiv);
      
      const options = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: 'vtu-question-paper.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          width: 816, // 8.5 inches * 96 DPI
          height: 1056 // 11 inches * 96 DPI
        },
        jsPDF: { 
          unit: 'in', 
          format: 'a4', 
          orientation: 'portrait' 
        }
      };
      
      const pdfBlob = await html2pdf().set(options).from(tempDiv).outputPdf('blob');
      document.body.removeChild(tempDiv);
      
      const arrayBuffer = await pdfBlob.arrayBuffer();
      return new Uint8Array(arrayBuffer);
      
    } catch (error) {
      console.error('html2pdf failed, using browser print method:', error);
      // Method 2: Use browser's print to PDF
      this.openPrintableVersion(html);
      return new Uint8Array();
    }
  }

  static openPrintableVersion(html: string) {
    // Create optimized HTML for printing
    const printableHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>VTU Question Paper</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 0.5in;
            }
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
        ${this.extractCSSFromHTML(html)}
    </style>
</head>
<body>
    ${this.extractBodyFromHTML(html)}
    <script>
        window.addEventListener('load', function() {
            // Auto-open print dialog
            setTimeout(() => {
                window.print();
            }, 500);
        });
    </script>
</body>
</html>`;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printableHtml);
      printWindow.document.close();
    }
  }

  private static extractCSSFromHTML(html: string): string {
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    return styleMatch ? styleMatch[1] : '';
  }

  private static extractBodyFromHTML(html: string): string {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
  }

  static downloadHTML(html: string, filename: string = 'vtu-question-paper.html') {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static downloadPrintReadyHTML(html: string, filename: string = 'vtu-question-paper-print.html') {
    // Create HTML optimized for printing to PDF
    const printReadyHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>VTU Question Paper - Ready to Print</title>
    <style>
        @page {
            size: A4;
            margin: 0.5in;
        }
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
        ${this.extractCSSFromHTML(html)}
        
        /* Print instructions styles */
        .print-instructions {
            background: #e3f2fd;
            border: 2px solid #1976d2;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            font-family: Arial, sans-serif;
        }
        .print-instructions h3 {
            color: #1976d2;
            margin-top: 0;
        }
        .print-button {
            background: #1976d2;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            margin: 10px 10px 10px 0;
        }
        .print-button:hover {
            background: #1565c0;
        }
        @media print {
            .print-instructions {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="print-instructions">
        <h3>📋 How to Convert to PDF:</h3>
        <p><strong>Option 1:</strong> Click the "Print as PDF" button below</p>
        <p><strong>Option 2:</strong> Press <kbd>Ctrl+P</kbd> (Windows) or <kbd>Cmd+P</kbd> (Mac), then select "Save as PDF"</p>
        <p><strong>Option 3:</strong> Use your browser's File → Print menu and choose "Save as PDF"</p>
        
        <button class="print-button" onclick="window.print()">🖨️ Print as PDF</button>
        <button class="print-button" onclick="document.querySelector('.print-instructions').style.display='none'">✅ Hide Instructions</button>
    </div>
    
    ${this.extractBodyFromHTML(html)}
</body>
</html>`;

    const blob = new Blob([printReadyHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}