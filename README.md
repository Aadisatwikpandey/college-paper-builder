# VTU Question Paper Builder

A web application that allows you to upload VTU (Visvesvaraya Technological University) question papers in PDF format, extract questions automatically, and generate customized question papers with alternative questions.

## Features

- **PDF Upload & Processing**: Upload VTU question papers in PDF format
- **Automatic Question Extraction**: Intelligently extracts questions with sub-parts (a, b, c)
- **Question Replacement**: Replace any question with AI-generated alternatives
- **Authentic VTU Format**: Generates HTML output that matches official VTU question paper formatting
- **Print-to-PDF**: Easy conversion to PDF using your browser's print function (Cmd+P / Ctrl+P)

## How It Works

1. **Upload**: Upload a VTU question paper PDF file
2. **Extract**: The system automatically extracts questions and organizes them by modules
3. **Customize**: Select alternative questions for any question you want to replace
4. **Generate**: Download an HTML file that can be printed to PDF with authentic VTU formatting

## Prerequisites

- Node.js 18+ installed on your system
- A modern web browser (Chrome, Firefox, Safari, Edge)

## Installation & Setup

1. **Clone or download the project**:
   ```bash
   git clone https://github.com/Aadisatwikpandey/college-paper-builder
   cd vtu-question-paper-builder
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

## How to Use

### Step 1: Upload a PDF

1. Click on the **"Choose PDF file"** button or drag and drop your VTU question paper PDF
2. Supported formats: PDF files containing VTU question papers
3. The system will automatically process the PDF and extract questions

**Sample Files**: For testing purposes, you can use these official VTU question papers:
- [BETCK105C Set 1 - Introduction to Nanotechnology](https://vtu.ac.in/pdf/QP/BETCK105Cset1.pdf)
- [BETCK105C Set 2 - Introduction to Nanotechnology](https://vtu.ac.in/pdf/QP/BETCK105Cset2.pdf)

**Note**: This application works best with official VTU question papers that follow the standard format with clear question numbering and module organization. The sample files above are tested and work perfectly with this application.

### Step 2: Review Extracted Questions

- After upload, you'll see all extracted questions organized by modules
- Questions are displayed with their original text and marks
- Each question shows sub-parts (a, b, c) separately

### Step 3: Select Alternative Questions

1. For any question you want to replace, click **"Select Alternative"**
2. Choose from the available alternative questions
3. The selected alternative will replace the original question in the final output

### Step 4: Generate Question Paper

1. Click **"Generate Question Paper"** when you're satisfied with your selections
2. An HTML file will be downloaded automatically
3. The file will also open in a new browser tab

### Step 5: Convert to PDF

1. In the opened HTML page, click **"Print as PDF"** button, OR
2. Press **Cmd+P** (Mac) or **Ctrl+P** (Windows)
3. Select **"Save as PDF"** as the destination
4. Save your customized question paper

## File Structure

```
vtu-question-paper-builder/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main application page
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── pdf-upload.tsx        # PDF upload component
│   │   └── question-selector.tsx # Question selection interface
│   ├── types/
│   │   └── question-paper.ts     # TypeScript type definitions
│   └── utils/
│       ├── pdf-processor.ts      # PDF processing and question extraction
│       └── html-pdf-generator.ts # HTML template generation
├── public/                       # Static assets
├── next.config.ts               # Next.js configuration
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

## Technical Details

### Question Extraction Algorithm

The system uses a multi-pass extraction approach:

1. **Pass 1**: Strict pattern matching for well-formatted questions
2. **Pass 2**: Flexible pattern matching for variations in formatting
3. **Pass 3**: Sequential correction to ensure proper sub-question ordering (a, b, c)

### Supported Question Formats

- Standard VTU format with Q1, Q2, Q3... numbering
- Sub-questions marked as a, b, c
- Questions with marks (typically 8 marks)
- Module-based organization (Module-1, Module-2, etc.)

### HTML Template Features

- Authentic VTU formatting with proper headers and layout
- Table structure matching official question papers
- Print-optimized CSS for clean PDF generation
- Responsive design for different screen sizes

## Troubleshooting

### Common Issues

**Q: PDF upload fails or shows error**
- Ensure the PDF is not password-protected
- Check that the PDF contains text (not just images)
- Try with a different VTU question paper PDF

**Q: Questions are not extracted properly**
- The PDF might have unusual formatting
- Check browser console for error messages
- Ensure the PDF follows standard VTU format

**Q: Generated HTML doesn't look right**
- Clear browser cache and reload
- Check if all questions were extracted correctly
- Verify the original PDF follows VTU standards

**Q: Print to PDF doesn't work**
- Use Chrome or Firefox for best results
- Ensure print settings are set to A4 size
- Check print preview before saving

### Browser Compatibility

- **Recommended**: Chrome, Firefox
- **Supported**: Safari, Edge
- **Note**: Some PDF processing features work best in Chrome

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Dependencies

- **Next.js 15** - React framework
- **pdf-lib** - PDF manipulation
- **pdfjs-dist** - PDF text extraction
- **React Dropzone** - File upload interface
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Limitations

- Only works with text-based PDFs (not scanned images)
- Designed specifically for VTU question paper format
- Alternative question generation is template-based (not AI-powered)
- Requires modern browser with JavaScript enabled

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes. Please respect copyright and usage policies of VTU question papers.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Ensure you're using a supported VTU question paper format

---

**Note**: This tool is designed to help educators and students work with VTU question papers more efficiently. Always verify the generated output matches VTU standards before official use.
