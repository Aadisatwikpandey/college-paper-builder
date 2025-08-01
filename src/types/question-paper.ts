export interface Question {
  id: string;
  text: string;
  marks: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNum?: number;
  };
  alternatives: string[];
}

export interface QuestionPaper {
  id: string;
  title: string;
  template: string;
  questions: Question[];
  originalPdfData: ArrayBuffer;
  metadata: {
    uploadedAt: Date;
    fileName: string;
    pageCount: number;
  };
}

export interface PdfProcessingResult {
  text: string;
  questions: Question[];
  template: string;
}