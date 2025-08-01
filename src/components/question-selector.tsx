'use client';

import { useState, useEffect } from 'react';
import { Question } from '@/types/question-paper';
import { ChevronDown, Download } from 'lucide-react';

interface QuestionSelectorProps {
  questions: Question[];
  onGeneratePdf: (selectedQuestions: { [questionId: string]: string }) => void;
}

export default function QuestionSelector({ questions, onGeneratePdf }: QuestionSelectorProps) {
  const [selectedQuestions, setSelectedQuestions] = useState<{ [questionId: string]: string }>({});
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());

  // Auto-select original questions by default
  useEffect(() => {
    if (questions.length > 0) {
      const defaultSelections: { [questionId: string]: string } = {};
      questions.forEach(question => {
        defaultSelections[question.id] = question.text;
      });
      setSelectedQuestions(defaultSelections);
    }
  }, [questions]);

  const handleQuestionSelect = (questionId: string, selectedText: string) => {
    setSelectedQuestions(prev => ({
      ...prev,
      [questionId]: selectedText
    }));
  };

  const toggleQuestionExpansion = (questionId: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
    
    // Mark as visited
    setVisitedQuestions(prev => new Set([...prev, questionId]));
  };

  const handleGeneratePdf = () => {
    onGeneratePdf(selectedQuestions);
  };

  const allQuestionsSelected = questions.length > 0 && Object.keys(selectedQuestions).length === questions.length;
  const questionsReady = questions.length > 0 && Object.keys(selectedQuestions).length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select Questions for Your Paper
        </h2>
        <p className="text-gray-600">
          Original questions are pre-selected. Click on any question to choose from 5 generated alternatives, or keep the original.
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((question) => (
          <div key={question.id} className={`border rounded-lg overflow-hidden transition-all ${
            visitedQuestions.has(question.id) 
              ? 'border-blue-300 bg-blue-50' 
              : 'border-gray-200'
          }`}>
            <div
              className={`p-4 cursor-pointer hover:bg-gray-100 transition-colors ${
                visitedQuestions.has(question.id) ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50'
              }`}
              onClick={() => toggleQuestionExpansion(question.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    Question {question.id} ({question.marks} marks)
                    {visitedQuestions.has(question.id) && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Reviewed</span>
                    )}
                    {selectedQuestions[question.id] === question.text && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Original</span>
                    )}
                    {selectedQuestions[question.id] && selectedQuestions[question.id] !== question.text && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Alternative</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {selectedQuestions[question.id] || question.text}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-gray-400 transition-transform ${
                    expandedQuestions.has(question.id) ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {expandedQuestions.has(question.id) && (
              <div className="p-4 border-t border-gray-200">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Select a question version:
                  </div>
                  
                  {/* Original Question */}
                  <label className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={question.text}
                      checked={selectedQuestions[question.id] === question.text}
                      onChange={(e) => handleQuestionSelect(question.id, e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-xs text-blue-600 font-medium mb-1">Original</div>
                      <div className="text-sm text-gray-900">{question.text}</div>
                    </div>
                  </label>

                  {/* Alternative Questions */}
                  {question.alternatives.map((alternative, altIndex) => (
                    <label
                      key={altIndex}
                      className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={alternative}
                        checked={selectedQuestions[question.id] === alternative}
                        onChange={(e) => handleQuestionSelect(question.id, e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="text-xs text-green-600 font-medium mb-1">
                          Alternative {altIndex + 1}
                        </div>
                        <div className="text-sm text-gray-900">{alternative}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Always visible download section with sticky positioning */}
      {questions.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 pb-2 z-10">
          <div className="flex justify-center space-x-4">
            <div className="text-center text-sm text-gray-600 flex items-center">
              <span className="mr-2">
                {Object.keys(selectedQuestions).length} of {questions.length} questions ready
              </span>
              {allQuestionsSelected && (
                <span className="text-green-600 font-medium">✓ All Ready</span>
              )}
            </div>
            <button
              onClick={handleGeneratePdf}
              disabled={!questionsReady}
              className={`
                flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-all shadow-lg
                ${questionsReady
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              <Download className="h-5 w-5" />
              <span>Generate Question Paper</span>
            </button>
          </div>
        </div>
      )}

      {/* Add some bottom padding to account for sticky footer */}
      <div className="pb-20"></div>
    </div>
  );
}