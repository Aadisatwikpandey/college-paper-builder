'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { PdfProcessor } from '@/utils/pdf-processor';
import { Question } from '@/types/question-paper';

interface PdfUploadProps {
  onPdfProcessed: (questions: Question[], originalPdf: Uint8Array) => void;
}

export default function PdfUpload({ onPdfProcessed }: PdfUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      console.log('Starting PDF processing...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength);
      
      // Clone the ArrayBuffer for PDF.js to prevent detachment of original
      const clonedArrayBuffer = arrayBuffer.slice(0);
      console.log('Cloned ArrayBuffer for PDF.js processing');
      
      // Convert original to Uint8Array for storage
      const pdfData = new Uint8Array(arrayBuffer);
      console.log('Converted to Uint8Array, size:', pdfData.length);
      
      console.log('Extracting text from PDF...');
      const text = await PdfProcessor.extractTextFromPdf(clonedArrayBuffer);
      console.log('Text extraction complete, length:', text.length);
      
      console.log('Extracting questions...');
      const questions = PdfProcessor.extractQuestions(text);
      console.log('Found questions:', questions.length);
      
      // Generate alternatives for each question
      const questionsWithAlternatives = questions.map(question => ({
        ...question,
        alternatives: PdfProcessor.generateSimilarQuestions(question.text)
      }));
      
      console.log('Processing complete, calling onPdfProcessed...');
      // Pass the Uint8Array directly
      onPdfProcessed(questionsWithAlternatives, pdfData);
    } catch (err) {
      console.error('PDF processing error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to process PDF';
      setError(errorMsg);
      alert(`PDF Processing Error: ${errorMsg}`); // Make error more visible
    } finally {
      setIsProcessing(false);
    }
  }, [onPdfProcessed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: isProcessing
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {isProcessing ? (
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
          ) : (
            <Upload className="h-12 w-12 text-gray-400" />
          )}
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isProcessing ? 'Processing PDF...' : 'Upload Question Paper'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {isDragActive
                ? 'Drop the PDF file here'
                : 'Drag and drop a PDF file, or click to select'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}