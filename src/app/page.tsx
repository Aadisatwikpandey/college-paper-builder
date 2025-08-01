'use client';

import { useState } from 'react';
import PdfUpload from '@/components/pdf-upload';
import QuestionSelector from '@/components/question-selector';
import { Question } from '@/types/question-paper';
import { PdfProcessor } from '@/utils/pdf-processor';

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [originalPdf, setOriginalPdf] = useState<Uint8Array | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'select'>('upload');

  const handlePdfProcessed = (processedQuestions: Question[], pdfData: Uint8Array) => {
    setQuestions(processedQuestions);
    // Store Uint8Array directly - no conversion needed
    setOriginalPdf(pdfData);
    setCurrentStep('select');
  };

  const handleGeneratePdf = async (selectedQuestions: { [questionId: string]: string }) => {
    if (!originalPdf) return;

    try {
      const modifiedPdfBytes = await PdfProcessor.createModifiedPdf(originalPdf, selectedQuestions);
      
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modified-question-paper.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setOriginalPdf(null);
    setCurrentStep('upload');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            VTU Question Paper Builder
          </h1>
          <p className="text-lg text-gray-600">
            Upload your question paper, customize questions, and generate new variations
          </p>
        </div>

        {currentStep === 'upload' && (
          <div className="space-y-8">
            <PdfUpload onPdfProcessed={handlePdfProcessed} />
          </div>
        )}

        {currentStep === 'select' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                Found {questions.length} questions in your paper
              </h2>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Upload New Paper
              </button>
            </div>
            
            <QuestionSelector 
              questions={questions} 
              onGeneratePdf={handleGeneratePdf}
            />
          </div>
        )}
      </div>
    </div>
  );
}
